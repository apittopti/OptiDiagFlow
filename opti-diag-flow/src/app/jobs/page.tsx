"use client"

import { useEffect, useState, useCallback } from 'react'
import { PageLayout } from '@/components/layout/page-layout'
import { Card, Button, Badge, StatCard } from '@/components/design-system'
import { colors, spacing } from '@/lib/design-system/tokens'
import { inputStyles, combineStyles } from '@/lib/design-system/styles'
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
  path?: string
  fileName?: string
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

  // Filter state
  const [showFilters, setShowFilters] = useState(false)
  const [filterOEM, setFilterOEM] = useState('')
  const [filterModel, setFilterModel] = useState('')
  const [filterYear, setFilterYear] = useState('')
  const [filterProcedureType, setFilterProcedureType] = useState('')

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
  const [jobNotes, setJobNotes] = useState('')

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
      console.log('Reparsing job with ID:', jobId)
      const url = `/api/jobs/${jobId}/reparse`
      console.log('Reparse URL:', url)

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      console.log('Reparse response status:', response.status)

      if (response.ok) {
        const result = await response.json()
        // Refresh the jobs list to show updated counts
        await fetchJobs()
        alert(result.message || 'Job reparsed successfully')
      } else {
        const errorText = await response.text()
        console.error('Reparse failed with response:', errorText)
        try {
          const error = JSON.parse(errorText)
          alert(error.error || 'Failed to reparse job')
        } catch {
          alert(`Failed to reparse job: ${errorText}`)
        }
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

      // Update with success status, content, and path
      setFiles(prev => prev.map(f =>
        f.id === fileId ? {
          ...f,
          status: 'success',
          progress: 100,
          content: result.content,
          path: result.path,  // Store the file path
          fileName: result.fileName  // Store the saved filename
        } : f
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
    setJobNotes('')
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
          description: jobNotes || null,
          vehicleModelYearId: selectedModelYear,
          vin: selectedVin || null,
          traceFiles: files.filter(f => f.status === 'success').map(f => ({
            name: f.name,
            content: f.content || '',
            path: f.path,
            fileName: f.fileName
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
    const matchesSearch = searchTerm === '' ||
                          job.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          job.Vehicle?.ModelYear?.Model?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          job.Vehicle?.vin?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          job.procedureType?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesOEM = filterOEM === '' || job.Vehicle?.ModelYear?.Model?.OEM?.name === filterOEM
    const matchesModel = filterModel === '' || job.Vehicle?.ModelYear?.Model?.name === filterModel
    const matchesYear = filterYear === '' || job.Vehicle?.ModelYear?.year?.toString() === filterYear
    const matchesProcedureType = filterProcedureType === '' || job.procedureType === filterProcedureType

    return matchesSearch && matchesOEM && matchesModel && matchesYear && matchesProcedureType
  })

  // Get unique values for filters
  const uniqueOEMs = Array.from(new Set(jobs.map(job => job.Vehicle?.ModelYear?.Model?.OEM?.name).filter(Boolean)))
  const uniqueModels = filterOEM
    ? Array.from(new Set(jobs
        .filter(job => job.Vehicle?.ModelYear?.Model?.OEM?.name === filterOEM)
        .map(job => job.Vehicle?.ModelYear?.Model?.name).filter(Boolean)))
    : Array.from(new Set(jobs.map(job => job.Vehicle?.ModelYear?.Model?.name).filter(Boolean)))
  const uniqueYears = Array.from(new Set(jobs.map(job => job.Vehicle?.ModelYear?.year).filter(Boolean))).sort((a, b) => b - a)
  const uniqueProcedureTypes = Array.from(new Set(jobs.map(job => job.procedureType).filter(Boolean)))

  return (
    <PageLayout
      title="Jobs"
      description="Manage and analyze uploaded diagnostic trace logs"
    >
      <div className="ds-container">
        {/* Create Job Toggle */}
        <div className="ds-flex-end" style={{ marginBottom: spacing[6] }}>
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
            <div style={{ padding: spacing[6] }}>
              <h2 className="ds-heading-2" style={{
                marginBottom: spacing[8],
                fontSize: '28px',
                fontWeight: 700,
                color: colors.text.primary,
                display: 'flex',
                alignItems: 'center',
                gap: spacing[3]
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: `linear-gradient(135deg, ${colors.primary[500]}, ${colors.primary[600]})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15)'
                }}>
                  <FileText size={24} color="white" />
                </div>
                Create New Diagnostic Job
              </h2>

              {/* Full Width Form Layout */}
              <div style={{ width: '100%' }}>

                {/* Two Column Grid for Job Name and Type */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: spacing[4] }}>
                  {/* Job Name - Required */}
                  <div className="ds-form-group">
                    <label className="ds-label" style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: colors.text.primary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: spacing[2],
                      display: 'block'
                    }}>
                      Job Name <span style={{ color: colors.error[500] }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={jobName}
                      onChange={(e) => setJobName(e.target.value)}
                      placeholder="Enter a descriptive name for this diagnostic job"
                      className="ds-input"
                      style={inputStyles.base}
                    />
                  </div>

                  {/* Job Type - Required */}
                  <div className="ds-form-group">
                    <label className="ds-label" style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: colors.text.primary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: spacing[2],
                      display: 'block'
                    }}>
                      Job Type <span style={{ color: colors.error[500] }}>*</span>
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
                      className="ds-select"
                      style={combineStyles(inputStyles.base, { cursor: 'pointer' })}
                    >
                      <option value="">Select diagnostic procedure type</option>
                      <option value="Dynamic ADAS calibration">Dynamic ADAS calibration</option>
                      <option value="Static ADAS calibration">Static ADAS calibration</option>
                      <option value="Programming & Coding">Programming & Coding</option>
                      <option value="Key programming">Key programming</option>
                      <option value="New parts adaption">New parts adaption</option>
                      <option value="custom">+ Add Custom Job Type</option>
                    </select>
                  </div>
                </div>

                {showCustomJobType && (
                  <div style={{ marginBottom: spacing[4] }}>
                    <input
                      type="text"
                      value={customJobType}
                      onChange={(e) => setCustomJobType(e.target.value)}
                      placeholder="Enter custom job type"
                      className="ds-input"
                      style={inputStyles.base}
                    />
                  </div>
                )}

                {/* Notes - Full Width */}
                <div className="ds-form-group" style={{ marginBottom: spacing[4] }}>
                  <label className="ds-label" style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: colors.text.primary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: spacing[2],
                    display: 'block'
                  }}>
                    Notes
                  </label>
                  <textarea
                    value={jobNotes}
                    onChange={(e) => setJobNotes(e.target.value)}
                    placeholder="Additional notes or comments (optional)"
                    className="ds-input"
                    rows={3}
                    style={inputStyles.textarea}
                  />
                </div>

                {/* Vehicle Information Section */}
                <div style={{
                  marginTop: spacing[5],
                  marginBottom: spacing[5],
                  padding: spacing[4],
                  backgroundColor: colors.background.secondary,
                  borderRadius: '8px',
                  border: `1px solid ${colors.border.light}`
                }}>
                  <h3 className="ds-heading-3" style={{
                    marginBottom: spacing[4],
                    fontSize: '14px',
                    fontWeight: 600,
                    color: colors.text.primary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing[2]
                  }}>
                    <Car size={16} color={colors.primary[600]} />
                    Vehicle Information
                  </h3>

                  {/* OEM, Model, Year - 3 column grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '16px',
                    marginBottom: spacing[4]
                  }}>
                    <div>
                      <label className="ds-label" style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: colors.text.primary,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        marginBottom: spacing[2],
                        display: 'block'
                      }}>
                        OEM <span style={{ color: colors.error[500] }}>*</span>
                      </label>
                      <select
                        value={selectedOEM}
                        onChange={(e) => {
                          setSelectedOEM(e.target.value)
                          setSelectedModel('')
                          setSelectedModelYear('')
                        }}
                        className="ds-select"
                        style={combineStyles(inputStyles.base, { cursor: 'pointer' })}
                      >
                        <option value="">Select OEM</option>
                        {vehicleHierarchy.map(oem => (
                          <option key={oem.id} value={oem.id}>{oem.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="ds-label" style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: colors.text.primary,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        marginBottom: spacing[2],
                        display: 'block'
                      }}>
                        Model <span style={{ color: colors.error[500] }}>*</span>
                      </label>
                      <select
                        value={selectedModel}
                        onChange={(e) => {
                          setSelectedModel(e.target.value)
                          setSelectedModelYear('')
                        }}
                        disabled={!selectedOEM}
                        className="ds-select"
                        style={combineStyles(inputStyles.base, { cursor: 'pointer', opacity: !selectedOEM ? 0.6 : 1 })}
                      >
                        <option value="">Select Model</option>
                        {selectedOEM && vehicleHierarchy
                          .find(oem => oem.id === selectedOEM)?.models
                          .map(model => (
                            <option key={model.id} value={model.id}>{model.name}</option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="ds-label" style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: colors.text.primary,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        marginBottom: spacing[2],
                        display: 'block'
                      }}>
                        Year <span style={{ color: colors.error[500] }}>*</span>
                      </label>
                      <select
                        value={selectedModelYear}
                        onChange={(e) => setSelectedModelYear(e.target.value)}
                        disabled={!selectedModel}
                        className="ds-select"
                        style={combineStyles(inputStyles.base, { cursor: 'pointer', opacity: !selectedModel ? 0.6 : 1 })}
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
                  </div>

                  {/* VIN - Constrained width */}
                  <div style={{ maxWidth: '400px' }}>
                    <label className="ds-label" style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: colors.text.primary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: spacing[2],
                      display: 'block'
                    }}>
                      VIN (Vehicle Identification Number)
                    </label>
                    <input
                      type="text"
                      value={selectedVin}
                      onChange={(e) => setSelectedVin(e.target.value)}
                      placeholder="Enter VIN (optional)"
                      className="ds-input"
                      maxLength={17}
                      style={combineStyles(inputStyles.base, { fontFamily: 'monospace', letterSpacing: '1px', maxWidth: '400px' })}
                    />
                  </div>
                </div>

                {/* File Upload Section */}
                <div style={{
                  marginTop: spacing[5],
                  marginBottom: spacing[5],
                  padding: spacing[4],
                  backgroundColor: colors.background.secondary,
                  borderRadius: '8px',
                  border: `1px solid ${colors.border.light}`
                }}>
                  <h3 className="ds-heading-3" style={{
                    marginBottom: spacing[4],
                    fontSize: '14px',
                    fontWeight: 600,
                    color: colors.text.primary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing[2]
                  }}>
                    <Upload size={16} color={colors.primary[600]} />
                    Upload Trace File
                  </h3>

                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('main-file-input')?.click()}
                    style={{
                      border: `2px dashed ${isDragging ? colors.primary[400] : colors.border.default}`,
                      borderRadius: '8px',
                      padding: `${spacing[5]} ${spacing[6]}`,
                      textAlign: 'center',
                      backgroundColor: isDragging ? colors.primary[50] : colors.background.primary,
                      transition: 'all 0.3s ease',
                      cursor: 'pointer',
                      marginBottom: spacing[4]
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: spacing[3]
                    }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        backgroundColor: isDragging ? colors.primary[100] : colors.gray[100],
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.3s ease'
                      }}>
                        <Upload size={24} color={isDragging ? colors.primary[600] : colors.gray[500]} />
                      </div>

                      <div style={{ textAlign: 'left' }}>
                        <h4 style={{
                          fontSize: '14px',
                          fontWeight: 600,
                          margin: 0,
                          marginBottom: spacing[1],
                          color: colors.text.primary
                        }}>
                          {isDragging ? 'Drop your trace file here' : 'Drag & drop your trace file'}
                        </h4>
                        <p style={{
                          fontSize: '13px',
                          color: colors.text.secondary,
                          margin: 0
                        }}>
                          or click to browse and select file
                        </p>
                      </div>

                      <Button
                        variant="secondary"
                        size="small"
                        icon={<Upload size={16} />}
                        style={{ pointerEvents: 'none', marginLeft: 'auto' }}
                      >
                        Select Trace File
                      </Button>
                    </div>

                    <input
                      id="main-file-input"
                      type="file"
                      accept=".pcap,.pcapng,.log,.txt,.asc"
                      onChange={handleFileInput}
                      style={{ display: 'none' }}
                    />
                  </div>

                  {/* Uploaded Files List */}
                  {files.length > 0 && (
                    <div>
                      <h4 className="ds-heading-4" style={{
                        marginBottom: spacing[3],
                        fontSize: '16px',
                        fontWeight: 600,
                        color: colors.text.primary
                      }}>
                        Uploaded Files
                      </h4>
                      <div className="ds-stack" style={{ maxHeight: '300px', overflow: 'auto' }}>
                        {files.map(file => (
                          <Card key={file.id} variant="nested" style={{
                            padding: spacing[4],
                            backgroundColor: colors.background.primary,
                            border: `1px solid ${colors.border.light}`,
                            borderRadius: '8px'
                          }}>
                            <div className="ds-flex-row" style={{ gap: spacing[3], alignItems: 'center' }}>
                              <FileText size={18} color={colors.gray[600]} />

                              <div style={{ flex: 1 }}>
                                <div className="ds-flex-between" style={{ marginBottom: spacing[1] }}>
                                  <span style={{
                                    fontSize: '15px',
                                    fontWeight: 500,
                                    color: colors.text.primary
                                  }}>
                                    {file.name}
                                  </span>
                                  <div className="ds-flex-row" style={{ gap: spacing[2], alignItems: 'center' }}>
                                    {file.status === 'pending' && (
                                      <span style={{ fontSize: '13px', color: colors.text.muted }}>Waiting...</span>
                                    )}
                                    {file.status === 'uploading' && (
                                      <Loader size={16} className="ds-spinner" />
                                    )}
                                    {file.status === 'success' && (
                                      <CheckCircle size={16} color={colors.success[500]} />
                                    )}
                                    {file.status === 'error' && (
                                      <AlertCircle size={16} color={colors.error[500]} />
                                    )}
                                    <button
                                      onClick={() => removeFile(file.id)}
                                      className="ds-button ds-button-ghost ds-button-sm ds-button-icon"
                                      style={{
                                        width: '28px',
                                        height: '28px',
                                        padding: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                </div>
                                <div style={{
                                  fontSize: '13px',
                                  color: colors.text.muted
                                }}>
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

                {/* Action Buttons */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: spacing[3],
                  paddingTop: spacing[6],
                  borderTop: `1px solid ${colors.border.light}`
                }}>
                  <Button
                    variant="secondary"
                    onClick={resetUploadForm}
                    style={{
                      minWidth: '120px',
                      padding: `${spacing[3]} ${spacing[5]}`,
                      fontSize: '16px'
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={createJob}
                    disabled={!jobName || !selectedModelYear || (!jobType || (jobType === 'custom' && !customJobType)) || files.filter(f => f.status === 'success').length === 0}
                    style={{
                      minWidth: '140px',
                      padding: `${spacing[3]} ${spacing[5]}`,
                      fontSize: '16px',
                      fontWeight: 600
                    }}
                  >
                    Create Job
                  </Button>
                </div>

              </div>
            </div>
          </Card>
        )}


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
              onClick={() => setShowFilters(!showFilters)}
              style={{ flexShrink: 0 }}
            >
              Filters {(filterOEM || filterModel || filterYear || filterProcedureType) && (
                <Badge variant="primary" size="small" style={{ marginLeft: spacing[2] }}>
                  Active
                </Badge>
              )}
            </Button>
          </div>

          {/* Filter Controls */}
          {showFilters && (
            <div style={{
              marginTop: spacing[4],
              paddingTop: spacing[4],
              borderTop: `1px solid ${colors.border.light}`,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: spacing[3]
            }}>
              <div>
                <label className="ds-label" style={{ fontSize: '12px', marginBottom: spacing[1] }}>
                  OEM
                </label>
                <select
                  className="ds-select"
                  value={filterOEM}
                  onChange={(e) => {
                    setFilterOEM(e.target.value)
                    setFilterModel('') // Reset model when OEM changes
                  }}
                  style={combineStyles(inputStyles.base, { cursor: 'pointer' })}
                >
                  <option value="">All OEMs</option>
                  {uniqueOEMs.sort().map(oem => (
                    <option key={oem} value={oem}>{oem}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="ds-label" style={{ fontSize: '12px', marginBottom: spacing[1] }}>
                  Model
                </label>
                <select
                  className="ds-select"
                  value={filterModel}
                  onChange={(e) => setFilterModel(e.target.value)}
                  style={combineStyles(inputStyles.base, { cursor: 'pointer' })}
                  disabled={!filterOEM && uniqueModels.length === 0}
                >
                  <option value="">All Models</option>
                  {uniqueModels.sort().map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="ds-label" style={{ fontSize: '12px', marginBottom: spacing[1] }}>
                  Year
                </label>
                <select
                  className="ds-select"
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  style={combineStyles(inputStyles.base, { cursor: 'pointer' })}
                >
                  <option value="">All Years</option>
                  {uniqueYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>


              <div>
                <label className="ds-label" style={{ fontSize: '12px', marginBottom: spacing[1] }}>
                  Procedure Type
                </label>
                <select
                  className="ds-select"
                  value={filterProcedureType}
                  onChange={(e) => setFilterProcedureType(e.target.value)}
                  style={combineStyles(inputStyles.base, { cursor: 'pointer' })}
                >
                  <option value="">All Types</option>
                  {uniqueProcedureTypes.sort().map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setFilterOEM('')
                    setFilterModel('')
                    setFilterYear('')
                    setFilterProcedureType('')
                  }}
                  style={{ width: '100%' }}
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Jobs List */}
        <Card>
          {/* Results Count */}
          {!loading && (
            <div style={{
              marginBottom: spacing[4],
              paddingBottom: spacing[4],
              borderBottom: `1px solid ${colors.border.light}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 className="ds-heading-3" style={{ margin: 0 }}>
                {filteredJobs.length} {filteredJobs.length === 1 ? 'Job' : 'Jobs'} Found
                {(searchTerm || filterOEM || filterModel || filterYear || filterProcedureType) && (
                  <span style={{ fontSize: '14px', fontWeight: 400, color: colors.text.muted, marginLeft: spacing[2] }}>
                    (filtered from {jobs.length} total)
                  </span>
                )}
              </h3>
            </div>
          )}

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
                        <div style={{ flex: 1 }}>
                          <div className="ds-flex-row" style={{ gap: spacing[2], alignItems: 'center', marginBottom: spacing[1] }}>
                            <h3 className="ds-heading-3" style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
                              {job.name}
                            </h3>
                            <Badge variant="primary" size="small" style={{ fontWeight: 500 }}>
                              {job.procedureType}
                            </Badge>
                          </div>
                          <p style={{ margin: 0, color: colors.text.secondary, fontSize: '14px' }}>
                            Job #{job.id.slice(0, 8).toUpperCase()}
                          </p>
                        </div>
                      </div>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
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
                            backgroundColor: colors.info[100],
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Network size={16} color={colors.info[600]} />
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', color: colors.text.muted, display: 'block' }}>Protocol</span>
                            <span style={{ fontSize: '14px', fontWeight: 500, color: colors.text.primary }}>
                              {(() => {
                                // Check both ecuSummary and ecus fields
                                const ecus = (job as any).metadata?.ecuSummary || (job as any).metadata?.ecus || [];

                                // Count protocols by frequency
                                const protocolCount = {};
                                ecus.forEach(ecu => {
                                  if (ecu.protocol) {
                                    protocolCount[ecu.protocol] = (protocolCount[ecu.protocol] || 0) + 1;
                                  }
                                });

                                // Get all unique protocols
                                const protocols = Object.keys(protocolCount);
                                if (protocols.length === 0) return 'N/A';

                                // Sort by count (most common first)
                                const sortedProtocols = protocols.sort((a, b) => protocolCount[b] - protocolCount[a]);

                                // Always show all protocols
                                return sortedProtocols.join(', ');
                              })()}
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
                              {job.messageCount ? job.messageCount.toLocaleString() : '0'}
                            </span>
                          </div>
                        </div>

                        <div className="ds-flex-row" style={{ gap: spacing[2], alignItems: 'center' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '6px',
                            backgroundColor: colors.purple[100],
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Cpu size={16} color={colors.purple[600]} />
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', color: colors.text.muted, display: 'block' }}>ECUs</span>
                            <span style={{ fontSize: '14px', fontWeight: 500, color: colors.text.primary }}>
                              {job._count?.ECUConfiguration || 0}
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
                            <AlertCircle size={16} color={colors.error[600]} />
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', color: colors.text.muted, display: 'block' }}>DTCs</span>
                            <span style={{ fontSize: '14px', fontWeight: 500, color: colors.text.primary }}>
                              {job._count?.DTC || 0}
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
                            <Database size={16} color={colors.success[600]} />
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', color: colors.text.muted, display: 'block' }}>DIDs</span>
                            <span style={{ fontSize: '14px', fontWeight: 500, color: colors.text.primary }}>
                              {job._count?.DataIdentifier || 0}
                            </span>
                          </div>
                        </div>

                        <div className="ds-flex-row" style={{ gap: spacing[2], alignItems: 'center' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '6px',
                            backgroundColor: colors.orange?.[100] || colors.warning[100],
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Clock size={16} color={colors.orange?.[600] || colors.warning[600]} />
                          </div>
                          <div>
                            <span style={{ fontSize: '12px', color: colors.text.muted, display: 'block' }}>Duration</span>
                            <span style={{ fontSize: '14px', fontWeight: 500, color: colors.text.primary }}>
                              {(() => {
                                const duration = job.duration || (job as any).metadata?.duration;
                                return duration ? formatDuration(duration) : 'N/A';
                              })()}
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
                          Created: {new Date(job.createdAt).toLocaleDateString()} at {new Date(job.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                        {(() => {
                          const traceFileName = (job as any).metadata?.traceFileName;
                          return traceFileName ? (
                            <span style={{ fontSize: '13px', color: colors.text.muted }}>
                              <File size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                              File: {traceFileName}
                            </span>
                          ) : null;
                        })()}
                        {(() => {
                          const startTime = (job as any).metadata?.startTime;
                          const endTime = (job as any).metadata?.endTime;
                          if (startTime && endTime) {
                            const sessionStart = new Date(startTime);
                            const sessionEnd = new Date(endTime);
                            return (
                              <span style={{ fontSize: '13px', color: colors.text.muted }}>
                                <Activity size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                                Session: {sessionStart.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})} - {sessionEnd.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                              </span>
                            );
                          }
                          return null;
                        })()}
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
                          {/* Show protocol badges */}
                          {(() => {
                            const protocols = (job as any).metadata?.ecuSummary?.map(ecu => ecu.protocol).filter(Boolean) || [];
                            const uniqueProtocols = [...new Set(protocols)];
                            return uniqueProtocols.map(protocol => (
                              <Badge key={protocol} variant="info" size="small">
                                <Network size={14} style={{ marginRight: spacing[1] }} />
                                {protocol}
                              </Badge>
                            ));
                          })()}
                          {/* Show routines if any */}
                          {job._count?.Routine > 0 && (
                            <Badge variant="purple" size="small">
                              <Settings size={14} style={{ marginRight: spacing[1] }} />
                              {job._count.Routine} Routines
                            </Badge>
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
                          onClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            processTrace(job.id)
                          }}
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
                        onClick={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                          reparseJob(job.id)
                        }}
                      >
                        Reparse
                      </Button>
                      <Link href={`/jobs/${job.id}/edit`}>
                        <Button
                          variant="secondary"
                          size="small"
                          icon={<Edit size={16} />}
                        >
                          Edit
                        </Button>
                      </Link>
                      <Button
                        variant="error"
                        size="small"
                        icon={<Trash2 size={16} />}
                        onClick={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                          deleteJob(job.id)
                        }}
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