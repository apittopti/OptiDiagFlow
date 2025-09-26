// All types are now defined in this file - single parser for all Jifeline trace files

// Core message types
export interface DoipTraceMessage {
  lineNumber: number
  timestamp: string
  direction: 'Local->Remote' | 'Remote->Local' | 'Server->Tracer'
  protocol: string
  diagnosticProtocol?: 'OBD-II' | 'UDS' | 'KWP2000' // Indicates diagnostic protocol: OBD-II, UDS, or KWP2000
  messageId?: string
  sourceAddr?: string
  targetAddr?: string
  data?: string
  metadata?: {
    key: string
    value: string
    module?: string
    canId?: string
    args?: string[]
  }
}

export interface DTCInfo {
  code: string
  status: string
  statusByte: string
  rawHex?: string  // Original hex bytes before conversion to P/B/U code
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
    dtcs?: string[]
    dtcDetails?: DTCInfo[]
    dtcPhase?: 'pre-scan' | 'post-scan'
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
    protocol?: string
    probableOEM?: string
    startTime?: Date
    endTime?: Date
    duration?: number
    messageCount: number
    ecuCount: number
    totalProcedures: number
    successfulProcedures: number
    failedProcedures: number
    procedureCount?: number
    discoveries?: any
    // Jifeline metadata
    metadataMessages?: DoipTraceMessage[]
    vehicleVoltage?: Array<{ timestamp: string; voltage: number }>
    connectionInfo?: Record<string, any>
    connectorMetrics?: Record<string, any>
    ecuChannels?: Array<{
      name: string
      protocol: string
      pins?: string
      addresses?: string
      status?: string
      timestamp?: string
    }>
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

// Compatibility alias for legacy code
export type DoipTraceData = ParsedTraceData

export interface JifelineMessage {
  lineNumber: number
  timestamp: string
  direction: 'Local->Remote' | 'Remote->Local' | 'Server->Tracer'
  module: string // e.g., CAN2, DoIP
  protocol: string // e.g., HONDA ISOTP, DoIP
  command: string // e.g., 0x5000
  args: string[] // e.g., [0x18DAB0F1, 0x00, 0x00, 0x00]
  data: string
  metadata?: {
    key: string
    value: string
  }
}

export interface DiscoveredECU {
  address: string
  name: string // Guessed or discovered name
  protocol: string
  discoveredServices: Set<string>
  discoveredDIDs: Map<string, DIDInfo>
  discoveredDTCs: Map<string, DTCInfo>
  discoveredRoutines: Map<string, RoutineInfo>
  sessionTypes: Set<string>
  securityLevels: Set<string>
  messageCount: number
  firstSeen: Date
  lastSeen: Date
}

export interface DIDInfo {
  did: string
  name?: string // Guessed based on common DIDs
  dataLength: number
  sampleValues: string[]
  dataType?: string // Guessed type (ASCII, numeric, binary)
  unit?: string
  scaling?: number
}

export interface RoutineInfo {
  routineId: string
  name?: string
  controlType: string // start, stop, requestResults
  inputData?: string
  outputData?: string[]
  status: string[]
}

export class JifelineParser {
  private ecus: Map<string, DiscoveredECU> = new Map()
  private currentTime: Date = new Date()

  // Common DID definitions for reverse engineering
  private readonly COMMON_DIDS: Map<string, { name: string; type: string }> = new Map([
    ['F186', { name: 'Active Diagnostic Session', type: 'session' }],
    ['F187', { name: 'Manufacturer Spare Part Number', type: 'ascii' }],
    ['F188', { name: 'Manufacturer ECU Software Number', type: 'ascii' }],
    ['F189', { name: 'Manufacturer ECU Software Version', type: 'ascii' }],
    ['F18A', { name: 'System Supplier Specific', type: 'hex' }],
    ['F18C', { name: 'ECU Serial Number', type: 'ascii' }],
    ['F190', { name: 'VIN', type: 'ascii' }],
    ['F191', { name: 'Vehicle Manufacturer ECU Hardware Number', type: 'ascii' }],
    ['F192', { name: 'System Supplier ECU Hardware Number', type: 'ascii' }],
    ['F193', { name: 'System Supplier ECU Hardware Version', type: 'ascii' }],
    ['F194', { name: 'System Supplier ECU Software Number', type: 'ascii' }],
    ['F195', { name: 'System Supplier ECU Software Version', type: 'ascii' }],
    ['F197', { name: 'System Name or Engine Type', type: 'ascii' }],
    ['F198', { name: 'Repair Shop Code', type: 'ascii' }],
    ['F199', { name: 'Programming Date', type: 'date' }],
    ['F19D', { name: 'Calibration Repair Shop Code', type: 'ascii' }],
    ['F19E', { name: 'Calibration Equipment Software Number', type: 'ascii' }],
    ['F1A0', { name: 'Vehicle Manufacturer ECU Boot Software Number', type: 'ascii' }],
    ['F1A1', { name: 'Vehicle Manufacturer ECU Boot Software Version', type: 'ascii' }],
    ['F1A2', { name: 'Vehicle Speed', type: 'numeric' }],
    ['F1A3', { name: 'Engine Speed', type: 'numeric' }],
    ['F1A4', { name: 'Engine Coolant Temperature', type: 'numeric' }],
    ['F1F0', { name: 'Vehicle Speed', type: 'numeric' }],
    ['F1F1', { name: 'Steering Angle', type: 'numeric' }],
    ['F1F2', { name: 'Yaw Rate', type: 'numeric' }],
    ['F1F3', { name: 'Lateral Acceleration', type: 'numeric' }],
    ['F1F4', { name: 'Longitudinal Acceleration', type: 'numeric' }],
    // Honda specific DIDs
    ['DD0A', { name: 'Honda Camera Calibration Status', type: 'binary' }],
    ['DD0B', { name: 'Honda Camera Version', type: 'ascii' }],
    // Common manufacturer specific ranges
    ['D100', { name: 'Manufacturer Specific Data', type: 'binary' }],
    ['D101', { name: 'Manufacturer Specific Data', type: 'binary' }],
    ['D102', { name: 'Manufacturer Specific Data', type: 'binary' }]
  ])

  // ECU address range mappings
  private readonly ECU_ADDRESS_PATTERNS = new Map([
    [0x0700, { range: [0x0700, 0x070F], category: 'Powertrain', names: ['Engine', 'TCM', 'PCM', 'ECM'] }],
    [0x0710, { range: [0x0710, 0x071F], category: 'Body/Comfort', names: ['BCM', 'Door', 'Seat', 'Window'] }],
    [0x0720, { range: [0x0720, 0x072F], category: 'Chassis', names: ['ABS', 'ESP', 'Steering', 'Suspension'] }],
    [0x0730, { range: [0x0730, 0x073F], category: 'Safety/ADAS', names: ['Airbag', 'Camera', 'Radar', 'ADAS'] }],
    [0x0740, { range: [0x0740, 0x074F], category: 'Infotainment', names: ['Radio', 'Navigation', 'Display', 'HMI'] }],
    [0x0750, { range: [0x0750, 0x075F], category: 'Gateway', names: ['Gateway', 'Router', 'Network'] }],
    [0x0760, { range: [0x0760, 0x076F], category: 'Hybrid/Electric', names: ['Battery', 'Inverter', 'Charger', 'BMS'] }],
    [0x0770, { range: [0x0770, 0x077F], category: 'Diagnostics', names: ['OBD', 'Diagnostic', 'Test'] }],
    [0x07B0, { range: [0x07B0, 0x07BF], category: 'ADAS/Camera', names: ['Camera', 'Vision', 'ADAS Controller'] }],
    [0x07E0, { range: [0x07E0, 0x07EF], category: 'OBD/Engine', names: ['Engine', 'OBD', 'ECM'] }],
    [0x07F0, { range: [0x07F0, 0x07FF], category: 'Tester', names: ['Tester', 'Tool', 'Diagnostic'] }]
  ])

  private decodeHtmlEntities(text: string): string {
    if (!text || typeof text !== 'string') {
      console.warn('decodeHtmlEntities received invalid input:', text)
      return ''
    }
    return text
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  parseTrace(content: string): DoipTraceData {
    // Decode HTML entities first
    const decodedContent = this.decodeHtmlEntities(content);
    const lines = decodedContent.split('\n')
    const messages: DoipTraceMessage[] = []
    const procedures: DiagnosticProcedure[] = []
    let currentProcedure: DiagnosticProcedure | null = null

    // Metadata collection
    const metadataMessages: DoipTraceMessage[] = []
    const vehicleVoltage: Array<{ timestamp: string; voltage: number }> = []
    const connectionInfo: Record<string, any> = {}
    const connectorMetrics: Record<string, any> = {}
    const ecuChannels: Array<any> = []

    for (const line of lines) {
      const message = this.parseJifelineLine(line)
      if (!message) continue

      // Collect metadata messages separately
      if (message.direction === 'Server->Tracer' && message.metadata) {
        metadataMessages.push(message)

        // Extract specific metadata
        const { key, value } = message.metadata

        // Extract voltage
        if (key === 'vehicle:info:voltage' && value) {
          const voltage = parseFloat(value)
          if (!isNaN(voltage)) {
            vehicleVoltage.push({ timestamp: message.timestamp, voltage })
          }
        }

        // Extract connection info
        if (key.startsWith('connection:')) {
          const subKey = key.replace('connection:', '').replace(/:/g, '_')
          connectionInfo[subKey] = value
        }

        // Extract connector metrics
        if (key.startsWith('connectors:')) {
          const parts = key.split(':')
          if (parts.length >= 3) {
            const connectorId = parts[1]
            const metricType = parts.slice(2).join('_')
            if (!connectorMetrics[connectorId]) {
              connectorMetrics[connectorId] = {}
            }
            connectorMetrics[connectorId][metricType] = value
          }
        }

        // Extract ECU channel info
        if (key.startsWith('ecu:channel:')) {
          const parts = key.split(':')
          if (parts.length >= 4) {
            const channelInfo = {
              name: parts.slice(2, -1).join(':'),
              protocol: parts[2] || 'unknown',
              timestamp: message.timestamp
            }

            // Parse additional info from the key
            if (parts[3].includes('-')) {
              const subParts = parts[3].split('-')
              if (subParts.length >= 4) {
                channelInfo['pins'] = `${subParts[0]}-${subParts[1]}`
                channelInfo['addresses'] = `${subParts[2]}-${subParts[3]}`
              }
            }

            // Get status from last part
            const lastPart = parts[parts.length - 1]
            if (lastPart === 'since' || lastPart === 'until') {
              channelInfo['status'] = lastPart
            }

            ecuChannels.push(channelInfo)
          }
        }

        continue // Skip adding to UDS Flow
      }

      // Track ECUs (only for messages with actual data)
      if (message.data && message.data.trim().length > 0) {
        this.trackECU(message)
      }

      // Convert to unified message format for all protocols
      const unifiedMsg = this.toUnifiedMessage(message)

      // Only add messages with valid UDS data to the flow
      if (unifiedMsg.data && unifiedMsg.data.trim().length > 0) {
        messages.push(unifiedMsg)
      }

      // Track procedures
      const newProcedure = this.detectProcedure(unifiedMsg)
      if (newProcedure) {
        if (currentProcedure) {
          currentProcedure.endTime = this.currentTime
          currentProcedure.status = 'completed'
          procedures.push(currentProcedure)
        }
        currentProcedure = newProcedure
      }

      if (currentProcedure) {
        currentProcedure.messages.push(unifiedMsg)
        this.updateProcedureData(currentProcedure, unifiedMsg)
      }
    }

    // Close last procedure
    if (currentProcedure) {
      currentProcedure.endTime = this.currentTime
      currentProcedure.status = 'completed'
      procedures.push(currentProcedure)
    }

    // Generate summary of discoveries
    const ecuSummary = this.generateECUSummary()

    // Detect protocol and probable OEM
    const detectedProtocol = this.detectProtocol(messages)
    const probableOEM = this.detectProbableOEM(detectedProtocol, messages)

    const startTime = messages[0] ? this.parseTime(messages[0].timestamp) : this.currentTime
    const endTime = messages[messages.length - 1] ? this.parseTime(messages[messages.length - 1].timestamp) : this.currentTime
    const duration = endTime.getTime() - startTime.getTime()

    return {
      messages,
      procedures,
      metadata: {
        protocol: detectedProtocol,
        probableOEM,
        startTime,
        endTime,
        duration,
        messageCount: messages.length,
        procedureCount: procedures.length,
        ecuCount: this.ecus.size,
        discoveries: ecuSummary,
        // Include Jifeline metadata
        metadataMessages,
        vehicleVoltage: vehicleVoltage.length > 0 ? vehicleVoltage : undefined,
        connectionInfo: Object.keys(connectionInfo).length > 0 ? connectionInfo : undefined,
        connectorMetrics: Object.keys(connectorMetrics).length > 0 ? connectorMetrics : undefined,
        ecuChannels: ecuChannels.length > 0 ? ecuChannels : undefined
      }
    }
  }

  private parseJifelineLine(line: string): JifelineMessage | null {
    // Remove line numbers (if present)
    const cleanLine = line.replace(/^\s*\d+→\s*/, '').trim()
    if (!cleanLine) return null

    // Skip OVERLOAD lines
    if (cleanLine.includes('OVERLOAD:')) return null

    // Parse timestamp
    const timestampMatch = cleanLine.match(/^(\d{2}:\d{2}:\d{2}\.\d{3})\s*\|/)
    if (!timestampMatch) return null

    const timestamp = timestampMatch[1]
    const afterTimestamp = cleanLine.slice(timestampMatch[0].length).trim()

    // Parse direction
    const directionMatch = afterTimestamp.match(/^\[(Local|Remote|Server)\]->\[(Local|Remote|Tracer)\]/)
    if (!directionMatch) return null

    const direction = `${directionMatch[1]}->${directionMatch[2]}` as any
    const afterDirection = afterTimestamp.slice(directionMatch[0].length).trim()

    // Handle metadata messages
    if (direction === 'Server->Tracer' && afterDirection.startsWith('METADATA')) {
      const metaMatch = afterDirection.match(/METADATA\s*=>\s*key\[([^\]]+)\]\s*value\[([^\]]+)\]/)
      if (metaMatch) {
        return {
          lineNumber: 0,
          timestamp,
          direction,
          module: '',
          protocol: '',
          command: '',
          args: [],
          data: '',
          metadata: {
            key: metaMatch[1],
            value: metaMatch[2]
          }
        }
      }
    }

    // Parse DATA messages (CAN/ISOTP format)
    if (afterDirection.startsWith('DATA')) {
      // First try the standard format: mod[xxx] [protocol] cmd[xxx] args[xxx] data[xxx]
      const dataMatch = afterDirection.match(/DATA\s*=>\s*mod\[([^\]]+)\]\s*\[([^\]]+)\]\s*cmd\[([^\]]+)\]\s*args\[([^\]]+)\]\s*data\[([^\]]+)\]/)
      if (dataMatch) {
        return {
          lineNumber: 0,
          timestamp,
          direction,
          module: dataMatch[1],
          protocol: dataMatch[2],
          command: dataMatch[3],
          args: dataMatch[4].split(',').map(a => a.trim()),
          data: dataMatch[5]
        }
      }

      // Try Mercedes format: mod[CAN2] can_id[xxx] data[xxx]
      const mercedesMatch = afterDirection.match(/DATA\s*=>\s*mod\[([^\]]+)\]\s*can_id\[([^\]]+)\]\s*data\[([^\]]+)\]/)
      if (mercedesMatch) {
        const canId = mercedesMatch[2].toUpperCase()
        return {
          lineNumber: 0,
          timestamp,
          direction,
          module: mercedesMatch[1], // CAN2
          protocol: 'ISO-TP', // Mercedes uses ISO-TP
          command: canId,
          args: [canId], // Use CAN ID as argument
          data: mercedesMatch[3]
        }
      }
    }

    // Parse DoIP messages (different format)
    const doipMatch = afterDirection.match(/DOIP\s*=>\s*\[([^\]]+)\]\s*source\[([^\]]+)\]\s*target\[([^\]]+)\]\s*data\[([^\]]+)\]/)
    if (doipMatch) {
      return {
        lineNumber: 0,
        timestamp,
        direction,
        module: 'DoIP',
        protocol: 'DoIP',
        command: doipMatch[1], // Channel
        args: [doipMatch[2], doipMatch[3]], // source, target
        data: doipMatch[4]
      }
    }

    return null
  }

  private toUnifiedMessage(msg: JifelineMessage): DoipTraceMessage {
    // Extract addresses from args
    let sourceAddr = ''
    let targetAddr = ''

    if (msg.protocol === 'DoIP' && msg.args.length >= 2) {
      // DoIP format: args[0] is source, args[1] is target
      sourceAddr = msg.args[0]
      targetAddr = msg.args[1]
    } else if (msg.args.length > 0) {
      // CAN/ISOTP format
      const canId = msg.args[0].replace(/^0x/i, '').toUpperCase()
      if (canId.startsWith('18DA') || canId.startsWith('18DB')) {
        // Extended CAN ID format for Honda/Hyundai/Kia: 18DAttSS or 18DBttSS where tt is target, SS is source
        // Honda uses 18DA (e.g., 18DAB0F1)
        // Hyundai/Kia uses 18DB (e.g., 18DB33F1)
        // Examples:
        // - 0x18DAB0F1 (Local->Remote): target=B0, source=F1 (tester to ECU)
        // - 0x18DAF1B0 (Remote->Local): target=F1, source=B0 (ECU to tester)
        const target = canId.slice(4, 6) // Characters 4-5 (target address)
        const source = canId.slice(6, 8) // Characters 6-7 (source address)

        // Special case: 18DB33F1 is functional addressing (broadcast)
        if (canId === '18DB33F1') {
          // Map functional broadcast to OBD-II broadcast address
          sourceAddr = 'F1'     // Tester
          targetAddr = '07DF'   // OBD-II broadcast
        } else {
          // The CAN ID already contains the correct source and target
          // No need to swap based on direction
          sourceAddr = source
          targetAddr = target
        }
      } else if (canId.startsWith('07')) {
        // Standard OBD-II addressing for EOBD and HYUNDAI/KIA ISOTP
        if (msg.protocol === 'HYUNDAI/KIA ISOTP') {
          // For Hyundai/KIA, recognize paired addressing
          // Tester uses 07Cx, ECU responds on 07Cx+8
          // Example: Tester 07C4 <-> ECU 07CC
          if (msg.direction === 'Local->Remote') {
            // This is a request from tester (e.g., 07C4)
            // The ECU will be at this address + 8
            const testerAddr = parseInt(canId, 16)
            const ecuAddrNum = testerAddr + 8
            const ecuAddr = ecuAddrNum.toString(16).toUpperCase().padStart(4, '0')
            sourceAddr = 'TESTER'
            targetAddr = ecuAddr
          } else if (msg.direction === 'Remote->Local') {
            // This is a response from ECU (e.g., 07CC)
            sourceAddr = canId
            targetAddr = 'TESTER'
          }
        } else {
          // Standard EOBD addressing
          if (msg.direction === 'Local->Remote') {
            sourceAddr = 'TESTER'
            targetAddr = canId
          } else if (msg.direction === 'Remote->Local') {
            sourceAddr = canId
            targetAddr = 'TESTER'
          }
        }
      }
    } else if (msg.protocol === 'ISO14230') {
      // ISO14230 K-line protocol - no CAN addressing, use module names
      if (msg.module && msg.module.startsWith('K-line')) {
        // For K-line, we'll use a generic addressing scheme
        if (msg.direction === 'Local->Remote') {
          sourceAddr = 'TESTER'
          targetAddr = msg.module
        } else if (msg.direction === 'Remote->Local') {
          sourceAddr = msg.module
          targetAddr = 'TESTER'
        }
      }
    }

    // Keep addresses as they are in the trace file
    // The trace file already has the correct source and target

    // Determine the diagnostic protocol based on transport protocol and service ID
    let diagnosticProtocol: 'OBD-II' | 'UDS' | 'KWP2000' | undefined

    // Only EOBD explicitly uses OBD-II protocol
    // PLUGIN 56 should be determined by service IDs (usually UDS)
    if (msg.protocol === 'EOBD') {
      diagnosticProtocol = 'OBD-II'
    } else if (msg.protocol === 'ISO14230') {
      // ISO 14230 is KWP2000 (Keyword Protocol 2000), not UDS
      diagnosticProtocol = 'KWP2000'
    } else if (msg.protocol === 'DoIP' || msg.protocol === 'HONDA ISOTP' ||
               msg.protocol === 'HYUNDAI/KIA ISOTP' || msg.protocol === 'PLUGIN 56' ||
               msg.protocol === 'ISOTP VAG V2' || msg.protocol === 'FORD ISOTP' ||
               msg.protocol === 'TOYOTA ISOTP' || msg.protocol === 'RENAULT ISOTP' ||
               msg.protocol === 'MG ISOTP' || msg.protocol?.includes('ISOTP')) {
      // These protocols typically use UDS
      diagnosticProtocol = 'UDS'
    }
    // If protocol is undefined, empty, or "UNDEFINED", leave diagnosticProtocol as undefined

    // Additionally validate if service ID matches expected protocol
    if (msg.data) {
      // Remove any 0x prefix and get the service ID
      let cleanData = msg.data.trim().replace(/^0x/i, '')

      // Skip ISO-TP frame header if present (single frame 01-07)
      const firstByte = cleanData.substring(0, 2)
      if (['01', '02', '03', '04', '05', '06', '07'].includes(firstByte)) {
        cleanData = cleanData.substring(2)
      }

      const serviceId = cleanData.substring(0, 2).toUpperCase()

      // For EOBD, validate it's using OBD-II services
      if (msg.protocol === 'EOBD') {
        const obdiiServices = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '0A',
                              '41', '42', '43', '44', '45', '46', '47', '48', '49', '4A']
        // EOBD should always be OBD-II regardless of service
        diagnosticProtocol = 'OBD-II'
      }
    }

    return {
      lineNumber: msg.lineNumber,
      timestamp: msg.timestamp,
      direction: msg.direction,
      protocol: msg.protocol,
      diagnosticProtocol,
      messageId: msg.command,
      sourceAddr,
      targetAddr,
      data: msg.data || '',
      metadata: msg.metadata
    }
  }

  private trackECU(msg: JifelineMessage) {
    if (!msg.data || msg.direction === 'Server->Tracer') return

    // Extract ECU address (not the tester)
    let ecuAddr = ''
    if (msg.protocol === 'DoIP' && msg.args.length >= 2) {
      const source = msg.args[0].toUpperCase()
      const target = msg.args[1].toUpperCase()

      // Skip if tester address (0E80)
      if (msg.direction === 'Local->Remote') {
        // Tester is source, ECU is target
        if (source === '0E80' && target !== '0E80') {
          ecuAddr = target
        }
      } else if (msg.direction === 'Remote->Local') {
        // ECU is source, tester is target
        if (target === '0E80' && source !== '0E80') {
          ecuAddr = source
        }
      }
    } else if ((msg.direction === 'Local->Remote' || msg.direction === 'Remote->Local') && msg.args.length > 0) {
      // Handle CAN-based protocols (ISO-TP, EOBD, HYUNDAI/KIA ISOTP, etc)
      const canId = msg.args[0].replace(/^0x/i, '').toUpperCase()

      if (canId.startsWith('18DA') || canId.startsWith('18DB')) {
        // ISO-TP Extended addressing: 18DAttSS or 18DBttSS where tt=target, SS=source
        // 18DA = Physical addressing (to specific ECU)
        // 18DB = Functional addressing (broadcast to multiple ECUs)

        if (canId.startsWith('18DB')) {
          // This is functional addressing (broadcast), not a specific ECU
          // Skip it entirely - functional addresses should not create ECU entries
          const target = canId.slice(4, 6)
          if (target === '33') {
            // Functional address - treat as broadcast but don't create ECU
            ecuAddr = '07DF'  // Mark as broadcast for message tracking
          } else {
            // Other 18DB addresses might be valid, extract normally
            const source = canId.slice(6, 8)
            if (source === 'F1') {
              ecuAddr = target
            } else if (target === 'F1') {
              ecuAddr = source
            }
          }
        } else {
          // 18DA - Physical addressing
          const target = canId.slice(4, 6)
          const source = canId.slice(6, 8)

          // Physical addressing - identify the ECU address (not the tester F1)
          if (source === 'F1') {
            // Tester is source, ECU is target
            ecuAddr = target
          } else if (target === 'F1') {
            // Tester is target, ECU is source
            ecuAddr = source
          } else {
            // Neither is F1, use the non-tester address
            ecuAddr = msg.direction === 'Local->Remote' ? target : source
          }
        }
      } else if (canId.startsWith('07')) {
        // Standard OBD-II and HYUNDAI/KIA ISOTP addressing
        if (msg.protocol === 'HYUNDAI/KIA ISOTP') {
          // For Hyundai/KIA, recognize paired addressing
          // Tester uses 07Cx, ECU responds on 07Cx+8
          // Example: Tester 07C4 <-> ECU 07CC
          if (msg.direction === 'Local->Remote') {
            // This is a request from tester (e.g., 07C4)
            // The ECU will be at this address + 8
            const testerAddr = parseInt(canId, 16)
            const ecuAddrNum = testerAddr + 8
            ecuAddr = ecuAddrNum.toString(16).toUpperCase().padStart(4, '0')
          } else {
            // This is a response from ECU (e.g., 07CC)
            // This is already the ECU address
            ecuAddr = canId
          }
        } else {
          // Standard EOBD or other protocols
          ecuAddr = canId
        }
      } else if (canId.length === 3 || canId.length === 4) {
        // Standard CAN IDs
        ecuAddr = canId
      }
    } else if (msg.protocol === 'ISO14230') {
      // ISO14230 K-line protocol - extract ECU address from module
      // Example: mod[K-line1] or mod[K-line2]
      if (msg.module && msg.module.startsWith('K-line')) {
        ecuAddr = msg.module // Use module name as ECU identifier for K-line
      }
    }

    if (!ecuAddr) return

    // Get or create ECU entry
    if (!this.ecus.has(ecuAddr)) {
      // Don't guess ECU names - let the knowledge base handle naming
      this.ecus.set(ecuAddr, {
        address: ecuAddr,
        name: `ECU_${ecuAddr}`,  // Generic name until user assigns one in knowledge base
        protocol: msg.protocol,
        discoveredServices: new Set(),
        discoveredDIDs: new Map(),
        discoveredDTCs: new Map(),
        discoveredRoutines: new Map(),
        sessionTypes: new Set(),
        securityLevels: new Set(),
        messageCount: 0,
        firstSeen: this.parseTime(msg.timestamp),
        lastSeen: this.parseTime(msg.timestamp)
      })
    }

    const ecu = this.ecus.get(ecuAddr)!
    ecu.messageCount++
    ecu.lastSeen = this.parseTime(msg.timestamp)

    // Parse UDS services from data
    this.parseUDSData(ecu, msg)
  }

  private parseUDSData(ecu: DiscoveredECU, msg: JifelineMessage) {
    const data = msg.data.replace(/^0x/i, '')
    if (data.length < 2) return

    const serviceId = data.slice(0, 2).toLowerCase()

    // Check for positive responses (service ID + 0x40)
    // Note: 0x7F is Negative Response, not a positive response
    let actualServiceId = serviceId
    if (msg.direction === 'Remote->Local') {
      const serviceNum = parseInt(serviceId, 16)
      if (serviceNum >= 0x40 && serviceNum !== 0x7F) {
        // This is a positive response, calculate the original service
        actualServiceId = (serviceNum - 0x40).toString(16).padStart(2, '0')
      }
    }

    // Add the actual service ID
    ecu.discoveredServices.add(actualServiceId)

    // Parse based on service ID
    switch (serviceId) {
      case '10': // Diagnostic Session Control (request)
        if (msg.direction === 'Local->Remote' && data.length >= 4) {
          const sessionType = data.slice(2, 4)
          ecu.sessionTypes.add(sessionType)
        }
        break

      case '50': // Diagnostic Session Control (positive response)
        if (msg.direction === 'Remote->Local' && data.length >= 4) {
          const sessionType = data.slice(2, 4)
          ecu.sessionTypes.add(sessionType)
        }
        break

      case '27': // Security Access (request)
        if (data.length >= 4) {
          const level = data.slice(2, 4)
          ecu.securityLevels.add(level)
        }
        break

      case '67': // Security Access (positive response)
        if (msg.direction === 'Remote->Local' && data.length >= 4) {
          const level = data.slice(2, 4)
          ecu.securityLevels.add(level)
        }
        break

      case '22': // Read Data By Identifier (request)
        if (msg.direction === 'Local->Remote' && data.length >= 6) {
          const did = data.slice(2, 6).toUpperCase()
          if (!ecu.discoveredDIDs.has(did)) {
            const commonDID = this.COMMON_DIDS.get(did)
            ecu.discoveredDIDs.set(did, {
              did,
              name: commonDID?.name,
              dataType: commonDID?.type,
              dataLength: 0,
              sampleValues: []
            })
          }
        }
        break

      case '62': // Read Data By Identifier (positive response)
        if (msg.direction === 'Remote->Local' && data.length >= 6) {
          const did = data.slice(2, 6).toUpperCase()
          const value = data.slice(6)

          // Make sure the DID exists (it should from the request)
          if (!ecu.discoveredDIDs.has(did)) {
            const commonDID = this.COMMON_DIDS.get(did)
            ecu.discoveredDIDs.set(did, {
              did,
              name: commonDID?.name,
              dataType: commonDID?.type,
              dataLength: 0,
              sampleValues: []
            })
          }

          const didInfo = ecu.discoveredDIDs.get(did)!
          didInfo.dataLength = Math.max(didInfo.dataLength, value.length / 2)
          if (didInfo.sampleValues.length < 10) {
            didInfo.sampleValues.push(value)
          }
          // Try to guess data type if not already known
          if (!didInfo.dataType) {
            didInfo.dataType = this.guessDataType(value)
          }
        }
        break

      case '19': // Read DTC Information (request)
        // Track the request but don't parse DTCs from it
        if (msg.direction === 'Local->Remote' && data.length >= 4) {
          const subfunction = data.slice(2, 4)
          console.log(`Service 19 request - Subfunction: ${subfunction}`)
        }
        break

      case '59': // Read DTC Information (positive response)
        if (msg.direction === 'Remote->Local') {
          // Parse DTCs from response
          const subfunction = data.slice(2, 4)
          console.log(`Service 19 response - Subfunction: ${subfunction}, Data: ${data}`)

          // Handle different subfunctions of service 19
          switch (subfunction) {
            case '02': // Report DTC By Status Mask
            case '0a': // Report Supported DTC (case insensitive)
            case '0A':
              // Format: 59 02 [StatusAvailabilityMask] [DTC1:3bytes][Status1:1byte]...
              if (data.length > 6) {
                // Has status mask (1 byte) + at least one DTC (4 bytes)
                const statusMask = data.slice(4, 6)
                console.log(`Status availability mask: ${statusMask}`)
                if (data.length > 6) {
                  this.parseDTCReport(ecu, data.slice(6))
                }
              }
              break

            case '04': // Report DTC Snapshot Data
            case '06': // Report DTC Extended Data Record
            case '0f': // Report Mirror Memory DTC By Status Mask
            case '0F':
            case '14': // Report DTC Fault Detection Counter
            case '15': // Report DTC With Permanent Status
              // All these subfunctions contain DTC data in the response
              console.log(`Parsing DTCs from subfunction ${subfunction}`)
              if (data.length > 4) {
                this.parseDTCReport(ecu, data.slice(4))
              }
              break

            case '01': // Report Number Of DTC By Status Mask
            case '07': // Report Number Of DTC By Severity Mask
              // These report the count but not the actual DTCs
              const count = parseInt(data.slice(4, 6), 16)
              console.log(`DTC count response for subfunction ${subfunction}: ${count} DTCs`)
              break

            default:
              console.log(`Unhandled service 19 subfunction: ${subfunction}`)
              // Try to parse anyway in case it contains DTC data
              if (data.length > 4) {
                this.parseDTCReport(ecu, data.slice(4))
              }
              break
          }
        }
        break

      case '31': // Routine Control (request)
        if (msg.direction === 'Local->Remote' && data.length >= 8) {
          const controlType = data.slice(2, 4)
          const routineId = data.slice(4, 8).toUpperCase()

          if (!ecu.discoveredRoutines.has(routineId)) {
            ecu.discoveredRoutines.set(routineId, {
              routineId,
              controlType: this.decodeRoutineControl(controlType),
              status: []
            })
          }

          const routine = ecu.discoveredRoutines.get(routineId)!
          if (data.length > 8) {
            routine.inputData = data.slice(8)
          }
        }
        break

      case '71': // Routine Control (positive response)
        if (msg.direction === 'Remote->Local' && data.length >= 8) {
          const controlType = data.slice(2, 4)
          const routineId = data.slice(4, 8).toUpperCase()

          // Make sure the routine exists (it should from the request)
          if (!ecu.discoveredRoutines.has(routineId)) {
            ecu.discoveredRoutines.set(routineId, {
              routineId,
              controlType: this.decodeRoutineControl(controlType),
              status: []
            })
          }

          const routine = ecu.discoveredRoutines.get(routineId)!
          if (!routine.outputData) routine.outputData = []

          if (data.length > 8) {
            routine.outputData.push(data.slice(8))
            if (data.length >= 10) {
              routine.status.push(data.slice(8, 10))
            }
          }
        }
        break

      case '2E': // Write Data By Identifier
      case '3D': // Write Memory By Address
      case '34': // Request Download
      case '36': // Transfer Data
      case '37': // Request Transfer Exit
        // Track programming services
        ecu.discoveredServices.add(serviceId)
        break
    }
  }

  private parseDTCReport(ecu: DiscoveredECU, data: string) {
    // Parse DTC report - format depends on the specific response
    // Common formats:
    // - Subfunction 02/0A/0F: [Status Availability Mask (1 byte)][DTC+Status (4 bytes each)]
    // - Each DTC entry: [DTC High][DTC Mid][DTC Low][Status]

    if (!data || data.length < 2) return

    let offset = 0

    // Check if first byte looks like a status mask (typically 0xFF, 0x7F, etc)
    // If the first byte is >= 0x40, it's likely a status mask, not DTC data
    const firstByte = parseInt(data.slice(0, 2), 16)
    if (firstByte >= 0x40 && data.length > 2) {
      // Skip status availability mask
      offset = 2
    }

    // Parse DTCs - each DTC is 3 bytes + 1 status byte = 4 bytes total
    while (offset + 8 <= data.length) {
      const dtcBytes = data.slice(offset, offset + 6)
      const statusByte = data.slice(offset + 6, offset + 8)

      // Validate that we have valid hex data
      if (!/^[0-9A-Fa-f]+$/.test(dtcBytes) || !/^[0-9A-Fa-f]+$/.test(statusByte)) {
        break
      }

      const dtcCode = this.decodeDTC(dtcBytes)
      if (dtcCode && dtcCode !== 'P0000' && dtcCode !== 'P00' && dtcCode.length >= 5) {
        // Only add if we don't already have this DTC
        if (!ecu.discoveredDTCs.has(dtcCode)) {
          const status = this.decodeDTCStatus(statusByte)
          console.log(`Discovered DTC: ${dtcCode} - Status: ${status} (${statusByte})`)

          ecu.discoveredDTCs.set(dtcCode, {
            code: dtcCode,
            status,
            statusByte,
            rawHex: dtcBytes, // Store original hex bytes before conversion
            description: `DTC ${dtcCode}`
          })
        }
      }

      offset += 8 // Move to next DTC (4 bytes per DTC)
    }
  }

  private decodeDTC(dtcBytes: string): string {
    if (dtcBytes.length < 6) return ''

    const byte1 = parseInt(dtcBytes.slice(0, 2), 16)
    const byte2 = parseInt(dtcBytes.slice(2, 4), 16)
    const byte3 = parseInt(dtcBytes.slice(4, 6), 16)

    // Decode first letter (P, C, B, U)
    const letters = ['P', 'C', 'B', 'U']
    const letter = letters[(byte1 >> 6) & 0x03]

    // Decode first digit
    const firstDigit = (byte1 >> 4) & 0x03

    // Decode remaining digits
    const secondDigit = byte1 & 0x0F
    const thirdDigit = (byte2 >> 4) & 0x0F
    const fourthDigit = byte2 & 0x0F

    return `${letter}${firstDigit}${secondDigit.toString(16).toUpperCase()}${thirdDigit.toString(16).toUpperCase()}${fourthDigit.toString(16).toUpperCase()}`
  }

  private decodeDTCStatus(statusByte: string): string {
    const status = parseInt(statusByte, 16)
    const flags = []

    if (status & 0x01) flags.push('TestFailed')
    if (status & 0x02) flags.push('TestFailedThisOpCycle')
    if (status & 0x04) flags.push('PendingDTC')
    if (status & 0x08) flags.push('ConfirmedDTC')
    if (status & 0x10) flags.push('TestNotCompletedSinceLastClear')
    if (status & 0x20) flags.push('TestFailedSinceLastClear')
    if (status & 0x40) flags.push('TestNotCompletedThisOpCycle')
    if (status & 0x80) flags.push('WarningIndicatorRequested')

    return flags.join(', ') || 'Clear'
  }

  private decodeRoutineControl(controlType: string): string {
    switch (controlType) {
      case '01': return 'start'
      case '02': return 'stop'
      case '03': return 'requestResults'
      default: return `unknown_${controlType}`
    }
  }

  private guessDataType(hexData: string): string {
    // Try to detect ASCII
    let isAscii = true
    for (let i = 0; i < hexData.length; i += 2) {
      const byte = parseInt(hexData.slice(i, i + 2), 16)
      if ((byte < 0x20 || byte > 0x7E) && byte !== 0x00) {
        isAscii = false
        break
      }
    }

    if (isAscii) return 'ascii'

    // Check if it looks like a date (BCD format)
    if (hexData.length === 6 || hexData.length === 8) {
      let isBCD = true
      for (let i = 0; i < hexData.length; i++) {
        if (!'0123456789'.includes(hexData[i])) {
          isBCD = false
          break
        }
      }
      if (isBCD) return 'date'
    }

    // Check if numeric (consistent pattern)
    if (hexData.length <= 8) return 'numeric'

    return 'binary'
  }


  private detectProcedure(msg: DoipTraceMessage): DiagnosticProcedure | null {
    if (!msg.data || msg.direction !== 'Local->Remote') return null

    const data = msg.data.replace('0x', '')
    const serviceId = data.slice(0, 2)

    let procedureType: DiagnosticProcedure['procedureType'] = 'data_reading'
    let procedureName = 'Unknown'

    switch (serviceId) {
      case '10':
        procedureType = 'session_control'
        procedureName = 'Diagnostic Session Control'
        break
      case '27':
        procedureType = 'security_access'
        procedureName = 'Security Access'
        break
      case '22':
        procedureType = 'data_reading'
        procedureName = 'Read Data By Identifier'
        break
      case '19':
        procedureType = 'dtc_management'
        procedureName = 'Read DTC Information'
        break
      case '31':
        procedureType = 'routine_control'
        procedureName = 'Routine Control'
        break
      case '3E':
        procedureType = 'tester_present'
        procedureName = 'Tester Present'
        break
      default:
        return null
    }

    return {
      id: `${Date.now()}_${serviceId}`,
      ecuAddress: msg.targetAddr || '',
      procedureType,
      procedureName,
      startTime: this.currentTime,
      status: 'started',
      messages: [],
      requestCount: 0,
      responseCount: 0,
      errorCount: 0
    }
  }

  private updateProcedureData(procedure: DiagnosticProcedure, msg: DoipTraceMessage) {
    // This would extract specific data based on the procedure type
    // Implementation would be similar to parseUDSData but update the procedure object
  }

  private detectProtocol(messages: DoipTraceMessage[]): string {
    // Detect the primary protocol used and normalize the naming
    const protocolCounts = new Map<string, number>()
    const protocolDetails = new Map<string, { canIdType?: string, addresses?: Set<string> }>()

    for (const msg of messages) {
      if (!msg.protocol) continue

      const count = protocolCounts.get(msg.protocol) || 0
      protocolCounts.set(msg.protocol, count + 1)

      // Collect protocol details for analysis
      if (!protocolDetails.has(msg.protocol)) {
        protocolDetails.set(msg.protocol, { addresses: new Set() })
      }

      const details = protocolDetails.get(msg.protocol)!

      // Analyze CAN ID types for ISO-TP variants
      if (msg.protocol.includes('ISOTP')) {
        if (msg.sourceAddr || msg.targetAddr) {
          // Check if using 29-bit extended CAN IDs (Honda style)
          if (msg.sourceAddr?.length > 2 || msg.targetAddr?.length > 2) {
            details.canIdType = '11-bit'
          }
        }

        // Track addresses used
        if (msg.sourceAddr && msg.sourceAddr !== 'TESTER') {
          details.addresses!.add(msg.sourceAddr)
        }
        if (msg.targetAddr && msg.targetAddr !== 'TESTER') {
          details.addresses!.add(msg.targetAddr)
        }
      }
    }

    // Find the most common protocol
    let primaryProtocol = ''
    let maxCount = 0

    for (const [protocol, count] of protocolCounts) {
      if (count > maxCount) {
        maxCount = count
        primaryProtocol = protocol
      }
    }

    // Normalize protocol names and add metadata
    if (primaryProtocol === 'DoIP') {
      return 'DoIP'
    } else if (primaryProtocol.includes('ISOTP')) {
      // All ISOTP variants are actually ISO-TP with different CAN ID addressing
      const details = protocolDetails.get(primaryProtocol)

      // Determine CAN ID type based on the protocol name pattern
      if (primaryProtocol === 'HONDA ISOTP') {
        return 'ISO-TP (29-bit Extended CAN)'
      } else if (primaryProtocol === 'HYUNDAI/KIA ISOTP' ||
                 primaryProtocol === 'HYUNDAI ISOTP' ||
                 primaryProtocol === 'KIA ISOTP') {
        return 'ISO-TP (11-bit Standard CAN)'
      } else if (primaryProtocol === 'FORD ISOTP' ||
                 primaryProtocol === 'TOYOTA ISOTP' ||
                 primaryProtocol === 'RENAULT ISOTP') {
        return 'ISO-TP (11-bit Standard CAN)'
      } else {
        return 'ISO-TP'
      }
    } else if (primaryProtocol === 'ISO14230') {
      return 'ISO14230 (K-Line)'
    } else if (primaryProtocol === 'EOBD') {
      return 'OBD-II/EOBD'
    } else if (protocolCounts.size > 1) {
      return 'Mixed'
    }

    return primaryProtocol || 'Unknown'
  }

  private detectProbableOEM(protocol: string, messages: DoipTraceMessage[]): string | undefined {
    // This is a placeholder for OEM detection
    // In a real system, this would be matched against the knowledge base
    // or learned from previously identified traces

    // For now, we just return undefined to indicate OEM is unknown
    // The user will select the correct OEM when creating a job
    // and the system will learn from that association
    return undefined
  }

  // Public method to get protocol characteristics for analysis
  getProtocolCharacteristics(messages: DoipTraceMessage[]): {
    protocol: string
    canIdType?: '11-bit' | '29-bit' | 'mixed'
    ecuAddresses: string[]
    addressingScheme?: string
    originalProtocolLabels: string[]
  } {
    const ecuAddresses = new Set<string>()
    const originalProtocols = new Set<string>()
    let canIdType: '11-bit' | '29-bit' | 'mixed' | undefined

    for (const msg of messages) {
      // Collect ECU addresses
      if (msg.sourceAddr && msg.sourceAddr !== 'TESTER' && msg.sourceAddr !== '0E80' && msg.sourceAddr !== 'F1') {
        ecuAddresses.add(msg.sourceAddr)
      }
      if (msg.targetAddr && msg.targetAddr !== 'TESTER' && msg.targetAddr !== '0E80' && msg.targetAddr !== 'F1') {
        ecuAddresses.add(msg.targetAddr)
      }

      // Collect original protocol labels
      if (msg.protocol) {
        originalProtocols.add(msg.protocol)
      }

      // Detect CAN ID type for ISO-TP protocols
      if (msg.protocol?.includes('ISOTP')) {
        // Check if using extended CAN IDs (29-bit)
        if (msg.protocol === 'HONDA ISOTP') {
          canIdType = canIdType === '11-bit' ? 'mixed' : '29-bit'
        } else {
          canIdType = canIdType === '29-bit' ? 'mixed' : '11-bit'
        }
      }
    }

    // Determine addressing scheme
    let addressingScheme: string | undefined
    const protocol = this.detectProtocol(messages)

    if (protocol === 'DoIP') {
      addressingScheme = 'Direct hex addresses (e.g., 1726, 14B3)'
    } else if (protocol.includes('29-bit')) {
      addressingScheme = 'Extended CAN ID (0x18DAxxYY format)'
    } else if (protocol.includes('11-bit')) {
      addressingScheme = 'Standard CAN ID (0x07xx format)'
    } else if (protocol === 'ISO14230 (K-Line)') {
      addressingScheme = 'K-line module identifiers'
    }

    return {
      protocol,
      canIdType,
      ecuAddresses: Array.from(ecuAddresses).sort(),
      addressingScheme,
      originalProtocolLabels: Array.from(originalProtocols)
    }
  }

  private parseTime(timestamp: string): Date {
    // Parse HH:MM:SS.mmm format
    const parts = timestamp.split(':')
    if (parts.length !== 3) return this.currentTime

    const [hours, minutes, secondsMs] = parts
    const [seconds, ms] = secondsMs.split('.')

    const date = new Date(this.currentTime)
    date.setHours(parseInt(hours, 10))
    date.setMinutes(parseInt(minutes, 10))
    date.setSeconds(parseInt(seconds, 10))
    date.setMilliseconds(parseInt(ms, 10))

    return date
  }

  private generateECUSummary(): any {
    const summary: any = {
      ecus: []
    }

    for (const [address, ecu] of this.ecus) {
      summary.ecus.push({
        address,
        name: ecu.name,
        protocol: ecu.protocol,
        messageCount: ecu.messageCount,
        services: Array.from(ecu.discoveredServices),
        didCount: ecu.discoveredDIDs.size,
        dtcCount: ecu.discoveredDTCs.size,
        routineCount: ecu.discoveredRoutines.size,
        sessionTypes: Array.from(ecu.sessionTypes),
        securityLevels: Array.from(ecu.securityLevels),
        dids: Array.from(ecu.discoveredDIDs.entries()).map(([did, info]) => ({
          did,
          name: info.name || `Unknown_DID_${did}`,
          dataType: info.dataType || 'unknown',
          dataLength: info.dataLength,
          samples: info.sampleValues.slice(0, 3)
        })),
        dtcs: Array.from(ecu.discoveredDTCs.entries()).map(([code, info]) => ({
          code,
          status: info.status,
          statusByte: info.statusByte
        })),
        routines: Array.from(ecu.discoveredRoutines.entries()).map(([id, info]) => ({
          id,
          name: info.name || `Routine_${id}`,
          controlTypes: [info.controlType],
          hasInput: !!info.inputData,
          hasOutput: !!(info.outputData && info.outputData.length > 0)
        }))
      })
    }

    return summary
  }

  // Public method to get discovered ECUs
  getDiscoveredECUs(): Map<string, DiscoveredECU> {
    return this.ecus
  }
}