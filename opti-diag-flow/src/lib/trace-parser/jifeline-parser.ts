import { DoipTraceMessage, DTCInfo, DiagnosticProcedure, DoipTraceData } from '../doip-parser'

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

    for (const line of lines) {
      const message = this.parseJifelineLine(line)
      if (!message) continue

      // Track ECUs
      this.trackECU(message)

      // Convert to DoipTraceMessage for compatibility
      const doipMsg = this.toDoipMessage(message)
      messages.push(doipMsg)

      // Track procedures
      const newProcedure = this.detectProcedure(doipMsg)
      if (newProcedure) {
        if (currentProcedure) {
          currentProcedure.endTime = this.currentTime
          currentProcedure.status = 'completed'
          procedures.push(currentProcedure)
        }
        currentProcedure = newProcedure
      }

      if (currentProcedure) {
        currentProcedure.messages.push(doipMsg)
        this.updateProcedureData(currentProcedure, doipMsg)
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

    return {
      messages,
      procedures,
      metadata: {
        protocol: this.detectProtocol(messages),
        startTime: messages[0]?.timestamp || '',
        endTime: messages[messages.length - 1]?.timestamp || '',
        messageCount: messages.length,
        procedureCount: procedures.length,
        ecuCount: this.ecus.size,
        discoveries: ecuSummary
      }
    }
  }

  private parseJifelineLine(line: string): JifelineMessage | null {
    // Remove line numbers (if present)
    const cleanLine = line.replace(/^\s*\d+→\s*/, '').trim()
    if (!cleanLine) return null

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

  private toDoipMessage(msg: JifelineMessage): DoipTraceMessage {
    // Extract addresses from args
    let sourceAddr = ''
    let targetAddr = ''

    if (msg.protocol === 'DoIP' && msg.args.length >= 2) {
      // DoIP format: args[0] is source, args[1] is target
      sourceAddr = msg.args[0]
      targetAddr = msg.args[1]
    } else if (msg.args.length > 0) {
      // CAN/ISOTP format
      const canId = msg.args[0]
      if (canId.startsWith('0x18DA') || canId.startsWith('18DA')) {
        // Extended CAN ID format: 0x18DAxxYY where xx is target, YY is source
        const id = canId.replace('0x', '')
        targetAddr = id.slice(6, 8)
        sourceAddr = id.slice(8, 10)
      }
    }

    // Keep addresses as they are in the trace file
    // The trace file already has the correct source and target

    return {
      lineNumber: msg.lineNumber,
      timestamp: msg.timestamp,
      direction: msg.direction,
      protocol: msg.protocol,
      messageId: msg.command,
      sourceAddr,
      targetAddr,
      data: msg.data,
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
    } else if (msg.direction === 'Local->Remote' && msg.args.length > 0) {
      const canId = msg.args[0]
      if (canId.includes('DA')) {
        // Extract target address from CAN ID
        ecuAddr = canId.slice(-4, -2)
      }
    } else if (msg.direction === 'Remote->Local' && msg.args.length > 0) {
      const canId = msg.args[0]
      if (canId.includes('DA')) {
        // Extract source address from CAN ID
        ecuAddr = canId.slice(-2)
      }
    }

    if (!ecuAddr) return

    // Get or create ECU entry
    if (!this.ecus.has(ecuAddr)) {
      const ecuName = this.guessECUName(ecuAddr)
      this.ecus.set(ecuAddr, {
        address: ecuAddr,
        name: ecuName,
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
    const data = msg.data.replace('0x', '')
    if (data.length < 2) return

    const serviceId = data.slice(0, 2)

    // Check for positive responses (service ID + 0x40)
    let actualServiceId = serviceId
    if (msg.direction === 'Remote->Local') {
      const serviceNum = parseInt(serviceId, 16)
      if (serviceNum >= 0x40) {
        // This is a positive response, calculate the original service
        actualServiceId = (serviceNum - 0x40).toString(16).padStart(2, '0')
      }
    }

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
            case '0A': // Report Supported DTC
            case '04': // Report DTC Snapshot Data
            case '06': // Report DTC Extended Data Record
            case '0F': // Report Mirror Memory DTC By Status Mask
            case '14': // Report DTC Fault Detection Counter
            case '15': // Report DTC With Permanent Status
              // All these subfunctions contain DTC data in the response
              console.log(`Parsing DTCs from subfunction ${subfunction}`)
              this.parseDTCReport(ecu, data.slice(4))
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

  private guessECUName(address: string): string {
    const addr = parseInt(address, 16)

    // Check standard ranges
    for (const [, pattern] of this.ECU_ADDRESS_PATTERNS) {
      if (addr >= pattern.range[0] && addr <= pattern.range[1]) {
        // Try to pick a more specific name based on exact address
        const offset = addr - pattern.range[0]
        if (offset < pattern.names.length) {
          return `${pattern.names[offset]}_${address}`
        }
        return `${pattern.category}_${address}`
      }
    }

    // Special cases for common addresses
    switch (address.toUpperCase()) {
      case 'F1': return 'Tester'
      case 'B0': return 'Camera_B0'
      case '10': return 'Engine_10'
      case '11': return 'Transmission_11'
      case '15': return 'Airbag_15'
      case '17': return 'Instrument_17'
      case '19': return 'CAN_Gateway_19'
      case '25': return 'ABS_ESP_25'
      case '28': return 'Steering_28'
      case '40': return 'BCM_40'
      case '60': return 'Battery_60'
      case '61': return 'Charger_61'
      case '1421': return 'Camera_Front_1421'
      case '1020': return 'Gateway_1020'
      case '0E80': return 'Tester_0E80'
      case '1421': return 'Camera_1421'
      case '1020': return 'Gateway_1020'
      case '1021': return 'BCM_1021'
      case '1FFF': return 'Broadcast'
      default: return `ECU_${address}`
    }
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
      messages: []
    }
  }

  private updateProcedureData(procedure: DiagnosticProcedure, msg: DoipTraceMessage) {
    // This would extract specific data based on the procedure type
    // Implementation would be similar to parseUDSData but update the procedure object
  }

  private detectProtocol(messages: DoipTraceMessage[]): string {
    // Detect the primary protocol used
    const protocols = new Set(messages.map(m => m.protocol).filter(Boolean))
    if (protocols.size === 1) return Array.from(protocols)[0]

    // Check for specific manufacturers
    if (protocols.has('HONDA ISOTP')) return 'HONDA ISOTP'
    if (protocols.has('DoIP')) return 'DoIP'

    return 'Mixed'
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