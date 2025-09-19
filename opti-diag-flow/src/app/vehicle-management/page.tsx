'use client'

import { useState, useEffect } from 'react'
import PageLayout from '@/components/layout/page-layout'
import {
  Building,
  Car,
  Calendar,
  Plus,
  X,
  ChevronRight,
  ChevronDown,
  Edit,
  Trash2
} from 'lucide-react'

export default function VehicleManagementPage() {
  const [hierarchy, setHierarchy] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedOEMs, setExpandedOEMs] = useState<Set<string>>(new Set())
  const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set())

  // Form states
  const [showOEMForm, setShowOEMForm] = useState(false)
  const [showModelForm, setShowModelForm] = useState<string | null>(null)
  const [showYearForm, setShowYearForm] = useState<string | null>(null)

  const [oemForm, setOEMForm] = useState({ name: '', shortName: '' })
  const [modelForm, setModelForm] = useState({ name: '', platform: '' })
  const [yearForm, setYearForm] = useState({ year: new Date().getFullYear() })

  // Load hierarchy
  const loadHierarchy = async () => {
    setLoading(true)
    try {
      // Load OEMs with their models and model years
      const oemsRes = await fetch('/api/oems')
      const oems = await oemsRes.json()

      const modelsRes = await fetch('/api/models')
      const models = await modelsRes.json()

      const yearsRes = await fetch('/api/model-years')
      const years = await yearsRes.json()

      // Build hierarchy
      const hierarchyData = oems.map((oem: any) => ({
        ...oem,
        models: models
          .filter((model: any) => model.oemId === oem.id)
          .map((model: any) => ({
            ...model,
            years: years
              .filter((year: any) => year.modelId === model.id)
              .sort((a: any, b: any) => b.year - a.year)
          }))
      }))

      setHierarchy(hierarchyData)
    } catch (error) {
      console.error('Error loading hierarchy:', error)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadHierarchy()
  }, [])

  const toggleOEM = (oemId: string) => {
    const newExpanded = new Set(expandedOEMs)
    if (newExpanded.has(oemId)) {
      newExpanded.delete(oemId)
    } else {
      newExpanded.add(oemId)
    }
    setExpandedOEMs(newExpanded)
  }

  const toggleModel = (modelId: string) => {
    const newExpanded = new Set(expandedModels)
    if (newExpanded.has(modelId)) {
      newExpanded.delete(modelId)
    } else {
      newExpanded.add(modelId)
    }
    setExpandedModels(newExpanded)
  }

  const createOEM = async () => {
    try {
      const res = await fetch('/api/oems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(oemForm)
      })

      if (res.ok) {
        setOEMForm({ name: '', shortName: '' })
        setShowOEMForm(false)
        loadHierarchy()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to create OEM')
      }
    } catch (error) {
      alert('Failed to create OEM')
    }
  }

  const createModel = async (oemId: string) => {
    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...modelForm,
          oemId
        })
      })

      if (res.ok) {
        setModelForm({ name: '', platform: '' })
        setShowModelForm(null)
        loadHierarchy()
        // Expand the OEM to show the new model
        setExpandedOEMs(new Set([...expandedOEMs, oemId]))
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to create model')
      }
    } catch (error) {
      alert('Failed to create model')
    }
  }

  const createYear = async (modelId: string) => {
    try {
      const res = await fetch('/api/model-years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...yearForm,
          modelId
        })
      })

      if (res.ok) {
        setYearForm({ year: new Date().getFullYear() })
        setShowYearForm(null)
        loadHierarchy()
        // Expand the model to show the new year
        setExpandedModels(new Set([...expandedModels, modelId]))
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to create model year')
      }
    } catch (error) {
      alert('Failed to create model year')
    }
  }

  const deleteOEM = async (oemId: string, oemName: string) => {
    if (!confirm(`Are you sure you want to delete "${oemName}"? This action cannot be undone.`)) {
      return
    }

    try {
      const res = await fetch(`/api/oems/${oemId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        loadHierarchy()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to delete OEM')
      }
    } catch (error) {
      alert('Failed to delete OEM')
    }
  }

  const deleteModel = async (modelId: string, modelName: string) => {
    if (!confirm(`Are you sure you want to delete "${modelName}"? This action cannot be undone.`)) {
      return
    }

    try {
      const res = await fetch(`/api/models/${modelId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        loadHierarchy()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to delete model')
      }
    } catch (error) {
      alert('Failed to delete model')
    }
  }

  const deleteModelYear = async (yearId: string, year: number, modelName: string) => {
    if (!confirm(`Are you sure you want to delete ${year} ${modelName}? This action cannot be undone.`)) {
      return
    }

    try {
      const res = await fetch(`/api/model-years/${yearId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        loadHierarchy()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to delete model year')
      }
    } catch (error) {
      alert('Failed to delete model year')
    }
  }

  return (
    <PageLayout
      title="Vehicle Management"
      description="Manage your vehicle hierarchy: OEMs, Models, and Model Years"
    >
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '32px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Header with Add OEM button */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px'
        }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 8px 0' }}>
              Vehicle Hierarchy
            </h2>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
              Organize your vehicles by OEM → Model → Model Year
            </p>
          </div>
          <button
            onClick={() => setShowOEMForm(!showOEMForm)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              backgroundColor: showOEMForm ? '#ef4444' : '#3b82f6',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            {showOEMForm ? <X size={16} /> : <Plus size={16} />}
            {showOEMForm ? 'Cancel' : 'Add OEM'}
          </button>
        </div>

        {/* OEM Creation Form */}
        {showOEMForm && (
          <div style={{
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '24px',
            border: '1px solid #e5e7eb'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
              Create New OEM
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>
                  OEM Name *
                </label>
                <input
                  type="text"
                  value={oemForm.name}
                  onChange={(e) => setOEMForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., BMW Group"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>
                  Short Name
                </label>
                <input
                  type="text"
                  value={oemForm.shortName}
                  onChange={(e) => setOEMForm(prev => ({ ...prev, shortName: e.target.value }))}
                  placeholder="e.g., BMW"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => {
                  setShowOEMForm(false)
                  setOEMForm({ name: '', shortName: '' })
                }}
                style={{
                  padding: '10px 16px',
                  border: '1px solid #e5e7eb',
                  backgroundColor: '#ffffff',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={createOEM}
                disabled={!oemForm.name.trim()}
                style={{
                  padding: '10px 16px',
                  border: 'none',
                  backgroundColor: oemForm.name.trim() ? '#3b82f6' : '#9ca3af',
                  color: '#ffffff',
                  borderRadius: '6px',
                  fontSize: '14px',
                  cursor: oemForm.name.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                Create OEM
              </button>
            </div>
          </div>
        )}

        {/* Hierarchical Tree View */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>
        ) : hierarchy.length > 0 ? (
          <div style={{
            backgroundColor: '#fafafa',
            borderRadius: '8px',
            padding: '16px',
            border: '1px solid #e5e7eb'
          }}>
            {hierarchy.map(oem => (
              <div key={oem.id} style={{ marginBottom: '8px' }}>
                {/* OEM Level */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px',
                  backgroundColor: '#ffffff',
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb',
                  marginBottom: expandedOEMs.has(oem.id) ? '8px' : '0'
                }}>
                  <button
                    onClick={() => toggleOEM(oem.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      marginRight: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      color: '#6b7280'
                    }}
                  >
                    {expandedOEMs.has(oem.id) ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  </button>
                  <Building size={20} style={{ marginRight: '12px', color: '#3b82f6' }} />
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>
                      {oem.name}
                    </h3>
                    <p style={{ fontSize: '13px', color: '#6b7280', margin: '2px 0 0 0' }}>
                      {oem.shortName && `${oem.shortName} • `}{oem.models?.length || 0} models
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setShowModelForm(showModelForm === oem.id ? null : oem.id)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: showModelForm === oem.id ? '#ef4444' : '#10b981',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {showModelForm === oem.id ? <X size={14} /> : <Plus size={14} />}
                      {showModelForm === oem.id ? 'Cancel' : 'Add Model'}
                    </button>
                    <button
                      onClick={() => deleteOEM(oem.id, oem.name)}
                      disabled={oem.models?.length > 0}
                      style={{
                        padding: '6px',
                        backgroundColor: oem.models?.length > 0 ? '#f3f4f6' : '#fef2f2',
                        color: oem.models?.length > 0 ? '#9ca3af' : '#ef4444',
                        border: '1px solid',
                        borderColor: oem.models?.length > 0 ? '#e5e7eb' : '#fecaca',
                        borderRadius: '4px',
                        cursor: oem.models?.length > 0 ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title={oem.models?.length > 0 ? 'Delete all models first' : 'Delete OEM'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Model Creation Form */}
                {showModelForm === oem.id && (
                  <div style={{
                    marginLeft: '32px',
                    marginBottom: '8px',
                    padding: '16px',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db'
                  }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>
                      Add Model to {oem.name}
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <input
                        type="text"
                        value={modelForm.name}
                        onChange={(e) => setModelForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Model name (e.g., 3 Series)"
                        style={{
                          padding: '8px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                      />
                      <input
                        type="text"
                        value={modelForm.platform}
                        onChange={(e) => setModelForm(prev => ({ ...prev, platform: e.target.value }))}
                        placeholder="Platform (optional)"
                        style={{
                          padding: '8px 12px',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button
                        onClick={() => {
                          setShowModelForm(null)
                          setModelForm({ name: '', platform: '' })
                        }}
                        style={{
                          padding: '6px 12px',
                          border: '1px solid #d1d5db',
                          backgroundColor: '#ffffff',
                          borderRadius: '4px',
                          fontSize: '13px',
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => createModel(oem.id)}
                        disabled={!modelForm.name.trim()}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: modelForm.name.trim() ? '#3b82f6' : '#9ca3af',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '13px',
                          cursor: modelForm.name.trim() ? 'pointer' : 'not-allowed'
                        }}
                      >
                        Add Model
                      </button>
                    </div>
                  </div>
                )}

                {/* Models */}
                {expandedOEMs.has(oem.id) && oem.models?.map((model: any) => (
                  <div key={model.id} style={{ marginLeft: '32px', marginBottom: '6px' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '10px',
                      backgroundColor: '#f9fafb',
                      borderRadius: '6px',
                      border: '1px solid #e5e7eb',
                      marginBottom: expandedModels.has(model.id) ? '6px' : '0'
                    }}>
                      <button
                        onClick={() => toggleModel(model.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '4px',
                          marginRight: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          color: '#6b7280'
                        }}
                      >
                        {expandedModels.has(model.id) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </button>
                      <Car size={18} style={{ marginRight: '10px', color: '#10b981' }} />
                      <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: '15px', fontWeight: '600', margin: 0 }}>
                          {model.name}
                        </h4>
                        <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0 0' }}>
                          {model.platform && `Platform: ${model.platform} • `}{model.years?.length || 0} years
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => setShowYearForm(showYearForm === model.id ? null : model.id)}
                          style={{
                            padding: '4px 10px',
                            backgroundColor: showYearForm === model.id ? '#ef4444' : '#8b5cf6',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {showYearForm === model.id ? <X size={12} /> : <Plus size={12} />}
                          {showYearForm === model.id ? 'Cancel' : 'Add Year'}
                        </button>
                        <button
                          onClick={() => deleteModel(model.id, model.name)}
                          disabled={model.years?.length > 0}
                          style={{
                            padding: '4px 6px',
                            backgroundColor: model.years?.length > 0 ? '#f3f4f6' : '#fef2f2',
                            color: model.years?.length > 0 ? '#9ca3af' : '#ef4444',
                            border: '1px solid',
                            borderColor: model.years?.length > 0 ? '#e5e7eb' : '#fecaca',
                            borderRadius: '4px',
                            cursor: model.years?.length > 0 ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          title={model.years?.length > 0 ? 'Delete all years first' : 'Delete Model'}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Year Creation Form */}
                    {showYearForm === model.id && (
                      <div style={{
                        marginLeft: '32px',
                        marginBottom: '6px',
                        padding: '12px',
                        backgroundColor: '#f3f4f6',
                        borderRadius: '6px',
                        border: '1px solid #d1d5db'
                      }}>
                        <h5 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '10px' }}>
                          Add Year to {model.name}
                        </h5>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
                          <input
                            type="number"
                            value={yearForm.year}
                            onChange={(e) => setYearForm({ year: parseInt(e.target.value) || new Date().getFullYear() })}
                            min="1900"
                            max={new Date().getFullYear() + 2}
                            style={{
                              padding: '6px 10px',
                              border: '1px solid #d1d5db',
                              borderRadius: '4px',
                              fontSize: '13px',
                              width: '120px'
                            }}
                          />
                          <button
                            onClick={() => {
                              setShowYearForm(null)
                              setYearForm({ year: new Date().getFullYear() })
                            }}
                            style={{
                              padding: '6px 10px',
                              border: '1px solid #d1d5db',
                              backgroundColor: '#ffffff',
                              borderRadius: '4px',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => createYear(model.id)}
                            style={{
                              padding: '6px 10px',
                              backgroundColor: '#3b82f6',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            Add Year
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Model Years */}
                    {expandedModels.has(model.id) && model.years?.map((year: any) => (
                      <div key={year.id} style={{
                        marginLeft: '64px',
                        marginBottom: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '8px',
                        backgroundColor: '#ffffff',
                        borderRadius: '4px',
                        border: '1px solid #e5e7eb'
                      }}>
                        <Calendar size={16} style={{ marginRight: '8px', color: '#8b5cf6' }} />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '14px', fontWeight: '500' }}>
                            {year.year}
                          </span>
                          <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '8px' }}>
                            {year.Vehicle?.reduce((total, vehicle) => total + (vehicle._count?.DiagnosticJob || 0), 0) || 0} jobs
                          </span>
                        </div>
                        <button
                          onClick={() => deleteModelYear(year.id, year.year, model.name)}
                          disabled={(year.Vehicle?.reduce((total, vehicle) => total + (vehicle._count?.DiagnosticJob || 0), 0) || 0) > 0}
                          style={{
                            padding: '4px 6px',
                            backgroundColor: (year.Vehicle?.reduce((total, vehicle) => total + (vehicle._count?.DiagnosticJob || 0), 0) || 0) > 0 ? '#f3f4f6' : '#fef2f2',
                            color: (year.Vehicle?.reduce((total, vehicle) => total + (vehicle._count?.DiagnosticJob || 0), 0) || 0) > 0 ? '#9ca3af' : '#ef4444',
                            border: '1px solid',
                            borderColor: (year.Vehicle?.reduce((total, vehicle) => total + (vehicle._count?.DiagnosticJob || 0), 0) || 0) > 0 ? '#e5e7eb' : '#fecaca',
                            borderRadius: '4px',
                            cursor: (year.Vehicle?.reduce((total, vehicle) => total + (vehicle._count?.DiagnosticJob || 0), 0) || 0) > 0 ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          title={(year.Vehicle?.reduce((total, vehicle) => total + (vehicle._count?.DiagnosticJob || 0), 0) || 0) > 0 ? 'Cannot delete: Has diagnostic jobs' : 'Delete Year'}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <Building size={48} style={{ color: '#9ca3af', marginBottom: '16px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: '500', margin: '0 0 8px 0' }}>
              No Vehicle Hierarchy Yet
            </h3>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 16px 0' }}>
              Start by creating your first OEM to build your vehicle hierarchy
            </p>
            <button
              onClick={() => setShowOEMForm(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <Plus size={16} />
              Create First OEM
            </button>
          </div>
        )}
      </div>
    </PageLayout>
  )
}