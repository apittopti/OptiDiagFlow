'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { PageLayout } from '@/components/layout/page-layout'
import { Card, Button, Badge } from '@/components/design-system'
import { colors, spacing } from '@/lib/design-system/tokens'
import {
  ArrowLeft,
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
import Link from 'next/link'

export default function EditJobPage() {
  const router = useRouter()
  const params = useParams()
  const jobId = params.id as string

  const [job, setJob] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form fields
  const [jobName, setJobName] = useState('')
  const [procedureType, setProcedureType] = useState('')
  const [status, setStatus] = useState('')
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
        setStatus(data.status || 'pending')
        setNotes(data.description || '')
      } else {
        console.error('Failed to fetch job')
        router.push('/jobs')
      }
    } catch (error) {
      console.error('Error fetching job:', error)
      router.push('/jobs')
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
          procedureType,
          status,
          description: notes
        })
      })

      if (response.ok) {
        router.push(`/jobs/${jobId}`)
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

  const handleCancel = () => {
    router.push(`/jobs/${jobId}`)
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
      <PageLayout title="Edit Job" description="Modify job details">
        <div className="ds-container">
          <Card>
            <div className="ds-loading-container">
              <div className="ds-spinner-large" />
              <p className="ds-text-secondary">Loading job details...</p>
            </div>
          </Card>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Edit Job"
      description="Modify job details and settings"
    >
      <div className="ds-container">
        {/* Back Button */}
        <Link href={`/jobs/${jobId}`}>
          <Button
            variant="ghost"
            icon={<ArrowLeft size={16} />}
            style={{ marginBottom: spacing[4] }}
          >
            Back to Job Details
          </Button>
        </Link>

        {/* Edit Form */}
        <Card>
          <div style={{ padding: spacing[6] }}>
            <h2 className="ds-heading-2" style={{ marginBottom: spacing[6] }}>
              Edit Job #{jobId.slice(0, 8)}
            </h2>

            {/* Job Info Display */}
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
                      {job?.Vehicle?.ModelYear?.Model?.name || 'Unknown'} {job?.Vehicle?.ModelYear?.year || ''}
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

            {/* Edit Form Fields */}
            <div style={{ marginBottom: spacing[6] }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                columnGap: '40px',
                marginBottom: spacing[4]
              }}>
                <div className="ds-form-group">
                  <label className="ds-label" style={{ marginBottom: spacing[2] }}>Job Name</label>
                  <input
                    type="text"
                    value={jobName}
                    onChange={(e) => setJobName(e.target.value)}
                    placeholder="Enter job name"
                    className="ds-input"
                    style={{ height: '38px', boxSizing: 'border-box' }}
                  />
                </div>

                <div className="ds-form-group">
                  <label className="ds-label" style={{ marginBottom: spacing[2] }}>Procedure Type</label>
                  <input
                    type="text"
                    value={procedureType}
                    onChange={(e) => setProcedureType(e.target.value)}
                    placeholder="e.g., ADAS Calibration"
                    className="ds-input"
                    style={{ height: '38px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div className="ds-form-group" style={{ marginBottom: spacing[4] }}>
                <label className="ds-label" style={{ marginBottom: spacing[2] }}>Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="ds-input"
                  style={{ maxWidth: '300px', height: '38px', boxSizing: 'border-box' }}
                >
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              <div className="ds-form-group">
                <label className="ds-label" style={{ marginBottom: spacing[2] }}>Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes or comments"
                  className="ds-input"
                  rows={6}
                  style={{
                    resize: 'vertical',
                    minHeight: '120px',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
            </div>

            {/* File Upload Section */}
            <div style={{ marginBottom: spacing[6] }}>
              <label className="ds-label" style={{ marginBottom: spacing[2] }}>
                Upload Additional Files
              </label>

              {/* Drag and Drop Area */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                  border: `2px dashed ${isDragging ? colors.primary[400] : colors.border.default}`,
                  borderRadius: '12px',
                  padding: spacing[8],
                  textAlign: 'center',
                  backgroundColor: isDragging ? colors.primary[50] : colors.background.secondary,
                  transition: 'all 0.2s',
                  marginBottom: spacing[4]
                }}
              >
                <Upload size={48} color={colors.gray[400]} style={{ margin: '0 auto', marginBottom: spacing[3] }} />
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: spacing[2] }}>
                  Drop trace files here or click to browse
                </h3>
                <p style={{ fontSize: '14px', color: colors.text.secondary, marginBottom: spacing[4] }}>
                  Supports .txt, .log, .odx, .odx-d, .odx-v files
                </p>
                <input
                  type="file"
                  multiple
                  accept=".txt,.log,.odx,.odx-d,.odx-v"
                  onChange={handleFileInput}
                  style={{ display: 'none' }}
                  id="file-upload"
                />
                <label htmlFor="file-upload">
                  <Button variant="primary" icon={<Upload size={16} />}>
                    Select Files
                  </Button>
                </label>
              </div>

              {/* Uploaded Files List */}
              {uploadedFiles.length > 0 && (
                <div style={{ marginTop: spacing[4] }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: spacing[3] }}>
                    Uploaded Files
                  </h4>
                  <div className="ds-stack" style={{ gap: spacing[2] }}>
                    {uploadedFiles.map((file) => (
                      <Card key={file.id} variant="nested" style={{ padding: spacing[3] }}>
                        <div className="ds-flex-between" style={{ alignItems: 'center' }}>
                          <div className="ds-flex-row" style={{ gap: spacing[3], alignItems: 'center' }}>
                            {file.status === 'success' ? (
                              <CheckCircle size={20} color={colors.success[500]} />
                            ) : file.status === 'error' ? (
                              <AlertCircle size={20} color={colors.error[500]} />
                            ) : (
                              <Loader size={20} className="ds-spinner" />
                            )}
                            <File size={20} color={colors.gray[500]} />
                            <div>
                              <p style={{ fontSize: '14px', fontWeight: 500, margin: 0 }}>
                                {file.name}
                              </p>
                              <p style={{ fontSize: '12px', color: colors.text.secondary, margin: 0 }}>
                                {formatFileSize(file.size)}
                                {file.error && <span style={{ color: colors.error[500] }}> - {file.error}</span>}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            icon={<X size={16} />}
                            onClick={() => removeFile(file.id)}
                            disabled={uploadingFile}
                          />
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="ds-flex-row" style={{
              gap: spacing[3],
              justifyContent: 'flex-end',
              paddingTop: spacing[4],
              borderTop: `1px solid ${colors.border.light}`
            }}>
              <Button
                variant="secondary"
                icon={<X size={16} />}
                onClick={handleCancel}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                icon={<Save size={16} />}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </PageLayout>
  )
}