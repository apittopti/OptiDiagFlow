'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Download, RefreshCw, AlertCircle, Activity, Database, Cpu, CheckCircle, XCircle, ArrowRight, ChevronDown, Filter, FileDigit, Zap, Car, Calendar, Info, Shield, GitBranch, AlertTriangle, Hash, Wrench, Settings, Gauge, Lock, Key, FileText, Play, Square, RotateCw, HardDrive, Network, Power, Terminal, Binary, Upload, Trash2, Clock } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, Dot } from 'recharts'
import { PageLayout } from '@/components/layout/page-layout'
import { Card, Button, Badge, StatCard } from '@/components/design-system'
import { colors, spacing } from '@/lib/design-system/tokens'
import { extractVINWithSource, formatVINSource, getVINSourceColor } from '@/lib/utils/vin-extractor'
import { containerStyles, flexStyles, gridStyles } from '@/lib/design-system/styles'

interface ECUSummary {
  address: string
  name: string
  messageCount: number
  services: string[]
  sessionTypes: string[]
  securityLevels: string[]
  dtcs: string[]
  dids: string[]
  routines: string[]
}

// Helper functions moved outside component
function getKnowledgeBaseName(type: string, identifier: string, ecuAddress: string = '', knowledgeBaseData: any): string {
    // Look up identifier in the knowledge base data fetched from the API
    const knowledgeMap = knowledgeBaseData[type.toLowerCase()]
    if (knowledgeMap) {
      // Try exact match first
      if (knowledgeMap[identifier]) {
        return knowledgeMap[identifier]
      }
      // For routines, try without sub-function (e.g., F00301 -> F003)
      if (type === 'ROUTINE' && identifier.length > 4) {
        const baseRoutine = identifier.substring(0, 4)
        if (knowledgeMap[baseRoutine]) {
          return knowledgeMap[baseRoutine]
        }
      }
    }

    return ''
}

export default function JobDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const [job, setJob] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [obdiiDTCsCache, setObdiiDTCsCache] = useState<Record<string, any>>({})
  const [activeTab, setActiveTab] = useState('jifeline')
  const [selectedEcu, setSelectedEcu] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [ecus, setEcus] = useState<ECUSummary[]>([])
  const [ecuNames, setEcuNames] = useState<Record<string, any>>({})
  const [fetchingNames, setFetchingNames] = useState(false)
  const [messageDisplayLimit, setMessageDisplayLimit] = useState(500) // Increased initial display
  const MESSAGE_INCREMENT = 500 // Load 500 more messages at a time

  // Diagnostic Flow table filters
  const [flowFilters, setFlowFilters] = useState({
    transport: '',
    source: '',
    target: '',
    service: '',
    serviceName: '', // Service name filter
    direction: '' // Request/Response filter
  })

  // Knowledge base state
  const [knowledgeBaseData, setKnowledgeBaseData] = useState<Record<string, Record<string, string>>>({
    routine: {},
    did: {},
    dtc: {},
    ecu: {}
  })

  // Calculate tab counts and filter options
  const tabCounts = useMemo(() => {
    // Services count - count unique service codes from messages
    const uniqueServices = new Set<string>()
    const filterOptions = {
      transports: new Set<string>(),
      sources: new Set<string>(),
      targets: new Set<string>(),
      services: new Set<string>(),
      serviceNames: new Set<string>(),
      directions: new Set<string>()
    }

    if (messages && messages.length > 0) {
      messages.forEach((msg: any) => {
        if (msg.data && msg.data.length >= 2) {
          const decoded = decodeUDSMessage(msg.data, msg.isRequest, msg.diagnosticProtocol, msg.protocol)
          if (decoded.service) {
            uniqueServices.add(decoded.service)
            filterOptions.services.add(decoded.service)
            // Add service name to filter options
            const serviceName = getServiceName(decoded.service, msg.diagnosticProtocol)
            if (serviceName && serviceName !== 'Unknown') {
              filterOptions.serviceNames.add(serviceName)
            }
          }
        }

        // Collect filter options
        if (msg.protocol) filterOptions.transports.add(msg.protocol)
        if (msg.sourceAddr) filterOptions.sources.add(msg.sourceAddr)
        if (msg.targetAddr) filterOptions.targets.add(msg.targetAddr)
        filterOptions.directions.add(msg.isRequest ? 'Request' : 'Response')
      })
    }

    return {
      messages: messages.length || 0,
      services: uniqueServices.size || 0,
      filterOptions: {
        transports: Array.from(filterOptions.transports).sort(),
        sources: Array.from(filterOptions.sources).sort(),
        targets: Array.from(filterOptions.targets).sort(),
        services: Array.from(filterOptions.services).sort(),
        serviceNames: Array.from(filterOptions.serviceNames).sort(),
        directions: Array.from(filterOptions.directions).sort()
      }
    }
  }, [messages])

  useEffect(() => {
    if (params) {
      fetchJob()
    }
  }, [params])

  // Fetch knowledge base data
  useEffect(() => {
    const fetchKnowledgeBase = async () => {
      try {
        const types = ['routine', 'did', 'dtc', 'ecu']
        const knowledgeData: Record<string, Record<string, string>> = {
          routine: {},
          did: {},
          dtc: {},
          ecu: {}
        }

        for (const type of types) {
          const response = await fetch(`/api/knowledge/definitions?type=${type}`)
          if (response.ok) {
            const data = await response.json()
            data.forEach((item: any) => {
              let identifier = ''
              let name = ''

              if (type === 'routine') {
                identifier = item.routineId
                name = item.name
              } else if (type === 'did') {
                identifier = item.did
                name = item.name
              } else if (type === 'dtc') {
                identifier = item.code
                name = item.description
              } else if (type === 'ecu') {
                identifier = item.address
                name = item.name
              }

              if (identifier && name) {
                knowledgeData[type][identifier.toUpperCase()] = name
              }
            })
          }
        }

        setKnowledgeBaseData(knowledgeData)
      } catch (error) {
        console.error('Error fetching knowledge base:', error)
      }
    }

    fetchKnowledgeBase()
  }, [])

  // Fetch OBD-II DTCs from database
  const fetchOBDIIDTCs = useCallback(async (codes: string[]) => {
    try {
      // Check cache first
      const uncachedCodes = codes.filter(code => !obdiiDTCsCache[code])
      if (uncachedCodes.length === 0) return // All codes are cached

      const response = await fetch('/api/obdii-dtcs/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codes: uncachedCodes })
      })

      if (response.ok) {
        const results = await response.json()
        setObdiiDTCsCache(prev => ({ ...prev, ...results }))
      }
    } catch (error) {
      console.error('Error fetching OBD-II DTCs:', error)
    }
  }, [obdiiDTCsCache])

  // Pre-fetch OBD-II DTCs when EOBD tab is shown
  useEffect(() => {
    if (activeTab === 'eobd' && messages.length > 0) {
      const obdCodes = new Set<string>()

      // Extract all OBD-II codes from messages
      messages.forEach((msg: any) => {
        if (msg.diagnosticProtocol === 'OBD-II' && msg.data) {
          const service = parseInt(msg.data.substring(0, 2), 16)
          if ((service === 0x03 || service === 0x07 || service === 0x43 || service === 0x47) && msg.data.length > 4) {
            const dataPortionOnly = msg.data.substring(4)
            if (dataPortionOnly.length > 2) {
              const dtcData = dataPortionOnly.substring(2)
              for (let i = 0; i < dtcData.length; i += 4) {
                if (i + 4 <= dtcData.length) {
                  const dtcHex = dtcData.substring(i, i + 4)
                  // Decode to get the code
                  const firstDigit = parseInt(dtcHex[0], 16)
                  const secondDigit = dtcHex[1]
                  const thirdFourthDigits = dtcHex.substring(2)
                  let prefix = ''
                  switch (firstDigit >> 2) {
                    case 0: prefix = 'P'; break
                    case 1: prefix = 'C'; break
                    case 2: prefix = 'B'; break
                    case 3: prefix = 'U'; break
                    default: prefix = 'P'; break
                  }
                  const isGeneric = (firstDigit & 0x02) === 0
                  const genericFlag = isGeneric ? '0' : '1'
                  const fullCode = `${prefix}${genericFlag}${secondDigit}${thirdFourthDigits}`
                  obdCodes.add(fullCode)
                }
              }
            }
          }
        }
      })

      if (obdCodes.size > 0) {
        fetchOBDIIDTCs(Array.from(obdCodes))
      }
    }
  }, [activeTab, messages, fetchOBDIIDTCs])

  // Analyze security access in the trace
  const analyzeSecurityAccess = () => {
    const securityEvents: any[] = []

    messages.forEach((msg, index) => {
      if (msg.data && msg.data.length >= 4) {
        // Strip 0x prefix if present and extract the service ID
        const cleanData = msg.data.startsWith('0x') || msg.data.startsWith('0X') ? msg.data.substring(2) : msg.data
        const serviceId = cleanData.substring(0, 2).toUpperCase()

        // Check for Security Access service (0x27) or response (0x67)
        if (serviceId === '27' || serviceId === '67') {
          const isRequest = serviceId === '27'
          const dataBytes = cleanData.substring(2)

          if (dataBytes.length >= 2) {
            const subFunction = parseInt(dataBytes.substring(0, 2), 16)
            let type = 'Unknown'
            let level = ''
            let eventData = ''

            if (subFunction % 2 === 1) {
              // Odd = seed request/response
              const secLevel = Math.floor(subFunction / 2) + 1
              if (isRequest) {
                type = 'Seed Request'
                level = `Level ${secLevel}`
              } else {
                type = 'Seed Response'
                level = `Level ${secLevel}`
                eventData = dataBytes.substring(2) // The seed value
              }
            } else {
              // Even = key send/response
              const secLevel = subFunction / 2
              if (isRequest) {
                type = 'Key Send'
                level = `Level ${secLevel}`
                eventData = dataBytes.substring(2) // The key value
              } else {
                type = 'Key Accepted'
                level = `Level ${secLevel}`
              }
            }

            securityEvents.push({
              timestamp: msg.timestamp,
              source: msg.sourceAddr,
              target: msg.targetAddr,
              type,
              level,
              data: eventData,
              isRequest
            })
          }
        } else if (serviceId === '7F') {
          // Negative response - check if it's for security access
          const dataBytes = cleanData.substring(2)
          if (dataBytes.length >= 4) {
            const rejectedService = dataBytes.substring(0, 2)
            const nrc = dataBytes.substring(2, 4)

            if (rejectedService === '27') {
              let reason = ''
              switch(nrc) {
                case '35': reason = 'Invalid Key'; break;
                case '36': reason = 'Exceeded Number of Attempts'; break;
                case '37': reason = 'Required Time Delay Not Expired'; break;
                case '12': reason = 'Sub-function Not Supported'; break;
                case '22': reason = 'Conditions Not Correct'; break;
                case '33': reason = 'Security Access Denied'; break;
                default: reason = `NRC 0x${nrc}`; break;
              }

              securityEvents.push({
                timestamp: msg.timestamp,
                source: msg.sourceAddr,
                target: msg.targetAddr,
                type: 'Security Access Rejected',
                level: '',
                data: reason,
                isRequest: false,
                success: false
              })
            }
          }
        }
      }
    })

    return securityEvents
  }

  // Force recompilation

  // OBD-II PID definitions
  const obdiiPIDs: Record<string, string> = {
    '00': 'PIDs supported [01-20]',
    '01': 'Monitor status since DTCs cleared',
    '02': 'Freeze DTC',
    '03': 'Fuel system status',
    '04': 'Calculated engine load',
    '05': 'Engine coolant temperature',
    '06': 'Short term fuel trim—Bank 1',
    '07': 'Long term fuel trim—Bank 1',
    '08': 'Short term fuel trim—Bank 2',
    '09': 'Long term fuel trim—Bank 2',
    '0A': 'Fuel pressure',
    '0B': 'Intake manifold absolute pressure',
    '0C': 'Engine speed',
    '0D': 'Vehicle speed',
    '0E': 'Timing advance',
    '0F': 'Intake air temperature',
    '10': 'Mass air flow sensor',
    '11': 'Throttle position',
    '12': 'Commanded secondary air status',
    '13': 'Oxygen sensors present',
    '14': 'Oxygen Sensor 1',
    '15': 'Oxygen Sensor 2',
    '16': 'Oxygen Sensor 3',
    '17': 'Oxygen Sensor 4',
    '18': 'Oxygen Sensor 5',
    '19': 'Oxygen Sensor 6',
    '1A': 'Oxygen Sensor 7',
    '1B': 'Oxygen Sensor 8',
    '1C': 'OBD standards this vehicle conforms to',
    '1D': 'Oxygen sensors present (4 banks)',
    '1E': 'Auxiliary input status',
    '1F': 'Run time since engine start',
    '20': 'PIDs supported [21-40]',
    '21': 'Distance traveled with MIL on',
    '22': 'Fuel Rail Pressure',
    '23': 'Fuel Rail Gauge Pressure',
    '24': 'Oxygen Sensor 1 (Wide Range)',
    '25': 'Oxygen Sensor 2 (Wide Range)',
    '26': 'Oxygen Sensor 3 (Wide Range)',
    '27': 'Oxygen Sensor 4 (Wide Range)',
    '28': 'Oxygen Sensor 5 (Wide Range)',
    '29': 'Oxygen Sensor 6 (Wide Range)',
    '2A': 'Oxygen Sensor 7 (Wide Range)',
    '2B': 'Oxygen Sensor 8 (Wide Range)',
    '2C': 'Commanded EGR',
    '2D': 'EGR Error',
    '2E': 'Commanded evaporative purge',
    '2F': 'Fuel Tank Level Input',
    '30': 'Warm-ups since codes cleared',
    '31': 'Distance traveled since codes cleared',
    '32': 'Evap. System Vapor Pressure',
    '33': 'Absolute Barometric Pressure',
    '34': 'Oxygen Sensor 1 (Wide Range Current)',
    '35': 'Oxygen Sensor 2 (Wide Range Current)',
    '36': 'Oxygen Sensor 3 (Wide Range Current)',
    '37': 'Oxygen Sensor 4 (Wide Range Current)',
    '38': 'Oxygen Sensor 5 (Wide Range Current)',
    '39': 'Oxygen Sensor 6 (Wide Range Current)',
    '3A': 'Oxygen Sensor 7 (Wide Range Current)',
    '3B': 'Oxygen Sensor 8 (Wide Range Current)',
    '3C': 'Catalyst Temperature Bank 1 Sensor 1',
    '3D': 'Catalyst Temperature Bank 2 Sensor 1',
    '3E': 'Catalyst Temperature Bank 1 Sensor 2',
    '3F': 'Catalyst Temperature Bank 2 Sensor 2',
    '40': 'PIDs supported [41-60]',
    '41': 'Monitor status this drive cycle',
    '42': 'Control module voltage',
    '43': 'Absolute load value',
    '44': 'Commanded Air-Fuel Equivalence Ratio',
    '45': 'Relative throttle position',
    '46': 'Ambient air temperature',
    '47': 'Absolute throttle position B',
    '48': 'Absolute throttle position C',
    '49': 'Accelerator pedal position D',
    '4A': 'Accelerator pedal position E',
    '4B': 'Accelerator pedal position F',
    '4C': 'Commanded throttle actuator',
    '4D': 'Time run with MIL on',
    '4E': 'Time since trouble codes cleared',
    '4F': 'Maximum values',
    '50': 'Maximum value for mass air flow sensor',
    '51': 'Fuel Type',
    '52': 'Ethanol fuel %',
    '53': 'Absolute Evap system Vapor Pressure',
    '54': 'Evap system vapor pressure',
    '55': 'Short term secondary O2 sensor trim',
    '56': 'Long term secondary O2 sensor trim',
    '57': 'Short term secondary O2 sensor trim',
    '58': 'Long term secondary O2 sensor trim',
    '59': 'Fuel rail absolute pressure',
    '5A': 'Relative accelerator pedal position',
    '5B': 'Hybrid battery pack remaining life',
    '5C': 'Engine oil temperature',
    '5D': 'Fuel injection timing',
    '5E': 'Engine fuel rate',
    '5F': 'Emission requirements',
    '60': 'PIDs supported [61-80]'
  }


  // OBD-II DTC decoder function
  function decodeOBDIIDTC(dtcHex: string): { code: string, description: string } {
    if (dtcHex.length !== 4) {
      return { code: dtcHex, description: 'Invalid DTC format' }
    }

    const firstDigit = parseInt(dtcHex[0], 16)
    const secondDigit = dtcHex[1]
    const thirdFourthDigits = dtcHex.substring(2)

    // Determine DTC prefix based on first two bits
    let prefix = ''
    switch (firstDigit >> 2) {
      case 0: prefix = 'P'; break // Powertrain
      case 1: prefix = 'C'; break // Chassis
      case 2: prefix = 'B'; break // Body
      case 3: prefix = 'U'; break // Network/Communications
      default: prefix = 'P'; break
    }

    // Determine if generic (0) or manufacturer specific (1)
    const isGeneric = (firstDigit & 0x02) === 0
    const genericFlag = isGeneric ? '0' : '1'

    const fullCode = `${prefix}${genericFlag}${secondDigit}${thirdFourthDigits}`

    // Look up from cached database results first
    if (obdiiDTCsCache[fullCode]) {
      return {
        code: fullCode,
        description: obdiiDTCsCache[fullCode].description || obdiiDTCsCache[fullCode].name
      }
    }

    // If not found in cache, trigger database lookup and return fallback for now
    if (!obdiiDTCsCache[fullCode]) {
      fetchOBDIIDTCs([fullCode]).catch(console.error)
    }

    const description = isGeneric ? 'Generic OBD-II code' : 'Manufacturer specific code'

    return { code: fullCode, description }
  }

  // Decode OBD-II service messages
  function decodeOBDIIService(serviceId: string, dataBytes: string, isRequest: boolean): string {
    const service = parseInt(serviceId, 16)

    // Strip 0x prefix if present (defensive programming)
    const cleanDataBytes = dataBytes && (dataBytes.startsWith('0x') || dataBytes.startsWith('0X')) ? dataBytes.substring(2) : dataBytes || ''

    // Handle response codes (0x40 offset)
    const requestService = isRequest ? service : (service - 0x40)

    switch (requestService) {
      case 0x01: // Show current data
        if (cleanDataBytes) {
          const pids = cleanDataBytes.match(/.{2}/g) || []
          const pidDescriptions = pids.map(pid => {
            const pidName = obdiiPIDs[pid.toUpperCase()]
            return pidName ? `${pidName}` : `PID 0x${pid}`
          })
          if (pidDescriptions.length > 0) {
            return isRequest
              ? `Read Current Data\n${pidDescriptions.join('\n')}`
              : `Current Data Response\n${pidDescriptions.join('\n')}`
          }
        }
        return isRequest ? 'Read Current Data' : 'Current Data Response'

      case 0x02: // Show freeze frame data
        if (cleanDataBytes) {
          const pids = cleanDataBytes.match(/.{2}/g) || []
          const pidDescriptions = pids.map(pid => {
            const pidName = obdiiPIDs[pid.toUpperCase()]
            return pidName ? `${pidName}` : `PID 0x${pid}`
          })
          if (pidDescriptions.length > 0) {
            return isRequest
              ? `Read Freeze Frame\n${pidDescriptions.join('\n')}`
              : `Freeze Frame Response\n${pidDescriptions.join('\n')}`
          }
        }
        return isRequest ? 'Read Freeze Frame Data' : 'Freeze Frame Data Response'

      case 0x03: // Show stored DTCs
        return isRequest ? 'Read Stored DTCs' : 'Stored DTCs Response'

      case 0x04: // Clear DTCs
        return isRequest ? 'Clear DTCs and Stored Values' : 'Clear DTCs Confirmation'

      case 0x05: // Test results, O2 sensors
        return isRequest ? 'Read O2 Sensor Monitoring Test Results' : 'O2 Sensor Test Results'

      case 0x06: // Test results, other systems
        return isRequest ? 'Read On-Board Monitoring Test Results' : 'On-Board Test Results'

      case 0x07: // Show pending DTCs
        return isRequest ? 'Read Pending DTCs' : 'Pending DTCs Response'

      case 0x08: // Control operation
        return isRequest ? 'Control On-Board System/Component' : 'Control Operation Response'

      case 0x09: // Request vehicle information
        if (cleanDataBytes) {
          const infotype = cleanDataBytes.substring(0, 2)
          const infoTypes: Record<string, string> = {
            '00': 'Service 9 supported PIDs',
            '01': 'VIN Message Count',
            '02': 'Vehicle Identification Number (VIN)',
            '03': 'Calibration ID Message Count',
            '04': 'Calibration ID',
            '05': 'Calibration Verification Numbers Message Count',
            '06': 'Calibration Verification Numbers',
            '07': 'In-use Performance Tracking Message Count',
            '08': 'In-use Performance Tracking',
            '09': 'ECU Name Message Count',
            '0A': 'ECU Name',
            '0B': 'In-use Performance Tracking',
          }
          const infoName = infoTypes[infotype.toUpperCase()] || `Info Type 0x${infotype}`
          return isRequest
            ? `Read Vehicle Info - ${infoName}`
            : `Vehicle Info Response - ${infoName}`
        }
        return isRequest ? 'Read Vehicle Information' : 'Vehicle Information Response'

      case 0x0A: // Read permanent DTCs
        return isRequest ? 'Read Permanent DTCs' : 'Permanent DTCs Response'

      default:
        return ''
    }
  }

  // Parse ISO-TP frame
  function parseISOTP(data: string): { frameType: string, payload: string } {
    const bytes = data.match(/.{2}/g) || []
    if (bytes.length === 0) return { frameType: 'UNKNOWN', payload: '' }

    const firstByte = parseInt(bytes[0], 16)
    const frameType = (firstByte >> 4) & 0x0F

    switch (frameType) {
      case 0: // Single frame
        const length = firstByte & 0x0F
        return { frameType: 'SF', payload: bytes.slice(1, 1 + length).join('') }
      case 1: // First frame
        return { frameType: 'FF', payload: bytes.slice(2).join('') }
      case 2: // Consecutive frame
        return { frameType: 'CF', payload: bytes.slice(1).join('') }
      case 3: // Flow control
        return { frameType: 'FC', payload: bytes.slice(1).join('') }
      default:
        return { frameType: 'UNKNOWN', payload: bytes.slice(1).join('') }
    }
  }

  // Decode UDS message
  function decodeUDSMessage(data: string, isRequest: boolean, diagnosticProtocol?: string, transportProtocol?: string): any {
    if (!data || data.length < 2) return { service: '', description: '', details: {} }

    // Strip "0x" or "0X" prefix if present
    let cleanData = data.startsWith('0x') || data.startsWith('0X') ? data.substring(2) : data

    // Extract service ID from the cleaned data
    const serviceId = cleanData.substring(0, 2)
    const service = parseInt(serviceId, 16)
    const dataBytes = cleanData.substring(2) // Data after the service ID
    let description = ''
    let details: any = {}

    switch (service) {
      case 0x10: // Session Control
      case 0x50: // Session Control Response
        if (dataBytes.length >= 2) {
          // For session control, if the data appears to be padded (e.g., "810000000000")
          // extract just the session type byte
          let sessionType = dataBytes.substring(0, 2)

          // Check if this looks like ISO-TP padded data (very long with zeros)
          if (dataBytes.length >= 12 && dataBytes.substring(2).match(/^0+$/)) {
            // Data is padded with zeros, session type is the first byte
            sessionType = dataBytes.substring(0, 2)
          }

          const sessionTypes: Record<string, string> = {
            '01': 'Default Session',
            '02': 'Programming Session',
            '03': 'Extended Diagnostic Session',
            '04': 'Safety System Diagnostic Session',
            '40': 'EOL Session',  // End of line session
            '60': 'Development Session',  // Development/engineering session
            '81': 'Default Session',  // KWP2000 default
            '82': 'Flash Programming Session',  // KWP2000 programming
            '83': 'Extended Diagnostic Session',  // KWP2000 extended
            '84': 'Safety System Diagnostic Session',  // KWP2000 safety
            '85': 'Supplier Session',  // Supplier specific
            '92': 'Supplier Programming Session'  // Supplier programming
          }
          const sessionName = sessionTypes[sessionType] || `Session Type 0x${sessionType}`
          description = `Diagnostic Session Control - ${sessionName}`
          details.sessionType = sessionType
        }
        break
      case 0x27: // Security Access
      case 0x67: // Security Access Response
        if (dataBytes.length >= 2) {
          const subFunction = parseInt(dataBytes.substring(0, 2), 16)
          if (subFunction % 2 === 1) {
            // Odd = seed request
            const level = Math.floor(subFunction / 2) + 1
            let seed = ''
            if (isRequest) {
              description = `Request Seed - Level ${level}`
            } else {
              // Seed response includes the actual seed
              seed = dataBytes.substring(2)
              description = `Seed Response - Level ${level}${seed ? ` (Seed: ${seed})` : ''}`
            }
            details.type = 'seed'
            details.level = level
            if (!isRequest && seed) details.seed = seed
          } else {
            // Even = key send
            const level = subFunction / 2
            const key = dataBytes.substring(2)
            description = `Send Key - Level ${level}${key ? ` (Key: ${key})` : ''}`
            details.type = 'key'
            details.level = level
            if (key) details.key = key
          }
        }
        break
      case 0x22: // Read Data By Identifier
        if (dataBytes.length >= 4) {
          const did = dataBytes.substring(0, 4).toUpperCase()
          description = `Read DID 0x${did}`
          details.did = did
        }
        break
      case 0x62: // Read Data By Identifier Response
        if (dataBytes.length >= 4) {
          const did = dataBytes.substring(0, 4).toUpperCase()
          const value = dataBytes.substring(4)
          description = `DID 0x${did} Response${value ? ` = ${value}` : ''}`
          details.did = did
          if (value) details.value = value
        }
        break
      case 0x2E: // Write Data By Identifier
        if (dataBytes.length >= 4) {
          const did = dataBytes.substring(0, 4).toUpperCase()
          const value = dataBytes.substring(4)
          description = `Write DID 0x${did}${value ? ` = ${value}` : ''}`
          details.did = did
          if (value) details.value = value
        }
        break
      case 0x6E: // Write Data By Identifier Response
        if (dataBytes.length >= 4) {
          const did = dataBytes.substring(0, 4).toUpperCase()
          description = `Write DID 0x${did} Success`
          details.did = did
        }
        break
      case 0x31: // Routine Control
        if (dataBytes.length >= 6) {
          const controlType = dataBytes.substring(0, 2)
          const routineId = dataBytes.substring(2, 6).toUpperCase()
          const controlTypes: Record<string, string> = {
            '01': 'Start',
            '02': 'Stop',
            '03': 'Request Results'
          }
          const control = controlTypes[controlType] || `Control 0x${controlType}`
          description = `${control} Routine 0x${routineId}`
          details.controlType = controlType
          details.routineId = routineId
        }
        break
      case 0x71: // Routine Control Response
        if (dataBytes.length >= 6) {
          const controlType = dataBytes.substring(0, 2)
          const routineId = dataBytes.substring(2, 6).toUpperCase()
          const status = dataBytes.substring(6, 8)
          const controlTypes: Record<string, string> = {
            '01': 'Started',
            '02': 'Stopped',
            '03': 'Results'
          }
          const control = controlTypes[controlType] || `Control 0x${controlType}`
          description = `Routine 0x${routineId} ${control}`
          if (status) description += ` - Status: ${status}`
          details.controlType = controlType
          details.routineId = routineId
          if (status) details.status = status
        }
        break
      case 0x19: // Read DTC Information
        if (dataBytes.length >= 2) {
          const subFunction = dataBytes.substring(0, 2)
          const subFunctions: Record<string, string> = {
            '01': 'Report Number of DTC by Status Mask',
            '02': 'Report DTC by Status Mask',
            '03': 'Report DTC Snapshot Identification',
            '04': 'Report DTC Snapshot Record by DTC Number',
            '06': 'Report DTC Extended Data Record by DTC Number',
            '0A': 'Report Supported DTC'
          }
          description = subFunctions[subFunction] || `Read DTC - Subfunction 0x${subFunction}`
          details.subFunction = subFunction
        }
        break
      case 0x59: // Read DTC Information Response
        if (dataBytes.length >= 2) {
          const subFunction = dataBytes.substring(0, 2)
          const subFunctionNames: Record<string, string> = {
            '01': 'Number of DTCs',
            '02': 'DTC by Status Mask',
            '03': 'DTC Snapshot Identification',
            '04': 'DTC Snapshot Record by DTC Number',
            '06': 'DTC Extended Data Record',
            '0A': 'Supported DTCs'
          }
          const subFuncName = subFunctionNames[subFunction] || `Subfunction 0x${subFunction}`

          if (subFunction === '02') {
            // DTC by status mask response
            if (dataBytes.length >= 4) {
              const statusMask = dataBytes.substring(2, 4)
              const dtcData = dataBytes.substring(4)

              // Decode status mask
              const maskValue = parseInt(statusMask, 16)
              const statusBits = []
              if (maskValue & 0x01) statusBits.push('TestFailed')
              if (maskValue & 0x02) statusBits.push('TestFailedThisOpCycle')
              if (maskValue & 0x04) statusBits.push('PendingDTC')
              if (maskValue & 0x08) statusBits.push('ConfirmedDTC')
              if (maskValue & 0x10) statusBits.push('TestNotCompletedSinceLastClear')
              if (maskValue & 0x20) statusBits.push('TestFailedSinceLastClear')
              if (maskValue & 0x40) statusBits.push('TestNotCompletedThisOpCycle')
              if (maskValue & 0x80) statusBits.push('WarningIndicatorRequested')

              if (dtcData.length === 0) {
                description = `No DTCs matching status mask 0x${statusMask}${statusBits.length > 0 ? ` (${statusBits.join(', ')})` : ''}`
              } else if (dtcData.length >= 6) {
                // Extract DTCs (3 bytes DTC + 1 byte status)
                const dtcs = []
                for (let i = 0; i < dtcData.length; i += 8) {
                  if (i + 6 <= dtcData.length) {
                    const dtcCode = dtcData.substring(i, i + 6).toUpperCase()
                    const dtcStatus = dtcData.substring(i + 6, i + 8)
                    dtcs.push(`${dtcCode}:${dtcStatus}`)
                  }
                }
                if (dtcs.length > 0) {
                  description = `${dtcs.length} DTC${dtcs.length > 1 ? 's' : ''} found\nStatus Mask: 0x${statusMask}${statusBits.length > 0 ? ` (${statusBits.join(', ')})` : ''}\nDTCs: ${dtcs.join(', ')}`
                } else {
                  description = `${subFuncName} - Status Mask: 0x${statusMask}`
                }
              } else {
                description = `${subFuncName} - Status Mask: 0x${statusMask}`
              }
            } else {
              description = subFuncName
            }
          } else if (subFunction === '01' && dataBytes.length >= 6) {
            // Number of DTCs response
            const statusMask = dataBytes.substring(2, 4)
            const dtcFormat = dataBytes.substring(4, 6)
            const dtcCount = dataBytes.substring(6, 8)
            const count = parseInt(dtcCount, 16)
            description = `${count} DTC${count !== 1 ? 's' : ''} found\nStatus Mask: 0x${statusMask}`
          } else {
            description = subFuncName
          }
          details.subFunction = subFunction
        }
        break
      case 0x14: // Clear Diagnostic Information
        if (dataBytes.length >= 6) {
          const dtcCode = dataBytes.substring(0, 6).toUpperCase()
          description = dtcCode === 'FFFFFF' ? 'Clear All DTCs' : `Clear DTC ${dtcCode}`
          details.dtcCode = dtcCode
        } else {
          description = 'Clear Diagnostic Information'
        }
        break
      case 0x54: // Clear Diagnostic Information Response
        description = 'DTCs Cleared Successfully'
        break
      case 0x3E: // Tester Present
        const suppressResponse = dataBytes === '80'
        description = suppressResponse ? 'Tester Present (Suppress Response)' : 'Tester Present'
        details.suppressResponse = suppressResponse
        break
      case 0x7E: // Tester Present Response
        description = 'Tester Present ACK'
        break
      case 0x11: // ECU Reset
        if (dataBytes.length >= 2) {
          const resetType = dataBytes.substring(0, 2)
          const resetTypes: Record<string, string> = {
            '01': 'Hard Reset',
            '02': 'Key Off/On Reset',
            '03': 'Soft Reset'
          }
          description = resetTypes[resetType] || `Reset Type 0x${resetType}`
          details.resetType = resetType
        }
        break
      case 0x51: // ECU Reset Response
        if (dataBytes.length >= 2) {
          const resetType = dataBytes.substring(0, 2)
          description = `Reset Acknowledged - Type 0x${resetType}`
          details.resetType = resetType
        }
        break
      case 0x60: // Manufacturer Specific Service
        description = 'Manufacturer Specific'
        if (dataBytes.length > 0) {
          description += ` - Data: ${dataBytes}`
        }
        break
      case 0x7F: // Negative Response
        if (dataBytes.length >= 4) {
          const rejectedService = dataBytes.substring(0, 2)
          const nrc = dataBytes.substring(2, 4)

          // Map of service IDs to service names for negative responses
          const serviceNamesMap: Record<string, string> = {
            '10': 'Diagnostic Session Control',
            '11': 'ECU Reset',
            '14': 'Clear Diagnostic Information',
            '19': 'Read DTC Information',
            '20': 'Stop Diagnostic Session',  // KWP2000 service
            '21': 'Read Data By Local ID',     // KWP2000 service
            '22': 'Read Data By Identifier',
            '23': 'Read Memory By Address',
            '24': 'Read Scaling Data By Identifier',
            '27': 'Security Access',
            '28': 'Communication Control',
            '29': 'Authentication',
            '2A': 'Read Data By Periodic Identifier',
            '2C': 'Dynamically Define Data Identifier',
            '2E': 'Write Data By Identifier',
            '2F': 'Input Output Control By Identifier',
            '31': 'Routine Control',
            '34': 'Request Download',
            '35': 'Request Upload',
            '36': 'Transfer Data',
            '37': 'Request Transfer Exit',
            '38': 'Request File Transfer',
            '3D': 'Write Memory By Address',
            '3E': 'Tester Present',
            '85': 'Control DTC Setting',
            '86': 'Response On Event',
            '87': 'Link Control'
          }

          const nrcCodes: Record<string, string> = {
            '10': 'General Reject',
            '11': 'Service Not Supported',
            '12': 'Sub-function Not Supported',
            '13': 'Incorrect Message Length Or Invalid Format',
            '21': 'Busy - Repeat Request',
            '22': 'Conditions Not Correct',
            '24': 'Request Sequence Error',
            '25': 'No Response From Subnet Component',
            '26': 'Failure Prevents Execution Of Requested Action',
            '31': 'Request Out Of Range',
            '33': 'Security Access Denied',
            '35': 'Invalid Key',
            '36': 'Exceeded Number Of Attempts',
            '37': 'Required Time Delay Not Expired',
            '70': 'Upload/Download Not Accepted',
            '71': 'Transfer Data Suspended',
            '72': 'General Programming Failure',
            '73': 'Wrong Block Sequence Counter',
            '78': 'Request Correctly Received - Response Pending',
            '7E': 'Sub-function Not Supported In Active Session',
            '7F': 'Service Not Supported In Active Session'
          }

          const rejectedServiceName = serviceNamesMap[rejectedService.toUpperCase()] || `Service 0x${rejectedService}`
          const nrcText = nrcCodes[nrc.toUpperCase()] || `NRC 0x${nrc}`

          // Format with newline for better readability
          description = `Negative Response\n${rejectedServiceName}: ${nrcText}`
          details.rejectedService = rejectedService
          details.rejectedServiceName = rejectedServiceName
          details.nrc = nrc
        }
        break
    }

    return { service: serviceId, description, details }
  }

  // Generate description for service
  function generateDescriptionForService(
    serviceId: string,
    data: string,
    isRequest: boolean,
    protocol?: string
  ): string {
    const service = parseInt(serviceId, 16)

    // Strip 0x prefix from data if present
    const cleanData = data && (data.startsWith('0x') || data.startsWith('0X')) ? data.substring(2) : data || ''

    // Check if it's an OBD-II service
    if ((service >= 0x01 && service <= 0x0A) || (service >= 0x41 && service <= 0x4A)) {
      // For OBD-II services, we need to extract just the data portion (skip the service ID)
      const dataPortionOnly = cleanData.startsWith(serviceId) ? cleanData.substring(2) : cleanData
      return decodeOBDIIService(serviceId, dataPortionOnly, isRequest)
    }

    // Otherwise use UDS decoding
    // Check if the data already starts with the service ID
    let fullData = ''
    if (cleanData.startsWith(serviceId.toLowerCase()) || cleanData.startsWith(serviceId.toUpperCase())) {
      // Data already contains the service ID, use as-is
      fullData = cleanData
    } else {
      // Data doesn't contain service ID, prepend it
      fullData = serviceId + cleanData
    }

    const decoded = decodeUDSMessage(fullData, isRequest, protocol)
    if (decoded.description) {
      return decoded.description
    }

    // Fall back to service name
    return getServiceName(serviceId, protocol)
  }

  // Get service style with color and icon
  const getServiceStyle = (service: string) => {
    const serviceStyles: Record<string, { color: string, icon: any, bgColor: string }> = {
      '10': { color: colors.primary[700], icon: Power, bgColor: colors.primary[100] }, // Diagnostic Session
      '11': { color: colors.info[700], icon: RotateCw, bgColor: colors.info[100] }, // ECU Reset
      '14': { color: '#7C3AED', icon: Trash2, bgColor: '#EDE9FE' }, // Clear DTCs - Purple
      '19': { color: colors.error[700], icon: AlertTriangle, bgColor: colors.error[100] }, // Read DTCs
      '20': { color: '#DC2626', icon: Square, bgColor: '#FEE2E2' }, // Stop Diagnostic Session - Red
      '22': { color: colors.success[700], icon: FileText, bgColor: colors.success[100] }, // Read Data
      '23': { color: '#7C3AED', icon: HardDrive, bgColor: '#EDE9FE' }, // Read Memory - Purple
      '27': { color: colors.warning[700], icon: Lock, bgColor: colors.warning[100] }, // Security Access
      '28': { color: '#0891B2', icon: Network, bgColor: '#CFFAFE' }, // Communication Control - Teal
      '29': { color: colors.warning[700], icon: Key, bgColor: colors.warning[100] }, // Authentication
      '2E': { color: '#4F46E5', icon: Upload, bgColor: '#E0E7FF' }, // Write Data - Indigo
      '2F': { color: '#DB2777', icon: Settings, bgColor: '#FCE7F3' }, // Input/Output Control - Pink
      '31': { color: '#EA580C', icon: Play, bgColor: '#FED7AA' }, // Routine Control - Orange
      '3E': { color: '#0891B2', icon: Activity, bgColor: '#CFFAFE' }, // Tester Present - Cyan
      '7F': { color: '#DC2626', icon: AlertCircle, bgColor: '#FEE2E2' }, // Negative Response - Red
      '85': { color: '#D97706', icon: Shield, bgColor: '#FEF3C7' }, // Control DTC Setting - Amber
      // OBD-II services
      '01': { color: '#2563EB', icon: Gauge, bgColor: '#DBEAFE' }, // Current Data - Blue
      '02': { color: colors.success[700], icon: Clock, bgColor: colors.success[100] }, // Freeze Frame
      '03': { color: colors.error[700], icon: AlertCircle, bgColor: colors.error[100] }, // Stored DTCs
      '04': { color: colors.gray[700], icon: Trash2, bgColor: colors.gray[100] }, // Clear DTCs
      '05': { color: '#7C3AED', icon: Terminal, bgColor: '#EDE9FE' }, // Oxygen Sensor - Purple
      '06': { color: '#4F46E5', icon: Zap, bgColor: '#E0E7FF' }, // Test Results - Indigo
      '07': { color: '#EA580C', icon: AlertTriangle, bgColor: '#FED7AA' }, // Pending DTCs - Orange
      '08': { color: '#0891B2', icon: Wrench, bgColor: '#CFFAFE' }, // Control Operation - Teal
      '09': { color: '#DB2777', icon: Info, bgColor: '#FCE7F3' }, // Vehicle Info - Pink
      '0A': { color: '#D97706', icon: Database, bgColor: '#FEF3C7' } // Permanent DTCs - Amber
    }

    const upperService = service.toUpperCase()
    return serviceStyles[upperService] || {
      color: colors.gray[700],
      icon: Binary,
      bgColor: colors.gray[100]
    }
  }

  // Get service name based on protocol
  function getServiceName(serviceId: string, protocol?: string): string {
    const service = parseInt(serviceId, 16)

    // Check if it's an OBD-II service (01-0A, 41-4A)
    if ((service >= 0x01 && service <= 0x0A) || (service >= 0x41 && service <= 0x4A)) {
      const obdiiName = decodeOBDIIService(serviceId, '', service < 0x40)
      if (obdiiName) return obdiiName
    }

    // KWP2000 services
    const kwp2000Services: Record<string, string> = {
      '10': 'Start Diagnostic Session',
      '11': 'ECU Reset',
      '12': 'Read Freeze Frame Data',
      '13': 'Read Diagnostic Trouble Codes',
      '14': 'Clear Diagnostic Information',
      '17': 'Read Status Of DTC',
      '18': 'Read DTC By Status',
      '1A': 'Read ECU Identification',
      '20': 'Stop Diagnostic Session',
      '21': 'Read Data By Local ID',
      '22': 'Read Data By Common ID',
      '23': 'Read Memory By Address',
      '24': 'Set Data Rates',
      '25': 'Security Access Seed',
      '26': 'Security Access Key',
      '27': 'Security Access',
      '28': 'Disable Normal Communication',
      '29': 'Enable Normal Communication',
      '2C': 'Dynamically Define Data ID',
      '2E': 'Write Data By Common ID',
      '2F': 'Input Output Control By Common ID',
      '30': 'Input Output Control By Local ID',
      '31': 'Start Routine By Local ID',
      '32': 'Stop Routine By Local ID',
      '33': 'Request Routine Results By Local ID',
      '34': 'Request Download',
      '35': 'Request Upload',
      '36': 'Transfer Data',
      '37': 'Request Transfer Exit',
      '38': 'Start Routine By Address',
      '39': 'Stop Routine By Address',
      '3A': 'Request Routine Results By Address',
      '3B': 'Write Data By Local ID',
      '3D': 'Write Memory By Address',
      '3E': 'Tester Present',
      '7F': 'Negative Response',
      '81': 'Start Communication',
      '82': 'Stop Communication',
      '83': 'Access Timing Parameters',
      '84': 'Secured Data Transmission',
      '85': 'Control DTC Settings',
      '86': 'Response On Event',
      '87': 'Link Control'
    }

    // UDS services
    const udsServices: Record<string, string> = {
      '10': 'Diagnostic Session Control',
      '11': 'ECU Reset',
      '14': 'Clear Diagnostic Information',
      '19': 'Read DTC Information',
      '22': 'Read Data By Identifier',
      '23': 'Read Memory By Address',
      '24': 'Read Scaling Data By Identifier',
      '27': 'Security Access',
      '28': 'Communication Control',
      '29': 'Authentication',
      '2A': 'Read Data By Periodic Identifier',
      '2C': 'Dynamically Define Data Identifier',
      '2E': 'Write Data By Identifier',
      '2F': 'Input Output Control By Identifier',
      '31': 'Routine Control',
      '34': 'Request Download',
      '35': 'Request Upload',
      '36': 'Transfer Data',
      '37': 'Request Transfer Exit',
      '38': 'Request File Transfer',
      '3D': 'Write Memory By Address',
      '3E': 'Tester Present',
      '60': 'Manufacturer Specific',
      // Response codes (0x40 offset)
      '50': 'Diagnostic Session Control',
      '51': 'ECU Reset',
      '54': 'Clear Diagnostic Information',
      '59': 'Read DTC Information',
      '62': 'Read Data By Identifier',
      '63': 'Read Memory By Address',
      '64': 'Read Scaling Data By Identifier',
      '67': 'Security Access',
      '68': 'Communication Control',
      '69': 'Authentication',
      '6A': 'Read Data By Periodic Identifier',
      '6C': 'Dynamically Define Data Identifier',
      '6E': 'Write Data By Identifier',
      '6F': 'Input Output Control By Identifier',
      '71': 'Routine Control',
      '74': 'Request Download',
      '75': 'Request Upload',
      '76': 'Transfer Data',
      '77': 'Request Transfer Exit',
      '78': 'Request File Transfer',
      '7D': 'Write Memory By Address',
      '7E': 'Tester Present',
      '7F': 'Negative Response',
      'C4': 'Secured Data Transmission',
      'C5': 'Control DTC Setting',
      'C6': 'Response On Event',
      'C7': 'Link Control'
    }

    // Convert to uppercase and ensure 2 digits for consistency with map keys
    const hexService = serviceId.toUpperCase().padStart(2, '0')

    // Try protocol-specific lookup first
    if (protocol === 'KWP2000') {
      return kwp2000Services[hexService] || udsServices[hexService] || `Service 0x${hexService}`
    }

    // Default to UDS, fall back to KWP2000 if not found
    return udsServices[hexService] || kwp2000Services[hexService] || `Service 0x${hexService}`
  }

  const fetchEcuNames = async (addresses: string[], vehicle?: any) => {
    if (!addresses.length) return

    setFetchingNames(true)
    try {
      const response = await fetch('/api/knowledge/ecu/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addresses,
          vehicleId: vehicle?.id,
          modelYearId: vehicle?.ModelYear?.id,
          modelId: vehicle?.ModelYear?.Model?.id,
          oemId: vehicle?.ModelYear?.Model?.OEM?.id
        })
      })

      if (response.ok) {
        const names = await response.json()
        setEcuNames(names)
      }
    } catch (error) {
      console.error('Error fetching ECU names:', error)
    } finally {
      setFetchingNames(false)
    }
  }

  const fetchJob = async () => {
    try {
      // Get the job ID from params
      const jobId = params.id || params
      console.log('FetchJob - params:', params, 'jobId:', jobId)

      if (!jobId) {
        console.error('Unable to determine job ID')
        setLoading(false)
        return
      }

      const response = await fetch(`/api/jobs/${jobId}`)
      if (response.ok) {
        const data = await response.json()
        setJob(data)

        // Process messages and ECUs
        let allMessages: any[] = []
        if (data.metadata && data.metadata.messages) {
          allMessages = data.metadata.messages.map((msg: any) => {
            // Extract service code properly considering ISO-TP
            let serviceCode = ''
            if (msg.data) {
              const cleanData = msg.data.replace(/^0x/i, '').toUpperCase()
              if (cleanData.length >= 2) {
                // For non-DoIP protocols, check for ISO-TP framing
                if (msg.protocol !== 'DoIP') {
                  const firstByte = parseInt(cleanData.substring(0, 2), 16)
                  // Check if it's an ISO-TP single frame (0x01-0x07)
                  if (firstByte >= 0x01 && firstByte <= 0x07) {
                    // Extract service code after ISO-TP header
                    serviceCode = cleanData.substring(2, 4)
                  } else {
                    // No ISO-TP framing, service code is first byte
                    serviceCode = cleanData.substring(0, 2)
                  }
                } else {
                  // DoIP doesn't use ISO-TP
                  serviceCode = cleanData.substring(0, 2)
                }
              }
            }

            return {
              ...msg,
              timestamp: msg.timestamp || new Date().toISOString(),
              isRequest: msg.direction === 'Local->Remote',
              serviceCode,
              sourceAddr: msg.sourceAddr || msg.source,
              targetAddr: msg.targetAddr || msg.target,
              diagnosticProtocol: msg.diagnosticProtocol // Preserve diagnostic protocol from parser
            }
          })
          setMessages(allMessages)
        } else {
          setMessages([])
        }

        // Use metadata.ecus if available (it has better data), otherwise fallback to ECUConfiguration
        if (data.metadata?.ecus && data.metadata.ecus.length > 0) {
          const ecuSummaries = data.metadata.ecus.map((ecu: any) => {
            // Determine diagnostic protocol based on transport protocol
            let diagnosticProtocol: 'OBD-II' | 'UDS' | 'KWP2000' | undefined
            const transportProtocol = ecu.protocol
            if (transportProtocol === 'EOBD') {
              diagnosticProtocol = 'OBD-II'
            } else if (transportProtocol === 'ISO14230') {
              diagnosticProtocol = 'KWP2000'
            } else if (transportProtocol === 'DoIP' || transportProtocol === 'HONDA ISOTP' ||
                       transportProtocol === 'HYUNDAI/KIA ISOTP') {
              diagnosticProtocol = 'UDS'
            }

            return {
              address: ecu.address,
              name: ecu.name || `ECU_${ecu.address}`,
              messageCount: ecu.messageCount || 0,
              services: ecu.services || [],
              sessionTypes: ecu.sessionTypes ? Array.from(ecu.sessionTypes) : [],
              securityLevels: ecu.securityLevels ? Array.from(ecu.securityLevels) : [],
              dtcs: ecu.dtcCount || 0,
              dids: ecu.didCount || 0,
              routines: ecu.routineCount || 0,
              protocol: transportProtocol,
              diagnosticProtocol
            }
          })
          setEcus(ecuSummaries)

          const addresses = ecuSummaries.map((ecu: any) => ecu.address)
          fetchEcuNames(addresses, data.Vehicle)
        } else if (data.ECUConfiguration && data.ECUConfiguration.length > 0) {
          // Fallback to ECUConfiguration if metadata.ecus is not available
          // Extract services from actual messages with proper decoding
          const ecuServicesFromMessages: Record<string, Set<string>> = {}

          if (allMessages && allMessages.length > 0) {
            allMessages.forEach((msg: any) => {
              // Skip messages without data
              if (!msg.data || msg.data.trim().length < 2) return

              // Properly decode the message to get the actual service ID
              const decoded = decodeUDSMessage(msg.data || '', msg.isRequest, msg.diagnosticProtocol, msg.protocol)
              if (!decoded.service) return

              // For requests, track the service for the target ECU
              // For responses, track the service for the source ECU
              const ecuAddr = msg.isRequest ? msg.targetAddr : msg.sourceAddr

              // Skip tester addresses only
              if (!ecuAddr || ecuAddr === 'F1' || ecuAddr === 'TESTER') return

              if (!ecuServicesFromMessages[ecuAddr]) {
                ecuServicesFromMessages[ecuAddr] = new Set()
              }
              ecuServicesFromMessages[ecuAddr].add(decoded.service)
            })
          }

          const ecuSummaries = data.ECUConfiguration.map((ecu: any) => {
            // Try to match ECU address - handle both direct match and ECU_X format
            let services = ecuServicesFromMessages[ecu.targetAddress]
              ? Array.from(ecuServicesFromMessages[ecu.targetAddress])
              : (ecu.metadata?.services ? Array.from(ecu.metadata.services).filter(s => {
                  // Filter out invalid services from metadata
                  // Include both UDS and OBD-II services
                  const validUDSServices = ['10', '11', '14', '19', '22', '27', '2E', '2F', '31', '3E',
                                         '50', '51', '54', '59', '62', '67', '6E', '6F', '71', '7E', '7F']
                  const validOBDServices = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '0A', '0a',
                                         '41', '42', '43', '44', '45', '46', '47', '48', '49', '4A', '4a']
                  const serviceStr = String(s)
                  const isValid = validUDSServices.includes(serviceStr.toUpperCase()) ||
                                  validOBDServices.includes(serviceStr) ||
                                  validOBDServices.includes(serviceStr.toUpperCase())
                  return isValid
                }) : [])

            // Determine diagnostic protocol based on transport protocol
            let diagnosticProtocol: 'OBD-II' | 'UDS' | 'KWP2000' | undefined
            const transportProtocol = ecu.metadata?.protocol
            if (transportProtocol === 'EOBD') {
              diagnosticProtocol = 'OBD-II'
            } else if (transportProtocol === 'ISO14230') {
              diagnosticProtocol = 'KWP2000'
            } else if (transportProtocol === 'DoIP' || transportProtocol === 'HONDA ISOTP' ||
                       transportProtocol === 'HYUNDAI/KIA ISOTP') {
              diagnosticProtocol = 'UDS'
            }

            return {
              address: ecu.targetAddress,
              name: ecu.ecuName || `ECU_${ecu.targetAddress}`,
              messageCount: ecu.metadata?.messageCount || 0,
              services,
              sessionTypes: ecu.metadata?.sessionTypes ? Array.from(ecu.metadata.sessionTypes) : [],
              securityLevels: ecu.metadata?.securityLevels ? Array.from(ecu.metadata.securityLevels) : [],
              dtcs: data.DTC?.filter((dtc: any) => dtc.ecuName === ecu.ecuName).map((d: any) => d.code) || [],
              dids: data.DataIdentifier?.filter((did: any) => did.ecuName === ecu.ecuName).map((d: any) => d.did) || [],
              routines: data.Routine?.filter((r: any) => r.ecuName === ecu.ecuName).map((r: any) => r.routineId) || [],
              protocol: transportProtocol,
              diagnosticProtocol
            }
          })
          setEcus(ecuSummaries)

          const addresses = ecuSummaries.map((ecu: any) => ecu.address)
          fetchEcuNames(addresses, data.Vehicle)
        }
      }
    } catch (error) {
      console.error('Error fetching job:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReparse = async () => {
    try {
      // Get the job ID from params
      const jobId = params.id || params
      console.log('Reparse - params:', params, 'jobId:', jobId)

      if (!jobId) {
        alert('Unable to determine job ID')
        return
      }

      // Call the reparse API endpoint
      const response = await fetch(`/api/jobs/${jobId}/reparse`, {
        method: 'POST'
      })

      if (response.ok) {
        // Refresh the page data after successful reparse
        await fetchJob()
        alert('Job reparsed successfully!')
      } else {
        const error = await response.json()
        alert(`Failed to reparse: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error reparsing job:', error)
      alert('Failed to reparse job')
    }
  }

  const handleDownload = () => {
    console.log('Download report')
  }

  if (loading) {
    return (
      <PageLayout title="Loading..." description="Please wait">
        <div className="ds-container">
          <div className="ds-loading">Loading job details...</div>
        </div>
      </PageLayout>
    )
  }

  if (!job) {
    return (
      <PageLayout title="Job Not Found" description="Unable to load job">
        <div className="ds-container">
          <Card>
            <p>Job not found</p>
            <Button variant="secondary" onClick={() => router.push('/jobs')}>
              Back to Jobs
            </Button>
          </Card>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title={job.name || "Job Details"}
      description={`Job #${job.id.slice(0, 8).toUpperCase()}`}>
      <div className="ds-container">
        {/* Action Bar */}
        <div className="ds-flex-between" style={{ marginBottom: spacing[6] }}>
          <Button
            variant="ghost"
            icon={<ChevronLeft size={16} />}
            onClick={() => router.push('/jobs')}
          >
            Back to Jobs
          </Button>
          <div className="ds-flex-row" style={{ gap: spacing[3] }}>
            <Button
              variant="secondary"
              icon={<RefreshCw size={16} />}
              onClick={handleReparse}
            >
              Reparse
            </Button>
            <Button
              variant="primary"
              icon={<Download size={16} />}
              onClick={handleDownload}
            >
              Download Report
            </Button>
          </div>
        </div>

        {/* Vehicle Information Banner */}
        <div style={{
          padding: spacing[4],
          backgroundColor: colors.primary[50],
          borderRadius: '12px',
          border: `1px solid ${colors.primary[200]}`,
          marginBottom: spacing[6],
          display: 'flex',
          alignItems: 'center',
          gap: spacing[4]
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            backgroundColor: colors.primary[100],
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Car size={24} color={colors.primary[600]} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '20px', fontWeight: 600, color: colors.primary[900], marginBottom: '4px' }}>
              {job.Vehicle?.ModelYear?.Model?.OEM?.name || ''} {job.Vehicle?.ModelYear?.Model?.name || 'Unknown Vehicle'}
            </div>
            <div style={{ display: 'flex', gap: spacing[4], alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '16px', color: colors.primary[700] }}>
                <Calendar size={14} style={{ display: 'inline', marginRight: '4px' }} />
                {job.Vehicle?.ModelYear?.year || 'Unknown Year'}
              </span>
              {(() => {
                const vinSource = extractVINWithSource(job)
                if (vinSource) {
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', color: colors.primary[600], fontFamily: 'monospace' }}>
                        VIN: {vinSource.vin}
                      </span>
                      <Badge
                        variant={getVINSourceColor(vinSource)}
                        size="small"
                        title={`VIN from ${formatVINSource(vinSource)}`}
                      >
                        <Info size={12} style={{ display: 'inline', marginRight: '4px' }} />
                        {formatVINSource(vinSource)}
                      </Badge>
                    </div>
                  )
                }
                return null
              })()}
              <Badge variant="secondary">
                Job #{job.id.slice(0, 8).toUpperCase()}
              </Badge>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="ds-grid-4" style={{ marginBottom: spacing[6] }}>
          <StatCard
            label="Total ECUs"
            value={ecus.filter(e => e.address !== '07DF').length}
            icon={<Cpu size={24} />}
            color="primary"
          />
          <StatCard
            label="Active DTCs"
            value={job.DTC?.length || 0}
            icon={<AlertCircle size={24} />}
            color="error"
          />
          <StatCard
            label="Data IDs Read"
            value={job.DataIdentifier?.length || 0}
            icon={<Database size={24} />}
            color="success"
          />
          <StatCard
            label="Routines Executed"
            value={job.Routine?.length || 0}
            icon={<Activity size={24} />}
            color="warning"
          />
        </div>

        {/* Tab Navigation - Full Width */}
        <div style={{ marginBottom: spacing[5] }}>
          <div className="ds-tab-group">
              <button
                className={`ds-tab ${activeTab === 'jifeline' ? 'ds-tab-active' : ''}`}
                onClick={() => setActiveTab('jifeline')}
              >
                <FileDigit size={14} style={{ display: 'inline-block', marginRight: '4px' }} />
                Jifeline Overview
              </button>
              <button
                className={`ds-tab ${activeTab === 'voltage' ? 'ds-tab-active' : ''}`}
                onClick={() => setActiveTab('voltage')}
              >
                <Activity size={14} style={{ display: 'inline-block', marginRight: '4px' }} />
                Diagnostic Flow
              </button>
              <button
                className={`ds-tab ${activeTab === 'ecus' ? 'ds-tab-active' : ''}`}
                onClick={() => setActiveTab('ecus')}
              >
                <Cpu size={14} style={{ display: 'inline-block', marginRight: '4px' }} />
                ECUs ({ecus.filter(e => e.address !== '07DF').length})
              </button>
              <button
                className={`ds-tab ${activeTab === 'security' ? 'ds-tab-active' : ''}`}
                onClick={() => setActiveTab('security')}
              >
                <Shield size={14} style={{ display: 'inline-block', marginRight: '4px' }} />
                Security Access
              </button>
              <button
                className={`ds-tab ${activeTab === 'flow' ? 'ds-tab-active' : ''}`}
                onClick={() => setActiveTab('flow')}
              >
                <FileText size={14} style={{ display: 'inline-block', marginRight: '4px' }} />
                Diagnostic Trace ({tabCounts.messages})
              </button>
              <button
                className={`ds-tab ${activeTab === 'dtcs' ? 'ds-tab-active' : ''}`}
                onClick={() => setActiveTab('dtcs')}
              >
                <AlertTriangle size={14} style={{ display: 'inline-block', marginRight: '4px' }} />
                DTCs ({job.DTC?.length || 0})
              </button>
              <button
                className={`ds-tab ${activeTab === 'dids' ? 'ds-tab-active' : ''}`}
                onClick={() => setActiveTab('dids')}
              >
                <Hash size={14} style={{ display: 'inline-block', marginRight: '4px' }} />
                DIDs ({job.DataIdentifier?.length || 0})
              </button>
              <button
                className={`ds-tab ${activeTab === 'routines' ? 'ds-tab-active' : ''}`}
                onClick={() => setActiveTab('routines')}
              >
                <Wrench size={14} style={{ display: 'inline-block', marginRight: '4px' }} />
                Routines ({job.Routine?.length || 0})
              </button>
              <button
                className={`ds-tab ${activeTab === 'services' ? 'ds-tab-active' : ''}`}
                onClick={() => setActiveTab('services')}
              >
                <Settings size={14} style={{ display: 'inline-block', marginRight: '4px' }} />
                Services ({tabCounts.services})
              </button>
              <button
                className={`ds-tab ${activeTab === 'eobd' ? 'ds-tab-active' : ''}`}
                onClick={() => setActiveTab('eobd')}
              >
                <Gauge size={14} style={{ display: 'inline-block', marginRight: '4px' }} />
                EOBD
              </button>
          </div>
        </div>

        {/* Tab Content */}
        <Card>
          {false && activeTab === 'overview' && (
            <div className="ds-section">
              <h3 className="ds-heading-3">Session Information</h3>
              <Card variant="nested">
                <div className="ds-grid-2" style={{ gap: spacing[5] }}>
                  <div>
                    <p className="ds-label">Vehicle VIN</p>
                    <div>
                      {(() => {
                        const vinSource = extractVINWithSource(job)
                        if (vinSource) {
                          return (
                            <div>
                              <p className="ds-value" style={{ fontFamily: 'monospace', marginBottom: '4px' }}>
                                {vinSource.vin}
                              </p>
                              <Badge
                                variant={getVINSourceColor(vinSource)}
                                size="small"
                                title={`VIN extracted from ${formatVINSource(vinSource)}`}
                              >
                                {formatVINSource(vinSource)}
                              </Badge>
                            </div>
                          )
                        }
                        return <p className="ds-value">Not Available</p>
                      })()}
                    </div>
                  </div>
                  <div>
                    <p className="ds-label">Procedure Type</p>
                    <p className="ds-value">{job.procedureType || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="ds-label">Status</p>
                    <p className="ds-value">{job.status || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="ds-label">Created</p>
                    <p className="ds-value">{new Date(job.createdAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="ds-label">Duration</p>
                    <p className="ds-value">{job.duration ? `${job.duration}ms` : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="ds-label">Total Messages</p>
                    <p className="ds-value">
                      {job?.messageCount || messages.length}
                      {job?.metadata?.messagesComplete === false && (
                        <span style={{ fontSize: '12px', color: colors.warning[600], marginLeft: '8px' }}>
                          (Only {messages.length} loaded - reparse for all)
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="ds-label">Protocol</p>
                    <p className="ds-value">DoIP/UDS</p>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <p className="ds-label">Trace File</p>
                    <p className="ds-value">{job.metadata?.traceFileName || 'N/A'}</p>
                  </div>
                </div>
              </Card>

              {/* Security Access Analysis */}
              <h3 className="ds-heading-3" style={{ marginTop: spacing[6] }}>Security Access Analysis</h3>
              <Card variant="nested">
                {(() => {
                  const securityEvents = analyzeSecurityAccess()
                  // Check both messages and ECU metadata for security access
                  const ecuWithSecurity = ecus.filter(e => e.securityLevels.length > 0)
                  const hasSecurityAccess = securityEvents.length > 0 || ecuWithSecurity.length > 0
                  const successfulAuths = securityEvents.filter(e => e.type === 'Key Accepted').length
                  const failedAuths = securityEvents.filter(e => e.type === 'Security Access Rejected').length
                  const uniqueEcus = ecuWithSecurity.length > 0 ? ecuWithSecurity :
                    [...new Set(securityEvents.filter(e => e.target !== '0E80').map(e => e.target))]

                  return (
                    <div>
                      {hasSecurityAccess ? (
                        <>
                          <div className="ds-grid-3" style={{ gap: spacing[4], marginBottom: spacing[4] }}>
                            <div style={{
                              padding: spacing[3],
                              backgroundColor: colors.success[50],
                              borderRadius: '8px',
                              border: `1px solid ${colors.success[200]}`
                            }}>
                              <p className="ds-label" style={{ color: colors.success[700] }}>Successful Authentications</p>
                              <p style={{ fontSize: '24px', fontWeight: 600, color: colors.success[700] }}>
                                {successfulAuths}
                              </p>
                            </div>
                            <div style={{
                              padding: spacing[3],
                              backgroundColor: failedAuths > 0 ? colors.error[50] : colors.gray[50],
                              borderRadius: '8px',
                              border: `1px solid ${failedAuths > 0 ? colors.error[200] : colors.gray[200]}`
                            }}>
                              <p className="ds-label" style={{ color: failedAuths > 0 ? colors.error[700] : colors.gray[700] }}>Failed Attempts</p>
                              <p style={{ fontSize: '24px', fontWeight: 600, color: failedAuths > 0 ? colors.error[700] : colors.gray[700] }}>
                                {failedAuths}
                              </p>
                            </div>
                            <div style={{
                              padding: spacing[3],
                              backgroundColor: colors.primary[50],
                              borderRadius: '8px',
                              border: `1px solid ${colors.primary[200]}`
                            }}>
                              <p className="ds-label" style={{ color: colors.primary[700] }}>ECUs with Security</p>
                              <p style={{ fontSize: '24px', fontWeight: 600, color: colors.primary[700] }}>
                                {ecuWithSecurity.length > 0 ? ecuWithSecurity.length : uniqueEcus.length}
                              </p>
                            </div>
                          </div>

                          <div style={{ marginTop: spacing[4] }}>
                            {securityEvents.length > 0 ? (
                              <>
                                <h4 className="ds-heading-4" style={{ marginBottom: spacing[3] }}>Security Events</h4>
                                <div style={{ overflowX: 'auto' }}>
                                  <table className="ds-table" style={{ width: '100%' }}>
                                    <thead>
                                      <tr>
                                        <th style={{ padding: spacing[2], textAlign: 'left' }}>Time</th>
                                        <th style={{ padding: spacing[2], textAlign: 'left' }}>ECU</th>
                                        <th style={{ padding: spacing[2], textAlign: 'left' }}>Event</th>
                                        <th style={{ padding: spacing[2], textAlign: 'left' }}>Level</th>
                                        <th style={{ padding: spacing[2], textAlign: 'left' }}>Data/Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {securityEvents.map((event, idx) => (
                                    <tr key={idx} style={{
                                      borderBottom: `1px solid ${colors.border.light}`,
                                      backgroundColor: event.type === 'Key Accepted' ? colors.success[50] :
                                                      event.type === 'Security Access Rejected' ? colors.error[50] :
                                                      'transparent'
                                    }}>
                                      <td style={{ padding: spacing[2], fontFamily: 'monospace', fontSize: '12px' }}>
                                        {event.timestamp || 'N/A'}
                                      </td>
                                      <td style={{ padding: spacing[2] }}>
                                        {event.target === '0E80' ? 'Tester' :
                                          (ecuNames[event.target]?.name || event.target)}
                                      </td>
                                      <td style={{ padding: spacing[2] }}>
                                        <Badge
                                          variant={event.type === 'Key Accepted' ? 'success' :
                                                  event.type === 'Security Access Rejected' ? 'error' :
                                                  'secondary'}
                                          size="small"
                                        >
                                          {event.type}
                                        </Badge>
                                      </td>
                                      <td style={{ padding: spacing[2] }}>
                                        {event.level || '-'}
                                      </td>
                                      <td style={{ padding: spacing[2], fontFamily: 'monospace', fontSize: '12px' }}>
                                        {event.data || '-'}
                                      </td>
                                    </tr>
                                  ))}
                                    </tbody>
                                  </table>
                                </div>
                              </>
                            ) : ecuWithSecurity.length > 0 ? (
                              <>
                                <h4 className="ds-heading-4" style={{ marginBottom: spacing[3] }}>ECUs with Security Access</h4>
                                <div className="ds-flex-row ds-flex-wrap" style={{ gap: spacing[3] }}>
                                  {ecuWithSecurity.map(ecu => (
                                    <Card key={ecu.address} variant="nested">
                                      <div className="ds-flex-row" style={{ gap: spacing[3], alignItems: 'center' }}>
                                        <Badge variant="secondary">{ecu.address}</Badge>
                                        <span>{ecu.name}</span>
                                      </div>
                                      <div className="ds-flex-row ds-flex-wrap" style={{ gap: spacing[2], marginTop: spacing[2] }}>
                                        {ecu.securityLevels.map(level => (
                                          <Badge key={level} variant="info" size="small">
                                            Level 0x{level}
                                          </Badge>
                                        ))}
                                      </div>
                                    </Card>
                                  ))}
                                </div>
                              </>
                            ) : null}
                          </div>
                        </>
                      ) : (
                        <div style={{
                          padding: spacing[6],
                          textAlign: 'center',
                          backgroundColor: colors.gray[50],
                          borderRadius: '8px'
                        }}>
                          <AlertCircle size={48} color={colors.gray[400]} style={{ marginBottom: spacing[3] }} />
                          <p style={{ fontSize: '16px', fontWeight: 500, marginBottom: spacing[2] }}>
                            No Security Access Detected
                          </p>
                          <p className="ds-text-secondary">
                            This trace does not contain any security access (0x27) service requests
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </Card>
            </div>
          )}

          {activeTab === 'jifeline' && (
            <div className="ds-section">
              <h3 className="ds-heading-3">Jifeline Trace Overview</h3>

              {/* Main Information Grid */}
              <div className="ds-grid-2" style={{ gap: spacing[4], marginBottom: spacing[4] }}>
                {/* Session & Vehicle Info */}
                <Card variant="nested">
                  <h4 className="ds-heading-4" style={{ marginBottom: spacing[3], color: colors.primary[700] }}>
                    Session Details
                  </h4>
                  <div className="ds-stack" style={{ gap: spacing[3] }}>
                    <div>
                      <p className="ds-label">Vehicle VIN</p>
                      {(() => {
                        const vinSource = extractVINWithSource(job)
                        if (vinSource) {
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
                              <p className="ds-value" style={{ fontFamily: 'monospace' }}>
                                {vinSource.vin}
                              </p>
                              <Badge
                                variant={getVINSourceColor(vinSource)}
                                size="small"
                                title={`VIN extracted from ${formatVINSource(vinSource)}`}
                              >
                                {formatVINSource(vinSource)}
                              </Badge>
                            </div>
                          )
                        }
                        return <p className="ds-value">Not Available</p>
                      })()}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[3] }}>
                      <div>
                        <p className="ds-label">Procedure</p>
                        <p className="ds-value">{job.procedureType || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="ds-label">Status</p>
                        <Badge variant={job.status === 'COMPLETED' ? 'success' : 'info'}>
                          {job.status || 'Unknown'}
                        </Badge>
                      </div>
                      <div>
                        <p className="ds-label">Created</p>
                        <p className="ds-value" style={{ fontSize: '13px' }}>{new Date(job.createdAt).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="ds-label">Trace File</p>
                        <p className="ds-value" style={{ fontSize: '13px' }}>{job.metadata?.traceFileName || job.name || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Communication Overview */}
                <Card variant="nested">
                  <h4 className="ds-heading-4" style={{ marginBottom: spacing[3], color: colors.primary[700] }}>
                    Communication Overview
                  </h4>
                  <div className="ds-stack" style={{ gap: spacing[3] }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing[3] }}>
                      <div>
                        <p className="ds-label">Protocol</p>
                        <Badge variant="secondary">
                          {(() => {
                            // Find most common protocol
                            const protocolCounts = messages.reduce((acc: any, msg: any) => {
                              const protocol = msg.protocol || 'Unknown'
                              acc[protocol] = (acc[protocol] || 0) + 1
                              return acc
                            }, {})
                            const mostCommon = Object.entries(protocolCounts)
                              .sort(([,a]: any, [,b]: any) => b - a)[0]
                            return mostCommon ? mostCommon[0] : 'Unknown'
                          })()}
                        </Badge>
                      </div>
                      <div>
                        <p className="ds-label">Diagnostic</p>
                        <Badge variant="secondary">
                          {(() => {
                            // Find most common diagnostic protocol
                            const diagnosticCounts = messages.reduce((acc: any, msg: any) => {
                              const diagnostic = msg.diagnosticProtocol || 'Unknown'
                              acc[diagnostic] = (acc[diagnostic] || 0) + 1
                              return acc
                            }, {})
                            const mostCommon = Object.entries(diagnosticCounts)
                              .sort(([,a]: any, [,b]: any) => b - a)[0]
                            return mostCommon ? mostCommon[0] : 'Unknown'
                          })()}
                        </Badge>
                      </div>
                      <div>
                        <p className="ds-label">Tester Address</p>
                        <Badge variant="info">
                          {(() => {
                            // Determine tester address based on most common protocol
                            const protocolCounts = messages.reduce((acc: any, msg: any) => {
                              const protocol = msg.protocol || 'Unknown'
                              acc[protocol] = (acc[protocol] || 0) + 1
                              return acc
                            }, {})
                            const mostCommonProtocol = Object.entries(protocolCounts)
                              .sort(([,a]: any, [,b]: any) => b - a)[0]?.[0] || ''

                            // Return appropriate tester address based on protocol
                            if (mostCommonProtocol.toLowerCase().includes('doip')) {
                              return '0E80'  // DoIP tester address
                            } else {
                              return 'F1'    // ISO-TP/CAN tester address (ISO 14229 standard)
                            }
                          })()}
                        </Badge>
                      </div>
                      <div>
                        <p className="ds-label">ECUs Found</p>
                        <p className="ds-value">{ecus.filter(e => e.address !== '07DF').length}</p>
                      </div>
                    </div>
                    {/* Protocol Distribution Bar */}
                    <div style={{ marginTop: spacing[2] }}>
                      <p className="ds-label" style={{ marginBottom: spacing[2] }}>Protocol Usage</p>
                      {(() => {
                        const protocols = messages.reduce((acc: any, msg: any) => {
                          const protocol = msg.protocol || 'Unknown'
                          acc[protocol] = (acc[protocol] || 0) + 1
                          return acc
                        }, {})

                        const getProtocolColor = (protocol: string) => {
                          if (protocol.includes('EOBD')) return colors.success[500]
                          if (protocol.includes('ISOTP')) return colors.primary[500]
                          if (protocol.includes('DoIP')) return colors.info[500]
                          return colors.gray[500]
                        }

                        return (
                          <div>
                            <div className="ds-flex-row" style={{
                              gap: '2px',
                              height: '28px',
                              marginBottom: '8px',
                              backgroundColor: colors.background.secondary,
                              padding: '2px',
                              borderRadius: '6px'
                            }}>
                              {Object.entries(protocols)
                                .sort(([, a]: any, [, b]: any) => b - a)
                                .map(([protocol, count]: any) => {
                                  const percentage = (count / messages.length) * 100
                                  return (
                                    <div
                                      key={protocol}
                                      style={{
                                        flex: count,
                                        backgroundColor: getProtocolColor(protocol),
                                        borderRadius: '4px',
                                        minWidth: percentage > 2 ? '0' : '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                        fontSize: '10px',
                                        fontWeight: 600,
                                        padding: '0 2px',
                                        position: 'relative',
                                        overflow: 'hidden'
                                      }}
                                      title={`${protocol}: ${count} messages (${percentage.toFixed(1)}%)`}
                                    >
                                      {percentage > 10 && (
                                        <span style={{ textShadow: '0 0 2px rgba(0,0,0,0.5)' }}>
                                          {protocol.replace('HYUNDAI/KIA ', '')} {percentage.toFixed(0)}%
                                        </span>
                                      )}
                                    </div>
                                  )
                                })
                              }
                            </div>
                            <div className="ds-flex-row ds-flex-wrap" style={{ gap: spacing[2], fontSize: '11px' }}>
                              {Object.entries(protocols).map(([protocol, count]: any) => (
                                <div key={protocol} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <div style={{
                                    width: '12px',
                                    height: '12px',
                                    backgroundColor: getProtocolColor(protocol),
                                    borderRadius: '2px'
                                  }} />
                                  <span style={{ color: colors.text.secondary }}>
                                    {protocol} ({((count / messages.length) * 100).toFixed(0)}%)
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                </Card>
              </div>

              {/* Message Statistics */}
              <Card variant="nested" style={{ marginBottom: spacing[4] }}>
                <h4 className="ds-heading-4" style={{ marginBottom: spacing[3], color: colors.primary[700] }}>
                  Message Analysis
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: spacing[3] }}>
                  <div style={{
                    padding: spacing[2],
                    backgroundColor: colors.background.secondary,
                    borderRadius: '6px',
                    textAlign: 'center'
                  }}>
                    <p className="ds-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Total Messages</p>
                    <p className="ds-value" style={{ fontSize: '20px', fontWeight: 600 }}>
                      {job?.messageCount || messages.length}
                    </p>
                    {job?.metadata?.messagesComplete === false && (
                      <p style={{ fontSize: '10px', color: colors.warning[600] }}>
                        Partial: {messages.length}
                      </p>
                    )}
                  </div>

                  <div style={{
                    padding: spacing[2],
                    backgroundColor: colors.background.secondary,
                    borderRadius: '6px',
                    textAlign: 'center'
                  }}>
                    <p className="ds-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Requests</p>
                    <p className="ds-value" style={{ fontSize: '20px', fontWeight: 600, color: colors.primary[600] }}>
                      {messages.filter(m => m.isRequest).length}
                    </p>
                  </div>

                  <div style={{
                    padding: spacing[2],
                    backgroundColor: colors.background.secondary,
                    borderRadius: '6px',
                    textAlign: 'center'
                  }}>
                    <p className="ds-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Responses</p>
                    <p className="ds-value" style={{ fontSize: '20px', fontWeight: 600, color: colors.success[600] }}>
                      {messages.filter(m => !m.isRequest).length}
                    </p>
                  </div>

                  <div style={{
                    padding: spacing[2],
                    backgroundColor: colors.background.secondary,
                    borderRadius: '6px',
                    textAlign: 'center'
                  }}>
                    <p className="ds-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Negative</p>
                    <p className="ds-value" style={{ fontSize: '20px', fontWeight: 600, color: colors.error[600] }}>
                      {messages.filter(m => {
                        const decoded = decodeUDSMessage(m.data || '', m.isRequest, m.diagnosticProtocol, m.protocol)
                        return decoded.service === '7F'
                      }).length}
                    </p>
                  </div>

                  <div style={{
                    padding: spacing[2],
                    backgroundColor: colors.background.secondary,
                    borderRadius: '6px',
                    textAlign: 'center'
                  }}>
                    <p className="ds-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Services</p>
                    <p className="ds-value" style={{ fontSize: '20px', fontWeight: 600 }}>
                      {tabCounts.filterOptions.services.length}
                    </p>
                  </div>

                  <div style={{
                    padding: spacing[2],
                    backgroundColor: colors.background.secondary,
                    borderRadius: '6px',
                    textAlign: 'center'
                  }}>
                    <p className="ds-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Duration</p>
                    <p className="ds-value" style={{ fontSize: '14px', fontWeight: 600 }}>
                      {(() => {
                        if (!messages || messages.length < 2) return 'N/A'
                        const start = messages[0].timestamp
                        const end = messages[messages.length - 1].timestamp
                        const parseTime = (time: string) => {
                          const parts = time.split(':')
                          if (parts.length !== 3) return 0
                          const [hours, minutes, seconds] = parts
                          const [secs, ms] = seconds.split('.')
                          return parseInt(hours) * 3600000 + parseInt(minutes) * 60000 + parseInt(secs) * 1000 + parseInt(ms || '0')
                        }
                        const durationMs = parseTime(end) - parseTime(start)
                        const minutes = Math.floor(durationMs / 60000)
                        const seconds = Math.floor((durationMs % 60000) / 1000)
                        return `${minutes}m ${seconds}s`
                      })()}
                    </p>
                  </div>

                  <div style={{
                    padding: spacing[2],
                    backgroundColor: colors.background.secondary,
                    borderRadius: '6px',
                    textAlign: 'center'
                  }}>
                    <p className="ds-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Rate</p>
                    <p className="ds-value" style={{ fontSize: '14px', fontWeight: 600 }}>
                      {(() => {
                        if (!messages || messages.length < 2) return 'N/A'
                        const start = messages[0].timestamp
                        const end = messages[messages.length - 1].timestamp
                        const parseTime = (time: string) => {
                          const parts = time.split(':')
                          if (parts.length !== 3) return 0
                          const [hours, minutes, seconds] = parts
                          const [secs, ms] = seconds.split('.')
                          return parseInt(hours) * 3600000 + parseInt(minutes) * 60000 + parseInt(secs) * 1000 + parseInt(ms || '0')
                        }
                        const durationSec = (parseTime(end) - parseTime(start)) / 1000
                        if (durationSec === 0) return 'N/A'
                        return `${(messages.length / durationSec).toFixed(1)}/s`
                      })()}
                    </p>
                  </div>

                  <div style={{
                    padding: spacing[2],
                    backgroundColor: colors.background.secondary,
                    borderRadius: '6px',
                    textAlign: 'center'
                  }}>
                    <p className="ds-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Time Range</p>
                    <p className="ds-value" style={{ fontSize: '11px', fontWeight: 600 }}>
                      {messages?.[0]?.timestamp?.substring(0, 8) || 'N/A'}
                      <span style={{ fontSize: '10px', color: colors.text.secondary, display: 'block' }}>to</span>
                      {messages?.[messages.length - 1]?.timestamp?.substring(0, 8) || 'N/A'}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Connector Information */}
              {(() => {
                // Extract connector metadata
                const connectorData = messages
                  .filter(msg => {
                    if (msg.metadata &&
                        typeof msg.metadata === 'object' &&
                        'key' in msg.metadata &&
                        'value' in msg.metadata) {
                      const key = msg.metadata.key as string
                      return key.startsWith('connectors:')
                    }
                    return false
                  })
                  .reduce((acc: any, msg) => {
                    const key = msg.metadata.key as string
                    const value = msg.metadata.value
                    const keyParts = key.split(':')

                    if (keyParts.length >= 3) {
                      const connectorId = keyParts[1]
                      const metricType = keyParts.slice(2).join(':') // Handle nested keys like uplink:state

                      if (!acc[connectorId]) {
                        acc[connectorId] = {
                          id: connectorId,
                          metrics: {},
                          latestTimestamp: msg.timestamp
                        }
                      }

                      if (!acc[connectorId].metrics[metricType]) {
                        acc[connectorId].metrics[metricType] = []
                      }

                      acc[connectorId].metrics[metricType].push({
                        timestamp: msg.timestamp,
                        value: value
                      })
                      acc[connectorId].latestTimestamp = msg.timestamp
                    }
                    return acc
                  }, {})

                const connectors = Object.values(connectorData)

                if (connectors.length > 0) {
                  return (
                    <Card variant="nested">
                      <h4 className="ds-heading-4" style={{ marginBottom: spacing[3] }}>Jifeline Adapter Information</h4>
                      {connectors.map((connector: any) => (
                        <div key={connector.id} style={{ marginBottom: spacing[4] }}>
                          <div className="ds-flex-between" style={{ marginBottom: spacing[3] }}>
                            <div>
                              <p className="ds-label">Connector ID</p>
                              <p className="ds-value" style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                                {connector.id}
                              </p>
                            </div>
                          </div>

                          {/* Uplink Connection State */}
                          {connector.metrics['uplink:state'] && (
                            <div style={{ marginTop: spacing[3] }}>
                              <p className="ds-label" style={{ marginBottom: spacing[2] }}>Uplink Connection</p>
                              <div className="ds-grid-2" style={{ gap: spacing[3] }}>
                                <div>
                                  <p className="ds-text-secondary" style={{ fontSize: '12px' }}>State</p>
                                  <Badge variant={
                                    connector.metrics['uplink:state'][connector.metrics['uplink:state'].length - 1].value === 'connected'
                                      ? 'success'
                                      : 'secondary'
                                  }>
                                    {connector.metrics['uplink:state'][connector.metrics['uplink:state'].length - 1].value}
                                  </Badge>
                                </div>
                                {connector.metrics['uplink:since'] && (
                                  <div>
                                    <p className="ds-text-secondary" style={{ fontSize: '12px' }}>Connected Since</p>
                                    <p className="ds-value" style={{ fontSize: '12px' }}>
                                      {(() => {
                                        const value = connector.metrics['uplink:since'][connector.metrics['uplink:since'].length - 1].value
                                        const match = value.match(/\((.*?)\)/)
                                        return match ? match[1] : value
                                      })()}
                                    </p>
                                  </div>
                                )}
                              </div>
                              {connector.metrics['uplink:client'] && (
                                <div style={{ marginTop: spacing[2] }}>
                                  <p className="ds-text-secondary" style={{ fontSize: '12px' }}>Connection Details</p>
                                  <div style={{
                                    padding: spacing[2],
                                    backgroundColor: colors.background.secondary,
                                    borderRadius: '4px',
                                    marginTop: spacing[1],
                                    fontSize: '11px',
                                    fontFamily: 'monospace',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-all'
                                  }}>
                                    {connector.metrics['uplink:client'][connector.metrics['uplink:client'].length - 1].value}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {connector.metrics.rtt && connector.metrics.rtt.length > 0 && (
                            <div style={{ marginTop: spacing[3] }}>
                              <p className="ds-label" style={{ marginBottom: spacing[2] }}>Round-Trip Time (RTT)</p>
                              <div className="ds-grid-3" style={{ gap: spacing[3] }}>
                                <div>
                                  <p className="ds-text-secondary" style={{ fontSize: '12px' }}>Average</p>
                                  <p className="ds-value">
                                    {Math.round(
                                      connector.metrics.rtt.reduce((sum: number, item: any) =>
                                        sum + parseFloat(item.value), 0) / connector.metrics.rtt.length
                                    )}ms
                                  </p>
                                </div>
                                <div>
                                  <p className="ds-text-secondary" style={{ fontSize: '12px' }}>Min</p>
                                  <p className="ds-value">
                                    {Math.min(...connector.metrics.rtt.map((item: any) => parseFloat(item.value)))}ms
                                  </p>
                                </div>
                                <div>
                                  <p className="ds-text-secondary" style={{ fontSize: '12px' }}>Max</p>
                                  <p className="ds-value">
                                    {Math.max(...connector.metrics.rtt.map((item: any) => parseFloat(item.value)))}ms
                                  </p>
                                </div>
                              </div>
                              <div style={{ marginTop: spacing[2] }}>
                                <p className="ds-text-secondary" style={{ fontSize: '12px' }}>
                                  Latest: {connector.metrics.rtt[connector.metrics.rtt.length - 1].value}ms at {connector.metrics.rtt[connector.metrics.rtt.length - 1].timestamp}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Display other metrics if present (excluding already displayed ones) */}
                          {Object.entries(connector.metrics)
                            .filter(([key]) => !['rtt', 'uplink:state', 'uplink:since', 'uplink:client'].includes(key))
                            .map(([metricType, values]: any) => (
                              <div key={metricType} style={{ marginTop: spacing[3] }}>
                                <p className="ds-label" style={{ marginBottom: spacing[2] }}>{metricType.replace(/:/g, ' ').toUpperCase()}</p>
                                <p className="ds-value" style={{ fontSize: '12px' }}>
                                  Latest: {values[values.length - 1].value} at {values[values.length - 1].timestamp}
                                </p>
                              </div>
                            ))}
                        </div>
                      ))}
                    </Card>
                  )
                }
                return null
              })()}
            </div>
          )}

          {activeTab === 'voltage' && (
            <div className="ds-section">
              <h3 className="ds-heading-3">Diagnostic Flow</h3>
              <Card variant="nested">
                {(() => {
                  // Define event type colors as a single source of truth (moved to top for scope visibility)
                  const eventTypeColors: Record<string, string> = {
                    'Security Key': '#F59E0B',      // Amber/Warning
                    'Security Success': '#10B981',  // Green/Success
                    'Routine Start': '#EA580C',     // Orange
                    'Routine Response': '#10B981',  // Green/Success
                    'Session Change': '#3B82F6',    // Blue/Primary
                    'ECU Reset': '#06B6D4',         // Cyan/Info
                    'Clear DTCs': '#7C3AED',        // Purple
                    'Read DTCs': '#EF4444',         // Red/Error
                    'OBD Stored DTCs': '#EF4444',   // Red/Error
                    'OBD Pending DTCs': '#F59E0B',  // Amber/Warning
                    'OBD Permanent DTCs': '#DC2626', // Dark Red
                    'Other': '#9CA3AF'              // Gray
                  }

                  // Extract battery voltage data from metadata
                  // Method 1: From METADATA messages parsed by JifelineParser
                  const metadataVoltage = job.metadata?.vehicleVoltage
                    ? job.metadata.vehicleVoltage.map((v: any) => ({
                        time: v.timestamp,
                        voltage: v.voltage.toFixed(2),
                        ecu: 'System',
                        source: 'METADATA'
                      })).filter((d: any) => parseFloat(d.voltage) > 0 && parseFloat(d.voltage) < 30)
                    : []

                  // Method 2: From UDS Read Data By Identifier responses
                  const udsVoltage = messages
                    .filter(msg => {
                      const decoded = decodeUDSMessage(msg.data || '', msg.isRequest, msg.diagnosticProtocol, msg.protocol)
                      // Check for Read Data By Identifier responses (0x62)
                      if (decoded.service !== '62') return false
                      const cleanData = msg.data && msg.data.startsWith('0x') ? msg.data.substring(2) : msg.data || ''
                      const dataAfterService = cleanData.length > 2 ? cleanData.substring(2) : ''
                      if (dataAfterService.length < 4) return false
                      const did = dataAfterService.substring(0, 4).toUpperCase()
                      // Common battery voltage DIDs
                      return ['42B6', '4201', '012F', '0110', '2110'].includes(did)
                    })
                    .map(msg => {
                      const cleanData = msg.data && msg.data.startsWith('0x') ? msg.data.substring(2) : msg.data || ''
                      const dataAfterService = cleanData.substring(2)
                      const did = dataAfterService.substring(0, 4)
                      const voltageBytes = dataAfterService.substring(4)

                      // Parse voltage value (typically in hex, scaled)
                      let voltage = 0
                      if (voltageBytes.length >= 2) {
                        const rawValue = parseInt(voltageBytes.substring(0, 2), 16)
                        // Common scaling factors for voltage
                        if (did === '42B6' || did === '4201') {
                          voltage = rawValue * 0.1 // Scale by 0.1V
                        } else {
                          voltage = rawValue * 0.05 // Scale by 0.05V
                        }
                      }

                      return {
                        time: msg.timestamp,
                        voltage: voltage.toFixed(2),
                        ecu: ecuNames[msg.sourceAddr]?.name || msg.sourceAddr,
                        source: 'UDS'
                      }
                    })
                    .filter(d => d.voltage > 0 && d.voltage < 30) // Filter reasonable voltage values

                  // Combine both sources
                  let voltageData = [...metadataVoltage, ...udsVoltage].sort((a, b) => {
                    // Sort by timestamp
                    const timeA = a.time.split(':').map(Number)
                    const timeB = b.time.split(':').map(Number)
                    return (timeA[0] * 3600 + timeA[1] * 60 + timeA[2]) -
                           (timeB[0] * 3600 + timeB[1] * 60 + timeB[2])
                  })

                  // Extract significant diagnostic events for overlay
                  const diagnosticEvents = messages
                    .filter(msg => {
                      const decoded = decodeUDSMessage(msg.data, msg.isRequest, msg.diagnosticProtocol, msg.protocol)
                      const service = decoded.service

                      // Track significant events
                      return (
                        // Security Access (0x27)
                        (service === '27' && (
                          decoded.description.includes('Send Key') ||
                          decoded.description.includes('Positive Response')
                        )) ||
                        // Routine Control (0x31)
                        (service === '31' && msg.isRequest) ||
                        (service === '71' && decoded.description.includes('Results')) ||
                        // Session Control (0x10)
                        (service === '10' && msg.isRequest && decoded.description.includes('Extended')) ||
                        // ECU Reset (0x11)
                        (service === '11' && msg.isRequest) ||
                        // Clear DTCs (0x14)
                        (service === '14' && msg.isRequest) ||
                        // Read DTC Information (0x19)
                        (service === '19' && msg.isRequest) ||
                        // OBD-II Read DTCs (0x03, 0x07, 0x0A)
                        (service === '03' && msg.isRequest) ||
                        (service === '07' && msg.isRequest) ||
                        (service === '0A' && msg.isRequest)
                      )
                    })
                    .map(msg => {
                      const decoded = decodeUDSMessage(msg.data, msg.isRequest, msg.diagnosticProtocol, msg.protocol)
                      let eventType = 'Other'
                      let eventLabel = ''

                      if (decoded.service === '27') {
                        if (decoded.description.includes('Send Key')) {
                          eventType = 'Security Key'
                          eventLabel = 'Key Sent'
                        } else if (decoded.description.includes('Positive Response')) {
                          eventType = 'Security Success'
                          eventLabel = 'Authenticated'
                        }
                      } else if (decoded.service === '31') {
                        eventType = 'Routine Start'
                        eventLabel = 'Routine'
                        if (decoded.description.includes('0201')) {
                          eventLabel = 'Start Routine'
                        } else if (decoded.description.includes('0203')) {
                          eventLabel = 'Get Results'
                        }
                      } else if (decoded.service === '71') {
                        eventType = 'Routine Response'
                        eventLabel = 'Results'
                      } else if (decoded.service === '10') {
                        eventType = 'Session Change'
                        eventLabel = 'Extended Session'
                      } else if (decoded.service === '11') {
                        eventType = 'ECU Reset'
                        eventLabel = 'Reset'
                      } else if (decoded.service === '14') {
                        eventType = 'Clear DTCs'
                        eventLabel = 'Clear DTCs'
                      } else if (decoded.service === '19') {
                        eventType = 'Read DTCs'
                        eventLabel = 'Read DTCs'
                        // Parse subfunction for more specific labels
                        if (decoded.description.includes('0x02')) {
                          eventLabel = 'Read DTCs by Status'
                        } else if (decoded.description.includes('0x04')) {
                          eventLabel = 'Read Snapshot'
                        } else if (decoded.description.includes('0x06')) {
                          eventLabel = 'Read Extended DTCs'
                        }
                      } else if (decoded.service === '03') {
                        eventType = 'OBD Stored DTCs'
                        eventLabel = 'OBD Stored DTCs'
                      } else if (decoded.service === '07') {
                        eventType = 'OBD Pending DTCs'
                        eventLabel = 'OBD Pending DTCs'
                      } else if (decoded.service === '0A') {
                        eventType = 'OBD Permanent DTCs'
                        eventLabel = 'OBD Permanent DTCs'
                      }

                      // Get color from the single source of truth
                      const eventColor = eventTypeColors[eventType] || eventTypeColors['Other']

                      return {
                        time: msg.timestamp,
                        type: eventType,
                        color: eventColor,
                        label: eventLabel,
                        ecu: msg.isRequest ? msg.targetAddr : msg.sourceAddr,
                        description: decoded.description
                      }
                    })

                  // Merge events into voltage data for visualization
                  // If voltage data exists, add event markers
                  if (voltageData.length > 0 && diagnosticEvents.length > 0) {
                    // Create a map of events by time for quick lookup
                    const eventsByTime = diagnosticEvents.reduce((acc, event) => {
                      if (!acc[event.time]) acc[event.time] = []
                      acc[event.time].push(event)
                      return acc
                    }, {} as Record<string, typeof diagnosticEvents>)

                    // Add events property to matching voltage data points
                    voltageData = voltageData.map(vData => ({
                      ...vData,
                      events: eventsByTime[vData.time] || []
                    }))

                    // Also add standalone event points if they don't have corresponding voltage data
                    const voltageTimeSet = new Set(voltageData.map(v => v.time))
                    diagnosticEvents.forEach(event => {
                      if (!voltageTimeSet.has(event.time)) {
                        // Find nearest voltage value for interpolation
                        const nearestVoltage = voltageData.reduce((prev, curr) => {
                          const prevDiff = Math.abs(parseTime(prev.time) - parseTime(event.time))
                          const currDiff = Math.abs(parseTime(curr.time) - parseTime(event.time))
                          return currDiff < prevDiff ? curr : prev
                        })

                        voltageData.push({
                          time: event.time,
                          voltage: nearestVoltage ? nearestVoltage.voltage : '0',
                          ecu: event.ecu,
                          source: 'Event',
                          events: [event]
                        })
                      }
                    })

                    // Re-sort after adding event points
                    voltageData.sort((a, b) => {
                      const timeA = a.time.split(':').map(Number)
                      const timeB = b.time.split(':').map(Number)
                      return (timeA[0] * 3600 + timeA[1] * 60 + timeA[2]) -
                             (timeB[0] * 3600 + timeB[1] * 60 + timeB[2])
                    })
                  }

                  // Helper to parse time string to seconds
                  function parseTime(timeStr: string): number {
                    const parts = timeStr.split(':').map(Number)
                    return parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0)
                  }

                  if (voltageData.length === 0) {
                    return (
                      <div className="ds-empty-state" style={{ padding: spacing[6] }}>
                        <Zap size={48} style={{ color: colors.text.secondary, marginBottom: spacing[3] }} />
                        <p className="ds-heading-4">No Voltage Data Found</p>
                        <p className="ds-text-secondary" style={{ marginTop: spacing[2] }}>
                          This trace does not contain battery voltage readings.
                        </p>
                        <p className="ds-text-secondary" style={{ fontSize: '12px', marginTop: spacing[2] }}>
                          Common voltage DIDs: 0x42B6, 0x4201, 0x012F, 0x0110, 0x2110
                        </p>
                      </div>
                    )
                  }

                  return (
                    <div>
                      <div className="ds-flex-between" style={{ marginBottom: spacing[4] }}>
                        <div>
                          <p className="ds-label">Voltage Readings</p>
                          <p className="ds-value">{voltageData.length} measurements</p>
                        </div>
                        <div>
                          <p className="ds-label">Voltage Range</p>
                          <p className="ds-value">
                            {Math.min(...voltageData.map(d => parseFloat(d.voltage)))}V -
                            {Math.max(...voltageData.map(d => parseFloat(d.voltage)))}V
                          </p>
                        </div>
                        <div>
                          <p className="ds-label">Average Voltage</p>
                          <p className="ds-value">
                            {(voltageData.reduce((sum, d) => sum + parseFloat(d.voltage), 0) / voltageData.length).toFixed(2)}V
                          </p>
                        </div>
                      </div>

                      {/* Enhanced Voltage Graph with Diagnostic Events */}
                      <div style={{ marginTop: spacing[3], marginBottom: spacing[2] }}>
                        <h4 className="ds-heading-5">Voltage Timeline with Diagnostic Events</h4>
                        {diagnosticEvents.length > 0 && (
                          <div style={{ display: 'flex', gap: spacing[2], marginTop: spacing[2], flexWrap: 'wrap' }}>
                            {/* Group events by type and show count for each */}
                            {Object.entries(
                              diagnosticEvents.reduce((acc, event) => {
                                acc[event.type] = (acc[event.type] || 0) + 1
                                return acc
                              }, {} as Record<string, number>)
                            ).map(([eventType, count]) => (
                              <div key={eventType} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                backgroundColor: colors.background.secondary,
                                borderRadius: '4px',
                                border: `1px solid ${colors.border.light}`
                              }}>
                                <div style={{
                                  width: '12px',
                                  height: '12px',
                                  borderRadius: '50%',
                                  backgroundColor: eventTypeColors[eventType] || eventTypeColors['Other'],
                                  border: '1px solid white',
                                  boxShadow: '0 0 2px rgba(0,0,0,0.2)'
                                }} />
                                <span style={{ fontSize: '12px', fontWeight: 500 }}>
                                  {eventType}: {count}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>


                      <div style={{ width: '100%', height: '550px', marginTop: spacing[2] }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={voltageData} margin={{ top: 60, right: 30, left: 20, bottom: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={colors.border.light} />

                            {/* Add routine start/stop lines and spans */}
                            {(() => {
                              // Group routines by ECU and routine ID to find first and last occurrence
                              const routineGroups: Record<string, any[]> = {}

                              messages.forEach(msg => {
                                const decoded = decodeUDSMessage(msg.data, msg.isRequest, msg.diagnosticProtocol, msg.protocol)
                                if (decoded.service === '31' && msg.isRequest) {
                                  const ecuAddr = msg.targetAddr || msg.target
                                  const cleanData = msg.data && msg.data.startsWith('0x') ? msg.data.substring(2) : msg.data || ''
                                  let routineId = 'unknown'
                                  if (cleanData.length >= 8) {
                                    routineId = cleanData.substring(4, 8).toUpperCase()
                                  }

                                  const key = `${ecuAddr}_${routineId}`
                                  if (!routineGroups[key]) {
                                    routineGroups[key] = []
                                  }
                                  routineGroups[key].push({
                                    timestamp: msg.timestamp,
                                    ecu: ecuAddr,
                                    routineId: routineId
                                  })
                                }
                              })

                              const routineSpans: any[] = []
                              Object.entries(routineGroups).forEach(([key, events]) => {
                                if (events.length > 0) {
                                  // Sort by timestamp to find first and last
                                  events.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
                                  const first = events[0]
                                  const last = events[events.length - 1]

                                  routineSpans.push({
                                    startTime: first.timestamp,
                                    endTime: last.timestamp,
                                    routineId: first.routineId,
                                    ecu: ecuNames[first.ecu]?.name || first.ecu
                                  })
                                }
                              })

                              return (
                                <>
                                  {/* Draw spans and lines for each routine */}
                                  {routineSpans.map((span, idx) => (
                                    <g key={`routine-span-${idx}`}>
                                      {/* Shaded area between start and stop */}
                                      <ReferenceArea
                                        x1={span.startTime}
                                        x2={span.endTime}
                                        y1="dataMax"
                                        y2="dataMin"
                                        fill="#EA580C"
                                        fillOpacity={0.1}
                                        stroke="none"
                                      />

                                      {/* Start line */}
                                      <ReferenceLine
                                        x={span.startTime}
                                        stroke="#EA580C"
                                        strokeWidth={2}
                                        strokeDasharray="none"
                                      />

                                      {/* Stop line */}
                                      <ReferenceLine
                                        x={span.endTime}
                                        stroke="#EA580C"
                                        strokeWidth={2}
                                        strokeDasharray="none"
                                      />

                                      {/* Label in the center with pointer lines */}
                                      {(() => {
                                        // Find the midpoint timestamp
                                        const startIdx = voltageData.findIndex(d => d.time === span.startTime)
                                        const endIdx = voltageData.findIndex(d => d.time === span.endTime)
                                        let midTime = span.startTime

                                        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                                          const midIdx = Math.floor((startIdx + endIdx) / 2)
                                          if (voltageData[midIdx]) {
                                            midTime = voltageData[midIdx].time
                                          }
                                        }

                                        return (
                                          <>
                                            {/* Center label */}
                                            <ReferenceLine
                                              x={midTime}
                                              stroke="transparent"
                                              label={{
                                                value: `Routine 0x${span.routineId} - ${span.ecu}`,
                                                position: 'top',
                                                offset: 20,
                                                style: {
                                                  fontSize: 12,
                                                  fill: '#EA580C',
                                                  fontWeight: 700,
                                                  backgroundColor: 'white',
                                                  padding: '4px 8px',
                                                  borderRadius: '4px',
                                                  border: '2px solid #EA580C',
                                                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                }
                                              }}
                                            />

                                            {/* Pointer line from start to label */}
                                            <ReferenceLine
                                              x={span.startTime}
                                              stroke="#EA580C"
                                              strokeWidth={1}
                                              strokeDasharray="2 2"
                                              opacity={0.5}
                                              label={{
                                                value: '▼',
                                                position: 'top',
                                                offset: 5,
                                                style: {
                                                  fontSize: 10,
                                                  fill: '#EA580C'
                                                }
                                              }}
                                            />

                                            {/* Pointer line from end to label */}
                                            <ReferenceLine
                                              x={span.endTime}
                                              stroke="#EA580C"
                                              strokeWidth={1}
                                              strokeDasharray="2 2"
                                              opacity={0.5}
                                              label={{
                                                value: '▼',
                                                position: 'top',
                                                offset: 5,
                                                style: {
                                                  fontSize: 10,
                                                  fill: '#EA580C'
                                                }
                                              }}
                                            />
                                          </>
                                        )
                                      })()}
                                    </g>
                                  ))}
                                </>
                              )
                            })()}
                            <XAxis
                              dataKey="time"
                              tick={{ fontSize: 11 }}
                              angle={-45}
                              textAnchor="end"
                              height={100}
                            />
                            <YAxis
                              tick={{ fontSize: 12 }}
                              label={{ value: 'Voltage (V)', angle: -90, position: 'insideLeft' }}
                              domain={['dataMin - 0.5', 'dataMax + 0.5']}
                            />
                            <Tooltip
                              content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                  const voltage = payload[0].value
                                  const pointData = payload[0].payload
                                  const events = pointData.events || []
                                  return (
                                    <div style={{
                                      backgroundColor: 'white',
                                      border: `1px solid ${colors.border.light}`,
                                      borderRadius: '4px',
                                      padding: spacing[2],
                                      maxWidth: '300px'
                                    }}>
                                      <p style={{ fontWeight: 600, marginBottom: '4px' }}>{label}</p>
                                      <p style={{ color: colors.primary[600] }}>
                                        Voltage: {voltage}V
                                      </p>
                                      {pointData.ecu && (
                                        <p style={{ fontSize: '11px', color: colors.text.secondary }}>
                                          ECU: {pointData.ecu}
                                        </p>
                                      )}
                                      {events.map((event, idx) => (
                                        <div key={idx} style={{
                                          marginTop: '6px',
                                          paddingTop: '6px',
                                          borderTop: `1px solid ${colors.border.light}`
                                        }}>
                                          <p style={{ color: event.color, fontSize: '12px', fontWeight: 600 }}>
                                            {event.label}
                                          </p>
                                          <p style={{ fontSize: '10px', color: colors.text.secondary }}>
                                            {ecuNames[event.ecu]?.name || event.ecu}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  )
                                }
                                return null
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="voltage"
                              stroke={colors.primary[600]}
                              strokeWidth={2}
                              dot={(props: any) => {
                                const pointEvents = props.payload.events || []
                                if (pointEvents.length > 0) {
                                  const event = pointEvents[0]
                                  return (
                                    <g key={`dot-${props.index}-${props.cx}-${props.cy}`}>
                                      <circle
                                        cx={props.cx}
                                        cy={props.cy}
                                        r={8}
                                        fill={event.color}
                                        stroke="white"
                                        strokeWidth={2}
                                      />
                                      {pointEvents.length > 1 && (
                                        <text
                                          x={props.cx}
                                          y={props.cy - 12}
                                          fill={event.color}
                                          fontSize="10"
                                          textAnchor="middle"
                                          fontWeight="bold"
                                        >
                                          {pointEvents.length}
                                        </text>
                                      )}
                                    </g>
                                  )
                                }
                                return <circle key={`dot-${props.index}-${props.cx}-${props.cy}`} cx={props.cx} cy={props.cy} r={2} fill={colors.primary[600]} />
                              }}
                              name="Voltage (V)"
                            />


                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Routine Execution Summary Table */}
                      {(() => {
                        // Analyze routines performed on each ECU
                        const ecuRoutineAnalysis: Record<string, {
                          ecuAddress: string
                          ecuName: string
                          routines: Array<{ time: string, routineId?: string }>
                          hadExtendedSession: boolean
                          hadSecurityAccess: boolean
                          securityLevels: string[]
                        }> = {}

                        // Process messages to find routines and their prerequisites
                        messages.forEach((msg, index) => {
                          const decoded = decodeUDSMessage(msg.data, msg.isRequest, msg.diagnosticProtocol, msg.protocol)

                          // Track routine requests (0x31)
                          if (decoded.service === '31' && msg.isRequest) {
                            const ecuAddr = msg.targetAddr || msg.target
                            if (!ecuRoutineAnalysis[ecuAddr]) {
                              ecuRoutineAnalysis[ecuAddr] = {
                                ecuAddress: ecuAddr,
                                ecuName: ecuNames[ecuAddr]?.name || `ECU_${ecuAddr}`,
                                routines: [],
                                hadExtendedSession: false,
                                hadSecurityAccess: false,
                                securityLevels: []
                              }
                            }

                            // Extract routine ID from data if available
                            const cleanData = msg.data && msg.data.startsWith('0x') ? msg.data.substring(2) : msg.data || ''
                            let routineId = ''
                            if (cleanData.length >= 6) {
                              // Format: 31 01 XXXX (start routine by ID)
                              routineId = cleanData.substring(4, 8).toUpperCase()
                            }

                            ecuRoutineAnalysis[ecuAddr].routines.push({
                              time: msg.timestamp,
                              routineId
                            })
                          }
                        })

                        // Now look back through messages to find session and security for ECUs with routines
                        Object.keys(ecuRoutineAnalysis).forEach(ecuAddr => {
                          const ecuMessages = messages.filter(msg =>
                            (msg.targetAddr === ecuAddr || msg.target === ecuAddr) ||
                            (msg.sourceAddr === ecuAddr || msg.source === ecuAddr)
                          )

                          ecuMessages.forEach(msg => {
                            const decoded = decodeUDSMessage(msg.data, msg.isRequest, msg.diagnosticProtocol, msg.protocol)

                            // Check for extended session (0x10 with subfunction 03)
                            if (decoded.service === '10' && msg.isRequest) {
                              if (decoded.description.includes('Extended') || decoded.description.includes('0x03')) {
                                ecuRoutineAnalysis[ecuAddr].hadExtendedSession = true
                              }
                            }

                            // Check for security access
                            if (decoded.service === '27') {
                              if (decoded.description.includes('Send Key')) {
                                ecuRoutineAnalysis[ecuAddr].hadSecurityAccess = true
                                // Extract security level
                                const cleanData = msg.data && msg.data.startsWith('0x') ? msg.data.substring(2) : msg.data || ''
                                if (cleanData.length >= 4) {
                                  const level = cleanData.substring(2, 4)
                                  if (!ecuRoutineAnalysis[ecuAddr].securityLevels.includes(level)) {
                                    ecuRoutineAnalysis[ecuAddr].securityLevels.push(level)
                                  }
                                }
                              }
                            }
                          })
                        })

                        const ecusWithRoutines = Object.values(ecuRoutineAnalysis).filter(ecu => ecu.routines.length > 0)

                        if (ecusWithRoutines.length > 0) {
                          return (
                            <div style={{ marginTop: spacing[6], marginBottom: '80px' }}>
                              <h5 className="ds-heading-6" style={{ marginBottom: spacing[2] }}>
                                Routine Execution Summary
                              </h5>
                              <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                  <thead>
                                    <tr style={{ backgroundColor: colors.background.secondary }}>
                                      <th style={{ padding: spacing[2], textAlign: 'left', fontWeight: 600 }}>ECU</th>
                                      <th style={{ padding: spacing[2], textAlign: 'left', fontWeight: 600 }}>Address</th>
                                      <th style={{ padding: spacing[2], textAlign: 'center', fontWeight: 600 }}>Routines</th>
                                      <th style={{ padding: spacing[2], textAlign: 'center', fontWeight: 600 }}>Extended Session</th>
                                      <th style={{ padding: spacing[2], textAlign: 'center', fontWeight: 600 }}>Security Access</th>
                                      <th style={{ padding: spacing[2], textAlign: 'left', fontWeight: 600 }}>Security Levels</th>
                                      <th style={{ padding: spacing[2], textAlign: 'left', fontWeight: 600 }}>Routine IDs</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {ecusWithRoutines.map((ecu, idx) => (
                                      <tr key={idx} style={{
                                        borderBottom: `1px solid ${colors.border.light}`,
                                        backgroundColor: idx % 2 === 0 ? 'transparent' : colors.background.secondary + '40'
                                      }}>
                                        <td style={{ padding: spacing[2], fontWeight: 500 }}>
                                          {ecu.ecuName}
                                        </td>
                                        <td style={{ padding: spacing[2] }}>
                                          <Badge variant="secondary" size="small">
                                            {ecu.ecuAddress}
                                          </Badge>
                                        </td>
                                        <td style={{ padding: spacing[2], textAlign: 'center' }}>
                                          <Badge variant="info" size="small">
                                            {ecu.routines.length}
                                          </Badge>
                                        </td>
                                        <td style={{ padding: spacing[2], textAlign: 'center' }}>
                                          {ecu.hadExtendedSession ? (
                                            <CheckCircle size={16} style={{ color: colors.success[600] }} />
                                          ) : (
                                            <XCircle size={16} style={{ color: colors.text.secondary }} />
                                          )}
                                        </td>
                                        <td style={{ padding: spacing[2], textAlign: 'center' }}>
                                          {ecu.hadSecurityAccess ? (
                                            <CheckCircle size={16} style={{ color: colors.success[600] }} />
                                          ) : (
                                            <XCircle size={16} style={{ color: colors.text.secondary }} />
                                          )}
                                        </td>
                                        <td style={{ padding: spacing[2] }}>
                                          {ecu.securityLevels.length > 0 ? (
                                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                              {ecu.securityLevels.map(level => (
                                                <Badge key={level} variant="warning" size="small">
                                                  0x{level}
                                                </Badge>
                                              ))}
                                            </div>
                                          ) : (
                                            <span style={{ color: colors.text.secondary }}>-</span>
                                          )}
                                        </td>
                                        <td style={{ padding: spacing[2] }}>
                                          {[...new Set(ecu.routines.map(r => r.routineId).filter(id => id))].length > 0 ? (
                                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                              {[...new Set(ecu.routines.map(r => r.routineId).filter(id => id))].map(id => (
                                                <Badge key={id} variant="primary" size="small">
                                                  0x{id}
                                                </Badge>
                                              ))}
                                            </div>
                                          ) : (
                                            <span style={{ color: colors.text.secondary }}>-</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <div style={{ marginTop: spacing[2], fontSize: '11px', color: colors.text.secondary }}>
                                <p>
                                  <strong>Note:</strong> This table shows ECUs that had diagnostic routines executed during the session.
                                  Extended session and security access indicate prerequisites that were established before routine execution.
                                </p>
                              </div>
                            </div>
                          )
                        }
                        return null
                      })()}

                      {/* Diagnostic Events Table */}
                      {diagnosticEvents.length > 0 && (
                        <div style={{ marginTop: '60px' }}>
                          <h5 className="ds-heading-6" style={{ marginBottom: spacing[2] }}>Diagnostic Events During Voltage Monitoring</h5>
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                              <thead>
                                <tr style={{ backgroundColor: colors.background.secondary }}>
                                  <th style={{ padding: spacing[2], textAlign: 'left', fontWeight: 600 }}>Time</th>
                                  <th style={{ padding: spacing[2], textAlign: 'left', fontWeight: 600 }}>Event</th>
                                  <th style={{ padding: spacing[2], textAlign: 'left', fontWeight: 600 }}>ECU</th>
                                  <th style={{ padding: spacing[2], textAlign: 'left', fontWeight: 600 }}>Voltage</th>
                                  <th style={{ padding: spacing[2], textAlign: 'left', fontWeight: 600 }}>Details</th>
                                </tr>
                              </thead>
                              <tbody>
                                {diagnosticEvents.map((event, idx) => {
                                  const voltageAtEvent = voltageData.find(v => v.time === event.time)
                                  return (
                                    <tr key={idx} style={{
                                      borderBottom: `1px solid ${colors.border.light}`,
                                      backgroundColor: idx % 2 === 0 ? 'transparent' : colors.background.secondary + '40'
                                    }}>
                                      <td style={{ padding: spacing[2], fontFamily: 'monospace' }}>{event.time}</td>
                                      <td style={{ padding: spacing[2] }}>
                                        <Badge
                                          variant={event.type.includes('Security') ? 'warning' :
                                                  event.type.includes('Routine') ? 'info' : 'secondary'}
                                          size="small"
                                        >
                                          {event.label}
                                        </Badge>
                                      </td>
                                      <td style={{ padding: spacing[2] }}>
                                        {ecuNames[event.ecu]?.name || event.ecu}
                                      </td>
                                      <td style={{ padding: spacing[2] }}>
                                        {voltageAtEvent ? (
                                          <Badge variant="info" size="small">{voltageAtEvent.voltage}V</Badge>
                                        ) : '-'}
                                      </td>
                                      <td style={{ padding: spacing[2], fontSize: '11px', color: colors.text.secondary }}>
                                        {event.description.substring(0, 50)}...
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                    </div>
                  )
                })()}
              </Card>
            </div>
          )}

          {activeTab === 'ecus' && (
            <div className="ds-section">
              <h3 className="ds-heading-3">Discovered ECUs</h3>
              <div className="ds-stack" style={{ gap: spacing[4] }}>
                {ecus.map(ecu => {
                  const isBroadcast = ecu.address === '07DF'

                  // Find the channel for this ECU
                  const ecuChannel = job.metadata?.ecuChannels?.find((channel: any) => {
                    // Parse channel name to extract ECU address ranges
                    // Format: "can:6-14-H-2:10-43:7E0-7E8" or "can:6-14-H-2:10-43:7E1-7E9"
                    const parts = channel.name?.split(':')
                    if (parts && parts.length >= 4) {
                      const addressRange = parts[3] // e.g., "7E0-7E8" or "7E1-7E9"
                      if (addressRange && addressRange.includes('-')) {
                        const [start, end] = addressRange.split('-')
                        const ecuAddrNum = parseInt(ecu.address, 16)
                        const startNum = parseInt(start, 16)
                        const endNum = parseInt(end, 16)
                        return ecuAddrNum >= startNum && ecuAddrNum <= endNum
                      }
                    }
                    // Also check if the address is mentioned in the addresses field
                    return channel.addresses && channel.addresses.includes(ecu.address)
                  })

                  // Check if ECU has security access (service 0x27), authentication (service 0x29), or routine control (service 0x31)
                  const hasSecurityAccess = ecu.services.includes('27')
                  const hasAuthentication = ecu.services.includes('29')
                  const hasRoutineControl = ecu.services.includes('31')

                  return (
                  <Card key={ecu.address} variant="hover" style={{
                    backgroundColor: isBroadcast ? colors.warning[50] : colors.primary[50],
                    border: isBroadcast ? `2px solid ${colors.warning[300]}` : `2px solid ${colors.primary[200]}`
                  }}>
                    <div className="ds-flex-between">
                      <div style={{ flex: 1 }}>
                        <div className="ds-flex-row" style={{ gap: spacing[3], marginBottom: spacing[2] }}>
                          <Badge variant={isBroadcast ? "warning" : "secondary"} size="large">
                            {ecu.address}
                          </Badge>
                          <span className="ds-heading-4">
                            {ecuNames[ecu.address]?.name || ecu.name}
                          </span>
                          {isBroadcast && (
                            <Badge variant="warning" size="small">
                              BROADCAST
                            </Badge>
                          )}
                        </div>
                        {ecuNames[ecu.address]?.description && (
                          <p className="ds-text-secondary">
                            {ecuNames[ecu.address].description}
                          </p>
                        )}
                      </div>
                      <div className="ds-flex-row" style={{ gap: spacing[3], alignItems: 'center' }}>
                        <div className="ds-flex-row" style={{ gap: spacing[2] }}>
                          <Badge variant="info">{ecu.messageCount} messages</Badge>
                          {ecuNames[ecu.address]?.isVerified && (
                            <Badge variant="success" icon={<CheckCircle size={14} />}>
                              Verified
                            </Badge>
                          )}
                        </div>
                        {/* Large Service Icons */}
                        {(hasSecurityAccess || hasAuthentication || hasRoutineControl) && (
                          <div className="ds-flex-row" style={{ gap: spacing[2], marginLeft: spacing[3] }}>
                            {hasSecurityAccess && (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 48,
                                height: 48,
                                borderRadius: '12px',
                                backgroundColor: '#FFF4E6',
                                border: `2px solid #FFB366`
                              }}>
                                <Lock size={28} color="#E67E00" strokeWidth={2} />
                              </div>
                            )}
                            {hasAuthentication && (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 48,
                                height: 48,
                                borderRadius: '12px',
                                backgroundColor: '#FFF4E6',
                                border: `2px solid #FFB366`
                              }}>
                                <Key size={28} color="#E67E00" strokeWidth={2} />
                              </div>
                            )}
                            {hasRoutineControl && (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 48,
                                height: 48,
                                borderRadius: '12px',
                                backgroundColor: '#FED7AA',
                                border: `2px solid #EA580C`
                              }}>
                                <Play size={28} color="#EA580C" strokeWidth={2} />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {ecu.securityLevels.length > 0 && (
                      <div style={{ marginTop: spacing[3] }}>
                        <p className="ds-label" style={{ marginBottom: spacing[2] }}>SECURITY LEVELS</p>
                        <div className="ds-flex-row ds-flex-wrap" style={{ gap: spacing[2] }}>
                          {ecu.securityLevels.map(level => (
                            <Badge key={level} variant="info" size="small">
                              Level 0x{level}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {ecu.sessionTypes.length > 0 && (
                      <div style={{ marginTop: spacing[3] }}>
                        <p className="ds-label" style={{ marginBottom: spacing[2] }}>SESSION TYPES</p>
                        <div className="ds-flex-row ds-flex-wrap" style={{ gap: spacing[2] }}>
                          {ecu.sessionTypes.map(session => (
                            <Badge key={session} variant="success" size="small">
                              {session === '01' ? 'Default' : session === '03' ? 'Extended' : `Type 0x${session}`}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {ecuChannel && (
                      <div style={{
                        marginTop: spacing[3],
                        padding: spacing[3],
                        backgroundColor: colors.background.secondary,
                        borderRadius: '8px',
                        borderLeft: `3px solid ${colors.primary[600]}`
                      }}>
                        <div className="ds-flex-row" style={{ gap: spacing[4], marginBottom: spacing[2] }}>
                          <div>
                            <span className="ds-label" style={{ fontSize: '11px' }}>CHANNEL NAME</span>
                            <p className="ds-value" style={{ fontSize: '14px', fontFamily: 'monospace' }}>
                              {ecuChannel.name}
                            </p>
                          </div>
                          <div>
                            <span className="ds-label" style={{ fontSize: '11px' }}>PROTOCOL</span>
                            <p className="ds-value" style={{ fontSize: '14px' }}>
                              {ecuChannel.protocol?.toUpperCase()}
                            </p>
                          </div>
                          {ecuChannel.pins && (
                            <div>
                              <span className="ds-label" style={{ fontSize: '11px' }}>PINS</span>
                              <p className="ds-value" style={{ fontSize: '14px', fontFamily: 'monospace' }}>
                                {ecuChannel.pins}
                              </p>
                            </div>
                          )}
                          {ecuChannel.addresses && (
                            <div>
                              <span className="ds-label" style={{ fontSize: '11px' }}>ECU ADDRESSES</span>
                              <p className="ds-value" style={{ fontSize: '14px', fontFamily: 'monospace' }}>
                                {ecuChannel.addresses}
                              </p>
                            </div>
                          )}
                        </div>
                        {ecuChannel.status && (
                          <div style={{ marginTop: spacing[2] }}>
                            <Badge variant={ecuChannel.status === 'since' ? 'success' : 'secondary'}>
                              {ecuChannel.status === 'since' ? 'Connected' : 'Status: ' + ecuChannel.status}
                            </Badge>
                            {ecuChannel.timestamp && (
                              <span className="ds-text-secondary" style={{ fontSize: '12px', marginLeft: spacing[2] }}>
                                at {ecuChannel.timestamp}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {ecu.services.length > 0 && (
                      <div style={{ marginTop: spacing[4] }}>
                        <p className="ds-label" style={{ marginBottom: spacing[2] }}>SERVICES USED</p>
                        <div className="ds-flex-row ds-flex-wrap" style={{ gap: spacing[2] }}>
                          {ecu.services.map(service => {
                            const style = getServiceStyle(service)
                            const Icon = style.icon
                            return (
                              <div key={service} style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 10px',
                                backgroundColor: style.bgColor,
                                color: style.color,
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: 500,
                                border: `1px solid ${style.color}20`
                              }}>
                                <Icon size={14} />
                                {getServiceName(service, ecu.diagnosticProtocol)}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </Card>
                )})}
              </div>
            </div>
          )}

          {activeTab === 'flow' && (
            <div className="ds-section">
              <div className="ds-flex-between" style={{ marginBottom: spacing[4] }}>
                <h3 className="ds-heading-3">Diagnostic Trace</h3>
                <select
                  className="ds-select"
                  style={{
                    padding: spacing[2] + ' ' + spacing[3],
                    border: `1px solid ${colors.border.light}`,
                    borderRadius: '6px',
                    fontSize: '14px',
                    backgroundColor: colors.background.primary
                  }}
                  value={selectedEcu || ''}
                  onChange={(e) => {
                    setSelectedEcu(e.target.value || null)
                    setMessageDisplayLimit(500) // Reset display limit when changing ECU filter
                  }}
                >
                  <option value="">All ECUs</option>
                  {ecus
                    .filter(ecu => {
                      // Exclude all known tester addresses
                      const testerAddresses = ['0E80', 'F1', 'F0', 'FD', 'FE', 'FF', 'TESTER']
                      return !testerAddresses.includes(ecu.address.toUpperCase())
                    })
                    .map(ecu => {
                      // Use knowledge base name if available, otherwise fall back to the default name
                      const knowledgeName = ecuNames[ecu.address]?.name || ecu.name
                      return (
                        <option key={ecu.address} value={ecu.address}>
                          {knowledgeName} ({ecu.address})
                        </option>
                      )
                    })}
                </select>
              </div>

              {/* Filter Controls - Compact */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: spacing[3],
                padding: spacing[2],
                backgroundColor: colors.background.secondary,
                borderRadius: '6px',
                border: `1px solid ${colors.border.light}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing[3] }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: colors.text.secondary }}>
                    Use column header dropdowns to filter results
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => setFlowFilters({ transport: '', source: '', target: '', service: '', serviceName: '', direction: '' })}
                >
                  Clear All Filters
                </Button>
              </div>

              <div
                className="table-scroll-container"
                style={{
                  height: '700px',
                  overflow: 'auto',
                  border: `1px solid ${colors.border.light}`,
                  borderRadius: '8px',
                  backgroundColor: colors.background.primary,
                  position: 'relative'
                }}
              >
                  {messages.length > 0 ? (
                    <>
                      <style>
                        {`
                          /* Font families */
                          :root {
                            --font-family-ui: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            --font-family-mono: ui-monospace, 'SF Mono', Monaco, Consolas, 'Courier New', monospace;
                          }

                          /* Override global ds-table styles for this specific table */
                          .table-scroll-container .diagnostic-flow-table {
                            min-width: 100%;
                            border-collapse: separate !important;
                            border-spacing: 0;
                            background-color: transparent !important;
                            box-shadow: none !important;
                            border-radius: 0 !important;
                            overflow: visible !important;
                            font-family: var(--font-family-ui);
                          }

                          /* Make sure thead doesn't have conflicting background */
                          .table-scroll-container .diagnostic-flow-table thead {
                            background: none !important;
                            border-bottom: none !important;
                          }

                          /* Sticky header styles with improved typography */
                          .table-scroll-container .diagnostic-flow-table thead th {
                            position: sticky !important;
                            position: -webkit-sticky !important;
                            top: 0 !important;
                            z-index: 100 !important;
                            background-color: ${colors.background.secondary} !important;
                            padding: ${spacing[3]};
                            text-align: left;
                            border-bottom: 2px solid ${colors.border.light};
                            box-shadow: 0 2px 4px rgba(0,0,0,0.1);

                            /* Typography for headers */
                            font-size: 11px !important;
                            font-weight: 700 !important;
                            letter-spacing: 0.1em !important;
                            text-transform: uppercase !important;
                            color: ${colors.text.secondary} !important;
                          }

                          /* Ensure th pseudo-elements don't interfere */
                          .table-scroll-container .diagnostic-flow-table th::after {
                            display: none !important;
                          }

                          /* Table cell base styles */
                          .table-scroll-container .diagnostic-flow-table td {
                            background-color: transparent;
                            position: static !important;
                            padding: ${spacing[3]};
                            border-bottom: 1px solid ${colors.border.light};
                            vertical-align: middle;
                            font-size: 14px;
                            font-weight: 400;
                          }

                          /* Typography classes for data types */

                          /* Technical/hex data - monospace */
                          .ds-text-technical {
                            font-family: var(--font-family-mono) !important;
                            font-size: 13px !important;
                            font-weight: 400 !important;
                            letter-spacing: 0.025em !important;
                            font-variant-numeric: tabular-nums;
                          }

                          /* Timestamps - monospace with gray color */
                          .ds-text-timestamp {
                            font-family: var(--font-family-mono) !important;
                            font-size: 13px !important;
                            font-weight: 400 !important;
                            color: ${colors.text.secondary} !important;
                          }

                          /* Primary labels/names */
                          .ds-text-label {
                            font-family: var(--font-family-ui) !important;
                            font-size: 14px !important;
                            font-weight: 500 !important;
                            color: ${colors.text.primary} !important;
                          }

                          /* Descriptions - regular text */
                          .ds-text-description {
                            font-family: var(--font-family-ui) !important;
                            font-size: 14px !important;
                            font-weight: 400 !important;
                            line-height: 1.5 !important;
                            color: ${colors.text.primary} !important;
                          }

                          /* Badge typography - consistent across all badges */
                          .table-scroll-container .Badge {
                            font-family: var(--font-family-ui) !important;
                            font-size: 11px !important;
                            font-weight: 600 !important;
                            text-transform: uppercase !important;
                            letter-spacing: 0.05em !important;
                          }

                          /* Maintain row hover effects */
                          .table-scroll-container .diagnostic-flow-table tbody tr:hover {
                            background-color: rgba(59, 130, 246, 0.05);
                          }
                        `}
                      </style>
                      <table className="diagnostic-flow-table ds-table">
                        <thead>
                          <tr>
                            <th>Time</th>
                            <th>
                            <div style={{ display: 'flex', alignItems: 'center', gap: spacing[1] }}>
                              Transport
                              <select
                                value={flowFilters.transport}
                                onChange={(e) => setFlowFilters(prev => ({ ...prev, transport: e.target.value }))}
                                style={{
                                  padding: '2px 4px',
                                  border: `1px solid ${colors.border.light}`,
                                  borderRadius: '3px',
                                  fontSize: '11px',
                                  backgroundColor: colors.background.primary,
                                  minWidth: '60px'
                                }}
                              >
                                <option value="">All</option>
                                {tabCounts.filterOptions.transports.map(transport => (
                                  <option key={transport} value={transport}>{transport}</option>
                                ))}
                              </select>
                            </div>
                          </th>
                          <th>
                            <div style={{ display: 'flex', alignItems: 'center', gap: spacing[1] }}>
                              Source
                              <select
                                value={flowFilters.source}
                                onChange={(e) => setFlowFilters(prev => ({ ...prev, source: e.target.value }))}
                                style={{
                                  padding: '2px 4px',
                                  border: `1px solid ${colors.border.light}`,
                                  borderRadius: '3px',
                                  fontSize: '11px',
                                  backgroundColor: colors.background.primary,
                                  minWidth: '60px'
                                }}
                              >
                                <option value="">All</option>
                                {tabCounts.filterOptions.sources.map(source => (
                                  <option key={source} value={source}>{source}</option>
                                ))}
                              </select>
                            </div>
                          </th>
                          <th style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: spacing[1], justifyContent: 'center' }}>
                              Direction
                              <select
                                value={flowFilters.direction}
                                onChange={(e) => setFlowFilters(prev => ({ ...prev, direction: e.target.value }))}
                                style={{
                                  fontSize: '10px',
                                  padding: '1px 2px',
                                  border: '1px solid #ccc',
                                  borderRadius: '2px',
                                  background: 'white',
                                  minWidth: '60px'
                                }}
                              >
                                <option value="">All</option>
                                <option value="Request">Request</option>
                                <option value="Response">Response</option>
                              </select>
                            </div>
                          </th>
                          <th>
                            <div style={{ display: 'flex', alignItems: 'center', gap: spacing[1] }}>
                              Target
                              <select
                                value={flowFilters.target}
                                onChange={(e) => setFlowFilters(prev => ({ ...prev, target: e.target.value }))}
                                style={{
                                  padding: '2px 4px',
                                  border: `1px solid ${colors.border.light}`,
                                  borderRadius: '3px',
                                  fontSize: '11px',
                                  backgroundColor: colors.background.primary,
                                  minWidth: '60px'
                                }}
                              >
                                <option value="">All</option>
                                {tabCounts.filterOptions.targets.map(target => (
                                  <option key={target} value={target}>{target}</option>
                                ))}
                              </select>
                            </div>
                          </th>
                          <th>
                            <div style={{ display: 'flex', alignItems: 'center', gap: spacing[1] }}>
                              Service ID
                              <select
                                value={flowFilters.service}
                                onChange={(e) => setFlowFilters(prev => ({ ...prev, service: e.target.value }))}
                                style={{
                                  padding: '2px 4px',
                                  border: `1px solid ${colors.border.light}`,
                                  borderRadius: '3px',
                                  fontSize: '11px',
                                  backgroundColor: colors.background.primary,
                                  minWidth: '50px'
                                }}
                              >
                                <option value="">All</option>
                                {tabCounts.filterOptions.services.map(service => (
                                  <option key={service} value={service}>{service}</option>
                                ))}
                              </select>
                            </div>
                          </th>
                          <th>
                            <div style={{ display: 'flex', alignItems: 'center', gap: spacing[1] }}>
                              Service
                              <select
                                value={flowFilters.serviceName}
                                onChange={(e) => setFlowFilters(prev => ({ ...prev, serviceName: e.target.value }))}
                                style={{
                                  padding: '2px 4px',
                                  border: `1px solid ${colors.border.light}`,
                                  borderRadius: '3px',
                                  fontSize: '11px',
                                  backgroundColor: colors.background.primary,
                                  minWidth: '80px'
                                }}
                              >
                                <option value="">All</option>
                                {tabCounts.filterOptions.serviceNames.map(name => (
                                  <option key={name} value={name}>{name}</option>
                                ))}
                              </select>
                            </div>
                          </th>
                          <th>DID/Routine</th>
                          <th>Description</th>
                          <th>Knowledge Base</th>
                          <th>Raw Message</th>
                          <th>Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedEcu
                          ? messages.filter(m => m.sourceAddr === selectedEcu || m.targetAddr === selectedEcu)
                          : messages
                        )
                        // Filter out messages with empty or invalid data
                        .filter(msg => msg.data && msg.data.trim().length >= 2)
                        // Apply column filters
                        .filter(msg => {
                          // Direction filter
                          if (flowFilters.direction && flowFilters.direction !== (msg.isRequest ? 'Request' : 'Response')) {
                            return false
                          }
                          // Transport filter
                          if (flowFilters.transport && flowFilters.transport !== msg.protocol) {
                            return false
                          }
                          // Source filter
                          if (flowFilters.source && flowFilters.source !== msg.sourceAddr) {
                            return false
                          }
                          // Target filter
                          if (flowFilters.target && flowFilters.target !== msg.targetAddr) {
                            return false
                          }
                          // Service ID filter
                          if (flowFilters.service) {
                            const decoded = decodeUDSMessage(msg.data || '', msg.isRequest, msg.diagnosticProtocol, msg.protocol)
                            const serviceCode = msg.serviceCode || decoded.service
                            if (flowFilters.service !== serviceCode) {
                              return false
                            }
                          }
                          // Service Name filter
                          if (flowFilters.serviceName) {
                            const decoded = decodeUDSMessage(msg.data || '', msg.isRequest, msg.diagnosticProtocol, msg.protocol)
                            // Use the corrected service code if available (same as rendering logic)
                            const serviceCode = msg.serviceCode ? msg.serviceCode.toUpperCase() : decoded.service
                            const serviceName = getServiceName(serviceCode, msg.diagnosticProtocol)
                            if (flowFilters.serviceName !== serviceName) {
                              return false
                            }
                          }
                          return true
                        })
                        .slice(0, messageDisplayLimit).map((msg, idx) => {
                          // Use the already-corrected service code from msg.serviceCode
                          const decoded = decodeUDSMessage(msg.data || '', msg.isRequest, msg.diagnosticProtocol, msg.protocol)
                          // Override the service code with the already-corrected one if available
                          if (msg.serviceCode) {
                            decoded.service = msg.serviceCode.toUpperCase()
                            // Regenerate description with the corrected service code - pass the raw data
                            decoded.description = generateDescriptionForService(decoded.service, msg.data || '', msg.isRequest, msg.diagnosticProtocol)
                          }
                          const isNegativeResponse = decoded.service === '7F'  // Check decoded service, not raw data

                          // Debug specific problematic messages
                          if (msg.data && (msg.data.includes('14FF') || msg.data === '3E80')) {
                            console.log(`Decoding issue for ${msg.data}:`, {
                              raw: msg.data,
                              decoded: decoded,
                              parseResult: parseISOTP(msg.data || '')
                            })
                          }

                          // Extract DID or Routine ID
                          let identifier = ''
                          let knowledgeBaseName = ''

                          // Get the data bytes after the service ID - strip 0x prefix if present
                          const cleanData = msg.data && (msg.data.startsWith('0x') || msg.data.startsWith('0X')) ? msg.data.substring(2) : msg.data || ''
                          const dataAfterService = cleanData.length > 2 ? cleanData.substring(2) : ''

                          if (decoded.service === '22' || decoded.service === '62') {
                            // ReadDataByIdentifier - DID is first 2 bytes of data after service
                            if (dataAfterService.length >= 4) {
                              identifier = dataAfterService.substring(0, 4).toUpperCase()
                              // Look up DID name from knowledge base
                              knowledgeBaseName = getKnowledgeBaseName('DID', identifier, msg.targetAddr || msg.sourceAddr, knowledgeBaseData)
                            }
                          } else if (decoded.service === '2E' || decoded.service === '6E') {
                            // WriteDataByIdentifier - DID is first 2 bytes of data after service
                            if (dataAfterService.length >= 4) {
                              identifier = dataAfterService.substring(0, 4).toUpperCase()
                              knowledgeBaseName = getKnowledgeBaseName('DID', identifier, msg.targetAddr || msg.sourceAddr, knowledgeBaseData)
                            }
                          } else if (decoded.service === '31' || decoded.service === '71') {
                            // Routine Control - Routine ID is after the sub-function byte
                            // Format: [SubFunction:1][RoutineID:2][RoutineControlOption:remaining]
                            if (dataAfterService.length >= 6) {
                              identifier = dataAfterService.substring(2, 6).toUpperCase()
                              knowledgeBaseName = getKnowledgeBaseName('ROUTINE', identifier, msg.targetAddr || msg.sourceAddr, knowledgeBaseData)
                            }
                          } else if (decoded.service === '19' || decoded.service === '59') {
                            // Read DTC - might have DTC codes in response
                            if (!msg.isRequest && dataAfterService.length >= 6) {
                              const dtcCode = dataAfterService.substring(2, 6).toUpperCase()
                              knowledgeBaseName = getKnowledgeBaseName('DTC', dtcCode, msg.targetAddr || msg.sourceAddr, knowledgeBaseData)
                            }
                          } else if (decoded.service === '7F') {
                            // Negative Response - try to find the rejected DID or Routine from the previous request
                            // Look for the previous request to this ECU with the same rejected service
                            const rejectedService = decoded.details?.rejectedService
                            if (rejectedService) {
                              // For Read/Write Data By Identifier services, we need to find the DID from the request
                              if (rejectedService === '22' || rejectedService === '2E') {
                                // Find the most recent request with this service to this ECU
                                // Use the full messages array from the parent scope
                                const allMessages = (selectedEcu
                                  ? messages.filter(m => m.sourceAddr === selectedEcu || m.targetAddr === selectedEcu)
                                  : messages
                                )
                                const currentIndex = allMessages.findIndex((m: any) => m === msg)

                                // Look backwards from current message
                                for (let i = currentIndex - 1; i >= 0; i--) {
                                  const prevMsg = allMessages[i]
                                  if (prevMsg.isRequest &&
                                      prevMsg.targetAddr === msg.sourceAddr) {
                                    // Check if this request has the matching service
                                    const prevDecoded = decodeUDSMessage(prevMsg.data || '', true, prevMsg.diagnosticProtocol, prevMsg.protocol)
                                    if (prevDecoded.service === rejectedService) {
                                      const requestData = prevMsg.data && prevMsg.data.startsWith('0x') ? prevMsg.data.substring(2) : prevMsg.data || ''
                                      if (requestData.length >= 6) {
                                        identifier = requestData.substring(2, 6).toUpperCase()
                                        knowledgeBaseName = getKnowledgeBaseName('DID', identifier, msg.sourceAddr, knowledgeBaseData)
                                        break
                                      }
                                    }
                                  }
                                }
                              }
                              // For Routine Control, extract routine ID
                              else if (rejectedService === '31') {
                                const allMessages = (selectedEcu
                                  ? messages.filter(m => m.sourceAddr === selectedEcu || m.targetAddr === selectedEcu)
                                  : messages
                                )
                                const currentIndex = allMessages.findIndex((m: any) => m === msg)

                                // Look backwards from current message
                                for (let i = currentIndex - 1; i >= 0; i--) {
                                  const prevMsg = allMessages[i]
                                  if (prevMsg.isRequest &&
                                      prevMsg.targetAddr === msg.sourceAddr) {
                                    // Check if this request has the matching service
                                    const prevDecoded = decodeUDSMessage(prevMsg.data || '', true, prevMsg.diagnosticProtocol, prevMsg.protocol)
                                    if (prevDecoded.service === rejectedService) {
                                      const requestData = prevMsg.data && prevMsg.data.startsWith('0x') ? prevMsg.data.substring(2) : prevMsg.data || ''
                                      if (requestData.length >= 8) {
                                        // Routine format: [service:1][subfunction:1][routineId:2]
                                        identifier = requestData.substring(4, 8).toUpperCase()
                                        knowledgeBaseName = getKnowledgeBaseName('ROUTINE', identifier, msg.sourceAddr, knowledgeBaseData)
                                        break
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }

                          return (
                            <tr
                              key={idx}
                              className="ds-table-row"
                              style={{
                                backgroundColor: msg.isRequest
                                  ? '#eff6ff'  // Blue for requests
                                  : isNegativeResponse
                                  ? '#fef2f2'  // Red for negative responses
                                  : '#f0fdf4'  // Green for positive responses
                              }}
                            >
                              <td className="ds-table-cell nowrap ds-text-timestamp">
                                {msg.timestamp || 'N/A'}
                              </td>
                              <td className="ds-table-cell">
                                <div className="ds-flex-row" style={{ gap: spacing[1] }}>
                                  <Badge variant="info" size="small">
                                    {msg.protocol || 'Unknown'}
                                  </Badge>
                                  {msg.diagnosticProtocol && (
                                    <Badge
                                      variant={
                                        msg.diagnosticProtocol === 'OBD-II' ? 'warning' :
                                        msg.diagnosticProtocol === 'KWP2000' ? 'info' :
                                        'success'
                                      }
                                      size="small"
                                    >
                                      {msg.diagnosticProtocol}
                                    </Badge>
                                  )}
                                </div>
                              </td>
                              <td className="ds-table-cell">
                                <div className="ds-flex-row" style={{ gap: spacing[2] }}>
                                  <Badge variant="secondary" size="small">
                                    {['0E80', 'F1', 'F0', 'FD', 'FE', 'FF', 'TESTER'].includes(msg.sourceAddr?.toUpperCase()) ? 'Tester' :
                                      msg.sourceAddr ?
                                        (ecuNames[msg.sourceAddr]?.name || msg.sourceAddr) :
                                        'Tester'}
                                  </Badge>
                                </div>
                              </td>
                              <td className="ds-table-cell" style={{ textAlign: 'center' }}>
                                <Badge
                                  variant={msg.isRequest ? "default" : "secondary"}
                                  size="small"
                                >
                                  {msg.isRequest ? 'Request' : 'Response'}
                                </Badge>
                              </td>
                              <td className="ds-table-cell">
                                <Badge variant="secondary" size="small">
                                  {['0E80', 'F1', 'F0', 'FD', 'FE', 'FF', 'TESTER'].includes(msg.targetAddr?.toUpperCase()) ? 'Tester' :
                                    msg.targetAddr ?
                                      (ecuNames[msg.targetAddr]?.name || msg.targetAddr) :
                                      'ECU'}
                                </Badge>
                              </td>
                              <td className="ds-table-cell">
                                {decoded.service ? (
                                  <Badge variant="secondary" size="small" className="ds-text-technical">
                                    {decoded.service}
                                  </Badge>
                                ) : '-'}
                              </td>
                              <td className="ds-table-cell ds-text-label">
                                {decoded.service === '7F' && decoded.details?.rejectedServiceName
                                  ? decoded.details.rejectedServiceName
                                  : getServiceName(decoded.service, msg.diagnosticProtocol)}
                              </td>
                              <td className="ds-table-cell">
                                {identifier ? (
                                  <Badge variant="info" size="small" className="ds-text-technical">
                                    {identifier}
                                  </Badge>
                                ) : '-'}
                              </td>
                              <td className="ds-table-cell ds-text-description">
                                {decoded.description && decoded.description.includes('\n') ? (
                                  <div style={{ whiteSpace: 'pre-line' }}>
                                    {decoded.description}
                                  </div>
                                ) : (
                                  decoded.description
                                )}
                              </td>
                              <td className="ds-table-cell">
                                {knowledgeBaseName ? (
                                  <Badge variant="success" size="small">
                                    {knowledgeBaseName}
                                  </Badge>
                                ) : (
                                  <span style={{ color: '#9CA3AF', fontStyle: 'italic', fontSize: '12px' }}>
                                    Not identified
                                  </span>
                                )}
                              </td>
                              <td className="ds-table-cell nowrap ds-text-technical">
                                {msg.data || '-'}
                              </td>
                              <td className="ds-table-cell nowrap ds-text-technical">
                                {dataAfterService || '-'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>

                    {(selectedEcu
                        ? messages.filter(m => m.sourceAddr === selectedEcu || m.targetAddr === selectedEcu)
                        : messages
                    ).length > messageDisplayLimit && (
                      <div style={{
                        marginTop: spacing[4],
                        textAlign: 'center',
                        padding: spacing[4],
                        borderTop: `1px solid ${colors.border.light}`
                      }}>
                        <div className="ds-info-bar" style={{ marginBottom: spacing[3] }}>
                          Showing first {Math.min(messageDisplayLimit, (selectedEcu
                            ? messages.filter(m => m.sourceAddr === selectedEcu || m.targetAddr === selectedEcu)
                            : messages
                          ).length)} of {(selectedEcu
                            ? messages.filter(m => m.sourceAddr === selectedEcu || m.targetAddr === selectedEcu)
                            : messages
                          ).length} messages
                          {job?.metadata?.messagesComplete === false && ' (truncated - reparse to see all)'}
                        </div>
                        <div className="ds-flex-row" style={{ gap: spacing[3], justifyContent: 'center' }}>
                          <Button
                            variant="secondary"
                            onClick={() => setMessageDisplayLimit(prev => prev + MESSAGE_INCREMENT)}
                            icon={<ChevronDown size={16} />}
                          >
                            Show {MESSAGE_INCREMENT} More
                          </Button>
                          <Button
                            variant="primary"
                            onClick={() => setMessageDisplayLimit(Number.MAX_SAFE_INTEGER)}
                          >
                            Show All ({(selectedEcu
                              ? messages.filter(m => m.sourceAddr === selectedEcu || m.targetAddr === selectedEcu)
                              : messages
                            ).length} total)
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="ds-empty-state">
                    <p>No UDS messages available</p>
                    <p className="ds-text-secondary">
                      Messages may not be available if the job hasn't been parsed yet.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'dtcs' && (
            <div className="ds-section">
              <h3 className="ds-heading-3">Diagnostic Trouble Codes</h3>
              {(() => {
                // Extract OBD-II DTCs from messages (similar to EOBD tab logic)
                const obdMessages = messages.filter((msg: any) => {
                  return msg.diagnosticProtocol === 'OBD-II' && !msg.isRequest && msg.data
                })

                const obdiiDTCs: any[] = []

                obdMessages.forEach((msg: any) => {
                  const decoded = decodeUDSMessage(msg.data, msg.isRequest, msg.diagnosticProtocol, msg.protocol)
                  const service = parseInt(decoded.service, 16)
                  const baseService = service >= 0x40 ? service - 0x40 : service
                  const ecuAddr = msg.sourceAddr

                  if ((baseService === 0x03 || baseService === 0x07) && msg.data && msg.data.length > 4) {
                    const cleanData = msg.data.startsWith('0x') ? msg.data.substring(2) : msg.data
                    const dataPortionOnly = cleanData.startsWith(decoded.service) ? cleanData.substring(2) : cleanData

                    if (dataPortionOnly.length > 2) {
                      const dtcCount = parseInt(dataPortionOnly.substring(0, 2), 16)
                      const dtcData = dataPortionOnly.substring(2)

                      for (let i = 0; i < dtcData.length; i += 4) {
                        if (i + 4 <= dtcData.length) {
                          const dtcHex = dtcData.substring(i, i + 4)
                          const decodedDTC = decodeOBDIIDTC(dtcHex)

                          const ecuConfig = job.ECUConfiguration?.find((e: any) => e.targetAddress === ecuAddr)
                          const ecuName = ecuNames[ecuAddr]?.name || ecuConfig?.ecuName || `ECU_${ecuAddr}`

                          obdiiDTCs.push({
                            ...decodedDTC,
                            ecuName,
                            ecuAddr,
                            timestamp: msg.timestamp,
                            isPending: baseService === 0x07,
                            rawHex: dtcHex
                          })
                        }
                      }
                    }
                  }
                })

                const hasUDSDTCs = job.DTC && job.DTC.length > 0
                const hasOBDIIDTCs = obdiiDTCs.length > 0

                if (!hasUDSDTCs && !hasOBDIIDTCs) {
                  return (
                    <Card variant="nested">
                      <div className="ds-empty-state">No DTCs found in this diagnostic session</div>
                    </Card>
                  )
                }

                return (
                  <div className="ds-stack" style={{ gap: spacing[6] }}>
                    {/* UDS DTCs Section */}
                    {hasUDSDTCs && (
                      <div>
                        <div className="ds-flex-row" style={{ alignItems: 'center', gap: spacing[3], marginBottom: spacing[4] }}>
                          <h4 className="ds-heading-4">UDS Protocol DTCs</h4>
                          <Badge variant="info" size="small">
                            {job.DTC.length} codes
                          </Badge>
                          <div style={{
                            fontSize: '14px',
                            color: colors.gray[600],
                            fontStyle: 'italic'
                          }}>
                            Found via UDS Service 0x19 (manufacturer-specific ECU codes)
                          </div>
                        </div>
                        <div className="ds-stack" style={{ gap: spacing[5] }}>
                          {Object.entries(
                            job.DTC.reduce((acc: any, dtc: any) => {
                              if (!acc[dtc.ecuName]) acc[dtc.ecuName] = []
                              acc[dtc.ecuName].push(dtc)
                              return acc
                            }, {})
                          ).map(([ecuName, dtcs]: any) => (
                            <div key={ecuName}>
                              <h5 className="ds-heading-5" style={{
                                marginBottom: spacing[3],
                                padding: spacing[2] + ' ' + spacing[3],
                                backgroundColor: colors.background.secondary,
                                borderRadius: '6px'
                              }}>
                                {ecuName}
                              </h5>
                              <Card variant="nested">
                                <div style={{ overflowX: 'auto' }}>
                                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                                    <thead>
                                      <tr style={{ backgroundColor: colors.background.secondary }}>
                                        <th style={{
                                          padding: spacing[3],
                                          textAlign: 'left',
                                          fontSize: '13px',
                                          fontWeight: 600,
                                          borderBottom: `2px solid ${colors.border.light}`,
                                          minWidth: '120px'
                                        }}>
                                          DTC Code
                                        </th>
                                        <th style={{
                                          padding: spacing[3],
                                          textAlign: 'left',
                                          fontSize: '13px',
                                          fontWeight: 600,
                                          borderBottom: `2px solid ${colors.border.light}`,
                                          minWidth: '250px'
                                        }}>
                                          Description
                                        </th>
                                        <th style={{
                                          padding: spacing[3],
                                          textAlign: 'left',
                                          fontSize: '13px',
                                          fontWeight: 600,
                                          borderBottom: `2px solid ${colors.border.light}`,
                                          minWidth: '120px'
                                        }}>
                                          HEX Data
                                        </th>
                                        <th style={{
                                          padding: spacing[3],
                                          textAlign: 'center',
                                          fontSize: '11px',
                                          fontWeight: 600,
                                          borderBottom: `2px solid ${colors.border.light}`,
                                          whiteSpace: 'nowrap',
                                          title: 'Bit 0: Test Failed'
                                        }}>
                                          Test Failed
                                        </th>
                                        <th style={{
                                          padding: spacing[3],
                                          textAlign: 'center',
                                          fontSize: '11px',
                                          fontWeight: 600,
                                          borderBottom: `2px solid ${colors.border.light}`,
                                          whiteSpace: 'nowrap',
                                          title: 'Bit 1: Test Failed This Operation Cycle'
                                        }}>
                                          Failed This Cycle
                                        </th>
                                        <th style={{
                                          padding: spacing[3],
                                          textAlign: 'center',
                                          fontSize: '11px',
                                          fontWeight: 600,
                                          borderBottom: `2px solid ${colors.border.light}`,
                                          whiteSpace: 'nowrap',
                                          title: 'Bit 2: Pending DTC'
                                        }}>
                                          Pending
                                        </th>
                                        <th style={{
                                          padding: spacing[3],
                                          textAlign: 'center',
                                          fontSize: '11px',
                                          fontWeight: 600,
                                          borderBottom: `2px solid ${colors.border.light}`,
                                          whiteSpace: 'nowrap',
                                          title: 'Bit 3: Confirmed DTC'
                                        }}>
                                          Confirmed
                                        </th>
                                        <th style={{
                                          padding: spacing[3],
                                          textAlign: 'center',
                                          fontSize: '11px',
                                          fontWeight: 600,
                                          borderBottom: `2px solid ${colors.border.light}`,
                                          whiteSpace: 'nowrap',
                                          title: 'Bit 4: Test Not Completed Since Last Clear'
                                        }}>
                                          Not Complete Clear
                                        </th>
                                        <th style={{
                                          padding: spacing[3],
                                          textAlign: 'center',
                                          fontSize: '11px',
                                          fontWeight: 600,
                                          borderBottom: `2px solid ${colors.border.light}`,
                                          whiteSpace: 'nowrap',
                                          title: 'Bit 5: Test Failed Since Last Clear'
                                        }}>
                                          Failed Since Clear
                                        </th>
                                        <th style={{
                                          padding: spacing[3],
                                          textAlign: 'center',
                                          fontSize: '11px',
                                          fontWeight: 600,
                                          borderBottom: `2px solid ${colors.border.light}`,
                                          whiteSpace: 'nowrap',
                                          title: 'Bit 6: Test Not Completed This Operation Cycle'
                                        }}>
                                          Not Complete Cycle
                                        </th>
                                        <th style={{
                                          padding: spacing[3],
                                          textAlign: 'center',
                                          fontSize: '11px',
                                          fontWeight: 600,
                                          borderBottom: `2px solid ${colors.border.light}`,
                                          whiteSpace: 'nowrap',
                                          title: 'Bit 7: Warning Indicator Requested'
                                        }}>
                                          Warning Light
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {dtcs.map((dtc: any, idx: number) => {
                                        // Parse status byte if available, otherwise use defaults
                                        const statusBits = dtc.statusByte ? parseInt(dtc.statusByte, 16) : 0
                                        // UDS DTC Status Bits according to ISO 14229-1
                                        const testFailed = (statusBits & 0x01) !== 0  // Bit 0
                                        const testFailedThisCycle = (statusBits & 0x02) !== 0  // Bit 1
                                        const pending = (statusBits & 0x04) !== 0  // Bit 2
                                        const confirmed = (statusBits & 0x08) !== 0  // Bit 3
                                        const testNotCompletedSinceLastClear = (statusBits & 0x10) !== 0  // Bit 4
                                        const testFailedSinceLastClear = (statusBits & 0x20) !== 0  // Bit 5
                                        const testNotCompletedThisCycle = (statusBits & 0x40) !== 0  // Bit 6
                                        const warningLight = (statusBits & 0x80) !== 0  // Bit 7

                                        return (
                                          <tr key={idx} style={{
                                            borderBottom: `1px solid ${colors.border.light}`,
                                            '&:hover': { backgroundColor: colors.background.secondary }
                                          }}>
                                            <td style={{ padding: spacing[3] }}>
                                              <Badge variant="secondary" size="large">
                                                {dtc.code}
                                              </Badge>
                                            </td>
                                            <td style={{ padding: spacing[3], fontSize: '14px' }}>
                                              {dtc.description || 'No description'}
                                            </td>
                                            <td style={{ padding: spacing[3], fontFamily: 'monospace', fontSize: '13px' }}>
                                              <Badge variant="outline" size="small">
                                                {dtc.rawHex || 'N/A'}
                                              </Badge>
                                            </td>
                                            {/* UDS Status Bits (8 columns) */}
                                            <td style={{ padding: spacing[3], textAlign: 'center' }}>
                                              <div style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '4px',
                                                backgroundColor: testFailed ? colors.error[500] : colors.gray[200],
                                                margin: '0 auto'
                                              }}></div>
                                            </td>
                                            <td style={{ padding: spacing[3], textAlign: 'center' }}>
                                              <div style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '4px',
                                                backgroundColor: testFailedThisCycle ? colors.error[500] : colors.gray[200],
                                                margin: '0 auto'
                                              }}></div>
                                            </td>
                                            <td style={{ padding: spacing[3], textAlign: 'center' }}>
                                              <div style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '4px',
                                                backgroundColor: pending ? colors.warning[500] : colors.gray[200],
                                                margin: '0 auto'
                                              }}></div>
                                            </td>
                                            <td style={{ padding: spacing[3], textAlign: 'center' }}>
                                              <div style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '4px',
                                                backgroundColor: confirmed ? colors.error[600] : colors.gray[200],
                                                margin: '0 auto'
                                              }}></div>
                                            </td>
                                            <td style={{ padding: spacing[3], textAlign: 'center' }}>
                                              <div style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '4px',
                                                backgroundColor: testNotCompletedSinceLastClear ? colors.gray[400] : colors.gray[200],
                                                margin: '0 auto'
                                              }}></div>
                                            </td>
                                            <td style={{ padding: spacing[3], textAlign: 'center' }}>
                                              <div style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '4px',
                                                backgroundColor: testFailedSinceLastClear ? colors.error[500] : colors.gray[200],
                                                margin: '0 auto'
                                              }}></div>
                                            </td>
                                            <td style={{ padding: spacing[3], textAlign: 'center' }}>
                                              <div style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '4px',
                                                backgroundColor: testNotCompletedThisCycle ? colors.gray[400] : colors.gray[200],
                                                margin: '0 auto'
                                              }}></div>
                                            </td>
                                            <td style={{ padding: spacing[3], textAlign: 'center' }}>
                                              <div style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '4px',
                                                backgroundColor: warningLight ? colors.warning[600] : colors.gray[200],
                                                margin: '0 auto'
                                              }}></div>
                                            </td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </Card>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* OBD-II DTCs Section */}
                    {hasOBDIIDTCs && (
                      <div>
                        <div className="ds-flex-row" style={{ alignItems: 'center', gap: spacing[3], marginBottom: spacing[4] }}>
                          <h4 className="ds-heading-4">OBD-II Protocol DTCs</h4>
                          <Badge variant="warning" size="small">
                            {obdiiDTCs.length} codes
                          </Badge>
                          <div style={{
                            fontSize: '14px',
                            color: colors.gray[600],
                            fontStyle: 'italic'
                          }}>
                            Found via OBD-II Services 0x03/0x07 (generic standardized codes)
                          </div>
                        </div>
                        <div className="ds-stack" style={{ gap: spacing[5] }}>
                          {Object.entries(
                            obdiiDTCs.reduce((acc: any, dtc: any) => {
                              if (!acc[dtc.ecuName]) acc[dtc.ecuName] = []
                              acc[dtc.ecuName].push(dtc)
                              return acc
                            }, {})
                          ).map(([ecuName, dtcs]: any) => (
                            <div key={ecuName}>
                              <h5 className="ds-heading-5" style={{
                                marginBottom: spacing[3],
                                padding: spacing[2] + ' ' + spacing[3],
                                backgroundColor: colors.warning[50],
                                border: `1px solid ${colors.warning[200]}`,
                                borderRadius: '6px'
                              }}>
                                {ecuName}
                              </h5>
                              <Card variant="nested">
                                <div className="ds-table-container">
                                  <table className="ds-table">
                                    <thead>
                                      <tr>
                                        <th className="ds-table-header-cell">DTC Code</th>
                                        <th className="ds-table-header-cell">System</th>
                                        <th className="ds-table-header-cell">Description</th>
                                        <th className="ds-table-header-cell">Type</th>
                                        <th className="ds-table-header-cell">Status</th>
                                        <th className="ds-table-header-cell">Timestamp</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {dtcs.map((dtc: any, dtcIdx: number) => (
                                        <tr key={`obdii-${ecuName}-${dtcIdx}`}>
                                          <td className="ds-table-cell">
                                            <Badge variant={dtc.isPending ? "warning" : "error"} size="small">
                                              {dtc.code}
                                            </Badge>
                                          </td>
                                          <td className="ds-table-cell">
                                            <Badge variant="secondary" size="small">
                                              {dtc.code[0] === 'P' ? 'Powertrain' :
                                               dtc.code[0] === 'C' ? 'Chassis' :
                                               dtc.code[0] === 'B' ? 'Body' :
                                               dtc.code[0] === 'U' ? 'Network' : 'Unknown'}
                                            </Badge>
                                          </td>
                                          <td className="ds-table-cell">{dtc.description}</td>
                                          <td className="ds-table-cell">
                                            <Badge variant={dtc.code[1] === '0' || dtc.code[1] === '2' ? "success" : "info"} size="small">
                                              {dtc.code[1] === '0' || dtc.code[1] === '2' ? 'Generic' : 'Manufacturer'}
                                            </Badge>
                                          </td>
                                          <td className="ds-table-cell">
                                            <Badge variant={dtc.isPending ? "warning" : "error"} size="small">
                                              {dtc.isPending ? 'Pending' : 'Stored'}
                                            </Badge>
                                          </td>
                                          <td className="ds-table-cell">{dtc.timestamp}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </Card>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}

          {activeTab === 'dids' && (
            <div className="ds-section">
              <h3 className="ds-heading-3">Data Identifiers</h3>
              {job.DataIdentifier && job.DataIdentifier.length > 0 ? (
                <div className="ds-stack" style={{ gap: spacing[5] }}>
                  {Object.entries(
                    job.DataIdentifier.reduce((acc: any, did: any) => {
                      if (!acc[did.ecuName]) acc[did.ecuName] = []
                      acc[did.ecuName].push(did)
                      return acc
                    }, {})
                  ).map(([ecuName, dids]: any) => (
                    <div key={ecuName}>
                      <Card>
                        <h4 className="ds-heading-4" style={{
                          marginBottom: spacing[4],
                          padding: spacing[3],
                          backgroundColor: colors.background.secondary,
                          borderRadius: '6px',
                          borderLeft: `4px solid ${colors.primary[500]}`
                        }}>
                          {ecuName}
                        </h4>
                        <div style={{ overflowX: 'auto' }}>
                          <table className="ds-table" style={{ width: '100%' }}>
                            <thead>
                              <tr>
                                <th style={{ padding: spacing[3], textAlign: 'left' }}>DID</th>
                                <th style={{ padding: spacing[3], textAlign: 'left' }}>Name</th>
                                <th style={{ padding: spacing[3], textAlign: 'left' }}>Type</th>
                                <th style={{ padding: spacing[3], textAlign: 'left' }}>Length</th>
                                <th style={{ padding: spacing[3], textAlign: 'left' }}>Data</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dids.map((did: any, idx: number) => {
                                // Extract data portion from sample values
                                // Sample values may contain the full response including DID
                                const extractDataPortion = (value: string) => {
                                  if (!value) return '-'
                                  // If value starts with the DID (4 chars), remove it
                                  const didHex = did.did.replace(/^0x/i, '')
                                  if (value.toUpperCase().startsWith(didHex.toUpperCase())) {
                                    return value.substring(didHex.length)
                                  }
                                  return value
                                }

                                return (
                                  <tr key={idx} style={{
                                    borderBottom: `1px solid ${colors.border.light}`
                                  }}>
                                    <td style={{ padding: spacing[3] }}>
                                      <Badge variant="info" size="small">
                                        {did.did}
                                      </Badge>
                                    </td>
                                    <td style={{ padding: spacing[3] }}>
                                      {did.name || 'Unknown DID'}
                                    </td>
                                    <td style={{ padding: spacing[3] }}>
                                      <span className="ds-text-secondary">
                                        {did.dataType || 'Unknown'}
                                      </span>
                                    </td>
                                    <td style={{ padding: spacing[3] }}>
                                      {did.dataLength > 0 ? `${did.dataLength} bytes` : '-'}
                                    </td>
                                    <td style={{ padding: spacing[3] }}>
                                      <div style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                                        {did.sampleValues && did.sampleValues.length > 0 ? (
                                          <div>
                                            {did.sampleValues.map((value: string, i: number) => (
                                              <div key={i} style={{
                                                marginBottom: i < did.sampleValues.length - 1 ? spacing[1] : 0,
                                                color: colors.text.primary
                                              }}>
                                                {extractDataPortion(value) || '-'}
                                              </div>
                                            ))}
                                          </div>
                                        ) : '-'}
                                      </div>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    </div>
                  ))}
                </div>
              ) : (
                <Card variant="nested">
                  <div className="ds-empty-state">No DIDs found</div>
                </Card>
              )}
            </div>
          )}

          {activeTab === 'routines' && (
            <div className="ds-section">
              <h3 className="ds-heading-3">Routines</h3>
              {job.Routine && job.Routine.length > 0 ? (
                <div className="ds-stack" style={{ gap: spacing[5] }}>
                  {Object.entries(
                    job.Routine.reduce((acc: any, routine: any) => {
                      if (!acc[routine.ecuName]) acc[routine.ecuName] = []
                      acc[routine.ecuName].push(routine)
                      return acc
                    }, {})
                  ).map(([ecuName, routines]: any) => (
                    <div key={ecuName}>
                      <h4 className="ds-heading-4" style={{
                        marginBottom: spacing[3],
                        padding: spacing[2] + ' ' + spacing[3],
                        backgroundColor: colors.background.secondary,
                        borderRadius: '6px'
                      }}>
                        {ecuName}
                      </h4>
                      <div className="ds-stack" style={{ gap: spacing[2] }}>
                        {routines.map((routine: any, idx: number) => (
                          <Card key={idx} variant="nested">
                            <div className="ds-flex-row" style={{ gap: spacing[3] }}>
                              <Badge variant="warning" size="large">
                                {routine.routineId}
                              </Badge>
                              <span>{routine.name || 'Unknown Routine'}</span>
                              <span className="ds-text-secondary">
                                ({routine.controlType})
                              </span>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Card variant="nested">
                  <div className="ds-empty-state">No Routines found</div>
                </Card>
              )}
            </div>
          )}

          {activeTab === 'services' && (
            <div className="ds-section">
              <h3 className="ds-heading-3">Services by ID</h3>
              {messages && messages.length > 0 ? (
                <div className="ds-stack" style={{ gap: spacing[3] }}>
                  {(() => {
                    // Extract services from messages
                    const servicesByECU: Record<string, Set<string>> = {}
                    const servicesByCode: Record<string, { name: string, ecus: Set<string> }> = {}

                    messages.forEach((msg: any) => {
                      if (msg.data && msg.data.length >= 2) {
                        // Properly decode the message to get the actual service ID
                        const decoded = decodeUDSMessage(msg.data, msg.isRequest, msg.diagnosticProtocol, msg.protocol)
                        const serviceCode = decoded.service
                        const ecuAddr = msg.isRequest ? msg.targetAddr : msg.sourceAddr

                        // Skip invalid addresses
                        if (!ecuAddr) return

                        // Only process valid service codes
                        const validServices = ['10', '11', '14', '19', '22', '27', '2E', '2F', '31', '3E', '50', '51', '54', '59', '62', '67', '6E', '6F', '71', '7E', '7F']
                        if (!serviceCode || !validServices.includes(serviceCode)) return

                        if (!servicesByCode[serviceCode]) {
                          servicesByCode[serviceCode] = {
                            name: getServiceName(serviceCode, msg.diagnosticProtocol),
                            ecus: new Set()
                          }
                        }
                        servicesByCode[serviceCode].ecus.add(ecuAddr)
                      }
                    })

                    return Object.entries(servicesByCode)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([serviceCode, data]) => (
                        <Card key={serviceCode} variant="nested">
                          <div style={{ marginBottom: spacing[3] }}>
                            <div className="ds-flex-row" style={{ gap: spacing[3], alignItems: 'center' }}>
                              <Badge variant="primary" size="large">
                                0x{serviceCode}
                              </Badge>
                              <span style={{ fontSize: '16px', fontWeight: 600 }}>
                                {data.name}
                              </span>
                            </div>
                          </div>
                          <div>
                            <span className="ds-label">Used by ECUs ({data.ecus.size}):</span>
                            <div className="ds-flex-row ds-flex-wrap" style={{ gap: spacing[2], marginTop: spacing[2] }}>
                              {Array.from(data.ecus).sort().map((ecuAddr: string) => {
                                const ecuConfig = job.ECUConfiguration?.find((e: any) => e.targetAddress === ecuAddr)
                                const ecuName = ecuNames[ecuAddr]?.name || ecuConfig?.ecuName || `ECU_${ecuAddr}`
                                return (
                                  <Badge key={ecuAddr} variant="secondary" size="small">
                                    {ecuName} ({ecuAddr})
                                  </Badge>
                                )
                              })}
                            </div>
                          </div>
                        </Card>
                      ))
                  })()}
                </div>
              ) : (
                <Card variant="nested">
                  <div className="ds-empty-state">No Services found</div>
                </Card>
              )}
            </div>
          )}

          {activeTab === 'eobd' && (
            <div className="ds-section">
              <h3 className="ds-heading-3">
                EOBD / OBD-II Data Analysis
                {(() => {
                  // Count ECUs that have OBD-II protocol messages
                  const obdEcus = new Set(messages
                    .filter(msg => {
                      if (!msg.data || msg.data.length < 2) return false
                      // Use the diagnosticProtocol field set by the parser
                      return msg.diagnosticProtocol === 'OBD-II'
                    })
                    .map(msg => msg.isRequest ? msg.targetAddr : msg.sourceAddr)
                    .filter(addr => addr && addr !== '0E80' && addr !== 'F1' && addr !== '07DF' && addr !== 'TESTER')
                  )
                  return obdEcus.size > 0 ? (
                    <span style={{
                      marginLeft: spacing[2],
                      fontSize: '14px',
                      fontWeight: 'normal',
                      color: colors.gray[600]
                    }}>({obdEcus.size} ECUs)</span>
                  ) : null
                })()}
              </h3>
              {(() => {
                // Filter messages for OBD-II - check diagnosticProtocol field set by parser
                // The JifelineParser sets diagnosticProtocol: 'OBD-II' for messages with [EOBD] protocol marker
                const obdMessages = messages.filter((msg: any) => {
                  if (!msg.data || msg.data.length < 2) return false

                  // Primary check: Use the diagnosticProtocol field set by the parser
                  // This field is set to 'OBD-II' when the trace shows [EOBD] protocol
                  return msg.diagnosticProtocol === 'OBD-II'
                })

                if (obdMessages.length === 0) {
                  return (
                    <Card variant="nested">
                      <div className="ds-empty-state">No OBD-II data found in this trace</div>
                    </Card>
                  )
                }

                // Group by ECU
                const obdByECU: Record<string, any[]> = {}
                obdMessages.forEach((msg: any) => {
                  const ecuAddr = msg.isRequest ? msg.targetAddr : msg.sourceAddr
                  if (!ecuAddr || ecuAddr === '0E80') return // Skip tester

                  if (!obdByECU[ecuAddr]) obdByECU[ecuAddr] = []
                  obdByECU[ecuAddr].push(msg)
                })

                return (
                  <div className="ds-stack" style={{ gap: spacing[4] }}>
                    {Object.entries(obdByECU).map(([ecuAddr, ecuMessages]) => {
                      const ecuConfig = job.ECUConfiguration?.find((e: any) => e.targetAddress === ecuAddr)
                      const ecuName = ecuNames[ecuAddr]?.name || ecuConfig?.ecuName || `ECU_${ecuAddr}`
                      const isBroadcast = ecuAddr === '07DF'

                      // Analyze OBD data for this ECU
                      const obdData = {
                        currentData: [] as any[],
                        freezeFrame: [] as any[],
                        storedDTCs: [] as any[],
                        pendingDTCs: [] as any[],
                        vehicleInfo: [] as any[],
                        supportedPIDs: [] as any[]
                      }

                      ecuMessages.forEach((msg: any) => {
                        const decoded = decodeUDSMessage(msg.data, msg.isRequest, msg.diagnosticProtocol, msg.protocol)
                        const service = parseInt(decoded.service, 16)
                        const baseService = service >= 0x40 ? service - 0x40 : service

                        if (!msg.isRequest && msg.data && msg.data.length > 4) {
                          const cleanData = msg.data.startsWith('0x') ? msg.data.substring(2) : msg.data
                          const dataPortionOnly = cleanData.startsWith(decoded.service) ? cleanData.substring(2) : cleanData

                          switch (baseService) {
                            case 0x01: // Current data
                              if (dataPortionOnly.length >= 2) {
                                const pids = dataPortionOnly.match(/.{2}/g) || []
                                pids.forEach((pid, index) => {
                                  const pidName = obdiiPIDs[pid.toUpperCase()]
                                  if (pidName) {
                                    obdData.currentData.push({
                                      pid: pid.toUpperCase(),
                                      name: pidName,
                                      value: dataPortionOnly.substring(index * 2 + 2, index * 2 + 6) || 'N/A',
                                      timestamp: msg.timestamp
                                    })
                                  }
                                })
                              }
                              break
                            case 0x02: // Freeze frame
                              obdData.freezeFrame.push({
                                data: dataPortionOnly,
                                timestamp: msg.timestamp
                              })
                              break
                            case 0x03: // Stored DTCs
                              if (dataPortionOnly.length > 2) {
                                const dtcCount = parseInt(dataPortionOnly.substring(0, 2), 16)
                                const dtcData = dataPortionOnly.substring(2)
                                const dtcs = []

                                // Parse individual DTCs (each DTC is 4 hex chars = 2 bytes)
                                for (let i = 0; i < dtcData.length; i += 4) {
                                  if (i + 4 <= dtcData.length) {
                                    const dtcHex = dtcData.substring(i, i + 4)
                                    const decodedDTC = decodeOBDIIDTC(dtcHex)
                                    dtcs.push(decodedDTC)
                                  }
                                }

                                obdData.storedDTCs.push({
                                  count: dtcCount,
                                  data: dtcData,
                                  dtcs: dtcs,
                                  timestamp: msg.timestamp
                                })
                              }
                              break
                            case 0x07: // Pending DTCs
                              if (dataPortionOnly.length > 2) {
                                const dtcCount = parseInt(dataPortionOnly.substring(0, 2), 16)
                                const dtcData = dataPortionOnly.substring(2)
                                const dtcs = []

                                // Parse individual DTCs (each DTC is 4 hex chars = 2 bytes)
                                for (let i = 0; i < dtcData.length; i += 4) {
                                  if (i + 4 <= dtcData.length) {
                                    const dtcHex = dtcData.substring(i, i + 4)
                                    const decodedDTC = decodeOBDIIDTC(dtcHex)
                                    dtcs.push(decodedDTC)
                                  }
                                }

                                obdData.pendingDTCs.push({
                                  count: dtcCount,
                                  data: dtcData,
                                  dtcs: dtcs,
                                  timestamp: msg.timestamp
                                })
                              }
                              break
                            case 0x09: // Vehicle information
                              if (dataPortionOnly.length >= 2) {
                                const infoType = dataPortionOnly.substring(0, 2)
                                const infoTypes: Record<string, string> = {
                                  '00': 'Service 9 supported PIDs',
                                  '01': 'VIN Message Count',
                                  '02': 'Vehicle Identification Number (VIN)',
                                  '04': 'Calibration ID',
                                  '06': 'Calibration Verification Numbers',
                                  '0A': 'ECU Name'
                                }
                                obdData.vehicleInfo.push({
                                  type: infoType,
                                  name: infoTypes[infoType.toUpperCase()] || `Info Type 0x${infoType}`,
                                  data: dataPortionOnly.substring(2),
                                  timestamp: msg.timestamp
                                })
                              }
                              break
                          }
                        }
                      })

                      // Check if this ECU has security, authentication, or routine services (from the main ECUs data)
                      const ecuData = ecus.find(e => e.address === ecuAddr)
                      const hasSecurityAccess = ecuData?.services?.includes('27') || false
                      const hasAuthentication = ecuData?.services?.includes('29') || false
                      const hasRoutineControl = ecuData?.services?.includes('31') || false

                      return (
                        <Card key={ecuAddr} variant="nested" style={{
                          backgroundColor: isBroadcast ? colors.warning[50] : colors.primary[50],
                          border: isBroadcast ? `2px solid ${colors.warning[300]}` : `2px solid ${colors.primary[200]}`
                        }}>
                          <div style={{ marginBottom: spacing[4] }}>
                            <div className="ds-flex-between">
                              <div className="ds-flex-row" style={{ gap: spacing[3], alignItems: 'center' }}>
                                <Badge variant="primary" size="large">
                                  {ecuAddr}
                                </Badge>
                                <h4 className="ds-heading-4">{ecuName}</h4>
                                {isBroadcast && (
                                  <Badge variant="warning" size="small">
                                    BROADCAST
                                  </Badge>
                                )}
                                <Badge variant="secondary" size="small">
                                  {ecuMessages.length} OBD messages
                                </Badge>
                              </div>
                              {/* Large Service Icons */}
                              {(hasSecurityAccess || hasAuthentication || hasRoutineControl) && (
                                <div className="ds-flex-row" style={{ gap: spacing[2] }}>
                                  {hasSecurityAccess && (
                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      width: 48,
                                      height: 48,
                                      borderRadius: '12px',
                                      backgroundColor: '#FFF4E6',
                                      border: `2px solid #FFB366`
                                    }}>
                                      <Lock size={28} color="#E67E00" strokeWidth={2} />
                                    </div>
                                  )}
                                  {hasAuthentication && (
                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      width: 48,
                                      height: 48,
                                      borderRadius: '12px',
                                      backgroundColor: '#FFF4E6',
                                      border: `2px solid #FFB366`
                                    }}>
                                      <Key size={28} color="#E67E00" strokeWidth={2} />
                                    </div>
                                  )}
                                  {hasRoutineControl && (
                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      width: 48,
                                      height: 48,
                                      borderRadius: '12px',
                                      backgroundColor: '#FED7AA',
                                      border: `2px solid #EA580C`
                                    }}>
                                      <Play size={28} color="#EA580C" strokeWidth={2} />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="ds-stack" style={{ gap: spacing[4] }}>
                            {/* Current Data */}
                            {obdData.currentData.length > 0 && (
                              <div>
                                <h5 className="ds-heading-5">Current Data (Service 0x01)</h5>
                                <div className="ds-table-container">
                                  <table className="ds-table">
                                    <thead>
                                      <tr>
                                        <th className="ds-table-header-cell">PID</th>
                                        <th className="ds-table-header-cell">Parameter</th>
                                        <th className="ds-table-header-cell">Raw Value</th>
                                        <th className="ds-table-header-cell">Timestamp</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {obdData.currentData.slice(0, 10).map((item: any, idx: number) => (
                                        <tr key={idx}>
                                          <td className="ds-table-cell">
                                            <Badge variant="info" size="small">0x{item.pid}</Badge>
                                          </td>
                                          <td className="ds-table-cell">{item.name}</td>
                                          <td className="ds-table-cell" style={{ fontFamily: 'monospace' }}>
                                            {item.value}
                                          </td>
                                          <td className="ds-table-cell">{item.timestamp}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Vehicle Information */}
                            {obdData.vehicleInfo.length > 0 && (
                              <div>
                                <h5 className="ds-heading-5">Vehicle Information (Service 0x09)</h5>
                                <div className="ds-table-container">
                                  <table className="ds-table">
                                    <thead>
                                      <tr>
                                        <th className="ds-table-header-cell">Type</th>
                                        <th className="ds-table-header-cell">Information</th>
                                        <th className="ds-table-header-cell">Raw Data</th>
                                        <th className="ds-table-header-cell">Decoded</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {obdData.vehicleInfo.map((item: any, idx: number) => (
                                        <tr key={idx}>
                                          <td className="ds-table-cell">
                                            <Badge variant="info" size="small">0x{item.type}</Badge>
                                          </td>
                                          <td className="ds-table-cell">{item.name}</td>
                                          <td className="ds-table-cell" style={{ fontFamily: 'monospace' }}>
                                            {item.data.substring(0, 20)}{item.data.length > 20 ? '...' : ''}
                                          </td>
                                          <td className="ds-table-cell">
                                            {item.type === '02' && item.data.length > 2 ?
                                              // VIN decoding
                                              (() => {
                                                try {
                                                  const vinHex = item.data.substring(2) // Skip message count
                                                  return vinHex.match(/.{2}/g)?.map((hex: string) =>
                                                    String.fromCharCode(parseInt(hex, 16))
                                                  ).join('') || 'Invalid VIN'
                                                } catch {
                                                  return 'Unable to decode'
                                                }
                                              })()
                                              : 'N/A'
                                            }
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* DTCs */}
                            {(obdData.storedDTCs.length > 0 || obdData.pendingDTCs.length > 0) && (
                              <div>
                                <h5 className="ds-heading-5">Diagnostic Trouble Codes</h5>

                                {/* Stored DTCs */}
                                {obdData.storedDTCs.length > 0 && (
                                  <div style={{ marginBottom: spacing[4] }}>
                                    <h6 className="ds-heading-6">Stored DTCs (Service 0x03)</h6>
                                    <div className="ds-table-container">
                                      <table className="ds-table">
                                        <thead>
                                          <tr>
                                            <th className="ds-table-header-cell">DTC Code</th>
                                            <th className="ds-table-header-cell">System</th>
                                            <th className="ds-table-header-cell">Description</th>
                                            <th className="ds-table-header-cell">Timestamp</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {obdData.storedDTCs.flatMap((item: any) =>
                                            item.dtcs?.map((dtc: any, dtcIdx: number) => (
                                              <tr key={`stored-${item.timestamp}-${dtcIdx}`}>
                                                <td className="ds-table-cell">
                                                  <Badge variant="error" size="small">{dtc.code}</Badge>
                                                </td>
                                                <td className="ds-table-cell">
                                                  <Badge variant="secondary" size="small">
                                                    {dtc.code[0] === 'P' ? 'Powertrain' :
                                                     dtc.code[0] === 'C' ? 'Chassis' :
                                                     dtc.code[0] === 'B' ? 'Body' :
                                                     dtc.code[0] === 'U' ? 'Network' : 'Unknown'}
                                                  </Badge>
                                                </td>
                                                <td className="ds-table-cell">{dtc.description}</td>
                                                <td className="ds-table-cell">{item.timestamp}</td>
                                              </tr>
                                            )) || []
                                          )}
                                          {obdData.storedDTCs.some((item: any) => !item.dtcs || item.dtcs.length === 0) && (
                                            <tr>
                                              <td colSpan={4} className="ds-table-cell" style={{ textAlign: 'center', fontStyle: 'italic' }}>
                                                No DTCs detected (response: 00)
                                              </td>
                                            </tr>
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}

                                {/* Pending DTCs */}
                                {obdData.pendingDTCs.length > 0 && (
                                  <div>
                                    <h6 className="ds-heading-6">Pending DTCs (Service 0x07)</h6>
                                    <div className="ds-table-container">
                                      <table className="ds-table">
                                        <thead>
                                          <tr>
                                            <th className="ds-table-header-cell">DTC Code</th>
                                            <th className="ds-table-header-cell">System</th>
                                            <th className="ds-table-header-cell">Description</th>
                                            <th className="ds-table-header-cell">Timestamp</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {obdData.pendingDTCs.flatMap((item: any) =>
                                            item.dtcs?.map((dtc: any, dtcIdx: number) => (
                                              <tr key={`pending-${item.timestamp}-${dtcIdx}`}>
                                                <td className="ds-table-cell">
                                                  <Badge variant="warning" size="small">{dtc.code}</Badge>
                                                </td>
                                                <td className="ds-table-cell">
                                                  <Badge variant="secondary" size="small">
                                                    {dtc.code[0] === 'P' ? 'Powertrain' :
                                                     dtc.code[0] === 'C' ? 'Chassis' :
                                                     dtc.code[0] === 'B' ? 'Body' :
                                                     dtc.code[0] === 'U' ? 'Network' : 'Unknown'}
                                                  </Badge>
                                                </td>
                                                <td className="ds-table-cell">{dtc.description}</td>
                                                <td className="ds-table-cell">{item.timestamp}</td>
                                              </tr>
                                            )) || []
                                          )}
                                          {obdData.pendingDTCs.some((item: any) => !item.dtcs || item.dtcs.length === 0) && (
                                            <tr>
                                              <td colSpan={4} className="ds-table-cell" style={{ textAlign: 'center', fontStyle: 'italic' }}>
                                                No pending DTCs (response: 00)
                                              </td>
                                            </tr>
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          )}

          {activeTab === 'security' && (
            <div className="ds-section">
              <h3 className="ds-heading-3">Security Access Analysis</h3>
              <Card variant="nested">
                {(() => {
                  const securityEvents = analyzeSecurityAccess()
                  // Check both messages and ECU metadata for security access
                  const ecuWithSecurity = ecus.filter(e => e.securityLevels.length > 0)
                  const hasSecurityAccess = securityEvents.length > 0 || ecuWithSecurity.length > 0
                  const successfulAuths = securityEvents.filter(e => e.type === 'Key Accepted').length
                  const failedAuths = securityEvents.filter(e => e.type === 'Security Access Rejected').length
                  const uniqueEcus = ecuWithSecurity.length > 0 ? ecuWithSecurity :
                    [...new Set(securityEvents.filter(e => e.target !== '0E80').map(e => e.target))]

                  return (
                    <div>
                      {hasSecurityAccess ? (
                        <>
                          <div className="ds-grid-3" style={{ gap: spacing[4], marginBottom: spacing[4] }}>
                            <div style={{
                              padding: spacing[3],
                              backgroundColor: colors.success[50],
                              borderRadius: '8px',
                              border: `1px solid ${colors.success[200]}`
                            }}>
                              <p className="ds-label" style={{ color: colors.success[700] }}>Successful Authentications</p>
                              <p style={{ fontSize: '24px', fontWeight: 600, color: colors.success[700] }}>
                                {successfulAuths}
                              </p>
                            </div>
                            <div style={{
                              padding: spacing[3],
                              backgroundColor: failedAuths > 0 ? colors.error[50] : colors.gray[50],
                              borderRadius: '8px',
                              border: `1px solid ${failedAuths > 0 ? colors.error[200] : colors.gray[200]}`
                            }}>
                              <p className="ds-label" style={{ color: failedAuths > 0 ? colors.error[700] : colors.gray[700] }}>Failed Attempts</p>
                              <p style={{ fontSize: '24px', fontWeight: 600, color: failedAuths > 0 ? colors.error[700] : colors.gray[700] }}>
                                {failedAuths}
                              </p>
                            </div>
                            <div style={{
                              padding: spacing[3],
                              backgroundColor: colors.primary[50],
                              borderRadius: '8px',
                              border: `1px solid ${colors.primary[200]}`
                            }}>
                              <p className="ds-label" style={{ color: colors.primary[700] }}>ECUs with Security</p>
                              <p style={{ fontSize: '24px', fontWeight: 600, color: colors.primary[700] }}>
                                {ecuWithSecurity.length > 0 ? ecuWithSecurity.length : uniqueEcus.length}
                              </p>
                            </div>
                          </div>

                          <div style={{ marginTop: spacing[4] }}>
                            {securityEvents.length > 0 ? (
                              <>
                                <h4 className="ds-heading-4" style={{ marginBottom: spacing[3] }}>Security Events</h4>
                                <div style={{ overflowX: 'auto' }}>
                                  <table className="ds-table" style={{ width: '100%' }}>
                                    <thead>
                                      <tr>
                                        <th style={{ padding: spacing[2], textAlign: 'left' }}>Time</th>
                                        <th style={{ padding: spacing[2], textAlign: 'left' }}>ECU</th>
                                        <th style={{ padding: spacing[2], textAlign: 'left' }}>Event</th>
                                        <th style={{ padding: spacing[2], textAlign: 'left' }}>Level</th>
                                        <th style={{ padding: spacing[2], textAlign: 'left' }}>Data/Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {securityEvents.map((event, idx) => (
                                    <tr key={idx} style={{
                                      borderBottom: `1px solid ${colors.border.light}`,
                                      backgroundColor: event.type === 'Key Accepted' ? colors.success[50] :
                                                      event.type === 'Security Access Rejected' ? colors.error[50] :
                                                      'transparent'
                                    }}>
                                      <td style={{ padding: spacing[2], fontFamily: 'monospace', fontSize: '12px' }}>
                                        {event.timestamp || 'N/A'}
                                      </td>
                                      <td style={{ padding: spacing[2] }}>
                                        {event.target === '0E80' ? 'Tester' :
                                          (ecuNames[event.target]?.name || event.target)}
                                      </td>
                                      <td style={{ padding: spacing[2] }}>
                                        <Badge
                                          variant={event.type === 'Key Accepted' ? 'success' :
                                                  event.type === 'Security Access Rejected' ? 'error' :
                                                  'secondary'}
                                          size="small"
                                        >
                                          {event.type}
                                        </Badge>
                                      </td>
                                      <td style={{ padding: spacing[2] }}>
                                        {event.level || '-'}
                                      </td>
                                      <td style={{ padding: spacing[2], fontFamily: 'monospace', fontSize: '12px' }}>
                                        {event.data || '-'}
                                      </td>
                                    </tr>
                                  ))}
                                    </tbody>
                                  </table>
                                </div>
                              </>
                            ) : ecuWithSecurity.length > 0 ? (
                              <>
                                <h4 className="ds-heading-4" style={{ marginBottom: spacing[3] }}>ECUs with Security Access</h4>
                                <div className="ds-flex-row ds-flex-wrap" style={{ gap: spacing[3] }}>
                                  {ecuWithSecurity.map(ecu => (
                                    <Card key={ecu.address} variant="nested">
                                      <div className="ds-flex-row" style={{ gap: spacing[3], alignItems: 'center' }}>
                                        <Badge variant="secondary">{ecu.address}</Badge>
                                        <span>{ecu.name}</span>
                                      </div>
                                      <div className="ds-flex-row ds-flex-wrap" style={{ gap: spacing[2], marginTop: spacing[2] }}>
                                        {ecu.securityLevels.map(level => (
                                          <Badge key={level} variant="info" size="small">
                                            Level 0x{level}
                                          </Badge>
                                        ))}
                                      </div>
                                    </Card>
                                  ))}
                                </div>
                              </>
                            ) : null}
                          </div>
                        </>
                      ) : (
                        <div style={{
                          padding: spacing[6],
                          textAlign: 'center',
                          backgroundColor: colors.gray[50],
                          borderRadius: '8px'
                        }}>
                          <AlertCircle size={48} color={colors.gray[400]} style={{ marginBottom: spacing[3] }} />
                          <p className="ds-heading-4" style={{ color: colors.gray[700], marginBottom: spacing[2] }}>
                            No Security Access Detected
                          </p>
                          <p style={{ color: colors.gray[600] }}>
                            This job did not include any security access (0x27) service usage
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </Card>
            </div>
          )}
        </Card>
      </div>
    </PageLayout>
  )
}
