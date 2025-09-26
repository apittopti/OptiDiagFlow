'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Button, Badge } from '@/components/design-system'
import { colors, spacing } from '@/lib/design-system/tokens'
import { inputStyles, combineStyles } from '@/lib/design-system/styles'
import {
  Save,
  X,
  Car,
  FileText,
  Calendar,
  Hash,
  Upload,
  File,
  CheckCircle,
  AlertCircle,
  Loader
} from 'lucide-react'

interface EditJobFormProps {
  jobId: string
  onClose: () => void
}

export function EditJobForm({ jobId, onClose }: EditJobFormProps) {
  const router = useRouter()

  const [job, setJob] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form fields
  const [jobName, setJobName] = useState('')
  const [procedureType, setProcedureType] = useState('')
  const [customProcedureType, setCustomProcedureType] = useState('')
  const [showCustomProcedureType, setShowCustomProcedureType] = useState(false)
  const [notes, setNotes] = useState('')

  // File upload state
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)

  useEffect(() => {
    fetchJob()
  }, [jobId])

  const fetchJob = async () => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`)
      if (response.ok) {
        const data = await response.json()
        setJob(data)
        // Initialize form fields
        setJobName(data.name || '')
        setProcedureType(data.procedureType || '')
        setNotes(data.description || '')

        // Check if it's a custom procedure type
        const standardTypes = [
          'Dynamic ADAS calibration',
          'Static ADAS calibration',
          'Programming & Coding',
          'Key programming',
          'New parts adaption',
          'Camera Calibration',
          'Front Camera Calibration',
          'Static Front Camera Calibration',
          'Dynamic Front Camera Calibration',
          'Dynamic Camera Calibration'
        ]
        if (data.procedureType && !standardTypes.includes(data.procedureType)) {
          setShowCustomProcedureType(true)
          setCustomProcedureType(data.procedureType)
          setProcedureType('custom')
        }
      } else {
        console.error('Failed to fetch job')
        onClose()
      }
    } catch (error) {
      console.error('Error fetching job:', error)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: jobName,
          procedureType: procedureType === 'custom' ? customProcedureType : procedureType,
          description: notes
        })
      })

      if (response.ok) {
        router.refresh()
        onClose()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to update job')
      }
    } catch (error) {
      console.error('Error updating job:', error)
      alert('Failed to update job')
    } finally {
      setSaving(false)
    }
  }

  // File upload handlers
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
    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      handleFiles(files)
    }
  }

  const handleFiles = async (files: File[]) => {
    setUploadingFile(true)

    for (const file of files) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('jobId', jobId)

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        })

        if (response.ok) {
          const result = await response.json()
          setUploadedFiles(prev => [...prev, {
            id: result.id || Math.random().toString(36).substr(2, 9),
            name: file.name,
            size: file.size,
            status: 'success'
          }])
        } else {
          setUploadedFiles(prev => [...prev, {
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            size: file.size,
            status: 'error',
            error: 'Upload failed'
          }])
        }
      } catch (error) {
        setUploadedFiles(prev => [...prev, {
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          size: file.size,
          status: 'error',
          error: 'Upload failed'
        }])
      }
    }

    setUploadingFile(false)
  }

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  if (loading) {
    return (
      <div className="ds-loading-container">
        <div className="ds-spinner-large" />
        <p className="ds-text-secondary">Loading job details...</p>
      </div>
    )
  }

  return (
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
          background: `linear-gradient(135deg, ${colors.warning[500]}, ${colors.warning[600]})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(251, 146, 60, 0.15)'
        }}>
          <FileText size={24} color="white" />
        </div>
        Edit Job #{jobId.slice(0, 8).toUpperCase()}
      </h2>

      {/* Vehicle Info Display - Read Only */}
      <Card variant="nested" style={{ marginBottom: spacing[6] }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: spacing[4],
          padding: spacing[4]
        }}>
          <div className="ds-flex-row" style={{ gap: spacing[2], alignItems: 'center' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: colors.primary[100],
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Car size={18} color={colors.primary[600]} />
            </div>
            <div>
              <span style={{ fontSize: '12px', color: colors.text.muted, display: 'block' }}>Vehicle</span>
              <span style={{ fontSize: '14px', fontWeight: 500, color: colors.text.primary }}>
                {job?.Vehicle?.ModelYear?.Model?.OEM?.name || 'Unknown'} {job?.Vehicle?.ModelYear?.Model?.name || 'Vehicle'} {job?.Vehicle?.ModelYear?.year || ''}
              </span>
            </div>
          </div>

          <div className="ds-flex-row" style={{ gap: spacing[2], alignItems: 'center' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: colors.success[100],
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Hash size={18} color={colors.success[600]} />
            </div>
            <div>
              <span style={{ fontSize: '12px', color: colors.text.muted, display: 'block' }}>VIN</span>
              <span style={{ fontSize: '14px', fontWeight: 500, color: colors.text.primary }}>
                {job?.Vehicle?.vin || 'No VIN'}
              </span>
            </div>
          </div>

          <div className="ds-flex-row" style={{ gap: spacing[2], alignItems: 'center' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: colors.warning[100],
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FileText size={18} color={colors.warning[600]} />
            </div>
            <div>
              <span style={{ fontSize: '12px', color: colors.text.muted, display: 'block' }}>Messages</span>
              <span style={{ fontSize: '14px', fontWeight: 500, color: colors.text.primary }}>
                {job?.messageCount || 0}
              </span>
            </div>
          </div>

          <div className="ds-flex-row" style={{ gap: spacing[2], alignItems: 'center' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: colors.purple[100],
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Calendar size={18} color={colors.purple[600]} />
            </div>
            <div>
              <span style={{ fontSize: '12px', color: colors.text.muted, display: 'block' }}>Created</span>
              <span style={{ fontSize: '14px', fontWeight: 500, color: colors.text.primary }}>
                {job?.createdAt ? new Date(job.createdAt).toLocaleDateString() : 'Unknown'}
              </span>
            </div>
          </div>
        </div>
      </Card>

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
              value={procedureType}
              onChange={(e) => {
                setProcedureType(e.target.value)
                setShowCustomProcedureType(e.target.value === 'custom')
                if (e.target.value !== 'custom') {
                  setCustomProcedureType('')
                }
              }}
              className="ds-select"
              style={combineStyles(inputStyles.base, { cursor: 'pointer' })}
            >
              {!procedureType && <option value="">Select diagnostic procedure type</option>}
              <option value="Dynamic ADAS calibration">Dynamic ADAS calibration</option>
              <option value="Static ADAS calibration">Static ADAS calibration</option>
              <option value="Programming & Coding">Programming & Coding</option>
              <option value="Key programming">Key programming</option>
              <option value="New parts adaption">New parts adaption</option>
              <option value="Camera Calibration">Camera Calibration</option>
              <option value="Front Camera Calibration">Front Camera Calibration</option>
              <option value="Static Front Camera Calibration">Static Front Camera Calibration</option>
              <option value="Dynamic Front Camera Calibration">Dynamic Front Camera Calibration</option>
              <option value="Dynamic Camera Calibration">Dynamic Camera Calibration</option>
              <option value="custom">+ Add Custom Job Type</option>
            </select>
          </div>
        </div>

        {showCustomProcedureType && (
          <div style={{ marginBottom: spacing[4] }}>
            <input
              type="text"
              value={customProcedureType}
              onChange={(e) => setCustomProcedureType(e.target.value)}
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
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes or comments (optional)"
            className="ds-input"
            rows={3}
            style={inputStyles.textarea}
          />
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
            Replace Trace File (Optional)
          </h3>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-upload')?.click()}
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
              id="file-upload"
              type="file"
              accept=".pcap,.pcapng,.log,.txt,.asc"
              onChange={handleFileInput}
              style={{ display: 'none' }}
            />
          </div>

          {/* Uploaded Files List */}
          {uploadedFiles.length > 0 && (
            <div>
              <h4 className="ds-heading-4" style={{
                marginBottom: spacing[3],
                fontSize: '16px',
                fontWeight: 600,
                color: colors.text.primary
              }}>
                New Trace File
              </h4>
              <div className="ds-stack" style={{ maxHeight: '300px', overflow: 'auto' }}>
                {uploadedFiles.map(file => (
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
            icon={<X size={16} />}
            onClick={onClose}
            disabled={saving}
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
            icon={<Save size={16} />}
            onClick={handleSave}
            disabled={saving || !jobName}
            style={{
              minWidth: '140px',
              padding: `${spacing[3]} ${spacing[5]}`,
              fontSize: '16px',
              fontWeight: 600
            }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

      </div>
    </div>
  )
}