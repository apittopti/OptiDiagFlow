'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Download, RefreshCw, Edit, AlertCircle, Package, Activity, Database, HelpCircle, CheckCircle, ArrowRight, Cpu } from 'lucide-react'
import { PageLayout } from '@/components/layout/page-layout'

interface ECUSummary {
  address: string
  name: string
  messageCount: number
  services: string[]
  dtcs: string[]
  dids: string[]
  routines: string[]
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

  useEffect(() => {
    fetchJob()
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

  const fetchJob = async () => {
    try {
      const response = await fetch(`/api/jobs/${params.id}`)
      if (response.ok) {
        const data = await response.json()
        setJob(data)

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

        // Process ECUs from stored data
        if (data.ECUConfiguration && data.ECUConfiguration.length > 0) {
          const ecuSummaries = data.ECUConfiguration.map((ecu: any) => ({
            address: ecu.targetAddress,
            name: ecu.ecuName || `ECU_${ecu.targetAddress}`,
            messageCount: ecu.metadata?.messageCount || 0,
            services: ecu.metadata?.sessionTypes ? Array.from(ecu.metadata.sessionTypes) : [],
            dtcs: [],
            dids: [],
            routines: []
          }))
          setEcus(ecuSummaries)

          // Fetch ECU names from knowledge repository
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
    if (!job) return
    try {
      const response = await fetch(`/api/jobs/${job.id}/reparse`, {
        method: 'POST'
      })
      if (response.ok) {
        fetchJob()
      }
    } catch (error) {
      console.error('Error reparsing job:', error)
    }
  }

  const handleDownload = () => {
    window.open(`/api/odx/${job.id}/download`, '_blank')
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
      '29': 'Authentication',
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
      '69': 'Authentication Response',
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
      '7F': 'Service not supported in active session'
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
          description = `${sessions[sessionType] || `Session 0x${sessionType}`} Active`
        }
        break

      case '22': // Read Data By ID Request
        if (dataBytes.length >= 4) {
          const did = dataBytes.substring(0, 4)
          description = `Read DID 0x${did}`
          const commonDIDs: Record<string, string> = {
            'F190': 'VIN',
            'F187': 'Spare Part Number',
            'F18C': 'ECU Serial Number',
            'F191': 'Vehicle Manufacturer ECU Hardware Number',
            'F194': 'Vehicle Manufacturer ECU Software Number'
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

          if (asciiValue) {
            description = `DID 0x${did} ("${asciiValue}")`
          } else {
            description = `DID 0x${did}`
          }
        }
        break

      case '19': // Read DTC Request
        if (dataBytes.length >= 2) {
          const subFunction = dataBytes.substring(0, 2)
          const subfunctions: Record<string, string> = {
            '01': 'Report number of DTCs by status mask',
            '02': 'Report DTCs by status mask',
            '04': 'Report DTC snapshot by DTC number',
            '06': 'Report DTC extended data by DTC number',
            '0A': 'Report supported DTCs'
          }
          description = subfunctions[subFunction] || `Read DTC sub-function 0x${subFunction}`
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
          }
        }
        break

      case '3E': // Tester Present
        if (dataBytes.length >= 2) {
          const subFunction = dataBytes.substring(0, 2)
          description = subFunction === '80' ? 'Tester Present (suppress response)' : 'Tester Present'
        }
        break

      default:
        const serviceName = getServiceName(serviceId)
        description = serviceName
        if (dataBytes) description += ` (Data: ${dataBytes})`
    }

    return { service: serviceId, dataBytes, description }
  }

  const formatMessage = (msg: any) => {
    const isNegativeResponse = msg.data?.startsWith('7F')
    const decoded = decodeUDSMessage(msg.data || '', msg.isRequest)

    let displayTime = 'N/A'
    if (msg.timestamp) {
      if (msg.timestamp.includes(':')) {
        displayTime = msg.timestamp
      } else {
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
      displayTime,
      sourceAddr: msg.isRequest ? msg.sourceAddr || 'Tester' : msg.targetAddr || msg.sourceAddr,
      targetAddr: msg.isRequest ? msg.targetAddr || msg.sourceAddr : msg.sourceAddr || 'Tester',
      displayService: getServiceName(msg.serviceCode),
      data: msg.data || '',
      decoded,
      isRequest: msg.isRequest,
      isNegativeResponse
    }
  }

  if (loading) {
    return (
      <PageLayout title="Loading..." description="Please wait">
        <div style={{ padding: '32px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>Loading...</h1>
          <p style={{ color: '#6b7280', marginBottom: '24px' }}>Please wait</p>
          <div style={{ textAlign: 'center', padding: '48px' }}>
            <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }} />
            <p>Loading job details...</p>
          </div>
        </div>
      </PageLayout>
    )
  }

  if (!job) {
    return (
      <PageLayout title="Job Not Found" description="The requested job could not be found">
        <div style={{ padding: '32px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>Job Not Found</h1>
          <p style={{ color: '#6b7280', marginBottom: '24px' }}>The requested job could not be found</p>
          <div style={{ textAlign: 'center', padding: '48px' }}>
            <AlertCircle size={48} style={{ color: '#ef4444', marginBottom: '16px', display: 'inline-block' }} />
            <p>Job not found</p>
            <button onClick={() => router.push('/jobs')} style={{ marginTop: '16px', padding: '8px 16px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              Back to Jobs
            </button>
          </div>
        </div>
      </PageLayout>
    )
  }

  // Group DTCs by ECU
  const groupedDTCs = job?.DTC ? job.DTC.reduce((acc: any, dtc: any) => {
    if (!acc[dtc.ecuName]) acc[dtc.ecuName] = []
    acc[dtc.ecuName].push(dtc)
    return acc
  }, {}) : {}

  // Group DIDs by ECU
  const groupedDIDs = job?.DataIdentifier ? job.DataIdentifier.reduce((acc: any, did: any) => {
    if (!acc[did.ecuName]) acc[did.ecuName] = []
    acc[did.ecuName].push(did)
    return acc
  }, {}) : {}

  // Group Routines by ECU
  const groupedRoutines = job?.Routine ? job.Routine.reduce((acc: any, routine: any) => {
    if (!acc[routine.ecuName]) acc[routine.ecuName] = []
    acc[routine.ecuName].push(routine)
    return acc
  }, {}) : {}

  // Group Services by service ID showing which ECUs use them
  const servicesByID = job?.ECUConfiguration ? job.ECUConfiguration.reduce((acc: any, ecu: any) => {
    const services = ecu.metadata?.sessionTypes || []
    services.forEach((service: string) => {
      if (!acc[service]) acc[service] = []
      if (!acc[service].includes(ecu.ecuName)) {
        acc[service].push(ecu.ecuName)
      }
    })
    return acc
  }, {}) : {}

  const filteredMessages = selectedEcu
    ? messages.filter(m => m.sourceAddr === selectedEcu || m.targetAddr === selectedEcu)
    : messages

  return (
    <PageLayout title="Job Details" description={`Job ID: ${job.id}`}>
      <div style={{ padding: '32px' }}>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              onClick={() => router.push('/jobs')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '8px 12px',
                backgroundColor: 'transparent',
                color: '#374151',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              <ChevronLeft size={16} />
              Back to Jobs
            </button>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleReparse}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  backgroundColor: '#10b981',
                  color: 'white',
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
                onClick={handleDownload}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                <Download size={16} />
                Download Report
              </button>
            </div>
          </div>
        </div>

        {/* Dashboard Stats Cards - Always Visible */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            padding: '20px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Total ECUs</p>
                <p style={{ fontSize: '28px', fontWeight: '700', color: '#111827' }}>{ecus.length}</p>
              </div>
              <div style={{
                backgroundColor: '#dbeafe',
                borderRadius: '8px',
                padding: '10px'
              }}>
                <Cpu size={24} color="#3b82f6" />
              </div>
            </div>
          </div>

          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            padding: '20px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Active DTCs</p>
                <p style={{ fontSize: '28px', fontWeight: '700', color: '#111827' }}>{job.DTC?.length || 0}</p>
              </div>
              <div style={{
                backgroundColor: '#fee2e2',
                borderRadius: '8px',
                padding: '10px'
              }}>
                <AlertCircle size={24} color="#ef4444" />
              </div>
            </div>
          </div>

          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            padding: '20px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Data IDs Read</p>
                <p style={{ fontSize: '28px', fontWeight: '700', color: '#111827' }}>{job.DataIdentifier?.length || 0}</p>
              </div>
              <div style={{
                backgroundColor: '#d1fae5',
                borderRadius: '8px',
                padding: '10px'
              }}>
                <Database size={24} color="#10b981" />
              </div>
            </div>
          </div>

          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            padding: '20px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Routines Executed</p>
                <p style={{ fontSize: '28px', fontWeight: '700', color: '#111827' }}>{job.Routine?.length || 0}</p>
              </div>
              <div style={{
                backgroundColor: '#fef3c7',
                borderRadius: '8px',
                padding: '10px'
              }}>
                <Activity size={24} color="#f59e0b" />
              </div>
            </div>
          </div>
        </div>

        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '32px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          {/* Tabs with Knowledge Page Styling */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px'
          }}>
            <div style={{
              display: 'flex',
              gap: '8px',
              backgroundColor: '#e5e7eb',
              borderRadius: '8px',
              padding: '4px'
            }}>
            <button
              onClick={() => setActiveTab('overview')}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTab === 'overview' ? '#3b82f6' : 'transparent',
                color: activeTab === 'overview' ? '#ffffff' : '#6b7280',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('ecus')}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTab === 'ecus' ? '#3b82f6' : 'transparent',
                color: activeTab === 'ecus' ? '#ffffff' : '#6b7280',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              ECUs ({ecus.length})
            </button>
            <button
              onClick={() => setActiveTab('flow')}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTab === 'flow' ? '#3b82f6' : 'transparent',
                color: activeTab === 'flow' ? '#ffffff' : '#6b7280',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              UDS Flow
            </button>
            <button
              onClick={() => setActiveTab('dtcs')}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTab === 'dtcs' ? '#3b82f6' : 'transparent',
                color: activeTab === 'dtcs' ? '#ffffff' : '#6b7280',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              DTCs ({job.DTC?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('dids')}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTab === 'dids' ? '#3b82f6' : 'transparent',
                color: activeTab === 'dids' ? '#ffffff' : '#6b7280',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              DIDs ({job.DataIdentifier?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('routines')}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTab === 'routines' ? '#3b82f6' : 'transparent',
                color: activeTab === 'routines' ? '#ffffff' : '#6b7280',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Routines ({job.Routine?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('services')}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTab === 'services' ? '#3b82f6' : 'transparent',
                color: activeTab === 'services' ? '#ffffff' : '#6b7280',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Services
            </button>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Session Information</h3>
              <div style={{
                backgroundColor: '#f9fafb',
                padding: '20px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                  <div>
                    <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Session ID</p>
                    <p style={{ fontSize: '16px', fontWeight: '600', color: '#111827' }}>{job.diagSessionId || 'N/A'}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Vehicle VIN</p>
                    <p style={{ fontSize: '16px', fontWeight: '600', color: '#111827' }}>{job.Vehicle?.vin || 'Unknown'}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Procedure Type</p>
                    <p style={{ fontSize: '16px', fontWeight: '600', color: '#111827' }}>{job.procedureType || 'Unknown'}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Status</p>
                    <p style={{ fontSize: '16px', fontWeight: '600', color: '#111827' }}>{job.status || 'Unknown'}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Created</p>
                    <p style={{ fontSize: '16px', fontWeight: '600', color: '#111827' }}>{new Date(job.createdAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Duration</p>
                    <p style={{ fontSize: '16px', fontWeight: '600', color: '#111827' }}>{job.duration ? `${job.duration}ms` : 'N/A'}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Total Messages</p>
                    <p style={{ fontSize: '16px', fontWeight: '600', color: '#111827' }}>{messages.length}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Protocol</p>
                    <p style={{ fontSize: '16px', fontWeight: '600', color: '#111827' }}>DoIP/UDS</p>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Trace File</p>
                    <p style={{ fontSize: '16px', fontWeight: '600', color: '#111827' }}>{job.traceFileName || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ecus' && (
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Discovered ECUs</h3>
              <div style={{
                display: 'grid',
                gap: '16px'
              }}>
                {ecus.map(ecu => (
                  <div
                    key={ecu.address}
                    style={{
                      backgroundColor: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '20px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                          <span style={{
                            fontFamily: 'monospace',
                            fontSize: '16px',
                            backgroundColor: '#ffffff',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: '1px solid #e5e7eb',
                            fontWeight: '600'
                          }}>
                            {ecu.address}
                          </span>
                          <span style={{
                            fontSize: '18px',
                            fontWeight: '600',
                            color: '#111827'
                          }}>
                            {ecuNames[ecu.address]?.name || ecu.name}
                          </span>
                        </div>
                        {ecuNames[ecu.address]?.description && (
                          <p style={{ fontSize: '14px', color: '#6b7280', marginLeft: '4px' }}>
                            {ecuNames[ecu.address].description}
                          </p>
                        )}
                      </div>
                      <div style={{
                        display: 'flex',
                        gap: '8px'
                      }}>
                        <span style={{
                          fontSize: '14px',
                          color: '#374151',
                          backgroundColor: '#dbeafe',
                          padding: '4px 12px',
                          borderRadius: '6px',
                          fontWeight: '500'
                        }}>
                          {ecu.messageCount} messages
                        </span>
                        {ecuNames[ecu.address]?.isVerified && (
                          <span style={{
                            fontSize: '14px',
                            color: '#059669',
                            backgroundColor: '#d1fae5',
                            padding: '4px 12px',
                            borderRadius: '6px',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <CheckCircle size={14} />
                            Verified
                          </span>
                        )}
                      </div>
                    </div>

                    {ecu.services.length > 0 && (
                      <div style={{ marginTop: '12px' }}>
                        <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px', fontWeight: '600' }}>SERVICES USED</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {ecu.services.map(service => (
                            <span
                              key={service}
                              style={{
                                fontSize: '12px',
                                backgroundColor: '#ffffff',
                                border: '1px solid #e5e7eb',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontFamily: 'monospace'
                              }}
                            >
                              {service}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'flow' && (
            <div>
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
                {filteredMessages.length > 0 ? (
                  <>
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
                    {filteredMessages.length > 200 && (
                      <div style={{
                        padding: '16px',
                        textAlign: 'center',
                        fontSize: '14px',
                        color: '#6b7280',
                        backgroundColor: '#f9fafb',
                        borderTop: '1px solid #e5e7eb'
                      }}>
                        Showing first 200 of {filteredMessages.length} messages
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{
                    padding: '60px 20px',
                    textAlign: 'center',
                    color: '#6b7280'
                  }}>
                    <p style={{ marginBottom: '8px' }}>No UDS messages available</p>
                    <p style={{ fontSize: '14px', color: '#9ca3af' }}>
                      Messages may not be available if the job hasn't been parsed yet or if there was an error during parsing.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'dtcs' && (
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Diagnostic Trouble Codes</h3>
              {Object.keys(groupedDTCs).length > 0 ? (
                <div>
                  {Object.entries(groupedDTCs).map(([ecuName, dtcs]: any) => (
                    <div key={ecuName} style={{ marginBottom: '24px' }}>
                      <h4 style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        marginBottom: '12px',
                        padding: '8px 12px',
                        backgroundColor: '#f3f4f6',
                        borderRadius: '6px',
                        color: '#374151'
                      }}>
                        {ecuName}
                      </h4>
                      <div style={{ display: 'grid', gap: '8px' }}>
                        {dtcs.map((dtc: any, idx: number) => (
                          <div key={idx} style={{
                            padding: '12px',
                            backgroundColor: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <div>
                              <span style={{ fontFamily: 'monospace', fontWeight: '600', marginRight: '12px' }}>
                                {dtc.code}
                              </span>
                              <span>{dtc.description || 'No description'}</span>
                            </div>
                            <span style={{
                              padding: '2px 8px',
                              backgroundColor: dtc.status === 'ACTIVE' ? '#fee2e2' : '#f3f4f6',
                              color: dtc.status === 'ACTIVE' ? '#dc2626' : '#6b7280',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}>
                              {dtc.status || 'Unknown'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>No DTCs found</p>
              )}
            </div>
          )}

          {activeTab === 'dids' && (
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Data Identifiers</h3>
              {Object.keys(groupedDIDs).length > 0 ? (
                <div>
                  {Object.entries(groupedDIDs).map(([ecuName, dids]: any) => (
                    <div key={ecuName} style={{ marginBottom: '24px' }}>
                      <h4 style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        marginBottom: '12px',
                        padding: '8px 12px',
                        backgroundColor: '#f3f4f6',
                        borderRadius: '6px',
                        color: '#374151'
                      }}>
                        {ecuName}
                      </h4>
                      <div style={{ display: 'grid', gap: '8px' }}>
                        {dids.map((did: any, idx: number) => (
                          <div key={idx} style={{
                            padding: '12px',
                            backgroundColor: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px'
                          }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: '600', marginRight: '12px' }}>
                              {did.did}
                            </span>
                            <span>{did.name || 'Unknown DID'}</span>
                            {did.dataLength > 0 && (
                              <span style={{ marginLeft: '12px', color: '#6b7280', fontSize: '12px' }}>
                                ({did.dataLength} bytes)
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>No DIDs found</p>
              )}
            </div>
          )}

          {activeTab === 'routines' && (
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Routines</h3>
              {Object.keys(groupedRoutines).length > 0 ? (
                <div>
                  {Object.entries(groupedRoutines).map(([ecuName, routines]: any) => (
                    <div key={ecuName} style={{ marginBottom: '24px' }}>
                      <h4 style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        marginBottom: '12px',
                        padding: '8px 12px',
                        backgroundColor: '#f3f4f6',
                        borderRadius: '6px',
                        color: '#374151'
                      }}>
                        {ecuName}
                      </h4>
                      <div style={{ display: 'grid', gap: '8px' }}>
                        {routines.map((routine: any, idx: number) => (
                          <div key={idx} style={{
                            padding: '12px',
                            backgroundColor: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px'
                          }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: '600', marginRight: '12px' }}>
                              {routine.routineId}
                            </span>
                            <span>{routine.name || 'Unknown Routine'}</span>
                            <span style={{ marginLeft: '12px', color: '#6b7280', fontSize: '12px' }}>
                              ({routine.controlType})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>No Routines found</p>
              )}
            </div>
          )}

          {activeTab === 'services' && (
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Services by ID</h3>
              {Object.keys(servicesByID).length > 0 ? (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {Object.entries(servicesByID).map(([serviceId, ecus]: any) => (
                    <div key={serviceId} style={{
                      padding: '16px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px'
                    }}>
                      <div style={{ marginBottom: '8px' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: '600', fontSize: '16px' }}>
                          Service 0x{serviceId}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: '#6b7280', marginRight: '8px' }}>Used by ECUs:</span>
                        <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '6px' }}>
                          {ecus.map((ecu: string) => (
                            <span key={ecu} style={{
                              padding: '2px 8px',
                              backgroundColor: '#dbeafe',
                              color: '#1e40af',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}>
                              {ecu}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>No Services found</p>
              )}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  )
}