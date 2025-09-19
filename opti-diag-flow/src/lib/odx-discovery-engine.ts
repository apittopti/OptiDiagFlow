/**
 * ODX Discovery Engine
 * Reverse-engineers ODX data from diagnostic trace files
 * Builds knowledge base incrementally as more trace data is analyzed
 */

import type { PrismaClient } from '@prisma/client'
import type { DoipTraceMessage } from './doip-parser'

// Pattern types we can discover
export enum DiscoveryType {
  ECU_IDENTIFICATION = 'ECU_IDENTIFICATION',
  SERVICE_REQUEST = 'SERVICE_REQUEST',
  SERVICE_RESPONSE = 'SERVICE_RESPONSE',
  DTC_FORMAT = 'DTC_FORMAT',
  DTC_STATUS_MASK = 'DTC_STATUS_MASK',
  DATA_IDENTIFIER = 'DATA_IDENTIFIER',
  ROUTINE_CONTROL = 'ROUTINE_CONTROL',
  PARAMETER_FORMAT = 'PARAMETER_FORMAT'
}

// Confidence levels for discovered patterns
export enum ConfidenceLevel {
  LOW = 'LOW',           // Single occurrence
  MEDIUM = 'MEDIUM',     // Multiple occurrences, consistent
  HIGH = 'HIGH',         // Many occurrences, validated
  CONFIRMED = 'CONFIRMED' // Manually verified or from ODX
}

export interface DiscoveredPattern {
  type: DiscoveryType
  ecuAddress: string
  serviceId?: string
  subfunction?: string
  pattern: string
  confidence: ConfidenceLevel
  occurrences: number
  metadata: any
  examples: string[]
}

export interface DiscoveredECU {
  address: string
  possibleNames: Map<string, number> // name -> occurrence count
  identifiedServices: Set<string>
  dtcFormat?: string
  communicationPattern: {
    physicalAddress?: string
    functionalAddress?: string
    responseAddress?: string
  }
  confidence: ConfidenceLevel
}

export interface DiscoveredService {
  serviceId: string
  serviceName?: string
  subfunctions: Map<string, ServiceSubfunction>
  requestFormat?: string
  responseFormat?: string
  negativeResponseCodes: Set<string>
  confidence: ConfidenceLevel
}

export interface ServiceSubfunction {
  id: string
  name?: string
  requestPattern?: string
  responsePattern?: string
  parameterCount?: number
  examples: string[]
}

export interface DiscoveredDTC {
  code: string
  ecuAddress: string
  statusMask?: string
  occurrences: number
  contexts: Array<{
    timestamp: Date
    sessionType?: string
    beforeRoutine?: boolean
    afterRoutine?: boolean
  }>
  confidence: ConfidenceLevel
}

export class ODXDiscoveryEngine {
  private prisma: PrismaClient
  private discoveredECUs: Map<string, DiscoveredECU> = new Map()
  private discoveredServices: Map<string, DiscoveredService> = new Map()
  private discoveredDTCs: Map<string, DiscoveredDTC> = new Map()
  private discoveredDataIdentifiers: Map<string, any> = new Map()
  private patterns: DiscoveredPattern[] = []

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Analyze trace session to discover patterns
   */
  async analyzeTraceSession(
    messages: DoipTraceMessage[],
    vehicleId: string,
    sessionId: string
  ): Promise<void> {
    // Group messages by ECU
    const ecuMessages = this.groupMessagesByECU(messages)

    // Analyze each ECU's communication patterns
    for (const [ecuAddress, ecuMsgs] of ecuMessages) {
      await this.analyzeECUCommunication(ecuAddress, ecuMsgs, vehicleId)
    }

    // Discover service patterns
    await this.discoverServicePatterns(messages)

    // Discover DTC patterns
    await this.discoverDTCPatterns(messages)

    // Discover data identifier patterns
    await this.discoverDataIdentifierPatterns(messages)

    // Save discoveries to database
    await this.saveDiscoveries(vehicleId, sessionId)
  }

  /**
   * Group messages by ECU address
   */
  private groupMessagesByECU(messages: DoipTraceMessage[]): Map<string, DoipTraceMessage[]> {
    const ecuGroups = new Map<string, DoipTraceMessage[]>()

    messages.forEach(msg => {
      const ecuAddr = msg.direction === 'Local->Remote' ? msg.targetAddr : msg.sourceAddr
      if (!ecuGroups.has(ecuAddr)) {
        ecuGroups.set(ecuAddr, [])
      }
      ecuGroups.get(ecuAddr)!.push(msg)
    })

    return ecuGroups
  }

  /**
   * Analyze ECU communication patterns
   */
  private async analyzeECUCommunication(
    ecuAddress: string,
    messages: DoipTraceMessage[],
    vehicleId: string
  ): Promise<void> {
    let ecu = this.discoveredECUs.get(ecuAddress)

    if (!ecu) {
      ecu = {
        address: ecuAddress,
        possibleNames: new Map(),
        identifiedServices: new Set(),
        communicationPattern: {},
        confidence: ConfidenceLevel.LOW
      }
      this.discoveredECUs.set(ecuAddress, ecu)
    }

    // Analyze services used by this ECU
    messages.forEach(msg => {
      if (msg.data && msg.data.length >= 2) {
        const serviceId = msg.data.substring(0, 2).toUpperCase()
        ecu!.identifiedServices.add(serviceId)

        // Try to identify ECU type based on services
        this.inferECUType(ecu!, serviceId, msg.data)
      }
    })

    // Update confidence based on message count
    if (messages.length > 100) {
      ecu.confidence = ConfidenceLevel.HIGH
    } else if (messages.length > 20) {
      ecu.confidence = ConfidenceLevel.MEDIUM
    }
  }

  /**
   * Infer ECU type based on diagnostic services
   */
  private inferECUType(ecu: DiscoveredECU, serviceId: string, data: string): void {
    // Don't guess ECU names - that's the whole point of this app!
    // Users will add meaningful names through the ODX Management UI
    // We only discover what we CAN know from traces: addresses, service IDs, DTCs

    // This method is kept for future use if we want to track patterns
    // but we don't assign names automatically anymore
  }

  /**
   * Add possible ECU name with occurrence counting
   */
  private addPossibleECUName(ecu: DiscoveredECU, name: string): void {
    const count = ecu.possibleNames.get(name) || 0
    ecu.possibleNames.set(name, count + 1)
  }

  /**
   * Discover service request/response patterns
   */
  private async discoverServicePatterns(messages: DoipTraceMessage[]): Promise<void> {
    const serviceGroups = new Map<string, DoipTraceMessage[]>()

    // Group by service ID
    messages.forEach(msg => {
      if (msg.data && msg.data.length >= 2) {
        const serviceId = msg.data.substring(0, 2).toUpperCase()
        if (!serviceGroups.has(serviceId)) {
          serviceGroups.set(serviceId, [])
        }
        serviceGroups.get(serviceId)!.push(msg)
      }
    })

    // Analyze each service
    for (const [serviceId, serviceMsgs] of serviceGroups) {
      await this.analyzeService(serviceId, serviceMsgs)
    }
  }

  /**
   * Analyze a specific service
   */
  private async analyzeService(serviceId: string, messages: DoipTraceMessage[]): Promise<void> {
    let service = this.discoveredServices.get(serviceId)

    if (!service) {
      service = {
        serviceId,
        subfunctions: new Map(),
        negativeResponseCodes: new Set(),
        confidence: ConfidenceLevel.LOW
      }
      this.discoveredServices.set(serviceId, service)
    }

    // Identify subfunctions
    messages.forEach(msg => {
      if (msg.data && msg.data.length >= 4) {
        const subfunction = msg.data.substring(2, 4)

        if (!service!.subfunctions.has(subfunction)) {
          service!.subfunctions.set(subfunction, {
            id: subfunction,
            examples: []
          })
        }

        const sf = service!.subfunctions.get(subfunction)!
        if (sf.examples.length < 10) {
          sf.examples.push(msg.data)
        }

        // Analyze patterns in the data
        this.analyzeDataPattern(sf, msg.data)
      }
    })

    // Update confidence
    if (messages.length > 50) {
      service.confidence = ConfidenceLevel.HIGH
    } else if (messages.length > 10) {
      service.confidence = ConfidenceLevel.MEDIUM
    }
  }

  /**
   * Analyze data patterns in service messages
   */
  private analyzeDataPattern(subfunction: ServiceSubfunction, data: string): void {
    // Detect parameter count patterns
    const dataLength = data.length

    if (!subfunction.requestPattern) {
      // Simple pattern detection based on length
      if (dataLength === 4) {
        subfunction.requestPattern = 'SERVICE_SUBFUNCTION'
      } else if (dataLength === 6) {
        subfunction.requestPattern = 'SERVICE_SUBFUNCTION_PARAM8'
      } else if (dataLength === 8) {
        subfunction.requestPattern = 'SERVICE_SUBFUNCTION_PARAM16'
      } else {
        subfunction.requestPattern = `SERVICE_SUBFUNCTION_DATA[${(dataLength - 4) / 2}]`
      }
    }
  }

  /**
   * Discover DTC patterns
   */
  private async discoverDTCPatterns(messages: DoipTraceMessage[]): Promise<void> {
    // Look for service 0x19 responses
    const dtcMessages = messages.filter(msg =>
      msg.data &&
      msg.data.startsWith('59') &&
      msg.direction === 'Remote->Local'
    )

    for (const msg of dtcMessages) {
      await this.analyzeDTCMessage(msg)
    }
  }

  /**
   * Analyze DTC message
   */
  private async analyzeDTCMessage(message: DoipTraceMessage): Promise<void> {
    const data = message.data
    if (!data || data.length < 4) return

    const subfunction = data.substring(2, 4)

    // Detect DTC format based on subfunction and data pattern
    switch (subfunction) {
      case '02': // Report DTC by status mask
      case '0A': // Report supported DTCs
        await this.analyzeDTCFormat02(data, message.sourceAddr)
        break

      case '03': // Report DTC snapshot
        await this.analyzeDTCFormat03(data, message.sourceAddr)
        break

      case '04': // Report DTC snapshot data
      case '06': // Report DTC extended data
        // These contain additional DTC data, not the DTCs themselves
        break
    }
  }

  /**
   * Analyze DTC format for subfunction 02
   */
  private async analyzeDTCFormat02(data: string, ecuAddress: string): Promise<void> {
    // Skip subfunction and status mask
    const dtcData = data.substring(4)

    // Try different DTC lengths (2, 3, or 4 bytes per DTC)
    const possibleLengths = [4, 6, 8]

    for (const length of possibleLengths) {
      if (dtcData.length % length === 0) {
        const dtcCount = dtcData.length / length

        if (dtcCount > 0 && dtcCount <= 20) { // Reasonable DTC count
          // This might be the correct format
          for (let i = 0; i < dtcData.length; i += length) {
            const dtcCode = dtcData.substring(i, i + length - 2) // Assuming last byte is status
            const status = dtcData.substring(i + length - 2, i + length)

            this.recordDTC(dtcCode, status, ecuAddress)
          }

          // Record the discovered format
          this.patterns.push({
            type: DiscoveryType.DTC_FORMAT,
            ecuAddress,
            pattern: `SUBFUNCTION_02_${length / 2}BYTE_DTC`,
            confidence: ConfidenceLevel.MEDIUM,
            occurrences: dtcCount,
            metadata: {
              dtcLength: length / 2,
              includesStatus: true
            },
            examples: [data]
          })

          break
        }
      }
    }
  }

  /**
   * Analyze DTC format for subfunction 03
   */
  private async analyzeDTCFormat03(data: string, ecuAddress: string): Promise<void> {
    const dtcData = data.substring(2)

    // For subfunction 03, typically 4 bytes per DTC (3 bytes DTC + 1 status)
    const recordLength = 8 // 4 bytes = 8 hex chars

    if (dtcData.length % recordLength === 0) {
      const dtcCount = dtcData.length / recordLength

      for (let i = 0; i < dtcData.length; i += recordLength) {
        const dtcCode = dtcData.substring(i, i + 6) // 3-byte DTC
        const status = dtcData.substring(i + 6, i + 8)

        this.recordDTC(dtcCode, status, ecuAddress)
      }

      // Record the discovered format
      this.patterns.push({
        type: DiscoveryType.DTC_FORMAT,
        ecuAddress,
        pattern: 'SUBFUNCTION_03_3BYTE_DTC_WITH_STATUS',
        confidence: ConfidenceLevel.HIGH,
        occurrences: dtcCount,
        metadata: {
          dtcLength: 3,
          statusBytePosition: 3
        },
        examples: [data]
      })
    }
  }

  /**
   * Record discovered DTC
   */
  private recordDTC(code: string, status: string, ecuAddress: string): void {
    const key = `${ecuAddress}_${code}`
    let dtc = this.discoveredDTCs.get(key)

    if (!dtc) {
      dtc = {
        code,
        ecuAddress,
        statusMask: status,
        occurrences: 0,
        contexts: [],
        confidence: ConfidenceLevel.LOW
      }
      this.discoveredDTCs.set(key, dtc)
    }

    dtc.occurrences++
    dtc.contexts.push({
      timestamp: new Date(),
      // Could add more context if available
    })

    // Update confidence
    if (dtc.occurrences > 5) {
      dtc.confidence = ConfidenceLevel.HIGH
    } else if (dtc.occurrences > 2) {
      dtc.confidence = ConfidenceLevel.MEDIUM
    }
  }

  /**
   * Discover data identifier patterns
   */
  private async discoverDataIdentifierPatterns(messages: DoipTraceMessage[]): Promise<void> {
    // Look for service 0x22 (Read Data By Identifier) responses
    const dataIdMessages = messages.filter(msg =>
      msg.data &&
      msg.data.startsWith('62') &&
      msg.direction === 'Remote->Local'
    )

    for (const msg of dataIdMessages) {
      await this.analyzeDataIdentifier(msg)
    }
  }

  /**
   * Analyze data identifier
   */
  private async analyzeDataIdentifier(message: DoipTraceMessage): Promise<void> {
    const data = message.data
    if (!data || data.length < 6) return

    const dataId = data.substring(2, 6) // 2-byte data identifier
    const dataValue = data.substring(6)

    // Try to identify common data identifiers
    const knownIdentifiers: { [key: string]: string } = {
      'F190': 'VIN',
      'F18A': 'System Supplier ECU Software Number',
      'F18C': 'ECU Software Number',
      'F191': 'Vehicle Manufacturer ECU Hardware Number',
      'F192': 'System Supplier ECU Hardware Number',
      'F194': 'System Supplier ECU Hardware Version Number',
      'F195': 'System Supplier ECU Software Version Number',
      'F197': 'System Name or Engine Type',
      'F198': 'Repair Shop Code',
      'F199': 'Programming Date',
      'F19E': 'Diagnostic Address'
    }

    const identifierName = knownIdentifiers[dataId] || `Unknown_${dataId}`

    this.discoveredDataIdentifiers.set(dataId, {
      id: dataId,
      name: identifierName,
      ecuAddress: message.sourceAddr,
      exampleValues: [dataValue],
      dataLength: dataValue.length / 2,
      confidence: knownIdentifiers[dataId] ? ConfidenceLevel.HIGH : ConfidenceLevel.LOW
    })

    // Record pattern
    this.patterns.push({
      type: DiscoveryType.DATA_IDENTIFIER,
      ecuAddress: message.sourceAddr,
      pattern: dataId,
      confidence: knownIdentifiers[dataId] ? ConfidenceLevel.HIGH : ConfidenceLevel.MEDIUM,
      occurrences: 1,
      metadata: {
        identifierName,
        dataLength: dataValue.length / 2
      },
      examples: [data]
    })
  }

  /**
   * Save discoveries to database
   */
  private async saveDiscoveries(vehicleId: string, sessionId: string): Promise<void> {
    // Get vehicle's model year and company
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        modelYear: {
          include: {
            model: {
              include: {
                oem: true
              }
            }
          }
        }
      }
    })

    if (!vehicle) return

    const companyId = vehicle.modelYear.model.oem.id
    const modelId = vehicle.modelYear.model.id
    const modelYearId = vehicle.modelYear.id

    // Save discovered ECUs
    for (const [address, ecu] of this.discoveredECUs) {
      // Skip invalid addresses
      if (!address || typeof address !== 'string') {
        console.warn('Skipping ECU with invalid address:', address)
        continue
      }

      // Ensure address is a string and remove any leading zeros or 0x prefix
      const cleanAddress = address.toString().replace(/^0x/i, '').toUpperCase()

      // Don't guess ECU names - users will add them through the UI
      const ecuName = 'Unknown ECU'

      // Check if ECU mapping already exists
      const existing = await this.prisma.eCUMapping.findUnique({
        where: {
          modelYearId_ecuAddress: {
            modelYearId,
            ecuAddress: cleanAddress
          }
        }
      })

      if (!existing) {
        await this.prisma.eCUMapping.create({
          data: {
            modelYearId,
            ecuAddress: cleanAddress,
            ecuName,
            description: `Discovered from trace analysis. Services: ${Array.from(ecu.identifiedServices).join(', ')}`
          }
        })
      }
      // Don't update names - users will do this through the UI
    }

    // Save discovered DTCs
    for (const [key, dtc] of this.discoveredDTCs) {
      if (dtc.confidence >= ConfidenceLevel.MEDIUM) {
        // Find or create diagnostic layer for this model
        const modelCode = vehicle.modelYear.model.name.replace(/\s+/g, '_').toUpperCase()
        let diagLayer = await this.prisma.diagnosticLayer.findFirst({
          where: {
            companyId,
            shortName: `${modelCode}_DISCOVERED`
          }
        })

        if (!diagLayer) {
          diagLayer = await this.prisma.diagnosticLayer.create({
            data: {
              companyId,
              shortName: `${modelCode}_DISCOVERED`,
              longName: `Discovered diagnostics for ${vehicle.modelYear.model.name}`,
              description: 'Auto-discovered from trace files',
              layerType: 'ECU_VARIANT'
            }
          })
        }

        // Check if DTC already exists
        const existingDTC = await this.prisma.dTCDOP.findFirst({
          where: {
            layerId: diagLayer.id,
            dtcNumber: dtc.code
          }
        })

        if (!existingDTC) {
          await this.prisma.dTCDOP.create({
            data: {
              layerId: diagLayer.id,
              dtcNumber: dtc.code,
              shortName: `DTC_${dtc.code}`,
              description: `Discovered from ${dtc.occurrences} occurrences`,
              troubleCode: dtc.code,
              displayCode: dtc.code
            }
          })
        }
      }
    }

    // Save service patterns as parsing rules
    for (const [serviceId, service] of this.discoveredServices) {
      if (service.confidence >= ConfidenceLevel.MEDIUM) {
        const ruleName = `Discovered Service ${serviceId} - ${vehicle.modelYear.model.name}`

        const existingRule = await this.prisma.parsingRule.findFirst({
          where: {
            name: ruleName,
            modelId
          }
        })

        if (!existingRule) {
          const subfunctionMap: any = {}
          for (const [sfId, sf] of service.subfunctions) {
            subfunctionMap[sfId] = {
              pattern: sf.requestPattern,
              examples: sf.examples.slice(0, 3)
            }
          }

          await this.prisma.parsingRule.create({
            data: {
              name: ruleName,
              description: `Auto-discovered from ${service.subfunctions.size} subfunctions`,
              status: 'ACTIVE',
              modelId,
              ruleType: 'SERVICE_MAPPING',
              priority: 10, // Low priority for discovered rules
              configuration: {
                serviceId,
                subfunctions: subfunctionMap,
                confidence: service.confidence
              },
              createdBy: 'system' // You might want to track this differently
            }
          })
        }
      }
    }

    // Save discovery metadata
    await this.prisma.traceSession.update({
      where: { id: sessionId },
      data: {
        parsedData: {
          ...(await this.prisma.traceSession.findUnique({
            where: { id: sessionId },
            select: { parsedData: true }
          }))?.parsedData as any,
          discoveries: {
            ecuCount: this.discoveredECUs.size,
            serviceCount: this.discoveredServices.size,
            dtcCount: this.discoveredDTCs.size,
            dataIdentifierCount: this.discoveredDataIdentifiers.size,
            patternCount: this.patterns.length,
            timestamp: new Date()
          }
        }
      }
    })
  }

  /**
   * Get discovery summary
   */
  getDiscoverySummary(): any {
    return {
      ecus: Array.from(this.discoveredECUs.entries()).map(([addr, ecu]) => ({
        address: addr,
        mostLikelyName: this.getMostLikelyECUName(ecu),
        serviceCount: ecu.identifiedServices.size,
        confidence: ecu.confidence
      })),
      services: Array.from(this.discoveredServices.entries()).map(([id, service]) => ({
        serviceId: id,
        subfunctionCount: service.subfunctions.size,
        confidence: service.confidence
      })),
      dtcs: Array.from(this.discoveredDTCs.entries()).map(([key, dtc]) => ({
        code: dtc.code,
        ecuAddress: dtc.ecuAddress,
        occurrences: dtc.occurrences,
        confidence: dtc.confidence
      })),
      dataIdentifiers: Array.from(this.discoveredDataIdentifiers.entries()).map(([id, data]) => ({
        id,
        name: data.name,
        confidence: data.confidence
      })),
      totalPatterns: this.patterns.length
    }
  }

  /**
   * Get ECU name - always returns 'Unknown ECU' until user sets it
   */
  private getMostLikelyECUName(ecu: DiscoveredECU): string {
    // Don't guess names - that's the user's job through the UI
    return 'Unknown ECU'
  }

  /**
   * Export discovered data as ODX
   */
  async exportAsODX(vehicleId: string): Promise<string> {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        modelYear: {
          include: {
            model: {
              include: {
                oem: true
              }
            }
          }
        }
      }
    })

    if (!vehicle) throw new Error('Vehicle not found')

    // Generate ODX XML from discoveries
    const odxXml = `<?xml version="1.0" encoding="UTF-8"?>
<ODX MODEL-VERSION="2.2.0">
  <DIAG-LAYER-CONTAINER>
    <DIAG-LAYER ID="DISCOVERED_${vehicle.modelYear.model.code}">
      <VARIANT-TYPE>ECU-VARIANT</VARIANT-TYPE>
      <SHORT-NAME>${vehicle.modelYear.model.code}_DISCOVERED</SHORT-NAME>
      <LONG-NAME>Discovered Diagnostics for ${vehicle.modelYear.model.name}</LONG-NAME>
      <COMPARAM-SPEC>
        <COMPARAM-REF ID-REF="ISO_14229_UDS"/>
      </COMPARAM-SPEC>

      <DIAG-DATA-DICTIONARY-SPEC>
        <DTC-DOPS>
          ${this.generateDTCDOPsXML()}
        </DTC-DOPS>

        <DATA-OBJECT-PROPS>
          ${this.generateDataObjectPropsXML()}
        </DATA-OBJECT-PROPS>
      </DIAG-DATA-DICTIONARY-SPEC>

      <DIAG-COMMS>
        ${this.generateDiagServicesXML()}
      </DIAG-COMMS>
    </DIAG-LAYER>
  </DIAG-LAYER-CONTAINER>
</ODX>`

    return odxXml
  }

  /**
   * Generate DTC DOPs XML
   */
  private generateDTCDOPsXML(): string {
    let xml = ''

    for (const [key, dtc] of this.discoveredDTCs) {
      if (dtc.confidence >= ConfidenceLevel.MEDIUM) {
        xml += `
          <DTC-DOP ID="DTC_${dtc.code}">
            <SHORT-NAME>DTC_${dtc.code}</SHORT-NAME>
            <DTCS>
              <DTC ID="DTC_${dtc.code}_DEF">
                <SHORT-NAME>${dtc.code}</SHORT-NAME>
                <TROUBLE-CODE>${dtc.code}</TROUBLE-CODE>
                <DISPLAY-TROUBLE-CODE>${dtc.code}</DISPLAY-TROUBLE-CODE>
                <TEXT>Discovered DTC - ${dtc.occurrences} occurrences</TEXT>
                <LEVEL>3</LEVEL>
              </DTC>
            </DTCS>
          </DTC-DOP>`
      }
    }

    return xml
  }

  /**
   * Generate Data Object Props XML
   */
  private generateDataObjectPropsXML(): string {
    let xml = ''

    for (const [id, data] of this.discoveredDataIdentifiers) {
      xml += `
        <DATA-OBJECT-PROP ID="DOP_${id}">
          <SHORT-NAME>${data.name.replace(/\s+/g, '_')}</SHORT-NAME>
          <LONG-NAME>${data.name}</LONG-NAME>
          <DIAG-CODED-TYPE BASE-DATA-TYPE="UINT8-ARRAY" xsi:type="STANDARD-LENGTH-TYPE">
            <BIT-LENGTH>${data.dataLength * 8}</BIT-LENGTH>
          </DIAG-CODED-TYPE>
        </DATA-OBJECT-PROP>`
    }

    return xml
  }

  /**
   * Generate diagnostic services XML
   */
  private generateDiagServicesXML(): string {
    let xml = ''

    for (const [serviceId, service] of this.discoveredServices) {
      if (service.confidence >= ConfidenceLevel.MEDIUM) {
        xml += `
          <DIAG-SERVICE ID="SERVICE_${serviceId}">
            <SHORT-NAME>Service_0x${serviceId}</SHORT-NAME>
            <ADDRESSING>PHYSICAL</ADDRESSING>
            <REQUEST-REF ID-REF="REQ_${serviceId}"/>
            <POS-RESPONSE-REFS>
              <POS-RESPONSE-REF ID-REF="RESP_${serviceId}"/>
            </POS-RESPONSE-REFS>
          </DIAG-SERVICE>`
      }
    }

    return xml
  }
}

// Export helper function
export function createDiscoveryEngine(prisma: PrismaClient): ODXDiscoveryEngine {
  return new ODXDiscoveryEngine(prisma)
}