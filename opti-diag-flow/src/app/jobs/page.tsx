"use client"

import { useEffect, useState, useCallback } from 'react'
import { PageLayout } from '@/components/layout/page-layout'
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
      <div>
        {/* Create Job Toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '600', margin: 0 }}>Diagnostic Jobs</h2>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0 0' }}>
              {showCreateForm ? 'Create a new diagnostic job' : 'Manage your uploaded trace logs and diagnostic jobs'}
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              backgroundColor: showCreateForm ? '#ef4444' : '#3b82f6',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {showCreateForm ? <X size={16} /> : <Plus size={16} />}
            {showCreateForm ? 'Cancel' : 'Create New Job'}
          </button>
        </div>

        {/* Create Job Form */}
        {showCreateForm && (
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '32px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            marginBottom: '32px'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
              {/* Left Column - Job Details */}
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={20} style={{ color: '#3b82f6' }} />
                  Job Details
                </h3>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                    Job Name
                  </label>
                  <input
                    type="text"
                    value={jobName}
                    onChange={(e) => setJobName(e.target.value)}
                    placeholder="Enter a descriptive name for this job"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s ease',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                    Job Type
                  </label>
                  <select
                    value={jobType}
                    onChange={(e) => {
                      setJobType(e.target.value)
                      setShowCustomJobType(e.target.value === 'custom')
                      if (e.target.value !== 'custom') {
                        setCustomJobType('')
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
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
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none',
                        boxSizing: 'border-box',
                        marginTop: '8px'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                    />
                  )}
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                    <Car size={16} style={{ display: 'inline', marginRight: '6px' }} />
                    Vehicle Information
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <select
                        value={selectedOEM}
                        onChange={(e) => {
                          setSelectedOEM(e.target.value)
                          setSelectedModel('')
                          setSelectedModelYear('')
                        }}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          fontSize: '14px',
                          outline: 'none',
                          backgroundColor: '#ffffff',
                          boxSizing: 'border-box'
                        }}
                      >
                        <option value="">Select OEM</option>
                        {vehicleHierarchy.map(oem => (
                          <option key={oem.id} value={oem.id}>{oem.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <select
                        value={selectedModel}
                        onChange={(e) => {
                          setSelectedModel(e.target.value)
                          setSelectedModelYear('')
                        }}
                        disabled={!selectedOEM}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          fontSize: '14px',
                          outline: 'none',
                          backgroundColor: selectedOEM ? '#ffffff' : '#f9fafb',
                          opacity: selectedOEM ? 1 : 0.5,
                          boxSizing: 'border-box'
                        }}
                      >
                        <option value="">Select Model</option>
                        {selectedOEM && vehicleHierarchy
                          .find(oem => oem.id === selectedOEM)?.models
                          .map(model => (
                            <option key={model.id} value={model.id}>{model.name}</option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <select
                        value={selectedModelYear}
                        onChange={(e) => setSelectedModelYear(e.target.value)}
                        disabled={!selectedModel}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          fontSize: '14px',
                          outline: 'none',
                          backgroundColor: selectedModel ? '#ffffff' : '#f9fafb',
                          opacity: selectedModel ? 1 : 0.5,
                          boxSizing: 'border-box'
                        }}
                      >
                        <option value="">Select Year</option>
                        {selectedModel && vehicleHierarchy
                          .find(oem => oem.id === selectedOEM)?.models
                          .find(model => model.id === selectedModel)?.modelYears
                          .map(year => (
                            <option key={year.id} value={year.id}>{year.year}</option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <input
                        type="text"
                        value={selectedVin}
                        onChange={(e) => setSelectedVin(e.target.value)}
                        placeholder="VIN (optional)"
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          fontSize: '14px',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                        onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                  <button
                    onClick={resetUploadForm}
                    style={{
                      padding: '12px 20px',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      backgroundColor: '#ffffff',
                      color: '#374151',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#f9fafb'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#ffffff'}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createJob}
                    disabled={!jobName || !selectedModelYear || (!jobType || (jobType === 'custom' && !customJobType)) || files.filter(f => f.status === 'success').length === 0}
                    style={{
                      padding: '12px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: (!jobName || !selectedModelYear || (!jobType || (jobType === 'custom' && !customJobType)) || files.filter(f => f.status === 'success').length === 0) ? '#9ca3af' : '#3b82f6',
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: (!jobName || !selectedModelYear || (!jobType || (jobType === 'custom' && !customJobType)) || files.filter(f => f.status === 'success').length === 0) ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Create Job
                  </button>
                </div>
              </div>

              {/* Right Column - File Upload */}
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Upload size={20} style={{ color: '#3b82f6' }} />
                  Upload Trace Files
                </h3>

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('main-file-input')?.click()}
                  style={{
                    border: `2px dashed ${isDragging ? '#3b82f6' : '#e5e7eb'}`,
                    borderRadius: '12px',
                    padding: '32px 20px',
                    textAlign: 'center',
                    backgroundColor: isDragging ? '#f0f9ff' : '#fafafa',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    marginBottom: '20px'
                  }}
                >
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: '#3b82f615',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px'
                  }}>
                    <Upload size={24} style={{ color: '#3b82f6' }} />
                  </div>

                  <h4 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 8px 0' }}>
                    {isDragging ? 'Drop files here' : 'Drag & drop trace files'}
                  </h4>
                  <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 8px 0' }}>
                    or click to browse files
                  </p>
                  <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>
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
                    <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
                      Uploaded Files ({files.length})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflow: 'auto' }}>
                      {files.map(file => (
                        <div
                          key={file.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '12px 16px',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            backgroundColor: '#fafafa'
                          }}
                        >
                          <FileText size={16} style={{ color: '#6b7280', marginRight: '12px', flexShrink: 0 }} />

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ fontSize: '14px', fontWeight: '500', truncate: 'ellipsis', overflow: 'hidden' }}>{file.name}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                {file.status === 'pending' && (
                                  <span style={{ fontSize: '12px', color: '#6b7280' }}>Waiting...</span>
                                )}
                                {file.status === 'uploading' && (
                                  <Loader size={14} style={{ color: '#3b82f6', animation: 'spin 1s linear infinite' }} />
                                )}
                                {file.status === 'success' && (
                                  <CheckCircle size={14} style={{ color: '#10b981' }} />
                                )}
                                {file.status === 'error' && (
                                  <AlertCircle size={14} style={{ color: '#ef4444' }} />
                                )}
                                <button
                                  onClick={() => removeFile(file.id)}
                                  style={{
                                    padding: '2px',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    cursor: 'pointer',
                                    borderRadius: '4px'
                                  }}
                                  onMouseEnter={(e) => e.target.style.backgroundColor = '#e5e7eb'}
                                  onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                                >
                                  <X size={14} style={{ color: '#6b7280' }} />
                                </button>
                              </div>
                            </div>
                            <div style={{ fontSize: '12px', color: '#6b7280' }}>
                              {formatFileSize(file.size)}
                            </div>
                            {file.status === 'uploading' && (
                              <div style={{
                                width: '100%',
                                height: '3px',
                                backgroundColor: '#e5e7eb',
                                borderRadius: '2px',
                                overflow: 'hidden',
                                marginTop: '6px'
                              }}>
                                <div style={{
                                  width: `${file.progress}%`,
                                  height: '100%',
                                  backgroundColor: '#3b82f6',
                                  transition: 'width 0.2s ease'
                                }} />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '24px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 4px 0' }}>Total Jobs</p>
                <p style={{ fontSize: '28px', fontWeight: '700', margin: 0 }}>{jobs.length}</p>
              </div>
              <FileText size={32} style={{ color: '#3b82f6' }} />
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1', minWidth: '300px', position: 'relative' }}>
              <Search size={16} style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9ca3af'
              }} />
              <input
                type="text"
                placeholder="Search jobs by name, vehicle, or VIN..."
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 40px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none'
                }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              backgroundColor: 'transparent',
              color: '#374151',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px',
              cursor: 'pointer'
            }}>
              <Filter size={16} />
              Filters
            </button>
          </div>
        </div>

        {/* Jobs List */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '24px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>

          {/* Jobs Content */}
          <div>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  border: '2px solid #e5e7eb',
                  borderTop: '2px solid #374151',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
              </div>
            ) : filteredJobs.length > 0 ? (
              <div style={{ display: 'grid', gap: '16px' }}>
                {filteredJobs.map((job) => (
                  <div key={job.id} style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    padding: '24px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                    transition: 'box-shadow 0.15s ease-in-out'
                  }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div style={{ flex: '1' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>{job.name}</h3>
                          </div>

                          <div style={{
                            marginTop: '8px',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '16px',
                            fontSize: '14px',
                            color: '#6b7280'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Car size={16} />
                              <span>
                                {job.Vehicle?.ModelYear?.Model?.OEM?.name || 'Unknown'} {job.Vehicle?.ModelYear?.Model?.name || 'Vehicle'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Calendar size={16} />
                              <span>{job.Vehicle?.ModelYear?.year || 'N/A'}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Activity size={16} />
                              <span>{job.messageCount || 0} messages</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <FileText size={16} />
                              <span>{job._count?.ECUConfiguration || 0} ECUs</span>
                            </div>
                          </div>

                          {job.Vehicle?.vin && (
                            <div style={{ marginTop: '8px', fontSize: '14px', color: '#6b7280' }}>
                              VIN: {job.Vehicle.vin}
                            </div>
                          )}

                          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: '#9ca3af' }}>
                            <span>Created: {new Date(job.createdAt).toLocaleDateString()}</span>
                            {job.duration && (
                              <span>Duration: {formatDuration(job.duration)}</span>
                            )}
                            <span>Type: {job.procedureType}</span>
                          </div>

                          {job.TraceSession && job.TraceSession.length > 0 && (
                            <div style={{ marginTop: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                <span style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '4px 8px',
                                  backgroundColor: '#fef3c7',
                                  color: '#92400e',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  fontWeight: '500'
                                }}>
                                  <File size={14} />
                                  Trace Log Uploaded
                                </span>
                                {job.ODXDiscoveryResult && job.ODXDiscoveryResult[0] && (
                                  <span style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '4px 8px',
                                    backgroundColor: job.ODXDiscoveryResult[0].status === 'completed' ? '#d1fae5' :
                                                     job.ODXDiscoveryResult[0].status === 'processing' ? '#dbeafe' :
                                                     job.ODXDiscoveryResult[0].status === 'failed' ? '#fee2e2' : '#f3f4f6',
                                    color: job.ODXDiscoveryResult[0].status === 'completed' ? '#065f46' :
                                           job.ODXDiscoveryResult[0].status === 'processing' ? '#1e40af' :
                                           job.ODXDiscoveryResult[0].status === 'failed' ? '#991b1b' : '#374151',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    fontWeight: '500'
                                  }}>
                                    {job.ODXDiscoveryResult[0].status === 'processing' && <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                                    {job.ODXDiscoveryResult[0].status === 'completed' && <CheckCircle size={14} />}
                                    {job.ODXDiscoveryResult[0].status === 'failed' && <AlertCircle size={14} />}
                                    {job.ODXDiscoveryResult[0].status === 'pending' && <Cpu size={14} />}
                                    ODX {job.ODXDiscoveryResult[0].status === 'completed' ? 'Generated' :
                                         job.ODXDiscoveryResult[0].status === 'processing' ? 'Processing' :
                                         job.ODXDiscoveryResult[0].status === 'failed' ? 'Failed' : 'Pending'}
                                  </span>
                                )}
                                {job.ODXDiscoveryResult && job.ODXDiscoveryResult[0]?.status === 'completed' && (
                                  <>
                                    <span style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '4px 8px',
                                      backgroundColor: '#e5e7eb',
                                      borderRadius: '4px',
                                      fontSize: '12px',
                                      color: '#374151'
                                    }}>
                                      <Cpu size={14} />
                                      {job.ODXDiscoveryResult[0].ecuCount} ECUs
                                    </span>
                                    <span style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '4px 8px',
                                      backgroundColor: '#e5e7eb',
                                      borderRadius: '4px',
                                      fontSize: '12px',
                                      color: '#374151'
                                    }}>
                                      <Database size={14} />
                                      {job.ODXDiscoveryResult[0].didCount} DIDs
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {job.TraceSession && job.TraceSession.length > 0 && !job.ODXDiscoveryResult?.[0] && (
                            <button
                              onClick={() => processTrace(job.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 12px',
                                backgroundColor: '#10b981',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '14px',
                                cursor: 'pointer'
                              }}>
                              <PlayCircle size={16} />
                              Process Trace
                            </button>
                          )}
                          {job.ODXDiscoveryResult?.[0]?.status === 'completed' && (
                            <>
                              <Link href={`/jobs/${job.id}/discovery`}>
                                <button style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '8px 12px',
                                  backgroundColor: '#8b5cf6',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontSize: '14px',
                                  cursor: 'pointer'
                                }}>
                                  <Sparkles size={16} />
                                  Discovery
                                </button>
                              </Link>
                              <Link href={`/jobs/${job.id}/session`}>
                                <button style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '8px 12px',
                                  backgroundColor: '#06b6d4',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontSize: '14px',
                                  cursor: 'pointer'
                                }}>
                                  <Network size={16} />
                                  Session
                                </button>
                              </Link>
                              <Link href={`/odx-editor/${job.id}`}>
                                <button style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '8px 12px',
                                  backgroundColor: '#f59e0b',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontSize: '14px',
                                  cursor: 'pointer'
                                }}>
                                  <Edit size={16} />
                                  ODX Editor
                                </button>
                              </Link>
                            </>
                          )}
                          <Link href={`/jobs/${job.id}`}>
                            <button style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 12px',
                              backgroundColor: '#3b82f6',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '14px',
                              cursor: 'pointer'
                            }}>
                              <Eye size={16} />
                              View
                            </button>
                          </Link>
                          <button
                            onClick={() => reparseJob(job.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 12px',
                              backgroundColor: '#10b981',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '14px',
                              cursor: 'pointer'
                            }}
                          >
                            <RefreshCw size={16} />
                            Reparse
                          </button>
                          <Link href={`/jobs/${job.id}/edit`}>
                            <button style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 12px',
                              backgroundColor: 'transparent',
                              color: '#374151',
                              border: '1px solid #e5e7eb',
                              borderRadius: '6px',
                              fontSize: '14px',
                              cursor: 'pointer'
                            }}>
                              <Edit size={16} />
                              Edit
                            </button>
                          </Link>
                          <button
                            onClick={() => deleteJob(job.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 12px',
                              backgroundColor: 'transparent',
                              color: '#dc2626',
                              border: '1px solid #e5e7eb',
                              borderRadius: '6px',
                              fontSize: '14px',
                              cursor: 'pointer'
                            }}
                          >
                            <Trash2 size={16} />
                            Delete
                          </button>
                        </div>
                      </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 0',
                textAlign: 'center'
              }}>
                <FileText size={48} style={{ color: '#9ca3af', marginBottom: '16px' }} />
                <h3 style={{ fontSize: '18px', fontWeight: '500', color: '#111827', margin: '0 0 8px 0' }}>No jobs found</h3>
                <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 16px 0' }}>
                  {searchTerm ? 'Try adjusting your search criteria' : 'Upload a trace log to get started'}
                </p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    backgroundColor: '#3b82f6',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}>
                  <Plus size={16} />
                  Create New Job
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </PageLayout>
  )
}