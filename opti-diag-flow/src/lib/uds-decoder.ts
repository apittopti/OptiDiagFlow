/**
 * UDS Decoder Service
 * Decodes UDS (Unified Diagnostic Services) messages according to ISO 14229
 */

export interface UDSMessage {
  timestamp: Date
  direction: 'request' | 'response'
  source: string
  target: string
  serviceId: string
  serviceName: string
  subfunction?: string
  data: string
  decodedData?: any
  isPositiveResponse: boolean
  isNegativeResponse: boolean
  nrc?: string // Negative Response Code
}

export interface ECUInfo {
  address: string
  name?: string
  discoveredServices: Set<string>
  discoveredDIDs: Set<string>
  discoveredRoutines: Set<string>
  discoveredDTCs: Set<string>
  sessionTypes: Set<string>
  firstSeen: Date
  lastSeen: Date
  messageCount: number
}

export interface TraceLogEntry {
  timestamp: string
  direction: string
  protocol: string
  source: string
  target: string
  data: string
}

// UDS Service IDs (ISO 14229-1)
export const UDS_SERVICES = {
  '10': 'DiagnosticSessionControl',
  '11': 'ECUReset',
  '14': 'ClearDiagnosticInformation',
  '19': 'ReadDTCInformation',
  '22': 'ReadDataByIdentifier',
  '23': 'ReadMemoryByAddress',
  '24': 'ReadScalingDataByIdentifier',
  '27': 'SecurityAccess',
  '28': 'CommunicationControl',
  '2A': 'ReadDataByPeriodicIdentifier',
  '2C': 'DynamicallyDefineDataIdentifier',
  '2E': 'WriteDataByIdentifier',
  '2F': 'InputOutputControlByIdentifier',
  '31': 'RoutineControl',
  '34': 'RequestDownload',
  '35': 'RequestUpload',
  '36': 'TransferData',
  '37': 'RequestTransferExit',
  '38': 'RequestFileTransfer',
  '3D': 'WriteMemoryByAddress',
  '3E': 'TesterPresent',
  '83': 'AccessTimingParameter',
  '84': 'SecuredDataTransmission',
  '85': 'ControlDTCSetting',
  '86': 'ResponseOnEvent',
  '87': 'LinkControl'
}

// Negative Response Codes (ISO 14229-1)
export const NEGATIVE_RESPONSE_CODES = {
  '10': 'generalReject',
  '11': 'serviceNotSupported',
  '12': 'subfunctionNotSupported',
  '13': 'incorrectMessageLengthOrInvalidFormat',
  '14': 'responseTooLong',
  '21': 'busyRepeatRequest',
  '22': 'conditionsNotCorrect',
  '24': 'requestSequenceError',
  '25': 'noResponseFromSubnetComponent',
  '26': 'failurePreventsExecutionOfRequestedAction',
  '31': 'requestOutOfRange',
  '33': 'securityAccessDenied',
  '35': 'invalidKey',
  '36': 'exceedNumberOfAttempts',
  '37': 'requiredTimeDelayNotExpired',
  '70': 'uploadDownloadNotAccepted',
  '71': 'transferDataSuspended',
  '72': 'generalProgrammingFailure',
  '73': 'wrongBlockSequenceCounter',
  '78': 'requestCorrectlyReceivedResponsePending',
  '7E': 'subfunctionNotSupportedInActiveSession',
  '7F': 'serviceNotSupportedInActiveSession'
}

// Session Types (0x10 service)
export const SESSION_TYPES = {
  '01': 'defaultSession',
  '02': 'programmingSession',
  '03': 'extendedDiagnosticSession',
  '04': 'safetySystemDiagnosticSession'
}

// Routine Control Subfunctions (0x31 service)
export const ROUTINE_CONTROL_TYPES = {
  '01': 'startRoutine',
  '02': 'stopRoutine',
  '03': 'requestRoutineResults'
}

// DTC Report Types (0x19 service)
export const DTC_REPORT_TYPES = {
  '01': 'reportNumberOfDTCByStatusMask',
  '02': 'reportDTCByStatusMask',
  '03': 'reportDTCSnapshotIdentification',
  '04': 'reportDTCSnapshotRecordByDTCNumber',
  '05': 'reportDTCStoredDataByRecordNumber',
  '06': 'reportDTCExtDataRecordByDTCNumber',
  '07': 'reportNumberOfDTCBySeverityMaskRecord',
  '08': 'reportDTCBySeverityMaskRecord',
  '09': 'reportSeverityInformationOfDTC',
  '0A': 'reportSupportedDTC',
  '0B': 'reportFirstTestFailedDTC',
  '0C': 'reportFirstConfirmedDTC',
  '0D': 'reportMostRecentTestFailedDTC',
  '0E': 'reportMostRecentConfirmedDTC',
  '0F': 'reportMirrorMemoryDTCByStatusMask',
  '10': 'reportMirrorMemoryDTCExtDataRecordByDTCNumber',
  '11': 'reportNumberOfMirrorMemoryDTCByStatusMask',
  '12': 'reportNumberOfEmissionsOBDDTCByStatusMask',
  '13': 'reportEmissionsOBDDTCByStatusMask',
  '14': 'reportDTCFaultDetectionCounter',
  '15': 'reportDTCWithPermanentStatus'
}

export class UDSDecoder {
  private ecuMap: Map<string, ECUInfo> = new Map()

  /**
   * Parse a trace log line into structured data
   */
  parseTraceLogLine(line: string): TraceLogEntry | null {
    // Format: 12:18:08.801 | [Local]->[Remote] DOIP => [1716] source[0E80] target[FFFFE400] data[3E80]
    const match = line.match(
      /^(\d{2}:\d{2}:\d{2}\.\d{3})\s*\|\s*\[([^\]]+)\]->\[([^\]]+)\]\s*(\w+)\s*=>\s*\[([^\]]+)\]\s*source\[([^\]]+)\]\s*target\[([^\]]+)\]\s*data\[([^\]]+)\]/
    )

    if (!match) {
      return null
    }

    return {
      timestamp: match[1],
      direction: `${match[2]}->${match[3]}`,
      protocol: match[4],
      source: match[6],
      target: match[7],
      data: match[8]
    }
  }

  /**
   * Decode a UDS message from hex data
   */
  decodeUDSMessage(entry: TraceLogEntry): UDSMessage {
    const data = entry.data.toUpperCase()
    const serviceId = data.substring(0, 2)

    // Check if it's a negative response
    const isNegativeResponse = serviceId === '7F'
    let isPositiveResponse = false
    let actualServiceId = serviceId
    let nrc: string | undefined

    if (isNegativeResponse && data.length >= 6) {
      actualServiceId = data.substring(2, 4)
      nrc = data.substring(4, 6)
    } else if (parseInt(serviceId, 16) >= 0x40) {
      // Positive response (service ID + 0x40)
      isPositiveResponse = true
      const requestServiceId = (parseInt(serviceId, 16) - 0x40).toString(16).toUpperCase().padStart(2, '0')
      actualServiceId = requestServiceId
    }

    const serviceName = UDS_SERVICES[actualServiceId] || `Unknown(0x${actualServiceId})`
    const direction = entry.direction.includes('Local->Remote') ? 'request' : 'response'

    const message: UDSMessage = {
      timestamp: new Date(entry.timestamp),
      direction,
      source: entry.source,
      target: entry.target,
      serviceId: actualServiceId,
      serviceName,
      data: entry.data,
      isPositiveResponse,
      isNegativeResponse,
      nrc: nrc ? NEGATIVE_RESPONSE_CODES[nrc] || `Unknown(0x${nrc})` : undefined
    }

    // Decode specific services
    this.decodeServiceData(message, data)

    return message
  }

  /**
   * Decode service-specific data
   */
  private decodeServiceData(message: UDSMessage, data: string): void {
    const { serviceId, isPositiveResponse, isNegativeResponse } = message

    if (isNegativeResponse) {
      return
    }

    switch (serviceId) {
      case '10': // DiagnosticSessionControl
        if (data.length >= 4) {
          const subfunction = data.substring(2, 4)
          message.subfunction = SESSION_TYPES[subfunction] || `Unknown(0x${subfunction})`
          message.decodedData = {
            sessionType: message.subfunction
          }
        }
        break

      case '22': // ReadDataByIdentifier
        if (!isPositiveResponse && data.length >= 6) {
          const did = data.substring(2, 6)
          message.decodedData = {
            did,
            description: this.getCommonDIDDescription(did)
          }
        } else if (isPositiveResponse && data.length >= 6) {
          const did = data.substring(2, 6)
          const value = data.substring(6)
          message.decodedData = {
            did,
            value,
            description: this.getCommonDIDDescription(did)
          }
        }
        break

      case '31': // RoutineControl
        if (data.length >= 8) {
          const subfunction = data.substring(2, 4)
          const routineId = data.substring(4, 8)
          message.subfunction = ROUTINE_CONTROL_TYPES[subfunction] || `Unknown(0x${subfunction})`
          message.decodedData = {
            controlType: message.subfunction,
            routineId
          }
        }
        break

      case '19': // ReadDTCInformation
        if (data.length >= 4) {
          const reportType = data.substring(2, 4)
          message.subfunction = DTC_REPORT_TYPES[reportType] || `Unknown(0x${reportType})`
          message.decodedData = {
            reportType: message.subfunction
          }

          // Decode DTCs if present in response
          if (isPositiveResponse && reportType === '02' && data.length >= 10) {
            const dtcs = this.extractDTCsFromResponse(data.substring(6))
            message.decodedData.dtcs = dtcs
          }
        }
        break

      case '27': // SecurityAccess
        if (data.length >= 4) {
          const level = parseInt(data.substring(2, 4), 16)
          const isRequestSeed = level % 2 === 1
          message.subfunction = isRequestSeed ? 'requestSeed' : 'sendKey'
          message.decodedData = {
            accessLevel: Math.floor(level / 2) + 1,
            type: message.subfunction
          }
        }
        break

      case '3E': // TesterPresent
        if (data.length >= 4) {
          const suppressResponse = data.substring(2, 4) === '80'
          message.decodedData = {
            suppressPositiveResponse: suppressResponse
          }
        }
        break
    }
  }

  /**
   * Get common DID descriptions
   */
  private getCommonDIDDescription(did: string): string {
    const commonDIDs: Record<string, string> = {
      'F186': 'ActiveDiagnosticSession',
      'F187': 'VehicleManufacturerSparePartNumber',
      'F188': 'VehicleManufacturerECUSoftwareNumber',
      'F189': 'VehicleManufacturerECUSoftwareVersionNumber',
      'F18A': 'SystemSupplierIdentifier',
      'F18B': 'ECUManufacturingDateAndTime',
      'F18C': 'SystemSupplierECUSoftwareNumber',
      'F18E': 'VINOriginal',
      'F190': 'VehicleIdentificationNumber',
      'F191': 'VehicleManufacturerECUHardwareNumber',
      'F192': 'SystemSupplierECUHardwareNumber',
      'F193': 'SystemSupplierECUHardwareVersionNumber',
      'F194': 'SystemSupplierECUSoftwareVersionNumber',
      'F195': 'ExhaustRegulationOrTypeApprovalNumber',
      'F196': 'SystemNameOrEngineType',
      'F197': 'RepairShopCodeOrTesterSerialNumber',
      'F198': 'ProgrammingDate',
      'F199': 'CalibrationRepairShopCodeOrCalibrationEquipmentSerialNumber',
      'F19A': 'CalibrationDate',
      'F19B': 'CalibrationEquipmentSoftwareNumber',
      'F19C': 'ECUInstallationDate',
      'F19D': 'ODXFile',
      'F19E': 'EntityIdentifier',
      'DD00': 'BootSoftwareVersion',
      'DD01': 'ApplicationSoftwareVersion',
      'DD02': 'ApplicationDataVersion',
      'DD09': 'ECUStatus'
    }

    return commonDIDs[did.toUpperCase()] || 'Unknown DID'
  }

  /**
   * Extract DTCs from a response
   */
  private extractDTCsFromResponse(data: string): Array<{code: string, status: string}> {
    const dtcs: Array<{code: string, status: string}> = []

    // Each DTC is 4 bytes (3 bytes DTC + 1 byte status)
    for (let i = 0; i + 8 <= data.length; i += 8) {
      const dtcCode = data.substring(i, i + 6)
      const status = data.substring(i + 6, i + 8)
      dtcs.push({
        code: dtcCode,
        status
      })
    }

    return dtcs
  }

  /**
   * Discover ECUs from trace log
   */
  discoverECUs(entries: TraceLogEntry[]): Map<string, ECUInfo> {
    this.ecuMap.clear()

    for (const entry of entries) {
      // Skip metadata entries
      if (!entry.data || entry.protocol !== 'DOIP') {
        continue
      }

      const message = this.decodeUDSMessage(entry)

      // Track ECU based on target address (for requests) or source (for responses)
      const ecuAddress = message.direction === 'request' ? message.target : message.source

      // Skip broadcast addresses
      if (ecuAddress.startsWith('FFFF')) {
        continue
      }

      if (!this.ecuMap.has(ecuAddress)) {
        this.ecuMap.set(ecuAddress, {
          address: ecuAddress,
          discoveredServices: new Set(),
          discoveredDIDs: new Set(),
          discoveredRoutines: new Set(),
          discoveredDTCs: new Set(),
          sessionTypes: new Set(),
          firstSeen: message.timestamp,
          lastSeen: message.timestamp,
          messageCount: 0
        })
      }

      const ecu = this.ecuMap.get(ecuAddress)!
      ecu.lastSeen = message.timestamp
      ecu.messageCount++

      // Track discovered services
      if (message.direction === 'request') {
        ecu.discoveredServices.add(message.serviceId)

        // Track specific discoveries
        switch (message.serviceId) {
          case '10':
            if (message.decodedData?.sessionType) {
              ecu.sessionTypes.add(message.decodedData.sessionType)
            }
            break
          case '22':
            if (message.decodedData?.did) {
              ecu.discoveredDIDs.add(message.decodedData.did)
            }
            break
          case '31':
            if (message.decodedData?.routineId) {
              ecu.discoveredRoutines.add(message.decodedData.routineId)
            }
            break
        }
      } else if (message.isPositiveResponse && message.serviceId === '19') {
        // Track discovered DTCs from responses
        if (message.decodedData?.dtcs) {
          for (const dtc of message.decodedData.dtcs) {
            ecu.discoveredDTCs.add(dtc.code)
          }
        }
      }
    }

    // Assign ECU names based on common patterns
    for (const [address, ecu] of this.ecuMap) {
      ecu.name = this.inferECUName(address, ecu)
    }

    return this.ecuMap
  }

  /**
   * Infer ECU name from address and discovered services
   */
  private inferECUName(address: string, ecu: ECUInfo): string {
    // Common ECU addresses (manufacturer specific)
    const knownAddresses: Record<string, string> = {
      '1706': 'Camera Control Module',
      '0706': 'Body Control Module',
      '0733': 'Engine Control Module',
      '0743': 'Transmission Control Module',
      '0747': 'ABS/ESP Module',
      '0760': 'Airbag Module',
      '0764': 'Steering Angle Sensor',
      '0783': 'Instrument Cluster',
      '07A0': 'Parking Assistance',
      '07E0': 'Engine Control',
      '07E8': 'Engine Response'
    }

    if (knownAddresses[address.toUpperCase()]) {
      return knownAddresses[address.toUpperCase()]
    }

    // Infer from services
    if (ecu.discoveredServices.has('31') && ecu.discoveredRoutines.size > 0) {
      if (Array.from(ecu.discoveredRoutines).some(r => r.startsWith('08'))) {
        return 'Camera Module'
      }
    }

    return `ECU_${address}`
  }

  /**
   * Parse complete trace log file
   */
  parseTraceLog(logContent: string): {
    entries: TraceLogEntry[]
    messages: UDSMessage[]
    ecus: Map<string, ECUInfo>
    metadata: any
  } {
    const lines = logContent.split('\n')
    const entries: TraceLogEntry[] = []
    const messages: UDSMessage[] = []
    const metadata: any = {}

    for (const line of lines) {
      const trimmedLine = line.trim()

      // Skip empty lines
      if (!trimmedLine) {
        continue
      }

      // Check for metadata
      if (trimmedLine.includes('METADATA')) {
        const metaMatch = trimmedLine.match(/key\[([^\]]+)\]\s*value\[([^\]]+)\]/)
        if (metaMatch) {
          metadata[metaMatch[1]] = metaMatch[2]
        }
        continue
      }

      // Parse DOIP entries
      const entry = this.parseTraceLogLine(trimmedLine)
      if (entry) {
        entries.push(entry)
        const message = this.decodeUDSMessage(entry)
        messages.push(message)
      }
    }

    // Discover ECUs
    const ecus = this.discoverECUs(entries)

    return {
      entries,
      messages,
      ecus,
      metadata
    }
  }

  /**
   * Generate summary report
   */
  generateSummary(parseResult: ReturnType<typeof this.parseTraceLog>): any {
    const { messages, ecus, metadata } = parseResult

    const summary = {
      totalMessages: messages.length,
      totalECUs: ecus.size,
      metadata,
      ecus: Array.from(ecus.entries()).map(([address, ecu]) => ({
        address,
        name: ecu.name,
        messageCount: ecu.messageCount,
        discoveredServices: Array.from(ecu.discoveredServices).map(
          sid => `${sid}:${UDS_SERVICES[sid] || 'Unknown'}`
        ),
        discoveredDIDs: Array.from(ecu.discoveredDIDs),
        discoveredRoutines: Array.from(ecu.discoveredRoutines),
        discoveredDTCs: Array.from(ecu.discoveredDTCs),
        sessionTypes: Array.from(ecu.sessionTypes)
      })),
      serviceUsage: this.calculateServiceUsage(messages),
      communicationFlow: this.analyzeCommunicationFlow(messages)
    }

    return summary
  }

  /**
   * Calculate service usage statistics
   */
  private calculateServiceUsage(messages: UDSMessage[]): any {
    const usage: Record<string, number> = {}

    for (const msg of messages) {
      if (msg.direction === 'request') {
        const key = `${msg.serviceId}:${msg.serviceName}`
        usage[key] = (usage[key] || 0) + 1
      }
    }

    return usage
  }

  /**
   * Analyze communication flow patterns
   */
  private analyzeCommunicationFlow(messages: UDSMessage[]): any {
    const flows: Array<{from: string, to: string, service: string, count: number}> = []
    const flowMap = new Map<string, number>()

    for (const msg of messages) {
      if (msg.direction === 'request') {
        const key = `${msg.source}->${msg.target}:${msg.serviceName}`
        flowMap.set(key, (flowMap.get(key) || 0) + 1)
      }
    }

    for (const [key, count] of flowMap) {
      const [addresses, service] = key.split(':')
      const [from, to] = addresses.split('->')
      flows.push({ from, to, service, count })
    }

    return flows.sort((a, b) => b.count - a.count).slice(0, 20)
  }
}

export default UDSDecoder