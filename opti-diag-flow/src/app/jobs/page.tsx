"use client"

import { useEffect, useState, useCallback } from 'react'
import { PageLayout } from '@/components/layout/page-layout'
import { Card, Button, Badge, StatCard } from '@/components/design-system'
import { colors, spacing } from '@/lib/design-system/tokens'
import {
  FileText,
  Eye,
  Edit,
  Trash2,
  Search,
  Filter,
  Calendar,
  Car,
  Activity,
  Upload,
  CheckCircle,
  AlertCircle,
  X,
  File,
  Loader,
  ChevronDown,
  Plus,
  Building,
  Hash,
  Cpu,
  PlayCircle,
  Sparkles,
  Database,
  Clock,
  Settings,
  Network,
  RefreshCw
} from 'lucide-react'
import { formatBytes, formatDuration } from '@/lib/utils'
import Link from 'next/link'

interface Job {
  id: string
  name: string
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  procedureType: string
  vehicleId: string
  uploadedBy: string
  messageCount: number
  ecuCount: number
  duration: number
  createdAt: string
  updatedAt: string
  Vehicle?: {
    vin?: string
    ModelYear?: {
      year: number
      Model?: {
        name: string
        OEM?: {
          name: string
        }
      }
    }
  }
  TraceSession?: any[]
  ODXDiscoveryResult?: {
    id: string
    jobId: string
    status: 'pending' | 'processing' | 'completed' | 'failed'
    ecuCount: number
    didCount: number
    dtcCount: number
    routineCount: number
    createdAt: string
    completedAt?: string
  }[]
  _count?: {
    ECUConfiguration: number
    DataIdentifier: number
    DTC: number
    Routine: number
    Tag: number
  }
}

interface UploadedFile {
  id: string
  name: string
  size: number
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  error?: string
  content?: string
  file?: File
}

interface VehicleHierarchy {
  id: string
  name: string
  shortName: string
  modelCount: number
  models: {
    id: string
    name: string
    platform?: string
    yearCount: number
    modelYears: {
      id: string
      year: number
      vehicleCount: number
      totalJobs: number
    }[]
  }[]
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Upload state
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)

  // Vehicle selection state
  const [vehicleHierarchy, setVehicleHierarchy] = useState<VehicleHierarchy[]>([])
  const [selectedOEM, setSelectedOEM] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [selectedModelYear, setSelectedModelYear] = useState('')
  const [selectedVin, setSelectedVin] = useState('')
  const [jobName, setJobName] = useState('')
  const [jobType, setJobType] = useState('')
  const [customJobType, setCustomJobType] = useState('')
  const [showCustomJobType, setShowCustomJobType] = useState(false)

  useEffect(() => {
    fetchJobs()
    fetchVehicleHierarchy()
  }, [])

  const fetchVehicleHierarchy = async () => {
    try {
      const response = await fetch('/api/vehicles/hierarchy')
      if (response.ok) {
        const data = await response.json()
        // Transform the API response to match the expected interface
        const transformedData = data.map(oem => ({
          id: oem.id,
          name: oem.name,
          shortName: oem.shortName,
          modelCount: oem._count?.Model || 0,
          models: oem.Model?.map(model => ({
            id: model.id,
            name: model.name,
            platform: model.platform,
            yearCount: model._count?.ModelYear || 0,
            modelYears: model.ModelYear?.map(year => ({
              id: year.id,
              year: year.year,
              vehicleCount: year._count?.Vehicle || 0,
              totalJobs: 0 // This would need to be calculated if needed
            })) || []
          })) || []
        }))
        setVehicleHierarchy(transformedData)
      }
    } catch (error) {
      console.error('Error fetching vehicle hierarchy:', error)
    }
  }

  const fetchJobs = async () => {
    try {
      const response = await fetch('/api/jobs')
      if (response.ok) {
        const data = await response.json()
        setJobs(data.jobs || [])
      }
    } catch (error) {
      console.error('Error fetching jobs:', error)
    } finally {
      setLoading(false)
    }
  }

  const deleteJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job?')) return

    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        setJobs(prev => prev.filter(j => j.id !== jobId))
      }
    } catch (error) {
      console.error('Error deleting job:', error)
    }
  }

  const reparseJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/reparse`, {
        method: 'POST'
      })

      if (response.ok) {
        const result = await response.json()
        // Refresh the jobs list to show updated counts
        await fetchJobs()
        alert(result.message || 'Job reparsed successfully')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to reparse job')
      }
    } catch (error) {
      console.error('Error reparsing job:', error)
      alert('Failed to reparse job')
    }
  }

  const processTrace = async (jobId: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/process-trace`, {
        method: 'POST'
      })
      if (response.ok) {
        // Update the job to show processing status
        setJobs(prev => prev.map(job => {
          if (job.id === jobId) {
            return {
              ...job,
              ODXDiscoveryResult: [{
                id: 'temp-' + Date.now(),
                jobId,
                status: 'processing',
                ecuCount: 0,
                didCount: 0,
                dtcCount: 0,
                routineCount: 0,
                createdAt: new Date().toISOString()
              }]
            }
          }
          return job
        }))

        // Poll for completion
        pollProcessingStatus(jobId)
      } else {
        alert('Failed to start trace processing')
      }
    } catch (error) {
      console.error('Error processing trace:', error)
      alert('Failed to start trace processing')
    }
  }

  const pollProcessingStatus = async (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/jobs/${jobId}/discovery-status`)
        if (response.ok) {
          const data = await response.json()
          if (data.status === 'completed' || data.status === 'failed') {
            clearInterval(interval)
            fetchJobs() // Refresh to get updated data
          }
        }
      } catch (error) {
        console.error('Error polling status:', error)
        clearInterval(interval)
      }
    }, 2000) // Poll every 2 seconds

    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(interval), 300000)
  }

  // Upload handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    handleFiles(droppedFiles)
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      handleFiles(selectedFiles)
    }
  }

  const handleFiles = (fileList: File[]) => {
    const newFiles: UploadedFile[] = fileList.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      status: 'pending',
      progress: 0,
      file: file,
      content: undefined
    }))

    setFiles(prev => [...prev, ...newFiles])

    // Process each file with both reading content and simulating upload
    newFiles.forEach((uploadedFile, index) => {
      setTimeout(() => {
        processFile(uploadedFile.id, uploadedFile.file!)
      }, index * 1000)
    })
  }

  const processFile = async (fileId: string, file: File) => {
    try {
      // Update status to uploading
      setFiles(prev => prev.map(f =>
        f.id === fileId ? { ...f, status: 'uploading', progress: 30 } : f
      ))

      // Upload file using FormData
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const result = await response.json()

      // Update with success status and content
      setFiles(prev => prev.map(f =>
        f.id === fileId ? { ...f, status: 'success', progress: 100, content: result.content } : f
      ))
    } catch (error) {
      console.error('Error uploading file:', error)
      setFiles(prev => prev.map(f =>
        f.id === fileId ? { ...f, status: 'error', error: 'Failed to upload file' } : f
      ))
    }
  }


  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const resetUploadForm = () => {
    setFiles([])
    setSelectedOEM('')
    setSelectedModel('')
    setSelectedModelYear('')
    setSelectedVin('')
    setJobName('')
    setJobType('')
    setCustomJobType('')
    setShowCustomJobType(false)
    setShowCreateForm(false)
  }

  const createJob = async () => {
    try {
      const finalJobType = jobType === 'custom' ? customJobType : jobType

      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: jobName,
          jobType: finalJobType,
          vehicleModelYearId: selectedModelYear,
          vin: selectedVin || null,
          traceFiles: files.filter(f => f.status === 'success').map(f => ({
            name: f.name,
            content: f.content || ''
          }))
        })
      })

      if (response.ok) {
        const newJob = await response.json()
        resetUploadForm()
        fetchJobs() // Refresh the job list
        alert('Job created successfully!')
      } else {
        const error = await response.json()
        alert(`Failed to create job: ${error.error}`)
      }
    } catch (error) {
      console.error('Error creating job:', error)
      alert('Failed to create job. Please try again.')
    }
  }


  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          job.Vehicle?.ModelYear?.Model?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          job.Vehicle?.vin?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  return (
    <PageLayout
      title="Jobs"
      description="Manage and analyze uploaded diagnostic trace logs"
    >
      <div className="ds-container">
        {/* Create Job Toggle */}
        <div className="ds-flex-between" style={{ marginBottom: spacing[6] }}>
          <div>
            <h2 className="ds-heading-2">Diagnostic Jobs</h2>
            <p className="ds-text-secondary">
              {showCreateForm ? 'Create a new diagnostic job' : 'Manage your uploaded trace logs and diagnostic jobs'}
            </p>
          </div>
          <Button
            variant={showCreateForm ? 'error' : 'primary'}
            icon={showCreateForm ? <X size={16} /> : <Plus size={16} />}
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? 'Cancel' : 'Create New Job'}
          </Button>
        </div>

        {/* Create Job Form */}
        {showCreateForm && (
          <Card style={{ marginBottom: spacing[8] }}>
            <div className="ds-grid-2" style={{ gap: spacing[8] }}>
              {/* Left Column - Job Details */}
              <div>
                <h3 className="ds-heading-3" style={{ marginBottom: spacing[5] }}>
                  <FileText size={20} style={{ display: 'inline', marginRight: spacing[2], color: colors.primary[600] }} />
                  Job Details
                </h3>

                <div className="ds-form-group">
                  <label className="ds-label">Job Name</label>
                  <input
                    type="text"
                    value={jobName}
                    onChange={(e) => setJobName(e.target.value)}
                    placeholder="Enter a descriptive name for this job"
                    className="ds-input"
                  />
                </div>

                <div className="ds-form-group">
                  <label className="ds-label">Job Type</label>
                  <select
                    value={jobType}
                    onChange={(e) => {
                      setJobType(e.target.value)
                      setShowCustomJobType(e.target.value === 'custom')
                      if (e.target.value !== 'custom') {
                        setCustomJobType('')
                      }
                    }}
                    className="ds-select"
                  >
                    <option value="">Select Job Type</option>
                    <option value="Dynamic ADAS calibration">Dynamic ADAS calibration</option>
                    <option value="Static ADAS calibration">Static ADAS calibration</option>
                    <option value="Programming & Coding">Programming & Coding</option>
                    <option value="Key programming">Key programming</option>
                    <option value="New parts adaption">New parts adaption</option>
                    <option value="custom">+ Add Custom Job Type</option>
                  </select>

                  {showCustomJobType && (
                    <input
                      type="text"
                      value={customJobType}
                      onChange={(e) => setCustomJobType(e.target.value)}
                      placeholder="Enter custom job type"
                      className="ds-input"
                      style={{ marginTop: spacing[2] }}
                    />
                  )}
                </div>

                <div className="ds-form-group">
                  <label className="ds-label">
                    <Car size={16} style={{ display: 'inline', marginRight: spacing[1] }} />
                    Vehicle Information
                  </label>

                  <div className="ds-grid-2" style={{ gap: spacing[3], marginBottom: spacing[3] }}>
                    <select
                      value={selectedOEM}
                      onChange={(e) => {
                        setSelectedOEM(e.target.value)
                        setSelectedModel('')
                        setSelectedModelYear('')
                      }}
                      className="ds-select"
                    >
                      <option value="">Select OEM</option>
                      {vehicleHierarchy.map(oem => (
                        <option key={oem.id} value={oem.id}>{oem.name}</option>
                      ))}
                    </select>

                    <select
                      value={selectedModel}
                      onChange={(e) => {
                        setSelectedModel(e.target.value)
                        setSelectedModelYear('')
                      }}
                      disabled={!selectedOEM}
                      className="ds-select"
                    >
                      <option value="">Select Model</option>
                      {selectedOEM && vehicleHierarchy
                        .find(oem => oem.id === selectedOEM)?.models
                        .map(model => (
                          <option key={model.id} value={model.id}>{model.name}</option>
                        ))}
                    </select>
                  </div>

                  <div className="ds-grid-2" style={{ gap: spacing[3] }}>
                    <select
                      value={selectedModelYear}
                      onChange={(e) => setSelectedModelYear(e.target.value)}
                      disabled={!selectedModel}
                      className="ds-select"
                    >
                      <option value="">Select Year</option>
                      {selectedModel && vehicleHierarchy
                        .find(oem => oem.id === selectedOEM)?.models
                        .find(model => model.id === selectedModel)?.modelYears
                        .map(year => (
                          <option key={year.id} value={year.id}>{year.year}</option>
                        ))}
                    </select>

                    <input
                      type="text"
                      value={selectedVin}
                      onChange={(e) => setSelectedVin(e.target.value)}
                      placeholder="VIN (optional)"
                      className="ds-input"
                    />
                  </div>
                </div>

                <div className="ds-flex-row" style={{ gap: spacing[3], marginTop: spacing[6] }}>
                  <Button
                    variant="secondary"
                    onClick={resetUploadForm}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={createJob}
                    disabled={!jobName || !selectedModelYear || (!jobType || (jobType === 'custom' && !customJobType)) || files.filter(f => f.status === 'success').length === 0}
                  >
                    Create Job
                  </Button>
                </div>
              </div>

              {/* Right Column - File Upload */}
              <div>
                <h3 className="ds-heading-3" style={{ marginBottom: spacing[5] }}>
                  <Upload size={20} style={{ display: 'inline', marginRight: spacing[2], color: colors.primary[600] }} />
                  Upload Trace Files
                </h3>

                <div
                  className="ds-upload-zone"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('main-file-input')?.click()}
                  style={{
                    borderColor: isDragging ? colors.primary[600] : colors.border.light,
                    backgroundColor: isDragging ? colors.primary[50] : colors.gray[50],
                    marginBottom: spacing[5]
                  }}
                >
                  <div className="ds-upload-icon">
                    <Upload size={24} />
                  </div>

                  <h4 className="ds-heading-4">
                    {isDragging ? 'Drop files here' : 'Drag & drop trace files'}
                  </h4>
                  <p className="ds-text-secondary">
                    or click to browse files
                  </p>
                  <p className="ds-text-muted">
                    Supports: .pcap, .pcapng, .log, .txt, .asc files up to 100MB
                  </p>

                  <input
                    id="main-file-input"
                    type="file"
                    multiple
                    accept=".pcap,.pcapng,.log,.txt,.asc"
                    onChange={handleFileInput}
                    style={{ display: 'none' }}
                  />
                </div>

                {/* Uploaded Files List */}
                {files.length > 0 && (
                  <div>
                    <h4 className="ds-heading-4" style={{ marginBottom: spacing[3] }}>
                      Uploaded Files ({files.length})
                    </h4>
                    <div className="ds-stack" style={{ maxHeight: '200px', overflow: 'auto' }}>
                      {files.map(file => (
                        <Card key={file.id} variant="nested">
                          <div className="ds-flex-row" style={{ gap: spacing[3] }}>
                            <FileText size={16} color={colors.gray[600]} />

                            <div style={{ flex: 1 }}>
                              <div className="ds-flex-between" style={{ marginBottom: spacing[1] }}>
                                <span className="ds-text-primary">{file.name}</span>
                                <div className="ds-flex-row" style={{ gap: spacing[2] }}>
                                  {file.status === 'pending' && (
                                    <span className="ds-text-muted">Waiting...</span>
                                  )}
                                  {file.status === 'uploading' && (
                                    <Loader size={14} className="ds-spinner" />
                                  )}
                                  {file.status === 'success' && (
                                    <CheckCircle size={14} color={colors.success[500]} />
                                  )}
                                  {file.status === 'error' && (
                                    <AlertCircle size={14} color={colors.error[500]} />
                                  )}
                                  <button
                                    onClick={() => removeFile(file.id)}
                                    className="ds-button ds-button-ghost ds-button-sm ds-button-icon"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              </div>
                              <div className="ds-text-muted">
                                {formatFileSize(file.size)}
                              </div>
                              {file.status === 'uploading' && (
                                <div className="ds-progress" style={{ marginTop: spacing[2] }}>
                                  <div className="ds-progress-bar" style={{ width: `${file.progress}%` }} />
                                </div>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Stats */}
        <div className="ds-grid-4" style={{ marginBottom: spacing[6] }}>
          <StatCard
            label="Total Jobs"
            value={jobs.length}
            icon={<FileText size={24} />}
            color="primary"
            loading={loading}
          />
        </div>

        {/* Search and Filters */}
        <Card style={{ marginBottom: spacing[6] }}>
          <div style={{
            display: 'flex',
            gap: spacing[4],
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div className="ds-search-wrapper" style={{
              flex: '0 1 400px',
              minWidth: '250px'
            }}>
              <Search size={16} className="ds-search-icon" />
              <input
                type="text"
                placeholder="Search jobs by name, vehicle, or VIN..."
                className="ds-search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <Button
              variant="secondary"
              icon={<Filter size={16} />}
              style={{ flexShrink: 0 }}
            >
              Filters
            </Button>
          </div>
        </Card>

        {/* Jobs List */}
        <Card>
          {loading ? (
            <div className="ds-loading-container">
              <div className="ds-spinner-large" />
            </div>
          ) : filteredJobs.length > 0 ? (
            <div className="ds-stack" style={{ gap: spacing[4] }}>
              {filteredJobs.map((job) => (
                <Card
                  key={job.id}
                  variant="hover"
                  style={{
                    background: 'linear-gradient(135deg, white 0%, #f8fafc 100%)',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: spacing[6],
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    const card = e.currentTarget as HTMLDivElement;
                    card.style.transform = 'translateY(-4px)';
                    card.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                    card.style.borderColor = colors.primary[400];
                  }}
                  onMouseLeave={(e) => {
                    const card = e.currentTarget as HTMLDivElement;
                    card.style.transform = 'translateY(0)';
                    card.style.boxShadow = 'none';
                    card.style.borderColor = '#e2e8f0';
                  }}
                >
                  {/* Decorative gradient accent */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    background: 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)',
                    borderRadius: '12px 12px 0 0'
                  }} />

                  <div className="ds-flex-between">
                    <div style={{ flex: 1, paddingTop: spacing[2] }}>
                      <div className="ds-flex-row" style={{ gap: spacing[3], marginBottom: spacing[4], alignItems: 'center' }}>
                        <div style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '12px',
                          background: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}>
                          <FileText size={24} color="white" />
                        </div>
                        <div>
                          <h3 className="ds-heading-3" style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
                            {job.name}
                          </h3>
                          <p style={{ margin: 0, color: colors.text.secondary, fontSize: '14px' }}>
                            Job #{job.id.slice(0, 8).toUpperCase()}
                          </p>
                        </div>
                      </div>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: spacing[3],
                        marginBottom: spacing[4],
                        padding: spacing[4],
                        backgroundColor: '#f8fafc',
                        borderRadius: '8px'
                      }}>
                        <div className="ds-flex-row" style={{ gap: spacing[2], alignItems: 'center' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '6px',
                            backgroundColor: colors.primary[100],
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Car size={16} color={colors.primary[600]} />
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', color: colors.text.muted, display: 'block' }}>Vehicle</span>
                            <span style={{ fontSize: '14px', fontWeight: 500, color: colors.text.primary }}>
                              {job.Vehicle?.ModelYear?.Model?.OEM?.name || 'Unknown'} {job.Vehicle?.ModelYear?.Model?.name || 'Vehicle'}
                            </span>
                          </div>
                        </div>

                        <div className="ds-flex-row" style={{ gap: spacing[2], alignItems: 'center' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '6px',
                            backgroundColor: colors.success[100],
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Calendar size={16} color={colors.success[600]} />
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', color: colors.text.muted, display: 'block' }}>Year</span>
                            <span style={{ fontSize: '14px', fontWeight: 500, color: colors.text.primary }}>
                              {job.Vehicle?.ModelYear?.year || 'N/A'}
                            </span>
                          </div>
                        </div>

                        <div className="ds-flex-row" style={{ gap: spacing[2], alignItems: 'center' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '6px',
                            backgroundColor: colors.warning[100],
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Activity size={16} color={colors.warning[600]} />
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', color: colors.text.muted, display: 'block' }}>Messages</span>
                            <span style={{ fontSize: '14px', fontWeight: 500, color: colors.text.primary }}>
                              {job.messageCount || 0}
                            </span>
                          </div>
                        </div>

                        <div className="ds-flex-row" style={{ gap: spacing[2], alignItems: 'center' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '6px',
                            backgroundColor: colors.error[100],
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <FileText size={16} color={colors.error[600]} />
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', color: colors.text.muted, display: 'block' }}>ECUs</span>
                            <span style={{ fontSize: '14px', fontWeight: 500, color: colors.text.primary }}>
                              {job._count?.ECUConfiguration || 0}
                            </span>
                          </div>
                        </div>
                      </div>

                      {job.Vehicle?.vin && (
                        <div style={{
                          padding: `${spacing[2]} ${spacing[3]}`,
                          backgroundColor: '#e0e7ff',
                          borderRadius: '6px',
                          marginBottom: spacing[3],
                          display: 'inline-block'
                        }}>
                          <span style={{ fontSize: '13px', color: '#4338ca', fontWeight: 500 }}>
                            VIN: {job.Vehicle.vin}
                          </span>
                        </div>
                      )}

                      <div className="ds-flex-row" style={{ gap: spacing[3], marginBottom: spacing[3], flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '13px', color: colors.text.muted }}>
                          <Clock size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                          Created: {new Date(job.createdAt).toLocaleDateString()}
                        </span>
                        {job.duration && (
                          <span style={{ fontSize: '13px', color: colors.text.muted }}>
                            <Activity size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                            Duration: {formatDuration(job.duration)}
                          </span>
                        )}
                        <span style={{ fontSize: '13px', color: colors.text.muted }}>
                          <Settings size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                          Type: {job.procedureType}
                        </span>
                      </div>

                      {job.TraceSession && job.TraceSession.length > 0 && (
                        <div className="ds-flex-row" style={{ gap: spacing[3], flexWrap: 'wrap' }}>
                          <Badge variant="warning" size="small">
                            <File size={14} style={{ marginRight: spacing[1] }} />
                            Trace Log Uploaded
                          </Badge>
                          {job.ODXDiscoveryResult && job.ODXDiscoveryResult[0] && (
                            <Badge
                              variant={
                                job.ODXDiscoveryResult[0].status === 'completed' ? 'success' :
                                job.ODXDiscoveryResult[0].status === 'processing' ? 'info' :
                                job.ODXDiscoveryResult[0].status === 'failed' ? 'error' : 'secondary'
                              }
                              size="small"
                            >
                              {job.ODXDiscoveryResult[0].status === 'processing' && <Loader size={14} className="ds-spinner" style={{ marginRight: spacing[1] }} />}
                              {job.ODXDiscoveryResult[0].status === 'completed' && <CheckCircle size={14} style={{ marginRight: spacing[1] }} />}
                              {job.ODXDiscoveryResult[0].status === 'failed' && <AlertCircle size={14} style={{ marginRight: spacing[1] }} />}
                              {job.ODXDiscoveryResult[0].status === 'pending' && <Cpu size={14} style={{ marginRight: spacing[1] }} />}
                              ODX {job.ODXDiscoveryResult[0].status === 'completed' ? 'Generated' :
                                   job.ODXDiscoveryResult[0].status === 'processing' ? 'Processing' :
                                   job.ODXDiscoveryResult[0].status === 'failed' ? 'Failed' : 'Pending'}
                            </Badge>
                          )}
                          {job.ODXDiscoveryResult && job.ODXDiscoveryResult[0]?.status === 'completed' && (
                            <>
                              <Badge variant="secondary" size="small">
                                <Cpu size={14} style={{ marginRight: spacing[1] }} />
                                {job.ODXDiscoveryResult[0].ecuCount} ECUs
                              </Badge>
                              <Badge variant="secondary" size="small">
                                <Database size={14} style={{ marginRight: spacing[1] }} />
                                {job.ODXDiscoveryResult[0].didCount} DIDs
                              </Badge>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="ds-flex-row" style={{ gap: spacing[2], flexWrap: 'wrap', alignItems: 'flex-start' }}>
                      {job.TraceSession && job.TraceSession.length > 0 && !job.ODXDiscoveryResult?.[0] && (
                        <Button
                          variant="success"
                          size="small"
                          icon={<PlayCircle size={16} />}
                          onClick={() => processTrace(job.id)}
                        >
                          Process Trace
                        </Button>
                      )}
                      {job.ODXDiscoveryResult?.[0]?.status === 'completed' && (
                        <>
                          <Link href={`/jobs/${job.id}/discovery`}>
                            <Button variant="purple" size="small" icon={<Sparkles size={16} />}>
                              Discovery
                            </Button>
                          </Link>
                          <Link href={`/jobs/${job.id}/session`}>
                            <Button variant="info" size="small" icon={<Network size={16} />}>
                              Session
                            </Button>
                          </Link>
                        </>
                      )}
                      <Link href={`/jobs/${job.id}`}>
                        <Button variant="primary" size="small" icon={<Eye size={16} />}>
                          View
                        </Button>
                      </Link>
                      <Button
                        variant="success"
                        size="small"
                        icon={<RefreshCw size={16} />}
                        onClick={() => reparseJob(job.id)}
                      >
                        Reparse
                      </Button>
                      <Link href={`/jobs/${job.id}/edit`}>
                        <Button variant="secondary" size="small" icon={<Edit size={16} />}>
                          Edit
                        </Button>
                      </Link>
                      <Button
                        variant="error"
                        size="small"
                        icon={<Trash2 size={16} />}
                        onClick={() => deleteJob(job.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="ds-empty-state">
              <FileText size={48} color={colors.gray[400]} />
              <h3 className="ds-heading-3">No jobs found</h3>
              <p className="ds-text-secondary">
                {searchTerm ? 'Try adjusting your search criteria' : 'Upload a trace log to get started'}
              </p>
              <Button
                variant="primary"
                icon={<Plus size={16} />}
                onClick={() => setShowCreateForm(true)}
                style={{ marginTop: spacing[4] }}
              >
                Create New Job
              </Button>
            </div>
          )}
        </Card>
      </div>
    </PageLayout>
  )
}