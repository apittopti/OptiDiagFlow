'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Download, RefreshCw, AlertCircle, Activity, Database, Cpu, CheckCircle, ArrowRight } from 'lucide-react'
import { PageLayout } from '@/components/layout/page-layout'
import { Card, Button, Badge, StatCard } from '@/components/design-system'
import { colors, spacing } from '@/lib/design-system/tokens'
import { containerStyles, flexStyles, gridStyles } from '@/lib/design-system/styles'

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

        // Process messages and ECUs
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

  const handleReparse = () => {
    console.log('Reparse job')
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
    <PageLayout title="Job Details" description={`Job ID: ${job.id}`}>
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
          <div className="ds-tabs-container" style={{ marginBottom: spacing[6] }}>
            <div className="ds-tabs">
              <button
                className={`ds-tab ${activeTab === 'overview' ? 'ds-tab-active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                Overview
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
                UDS Flow
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
                Services
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
                    <p className="ds-label">Session ID</p>
                    <p className="ds-value">{job.diagSessionId || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="ds-label">Vehicle VIN</p>
                    <p className="ds-value">{job.Vehicle?.vin || 'Unknown'}</p>
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
                    <p className="ds-value">{messages.length}</p>
                  </div>
                  <div>
                    <p className="ds-label">Protocol</p>
                    <p className="ds-value">DoIP/UDS</p>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <p className="ds-label">Trace File</p>
                    <p className="ds-value">{job.traceFileName || 'N/A'}</p>
                  </div>
                </div>
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
                              {service}
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

          {/* Other tabs would follow similar refactoring pattern */}
        </Card>
      </div>
    </PageLayout>
  )
}