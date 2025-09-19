import { PrismaClient } from '@prisma/client'
import type {
  ParsingRule,
  OEM,
  Model,
  ModelYear,
  ECUMapping,
  DTCFormat
} from '@prisma/client'

const prisma = new PrismaClient()

// Types for parsing configuration
interface DTCParsingConfig {
  subfunctions: string[]
  dtcFormat: string
  dtcLength?: number
  statusMaskPosition?: number
  statusMaskLength?: number
  statusInDTC?: boolean
  additionalStatusByte?: boolean
  parser: {
    skipBytes?: number
    extractDTC: string
    extractStatus: string
  }
}

interface ServiceMappingConfig {
  services: {
    [key: string]: {
      name: string
      subfunctions?: { [key: string]: string }
      routines?: { [key: string]: string }
      identifiers?: { [key: string]: string }
    }
  }
}

interface ParsedDTC {
  code: string
  status: string
  statusByte: string
  ecuAddress: string
  raw: string
}

// Main parsing engine class
export class DiagnosticParsingEngine {
  private rules: ParsingRule[] = []
  private ecuMappings: Map<string, ECUMapping> = new Map()
  private vehicleContext?: {
    oem: OEM
    model: Model
    modelYear: ModelYear
  }

  // Initialize the engine with vehicle context
  async initialize(vehicleId: string) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        modelYear: {
          include: {
            model: {
              include: {
                oem: true
              }
            },
            ecuMappings: true,
            parsingRules: true
          }
        }
      }
    })

    if (!vehicle) {
      throw new Error('Vehicle not found')
    }

    this.vehicleContext = {
      oem: vehicle.modelYear.model.oem,
      model: vehicle.modelYear.model,
      modelYear: vehicle.modelYear
    }

    // Load ECU mappings
    for (const mapping of vehicle.modelYear.ecuMappings) {
      this.ecuMappings.set(mapping.ecuAddress, mapping)
    }

    // Load parsing rules in priority order
    await this.loadParsingRules()
  }

  // Load applicable parsing rules
  private async loadParsingRules() {
    if (!this.vehicleContext) return

    // Get rules at all levels (OEM, Model, ModelYear)
    const rules = await prisma.parsingRule.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { oemId: this.vehicleContext.oem.id },
          { modelId: this.vehicleContext.model.id },
          { modelYearId: this.vehicleContext.modelYear.id },
          { oemId: null, modelId: null, modelYearId: null } // Global rules
        ]
      },
      orderBy: [
        { priority: 'desc' }, // Higher priority first
        { modelYearId: 'desc' }, // Most specific first
        { modelId: 'desc' },
        { oemId: 'desc' }
      ]
    })

    this.rules = rules
  }

  // Get ECU name from address
  getECUName(address: string): string {
    const mapping = this.ecuMappings.get(address.toUpperCase())
    return mapping?.ecuName || `ECU ${address}`
  }

  // Get ECU type from address
  getECUType(address: string): string | undefined {
    const mapping = this.ecuMappings.get(address.toUpperCase())
    return mapping?.ecuType
  }

  // Parse DTCs based on configured rules
  parseDTCs(serviceData: string, subfunction: string, ecuAddress: string): ParsedDTC[] {
    const dtcRules = this.rules.filter(r => r.ruleType === 'DTC_PARSING')

    for (const rule of dtcRules) {
      const config = rule.configuration as DTCParsingConfig

      // Check if this rule applies to the subfunction
      if (!config.subfunctions.includes(subfunction)) continue

      // Apply the parsing rule
      try {
        return this.applyDTCParsingRule(serviceData, config, ecuAddress)
      } catch (error) {
        console.warn(`Failed to apply parsing rule ${rule.name}:`, error)
        continue // Try next rule
      }
    }

    // Fallback to default parsing if no rules match
    return this.defaultDTCParsing(serviceData, subfunction, ecuAddress)
  }

  // Apply a specific DTC parsing rule
  private applyDTCParsingRule(
    data: string,
    config: DTCParsingConfig,
    ecuAddress: string
  ): ParsedDTC[] {
    const dtcs: ParsedDTC[] = []
    let offset = 0

    // Skip bytes if configured (e.g., status mask)
    if (config.parser.skipBytes) {
      offset = config.parser.skipBytes * 2 // Convert to hex chars
    }

    // Extract DTCs based on configuration
    const dtcLength = (config.dtcLength || 3) * 2 // Convert to hex chars
    const recordLength = dtcLength + (config.additionalStatusByte ? 2 : 0)

    while (offset + recordLength <= data.length) {
      const record = data.substring(offset, offset + recordLength)

      // Extract DTC code
      let dtcCode = ''
      if (config.parser.extractDTC === 'first_3_bytes') {
        dtcCode = record.substring(0, 6)
      } else if (config.parser.extractDTC === 'next_3_bytes') {
        dtcCode = data.substring(offset, offset + 6)
      }

      // Extract status
      let statusByte = ''
      if (config.parser.extractStatus === 'byte_4') {
        statusByte = record.substring(6, 8)
      } else if (config.parser.extractStatus === 'byte_4_after_dtc') {
        statusByte = data.substring(offset + 6, offset + 8)
      }

      if (dtcCode && this.isValidDTC(dtcCode)) {
        dtcs.push({
          code: dtcCode.toUpperCase(),
          statusByte,
          status: this.decodeDTCStatus(statusByte),
          ecuAddress,
          raw: record
        })
      }

      offset += recordLength
    }

    return dtcs
  }

  // Default DTC parsing fallback
  private defaultDTCParsing(
    data: string,
    subfunction: string,
    ecuAddress: string
  ): ParsedDTC[] {
    const dtcs: ParsedDTC[] = []

    // Handle subfunction-specific formats
    if (subfunction === '02' || subfunction === '0A' || subfunction === '0F') {
      // Skip status mask (first byte)
      const dtcData = data.substring(2)

      // Parse 4-byte records (3-byte DTC + 1-byte status)
      for (let i = 0; i <= dtcData.length - 8; i += 8) {
        const dtcCode = dtcData.substring(i, i + 6)
        const statusByte = dtcData.substring(i + 6, i + 8)

        if (this.isValidDTC(dtcCode)) {
          dtcs.push({
            code: dtcCode.toUpperCase(),
            statusByte,
            status: this.decodeDTCStatus(statusByte),
            ecuAddress,
            raw: dtcData.substring(i, i + 8)
          })
        }
      }
    } else if (subfunction === '03') {
      // Parse 4-byte records directly
      for (let i = 0; i <= data.length - 8; i += 8) {
        const dtcCode = data.substring(i, i + 6)
        const statusByte = data.substring(i + 6, i + 8)

        if (this.isValidDTC(dtcCode)) {
          dtcs.push({
            code: dtcCode.toUpperCase(),
            statusByte,
            status: this.decodeDTCStatus(statusByte),
            ecuAddress,
            raw: data.substring(i, i + 8)
          })
        }
      }
    }

    return dtcs
  }

  // Check if a DTC code is valid
  private isValidDTC(dtcCode: string): boolean {
    if (dtcCode.length !== 6) return false

    const bytes = [
      parseInt(dtcCode.substring(0, 2), 16),
      parseInt(dtcCode.substring(2, 4), 16),
      parseInt(dtcCode.substring(4, 6), 16)
    ]

    // Skip if all bytes are 0x00 or 0xFF (no DTC)
    if (bytes.every(b => b === 0x00) || bytes.every(b => b === 0xFF)) {
      return false
    }

    return true
  }

  // Decode DTC status byte
  private decodeDTCStatus(statusByte: string): string {
    const status = parseInt(statusByte, 16)
    const statusBits: string[] = []

    if (status & 0x01) statusBits.push('Test Failed')
    if (status & 0x02) statusBits.push('Test Failed This Operation Cycle')
    if (status & 0x04) statusBits.push('Pending DTC')
    if (status & 0x08) statusBits.push('Confirmed DTC')
    if (status & 0x10) statusBits.push('Test Not Completed Since Last Clear')
    if (status & 0x20) statusBits.push('Test Failed Since Last Clear')
    if (status & 0x40) statusBits.push('Test Not Completed This Operation Cycle')
    if (status & 0x80) statusBits.push('Warning Indicator Requested')

    return statusBits.join(', ') || 'No Status'
  }

  // Get service mapping
  getServiceMapping(serviceCode: string): any {
    const mappingRules = this.rules.filter(r => r.ruleType === 'SERVICE_MAPPING')

    for (const rule of mappingRules) {
      const config = rule.configuration as ServiceMappingConfig
      if (config.services[serviceCode]) {
        return config.services[serviceCode]
      }
    }

    return null
  }

  // Format DTC for display based on OEM preferences
  formatDTCForDisplay(dtcCode: string): string {
    if (!this.vehicleContext) return dtcCode

    const dtcFormat = this.vehicleContext.modelYear.dtcFormat ||
                     this.vehicleContext.model.dtcFormat ||
                     this.vehicleContext.oem.defaultDTCFormat

    switch (dtcFormat) {
      case 'ISO_14229_3_BYTE':
        // Return as-is for manufacturer-specific codes
        return dtcCode.toUpperCase()

      case 'ISO_14229_2_BYTE':
        // Return first 4 chars for 2-byte DTCs
        return dtcCode.substring(0, 4).toUpperCase()

      case 'J2012_SPN_FMI':
        // Convert to SPN/FMI format if applicable
        // This would need additional logic for J1939 systems
        return dtcCode.toUpperCase()

      default:
        return dtcCode.toUpperCase()
    }
  }

  // Get all applicable rules for debugging
  getApplicableRules(): ParsingRule[] {
    return this.rules
  }

  // Get vehicle context for debugging
  getVehicleContext() {
    return this.vehicleContext
  }
}

// Helper function to create parsing engine instance
export async function createParsingEngine(vehicleId: string): Promise<DiagnosticParsingEngine> {
  const engine = new DiagnosticParsingEngine()
  await engine.initialize(vehicleId)
  return engine
}