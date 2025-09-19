/**
 * ODX Parser - Implements ISO 22901 (ODX) standard parsing
 * Handles diagnostic data exchange format for automotive diagnostics
 */

import { parseStringPromise } from 'xml2js'
import { readFileSync } from 'fs'
import type { PrismaClient } from '@prisma/client'

// ODX file type definitions based on ISO 22901-1
export enum ODXFileType {
  ODX_C = 'ODX-C',   // Communication Parameters (Company Specific Data)
  ODX_D = 'ODX-D',   // Diagnostic Layer (ECU Diagnostic Data)
  ODX_V = 'ODX-V',   // Vehicle Information (Vehicle Topology)
  ODX_F = 'ODX-F',   // Function Dictionary
  ODX_M = 'ODX-M',   // Multiple ECU Jobs
  ODX_FD = 'ODX-FD', // Flash Data
  PDX = 'PDX'        // Package Description
}

// ODX addressing types
export enum AddressingType {
  PHYSICAL = 'PHYSICAL',
  FUNCTIONAL = 'FUNCTIONAL',
  FUNCTIONAL_OR_PHYSICAL = 'FUNCTIONAL-OR-PHYSICAL'
}

// Interfaces matching ODX XSD structure
export interface ODXShortLongName {
  'SHORT-NAME': string[]
  'LONG-NAME'?: string[]
}

export interface ODXDiagService extends ODXShortLongName {
  $: {
    ID: string
    OID?: string
    SEMANTIC?: string
    'IS-CYCLIC'?: boolean
    'IS-MULTIPLE'?: boolean
    ADDRESSING?: AddressingType
  }
  'REQUEST-REF'?: Array<{ $: { 'ID-REF': string } }>
  'POS-RESPONSE-REFS'?: Array<{
    'POS-RESPONSE-REF': Array<{ $: { 'ID-REF': string } }>
  }>
  'NEG-RESPONSE-REFS'?: Array<{
    'NEG-RESPONSE-REF': Array<{ $: { 'ID-REF': string } }>
  }>
}

export interface ODXDTC {
  $: {
    ID: string
    OID?: string
  }
  'SHORT-NAME': string[]
  'LONG-NAME'?: string[]
  'TROUBLE-CODE': string[]
  'DISPLAY-TROUBLE-CODE'?: string[]
  'TEXT'?: string[]
  'LEVEL'?: string[]
  'IS-VISIBLE'?: boolean[]
  'SDGS'?: Array<any>
}

export interface ODXDTCDOP extends ODXShortLongName {
  $: {
    ID: string
    OID?: string
    'IS-VISIBLE'?: boolean
  }
  'DIAG-CODED-TYPE': Array<any>
  'PHYSICAL-TYPE': Array<any>
  'COMPU-METHOD': Array<any>
  'DTCS': Array<{
    DTC?: ODXDTC[]
    'DTC-REF'?: Array<{ $: { 'ID-REF': string } }>
  }>
}

export interface ODXRequest extends ODXShortLongName {
  $: {
    ID: string
    OID?: string
  }
  'PARAMS'?: Array<{
    PARAM?: ODXParam[]
  }>
}

export interface ODXParam extends ODXShortLongName {
  $: {
    ID?: string
    OID?: string
    SEMANTIC?: string
  }
  'BYTE-POSITION'?: string[]
  'BIT-POSITION'?: string[]
  'BIT-LENGTH'?: string[]
  'DOP-REF'?: Array<{ $: { 'ID-REF': string } }>
  'CODED-VALUE'?: string[]
}

export interface ODXBaseVariant extends ODXShortLongName {
  $: {
    ID: string
    OID?: string
  }
  'DIAG-DATA-DICTIONARY-SPEC'?: Array<any>
  'DIAG-COMMS'?: Array<{
    'DIAG-SERVICE'?: ODXDiagService[]
  }>
  'REQUESTS'?: Array<{
    REQUEST?: ODXRequest[]
  }>
  'POS-RESPONSES'?: Array<{
    'POS-RESPONSE'?: Array<any>
  }>
  'NEG-RESPONSES'?: Array<{
    'NEG-RESPONSE'?: Array<any>
  }>
  'PARENT-REFS'?: Array<any>
  'COMPARAM-REFS'?: Array<any>
  'PROT-STACK-SNREF'?: Array<any>
}

export interface ODXECUVariant extends ODXShortLongName {
  $: {
    ID: string
    OID?: string
  }
  'BASE-VARIANT-REF'?: Array<{ $: { 'ID-REF': string } }>
  'DIAG-DATA-DICTIONARY-SPEC'?: Array<any>
  'DIAG-COMMS'?: Array<{
    'DIAG-SERVICE'?: ODXDiagService[]
  }>
}

export interface ODXDiagLayer {
  $: {
    ID: string
    OID?: string
  }
  'VARIANT-TYPE': string[]
  'SHORT-NAME': string[]
  'LONG-NAME'?: string[]
  'BASE-VARIANTS'?: Array<{
    'BASE-VARIANT'?: ODXBaseVariant[]
  }>
  'ECU-VARIANTS'?: Array<{
    'ECU-VARIANT'?: ODXECUVariant[]
  }>
  'DIAG-DATA-DICTIONARY-SPEC'?: Array<{
    'DTC-DOPS'?: Array<{
      'DTC-DOP'?: ODXDTCDOP[]
    }>
    'DATA-OBJECT-PROPS'?: Array<any>
    'STRUCTURES'?: Array<any>
    'UNIT-SPEC'?: Array<any>
    'TABLES'?: Array<any>
  }>
}

export interface ODXCatalog {
  ODX?: {
    'MODEL-VERSION': string[]
    'CATALOG-VERSION'?: string[]
    'DIAG-LAYER-CONTAINER'?: Array<{
      'DIAG-LAYER'?: ODXDiagLayer[]
      'BASE-VARIANTS'?: Array<{
        'BASE-VARIANT'?: ODXBaseVariant[]
      }>
      'ECU-VARIANTS'?: Array<{
        'ECU-VARIANT'?: ODXECUVariant[]
      }>
    }>
    'VEHICLE-INFO-CONTAINER'?: Array<any>
    'COMPARAM-SPEC-CONTAINER'?: Array<any>
    'COMPANY-DATAS'?: Array<any>
  }
}

export class ODXParser {
  private prisma: PrismaClient | null = null
  private catalog: ODXCatalog | null = null

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || null
  }

  /**
   * Parse ODX XML file
   */
  async parseODXFile(filePath: string): Promise<ODXCatalog> {
    const xmlContent = readFileSync(filePath, 'utf8')

    // Remove BOM if present
    const cleanedContent = xmlContent.replace(/^\uFEFF/, '')

    // Parse XML to JavaScript object
    const parsed = await parseStringPromise(cleanedContent, {
      explicitArray: true,
      preserveChildrenOrder: true,
      xmlns: true,
      explicitCharkey: true,
      trim: true,
      normalize: true,
      normalizeTags: false,
      attrkey: '$',
      charkey: '_'
    })

    this.catalog = parsed
    return parsed
  }

  /**
   * Extract diagnostic services from ODX
   */
  extractDiagServices(layer: ODXDiagLayer): ODXDiagService[] {
    const services: ODXDiagService[] = []

    // Extract from base variants
    if (layer['BASE-VARIANTS']) {
      layer['BASE-VARIANTS'].forEach(bvContainer => {
        if (bvContainer['BASE-VARIANT']) {
          bvContainer['BASE-VARIANT'].forEach(baseVariant => {
            if (baseVariant['DIAG-COMMS']) {
              baseVariant['DIAG-COMMS'].forEach(diagComms => {
                if (diagComms['DIAG-SERVICE']) {
                  services.push(...diagComms['DIAG-SERVICE'])
                }
              })
            }
          })
        }
      })
    }

    // Extract from ECU variants
    if (layer['ECU-VARIANTS']) {
      layer['ECU-VARIANTS'].forEach(evContainer => {
        if (evContainer['ECU-VARIANT']) {
          evContainer['ECU-VARIANT'].forEach(ecuVariant => {
            if (ecuVariant['DIAG-COMMS']) {
              ecuVariant['DIAG-COMMS'].forEach(diagComms => {
                if (diagComms['DIAG-SERVICE']) {
                  services.push(...diagComms['DIAG-SERVICE'])
                }
              })
            }
          })
        }
      })
    }

    return services
  }

  /**
   * Extract DTC definitions from ODX
   */
  extractDTCs(layer: ODXDiagLayer): ODXDTCDOP[] {
    const dtcDOPs: ODXDTCDOP[] = []

    if (layer['DIAG-DATA-DICTIONARY-SPEC']) {
      layer['DIAG-DATA-DICTIONARY-SPEC'].forEach(spec => {
        if (spec['DTC-DOPS']) {
          spec['DTC-DOPS'].forEach(dtcDopsContainer => {
            if (dtcDopsContainer['DTC-DOP']) {
              dtcDOPs.push(...dtcDopsContainer['DTC-DOP'])
            }
          })
        }
      })
    }

    return dtcDOPs
  }

  /**
   * Convert ODX diagnostic service to database format
   */
  convertServiceToDb(service: ODXDiagService): any {
    return {
      shortName: service['SHORT-NAME']?.[0] || '',
      longName: service['LONG-NAME']?.[0],
      semantic: service.$?.SEMANTIC,
      addressing: service.$?.ADDRESSING || 'PHYSICAL',
      requestSID: service.$?.SEMANTIC?.split('.')?.pop() || '', // Extract SID from semantic
      isCyclic: service.$?.['IS-CYCLIC'] || false,
      isMultiple: service.$?.['IS-MULTIPLE'] || false
    }
  }

  /**
   * Convert ODX DTC to database format
   */
  convertDTCToDb(dtcDOP: ODXDTCDOP): any {
    const dtcs: any[] = []

    if (dtcDOP.DTCS) {
      dtcDOP.DTCS.forEach(dtcsContainer => {
        if (dtcsContainer.DTC) {
          dtcsContainer.DTC.forEach(dtc => {
            dtcs.push({
              shortName: dtc['SHORT-NAME']?.[0] || '',
              longName: dtc['LONG-NAME']?.[0],
              troubleCode: dtc['TROUBLE-CODE']?.[0] || '',
              displayCode: dtc['DISPLAY-TROUBLE-CODE']?.[0],
              description: dtc['TEXT']?.[0],
              level: parseInt(dtc['LEVEL']?.[0] || '0'),
              isVisible: dtc['IS-VISIBLE']?.[0] === 'true'
            })
          })
        }
      })
    }

    return {
      shortName: dtcDOP['SHORT-NAME']?.[0] || '',
      longName: dtcDOP['LONG-NAME']?.[0],
      isVisible: dtcDOP.$?.['IS-VISIBLE'] || false,
      dtcs
    }
  }

  /**
   * Import ODX file to database
   */
  async importToDatabase(
    filePath: string,
    companyId: string,
    userId: string
  ): Promise<{ success: boolean; message: string; data?: any }> {
    if (!this.prisma) {
      return { success: false, message: 'Database connection not available' }
    }

    try {
      const catalog = await this.parseODXFile(filePath)

      if (!catalog.ODX) {
        return { success: false, message: 'Invalid ODX file format' }
      }

      const odx = catalog.ODX

      // Store the ODX file reference
      const odxFile = await this.prisma.oDXFile.create({
        data: {
          companyId,
          uploadedBy: userId,
          fileName: filePath.split('/').pop() || 'unknown.odx',
          fileType: this.determineFileType(odx),
          fileSize: 0, // Would need actual file size
          filePath,
          version: odx['MODEL-VERSION']?.[0],
          catalogName: odx['CATALOG-VERSION']?.[0],
          parsedContent: catalog as any
        }
      })

      // Process diagnostic layers
      if (odx['DIAG-LAYER-CONTAINER']) {
        for (const container of odx['DIAG-LAYER-CONTAINER']) {
          if (container['DIAG-LAYER']) {
            for (const layer of container['DIAG-LAYER']) {
              await this.processDiagLayer(layer, companyId, odxFile.id)
            }
          }
        }
      }

      return {
        success: true,
        message: 'ODX file imported successfully',
        data: { fileId: odxFile.id }
      }
    } catch (error) {
      console.error('ODX import error:', error)
      return {
        success: false,
        message: `Failed to import ODX: ${error.message}`
      }
    }
  }

  /**
   * Process diagnostic layer
   */
  private async processDiagLayer(
    layer: ODXDiagLayer,
    companyId: string,
    odxFileId: string
  ): Promise<void> {
    if (!this.prisma) return

    // Create diagnostic layer
    const diagLayer = await this.prisma.diagnosticLayer.create({
      data: {
        companyId,
        shortName: layer['SHORT-NAME']?.[0] || '',
        longName: layer['LONG-NAME']?.[0],
        layerType: this.determineLayerType(layer),
        protocolName: 'UDS' // Default, could be extracted from protocol stack
      }
    })

    // Extract and store diagnostic services
    const services = this.extractDiagServices(layer)
    for (const service of services) {
      const dbService = this.convertServiceToDb(service)
      await this.prisma.diagService.create({
        data: {
          ...dbService,
          layerId: diagLayer.id
        }
      })
    }

    // Extract and store DTCs
    const dtcDOPs = this.extractDTCs(layer)
    for (const dtcDOP of dtcDOPs) {
      const dbDTCDOP = this.convertDTCToDb(dtcDOP)

      for (const dtc of dbDTCDOP.dtcs) {
        await this.prisma.dTCDOP.create({
          data: {
            layerId: diagLayer.id,
            dtcNumber: dtc.troubleCode,
            shortName: dtc.shortName,
            longName: dtc.longName,
            description: dtc.description,
            troubleCode: dtc.troubleCode,
            displayCode: dtc.displayCode,
            level: dtc.level
          }
        })
      }
    }
  }

  /**
   * Determine ODX file type from content
   */
  private determineFileType(odx: any): string {
    if (odx['DIAG-LAYER-CONTAINER']) return 'ODX_D'
    if (odx['VEHICLE-INFO-CONTAINER']) return 'ODX_V'
    if (odx['COMPARAM-SPEC-CONTAINER']) return 'ODX_C'
    if (odx['FUNCTION-DICTIONARY']) return 'ODX_F'
    return 'ODX_D' // Default
  }

  /**
   * Determine diagnostic layer type
   */
  private determineLayerType(layer: ODXDiagLayer): string {
    const variantType = layer['VARIANT-TYPE']?.[0]

    switch (variantType) {
      case 'BASE-VARIANT':
        return 'BASE_VARIANT'
      case 'ECU-VARIANT':
        return 'ECU_VARIANT'
      case 'PROTOCOL':
        return 'PROTOCOL'
      case 'FUNCTIONAL-GROUP':
        return 'FUNCTIONAL'
      default:
        return 'ECU_VARIANT'
    }
  }

  /**
   * Generate parsing rules from ODX
   */
  generateParsingRules(layer: ODXDiagLayer): any[] {
    const rules: any[] = []

    // Generate DTC parsing rules
    const dtcDOPs = this.extractDTCs(layer)
    if (dtcDOPs.length > 0) {
      rules.push({
        name: `ODX DTC Parsing - ${layer['SHORT-NAME']?.[0]}`,
        description: 'Auto-generated from ODX import',
        ruleType: 'DTC_PARSING',
        priority: 50,
        configuration: {
          source: 'ODX',
          dtcFormat: 'ODX_STANDARD',
          dtcs: dtcDOPs.map(dop => this.convertDTCToDb(dop))
        }
      })
    }

    // Generate service mapping rules
    const services = this.extractDiagServices(layer)
    if (services.length > 0) {
      const serviceMap: any = {}

      services.forEach(service => {
        const sid = service.$?.SEMANTIC?.split('.')?.pop() || ''
        if (sid) {
          serviceMap[sid] = {
            name: service['SHORT-NAME']?.[0] || '',
            longName: service['LONG-NAME']?.[0],
            semantic: service.$?.SEMANTIC,
            addressing: service.$?.ADDRESSING || 'PHYSICAL'
          }
        }
      })

      rules.push({
        name: `ODX Service Mapping - ${layer['SHORT-NAME']?.[0]}`,
        description: 'Auto-generated from ODX import',
        ruleType: 'SERVICE_MAPPING',
        priority: 50,
        configuration: {
          source: 'ODX',
          services: serviceMap
        }
      })
    }

    return rules
  }
}

// Export helper function to create parser instance
export function createODXParser(prisma?: PrismaClient): ODXParser {
  return new ODXParser(prisma)
}