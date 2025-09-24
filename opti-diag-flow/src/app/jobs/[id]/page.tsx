'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Download, RefreshCw, AlertCircle, Activity, Database, Cpu, CheckCircle, ArrowRight, ChevronDown, Filter, FileDigit, Zap, Car, Calendar, Info } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
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
  const [activeTab, setActiveTab] = useState('overview')
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
    fetchJob()
  }, [params.id])

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

    // Common OBD-II DTC descriptions for generic codes
    const obdiiDTCs: Record<string, string> = {
      // P0xxx - Powertrain Generic
      'P0100': 'Mass or Volume Air Flow Circuit Malfunction',
      'P0101': 'Mass or Volume Air Flow Circuit Range/Performance Problem',
      'P0102': 'Mass or Volume Air Flow Circuit Low Input',
      'P0103': 'Mass or Volume Air Flow Circuit High Input',
      'P0104': 'Mass or Volume Air Flow Circuit Intermittent',
      'P0105': 'Manifold Absolute Pressure/Barometric Pressure Circuit Malfunction',
      'P0106': 'Manifold Absolute Pressure/Barometric Pressure Circuit Range/Performance Problem',
      'P0107': 'Manifold Absolute Pressure/Barometric Pressure Circuit Low Input',
      'P0108': 'Manifold Absolute Pressure/Barometric Pressure Circuit High Input',
      'P0109': 'Manifold Absolute Pressure/Barometric Pressure Circuit Intermittent',
      'P0110': 'Intake Air Temperature Circuit Malfunction',
      'P0111': 'Intake Air Temperature Circuit Range/Performance Problem',
      'P0112': 'Intake Air Temperature Circuit Low Input',
      'P0113': 'Intake Air Temperature Circuit High Input',
      'P0114': 'Intake Air Temperature Circuit Intermittent',
      'P0115': 'Engine Coolant Temperature Circuit Malfunction',
      'P0116': 'Engine Coolant Temperature Circuit Range/Performance Problem',
      'P0117': 'Engine Coolant Temperature Circuit Low Input',
      'P0118': 'Engine Coolant Temperature Circuit High Input',
      'P0119': 'Engine Coolant Temperature Circuit Intermittent',
      'P0120': 'Throttle/Pedal Position Sensor/Switch "A" Circuit Malfunction',
      'P0121': 'Throttle/Pedal Position Sensor/Switch "A" Circuit Range/Performance Problem',
      'P0122': 'Throttle/Pedal Position Sensor/Switch "A" Circuit Low Input',
      'P0123': 'Throttle/Pedal Position Sensor/Switch "A" Circuit High Input',
      'P0124': 'Throttle/Pedal Position Sensor/Switch "A" Circuit Intermittent',
      'P0020': 'Intake Camshaft Position Actuator Circuit/Open (Bank 2)',
      'P0021': 'Intake Camshaft Position Timing - Over-Advanced (Bank 2)',
      'P0022': 'Intake Camshaft Position Timing - Over-Retarded (Bank 2)',
      'P0023': 'Exhaust Camshaft Position Actuator Circuit/Open (Bank 2)',
      'P0024': 'Exhaust Camshaft Position Timing - Over-Advanced (Bank 2)',
      'P0025': 'Exhaust Camshaft Position Timing - Over-Retarded (Bank 2)',
      'P0026': 'Intake Valve Control Solenoid Circuit Range/Performance (Bank 1)',
      'P0027': 'Exhaust Valve Control Solenoid Circuit Range/Performance (Bank 1)',
      'P0028': 'Intake Valve Control Solenoid Circuit Range/Performance (Bank 2)',
      'P0029': 'Exhaust Valve Control Solenoid Circuit Range/Performance (Bank 2)',
      'P0030': 'O2 Sensor Heater Control Circuit (Bank 1, Sensor 1)',
      'P0031': 'O2 Sensor Heater Control Circuit Low (Bank 1, Sensor 1)',
      'P0032': 'O2 Sensor Heater Control Circuit High (Bank 1, Sensor 1)',
      'P0033': 'Turbo/Super Charger Bypass Valve Control Circuit',
      'P0034': 'Turbo/Super Charger Bypass Valve Control Circuit Low',
      'P0035': 'Turbo/Super Charger Bypass Valve Control Circuit High',
      'P0036': 'O2 Sensor Heater Control Circuit (Bank 1, Sensor 2)',
      'P0037': 'O2 Sensor Heater Control Circuit Low (Bank 1, Sensor 2)',
      'P0038': 'O2 Sensor Heater Control Circuit High (Bank 1, Sensor 2)',
      'P0039': 'Turbo/Super Charger Bypass Valve Control Circuit Range/Performance',
      'P0040': 'O2 Sensor Signals Swapped (Bank 1, Sensor 1 / Bank 2, Sensor 1)',
      'P0041': 'O2 Sensor Signals Swapped (Bank 1, Sensor 2 / Bank 2, Sensor 2)',
      'P0042': 'O2 Sensor Heater Control Circuit (Bank 1, Sensor 3)',
      'P0043': 'O2 Sensor Heater Control Circuit Low (Bank 1, Sensor 3)',
      'P0044': 'O2 Sensor Heater Control Circuit High (Bank 1, Sensor 3)',
      'P0045': 'Turbo/Super Charger Boost Control Solenoid Circuit/Open',
      'P0046': 'Turbo/Super Charger Boost Control Solenoid Circuit Range/Performance',
      'P0047': 'Turbo/Super Charger Boost Control Solenoid Circuit Low',
      'P0048': 'Turbo/Super Charger Boost Control Solenoid Circuit High',
      'P0049': 'Turbo/Super Charger Turbine Overspeed',
      'P0050': 'O2 Sensor Heater Control Circuit (Bank 2, Sensor 1)',
      'P0051': 'O2 Sensor Heater Control Circuit Low (Bank 2, Sensor 1)',
      'P0052': 'O2 Sensor Heater Control Circuit High (Bank 2, Sensor 1)',
      'P0053': 'O2 Sensor Heater Resistance (Bank 1, Sensor 1)',
      'P0054': 'O2 Sensor Heater Resistance (Bank 1, Sensor 2)',
      'P0055': 'O2 Sensor Heater Resistance (Bank 1, Sensor 3)',
      'P0056': 'O2 Sensor Heater Control Circuit (Bank 2, Sensor 2)',
      'P0057': 'O2 Sensor Heater Control Circuit Low (Bank 2, Sensor 2)',
      'P0058': 'O2 Sensor Heater Control Circuit High (Bank 2, Sensor 2)',
      'P0059': 'O2 Sensor Heater Resistance (Bank 2, Sensor 1)',
      'P0060': 'O2 Sensor Heater Resistance (Bank 2, Sensor 2)',
      'P0061': 'O2 Sensor Heater Resistance (Bank 2, Sensor 3)',
      'P0062': 'O2 Sensor Heater Control Circuit (Bank 2, Sensor 3)',
      'P0063': 'O2 Sensor Heater Control Circuit Low (Bank 2, Sensor 3)',
      'P0064': 'O2 Sensor Heater Control Circuit High (Bank 2, Sensor 3)',
      'P0065': 'Air Assisted Injector Control Range/Performance',
      'P0066': 'Air Assisted Injector Control Circuit/Open',
      'P0067': 'Air Assisted Injector Control Circuit Low',
      'P0068': 'Manifold Absolute Pressure/Mass Air Flow Throttle Position Correlation',
      'P0069': 'Manifold Absolute Pressure/Barometric Pressure Correlation',
      'P0070': 'Ambient Air Temperature Sensor Circuit',
      'P0071': 'Ambient Air Temperature Sensor Range/Performance',
      'P0072': 'Ambient Air Temperature Sensor Circuit Low',
      'P0073': 'Ambient Air Temperature Sensor Circuit High',
      'P0074': 'Ambient Air Temperature Sensor Circuit Intermittent',
      'P0075': 'Intake Valve Control Solenoid Circuit (Bank 1)',
      'P0076': 'Intake Valve Control Solenoid Circuit Low (Bank 1)',
      'P0077': 'Intake Valve Control Solenoid Circuit High (Bank 1)',
      'P0078': 'Exhaust Valve Control Solenoid Circuit (Bank 1)',
      'P0079': 'Exhaust Valve Control Solenoid Circuit Low (Bank 1)',
      'P0080': 'Exhaust Valve Control Solenoid Circuit High (Bank 1)',
      'P0081': 'Intake Valve Control Solenoid Circuit (Bank 2)',
      'P0082': 'Intake Valve Control Solenoid Circuit Low (Bank 2)',
      'P0083': 'Intake Valve Control Solenoid Circuit High (Bank 2)',
      'P0084': 'Exhaust Valve Control Solenoid Circuit (Bank 2)',
      'P0085': 'Exhaust Valve Control Solenoid Circuit Low (Bank 2)',
      'P0086': 'Exhaust Valve Control Solenoid Circuit High (Bank 2)',
      'P0087': 'Fuel Rail/System Pressure Too Low',
      'P0088': 'Fuel Rail/System Pressure Too High',
      'P0089': 'Fuel Pressure Regulator Performance',
      'P0090': 'Fuel Pressure Regulator Control Circuit',
      'P0091': 'Fuel Pressure Regulator Control Circuit Low',
      'P0092': 'Fuel Pressure Regulator Control Circuit High',
      'P0093': 'Fuel System Leak Detected - Large Leak',
      'P0094': 'Fuel System Leak Detected - Small Leak',
      'P0095': 'Intake Air Temperature Sensor 2 Circuit',
      'P0096': 'Intake Air Temperature Sensor 2 Circuit Range/Performance',
      'P0097': 'Intake Air Temperature Sensor 2 Circuit Low',
      'P0098': 'Intake Air Temperature Sensor 2 Circuit High',
      'P0099': 'Intake Air Temperature Sensor 2 Circuit Intermittent/Erratic',
      'P0125': 'Insufficient Coolant Temperature for Closed Loop Fuel Control',
      'P0126': 'Insufficient Coolant Temperature for Stable Operation',
      'P0127': 'Intake Air Temperature Too High',
      'P0128': 'Coolant Thermostat (Coolant Temperature Below Thermostat Regulating Temperature)',
      'P0129': 'Barometric Pressure Too Low',
      'P0130': 'O2 Sensor Circuit Malfunction (Bank 1, Sensor 1)',
      'P0131': 'O2 Sensor Circuit Low Voltage (Bank 1, Sensor 1)',
      'P0132': 'O2 Sensor Circuit High Voltage (Bank 1, Sensor 1)',
      'P0133': 'O2 Sensor Circuit Slow Response (Bank 1, Sensor 1)',
      'P0134': 'O2 Sensor Circuit No Activity Detected (Bank 1, Sensor 1)',
      'P0135': 'O2 Sensor Heater Circuit Malfunction (Bank 1, Sensor 1)',
      'P0136': 'O2 Sensor Circuit Malfunction (Bank 1, Sensor 2)',
      'P0137': 'O2 Sensor Circuit Low Voltage (Bank 1, Sensor 2)',
      'P0138': 'O2 Sensor Circuit High Voltage (Bank 1, Sensor 2)',
      'P0139': 'O2 Sensor Circuit Slow Response (Bank 1, Sensor 2)',
      'P0140': 'O2 Sensor Circuit No Activity Detected (Bank 1, Sensor 2)',
      'P0141': 'O2 Sensor Heater Circuit Malfunction (Bank 1, Sensor 2)',
      'P0150': 'O2 Sensor Circuit Malfunction (Bank 2, Sensor 1)',
      'P0151': 'O2 Sensor Circuit Low Voltage (Bank 2, Sensor 1)',
      'P0152': 'O2 Sensor Circuit High Voltage (Bank 2, Sensor 1)',
      'P0153': 'O2 Sensor Circuit Slow Response (Bank 2, Sensor 1)',
      'P0154': 'O2 Sensor Circuit No Activity Detected (Bank 2, Sensor 1)',
      'P0155': 'O2 Sensor Heater Circuit Malfunction (Bank 2, Sensor 1)',
      'P0156': 'O2 Sensor Circuit Malfunction (Bank 2, Sensor 2)',
      'P0157': 'O2 Sensor Circuit Low Voltage (Bank 2, Sensor 2)',
      'P0158': 'O2 Sensor Circuit High Voltage (Bank 2, Sensor 2)',
      'P0159': 'O2 Sensor Circuit Slow Response (Bank 2, Sensor 2)',
      'P0160': 'O2 Sensor Circuit No Activity Detected (Bank 2, Sensor 2)',
      'P0161': 'O2 Sensor Heater Circuit Malfunction (Bank 2, Sensor 2)',
      'P0170': 'Fuel Trim Malfunction (Bank 1)',
      'P0171': 'System Too Lean (Bank 1)',
      'P0172': 'System Too Rich (Bank 1)',
      'P0173': 'Fuel Trim Malfunction (Bank 2)',
      'P0174': 'System Too Lean (Bank 2)',
      'P0175': 'System Too Rich (Bank 2)',
      'P0300': 'Random/Multiple Cylinder Misfire Detected',
      'P0301': 'Cylinder 1 Misfire Detected',
      'P0302': 'Cylinder 2 Misfire Detected',
      'P0303': 'Cylinder 3 Misfire Detected',
      'P0304': 'Cylinder 4 Misfire Detected',
      'P0305': 'Cylinder 5 Misfire Detected',
      'P0306': 'Cylinder 6 Misfire Detected',
      'P0307': 'Cylinder 7 Misfire Detected',
      'P0308': 'Cylinder 8 Misfire Detected',
      'P0320': 'Ignition/Distributor Engine Speed Input Circuit Malfunction',
      'P0325': 'Knock Sensor 1 Circuit Malfunction (Bank 1 or Single Sensor)',
      'P0330': 'Knock Sensor 2 Circuit Malfunction (Bank 2)',
      'P0335': 'Crankshaft Position Sensor "A" Circuit Malfunction',
      'P0340': 'Camshaft Position Sensor Circuit Malfunction',
      'P0401': 'Exhaust Gas Recirculation Flow Insufficient Detected',
      'P0402': 'Exhaust Gas Recirculation Flow Excessive Detected',
      'P0403': 'Exhaust Gas Recirculation Circuit Malfunction',
      'P0404': 'Exhaust Gas Recirculation Circuit Range/Performance',
      'P0405': 'Exhaust Gas Recirculation Sensor "A" Circuit Low',
      'P0406': 'Exhaust Gas Recirculation Sensor "A" Circuit High',
      'P0420': 'Catalyst System Efficiency Below Threshold (Bank 1)',
      'P0430': 'Catalyst System Efficiency Below Threshold (Bank 2)',
      'P0440': 'Evaporative Emission Control System Malfunction',
      'P0441': 'Evaporative Emission Control System Incorrect Purge Flow',
      'P0442': 'Evaporative Emission Control System Leak Detected (Small Leak)',
      'P0443': 'Evaporative Emission Control System Purge Control Valve Circuit Malfunction',
      'P0446': 'Evaporative Emission Control System Vent Control Circuit Malfunction',
      'P0449': 'Evaporative Emission Control System Vent Valve/Solenoid Circuit Malfunction',
      'P0450': 'Evaporative Emission Control System Pressure Sensor Malfunction',
      'P0451': 'Evaporative Emission Control System Pressure Sensor Range/Performance',
      'P0452': 'Evaporative Emission Control System Pressure Sensor Low Input',
      'P0453': 'Evaporative Emission Control System Pressure Sensor High Input',
      'P0455': 'Evaporative Emission Control System Leak Detected (Gross Leak)',
      'P0500': 'Vehicle Speed Sensor Malfunction',
      'P0501': 'Vehicle Speed Sensor Range/Performance',
      'P0502': 'Vehicle Speed Sensor Circuit Low Input',
      'P0503': 'Vehicle Speed Sensor Intermittent/Erratic/High',
      'P0505': 'Idle Control System Malfunction',
      'P0506': 'Idle Control System RPM Lower Than Expected',
      'P0507': 'Idle Control System RPM Higher Than Expected',
      'P0510': 'Closed Throttle Position Switch Malfunction',
      'P0600': 'Serial Communication Link Malfunction',
      'P0601': 'Internal Control Module Memory Check Sum Error',
      'P0602': 'Control Module Programming Error',
      'P0603': 'Internal Control Module Keep Alive Memory (KAM) Error',
      'P0604': 'Internal Control Module Random Access Memory (RAM) Error',
      'P0605': 'Internal Control Module Read Only Memory (ROM) Error',
      'P0700': 'Transmission Control System Malfunction',
      'P0701': 'Transmission Control System Range/Performance',
      'P0702': 'Transmission Control System Electrical',
      'P0703': 'Torque Converter/Brake Switch "B" Circuit Malfunction',
      'P0704': 'Clutch Switch Input Circuit Malfunction',
      'P0705': 'Transmission Range Sensor Circuit Malfunction (PRNDL Input)',
      'P0720': 'Output Speed Sensor Circuit Malfunction',
      'P0725': 'Engine Speed Input Circuit Malfunction',
      'P0730': 'Incorrect Gear Ratio',
      'P0740': 'Torque Converter Clutch Circuit Malfunction',
      'P0741': 'Torque Converter Clutch Circuit Performance or Stuck Off',
      'P0742': 'Torque Converter Clutch Circuit Stuck On',
      'P0743': 'Torque Converter Clutch Circuit Electrical',
      'P0744': 'Torque Converter Clutch Circuit Intermittent',
      'P0745': 'Pressure Control Solenoid Malfunction',
      'P0746': 'Pressure Control Solenoid Performance or Stuck Off',
      'P0747': 'Pressure Control Solenoid Stuck On',
      'P0748': 'Pressure Control Solenoid Electrical',
      'P0749': 'Pressure Control Solenoid Intermittent',
      'P0750': 'Shift Solenoid "A" Malfunction',
      'P0751': 'Shift Solenoid "A" Performance or Stuck Off',
      'P0752': 'Shift Solenoid "A" Stuck On',
      'P0753': 'Shift Solenoid "A" Electrical',
      'P0754': 'Shift Solenoid "A" Intermittent',
      'P0755': 'Shift Solenoid "B" Malfunction',
      'P0756': 'Shift Solenoid "B" Performance or Stuck Off',
      'P0757': 'Shift Solenoid "B" Stuck On',
      'P0758': 'Shift Solenoid "B" Electrical',
      'P0759': 'Shift Solenoid "B" Intermittent',
      'P0760': 'Shift Solenoid "C" Malfunction',
      'P0761': 'Shift Solenoid "C" Performance or Stuck Off',
      'P0762': 'Shift Solenoid "C" Stuck On',
      'P0763': 'Shift Solenoid "C" Electrical',
      'P0764': 'Shift Solenoid "C" Intermittent',
      'P0765': 'Shift Solenoid "D" Malfunction',
      'P0766': 'Shift Solenoid "D" Performance or Stuck Off',
      'P0767': 'Shift Solenoid "D" Stuck On',
      'P0768': 'Shift Solenoid "D" Electrical',
      'P0769': 'Shift Solenoid "D" Intermittent',
      'P0770': 'Shift Solenoid "E" Malfunction',
      'P0771': 'Shift Solenoid "E" Performance or Stuck Off',
      'P0772': 'Shift Solenoid "E" Stuck On',
      'P0773': 'Shift Solenoid "E" Electrical',
      'P0774': 'Shift Solenoid "E" Intermittent',
      'P0780': 'Shift Malfunction',
      'P0781': '1-2 Shift Malfunction',
      'P0782': '2-3 Shift Malfunction',
      'P0783': '3-4 Shift Malfunction',
      'P0784': '4-5 Shift Malfunction',
      'P0785': 'Shift/Timing Solenoid Malfunction',
      'P0786': 'Shift/Timing Solenoid Range/Performance',
      'P0787': 'Shift/Timing Solenoid Low',
      'P0788': 'Shift/Timing Solenoid High',
      'P0789': 'Shift/Timing Solenoid Intermittent',
      'P0790': 'Normal/Performance Switch Circuit Malfunction',
      'P0791': 'Intermediate Shaft Speed Sensor Circuit',
      'P0792': 'Intermediate Shaft Speed Sensor Circuit Range/Performance',
      'P0793': 'Intermediate Shaft Speed Sensor Circuit No Signal',
      'P0794': 'Intermediate Shaft Speed Sensor Circuit Intermittent',
      'P0795': 'Pressure Control Solenoid "C"',
      'P0796': 'Pressure Control Solenoid "C" Performance or Stuck Off',
      'P0797': 'Pressure Control Solenoid "C" Stuck On',
      'P0798': 'Pressure Control Solenoid "C" Electrical',
      'P0799': 'Pressure Control Solenoid "C" Intermittent',

      // P1xxx - Manufacturer Specific Powertrain
      'P1000': 'OBD System Readiness Test Not Complete',
      'P1001': 'Key On Engine Running (KOER) Self-Test Not Able to Complete',
      'P1100': 'Mass Air Flow Sensor Intermittent',
      'P1101': 'Mass Air Flow Sensor Out of Self-Test Range',
      'P1110': 'Intake Air Temperature Sensor Intermittent',
      'P1111': 'System Pass',
      'P1112': 'Intake Air Temperature Sensor Intermittent',
      'P1116': 'Engine Coolant Temperature Sensor Out of Self-Test Range',
      'P1117': 'Engine Coolant Temperature Sensor Intermittent',
      'P1120': 'Throttle Position Sensor Out of Range (Low)',
      'P1121': 'Throttle Position Sensor Inconsistent with MAF',
      'P1124': 'Throttle Position Sensor Out of Self-Test Range',
      'P1125': 'Throttle Position Sensor Circuit Intermittent',
      'P1130': 'Lack of HO2S-11 Switch - Adaptive Fuel at Limit',
      'P1131': 'Lack of HO2S-11 Switch - Sensor Indicates Lean',
      'P1132': 'Lack of HO2S-11 Switch - Sensor Indicates Rich',
      'P1137': 'Lack of HO2S-12 Switch - Sensor Indicates Lean',
      'P1138': 'Lack of HO2S-12 Switch - Sensor Indicates Rich',
      'P1150': 'Lack of HO2S-21 Switch - Adaptive Fuel at Limit',
      'P1151': 'Lack of HO2S-21 Switch - Sensor Indicates Lean',
      'P1152': 'Lack of HO2S-21 Switch - Sensor Indicates Rich',
      'P1157': 'Lack of HO2S-22 Switch - Sensor Indicates Lean',
      'P1158': 'Lack of HO2S-22 Switch - Sensor Indicates Rich',

      // More standard P0xxx codes
      'P0800': 'Transfer Case Control System Request MIL',
      'P0801': 'Reverse Inhibit Control Circuit Malfunction',
      'P0803': '1-4 Upshift (Skip Shift) Solenoid Control Circuit Malfunction',
      'P0804': '1-4 Upshift (Skip Shift) Lamp Control Circuit Malfunction',
      'P0805': 'Clutch Position Sensor Circuit Malfunction',
      'P0820': 'Gear Lever X-Y Position Sensor Circuit',
      'P0830': 'Clutch Pedal Switch "A" Circuit',
      'P0831': 'Clutch Pedal Switch "A" Circuit Low',
      'P0832': 'Clutch Pedal Switch "A" Circuit High',
      'P0833': 'Clutch Pedal Switch "B" Circuit',
      'P0834': 'Clutch Pedal Switch "B" Circuit Low',
      'P0835': 'Clutch Pedal Switch "B" Circuit High',
      'P0840': 'Transmission Fluid Pressure Sensor/Switch "A" Circuit',
      'P0841': 'Transmission Fluid Pressure Sensor/Switch "A" Circuit Range/Performance',
      'P0842': 'Transmission Fluid Pressure Sensor/Switch "A" Circuit Low',
      'P0843': 'Transmission Fluid Pressure Sensor/Switch "A" Circuit High',
      'P0844': 'Transmission Fluid Pressure Sensor/Switch "A" Circuit Intermittent',
      'P0845': 'Transmission Fluid Pressure Sensor/Switch "B" Circuit',
      'P0846': 'Transmission Fluid Pressure Sensor/Switch "B" Circuit Range/Performance',
      'P0847': 'Transmission Fluid Pressure Sensor/Switch "B" Circuit Low',
      'P0848': 'Transmission Fluid Pressure Sensor/Switch "B" Circuit High',
      'P0849': 'Transmission Fluid Pressure Sensor/Switch "B" Circuit Intermittent',
      'P0850': 'Park/Neutral Position (PNP) Switch Input Circuit',
      'P0851': 'Park/Neutral Position (PNP) Switch Input Circuit Low',
      'P0852': 'Park/Neutral Position (PNP) Switch Input Circuit High',
      'P0853': 'Drive Switch Input Circuit',
      'P0854': 'Drive Switch Input Circuit Low',
      'P0855': 'Drive Switch Input Circuit High',
      'P0856': 'Traction Control Input Signal',
      'P0857': 'Traction Control Input Signal Range/Performance',
      'P0858': 'Traction Control Input Signal Low',
      'P0859': 'Traction Control Input Signal High',
      'P0860': 'Gear Shift Module Communication Circuit',
      'P0861': 'Gear Shift Module Communication Circuit Low',
      'P0862': 'Gear Shift Module Communication Circuit High',
      'P0863': 'TCM Communication Circuit',
      'P0864': 'TCM Communication Circuit Range/Performance',
      'P0865': 'TCM Communication Circuit Low',
      'P0866': 'TCM Communication Circuit High',
      'P0867': 'Transmission Fluid Pressure',
      'P0868': 'Transmission Fluid Pressure Low',
      'P0869': 'Transmission Fluid Pressure High',
      'P0870': 'Transmission Fluid Pressure Sensor/Switch "C" Circuit',
      'P0871': 'Transmission Fluid Pressure Sensor/Switch "C" Circuit Range/Performance',
      'P0872': 'Transmission Fluid Pressure Sensor/Switch "C" Circuit Low',
      'P0873': 'Transmission Fluid Pressure Sensor/Switch "C" Circuit High',
      'P0874': 'Transmission Fluid Pressure Sensor/Switch "C" Circuit Intermittent',
      'P0875': 'Transmission Fluid Pressure Sensor/Switch "D" Circuit',
      'P0876': 'Transmission Fluid Pressure Sensor/Switch "D" Circuit Range/Performance',
      'P0877': 'Transmission Fluid Pressure Sensor/Switch "D" Circuit Low',
      'P0878': 'Transmission Fluid Pressure Sensor/Switch "D" Circuit High',
      'P0879': 'Transmission Fluid Pressure Sensor/Switch "D" Circuit Intermittent',
      'P0880': 'TCM Power Input Signal',
      'P0881': 'TCM Power Input Signal Range/Performance',
      'P0882': 'TCM Power Input Signal Low',
      'P0883': 'TCM Power Input Signal High',
      'P0884': 'TCM Power Input Signal Intermittent',
      'P0885': 'TCM Power Relay Control Circuit/Open',
      'P0886': 'TCM Power Relay Control Circuit Low',
      'P0887': 'TCM Power Relay Control Circuit High',
      'P0888': 'TCM Power Relay Sense Circuit',
      'P0889': 'TCM Power Relay Sense Circuit Range/Performance',
      'P0890': 'TCM Power Relay Sense Circuit Low',
      'P0891': 'TCM Power Relay Sense Circuit High',
      'P0892': 'TCM Power Relay Sense Circuit Intermittent',
      'P0893': 'Multiple Gears Engaged',
      'P0894': 'Transmission Component Slipping',
      'P0895': 'Shift Time Too Short',
      'P0896': 'Shift Time Too Long',
      'P0897': 'Transmission Fluid Deteriorated',
      'P0898': 'Transmission Control System MIL Request Circuit Low',
      'P0899': 'Transmission Control System MIL Request Circuit High',

      // Additional critical P codes for comprehensive coverage
      'P0900': 'Clutch Actuator Circuit/Open',
      'P0901': 'Clutch Actuator Circuit Range/Performance',
      'P0902': 'Clutch Actuator Circuit Low',
      'P0903': 'Clutch Actuator Circuit High',
      'P0904': 'Gate Select Position Circuit',
      'P0905': 'Gate Select Position Circuit Range/Performance',
      'P0906': 'Gate Select Position Circuit Low',
      'P0907': 'Gate Select Position Circuit High',
      'P0908': 'Gate Select Position Circuit Intermittent',
      'P0909': 'Gate Select Control Error',
      'P0910': 'Gate Select Actuator Circuit/Open',
      'P0911': 'Gate Select Actuator Circuit Range/Performance',
      'P0912': 'Gate Select Actuator Circuit Low',
      'P0913': 'Gate Select Actuator Circuit High',
      'P0914': 'Gear Shift Position Circuit',
      'P0915': 'Gear Shift Position Circuit Range/Performance',
      'P0916': 'Gear Shift Position Circuit Low',
      'P0917': 'Gear Shift Position Circuit High',
      'P0918': 'Gear Shift Position Circuit Intermittent',
      'P0919': 'Gear Shift Position Control Error',
      'P0920': 'Gear Shift Forward Actuator Circuit/Open',
      'P0921': 'Gear Shift Forward Actuator Circuit Range/Performance',
      'P0922': 'Gear Shift Forward Actuator Circuit Low',
      'P0923': 'Gear Shift Forward Actuator Circuit High',
      'P0924': 'Gear Shift Reverse Actuator Circuit/Open',
      'P0925': 'Gear Shift Reverse Actuator Circuit Range/Performance',
      'P0926': 'Gear Shift Reverse Actuator Circuit Low',
      'P0927': 'Gear Shift Reverse Actuator Circuit High',
      'P0928': 'Gear Shift Lock Solenoid Control Circuit/Open',
      'P0929': 'Gear Shift Lock Solenoid Control Circuit Range/Performance',
      'P0930': 'Gear Shift Lock Solenoid Control Circuit Low',
      'P0931': 'Gear Shift Lock Solenoid Control Circuit High',
      'P0932': 'Hydraulic Pressure Sensor Circuit',
      'P0933': 'Hydraulic Pressure Sensor Circuit Range/Performance',
      'P0934': 'Hydraulic Pressure Sensor Circuit Low',
      'P0935': 'Hydraulic Pressure Sensor Circuit High',
      'P0936': 'Hydraulic Pressure Sensor Circuit Intermittent',
      'P0937': 'Hydraulic Oil Temperature Sensor Circuit',
      'P0938': 'Hydraulic Oil Temperature Sensor Circuit Range/Performance',
      'P0939': 'Hydraulic Oil Temperature Sensor Circuit Low',
      'P0940': 'Hydraulic Oil Temperature Sensor Circuit High',
      'P0941': 'Hydraulic Oil Temperature Sensor Circuit Intermittent',
      'P0942': 'Hydraulic Pressure Unit',
      'P0943': 'Hydraulic Pressure Unit Cycling Period Too Short',
      'P0944': 'Hydraulic Pressure Unit Loss of Pressure',
      'P0945': 'Hydraulic Pump Relay Circuit/Open',
      'P0946': 'Hydraulic Pump Relay Circuit Range/Performance',
      'P0947': 'Hydraulic Pump Relay Circuit Low',
      'P0948': 'Hydraulic Pump Relay Circuit High',
      'P0949': 'Auto Shift Manual Adaptive Learning Not Complete',
      'P0950': 'Auto Shift Manual Control Circuit',
      'P0951': 'Auto Shift Manual Control Circuit Range/Performance',
      'P0952': 'Auto Shift Manual Control Circuit Low',
      'P0953': 'Auto Shift Manual Control Circuit High',
      'P0954': 'Auto Shift Manual Control Circuit Intermittent',
      'P0955': 'Auto Shift Manual Mode Circuit',
      'P0956': 'Auto Shift Manual Mode Circuit Range/Performance',
      'P0957': 'Auto Shift Manual Mode Circuit Low',
      'P0958': 'Auto Shift Manual Mode Circuit High',
      'P0959': 'Auto Shift Manual Mode Circuit Intermittent',
      'P0960': 'Pressure Control Solenoid "A" Control Circuit/Open',
      'P0961': 'Pressure Control Solenoid "A" Control Circuit Range/Performance',
      'P0962': 'Pressure Control Solenoid "A" Control Circuit Low',
      'P0963': 'Pressure Control Solenoid "A" Control Circuit High',
      'P0964': 'Pressure Control Solenoid "B" Control Circuit/Open',
      'P0965': 'Pressure Control Solenoid "B" Control Circuit Range/Performance',
      'P0966': 'Pressure Control Solenoid "B" Control Circuit Low',
      'P0967': 'Pressure Control Solenoid "B" Control Circuit High',
      'P0968': 'Pressure Control Solenoid "C" Control Circuit/Open',
      'P0969': 'Pressure Control Solenoid "C" Control Circuit Range/Performance',
      'P0970': 'Pressure Control Solenoid "C" Control Circuit Low',
      'P0971': 'Pressure Control Solenoid "C" Control Circuit High',
      'P0972': 'Shift Solenoid "A" Control Circuit Range/Performance',
      'P0973': 'Shift Solenoid "A" Control Circuit Low',
      'P0974': 'Shift Solenoid "A" Control Circuit High',
      'P0975': 'Shift Solenoid "B" Control Circuit Range/Performance',
      'P0976': 'Shift Solenoid "B" Control Circuit Low',
      'P0977': 'Shift Solenoid "B" Control Circuit High',
      'P0978': 'Shift Solenoid "C" Control Circuit Range/Performance',
      'P0979': 'Shift Solenoid "C" Control Circuit Low',
      'P0980': 'Shift Solenoid "C" Control Circuit High',
      'P0981': 'Shift Solenoid "D" Control Circuit Range/Performance',
      'P0982': 'Shift Solenoid "D" Control Circuit Low',
      'P0983': 'Shift Solenoid "D" Control Circuit High',
      'P0984': 'Shift Solenoid "E" Control Circuit Range/Performance',
      'P0985': 'Shift Solenoid "E" Control Circuit Low',
      'P0986': 'Shift Solenoid "E" Control Circuit High',
      'P0987': 'Transmission Fluid Pressure Sensor/Switch "E" Circuit',
      'P0988': 'Transmission Fluid Pressure Sensor/Switch "E" Circuit Range/Performance',
      'P0989': 'Transmission Fluid Pressure Sensor/Switch "E" Circuit Low',
      'P0990': 'Transmission Fluid Pressure Sensor/Switch "E" Circuit High',
      'P0991': 'Transmission Fluid Pressure Sensor/Switch "E" Circuit Intermittent',
      'P0992': 'Transmission Fluid Pressure Sensor/Switch "F" Circuit',
      'P0993': 'Transmission Fluid Pressure Sensor/Switch "F" Circuit Range/Performance',
      'P0994': 'Transmission Fluid Pressure Sensor/Switch "F" Circuit Low',
      'P0995': 'Transmission Fluid Pressure Sensor/Switch "F" Circuit High',
      'P0996': 'Transmission Fluid Pressure Sensor/Switch "F" Circuit Intermittent',
      'P0997': 'Transmission Fluid Pressure Sensor/Switch "G" Circuit',
      'P0998': 'Transmission Fluid Pressure Sensor/Switch "G" Circuit Range/Performance',
      'P0999': 'Transmission Fluid Pressure Sensor/Switch "G" Circuit Low',

      // Additional common manufacturer P codes (like P142B that user mentioned)
      'P1400': 'EGR Solenoid Circuit Malfunction',
      'P1401': 'EGR Temperature Sensor Circuit High',
      'P1402': 'EGR Temperature Sensor Circuit Low',
      'P1403': 'Differential Pressure Feedback EGR Sensor Circuit Low Input',
      'P1404': 'Differential Pressure Feedback EGR Sensor Circuit High Input',
      'P1405': 'Differential Pressure Feedback EGR Sensor Upstream Hose Off or Plugged',
      'P1406': 'Differential Pressure Feedback EGR Sensor Downstream Hose Off or Plugged',
      'P1407': 'Exhaust Gas Recirculation No Flow Detected',
      'P1408': 'Exhaust Gas Recirculation Flow Out of Self-Test Range',
      'P1409': 'Electronic Vacuum Regulator Control Circuit',
      'P1410': 'Secondary Air Injection System Circuit Malfunction',
      'P1411': 'Secondary Air Injection System Incorrect Flow Detected',
      'P1412': 'Secondary Air Injection System Switching Valve "A" Circuit Malfunction',
      'P1413': 'Secondary Air Injection System Switching Valve "B" Circuit Malfunction',
      'P1414': 'Secondary Air Injection System Switching Valve "B" Circuit Malfunction',
      'P1415': 'Air Injection Pump Control Circuit',
      'P1416': 'Air Injection Pump Control Circuit Malfunction',
      'P1417': 'Secondary Air Injection System Switching Valve "A" Circuit Malfunction',
      'P1418': 'Secondary Air Injection System Switching Valve "B" Circuit Malfunction',
      'P1419': 'Secondary Air Injection System',
      'P1420': 'Secondary Air Injection System Circuit Malfunction',
      'P1421': 'Secondary Air Injection System Circuit Malfunction',
      'P1422': 'Secondary Air Injection System Control "A" Circuit Malfunction',
      'P1423': 'Secondary Air Injection System Control "B" Circuit Malfunction',
      'P1424': 'Secondary Air Injection System',
      'P1425': 'Secondary Air Injection System',
      'P1426': 'Secondary Air Injection System',
      'P1427': 'Secondary Air Injection System',
      'P1428': 'Secondary Air Injection System',
      'P1429': 'Secondary Air Injection System',
      'P142B': 'Turbocharger/Supercharger Boost Control "A" Range/Performance Problem',

      // B0xxx - Body DTCs
      'B0001': 'Driver Air Bag Circuit Open',
      'B0002': 'Driver Air Bag Circuit Shorted',
      'B0003': 'Driver Air Bag Circuit Resistance Out of Range',
      'B0004': 'Passenger Air Bag Circuit Open',
      'B0005': 'Passenger Air Bag Circuit Shorted',
      'B0010': 'Driver Side Impact Sensor Circuit Open',
      'B0020': 'Passenger Side Impact Sensor Circuit Open',
      'B0050': 'Left Front Crash Sensor Circuit Open',
      'B0060': 'Right Front Crash Sensor Circuit Open',

      // C0xxx - Chassis DTCs
      'C0001': 'ABS System Voltage Low',
      'C0002': 'ABS System Voltage High',
      'C0005': 'Left Front Wheel Speed Sensor Circuit',
      'C0010': 'Right Front Wheel Speed Sensor Circuit',
      'C0015': 'Left Rear Wheel Speed Sensor Circuit',
      'C0020': 'Right Rear Wheel Speed Sensor Circuit',
      'C0035': 'Left Front Wheel Speed Circuit Malfunction',
      'C0040': 'Right Front Wheel Speed Circuit Malfunction',
      'C0045': 'Left Rear Wheel Speed Circuit Malfunction',
      'C0050': 'Right Rear Wheel Speed Circuit Malfunction',
      'C0060': 'ABS Solenoid "A" Malfunction',
      'C0065': 'ABS Solenoid "B" Malfunction',
      'C0070': 'ABS Solenoid "C" Malfunction',
      'C0075': 'ABS Solenoid "D" Malfunction',

      // U0xxx - Network Communication DTCs
      'U0001': 'High Speed CAN Communication Bus',
      'U0002': 'High Speed CAN Communication Bus Performance',
      'U0003': 'High Speed CAN Communication Bus (+) Open',
      'U0004': 'High Speed CAN Communication Bus (+) Low',
      'U0005': 'High Speed CAN Communication Bus (+) High',
      'U0006': 'High Speed CAN Communication Bus (-) Open',
      'U0007': 'High Speed CAN Communication Bus (-) Low',
      'U0008': 'High Speed CAN Communication Bus (-) High',
      'U0009': 'High Speed CAN Communication Bus (+) Shorted to (-)',
      'U0010': 'Medium Speed CAN Communication Bus',
      'U0011': 'Medium Speed CAN Communication Bus Performance',
      'U0012': 'Medium Speed CAN Communication Bus (+) Open',
      'U0013': 'Medium Speed CAN Communication Bus (+) Low',
      'U0014': 'Medium Speed CAN Communication Bus (+) High',
      'U0015': 'Medium Speed CAN Communication Bus (-) Open',
      'U0016': 'Medium Speed CAN Communication Bus (-) Low',
      'U0017': 'Medium Speed CAN Communication Bus (-) High',
      'U0018': 'Medium Speed CAN Communication Bus (+) Shorted to (-)',
      'U0100': 'Lost Communication with ECM/PCM "A"',
      'U0101': 'Lost Communication with TCM',
      'U0102': 'Lost Communication with Transfer Case Control Module',
      'U0103': 'Lost Communication with Gear Shift Module',
      'U0104': 'Lost Communication with Cruise Control Module',
      'U0105': 'Lost Communication with Fuel Injector Control Module',
      'U0106': 'Lost Communication with Glow Plug Control Module',
      'U0107': 'Lost Communication with Throttle Actuator Control Module',
      'U0108': 'Lost Communication with Alternative Fuel Control Module',
      'U0109': 'Lost Communication with Fuel Pump Control Module',
      'U0110': 'Lost Communication with Drive Motor Control Module',
      'U0111': 'Lost Communication with Battery Energy Control Module "A"',
      'U0112': 'Lost Communication with Battery Energy Control Module "B"',
      'U0113': 'Lost Communication with Emissions Critical Control Info',
      'U0114': 'Lost Communication with Four-Wheel Drive Clutch Control Module',
      'U0115': 'Lost Communication with Generator Control Module "A"',
      'U0120': 'Lost Communication with Starter Control Module',
      'U0121': 'Lost Communication with ABS Control Module',
      'U0122': 'Lost Communication with Vehicle Dynamic Control Module',
      'U0123': 'Lost Communication with Yaw Rate Sensor Module',
      'U0124': 'Lost Communication with Lateral Acceleration Sensor Module',
      'U0125': 'Lost Communication with Multi-Axis Acceleration Sensor Module',
      'U0126': 'Lost Communication with Steering Angle Sensor Module',
      'U0127': 'Lost Communication with Tire Pressure Monitor Module',
      'U0128': 'Lost Communication with Park Brake Control Module',
      'U0129': 'Lost Communication with Brake System Control Module',
      'U0130': 'Lost Communication with Steering Effort Control Module'
    }

    const description = obdiiDTCs[fullCode] || (isGeneric ? 'Generic OBD-II code' : 'Manufacturer specific code')

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
      const response = await fetch(`/api/jobs/${params.id}`)
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
      // Call the reparse API endpoint
      const response = await fetch(`/api/jobs/${params.id}/reparse`, {
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
            value={ecus.length}
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

        {/* Tabs and Content */}
        <Card>
          {/* Tab Navigation */}
          <div style={{ marginBottom: spacing[6] }}>
            <div className="ds-tab-group">
              <button
                className={`ds-tab ${activeTab === 'overview' ? 'ds-tab-active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                Overview
              </button>
              <button
                className={`ds-tab ${activeTab === 'jifeline' ? 'ds-tab-active' : ''}`}
                onClick={() => setActiveTab('jifeline')}
              >
                <FileDigit size={14} style={{ display: 'inline-block', marginRight: '4px' }} />
                Jifeline
              </button>
              <button
                className={`ds-tab ${activeTab === 'voltage' ? 'ds-tab-active' : ''}`}
                onClick={() => setActiveTab('voltage')}
              >
                <Zap size={14} style={{ display: 'inline-block', marginRight: '4px' }} />
                Battery Voltage
              </button>
              <button
                className={`ds-tab ${activeTab === 'ecus' ? 'ds-tab-active' : ''}`}
                onClick={() => setActiveTab('ecus')}
              >
                ECUs ({ecus.length})
              </button>
              <button
                className={`ds-tab ${activeTab === 'flow' ? 'ds-tab-active' : ''}`}
                onClick={() => setActiveTab('flow')}
              >
                Diagnostic Flow ({tabCounts.messages})
              </button>
              <button
                className={`ds-tab ${activeTab === 'dtcs' ? 'ds-tab-active' : ''}`}
                onClick={() => setActiveTab('dtcs')}
              >
                DTCs ({job.DTC?.length || 0})
              </button>
              <button
                className={`ds-tab ${activeTab === 'dids' ? 'ds-tab-active' : ''}`}
                onClick={() => setActiveTab('dids')}
              >
                DIDs ({job.DataIdentifier?.length || 0})
              </button>
              <button
                className={`ds-tab ${activeTab === 'routines' ? 'ds-tab-active' : ''}`}
                onClick={() => setActiveTab('routines')}
              >
                Routines ({job.Routine?.length || 0})
              </button>
              <button
                className={`ds-tab ${activeTab === 'services' ? 'ds-tab-active' : ''}`}
                onClick={() => setActiveTab('services')}
              >
                Services ({tabCounts.services})
              </button>
              <button
                className={`ds-tab ${activeTab === 'eobd' ? 'ds-tab-active' : ''}`}
                onClick={() => setActiveTab('eobd')}
              >
                EOBD
              </button>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
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
              <h3 className="ds-heading-3">Jifeline Trace Metadata</h3>

              {/* Connection Information */}
              <Card variant="nested" style={{ marginBottom: spacing[4] }}>
                <h4 className="ds-heading-4" style={{ marginBottom: spacing[3] }}>Connection Information</h4>
                <div className="ds-grid-2" style={{ gap: spacing[5] }}>
                  <div>
                    <p className="ds-label">Protocol</p>
                    <p className="ds-value">{job.metadata?.protocol || messages?.[0]?.protocol || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="ds-label">Diagnostic Protocol</p>
                    <p className="ds-value">{messages?.[0]?.diagnosticProtocol || 'UDS'}</p>
                  </div>
                  {job.metadata?.connectionInfo?.state && (
                    <div>
                      <p className="ds-label">Connection State</p>
                      <Badge variant={job.metadata.connectionInfo.state === 'connected' ? 'success' : 'secondary'}>
                        {job.metadata.connectionInfo.state}
                      </Badge>
                    </div>
                  )}
                  {job.metadata?.connectionInfo?.protocol && (
                    <div>
                      <p className="ds-label">Connection Protocol</p>
                      <p className="ds-value">{job.metadata.connectionInfo.protocol}</p>
                    </div>
                  )}
                  <div>
                    <p className="ds-label">Tester Address</p>
                    <p className="ds-value">
                      <Badge variant="secondary">0E80</Badge>
                    </p>
                  </div>
                  <div>
                    <p className="ds-label">Total ECUs</p>
                    <p className="ds-value">{ecus.length}</p>
                  </div>
                </div>
              </Card>

              {/* Trace Statistics */}
              <Card variant="nested" style={{ marginBottom: spacing[4] }}>
                <h4 className="ds-heading-4" style={{ marginBottom: spacing[3] }}>Trace Statistics</h4>
                <div className="ds-grid-3" style={{ gap: spacing[5] }}>
                  <div>
                    <p className="ds-label">Start Time</p>
                    <p className="ds-value">{messages?.[0]?.timestamp || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="ds-label">End Time</p>
                    <p className="ds-value">{messages?.[messages.length - 1]?.timestamp || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="ds-label">Duration</p>
                    <p className="ds-value">
                      {(() => {
                        if (!messages || messages.length < 2) return 'N/A'
                        const start = messages[0].timestamp
                        const end = messages[messages.length - 1].timestamp
                        // Parse timestamps (format: HH:MM:SS.mmm)
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
                        const ms = durationMs % 1000
                        return `${minutes}m ${seconds}s ${ms}ms`
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="ds-label">Total Messages</p>
                    <p className="ds-value">{messages.length}</p>
                  </div>
                  <div>
                    <p className="ds-label">Request Messages</p>
                    <p className="ds-value">{messages.filter(m => m.isRequest).length}</p>
                  </div>
                  <div>
                    <p className="ds-label">Response Messages</p>
                    <p className="ds-value">{messages.filter(m => !m.isRequest).length}</p>
                  </div>
                  <div>
                    <p className="ds-label">Negative Responses</p>
                    <p className="ds-value">
                      {messages.filter(m => {
                        const decoded = decodeUDSMessage(m.data || '', m.isRequest, m.diagnosticProtocol, m.protocol)
                        return decoded.service === '7F'
                      }).length}
                    </p>
                  </div>
                  <div>
                    <p className="ds-label">Unique Services</p>
                    <p className="ds-value">{tabCounts.filterOptions.services.length}</p>
                  </div>
                  <div>
                    <p className="ds-label">Average Message Rate</p>
                    <p className="ds-value">
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
                        return `${(messages.length / durationSec).toFixed(1)} msg/s`
                      })()}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Protocol Distribution */}
              <Card variant="nested" style={{ marginBottom: spacing[4] }}>
                <h4 className="ds-heading-4" style={{ marginBottom: spacing[3] }}>Protocol Distribution</h4>
                <div className="ds-stack" style={{ gap: spacing[3] }}>
                  {Object.entries(
                    messages.reduce((acc: any, msg: any) => {
                      const protocol = msg.protocol || 'Unknown'
                      acc[protocol] = (acc[protocol] || 0) + 1
                      return acc
                    }, {})
                  ).map(([protocol, count]: any) => (
                    <div key={protocol} className="ds-flex-between" style={{
                      padding: spacing[3],
                      backgroundColor: colors.background.secondary,
                      borderRadius: '8px'
                    }}>
                      <span className="ds-label">{protocol}</span>
                      <div className="ds-flex-row" style={{ gap: spacing[3] }}>
                        <span className="ds-value">{count} messages</span>
                        <Badge variant="info">
                          {((count / messages.length) * 100).toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* ECU Channel Information */}
              {job.metadata?.ecuChannels && job.metadata.ecuChannels.length > 0 && (
                <Card variant="nested" style={{ marginBottom: spacing[4] }}>
                  <h4 className="ds-heading-4" style={{ marginBottom: spacing[3] }}>ECU Channel Information</h4>
                  <div className="ds-stack" style={{ gap: spacing[3] }}>
                    {job.metadata.ecuChannels.map((channel: any, idx: number) => (
                      <div key={idx} style={{
                        padding: spacing[3],
                        backgroundColor: colors.background.secondary,
                        borderRadius: '8px',
                        borderLeft: `3px solid ${colors.primary[600]}`
                      }}>
                        <div className="ds-flex-row" style={{ gap: spacing[4], marginBottom: spacing[2] }}>
                          <div>
                            <span className="ds-label" style={{ fontSize: '11px' }}>CHANNEL NAME</span>
                            <p className="ds-value" style={{ fontSize: '14px', fontFamily: 'monospace' }}>
                              {channel.name}
                            </p>
                          </div>
                          <div>
                            <span className="ds-label" style={{ fontSize: '11px' }}>PROTOCOL</span>
                            <p className="ds-value" style={{ fontSize: '14px' }}>
                              {channel.protocol.toUpperCase()}
                            </p>
                          </div>
                          {channel.pins && (
                            <div>
                              <span className="ds-label" style={{ fontSize: '11px' }}>PINS</span>
                              <p className="ds-value" style={{ fontSize: '14px', fontFamily: 'monospace' }}>
                                {channel.pins}
                              </p>
                            </div>
                          )}
                          {channel.addresses && (
                            <div>
                              <span className="ds-label" style={{ fontSize: '11px' }}>ECU ADDRESSES</span>
                              <p className="ds-value" style={{ fontSize: '14px', fontFamily: 'monospace' }}>
                                {channel.addresses}
                              </p>
                            </div>
                          )}
                        </div>
                        {channel.status && (
                          <div style={{ marginTop: spacing[2] }}>
                            <Badge variant={channel.status === 'since' ? 'success' : 'secondary'}>
                              {channel.status === 'since' ? 'Connected' : 'Status: ' + channel.status}
                            </Badge>
                            {channel.timestamp && (
                              <span className="ds-text-secondary" style={{ fontSize: '12px', marginLeft: spacing[2] }}>
                                at {channel.timestamp}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

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
              <h3 className="ds-heading-3">Battery Voltage Over Time</h3>
              <Card variant="nested">
                {(() => {
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
                  const voltageData = [...metadataVoltage, ...udsVoltage].sort((a, b) => {
                    // Sort by timestamp
                    const timeA = a.time.split(':').map(Number)
                    const timeB = b.time.split(':').map(Number)
                    return (timeA[0] * 3600 + timeA[1] * 60 + timeA[2]) -
                           (timeB[0] * 3600 + timeB[1] * 60 + timeB[2])
                  })

                  if (voltageData.length === 0) {
                    return (
                      <div className="ds-empty-state" style={{ padding: spacing[6] }}>
                        <Zap size={48} style={{ color: colors.text.secondary, marginBottom: spacing[3] }} />
                        <p className="ds-heading-4">No Battery Voltage Data Found</p>
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

                      <div style={{ width: '100%', height: '400px', marginTop: spacing[4] }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={voltageData}>
                            <CartesianGrid strokeDasharray="3 3" stroke={colors.border.light} />
                            <XAxis
                              dataKey="time"
                              tick={{ fontSize: 12 }}
                              angle={-45}
                              textAnchor="end"
                              height={80}
                            />
                            <YAxis
                              tick={{ fontSize: 12 }}
                              label={{ value: 'Voltage (V)', angle: -90, position: 'insideLeft' }}
                            />
                            <Tooltip />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="voltage"
                              stroke={colors.primary[600]}
                              strokeWidth={2}
                              dot={{ r: 3 }}
                              name="Battery Voltage (V)"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      <div style={{ marginTop: spacing[4] }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ backgroundColor: colors.background.secondary }}>
                              <th style={{ padding: spacing[2], textAlign: 'left', fontSize: '12px', fontWeight: 600 }}>Time</th>
                              <th style={{ padding: spacing[2], textAlign: 'left', fontSize: '12px', fontWeight: 600 }}>ECU</th>
                              <th style={{ padding: spacing[2], textAlign: 'left', fontSize: '12px', fontWeight: 600 }}>Voltage</th>
                            </tr>
                          </thead>
                          <tbody>
                            {voltageData.map((data, idx) => (
                              <tr key={idx} style={{ borderBottom: `1px solid ${colors.border.light}` }}>
                                <td style={{ padding: spacing[2], fontSize: '12px' }}>{data.time}</td>
                                <td style={{ padding: spacing[2], fontSize: '12px' }}>{data.ecu}</td>
                                <td style={{ padding: spacing[2], fontSize: '12px' }}>
                                  <Badge variant="info">{data.voltage}V</Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
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
                {ecus.map(ecu => (
                  <Card key={ecu.address} variant="hover">
                    <div className="ds-flex-between">
                      <div>
                        <div className="ds-flex-row" style={{ gap: spacing[3], marginBottom: spacing[2] }}>
                          <Badge variant="secondary" size="large">
                            {ecu.address}
                          </Badge>
                          <span className="ds-heading-4">
                            {ecuNames[ecu.address]?.name || ecu.name}
                          </span>
                        </div>
                        {ecuNames[ecu.address]?.description && (
                          <p className="ds-text-secondary">
                            {ecuNames[ecu.address].description}
                          </p>
                        )}
                      </div>
                      <div className="ds-flex-row" style={{ gap: spacing[2] }}>
                        <Badge variant="info">{ecu.messageCount} messages</Badge>
                        {ecuNames[ecu.address]?.isVerified && (
                          <Badge variant="success" icon={<CheckCircle size={14} />}>
                            Verified
                          </Badge>
                        )}
                      </div>
                    </div>

                    {ecu.services.length > 0 && (
                      <div style={{ marginTop: spacing[4] }}>
                        <p className="ds-label" style={{ marginBottom: spacing[2] }}>SERVICES USED</p>
                        <div className="ds-flex-row ds-flex-wrap" style={{ gap: spacing[2] }}>
                          {ecu.services.map(service => (
                            <Badge key={service} variant="secondary" size="small">
                              {getServiceName(service, ecu.diagnosticProtocol)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

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
                  </Card>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'flow' && (
            <div className="ds-section">
              <div className="ds-flex-between" style={{ marginBottom: spacing[4] }}>
                <h3 className="ds-heading-3">Diagnostic Communication Flow</h3>
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
              {job.DTC && job.DTC.length > 0 ? (
                <div className="ds-stack" style={{ gap: spacing[5] }}>
                  {Object.entries(
                    job.DTC.reduce((acc: any, dtc: any) => {
                      if (!acc[dtc.ecuName]) acc[dtc.ecuName] = []
                      acc[dtc.ecuName].push(dtc)
                      return acc
                    }, {})
                  ).map(([ecuName, dtcs]: any) => (
                    <div key={ecuName}>
                      <h4 className="ds-heading-4" style={{
                        marginBottom: spacing[3],
                        padding: spacing[2] + ' ' + spacing[3],
                        backgroundColor: colors.background.secondary,
                        borderRadius: '6px'
                      }}>
                        {ecuName}
                      </h4>
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
                                    {/* Bit 0: Test Failed */}
                                    <td style={{ padding: spacing[3], textAlign: 'center' }}>
                                      <div style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '4px',
                                        backgroundColor: testFailed ? colors.error[500] : colors.gray[200],
                                        margin: '0 auto',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}>
                                        {testFailed && (
                                          <CheckCircle size={14} color="white" />
                                        )}
                                      </div>
                                    </td>
                                    {/* Bit 1: Test Failed This Operation Cycle */}
                                    <td style={{ padding: spacing[3], textAlign: 'center' }}>
                                      <div style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '4px',
                                        backgroundColor: testFailedThisCycle ? colors.warning[500] : colors.gray[200],
                                        margin: '0 auto',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}>
                                        {testFailedThisCycle && (
                                          <CheckCircle size={14} color="white" />
                                        )}
                                      </div>
                                    </td>
                                    {/* Bit 2: Pending DTC */}
                                    <td style={{ padding: spacing[3], textAlign: 'center' }}>
                                      <div style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '4px',
                                        backgroundColor: pending ? colors.info[500] : colors.gray[200],
                                        margin: '0 auto',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}>
                                        {pending && (
                                          <CheckCircle size={14} color="white" />
                                        )}
                                      </div>
                                    </td>
                                    {/* Bit 3: Confirmed DTC */}
                                    <td style={{ padding: spacing[3], textAlign: 'center' }}>
                                      <div style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '4px',
                                        backgroundColor: confirmed ? colors.purple[500] : colors.gray[200],
                                        margin: '0 auto',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}>
                                        {confirmed && (
                                          <CheckCircle size={14} color="white" />
                                        )}
                                      </div>
                                    </td>
                                    {/* Bit 4: Test Not Completed Since Last Clear */}
                                    <td style={{ padding: spacing[3], textAlign: 'center' }}>
                                      <div style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '4px',
                                        backgroundColor: testNotCompletedSinceLastClear ? colors.warning[400] : colors.gray[200],
                                        margin: '0 auto',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}>
                                        {testNotCompletedSinceLastClear && (
                                          <CheckCircle size={14} color="white" />
                                        )}
                                      </div>
                                    </td>
                                    {/* Bit 5: Test Failed Since Last Clear */}
                                    <td style={{ padding: spacing[3], textAlign: 'center' }}>
                                      <div style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '4px',
                                        backgroundColor: testFailedSinceLastClear ? colors.error[400] : colors.gray[200],
                                        margin: '0 auto',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}>
                                        {testFailedSinceLastClear && (
                                          <CheckCircle size={14} color="white" />
                                        )}
                                      </div>
                                    </td>
                                    {/* Bit 6: Test Not Completed This Operation Cycle */}
                                    <td style={{ padding: spacing[3], textAlign: 'center' }}>
                                      <div style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '4px',
                                        backgroundColor: testNotCompletedThisCycle ? colors.warning[300] : colors.gray[200],
                                        margin: '0 auto',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}>
                                        {testNotCompletedThisCycle && (
                                          <CheckCircle size={14} color="white" />
                                        )}
                                      </div>
                                    </td>
                                    {/* Bit 7: Warning Indicator Requested */}
                                    <td style={{ padding: spacing[3], textAlign: 'center' }}>
                                      <div style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '4px',
                                        backgroundColor: warningLight ? colors.error[600] : colors.gray[200],
                                        margin: '0 auto',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}>
                                        {warningLight && (
                                          <AlertCircle size={14} color="white" />
                                        )}
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
                  <div className="ds-empty-state">No DTCs found</div>
                </Card>
              )}
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
              <h3 className="ds-heading-3">EOBD / OBD-II Data Analysis</h3>
              {(() => {
                // Filter messages for OBD-II services (01-0A, 41-4A)
                const obdMessages = messages.filter((msg: any) => {
                  if (!msg.data || msg.data.length < 2) return false
                  const decoded = decodeUDSMessage(msg.data, msg.isRequest, msg.diagnosticProtocol, msg.protocol)
                  const service = parseInt(decoded.service, 16)
                  return (service >= 0x01 && service <= 0x0A) || (service >= 0x41 && service <= 0x4A)
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

                      return (
                        <Card key={ecuAddr} variant="nested">
                          <div style={{ marginBottom: spacing[4] }}>
                            <div className="ds-flex-row" style={{ gap: spacing[3], alignItems: 'center' }}>
                              <Badge variant="primary" size="large">
                                {ecuAddr}
                              </Badge>
                              <h4 className="ds-heading-4">{ecuName}</h4>
                              <Badge variant="secondary" size="small">
                                {ecuMessages.length} OBD messages
                              </Badge>
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
        </Card>
      </div>
    </PageLayout>
  )
}
