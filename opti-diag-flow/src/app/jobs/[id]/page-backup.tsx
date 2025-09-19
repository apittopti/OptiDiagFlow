"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { PageLayout } from '@/components/layout/page-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Activity,
  Car,
  Clock,
  Database,
  Download,
  FileText,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Cpu,
  Hash,
  Settings,
  Terminal,
  Zap,
  RefreshCw
} from 'lucide-react'
import { formatBytes, formatDuration } from '@/lib/utils'

interface JobDetail {
  id: string
  name: string
  status: string
  vehicleId: string
  messageCount: number
  ecuCount: number
  didCount: number
  dtcCount: number
  routineCount: number
  duration: number
  createdAt: string
  Vehicle?: any
  ECUConfiguration?: any[]
  DataIdentifier?: any[]
  DTC?: any[]
  Routine?: any[]
  _count?: {
    ECUConfiguration: number
    DataIdentifier: number
    DTC: number
    Routine: number
    Tag: number
  }
  metadata?: any
}

interface ECUSummary {
  address: string
  name: string
  messageCount: number
  services: string[]
  dtcs: string[]
  dids: string[]
  routines: string[]
}

export default function JobDetailPage() {
  const params = useParams()
  const [job, setJob] = useState<JobDetail | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [ecus, setEcus] = useState<ECUSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEcu, setSelectedEcu] = useState<string | null>(null)
  const [ecuNames, setEcuNames] = useState<Record<string, any>>({})
  const [fetchingNames, setFetchingNames] = useState(false)

  useEffect(() => {
    if (params.id) {
      fetchJobDetails(params.id as string)
    }
  }, [params.id])

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

  const fetchJobDetails = async (jobId: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`)
      if (response.ok) {
        const data = await response.json()
        setJob(data)

        // Process ECUs from stored data
        if (data.ECUConfiguration && data.ECUConfiguration.length > 0) {
          const ecuSummaries = data.ECUConfiguration.map((ecu: any) => ({
            address: ecu.targetAddress,
            name: ecu.ecuName || `ECU_${ecu.targetAddress}`,
            messageCount: ecu.metadata?.messageCount || 0,
            services: ecu.metadata?.sessionTypes ? Array.from(ecu.metadata.sessionTypes) : [],
            dtcs: ecu.DTC?.map((d: any) => d.code) || [],
            dids: ecu.DataIdentifier?.map((d: any) => d.identifier) || [],
            routines: ecu.Routine?.map((r: any) => r.identifier) || []
          }))
          setEcus(ecuSummaries)

          // Fetch ECU names from knowledge repository
          const addresses = ecuSummaries.map((ecu: any) => ecu.address)
          fetchEcuNames(addresses, data.Vehicle)
        }

        // Process messages from metadata if available
        if (data.metadata && data.metadata.procedures) {
          const allMessages = data.metadata.procedures.flatMap((proc: any) =>
            proc.messages?.map((msg: any) => ({
              ...msg,
              timestamp: msg.timestamp || proc.startTime || new Date().toISOString(),
              isRequest: msg.direction === 'Local->Remote',
              serviceCode: msg.data?.substring(0, 2)
            })) || []
          )
          setMessages(allMessages)
        }
      }
    } catch (error) {
      console.error('Error fetching job details:', error)
    } finally {
      setLoading(false)
    }
  }

  const reparseJob = async () => {
    if (!job) return

    try {
      setLoading(true)
      const response = await fetch(`/api/jobs/${job.id}/reparse`, {
        method: 'POST'
      })

      if (response.ok) {
        const result = await response.json()
        // Reload the job details to show updated data
        await fetchJobDetails(job.id)
        alert(result.message || 'Job reparsed successfully')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to reparse job')
      }
    } catch (error) {
      console.error('Error reparsing job:', error)
      alert('Failed to reparse job')
    } finally {
      setLoading(false)
    }
  }

  const processECUs = (messages: any[]) => {
    const ecuMap = new Map<string, ECUSummary>()

    messages.forEach(msg => {
      const ecuAddr = msg.isRequest ? msg.targetAddr : msg.sourceAddr
      if (!ecuMap.has(ecuAddr)) {
        ecuMap.set(ecuAddr, {
          address: ecuAddr,
          name: `ECU_${ecuAddr}`,
          messageCount: 0,
          services: [],
          dtcs: [],
          dids: [],
          routines: []
        })
      }

      const ecu = ecuMap.get(ecuAddr)!
      ecu.messageCount++

      // Track services
      if (msg.serviceCode && !ecu.services.includes(msg.serviceCode)) {
        ecu.services.push(msg.serviceCode)
      }

      // Parse service-specific data
      if (msg.data) {
        const data = msg.data.toUpperCase()
        if (data.startsWith('22') && data.length >= 6) {
          const did = data.substring(2, 6)
          if (!ecu.dids.includes(did)) {
            ecu.dids.push(did)
          }
        } else if (data.startsWith('31') && data.length >= 8) {
          const routine = data.substring(4, 8)
          if (!ecu.routines.includes(routine)) {
            ecu.routines.push(routine)
          }
        }
      }
    })

    setEcus(Array.from(ecuMap.values()))
  }

  const getServiceName = (code: string) => {
    const services: Record<string, string> = {
      '10': 'Session Control',
      '11': 'ECU Reset',
      '14': 'Clear DTCs',
      '19': 'Read DTCs',
      '22': 'Read Data',
      '27': 'Security Access',
      '2E': 'Write Data',
      '2F': 'Input/Output Control',
      '31': 'Routine Control',
      '3E': 'Tester Present',
      '85': 'Control DTC Setting',
      '28': 'Communication Control',
      '29': 'Authentication (Certificate)',
      '3D': 'Write Memory By Address',
      '23': 'Read Memory By Address',
      '24': 'Read Scaling Data',
      '2A': 'Read Data By Periodic ID',
      '2C': 'Dynamically Define Data ID',
      '34': 'Request Download',
      '35': 'Request Upload',
      '36': 'Transfer Data',
      '37': 'Request Transfer Exit',
      '38': 'Request File Transfer',
      // Positive Response IDs
      '50': 'Session Control Response',
      '51': 'ECU Reset Response',
      '54': 'Clear DTCs Response',
      '59': 'Read DTCs Response',
      '62': 'Read Data Response',
      '67': 'Security Access Response',
      '6E': 'Write Data Response',
      '6F': 'Input/Output Control Response',
      '71': 'Routine Control Response',
      '7E': 'Tester Present Response',
      'C5': 'Control DTC Setting Response',
      '68': 'Communication Control Response',
      '69': 'Authentication (Certificate) Response',
      '7D': 'Write Memory Response',
      '63': 'Read Memory Response',
      '64': 'Read Scaling Data Response',
      '6A': 'Read Data By Periodic Response',
      '6C': 'Dynamically Define Data Response',
      '74': 'Request Download Response',
      '75': 'Request Upload Response',
      '76': 'Transfer Data Response',
      '77': 'Transfer Exit Response',
      '78': 'Request File Transfer Response',
      '7F': 'Negative Response'
    }
    return services[code] || `Service 0x${code}`
  }

  const getNegativeResponseCode = (nrc: string) => {
    const codes: Record<string, string> = {
      '10': 'General reject',
      '11': 'Service not supported',
      '12': 'Sub-function not supported',
      '13': 'Incorrect message length or invalid format',
      '14': 'Response too long',
      '21': 'Busy - repeat request',
      '22': 'Conditions not correct',
      '24': 'Request sequence error',
      '25': 'No response from sub-net component',
      '26': 'Failure prevents execution of requested action',
      '31': 'Request out of range',
      '33': 'Security access denied',
      '35': 'Invalid key',
      '36': 'Exceeded number of attempts',
      '37': 'Required time delay not expired',
      '70': 'Upload/download not accepted',
      '71': 'Transfer data suspended',
      '72': 'General programming failure',
      '73': 'Wrong block sequence counter',
      '78': 'Request correctly received - response pending',
      '7E': 'Sub-function not supported in active session',
      '7F': 'Service not supported in active session',
      '81': 'RPM too high',
      '82': 'RPM too low',
      '83': 'Engine is running',
      '84': 'Engine is not running',
      '85': 'Engine run time too low',
      '86': 'Temperature too high',
      '87': 'Temperature too low',
      '88': 'Vehicle speed too high',
      '89': 'Vehicle speed too low',
      '8A': 'Throttle/pedal too high',
      '8B': 'Throttle/pedal too low',
      '8C': 'Transmission not in neutral',
      '8D': 'Transmission not in gear',
      '8F': 'Brake not applied',
      '90': 'Gear shift lever not in park',
      '92': 'Voltage too high',
      '93': 'Voltage too low'
    }
    return codes[nrc] || `Unknown NRC 0x${nrc}`
  }

  const decodeUDSMessage = (data: string, isRequest: boolean) => {
    if (!data || data.length < 2) return { service: '', dataBytes: '', description: 'Invalid data' }

    const serviceId = data.substring(0, 2).toUpperCase()
    const dataBytes = data.length > 2 ? data.substring(2) : ''

    let description = ''

    // Handle negative response
    if (serviceId === '7F' && dataBytes.length >= 4) {
      const rejectedService = dataBytes.substring(0, 2)
      const nrc = dataBytes.substring(2, 4)
      const serviceName = getServiceName(rejectedService)
      const nrcDescription = getNegativeResponseCode(nrc)
      description = `Negative Response to ${serviceName}: ${nrcDescription}`
      return {
        service: serviceId,
        dataBytes: `${rejectedService} ${nrc}`,
        description
      }
    }

    // Handle specific services
    switch (serviceId) {
      case '10': // Session Control Request
        if (dataBytes.length >= 2) {
          const sessionType = dataBytes.substring(0, 2)
          const sessions: Record<string, string> = {
            '01': 'Default Session',
            '02': 'Programming Session',
            '03': 'Extended Diagnostic Session',
            '04': 'Safety System Diagnostic Session',
            '40': 'EOL Session',
            '60': 'Development Session'
          }
          description = `Request ${sessions[sessionType] || `Session 0x${sessionType}`}`
        }
        break

      case '50': // Session Control Response
        if (dataBytes.length >= 2) {
          const sessionType = dataBytes.substring(0, 2)
          const sessions: Record<string, string> = {
            '01': 'Default Session',
            '02': 'Programming Session',
            '03': 'Extended Diagnostic Session',
            '04': 'Safety System Diagnostic Session',
            '40': 'EOL Session',
            '60': 'Development Session'
          }
          const p2 = dataBytes.length >= 6 ? dataBytes.substring(2, 6) : ''
          const p2star = dataBytes.length >= 10 ? dataBytes.substring(6, 10) : ''
          description = `${sessions[sessionType] || `Session 0x${sessionType}`} Active`
          if (p2) description += ` (P2: ${parseInt(p2, 16)}ms, P2*: ${parseInt(p2star, 16) * 10}ms)`
        }
        break

      case '11': // ECU Reset Request
        if (dataBytes.length >= 2) {
          const resetType = dataBytes.substring(0, 2)
          const resets: Record<string, string> = {
            '01': 'Hard Reset',
            '02': 'Key Off/On Reset',
            '03': 'Soft Reset',
            '04': 'Enable Rapid Power Shutdown',
            '05': 'Disable Rapid Power Shutdown'
          }
          description = resets[resetType] || `Reset Type 0x${resetType}`
        }
        break

      case '22': // Read Data By ID Request
        if (dataBytes.length >= 4) {
          const did = dataBytes.substring(0, 4)
          description = `Read DID 0x${did}`
          // Add common DID descriptions
          const commonDIDs: Record<string, string> = {
            'F190': 'VIN',
            'F187': 'Spare Part Number',
            'F18C': 'ECU Serial Number',
            'F191': 'Vehicle Manufacturer ECU Hardware Number',
            'F194': 'Vehicle Manufacturer ECU Software Number',
            'F195': 'System Supplier Specific',
            'F197': 'System Name or Engine Type',
            'F198': 'Repair Shop Code',
            'F199': 'Programming Date',
            'DD00': 'Odometer',
            'DD01': 'Battery Voltage'
          }
          if (commonDIDs[did]) description += ` (${commonDIDs[did]})`
        }
        break

      case '62': // Read Data By ID Response
        if (dataBytes.length >= 4) {
          const did = dataBytes.substring(0, 4)
          const value = dataBytes.substring(4)
          // Try to decode as ASCII if it looks like text
          let asciiValue = ''
          if (value.length > 0) {
            try {
              const ascii = value.match(/.{2}/g)?.map(hex => {
                const char = String.fromCharCode(parseInt(hex, 16))
                return char.match(/[\x20-\x7E]/) ? char : '.'
              }).join('') || ''
              if (ascii && ascii.replace(/\./g, '').length > ascii.length * 0.5) {
                asciiValue = ascii.trim()
              }
            } catch {}
          }

          // ISO 14229-1 Standard DIDs (0xF100-0xF1FF and 0xF300-0xF3FF)
          const standardDIDs: Record<string, string> = {
            'F186': 'Active Diagnostic Session Data Identifier',
            'F187': 'Vehicle Manufacturer Spare Part Number',
            'F188': 'Vehicle Manufacturer ECU Software Number',
            'F189': 'Vehicle Manufacturer ECU Software Version Number',
            'F18A': 'System Supplier Specific',
            'F18B': 'ECU Manufacturing Date and Time',
            'F18C': 'ECU Serial Number',
            'F18E': 'IUMPR (In-Use Monitor Performance Ratio)',
            'F190': 'VIN (Vehicle Identification Number)',
            'F191': 'Vehicle Manufacturer ECU Hardware Number',
            'F192': 'System Supplier ECU Hardware Number',
            'F193': 'System Supplier ECU Hardware Version Number',
            'F194': 'System Supplier ECU Software Number',
            'F195': 'System Supplier ECU Software Version Number',
            'F197': 'System Name or Engine Type',
            'F198': 'Repair Shop Code or Tester Serial Number',
            'F199': 'Programming Date',
            'F19D': 'Calibration Repair Shop Code or Calibration Equipment Serial Number',
            'F19E': 'Calibration Date',
            'F1A0': 'Vehicle Manufacturer Specific',
            'F1F0': 'Vehicle Speed'
          }

          // Manufacturer-specific ranges (examples - should be loaded based on OEM)
          // 0x0000-0xEFFF: Vehicle manufacturer specific
          // 0xF000-0xF0FF: Network configuration
          // 0xF200-0xF2FF: ODX-File specific
          // 0xF400-0xF4FF: Vehicle manufacturer specific
          // 0xDD00-0xDDFF: Often used by JLR, VAG, etc. but meanings vary

          let didDescription = ''

          // Check if it's a standard DID first
          if (standardDIDs[did]) {
            didDescription = standardDIDs[did]
          } else if (did >= 'F100' && did <= 'F1FF') {
            didDescription = 'ISO Standard DID'
          } else if (did >= 'F200' && did <= 'F2FF') {
            didDescription = 'ODX File Specific'
          } else if (did >= 'F000' && did <= 'F0FF') {
            didDescription = 'Network Configuration'
          } else if (did >= 'F400' && did <= 'F4FF') {
            didDescription = 'Vehicle Manufacturer Specific'
          } else if (did >= 'DD00' && did <= 'DDFF') {
            didDescription = 'Manufacturer Specific Range'
          } else if (did < 'F000') {
            didDescription = 'Vehicle Manufacturer Specific'
          }

          if (asciiValue) {
            description = `DID 0x${did} ("${asciiValue}")`
            if (didDescription) {
              description = `DID 0x${did} - ${didDescription} ("${asciiValue}")`
            }
          } else {
            description = `DID 0x${did}`
            if (didDescription) {
              description = `DID 0x${did} - ${didDescription}`
            }
          }
        }
        break

      case '19': // Read DTC Request
        if (dataBytes.length >= 2) {
          const subFunction = dataBytes.substring(0, 2)
          const dtcStatusMask = dataBytes.length >= 4 ? dataBytes.substring(2, 4) : ''
          const subfunctions: Record<string, string> = {
            '01': 'Report number of DTCs by status mask',
            '02': 'Report DTCs by status mask',
            '03': 'Report DTC snapshot identification',
            '04': 'Report DTC snapshot by DTC number',
            '06': 'Report DTC extended data by DTC number',
            '0A': 'Report supported DTCs',
            '0B': 'Report first test failed DTC',
            '0C': 'Report first confirmed DTC',
            '0E': 'Report most recent test failed DTC',
            '14': 'Report DTCs by fault detection counter',
            '42': 'Report WWHOBD DTCs by mask record',
            '55': 'Report WWHOBD DTCs by mask permanent status',
            '56': 'Report DTCs by severity mask',
            '85': 'Report DTCs controlled',
            'AF': 'Report mirror memory DTCs'
          }
          description = subfunctions[subFunction] || `Read DTC sub-function 0x${subFunction}`
          if (dtcStatusMask) description += ` (mask: 0x${dtcStatusMask})`
        }
        break

      case '31': // Routine Control Request
        if (dataBytes.length >= 6) {
          const controlType = dataBytes.substring(0, 2)
          const routineId = dataBytes.substring(2, 6)
          const controls: Record<string, string> = {
            '01': 'Start',
            '02': 'Stop',
            '03': 'Request Results'
          }
          description = `${controls[controlType] || `Control 0x${controlType}`} Routine 0x${routineId}`
        }
        break

      case '27': // Security Access Request
        if (dataBytes.length >= 2) {
          const level = dataBytes.substring(0, 2)
          const levelNum = parseInt(level, 16)
          if (levelNum % 2 === 1) {
            description = `Request Seed - Level ${(levelNum + 1) / 2}`
          } else {
            description = `Send Key - Level ${levelNum / 2}`
            if (dataBytes.length > 2) {
              description += ` (Key: ${dataBytes.substring(2)})`
            }
          }
        }
        break

      case '3E': // Tester Present
        if (dataBytes.length >= 2) {
          const subFunction = dataBytes.substring(0, 2)
          description = subFunction === '80' ? 'Tester Present (suppress response)' : 'Tester Present'
        }
        break

      case '14': // Clear DTCs
        if (dataBytes.length >= 6) {
          const groupOfDTC = dataBytes.substring(0, 6)
          if (groupOfDTC === 'FFFFFF') {
            description = 'Clear All DTCs'
          } else {
            description = `Clear DTC Group 0x${groupOfDTC}`
          }
        }
        break

      default:
        const serviceName = getServiceName(serviceId)
        if (serviceName.includes('Response')) {
          description = serviceName
          if (dataBytes) description += ` (Data: ${dataBytes})`
        } else {
          description = serviceName
        }
    }

    return { service: serviceId, dataBytes, description }
  }

  const formatMessage = (msg: any) => {
    const isNegativeResponse = msg.data?.startsWith('7F')
    const decoded = decodeUDSMessage(msg.data || '', msg.isRequest)

    // Parse timestamp in HH:MM:SS.mmm format or use ISO date
    let displayTime = 'N/A'
    if (msg.timestamp) {
      if (msg.timestamp.includes(':')) {
        // Already in HH:MM:SS.mmm format from trace file
        displayTime = msg.timestamp
      } else {
        // ISO date format, convert to time
        try {
          displayTime = new Date(msg.timestamp).toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })
        } catch {
          displayTime = msg.timestamp
        }
      }
    }

    return {
      ...msg,
      displayService: getServiceName(msg.serviceCode || msg.data?.substring(0, 2)),
      isNegativeResponse,
      direction: msg.isRequest ? 'request' : 'response',
      displayTime,
      decoded
    }
  }

  if (loading) {
    return (
      <PageLayout title={job?.name || "Job Details"} description={`Job ID: ${job?.id || ''}`}>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
        </div>
      </PageLayout>
    )
  }

  if (!job) {
    return (
      <PageLayout title={job?.name || "Job Details"} description={`Job ID: ${job?.id || ''}`}>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold">Job not found</h2>
        </div>
      </PageLayout>
    )
  }

  const filteredMessages = selectedEcu
    ? messages.filter(m => m.sourceAddr === selectedEcu || m.targetAddr === selectedEcu)
    : messages

  return (
    <PageLayout title={job?.name || "Job Details"} description={`Job ID: ${job?.id || ''}`}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '32px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '32px'
        }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 8px 0' }}>
              {job.name}
            </h2>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
              Job ID: {job.id} • Status: {job.status}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={reparseJob}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 20px',
                backgroundColor: '#10b981',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={16} />
              Reparse
            </button>
            <button
              onClick={() => window.open(`/api/odx/${job.id}/download`, '_blank')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 20px',
                backgroundColor: '#ffffff',
                color: '#374151',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              <Download size={16} />
              Export ODX
            </button>
            <button
              onClick={() => window.location.href = `/odx-editor/${job.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 20px',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              <Database size={16} />
              Edit ODX
            </button>
          </div>
        </div>

        {/* Overview Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '32px'
        }}>
          <div style={{
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            padding: '20px',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Total Messages</p>
                <p style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>{job.messageCount || 0}</p>
              </div>
              <Activity size={24} style={{ color: '#3b82f6' }} />
            </div>
          </div>

          <div style={{
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            padding: '20px',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>ECUs Found</p>
                <p style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>{job?._count?.ECUConfiguration || ecus.length}</p>
              </div>
              <Cpu size={24} style={{ color: '#10b981' }} />
            </div>
          </div>

          <div style={{
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            padding: '20px',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Duration</p>
                <p style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>
                  {job.duration ? formatDuration(job.duration) : 'N/A'}
                </p>
              </div>
              <Clock size={24} style={{ color: '#f97316' }} />
            </div>
          </div>

          <div style={{
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            padding: '20px',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>ODX Patterns</p>
                <p style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>
                  {job?._count?.DataIdentifier || 0}
                </p>
              </div>
              <Database size={24} style={{ color: '#8b5cf6' }} />
            </div>
          </div>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="timeline" style={{ marginTop: '32px' }}>
          <TabsList style={{
            display: 'flex',
            gap: '8px',
            borderBottom: '2px solid #e5e7eb',
            marginBottom: '24px'
          }}>
            <TabsTrigger value="timeline">Communication Timeline</TabsTrigger>
            <TabsTrigger value="ecus">ECU Discovery ({job?._count?.ECUConfiguration || ecus.length})</TabsTrigger>
            <TabsTrigger value="dtcs">DTCs</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="odx">ODX Patterns</TabsTrigger>
          </TabsList>

          {/* Timeline Tab */}
          <TabsContent value="timeline">
            <div style={{
              backgroundColor: '#fafafa',
              borderRadius: '8px',
              padding: '24px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px'
              }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>UDS Communication Flow</h3>
                <select
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '14px',
                    backgroundColor: '#ffffff'
                  }}
                  value={selectedEcu || ''}
                  onChange={(e) => setSelectedEcu(e.target.value || null)}
                >
                  <option value="">All ECUs</option>
                  {ecus.map(ecu => (
                    <option key={ecu.address} value={ecu.address}>
                      {ecu.name} ({ecu.address})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{
                maxHeight: '700px',
                overflowY: 'auto',
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '13px'
                }}>
                  <thead style={{
                    backgroundColor: '#f9fafb',
                    borderBottom: '2px solid #e5e7eb',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10
                  }}>
                    <tr>
                      <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Time</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Source</th>
                      <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>→</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Target</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Service</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Description</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Raw Message</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMessages.slice(0, 200).map((msg, idx) => {
                      const formatted = formatMessage(msg)
                      return (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: '1px solid #f3f4f6',
                            backgroundColor: formatted.isRequest
                              ? '#eff6ff'
                              : formatted.isNegativeResponse
                              ? '#fef2f2'
                              : '#f0fdf4'
                          }}
                        >
                          <td style={{
                            padding: '10px 12px',
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            color: '#6b7280'
                          }}>
                            {formatted.displayTime}
                          </td>
                          <td style={{
                            padding: '10px 12px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                fontFamily: 'monospace',
                                fontSize: '13px',
                                backgroundColor: '#ffffff',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                border: '1px solid #e5e7eb'
                              }}>
                                {formatted.sourceAddr}
                              </span>
                              {ecuNames[formatted.sourceAddr] && (
                                <span style={{
                                  fontSize: '11px',
                                  backgroundColor: '#3b82f6',
                                  color: '#ffffff',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontWeight: '600'
                                }}>
                                  {ecuNames[formatted.sourceAddr].name}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{
                            padding: '10px 4px',
                            textAlign: 'center',
                            color: '#9ca3af'
                          }}>
                            <ArrowRight size={16} />
                          </td>
                          <td style={{
                            padding: '10px 12px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                fontFamily: 'monospace',
                                fontSize: '13px',
                                backgroundColor: '#ffffff',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                border: '1px solid #e5e7eb'
                              }}>
                                {formatted.targetAddr}
                              </span>
                              {ecuNames[formatted.targetAddr] && (
                                <span style={{
                                  fontSize: '11px',
                                  backgroundColor: '#10b981',
                                  color: '#ffffff',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontWeight: '600'
                                }}>
                                  {ecuNames[formatted.targetAddr].name}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{
                            padding: '10px 12px',
                            fontSize: '12px',
                            fontWeight: '500',
                            color: formatted.isNegativeResponse ? '#dc2626' : '#111827'
                          }}>
                            {formatted.displayService}
                          </td>
                          <td style={{
                            padding: '10px 12px',
                            fontSize: '12px',
                            color: '#374151',
                            maxWidth: '300px'
                          }}>
                            {formatted.decoded?.description || '-'}
                          </td>
                          <td style={{
                            padding: '10px 12px',
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            color: '#6b7280',
                            maxWidth: '200px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            letterSpacing: '0.5px'
                          }}>
                            {formatted.data}
                          </td>
                          <td style={{
                            padding: '10px 12px',
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            fontWeight: '500',
                            color: '#374151',
                            maxWidth: '150px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            letterSpacing: '0.5px'
                          }}>
                            {formatted.decoded?.dataBytes || '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {messages.length > 200 && (
                  <div style={{
                    padding: '16px',
                    textAlign: 'center',
                    fontSize: '14px',
                    color: '#6b7280',
                    backgroundColor: '#f9fafb',
                    borderTop: '1px solid #e5e7eb'
                  }}>
                    Showing first 200 of {messages.length} messages
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ECUs Tab */}
          <TabsContent value="ecus">
            <div style={{ display: 'grid', gap: '16px' }}>
              {ecus.map(ecu => (
                <div key={ecu.address} style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    padding: '20px',
                    borderBottom: '1px solid #e5e7eb',
                    backgroundColor: '#fafafa'
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Cpu size={20} style={{ color: '#3b82f6' }} />
                        <h4 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>
                          {ecu.name}
                        </h4>
                        <span style={{ fontSize: '14px', color: '#6b7280' }}>
                          Address: {ecu.address}
                        </span>
                      </div>
                      <span style={{ fontSize: '14px', color: '#6b7280' }}>
                        {ecu.messageCount} messages
                      </span>
                    </div>
                  </div>
                  <div style={{
                    padding: '20px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '20px'
                  }}>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: '500', color: '#6b7280', marginBottom: '8px' }}>Services</p>
                      <p style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>{ecu.services.length}</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {ecu.services.slice(0, 5).map(s => (
                          <span key={s} style={{
                            fontSize: '11px',
                            backgroundColor: '#f3f4f6',
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}>
                            0x{s}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: '500', color: '#6b7280', marginBottom: '8px' }}>DIDs</p>
                      <p style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>{ecu.dids.length}</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {ecu.dids.slice(0, 5).map(d => (
                          <span key={d} style={{
                            fontSize: '11px',
                            backgroundColor: '#dbeafe',
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}>
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: '500', color: '#6b7280', marginBottom: '8px' }}>Routines</p>
                      <p style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>{ecu.routines.length}</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {ecu.routines.slice(0, 5).map(r => (
                          <span key={r} style={{
                            fontSize: '11px',
                            backgroundColor: '#d1fae5',
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}>
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: '500', color: '#6b7280', marginBottom: '8px' }}>DTCs</p>
                      <p style={{ fontSize: '24px', fontWeight: '700' }}>{ecu.dtcs.length}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* DTCs Tab */}
          <TabsContent value="dtcs">
            <div style={{
              backgroundColor: '#fafafa',
              borderRadius: '8px',
              padding: '24px',
              border: '1px solid #e5e7eb'
            }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Diagnostic Trouble Codes</h3>
              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>DTCs discovered in the trace log</p>
              {job?.DTC && job.DTC.length > 0 ? (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {job.DTC.map((dtc: any) => (
                    <div key={`${dtc.ecuName}-${dtc.code}`} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '16px',
                      backgroundColor: '#ffffff',
                      borderRadius: '6px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                          padding: '8px 12px',
                          backgroundColor: dtc.status === 'ACTIVE' ? '#fef2f2' : '#f3f4f6',
                          color: dtc.status === 'ACTIVE' ? '#dc2626' : '#6b7280',
                          borderRadius: '4px',
                          fontFamily: 'monospace',
                          fontSize: '14px',
                          fontWeight: '600'
                        }}>
                          {dtc.code}
                        </div>
                        <div>
                          <p style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                            {dtc.description || 'No description available'}
                          </p>
                          <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                            ECU: {dtc.ecuName} • Status: {dtc.status || 'Unknown'}
                            {dtc.statusByte && ` • Status Byte: 0x${dtc.statusByte}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '48px',
                  color: '#9ca3af',
                  backgroundColor: '#ffffff',
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb'
                }}>
                  <AlertCircle size={32} style={{ color: '#9ca3af', marginBottom: '16px', display: 'inline-block' }} />
                  <p>No DTCs found in this trace</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Services Tab */}
          <TabsContent value="services">
            <div style={{
              backgroundColor: '#fafafa',
              borderRadius: '8px',
              padding: '24px',
              border: '1px solid #e5e7eb'
            }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Diagnostic Services</h3>
              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>UDS services used in this diagnostic session</p>
              <div style={{ display: 'grid', gap: '12px' }}>
                {Array.from(new Set(messages.map(m => m.serviceCode).filter(Boolean))).map(code => (
                  <div key={code} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    backgroundColor: '#ffffff',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Terminal size={20} style={{ color: '#3b82f6' }} />
                      <div>
                        <p style={{ fontSize: '15px', fontWeight: '500', margin: '0 0 4px 0' }}>{getServiceName(code)}</p>
                        <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Service ID: 0x{code}</p>
                      </div>
                    </div>
                    <span style={{ fontSize: '14px', color: '#6b7280' }}>
                      {messages.filter(m => m.serviceCode === code).length} calls
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ODX Tab */}
          <TabsContent value="odx">
            <div style={{
              backgroundColor: '#fafafa',
              borderRadius: '8px',
              padding: '24px',
              border: '1px solid #e5e7eb'
            }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>ODX Discovery Results</h3>
              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>Data identifiers and patterns discovered from the trace</p>

              {/* Show DIDs if available */}
              {job?.DataIdentifier && job.DataIdentifier.length > 0 ? (
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
                    Data Identifiers ({job._count?.DataIdentifier || job.DataIdentifier.length})
                  </h4>
                  <div style={{ display: 'grid', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                    {job.DataIdentifier.map((did: any) => (
                      <div key={`${did.ecuName}-${did.did}`} style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '12px',
                        backgroundColor: '#ffffff',
                        borderRadius: '6px',
                        border: '1px solid #e5e7eb',
                        fontSize: '13px'
                      }}>
                        <span style={{
                          fontFamily: 'monospace',
                          fontWeight: '600',
                          color: '#4b5563',
                          minWidth: '60px'
                        }}>
                          {did.did}
                        </span>
                        <span style={{ marginLeft: '12px', color: '#111827' }}>
                          {did.name || 'Unknown DID'}
                        </span>
                        <span style={{ marginLeft: 'auto', color: '#6b7280', fontSize: '12px' }}>
                          ECU: {did.ecuName}
                          {did.dataLength > 0 && ` • ${did.dataLength} bytes`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Show Routines if available */}
              {job?.Routine && job.Routine.length > 0 ? (
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
                    Routines ({job._count?.Routine || job.Routine.length})
                  </h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {job.Routine.map((routine: any) => (
                      <div key={`${routine.ecuName}-${routine.routineId}`} style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '12px',
                        backgroundColor: '#ffffff',
                        borderRadius: '6px',
                        border: '1px solid #e5e7eb',
                        fontSize: '13px'
                      }}>
                        <span style={{
                          fontFamily: 'monospace',
                          fontWeight: '600',
                          color: '#4b5563',
                          minWidth: '60px'
                        }}>
                          {routine.routineId}
                        </span>
                        <span style={{ marginLeft: '12px', color: '#111827' }}>
                          {routine.name || 'Unknown Routine'}
                        </span>
                        <span style={{ marginLeft: 'auto', color: '#6b7280', fontSize: '12px' }}>
                          ECU: {routine.ecuName} • {routine.controlType}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Show empty state if no data */}
              {(!job?.DataIdentifier || job.DataIdentifier.length === 0) &&
               (!job?.Routine || job.Routine.length === 0) && (
                <div style={{
                  textAlign: 'center',
                  padding: '48px',
                  color: '#9ca3af',
                  backgroundColor: '#ffffff',
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb'
                }}>
                  <Database size={32} style={{ color: '#9ca3af', marginBottom: '16px', display: 'inline-block' }} />
                  <p>No ODX patterns discovered yet</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  )
}