import { DiscoveredECU, DIDInfo, RoutineInfo } from '../trace-parser/jifeline-parser'
import { DTCInfo } from '../doip-parser'
import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuidv4 } from 'uuid'

export interface ODXDocument {
  docType: 'DIAG-LAYER' | 'VEHICLE-INFO' | 'PROTOCOL' | 'ECU-MEM'
  shortName: string
  longName: string
  id: string
  content: string
}

export interface ReverseEngineeredODX {
  vehicleInfo: ODXDocument
  ecuLayers: ODXDocument[]
  protocolLayer: ODXDocument
  comparam: ODXDocument
  timestamp: Date
  metadata: {
    oem: string
    model: string
    year: number
    discoveredECUs: number
    discoveredDIDs: number
    discoveredDTCs: number
    discoveredRoutines: number
  }
}

export class ODXReverseEngineer {
  private readonly ODX_NAMESPACE = 'http://www.asam.net/xml/ODX'
  private readonly ODX_VERSION = '2.2.0'

  /**
   * Generate complete ODX from discovered ECUs
   */
  generateODX(
    ecus: Map<string, DiscoveredECU>,
    vehicleInfo: {
      oem: string
      model: string
      year: number
      vin?: string
    }
  ): ReverseEngineeredODX {
    const timestamp = new Date()
    const vehicleShortName = `${vehicleInfo.oem}_${vehicleInfo.model}_${vehicleInfo.year}`.replace(/\s+/g, '_').toUpperCase()

    // Generate vehicle info document
    const vehicleDoc = this.generateVehicleInfo(vehicleShortName, vehicleInfo)

    // Generate ECU layers
    const ecuLayers: ODXDocument[] = []
    for (const [address, ecu] of ecus) {
      const ecuLayer = this.generateECULayer(ecu, vehicleShortName)
      ecuLayers.push(ecuLayer)
    }

    // Generate protocol layer
    const protocolLayer = this.generateProtocolLayer(ecus, vehicleShortName)

    // Generate communication parameters
    const comparam = this.generateCommunicationParams(ecus, vehicleShortName)

    // Calculate metadata
    let totalDIDs = 0
    let totalDTCs = 0
    let totalRoutines = 0

    for (const ecu of ecus.values()) {
      totalDIDs += ecu.discoveredDIDs.size
      totalDTCs += ecu.discoveredDTCs.size
      totalRoutines += ecu.discoveredRoutines.size
    }

    return {
      vehicleInfo: vehicleDoc,
      ecuLayers,
      protocolLayer,
      comparam,
      timestamp,
      metadata: {
        oem: vehicleInfo.oem,
        model: vehicleInfo.model,
        year: vehicleInfo.year,
        discoveredECUs: ecus.size,
        discoveredDIDs: totalDIDs,
        discoveredDTCs: totalDTCs,
        discoveredRoutines: totalRoutines
      }
    }
  }

  /**
   * Generate vehicle info ODX document
   */
  private generateVehicleInfo(shortName: string, info: any): ODXDocument {
    const id = `ID_${uuidv4()}`

    const content = `<?xml version="1.0" encoding="UTF-8"?>
<ODX xmlns="${this.ODX_NAMESPACE}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" MODEL-VERSION="${this.ODX_VERSION}">
  <VEHICLE-INFO-SPEC ID="${id}">
    <SHORT-NAME>${shortName}_VEHICLE</SHORT-NAME>
    <LONG-NAME>${info.oem} ${info.model} ${info.year}</LONG-NAME>
    <VEHICLE-CONNECTORS>
      <VEHICLE-CONNECTOR ID="${id}_CONNECTOR">
        <SHORT-NAME>OBD_CONNECTOR</SHORT-NAME>
        <LONG-NAME>OBD-II Connector</LONG-NAME>
        <PINS>
          <PIN ID="${id}_PIN_6" NUMBER="6">
            <SHORT-NAME>CAN_HIGH</SHORT-NAME>
            <LONG-NAME>CAN High Signal</LONG-NAME>
          </PIN>
          <PIN ID="${id}_PIN_14" NUMBER="14">
            <SHORT-NAME>CAN_LOW</SHORT-NAME>
            <LONG-NAME>CAN Low Signal</LONG-NAME>
          </PIN>
        </PINS>
      </VEHICLE-CONNECTOR>
    </VEHICLE-CONNECTORS>
    ${info.vin ? `<VIN>${info.vin}</VIN>` : ''}
    <MANUFACTURER>${info.oem}</MANUFACTURER>
    <MODEL>${info.model}</MODEL>
    <MODEL-YEAR>${info.year}</MODEL-YEAR>
  </VEHICLE-INFO-SPEC>
</ODX>`

    return {
      docType: 'VEHICLE-INFO',
      shortName: `${shortName}_VEHICLE`,
      longName: `${info.oem} ${info.model} ${info.year}`,
      id,
      content
    }
  }

  /**
   * Generate ECU layer ODX document
   */
  private generateECULayer(ecu: DiscoveredECU, vehicleShortName: string): ODXDocument {
    const id = `ID_${uuidv4()}`
    const shortName = `${vehicleShortName}_${ecu.name}`.replace(/\s+/g, '_').toUpperCase()

    // Generate data object properties for discovered DIDs
    const dataObjectProps = this.generateDataObjectProps(ecu.discoveredDIDs)

    // Generate diagnostic services
    const diagServices = this.generateDiagnosticServices(ecu)

    // Generate DTC definitions
    const dtcDops = this.generateDTCDops(ecu.discoveredDTCs)

    const content = `<?xml version="1.0" encoding="UTF-8"?>
<ODX xmlns="${this.ODX_NAMESPACE}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" MODEL-VERSION="${this.ODX_VERSION}">
  <DIAG-LAYER-CONTAINER ID="${id}">
    <SHORT-NAME>${shortName}</SHORT-NAME>
    <LONG-NAME>${ecu.name} Diagnostic Layer</LONG-NAME>
    <BASE-VARIANTS>
      <BASE-VARIANT ID="${id}_BV">
        <SHORT-NAME>${shortName}_BV</SHORT-NAME>
        <LONG-NAME>${ecu.name} Base Variant</LONG-NAME>
        <DIAG-DATA-DICTIONARY-SPEC>
          ${dtcDops}
          ${dataObjectProps}
        </DIAG-DATA-DICTIONARY-SPEC>
        <DIAG-COMMS>
          ${diagServices}
        </DIAG-COMMS>
        <FUNCTIONAL-CLASS-REFS>
          <FUNCTIONAL-CLASS-REF ID-REF="${id}_FC"/>
        </FUNCTIONAL-CLASS-REFS>
        <DIAG-DATA-DICTIONARY-SPEC>
          <DATA-OBJECT-PROPS>
            <DATA-OBJECT-PROP ID="${id}_ECU_ADDRESS">
              <SHORT-NAME>ECU_ADDRESS</SHORT-NAME>
              <LONG-NAME>ECU Address</LONG-NAME>
              <COMPU-METHOD>
                <CATEGORY>IDENTICAL</CATEGORY>
              </COMPU-METHOD>
              <DIAG-CODED-TYPE BASE-DATA-TYPE="A_UINT32" xsi:type="STANDARD-LENGTH-TYPE">
                <BIT-LENGTH>16</BIT-LENGTH>
              </DIAG-CODED-TYPE>
              <PHYSICAL-TYPE>
                <BASE-DATA-TYPE>A_UINT32</BASE-DATA-TYPE>
              </PHYSICAL-TYPE>
            </DATA-OBJECT-PROP>
          </DATA-OBJECT-PROPS>
        </DIAG-DATA-DICTIONARY-SPEC>
      </BASE-VARIANT>
    </BASE-VARIANTS>
    <FUNCTIONAL-CLASSES>
      <FUNCTIONAL-CLASS ID="${id}_FC">
        <SHORT-NAME>${shortName}_FC</SHORT-NAME>
        <LONG-NAME>${ecu.name} Functional Class</LONG-NAME>
      </FUNCTIONAL-CLASS>
    </FUNCTIONAL-CLASSES>
    <ECU-ADDRESS>${ecu.address}</ECU-ADDRESS>
    <PROTOCOL>${ecu.protocol}</PROTOCOL>
  </DIAG-LAYER-CONTAINER>
</ODX>`

    return {
      docType: 'DIAG-LAYER',
      shortName,
      longName: `${ecu.name} Diagnostic Layer`,
      id,
      content
    }
  }

  /**
   * Generate data object properties for DIDs
   */
  private generateDataObjectProps(dids: Map<string, DIDInfo>): string {
    if (dids.size === 0) return ''

    let props = '<DATA-OBJECT-PROPS>\n'

    for (const [did, info] of dids) {
      const propId = `DOP_${did}`
      const dataType = this.mapDataType(info.dataType || 'binary')
      const bitLength = (info.dataLength || 1) * 8

      props += `  <DATA-OBJECT-PROP ID="${propId}">
    <SHORT-NAME>DID_${did}</SHORT-NAME>
    <LONG-NAME>${info.name || `Data Identifier ${did}`}</LONG-NAME>
    <COMPU-METHOD>
      <CATEGORY>${dataType === 'ascii' ? 'TEXTTABLE' : 'IDENTICAL'}</CATEGORY>
    </COMPU-METHOD>
    <DIAG-CODED-TYPE BASE-DATA-TYPE="${dataType === 'ascii' ? 'A_ASCIISTRING' : 'A_BYTEFIELD'}" xsi:type="STANDARD-LENGTH-TYPE">
      <BIT-LENGTH>${bitLength}</BIT-LENGTH>
    </DIAG-CODED-TYPE>
    <PHYSICAL-TYPE>
      <BASE-DATA-TYPE>${dataType === 'ascii' ? 'A_UNICODE2STRING' : 'A_BYTEFIELD'}</BASE-DATA-TYPE>
    </PHYSICAL-TYPE>
  </DATA-OBJECT-PROP>\n`
    }

    props += '</DATA-OBJECT-PROPS>\n'
    return props
  }

  /**
   * Generate DTC data object properties
   */
  private generateDTCDops(dtcs: Map<string, DTCInfo>): string {
    if (dtcs.size === 0) return ''

    let dtcDops = '<DTCDOPS>\n'

    for (const [code, info] of dtcs) {
      const dtcId = `DTC_${code.replace(/[^A-Z0-9]/g, '_')}`

      dtcDops += `  <DTCDOP ID="${dtcId}">
    <SHORT-NAME>${code}</SHORT-NAME>
    <LONG-NAME>Diagnostic Trouble Code ${code}</LONG-NAME>
    <DIAG-CODED-TYPE BASE-DATA-TYPE="A_BYTEFIELD" xsi:type="STANDARD-LENGTH-TYPE">
      <BIT-LENGTH>24</BIT-LENGTH>
    </DIAG-CODED-TYPE>
    <PHYSICAL-TYPE>
      <BASE-DATA-TYPE>A_BYTEFIELD</BASE-DATA-TYPE>
    </PHYSICAL-TYPE>
    <COMPU-METHOD>
      <CATEGORY>IDENTICAL</CATEGORY>
    </COMPU-METHOD>
  </DTCDOP>\n`
    }

    dtcDops += '</DTCDOPS>\n'
    return dtcDops
  }

  /**
   * Generate diagnostic services
   */
  private generateDiagnosticServices(ecu: DiscoveredECU): string {
    let services = '<DIAG-SERVICES>\n'

    // Generate Read Data By Identifier services for discovered DIDs
    if (ecu.discoveredDIDs.size > 0) {
      services += this.generateReadDataServices(ecu.discoveredDIDs)
    }

    // Generate Routine Control services for discovered routines
    if (ecu.discoveredRoutines.size > 0) {
      services += this.generateRoutineServices(ecu.discoveredRoutines)
    }

    // Generate standard services based on discovered service IDs
    for (const serviceId of ecu.discoveredServices) {
      services += this.generateStandardService(serviceId, ecu)
    }

    services += '</DIAG-SERVICES>\n'
    return services
  }

  /**
   * Generate Read Data By Identifier services
   */
  private generateReadDataServices(dids: Map<string, DIDInfo>): string {
    let services = ''

    for (const [did, info] of dids) {
      const serviceId = `SERVICE_READ_${did}`

      services += `  <DIAG-SERVICE ID="${serviceId}">
    <SHORT-NAME>READ_${did}</SHORT-NAME>
    <LONG-NAME>Read ${info.name || `DID ${did}`}</LONG-NAME>
    <REQUEST>
      <REQUEST-REF ID-REF="REQ_READ_${did}"/>
    </REQUEST>
    <POS-RESPONSE>
      <POS-RESPONSE-REF ID-REF="RESP_READ_${did}"/>
    </POS-RESPONSE>
    <NEG-RESPONSE>
      <NEG-RESPONSE-REF ID-REF="RESP_NEG_GENERAL"/>
    </NEG-RESPONSE>
  </DIAG-SERVICE>\n`
    }

    return services
  }

  /**
   * Generate Routine Control services
   */
  private generateRoutineServices(routines: Map<string, RoutineInfo>): string {
    let services = ''

    for (const [routineId, info] of routines) {
      const serviceId = `SERVICE_ROUTINE_${routineId}`

      services += `  <DIAG-SERVICE ID="${serviceId}">
    <SHORT-NAME>ROUTINE_${routineId}</SHORT-NAME>
    <LONG-NAME>${info.name || `Routine ${routineId}`}</LONG-NAME>
    <REQUEST>
      <REQUEST-REF ID-REF="REQ_ROUTINE_${routineId}"/>
    </REQUEST>
    <POS-RESPONSE>
      <POS-RESPONSE-REF ID-REF="RESP_ROUTINE_${routineId}"/>
    </POS-RESPONSE>
    <NEG-RESPONSE>
      <NEG-RESPONSE-REF ID-REF="RESP_NEG_GENERAL"/>
    </NEG-RESPONSE>
  </DIAG-SERVICE>\n`
    }

    return services
  }

  /**
   * Generate standard UDS service
   */
  private generateStandardService(serviceId: string, ecu: DiscoveredECU): string {
    const serviceName = this.getServiceName(serviceId)
    if (!serviceName) return ''

    return `  <DIAG-SERVICE ID="SERVICE_${serviceId}">
    <SHORT-NAME>${serviceName.replace(/\s+/g, '_').toUpperCase()}</SHORT-NAME>
    <LONG-NAME>${serviceName}</LONG-NAME>
    <REQUEST>
      <REQUEST-REF ID-REF="REQ_${serviceId}"/>
    </REQUEST>
    <POS-RESPONSE>
      <POS-RESPONSE-REF ID-REF="RESP_${serviceId}"/>
    </POS-RESPONSE>
    <NEG-RESPONSE>
      <NEG-RESPONSE-REF ID-REF="RESP_NEG_GENERAL"/>
    </NEG-RESPONSE>
  </DIAG-SERVICE>\n`
  }

  /**
   * Generate protocol layer
   */
  private generateProtocolLayer(ecus: Map<string, DiscoveredECU>, vehicleShortName: string): ODXDocument {
    const id = `ID_${uuidv4()}`
    const shortName = `${vehicleShortName}_PROTOCOL`

    // Determine primary protocol
    const protocols = new Set(Array.from(ecus.values()).map(e => e.protocol))
    const primaryProtocol = protocols.size === 1 ? Array.from(protocols)[0] : 'UDS_ON_CAN'

    const content = `<?xml version="1.0" encoding="UTF-8"?>
<ODX xmlns="${this.ODX_NAMESPACE}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" MODEL-VERSION="${this.ODX_VERSION}">
  <PROTOCOL ID="${id}">
    <SHORT-NAME>${shortName}</SHORT-NAME>
    <LONG-NAME>${vehicleShortName} Protocol Definition</LONG-NAME>
    <PROTOCOL-TYPE>${primaryProtocol}</PROTOCOL-TYPE>
    <PHYSICAL-LAYER>
      <PHYSICAL-LAYER-TYPE>ISO-11898-2</PHYSICAL-LAYER-TYPE>
      <SPEED>500000</SPEED>
    </PHYSICAL-LAYER>
    <DATA-LINK-LAYER>
      <DATA-LINK-LAYER-TYPE>ISO-15765-2</DATA-LINK-LAYER-TYPE>
      <MAX-BUFFER-SIZE>4095</MAX-BUFFER-SIZE>
    </DATA-LINK-LAYER>
  </PROTOCOL>
</ODX>`

    return {
      docType: 'PROTOCOL',
      shortName,
      longName: `${vehicleShortName} Protocol Definition`,
      id,
      content
    }
  }

  /**
   * Generate communication parameters
   */
  private generateCommunicationParams(ecus: Map<string, DiscoveredECU>, vehicleShortName: string): ODXDocument {
    const id = `ID_${uuidv4()}`
    const shortName = `${vehicleShortName}_COMPARAM`

    const content = `<?xml version="1.0" encoding="UTF-8"?>
<ODX xmlns="${this.ODX_NAMESPACE}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" MODEL-VERSION="${this.ODX_VERSION}">
  <COMPARAM-SPEC ID="${id}">
    <SHORT-NAME>${shortName}</SHORT-NAME>
    <LONG-NAME>${vehicleShortName} Communication Parameters</LONG-NAME>
    <PROTOCOLS>
      <PROTOCOL-REF ID-REF="${vehicleShortName}_PROTOCOL"/>
    </PROTOCOLS>
    <DATA-RATE>500000</DATA-RATE>
    <CAN-BAUDRATE>CAN_500KBPS</CAN-BAUDRATE>
    <ADDRESSING-MODE>NORMAL_FIXED</ADDRESSING-MODE>
    <P2-TIMING>
      <P2-MAX>50</P2-MAX>
      <P2-STAR-MAX>5000</P2-STAR-MAX>
    </P2-TIMING>
    <SESSION-TIMINGS>
      <DEFAULT-SESSION-TIMEOUT>5000</DEFAULT-SESSION-TIMEOUT>
      <PROGRAMMING-SESSION-TIMEOUT>25000</PROGRAMMING-SESSION-TIMEOUT>
      <EXTENDED-SESSION-TIMEOUT>25000</EXTENDED-SESSION-TIMEOUT>
    </SESSION-TIMINGS>
  </COMPARAM-SPEC>
</ODX>`

    return {
      docType: 'ECU-MEM',
      shortName,
      longName: `${vehicleShortName} Communication Parameters`,
      id,
      content
    }
  }

  /**
   * Save ODX files to disk
   */
  saveODXFiles(odx: ReverseEngineeredODX, outputDir: string): void {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // Save vehicle info
    const vehicleFile = path.join(outputDir, `${odx.vehicleInfo.shortName}.odx-v`)
    fs.writeFileSync(vehicleFile, odx.vehicleInfo.content, 'utf-8')

    // Save ECU layers
    for (const ecuLayer of odx.ecuLayers) {
      const ecuFile = path.join(outputDir, `${ecuLayer.shortName}.odx-d`)
      fs.writeFileSync(ecuFile, ecuLayer.content, 'utf-8')
    }

    // Save protocol layer
    const protocolFile = path.join(outputDir, `${odx.protocolLayer.shortName}.odx-p`)
    fs.writeFileSync(protocolFile, odx.protocolLayer.content, 'utf-8')

    // Save communication parameters
    const comparamFile = path.join(outputDir, `${odx.comparam.shortName}.odx-c`)
    fs.writeFileSync(comparamFile, odx.comparam.content, 'utf-8')

    // Save metadata summary
    const summaryFile = path.join(outputDir, 'discovery_summary.json')
    fs.writeFileSync(summaryFile, JSON.stringify({
      timestamp: odx.timestamp,
      metadata: odx.metadata,
      files: {
        vehicle: `${odx.vehicleInfo.shortName}.odx-v`,
        ecus: odx.ecuLayers.map(e => `${e.shortName}.odx-d`),
        protocol: `${odx.protocolLayer.shortName}.odx-p`,
        comparam: `${odx.comparam.shortName}.odx-c`
      }
    }, null, 2), 'utf-8')
  }

  /**
   * Map discovered data type to ODX data type
   */
  private mapDataType(dataType: string): string {
    switch (dataType) {
      case 'ascii':
        return 'A_ASCIISTRING'
      case 'numeric':
        return 'A_UINT32'
      case 'date':
        return 'A_BYTEFIELD'
      case 'binary':
      default:
        return 'A_BYTEFIELD'
    }
  }

  /**
   * Get service name from service ID
   */
  private getServiceName(serviceId: string): string | null {
    const serviceMap: Record<string, string> = {
      '10': 'Diagnostic Session Control',
      '11': 'ECU Reset',
      '14': 'Clear Diagnostic Information',
      '19': 'Read DTC Information',
      '22': 'Read Data By Identifier',
      '27': 'Security Access',
      '28': 'Communication Control',
      '2E': 'Write Data By Identifier',
      '2F': 'Input Output Control',
      '31': 'Routine Control',
      '34': 'Request Download',
      '35': 'Request Upload',
      '36': 'Transfer Data',
      '37': 'Request Transfer Exit',
      '3D': 'Write Memory By Address',
      '3E': 'Tester Present',
      '85': 'Control DTC Setting',
      '86': 'Response On Event',
      '87': 'Link Control'
    }

    return serviceMap[serviceId.toUpperCase()] || null
  }
}