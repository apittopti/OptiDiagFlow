export interface DoipTraceMessage {
  lineNumber: number
  timestamp: string
  direction: 'Local->Remote' | 'Remote->Local' | 'Server->Tracer'
  protocol: string
  messageId?: string
  sourceAddr?: string
  targetAddr?: string
  data?: string
  metadata?: {
    key: string
    value: string
  }
}

export interface DTCInfo {
  code: string
  status: string
  statusByte: string
  description?: string
  snapshotData?: {
    recordNumber: string
    data: string
    decodedData?: { [key: string]: any }
  }[]
  extendedData?: {
    recordNumber: string
    data: string
    decodedData?: { [key: string]: any }
  }[]
}

export interface DiagnosticProcedure {
  id: string
  ecuAddress: string
  procedureType: 'session_control' | 'security_access' | 'data_reading' | 'dtc_management' | 'routine_control' | 'tester_present'
  procedureName: string
  startTime?: Date
  endTime?: Date
  status: 'started' | 'completed' | 'failed' | 'timeout'
  messages: DoipTraceMessage[]
  extractedData?: {
    dataIdentifiers?: { [key: string]: string }
    partNumbers?: string[]
    dtcs?: string[]  // Simple DTC codes for backward compatibility
    dtcDetails?: DTCInfo[]  // Detailed DTC information with snapshot/extended data
    dtcPhase?: 'pre-scan' | 'post-scan'  // Track when DTCs were read
    routineResults?: string[]
    sessionType?: string
    securityLevel?: string
  }
  requestCount: number
  responseCount: number
  errorCount: number
}

export interface EcuDiagnosticSummary {
  address: string
  name?: string
  procedures: DiagnosticProcedure[]
  totalProcedures: number
  successfulProcedures: number
  failedProcedures: number
  dataIdentifiersRead: number
  dtcsFound: number
  routinesExecuted: number
  securityAccess: boolean
  lastActivity?: Date
}

export interface ParsedTraceData {
  messages: DoipTraceMessage[]
  ecus: Map<string, EcuInfo>
  services: Map<string, ServiceInfo>
  procedures: DiagnosticProcedure[]
  ecuDiagnostics: Map<string, EcuDiagnosticSummary>
  metadata: {
    startTime?: Date
    endTime?: Date
    duration?: number
    messageCount: number
    ecuCount: number
    totalProcedures: number
    successfulProcedures: number
    failedProcedures: number
  }
}

export interface EcuInfo {
  address: string
  name?: string
  messagesSent: number
  messagesReceived: number
  firstSeen?: Date
  lastSeen?: Date
}

export interface ServiceInfo {
  serviceId: string
  serviceName: string
  requestCount: number
  responseCount: number
  errorCount: number
}

const SERVICE_CODES: Record<string, string> = {
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
  '62': 'ReadDataByIdentifier_Response',
  '71': 'RoutineControl_Response',
  '7E': 'TesterPresent_Response',
  '7F': 'NegativeResponse'
}

const ECU_ADDRESSES: Record<string, string> = {
  '0E80': 'Diagnostic Tester',
  '1FFF': 'Broadcast'
  // Don't guess ECU names - users will add them through the UI
}

function getProcedureType(serviceCode: string): DiagnosticProcedure['procedureType'] | null {
  const upperCode = serviceCode.toUpperCase()

  if (['10', '50'].includes(upperCode)) return 'session_control'
  if (['27', '67'].includes(upperCode)) return 'security_access'
  if (['22', '62'].includes(upperCode)) return 'data_reading'
  if (['19', '59', '14', '54'].includes(upperCode)) return 'dtc_management'
  if (['31', '71'].includes(upperCode)) return 'routine_control'
  if (['3E', '7E'].includes(upperCode)) return 'tester_present'

  return null
}

function getProcedureName(serviceCode: string): string {
  const upperCode = serviceCode.toUpperCase()

  const procedureNames: Record<string, string> = {
    '10': 'Diagnostic Session Control',
    '50': 'Diagnostic Session Control Response',
    '27': 'Security Access',
    '67': 'Security Access Response',
    '22': 'Read Data by Identifier',
    '62': 'Read Data by Identifier Response',
    '19': 'Read DTC Information',
    '59': 'Read DTC Information Response',
    '14': 'Clear Diagnostic Information',
    '54': 'Clear Diagnostic Information Response',
    '31': 'Routine Control',
    '71': 'Routine Control Response',
    '3E': 'Tester Present',
    '7E': 'Tester Present Response'
  }

  return procedureNames[upperCode] || SERVICE_CODES[upperCode] || `Unknown Procedure ${upperCode}`
}

function extractDataFromMessage(message: DoipTraceMessage): any {
  if (!message.data) return {}

  const serviceCode = message.data.substring(0, 2).toUpperCase()
  const data = message.data.substring(2)

  const extractedData: any = {}

  // Extract data identifiers for service 0x22 responses
  if (serviceCode === '62' && data.length >= 4) {
    const dataIdentifier = data.substring(0, 4)
    const dataValue = data.substring(4)
    extractedData.dataIdentifiers = { [dataIdentifier]: dataValue }

    // Check for common part number patterns
    if (['F190', 'F18A', 'F18C'].includes(dataIdentifier)) {
      const partNumber = hexToAscii(dataValue)
      if (partNumber && isValidPartNumber(partNumber)) {
        extractedData.partNumbers = [partNumber]
      }
    }
  }

  // Extract session type for service 0x10
  if (serviceCode === '10' && data.length >= 2) {
    const sessionType = data.substring(0, 2)
    extractedData.sessionType = getSessionTypeName(sessionType)
  }

  // Extract security level for service 0x27
  if (serviceCode === '27' && data.length >= 2) {
    const securityLevel = data.substring(0, 2)
    extractedData.securityLevel = getSecurityLevelName(securityLevel)
  }

  // Extract DTCs for service 0x19 responses
  if (serviceCode === '59' && data.length >= 4) {
    const subFunction = data.substring(0, 2)
    const responseData = data.substring(2)

    // Handle different DTC report subfunctions
    switch(subFunction) {
      case '02': // Report DTC by status mask
      case '0A': // Report supported DTCs
      case '0F': // Report mirror memory DTC by status mask
        // Format: [status mask (1 byte)][DTC records]
        // Skip the status mask byte (first 2 hex chars)
        if (responseData.length >= 8) {
          const statusMask = responseData.substring(0, 2)
          const dtcData = responseData.substring(2)

          // Only process if we have actual DTC data after the status mask
          if (dtcData && dtcData.length >= 6) {
            // For subfunction 02, DTCs include status bytes
            const dtcDetails = extractDTCsWithStatus(dtcData)
            if (dtcDetails.length > 0) {
              extractedData.dtcDetails = dtcDetails
              extractedData.dtcs = dtcDetails.map(d => d.code)
            }
          }
        }
        break;

      case '14': // Report DTC fault detection counter
        // This has a different format and should be handled separately
        if (responseData !== 'FF' && responseData !== '7F' && responseData.length >= 6) {
          const dtcs = extractDTCs(responseData)
          if (dtcs.length > 0) {
            extractedData.dtcs = dtcs
          }
        }
        break;

      case '03': // Report DTC snapshot identification
        // Contains DTC codes with snapshot availability
        if (responseData.length >= 6) {
          const dtcDetails = extractDTCsWithStatus(responseData)
          if (dtcDetails.length > 0) {
            extractedData.dtcDetails = dtcDetails
            extractedData.dtcs = dtcDetails.map(d => d.code)
          }
        }
        break;

      case '04': // Report DTC snapshot record by DTC number
      case '05': // Report DTC snapshot record by record number
        // Contains snapshot data for specific DTCs
        if (responseData.length >= 8) {
          const snapshotData = extractSnapshotData(responseData)
          if (snapshotData) {
            extractedData.snapshotData = snapshotData
          }
        }
        break;

      case '06': // Report DTC extended data record by DTC number
      case '09': // Report severity information of DTC
        // Contains extended data for specific DTCs
        if (responseData.length >= 8) {
          const extendedData = extractExtendedData(responseData)
          if (extendedData) {
            extractedData.extendedData = extendedData
          }
        }
        break;
    }
  }

  return extractedData
}

function hexToAscii(hex: string): string {
  try {
    let result = ''
    for (let i = 0; i < hex.length; i += 2) {
      const charCode = parseInt(hex.substr(i, 2), 16)
      if (charCode >= 32 && charCode <= 126) {
        result += String.fromCharCode(charCode)
      }
    }
    return result.trim()
  } catch {
    return ''
  }
}

function isValidPartNumber(str: string): boolean {
  return str.length >= 5 && /^[A-Z0-9\-\.]+$/i.test(str)
}

function getSessionTypeName(sessionCode: string): string {
  const sessionTypes: Record<string, string> = {
    '01': 'Default Session',
    '02': 'Programming Session',
    '03': 'Extended Diagnostic Session',
    '40': 'Passive Diagnostic Session'
  }
  return sessionTypes[sessionCode] || `Session 0x${sessionCode}`
}

function getSecurityLevelName(levelCode: string): string {
  const securityLevels: Record<string, string> = {
    '01': 'Level 1 (Seed Request)',
    '02': 'Level 1 (Key Response)',
    '03': 'Level 2 (Seed Request)',
    '04': 'Level 2 (Key Response)'
  }
  return securityLevels[levelCode] || `Level 0x${levelCode}`
}

function extractDTCs(data: string): string[] {
  const dtcs: string[] = []
  // Polestar/UDS format: Each DTC record is 4 bytes (8 hex chars)
  // - Bytes 0-2: DTC code including status (3 bytes = 6 hex chars)
  // - Byte 3: Additional status mask (1 byte = 2 hex chars)
  for (let i = 0; i <= data.length - 8; i += 8) {
    const dtcRecord = data.substring(i, i + 8)
    if (dtcRecord.length === 8) {
      const dtcCode = dtcRecord.substring(0, 6) // Extract 3-byte DTC code (includes status)
      const dtc = formatDTC(dtcCode)
      if (dtc) dtcs.push(dtc)
    }
  }
  return dtcs
}

function extractDTCsWithStatus(data: string): DTCInfo[] {
  const dtcInfos: DTCInfo[] = []

  // Polestar/UDS format for DTC responses (subfunction 0x03):
  // The DTC code includes the status as its third byte
  // Format: [2-byte DTC][1-byte status][1-byte additional status]
  // Example: EF1882 20 = DTC EF1882 with additional status 20
  // Example: C16800 20 C14000 20 = Two DTCs with their additional status bytes

  let i = 0
  while (i <= data.length - 8) {
    // Extract 3-byte DTC code (6 hex chars) which includes status as 3rd byte
    const dtcWithStatus = data.substring(i, i + 6)

    // Extract the additional status byte that follows (2 hex chars)
    const additionalStatus = data.substring(i + 6, i + 8)

    const dtc = formatDTC(dtcWithStatus)
    if (dtc) {
      dtcInfos.push({
        code: dtc,
        statusByte: additionalStatus,
        status: decodeDTCStatus(additionalStatus)
      })
    }

    i += 8 // Move to the next DTC record (6 + 2 = 8 chars)
  }

  return dtcInfos
}

function decodeDTCStatus(statusByte: string): string {
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

  return statusBits.length > 0 ? statusBits.join(', ') : 'No Status Flags Set'
}

function extractSnapshotData(data: string): any {
  // Format: [DTC - 3 bytes][Record Number - 1 byte][Data...]
  if (data.length < 8) return null

  const dtcCode = formatDTC(data.substring(0, 4))
  const statusByte = data.substring(4, 6)
  const recordNumber = data.substring(6, 8)
  const snapshotData = data.substring(8)

  return {
    dtcCode,
    statusByte,
    recordNumber,
    data: snapshotData
  }
}

function extractExtendedData(data: string): any {
  // Format: [DTC - 3 bytes][Record Number - 1 byte][Data...]
  if (data.length < 8) return null

  const dtcCode = formatDTC(data.substring(0, 4))
  const statusByte = data.substring(4, 6)
  const recordNumber = data.substring(6, 8)
  const extendedData = data.substring(8)

  return {
    dtcCode,
    statusByte,
    recordNumber,
    data: extendedData
  }
}

function formatDTC(dtcBytes: string): string | null {
  try {
    // DTCs in UDS are 3 bytes (6 hex chars) for the complete code
    // Some systems may use 2 bytes (4 hex chars)
    if (dtcBytes.length !== 4 && dtcBytes.length !== 6) return null

    // For 3-byte DTCs (most common in trace files)
    if (dtcBytes.length === 6) {
      const byte1 = parseInt(dtcBytes.substring(0, 2), 16)
      const byte2 = parseInt(dtcBytes.substring(2, 4), 16)
      const byte3 = parseInt(dtcBytes.substring(4, 6), 16)

      // Skip if all bytes are 0x00 or 0xFF (no DTC)
      if ((byte1 === 0x00 && byte2 === 0x00 && byte3 === 0x00) ||
          (byte1 === 0xFF && byte2 === 0xFF && byte3 === 0xFF)) {
        return null
      }

      // Return the full 3-byte hex code (e.g., EF1882, C16800, C14000)
      return dtcBytes.toUpperCase()
    }

    // For 2-byte DTCs (legacy or simplified format)
    const firstByte = parseInt(dtcBytes.substring(0, 2), 16)
    const secondByte = parseInt(dtcBytes.substring(2, 4), 16)

    // Skip if both bytes are 0x00 or 0xFF (no DTC)
    if ((firstByte === 0x00 && secondByte === 0x00) ||
        (firstByte === 0xFF && secondByte === 0xFF)) {
      return null
    }

    // Return as hex code
    return dtcBytes.toUpperCase()
  } catch {
    return null
  }
}

export function parseDoipTrace(content: string): ParsedTraceData {
  const lines = content.split('\n').filter(line => line.trim())
  const messages: DoipTraceMessage[] = []
  const ecus = new Map<string, EcuInfo>()
  const services = new Map<string, ServiceInfo>()
  const procedures: DiagnosticProcedure[] = []
  const ecuDiagnostics = new Map<string, EcuDiagnosticSummary>()

  let firstTimestamp: Date | undefined
  let lastTimestamp: Date | undefined

  // First pass: parse all messages
  for (const line of lines) {
    const message = parseLine(line)
    if (!message) continue

    messages.push(message)

    if (message.timestamp) {
      const timestamp = parseTimestamp(message.timestamp)
      if (!firstTimestamp || timestamp < firstTimestamp) {
        firstTimestamp = timestamp
      }
      if (!lastTimestamp || timestamp > lastTimestamp) {
        lastTimestamp = timestamp
      }
    }

    if (message.sourceAddr && message.targetAddr) {
      updateEcuInfo(ecus, message.sourceAddr, message.direction === 'Local->Remote', message.timestamp)
      updateEcuInfo(ecus, message.targetAddr, message.direction === 'Remote->Local', message.timestamp)

      if (message.data) {
        const serviceCode = message.data.substring(0, 2).toUpperCase()
        updateServiceInfo(services, serviceCode, message.direction === 'Local->Remote')
      }
    }
  }

  // Second pass: group messages into diagnostic procedures
  const procedureMap = new Map<string, DiagnosticProcedure>()

  // Track whether any routines have been executed per ECU
  const ecuRoutinesExecuted = new Map<string, boolean>()

  for (const message of messages) {
    if (!message.data || !message.sourceAddr || !message.targetAddr) continue

    const serviceCode = message.data.substring(0, 2).toUpperCase()
    const procedureType = getProcedureType(serviceCode)

    if (!procedureType) continue

    // Determine the actual ECU address based on message direction
    // For requests (Local->Remote), the ECU is the target
    // For responses (Remote->Local), the ECU is the source
    const isRequest = message.direction === 'Local->Remote'
    const ecuAddress = isRequest ? message.targetAddr : message.sourceAddr

    // Create procedure key: ECU address + procedure type + rough time grouping
    const timestamp = parseTimestamp(message.timestamp)
    const timeGroup = Math.floor(timestamp.getTime() / 10000) // Group by 10-second windows
    const procedureKey = `${ecuAddress}-${procedureType}-${timeGroup}`

    let procedure = procedureMap.get(procedureKey)

    if (!procedure) {
      procedure = {
        id: `proc-${procedures.length + 1}`,
        ecuAddress: ecuAddress,
        procedureType,
        procedureName: getProcedureName(serviceCode),
        startTime: timestamp,
        endTime: timestamp,
        status: 'started',
        messages: [],
        requestCount: 0,
        responseCount: 0,
        errorCount: 0,
        extractedData: {}
      }
      procedureMap.set(procedureKey, procedure)
      procedures.push(procedure)
    }

    // Update procedure with message
    procedure.messages.push(message)
    procedure.endTime = timestamp

    // Count message types
    if (serviceCode === '7F') {
      procedure.errorCount++
      procedure.status = 'failed'
    } else if (message.direction === 'Local->Remote') {
      procedure.requestCount++
    } else {
      procedure.responseCount++
      if (procedure.status === 'started') {
        procedure.status = 'completed'
      }
    }

    // Track when routines are executed for this ECU
    if (procedureType === 'routine_control' && message.direction === 'Remote->Local') {
      ecuRoutinesExecuted.set(ecuAddress, true)
    }

    // Extract meaningful data from the message
    const extractedData = extractDataFromMessage(message)
    if (Object.keys(extractedData).length > 0) {
      procedure.extractedData = mergeExtractedData(procedure.extractedData || {}, extractedData)

      // Set DTC phase based on whether routines have been executed for this ECU
      if (extractedData.dtcs && extractedData.dtcs.length > 0 && procedureType === 'dtc_management') {
        procedure.extractedData!.dtcPhase = ecuRoutinesExecuted.has(ecuAddress) && ecuRoutinesExecuted.get(ecuAddress)
          ? 'post-scan'
          : 'pre-scan'
      }
    }
  }

  // Third pass: create ECU diagnostic summaries
  for (const [ecuAddress, ecuInfo] of ecus.entries()) {
    const ecuProcedures = procedures.filter(p => p.ecuAddress === ecuAddress)

    const successfulProcedures = ecuProcedures.filter(p => p.status === 'completed').length
    const failedProcedures = ecuProcedures.filter(p => p.status === 'failed').length

    const dataIdentifiersRead = ecuProcedures
      .filter(p => p.procedureType === 'data_reading')
      .reduce((count, p) => count + Object.keys(p.extractedData?.dataIdentifiers || {}).length, 0)

    const dtcsFound = ecuProcedures
      .reduce((count, p) => count + (p.extractedData?.dtcs?.length || 0), 0)

    const routinesExecuted = ecuProcedures.filter(p => p.procedureType === 'routine_control').length
    const securityAccess = ecuProcedures.some(p => p.procedureType === 'security_access' && p.status === 'completed')

    ecuDiagnostics.set(ecuAddress, {
      address: ecuAddress,
      name: ecuInfo.name,
      procedures: ecuProcedures,
      totalProcedures: ecuProcedures.length,
      successfulProcedures,
      failedProcedures,
      dataIdentifiersRead,
      dtcsFound,
      routinesExecuted,
      securityAccess,
      lastActivity: ecuInfo.lastSeen
    })
  }

  const duration = firstTimestamp && lastTimestamp
    ? lastTimestamp.getTime() - firstTimestamp.getTime()
    : undefined

  const totalSuccessfulProcedures = procedures.filter(p => p.status === 'completed').length
  const totalFailedProcedures = procedures.filter(p => p.status === 'failed').length

  return {
    messages,
    ecus,
    services,
    procedures,
    ecuDiagnostics,
    metadata: {
      startTime: firstTimestamp,
      endTime: lastTimestamp,
      duration,
      messageCount: messages.length,
      ecuCount: ecus.size,
      totalProcedures: procedures.length,
      successfulProcedures: totalSuccessfulProcedures,
      failedProcedures: totalFailedProcedures
    }
  }
}

function mergeExtractedData(existing: any, newData: any): any {
  const merged = { ...existing }

  if (newData.dataIdentifiers) {
    merged.dataIdentifiers = { ...merged.dataIdentifiers, ...newData.dataIdentifiers }
  }

  if (newData.partNumbers) {
    merged.partNumbers = [...(merged.partNumbers || []), ...newData.partNumbers]
  }

  if (newData.dtcs) {
    merged.dtcs = [...(merged.dtcs || []), ...newData.dtcs]
  }

  if (newData.dtcDetails) {
    merged.dtcDetails = [...(merged.dtcDetails || []), ...newData.dtcDetails]
  }

  if (newData.snapshotData) {
    // Merge snapshot data with existing DTC details if available
    if (merged.dtcDetails) {
      const dtcCode = newData.snapshotData.dtcCode
      const dtcDetail = merged.dtcDetails.find(d => d.code === dtcCode)
      if (dtcDetail) {
        dtcDetail.snapshotData = dtcDetail.snapshotData || []
        dtcDetail.snapshotData.push({
          recordNumber: newData.snapshotData.recordNumber,
          data: newData.snapshotData.data
        })
      }
    }
  }

  if (newData.extendedData) {
    // Merge extended data with existing DTC details if available
    if (merged.dtcDetails) {
      const dtcCode = newData.extendedData.dtcCode
      const dtcDetail = merged.dtcDetails.find(d => d.code === dtcCode)
      if (dtcDetail) {
        dtcDetail.extendedData = dtcDetail.extendedData || []
        dtcDetail.extendedData.push({
          recordNumber: newData.extendedData.recordNumber,
          data: newData.extendedData.data
        })
      }
    }
  }

  if (newData.routineResults) {
    merged.routineResults = [...(merged.routineResults || []), ...newData.routineResults]
  }

  if (newData.sessionType) {
    merged.sessionType = newData.sessionType
  }

  if (newData.securityLevel) {
    merged.securityLevel = newData.securityLevel
  }

  return merged
}

function parseLine(line: string): DoipTraceMessage | null {
  // First decode HTML entities
  const decodedLine = line
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .trim()

  if (!decodedLine) return null

  // Check if line has line number prefix (from cat -n output)
  let content = decodedLine
  let lineNumber = 0

  const lineNumMatch = decodedLine.match(/^(\d+)→(.*)$/)
  if (lineNumMatch) {
    lineNumber = parseInt(lineNumMatch[1])
    content = lineNumMatch[2].trim()
  }

  // Parse DOIP message: HH:MM:SS.mmm | [Direction]>[Direction] DOIP => [target] source[addr] target[addr] data[hex]
  const doipMatch = content.match(
    /^([\d:\.]+)\s*\|\s*\[([^\]]+)\]->\[([^\]]+)\]\s+(\w+)\s*=>\s*(?:\[(\w+)\])?\s*(?:source\[([^\]]+)\])?\s*(?:target\[([^\]]+)\])?\s*(?:data\[([^\]]*)\])?/
  )

  if (doipMatch) {
    return {
      lineNumber,
      timestamp: doipMatch[1],
      direction: `${doipMatch[2]}->${doipMatch[3]}` as any,
      protocol: doipMatch[4],
      messageId: doipMatch[5],
      sourceAddr: doipMatch[6],
      targetAddr: doipMatch[7],
      data: doipMatch[8] || ''
    }
  }

  // Parse metadata messages
  const metadataMatch = content.match(
    /^([\d:\.]+)\s*\|\s*\[([^\]]+)\]->\[([^\]]+)\]\s+(\w+)\s*=>\s*key\[([^\]]+)\]\s*value\[([^\]]+)\]/
  )

  if (metadataMatch) {
    return {
      lineNumber,
      timestamp: metadataMatch[1],
      direction: `${metadataMatch[2]}->${metadataMatch[3]}` as any,
      protocol: metadataMatch[4],
      metadata: {
        key: metadataMatch[5],
        value: metadataMatch[6]
      }
    }
  }

  return null
}

export function parseTimestamp(timestamp: string): Date {
  // Handle timestamp format HH:MM:SS.mmm
  const [time, ms] = timestamp.split('.')
  const [hours, minutes, seconds] = time.split(':').map(Number)

  // Create a date object with today's date and the given time
  const date = new Date()
  date.setHours(hours || 0, minutes || 0, seconds || 0, parseInt(ms) || 0)

  // Validate the date
  if (isNaN(date.getTime())) {
    // If invalid, return current date as fallback
    return new Date()
  }

  return date
}

function updateEcuInfo(
  ecus: Map<string, EcuInfo>,
  address: string,
  isSending: boolean,
  timestamp: string
) {
  const existing = ecus.get(address) || {
    address,
    name: ECU_ADDRESSES[address],
    messagesSent: 0,
    messagesReceived: 0
  }

  if (isSending) {
    existing.messagesSent++
  } else {
    existing.messagesReceived++
  }

  const ts = parseTimestamp(timestamp)
  if (!existing.firstSeen || ts < existing.firstSeen) {
    existing.firstSeen = ts
  }
  if (!existing.lastSeen || ts > existing.lastSeen) {
    existing.lastSeen = ts
  }

  ecus.set(address, existing)
}

function updateServiceInfo(
  services: Map<string, ServiceInfo>,
  serviceCode: string,
  isRequest: boolean
) {
  const serviceName = SERVICE_CODES[serviceCode] || `Unknown_${serviceCode}`
  const existing = services.get(serviceCode) || {
    serviceId: serviceCode,
    serviceName,
    requestCount: 0,
    responseCount: 0,
    errorCount: 0
  }

  if (isRequest) {
    existing.requestCount++
  } else if (serviceCode === '7F') {
    existing.errorCount++
  } else {
    existing.responseCount++
  }

  services.set(serviceCode, existing)
}

export function generateFlowDiagram(parsedData: ParsedTraceData) {
  const nodes: any[] = []
  const edges: any[] = []

  // Separate ECUs by type for better positioning
  const ecuArray = Array.from(parsedData.ecus.entries())
  const testers: any[] = []
  const gateways: any[] = []
  const regularEcus: any[] = []

  ecuArray.forEach(([address, ecu]) => {
    const isTester = address === '0E80' || ecu.name?.includes('Tester')
    const isGateway = address === 'FFFFE400' || ecu.name?.includes('Gateway')

    const ecuData = { address, ecu, isTester, isGateway }

    if (isTester) testers.push(ecuData)
    else if (isGateway) gateways.push(ecuData)
    else regularEcus.push(ecuData)
  })

  // Position testers at the top
  testers.forEach((ecuData, index) => {
    nodes.push({
      id: ecuData.address,
      type: 'ecuNode',
      position: { x: index * 350 + 100, y: 50 },
      data: {
        label: ecuData.ecu.name || ecuData.address,
        address: ecuData.address,
        messagesSent: ecuData.ecu.messagesSent,
        messagesReceived: ecuData.ecu.messagesReceived,
        isTester: ecuData.isTester,
        isGateway: ecuData.isGateway
      }
    })
  })

  // Position gateways in the middle
  gateways.forEach((ecuData, index) => {
    nodes.push({
      id: ecuData.address,
      type: 'ecuNode',
      position: { x: index * 350 + 200, y: 300 },
      data: {
        label: ecuData.ecu.name || ecuData.address,
        address: ecuData.address,
        messagesSent: ecuData.ecu.messagesSent,
        messagesReceived: ecuData.ecu.messagesReceived,
        isTester: ecuData.isTester,
        isGateway: ecuData.isGateway
      }
    })
  })

  // Position regular ECUs in a grid at the bottom
  const columns = Math.ceil(Math.sqrt(regularEcus.length))
  const rowHeight = 220
  const columnWidth = 350

  regularEcus.forEach((ecuData, index) => {
    const row = Math.floor(index / columns)
    const col = index % columns
    const position = {
      x: col * columnWidth + 100,
      y: row * rowHeight + 550
    }

    nodes.push({
      id: ecuData.address,
      type: 'ecuNode',
      position,
      data: {
        label: ecuData.ecu.name || ecuData.address,
        address: ecuData.address,
        messagesSent: ecuData.ecu.messagesSent,
        messagesReceived: ecuData.ecu.messagesReceived,
        isTester: ecuData.isTester,
        isGateway: ecuData.isGateway
      }
    })
  })

  // Group messages by source-target-service to aggregate counts
  const edgeMap = new Map<string, {
    serviceCode: string
    serviceName: string
    count: number
    direction: string
  }>()

  parsedData.messages.forEach((message) => {
    if (message.sourceAddr && message.targetAddr && message.data) {
      const serviceCode = message.data.substring(0, 2).toUpperCase()
      const serviceName = SERVICE_CODES[serviceCode] || `Service ${serviceCode}`
      const edgeKey = `${message.sourceAddr}-${message.targetAddr}-${serviceCode}`

      const existing = edgeMap.get(edgeKey)
      if (existing) {
        existing.count++
      } else {
        edgeMap.set(edgeKey, {
          serviceCode,
          serviceName,
          count: 1,
          direction: message.direction
        })
      }
    }
  })

  // Create edges from aggregated data
  let edgeIndex = 0
  edgeMap.forEach((data, key) => {
    const [source, target, serviceCode] = key.split('-')

    edges.push({
      id: `edge-${edgeIndex++}`,
      source,
      target,
      type: 'serviceEdge',
      data: {
        serviceCode: data.serviceCode,
        serviceName: data.serviceName,
        count: data.count
      },
      animated: data.direction === 'Local->Remote',
      style: {
        stroke: data.direction === 'Local->Remote' ? '#3b82f6' : '#10b981',
        strokeWidth: Math.min(1 + data.count * 0.5, 4)
      },
      markerEnd: {
        type: 'arrowclosed',
        color: data.direction === 'Local->Remote' ? '#3b82f6' : '#10b981',
      }
    })
  })

  return { nodes, edges }
}

export function generateSequentialFlowDiagram(parsedData: ParsedTraceData) {
  const nodes: any[] = []
  const edges: any[] = []

  // Take first 50 messages for the sequence diagram to avoid clutter
  const sequenceMessages = parsedData.messages.slice(0, 50)

  let yPosition = 100
  const xSpacing = 300
  const ySpacing = 650

  sequenceMessages.forEach((message, index) => {
    if (!message.data || !message.sourceAddr || !message.targetAddr) return

    const serviceCode = message.data.substring(0, 2).toUpperCase()
    const serviceName = SERVICE_CODES[serviceCode] || `Service ${serviceCode}`

    // Create a sequence step node
    nodes.push({
      id: `step-${index}`,
      type: 'sequenceNode',
      position: { x: 100, y: yPosition },
      data: {
        stepNumber: index + 1,
        serviceName,
        serviceCode,
        direction: message.direction,
        sourceAddr: message.sourceAddr,
        targetAddr: message.targetAddr,
        timestamp: message.timestamp,
        data: message.data
      }
    })

    // Connect steps with arrows
    if (index > 0) {
      edges.push({
        id: `sequence-${index}`,
        source: `step-${index - 1}`,
        target: `step-${index}`,
        type: 'sequenceEdge',
        animated: true,
        style: { stroke: '#64748b', strokeWidth: 2 }
      })
    }

    yPosition += ySpacing
  })

  return { nodes, edges }
}