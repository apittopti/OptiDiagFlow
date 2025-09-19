/**
 * ODX XML Builder
 * Generates ODX XML files from parsed diagnostic data
 */

import { create } from 'xmlbuilder2'
import { XMLBuilder } from 'xmlbuilder2/lib/interfaces'
import { ParsedSession, ECUInfo, DataIdentifier, UDS_SERVICES } from '../trace-parser/jifeline-parser'
import * as fs from 'fs-extra'
import * as path from 'path'
import archiver from 'archiver'

export interface VehicleData {
  name: string
  manufacturer?: string
  model?: string
  year?: string
  vin?: string
}

export interface ECUData {
  name: string
  address: string
  variant?: string
  dids: DataIdentifier[]
  services: string[]
}

export interface DIDInfo {
  id: string
  name: string
  dataLength: number
  unit?: string
  conversion?: {
    type: 'LINEAR' | 'TEXT_TABLE' | 'IDENTICAL'
    factor?: number
    offset?: number
    textMap?: Record<string, string>
  }
}

export interface ODXGenerationOptions {
  jobId: string
  vehicleData: VehicleData
  outputPath: string
  includeTemplates?: boolean
}

export class ODXBuilder {
  private readonly ODX_VERSION = '2.2.0'
  private readonly NAMESPACE = 'http://www.w3.org/2001/XMLSchema-instance'

  /**
   * Generate complete ODX package from parsed session
   */
  async generateODXPackage(
    session: ParsedSession,
    options: ODXGenerationOptions
  ): Promise<{ success: boolean; files: string[]; pdxPath?: string }> {
    const files: string[] = []

    try {
      // Create output directory
      const odxDir = path.join(options.outputPath, 'odx', options.jobId)
      await fs.ensureDir(odxDir)

      // Generate vehicle file
      const vehicleFile = path.join(odxDir, 'vehicle.odx-v')
      const vehicleXml = this.generateVehicleFile(options.vehicleData, session)
      await fs.writeFile(vehicleFile, vehicleXml)
      files.push(vehicleFile)

      // Generate ECU diagnostic layers
      for (const [address, ecuInfo] of session.ecus) {
        if (ecuInfo.type === 'Remote' && ecuInfo.messageCount > 0) {
          const ecuData: ECUData = {
            name: ecuInfo.name,
            address: ecuInfo.address,
            dids: Array.from(session.dids.values()).filter(did => did.ecuAddress === address),
            services: Array.from(ecuInfo.services)
          }

          const ecuFile = path.join(odxDir, `${ecuInfo.name.toLowerCase()}.odx-d`)
          const ecuXml = this.generateECUDiagnosticLayer(ecuData)
          await fs.writeFile(ecuFile, ecuXml)
          files.push(ecuFile)
        }
      }

      // Generate catalog file
      const catalogFile = path.join(odxDir, 'catalog.xml')
      const catalogXml = this.generateCatalog(files, options.vehicleData)
      await fs.writeFile(catalogFile, catalogXml)
      files.push(catalogFile)

      // Generate metadata file
      const metadataFile = path.join(odxDir, 'metadata.json')
      const metadata = {
        jobId: options.jobId,
        generatedAt: new Date().toISOString(),
        vehicle: options.vehicleData,
        sessionInfo: session.metadata,
        ecuCount: session.ecus.size,
        didCount: session.dids.size,
        files: files.map(f => path.basename(f))
      }
      await fs.writeJSON(metadataFile, metadata, { spaces: 2 })

      // Create PDX archive (optional)
      const pdxPath = await this.createPDXArchive(odxDir, options.jobId)

      return {
        success: true,
        files,
        pdxPath
      }
    } catch (error) {
      console.error('Error generating ODX package:', error)
      return {
        success: false,
        files
      }
    }
  }

  /**
   * Generate ODX-V vehicle file
   */
  generateVehicleFile(vehicleInfo: VehicleData, session: ParsedSession): string {
    const doc = create({ encoding: 'UTF-8' })

    const odx = doc.ele('ODX', {
      'xmlns:xsi': this.NAMESPACE,
      'xsi:noNamespaceSchemaLocation': 'odx.xsd',
      'MODEL-VERSION': this.ODX_VERSION
    })

    const vehicleSpec = odx.ele('VEHICLE-INFO-SPEC', {
      ID: `VIS.${vehicleInfo.name.toUpperCase()}`
    })

    vehicleSpec.ele('SHORT-NAME').txt(vehicleInfo.name.toUpperCase())

    // Info components
    const infoComponents = vehicleSpec.ele('INFO-COMPONENTS')
    const infoComponent = infoComponents.ele('INFO-COMPONENT', {
      'xsi:type': 'VEHICLE-MODEL',
      ID: 'Id_InfoComponents'
    })
    infoComponent.ele('SHORT-NAME').txt(vehicleInfo.manufacturer || 'UNKNOWN')
    infoComponent.ele('LONG-NAME').txt(`${vehicleInfo.manufacturer} ${vehicleInfo.model}` || 'Vehicle')

    // Vehicle information
    const vehicleInformations = vehicleSpec.ele('VEHICLE-INFORMATIONS')
    const vehicleInformation = vehicleInformations.ele('VEHICLE-INFORMATION')
    vehicleInformation.ele('SHORT-NAME').txt(`VIS_${vehicleInfo.name}`)

    const infoComponentRefs = vehicleInformation.ele('INFO-COMPONENT-REFS')
    infoComponentRefs.ele('INFO-COMPONENT-REF', { 'ID-REF': 'Id_InfoComponents' })

    // Vehicle connectors (DOIP)
    const vehicleConnectors = vehicleInformation.ele('VEHICLE-CONNECTORS')
    const vehicleConnector = vehicleConnectors.ele('VEHICLE-CONNECTOR')
    vehicleConnector.ele('SHORT-NAME').txt('VCONN_DOIP')

    const connectorPins = vehicleConnector.ele('VEHICLE-CONNECTOR-PINS')
    const ethernetPin = connectorPins.ele('VEHICLE-CONNECTOR-PIN', {
      ID: 'VIS.VCP.ETHERNET',
      TYPE: 'ETHERNET'
    })
    ethernetPin.ele('SHORT-NAME').txt('VCONN_ETHERNET')
    ethernetPin.ele('PIN-NUMBER').txt('1')

    // Logical links for each ECU
    const logicalLinks = vehicleInformation.ele('LOGICAL-LINKS')

    // Add functional addressing link
    const functionalLink = logicalLinks.ele('LOGICAL-LINK', {
      'xsi:type': 'MEMBER-LOGICAL-LINK',
      ID: 'VIS.LL_FUNCTIONAL'
    })
    functionalLink.ele('SHORT-NAME').txt('FUNCTIONAL')
    functionalLink.ele('PHYSICAL-VEHICLE-LINK-REF', { 'ID-REF': 'VIS.PVL.DOIP' })
    functionalLink.ele('PROTOCOL-REF', {
      DOCREF: 'PL_DOIP',
      DOCTYPE: 'CONTAINER',
      'ID-REF': 'PRT.PL_DOIP'
    })

    // Add logical link for each ECU
    for (const [address, ecuInfo] of session.ecus) {
      if (ecuInfo.type === 'Remote' && ecuInfo.messageCount > 0) {
        const ecuLink = logicalLinks.ele('LOGICAL-LINK', {
          'xsi:type': 'MEMBER-LOGICAL-LINK',
          ID: `VIS.LL_${ecuInfo.name.toUpperCase()}`
        })
        ecuLink.ele('SHORT-NAME').txt(ecuInfo.name.toUpperCase())
        ecuLink.ele('PHYSICAL-VEHICLE-LINK-REF', { 'ID-REF': 'VIS.PVL.DOIP' })
        ecuLink.ele('PROTOCOL-REF', {
          DOCREF: 'PL_DOIP',
          DOCTYPE: 'CONTAINER',
          'ID-REF': 'PRT.PL_DOIP'
        })
        ecuLink.ele('BASE-VARIANT-REF', {
          DOCREF: `DLC_${ecuInfo.name.toUpperCase()}`,
          DOCTYPE: 'CONTAINER',
          'ID-REF': `ID_DL_${ecuInfo.name.toUpperCase()}`
        })
      }
    }

    // Physical vehicle links
    const physicalVehicleLinks = vehicleInformation.ele('PHYSICAL-VEHICLE-LINKS')
    const pvlDoip = physicalVehicleLinks.ele('PHYSICAL-VEHICLE-LINK', {
      ID: 'VIS.PVL.DOIP',
      TYPE: 'DOIP'
    })
    pvlDoip.ele('SHORT-NAME').txt('PVL_DOIP')
    pvlDoip.ele('LONG-NAME').txt('Physical Vehicle Link DOIP')

    const vehicleConnectorRef = pvlDoip.ele('VEHICLE-CONNECTOR-REF')
    vehicleConnectorRef.ele('VEHICLE-CONNECTOR-PIN-REF', { 'ID-REF': 'VIS.VCP.ETHERNET' })

    return doc.end({ prettyPrint: true })
  }

  /**
   * Generate ODX-D ECU diagnostic layer
   */
  generateECUDiagnosticLayer(ecu: ECUData): string {
    const doc = create({ encoding: 'UTF-8' })

    const odx = doc.ele('ODX', {
      'xmlns:xsi': this.NAMESPACE,
      'xsi:noNamespaceSchemaLocation': 'odx.xsd',
      'MODEL-VERSION': this.ODX_VERSION
    })

    const diagLayer = odx.ele('DIAG-LAYER-CONTAINER', {
      ID: `DLC_${ecu.name.toUpperCase()}`
    })

    diagLayer.ele('SHORT-NAME').txt(ecu.name.toUpperCase())
    diagLayer.ele('LONG-NAME').txt(`${ecu.name} Diagnostic Layer`)

    // Base variant
    const baseVariants = diagLayer.ele('BASE-VARIANTS')
    const baseVariant = baseVariants.ele('BASE-VARIANT', {
      ID: `ID_DL_${ecu.name.toUpperCase()}`
    })

    baseVariant.ele('SHORT-NAME').txt(`BV_${ecu.name.toUpperCase()}`)
    baseVariant.ele('LONG-NAME').txt(`${ecu.name} Base Variant`)
    baseVariant.ele('CATEGORY').txt('ECU')

    // Diag data dictionary
    const diagDataDict = baseVariant.ele('DIAG-DATA-DICTIONARY-SPEC')

    // Data object props for DIDs
    const dataObjectProps = diagDataDict.ele('DATA-OBJECT-PROPS')
    for (const did of ecu.dids) {
      this.addDataObjectProp(dataObjectProps, did)
    }

    // Unit specs
    const unitSpec = diagDataDict.ele('UNIT-SPEC')
    this.addCommonUnits(unitSpec)

    // Diagnostic communication
    const diagComm = baseVariant.ele('DIAG-COMMS')
    const diagService = diagComm.ele('DIAG-SERVICES')

    // Add diagnostic services
    for (const did of ecu.dids) {
      this.addDiagnosticService(diagService, did, ecu.address)
    }

    // Add other UDS services
    for (const serviceId of ecu.services) {
      if (serviceId !== '22' && serviceId !== '62') {
        this.addGenericService(diagService, serviceId, ecu.address)
      }
    }

    // Requests and responses
    const singleEcuJobs = diagComm.ele('SINGLE-ECU-JOBS')
    for (const did of ecu.dids) {
      this.addSingleEcuJob(singleEcuJobs, did)
    }

    return doc.end({ prettyPrint: true })
  }

  /**
   * Add data object prop for a DID
   */
  private addDataObjectProp(parent: XMLBuilder, did: DataIdentifier) {
    const dop = parent.ele('DATA-OBJECT-PROP', {
      ID: `DOP_${did.did}`
    })
    dop.ele('SHORT-NAME').txt(`DOP_${did.did}`)
    dop.ele('LONG-NAME').txt(`Data Object Property ${did.did}`)

    const compuMethod = dop.ele('COMPU-METHOD')
    compuMethod.ele('CATEGORY').txt('IDENTICAL')

    const physType = dop.ele('PHYSICAL-TYPE')
    physType.ele('BASE-DATA-TYPE').txt('A_UINT8')

    const internalType = dop.ele('INTERNAL-TYPE')
    internalType.ele('BASE-DATA-TYPE').txt('A_UINT8')

    if (did.dataLength) {
      dop.ele('BYTE-POSITION').txt('0')
      dop.ele('LENGTH').txt(did.dataLength.toString())
    }
  }

  /**
   * Add common units
   */
  private addCommonUnits(unitSpec: XMLBuilder) {
    const units = [
      { id: 'UNIT_KMH', name: 'km/h', displayName: 'Kilometers per hour' },
      { id: 'UNIT_CELSIUS', name: '°C', displayName: 'Degrees Celsius' },
      { id: 'UNIT_VOLT', name: 'V', displayName: 'Volts' },
      { id: 'UNIT_PERCENT', name: '%', displayName: 'Percent' }
    ]

    const physDimension = unitSpec.ele('PHYSICAL-DIMENSIONS')
    const physDim = physDimension.ele('PHYSICAL-DIMENSION', { ID: 'DIM_DEFAULT' })
    physDim.ele('SHORT-NAME').txt('DEFAULT')
    physDim.ele('LONG-NAME').txt('Default Dimension')

    const unitsElement = unitSpec.ele('UNITS')
    for (const unit of units) {
      const unitElement = unitsElement.ele('UNIT', { ID: unit.id })
      unitElement.ele('SHORT-NAME').txt(unit.name)
      unitElement.ele('DISPLAY-NAME').txt(unit.displayName)
      unitElement.ele('PHYSICAL-DIMENSION-REF', { 'ID-REF': 'DIM_DEFAULT' })
    }
  }

  /**
   * Add diagnostic service for a DID
   */
  private addDiagnosticService(parent: XMLBuilder, did: DataIdentifier, ecuAddress: string) {
    const service = parent.ele('DIAG-SERVICE', {
      ID: `ID_DIAG_SER_RD_${did.did}`,
      SEMANTIC: 'DATA'
    })

    service.ele('SHORT-NAME').txt(`Read_${did.did}`)
    service.ele('LONG-NAME').txt(`Read Data Identifier ${did.did}`)
    service.ele('REQUEST-REF', { 'ID-REF': `ID_RQ_${did.did}` })

    const posResponseRefs = service.ele('POS-RESPONSE-REFS')
    posResponseRefs.ele('POS-RESPONSE-REF', { 'ID-REF': `ID_PR_${did.did}` })

    const negResponseRefs = service.ele('NEG-RESPONSE-REFS')
    negResponseRefs.ele('NEG-RESPONSE-REF', { 'ID-REF': 'ID_NR_Generic' })
  }

  /**
   * Add generic UDS service
   */
  private addGenericService(parent: XMLBuilder, serviceId: string, ecuAddress: string) {
    const serviceName = UDS_SERVICES[serviceId] || `Service_${serviceId}`

    const service = parent.ele('DIAG-SERVICE', {
      ID: `ID_DIAG_SER_${serviceName}`,
      SEMANTIC: 'FUNCTION'
    })

    service.ele('SHORT-NAME').txt(serviceName)
    service.ele('LONG-NAME').txt(serviceName)
    service.ele('REQUEST-REF', { 'ID-REF': `ID_RQ_${serviceName}` })

    const posResponseRefs = service.ele('POS-RESPONSE-REFS')
    posResponseRefs.ele('POS-RESPONSE-REF', { 'ID-REF': `ID_PR_${serviceName}` })

    const negResponseRefs = service.ele('NEG-RESPONSE-REFS')
    negResponseRefs.ele('NEG-RESPONSE-REF', { 'ID-REF': 'ID_NR_Generic' })
  }

  /**
   * Add single ECU job for a DID
   */
  private addSingleEcuJob(parent: XMLBuilder, did: DataIdentifier) {
    const job = parent.ele('SINGLE-ECU-JOB', {
      ID: `JOB_${did.did}`
    })

    job.ele('SHORT-NAME').txt(`Job_Read_${did.did}`)

    const functClasses = job.ele('FUNCTIONAL-CLASS-REFS')
    functClasses.ele('FUNCTIONAL-CLASS-REF', { 'ID-REF': 'FC_ReadData' })

    const diagCommSnRefs = job.ele('DIAG-COMM-SN-REFS')
    diagCommSnRefs.ele('DIAG-COMM-SN-REF', {
      'SHORT-NAME': `Read_${did.did}`,
      'ID-REF': `ID_DIAG_SER_RD_${did.did}`
    })
  }

  /**
   * Generate catalog file
   */
  private generateCatalog(files: string[], vehicleData: VehicleData): string {
    const doc = create({ encoding: 'UTF-8' })

    const catalog = doc.ele('CATALOG', {
      'xmlns:xsi': this.NAMESPACE,
      'xsi:noNamespaceSchemaLocation': 'catalog.xsd'
    })

    catalog.ele('SHORT-NAME').txt(`Catalog_${vehicleData.name}`)
    catalog.ele('LONG-NAME').txt(`ODX Catalog for ${vehicleData.name}`)

    const variants = catalog.ele('VARIANTS')

    for (const file of files) {
      if (file.endsWith('.odx-d') || file.endsWith('.odx-v')) {
        const variant = variants.ele('VARIANT')
        variant.ele('SHORT-NAME').txt(path.basename(file, path.extname(file)))
        variant.ele('FILE-NAME').txt(path.basename(file))
      }
    }

    return doc.end({ prettyPrint: true })
  }

  /**
   * Create PDX archive
   */
  private async createPDXArchive(odxDir: string, jobId: string): Promise<string> {
    const pdxPath = path.join(odxDir, `${jobId}.pdx`)
    const output = fs.createWriteStream(pdxPath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    return new Promise((resolve, reject) => {
      output.on('close', () => resolve(pdxPath))
      archive.on('error', reject)

      archive.pipe(output)

      // Add all ODX files to the archive
      archive.glob('*.odx-*', { cwd: odxDir })
      archive.glob('*.xml', { cwd: odxDir })

      archive.finalize()
    })
  }

  /**
   * Generate data identifier with conversion
   */
  generateDataIdentifier(did: DIDInfo): XMLBuilder {
    const doc = create()
    const diagService = doc.ele('DIAG-SERVICE', {
      ID: `ID_DIAG_SER_RD_${did.id}`,
      SEMANTIC: 'DATA'
    })

    diagService.ele('SHORT-NAME').txt(did.name || `Read_${did.id}`)
    diagService.ele('LONG-NAME').txt(`Read ${did.name || did.id}`)

    // Request
    const request = diagService.ele('REQUEST', { ID: `ID_RQ_${did.id}` })
    request.ele('SHORT-NAME').txt(`RQ_${did.id}`)

    const reqParams = request.ele('PARAMS')
    const reqParam = reqParams.ele('PARAM', { SEMANTIC: 'SERVICE-ID' })
    reqParam.ele('SHORT-NAME').txt('SID')
    reqParam.ele('BYTE-POSITION').txt('0')
    reqParam.ele('CODED-VALUE').txt('22')

    const didParam = reqParams.ele('PARAM', { SEMANTIC: 'ID' })
    didParam.ele('SHORT-NAME').txt('DID')
    didParam.ele('BYTE-POSITION').txt('1')
    didParam.ele('CODED-VALUE').txt(did.id)

    // Positive response
    const posResponse = diagService.ele('POS-RESPONSE', { ID: `ID_PR_${did.id}` })
    posResponse.ele('SHORT-NAME').txt(`PR_${did.id}`)

    const resParams = posResponse.ele('PARAMS')
    const resParam = resParams.ele('PARAM', { SEMANTIC: 'SERVICE-ID' })
    resParam.ele('SHORT-NAME').txt('SID')
    resParam.ele('BYTE-POSITION').txt('0')
    resParam.ele('CODED-VALUE').txt('62')

    const resDidParam = resParams.ele('PARAM', { SEMANTIC: 'ID' })
    resDidParam.ele('SHORT-NAME').txt('DID')
    resDidParam.ele('BYTE-POSITION').txt('1')
    resDidParam.ele('CODED-VALUE').txt(did.id)

    const dataParam = resParams.ele('PARAM', { SEMANTIC: 'DATA' })
    dataParam.ele('SHORT-NAME').txt('DATA')
    dataParam.ele('BYTE-POSITION').txt('3')
    dataParam.ele('LENGTH').txt(did.dataLength.toString())

    if (did.conversion) {
      dataParam.ele('DOP-REF', { 'ID-REF': `DOP_${did.id}` })
    }

    // Negative response reference
    const negResponseRefs = diagService.ele('NEG-RESPONSE-REFS')
    negResponseRefs.ele('NEG-RESPONSE-REF', { 'ID-REF': 'ID_NR_Generic' })

    return diagService
  }
}