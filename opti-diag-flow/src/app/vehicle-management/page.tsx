'use client'

import { useState, useEffect } from 'react'
import { PageLayout } from '@/components/layout/page-layout'
import { Card, Button, Badge, StatCard } from '@/components/design-system'
import { colors, spacing } from '@/lib/design-system/tokens'
import { inputStyles, combineStyles } from '@/lib/design-system/styles'
import {
  Building,
  Car,
  Calendar,
  Plus,
  X,
  ChevronRight,
  ChevronDown,
  Edit,
  Trash2,
  Package,
  Layers,
  FileText,
  Search,
  Filter
} from 'lucide-react'

export default function VehicleManagementPage() {
  const [hierarchy, setHierarchy] = useState<any[]>([])
  const [filteredHierarchy, setFilteredHierarchy] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedOEMs, setExpandedOEMs] = useState<Set<string>>(new Set())
  const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set())

  // Filter states
  const [selectedOEM, setSelectedOEM] = useState<string>('')
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)

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
      setFilteredHierarchy(hierarchyData)
    } catch (error) {
      console.error('Error loading hierarchy:', error)
    }
    setLoading(false)
  }

  // Apply filters
  useEffect(() => {
    let filtered = [...hierarchy]

    // Filter by OEM
    if (selectedOEM) {
      filtered = filtered.filter(oem => oem.id === selectedOEM)
    }

    // Filter by Model (requires OEM filter)
    if (selectedModel) {
      filtered = filtered.map(oem => ({
        ...oem,
        models: oem.models?.filter((model: any) => model.id === selectedModel)
      })).filter(oem => oem.models?.length > 0)
    }

    // Filter by Year (requires Model filter)
    if (selectedYear) {
      filtered = filtered.map(oem => ({
        ...oem,
        models: oem.models?.map((model: any) => ({
          ...model,
          years: model.years?.filter((year: any) => year.year === parseInt(selectedYear))
        })).filter((model: any) => model.years?.length > 0)
      })).filter(oem => oem.models?.length > 0)
    }

    // Search filter (searches OEM names, model names, and platforms)
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.map(oem => {
        // Check if OEM matches
        const oemMatches = oem.name.toLowerCase().includes(query) ||
                          oem.shortName?.toLowerCase().includes(query)

        // Filter models that match
        const filteredModels = oem.models?.filter((model: any) =>
          model.name.toLowerCase().includes(query) ||
          model.platform?.toLowerCase().includes(query) ||
          oemMatches // Include all models if OEM matches
        )

        // Only include OEM if it matches or has matching models
        if (oemMatches || filteredModels?.length > 0) {
          return {
            ...oem,
            models: oemMatches ? oem.models : filteredModels
          }
        }
        return null
      }).filter(Boolean)
    }

    setFilteredHierarchy(filtered)

    // Auto-expand filtered items
    if (selectedOEM || searchQuery) {
      const oemIds = filtered.map(oem => oem.id)
      setExpandedOEMs(new Set(oemIds))

      if (selectedModel || searchQuery) {
        const modelIds = filtered.flatMap(oem =>
          oem.models?.map((model: any) => model.id) || []
        )
        setExpandedModels(new Set(modelIds))
      }
    }
  }, [hierarchy, selectedOEM, selectedModel, selectedYear, searchQuery])

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
      <div className="ds-container">
        {/* Stats */}
        <div className="ds-grid-3" style={{ marginBottom: spacing[8] }}>
          <StatCard
            icon={<Building size={20} style={{ color: colors.primary[600] }} />}
            value={hierarchy.length}
            label="OEMs"
            variant="primary"
          />
          <StatCard
            icon={<Car size={20} style={{ color: colors.success[600] }} />}
            value={(() => {
              const uniqueModels = new Set();
              hierarchy.forEach(oem => {
                oem.models?.forEach((model: any) => {
                  uniqueModels.add(model.name);
                });
              });
              return uniqueModels.size;
            })()}
            label="Models"
            variant="success"
          />
          <StatCard
            icon={<Calendar size={20} style={{ color: colors.purple[600] }} />}
            value={(() => {
              const uniqueYears = new Set();
              hierarchy.forEach(oem => {
                oem.models?.forEach((model: any) => {
                  model.years?.forEach((year: any) => {
                    uniqueYears.add(year.year);
                  });
                });
              });
              return uniqueYears.size;
            })()}
            label="Years"
            variant="purple"
          />
        </div>

        <Card>
          {/* Add OEM button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: spacing[4] }}>
            <Button
              variant={showOEMForm ? 'error' : 'primary'}
              icon={showOEMForm ? <X size={16} /> : <Plus size={16} />}
              onClick={() => setShowOEMForm(!showOEMForm)}
            >
              {showOEMForm ? 'Cancel' : 'Add OEM'}
            </Button>
          </div>

          {/* Search and Filters */}
          <Card style={{ marginBottom: spacing[6] }}>
            <div style={{
              display: 'flex',
              gap: spacing[3],
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{
                position: 'relative',
                width: '350px',
                maxWidth: '100%'
              }}>
                <Search size={16} className="ds-search-icon" />
                <input
                  type="text"
                  placeholder="Search OEM, Model, or Platform..."
                  className="ds-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <Button
                variant="secondary"
                icon={<Filter size={16} />}
                onClick={() => setShowFilters(!showFilters)}
                style={{ flexShrink: 0 }}
              >
                Filters {(selectedOEM || selectedModel || selectedYear) && (
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
                  value={selectedOEM}
                  onChange={(e) => {
                    setSelectedOEM(e.target.value)
                    setSelectedModel('') // Reset model when OEM changes
                    setSelectedYear('')  // Reset year when OEM changes
                  }}
                  style={combineStyles(inputStyles.base, { cursor: 'pointer' })}
                >
                  <option value="">All OEMs</option>
                  {hierarchy.map(oem => (
                    <option key={oem.id} value={oem.id}>
                      {oem.name} {oem.shortName && `(${oem.shortName})`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="ds-label" style={{ fontSize: '12px', marginBottom: spacing[1] }}>
                  Model
                </label>
                <select
                  className="ds-select"
                  value={selectedModel}
                  onChange={(e) => {
                    setSelectedModel(e.target.value)
                    setSelectedYear('')
                  }}
                  style={combineStyles(inputStyles.base, { cursor: 'pointer' })}
                  disabled={!selectedOEM}
                >
                  <option value="">All Models</option>
                  {selectedOEM && hierarchy
                    .find(oem => oem.id === selectedOEM)
                    ?.models?.map((model: any) => (
                      <option key={model.id} value={model.id}>
                        {model.name} {model.platform && `(${model.platform})`}
                      </option>
                    ))
                  }
                </select>
              </div>

              <div>
                <label className="ds-label" style={{ fontSize: '12px', marginBottom: spacing[1] }}>
                  Year
                </label>
                <select
                  className="ds-select"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  style={combineStyles(inputStyles.base, { cursor: 'pointer' })}
                  disabled={!selectedModel}
                >
                  <option value="">All Years</option>
                  {selectedModel && hierarchy
                    .find(oem => oem.id === selectedOEM)
                    ?.models?.find((model: any) => model.id === selectedModel)
                    ?.years?.map((year: any) => (
                      <option key={year.id} value={year.year}>
                        {year.year}
                      </option>
                    ))
                  }
                </select>
              </div>

              {/* Clear Filters */}
              {(selectedOEM || selectedModel || selectedYear) && (
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => {
                      setSelectedOEM('')
                      setSelectedModel('')
                      setSelectedYear('')
                    }}
                    style={{ width: '100%' }}
                  >
                    Clear All Filters
                  </Button>
                </div>
              )}
              </div>
            )}
          </Card>

          {/* OEM Creation Form */}
          {showOEMForm && (
            <Card variant="nested" style={{ marginBottom: spacing[6] }}>
              <div style={{ padding: spacing[4] }}>
                <h3 className="ds-heading-3">Create New OEM</h3>
                <div className="ds-grid-2" style={{ marginBottom: spacing[4] }}>
                  <div className="ds-form-group">
                    <label className="ds-label">OEM Name *</label>
                    <input
                      type="text"
                      value={oemForm.name}
                      onChange={(e) => setOEMForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., BMW Group"
                      className="ds-input"
                    />
                  </div>
                  <div className="ds-form-group">
                    <label className="ds-label">Short Name</label>
                    <input
                      type="text"
                      value={oemForm.shortName}
                      onChange={(e) => setOEMForm(prev => ({ ...prev, shortName: e.target.value }))}
                      placeholder="e.g., BMW"
                      className="ds-input"
                    />
                  </div>
                </div>
                <div className="ds-flex-row" style={{ justifyContent: 'flex-end', gap: spacing[3] }}>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowOEMForm(false)
                      setOEMForm({ name: '', shortName: '' })
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={createOEM}
                    disabled={!oemForm.name.trim()}
                  >
                    Create OEM
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Hierarchical Tree View */}
          {loading ? (
            <div className="ds-loading-container">
              <div className="ds-spinner-large" />
              <p className="ds-text-secondary">Loading vehicle hierarchy...</p>
            </div>
          ) : hierarchy.length > 0 ? (
            filteredHierarchy.length > 0 ? (
              <Card variant="nested">
                <div style={{ padding: spacing[3] }}>
                  {filteredHierarchy.map(oem => (
                  <div key={oem.id} style={{ marginBottom: spacing[4] }}>
                    {/* OEM Level */}
                    <Card
                      variant="hover"
                      style={{
                        background: 'linear-gradient(135deg, white 0%, #f8fafc 100%)',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: `${spacing[3]} ${spacing[4]}`,
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        cursor: 'pointer',
                        position: 'relative',
                        overflow: 'hidden',
                        marginBottom: expandedOEMs.has(oem.id) ? spacing[2] : 0
                      }}
                      onMouseEnter={(e) => {
                        const target = e.currentTarget as HTMLDivElement
                        target.style.transform = 'translateY(-2px) scale(1.005)'
                        target.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                      }}
                      onMouseLeave={(e) => {
                        const target = e.currentTarget as HTMLDivElement
                        target.style.transform = 'translateY(0) scale(1)'
                        target.style.boxShadow = 'none'
                      }}
                    >
                      {/* Gradient accent bar */}
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '4px',
                        background: 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)',
                        borderRadius: '12px 12px 0 0'
                      }} />

                      <div className="ds-flex-between" style={{ alignItems: 'center' }}>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: spacing[4] }}>
                          {/* OEM Header */}
                          <div className="ds-flex-row" style={{ gap: spacing[2], alignItems: 'center' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleOEM(oem.id)
                              }}
                              className="ds-button ds-button-ghost ds-button-sm"
                              style={{ padding: spacing[1] }}
                            >
                              {expandedOEMs.has(oem.id) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                            </button>
                            <h3 style={{
                              fontSize: '16px',
                              fontWeight: 600,
                              color: colors.text.primary,
                              margin: 0
                            }}>
                              {oem.name}
                            </h3>
                            {oem.shortName && (
                              <Badge variant="secondary" size="small" style={{
                                fontWeight: 500,
                                padding: '2px 8px'
                              }}>
                                {oem.shortName}
                              </Badge>
                            )}
                          </div>

                          {/* Data Row */}
                          <div style={{
                            display: 'flex',
                            gap: spacing[4],
                            alignItems: 'center'
                          }}>
                            <div className="ds-flex-row" style={{ gap: spacing[1], alignItems: 'center' }}>
                              <Car size={16} color={colors.primary[600]} />
                              <span style={{ fontSize: '14px', color: colors.text.secondary }}>
                                {oem.models?.length || 0} models
                              </span>
                            </div>

                            <div className="ds-flex-row" style={{ gap: spacing[1], alignItems: 'center' }}>
                              <Layers size={16} color={colors.warning[600]} />
                              <span style={{ fontSize: '14px', color: colors.text.secondary }}>
                                {oem.models?.reduce((total, model) => total + (model.years?.length || 0), 0) || 0} variants
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="ds-flex-row" style={{ gap: spacing[2] }}>
                          <Button
                            variant={showModelForm === oem.id ? 'error' : 'success'}
                            icon={showModelForm === oem.id ? <X size={16} /> : <Plus size={16} />}
                            onClick={(e) => {
                              e.stopPropagation()
                              setShowModelForm(showModelForm === oem.id ? null : oem.id)
                            }}
                          >
                            {showModelForm === oem.id ? 'Cancel' : 'Add Model'}
                          </Button>
                          <Button
                            variant="ghost"
                            icon={<Trash2 size={18} />}
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteOEM(oem.id, oem.name)
                            }}
                            disabled={oem.models?.length > 0}
                            style={{
                              color: oem.models?.length > 0 ? colors.gray[400] : colors.error[500],
                              cursor: oem.models?.length > 0 ? 'not-allowed' : 'pointer'
                            }}
                            title={oem.models?.length > 0 ? 'Delete all models first' : 'Delete OEM'}
                          />
                        </div>
                      </div>
                    </Card>

                    {/* Model Creation Form */}
                    {showModelForm === oem.id && (
                      <Card variant="nested" style={{ marginLeft: spacing[8], marginBottom: spacing[2] }}>
                        <div style={{ padding: spacing[3] }}>
                          <h4 className="ds-heading-4" style={{ marginBottom: spacing[3] }}>
                            Add Model to {oem.name}
                          </h4>
                          <div className="ds-grid-2" style={{ marginBottom: spacing[3] }}>
                            <input
                              type="text"
                              value={modelForm.name}
                              onChange={(e) => setModelForm(prev => ({ ...prev, name: e.target.value }))}
                              placeholder="Model name (e.g., 3 Series)"
                              className="ds-input"
                            />
                            <input
                              type="text"
                              value={modelForm.platform}
                              onChange={(e) => setModelForm(prev => ({ ...prev, platform: e.target.value }))}
                              placeholder="Platform (optional)"
                              className="ds-input"
                            />
                          </div>
                          <div className="ds-flex-row" style={{ justifyContent: 'flex-end', gap: spacing[2] }}>
                            <Button
                              variant="secondary"
                              size="small"
                              onClick={() => {
                                setShowModelForm(null)
                                setModelForm({ name: '', platform: '' })
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="primary"
                              size="small"
                              onClick={() => createModel(oem.id)}
                              disabled={!modelForm.name.trim()}
                            >
                              Add Model
                            </Button>
                          </div>
                        </div>
                      </Card>
                    )}

                    {/* Models */}
                    {expandedOEMs.has(oem.id) && oem.models?.map((model: any) => (
                      <div key={model.id} style={{ marginLeft: spacing[8], marginBottom: spacing[2] }}>
                        <Card style={{
                          backgroundColor: colors.gray[50],
                          marginBottom: expandedModels.has(model.id) ? spacing[2] : 0,
                          padding: `${spacing[2]} ${spacing[3]}`
                        }}>
                          <div className="ds-flex-between" style={{ alignItems: 'center' }}>
                            <div className="ds-flex-row" style={{ gap: spacing[2], alignItems: 'center' }}>
                              <button
                                onClick={() => toggleModel(model.id)}
                                className="ds-button ds-button-ghost ds-button-sm"
                                style={{ padding: spacing[1] }}
                              >
                                {expandedModels.has(model.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              </button>
                              <Car size={16} style={{ color: colors.success[500] }} />
                              <h4 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>
                                {model.name}
                              </h4>
                              {model.platform && (
                                <Badge variant="secondary" size="small">
                                  {model.platform}
                                </Badge>
                              )}
                              <span style={{ fontSize: '13px', color: colors.text.secondary }}>
                                {model.years?.length || 0} years
                              </span>
                            </div>
                            <div className="ds-flex-row" style={{ gap: spacing[2] }}>
                              <Button
                                variant={showYearForm === model.id ? 'error' : 'purple'}
                                icon={showYearForm === model.id ? <X size={16} /> : <Plus size={16} />}
                                onClick={() => setShowYearForm(showYearForm === model.id ? null : model.id)}
                              >
                                {showYearForm === model.id ? 'Cancel' : 'Add Year'}
                              </Button>
                              <Button
                                variant="ghost"
                                icon={<Trash2 size={16} />}
                                onClick={() => deleteModel(model.id, model.name)}
                                disabled={model.years?.length > 0}
                                style={{
                                  color: model.years?.length > 0 ? colors.gray[400] : colors.error[500],
                                  cursor: model.years?.length > 0 ? 'not-allowed' : 'pointer'
                                }}
                                title={model.years?.length > 0 ? 'Delete all years first' : 'Delete Model'}
                              />
                            </div>
                          </div>
                        </Card>

                        {/* Year Creation Form */}
                        {showYearForm === model.id && (
                          <Card variant="nested" style={{ marginLeft: spacing[8], marginBottom: spacing[2] }}>
                            <div style={{ padding: spacing[3] }}>
                              <h5 style={{ fontSize: '13px', fontWeight: 600, marginBottom: spacing[2] }}>
                                Add Year to {model.name}
                              </h5>
                              <div className="ds-flex-row" style={{ gap: spacing[2], marginBottom: spacing[2] }}>
                                <input
                                  type="number"
                                  value={yearForm.year}
                                  onChange={(e) => setYearForm({ year: parseInt(e.target.value) || new Date().getFullYear() })}
                                  min="1900"
                                  max={new Date().getFullYear() + 2}
                                  className="ds-input"
                                  style={{ width: '120px' }}
                                />
                                <Button
                                  variant="secondary"
                                  size="small"
                                  onClick={() => {
                                    setShowYearForm(null)
                                    setYearForm({ year: new Date().getFullYear() })
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  variant="primary"
                                  size="small"
                                  onClick={() => createYear(model.id)}
                                >
                                  Add Year
                                </Button>
                              </div>
                            </div>
                          </Card>
                        )}

                        {/* Model Years */}
                        {expandedModels.has(model.id) && model.years?.map((year: any) => (
                          <div key={year.id} style={{ marginLeft: spacing[16] }}>
                            <Card style={{
                              backgroundColor: colors.background.primary,
                              marginBottom: spacing[1],
                              padding: `${spacing[2]} ${spacing[3]}`
                            }}>
                              <div className="ds-flex-between" style={{ alignItems: 'center' }}>
                                <div className="ds-flex-row" style={{ gap: spacing[2], alignItems: 'center' }}>
                                  <Calendar size={14} style={{ color: colors.purple[500] }} />
                                  <span style={{ fontSize: '13px', fontWeight: 500 }}>
                                    {year.year}
                                  </span>
                                  <Badge variant="secondary" size="small">
                                    {year.Vehicle?.reduce((total, vehicle) => total + (vehicle._count?.DiagnosticJob || 0), 0) || 0} jobs
                                  </Badge>
                                </div>
                                <Button
                                  variant="ghost"
                                  icon={<Trash2 size={16} />}
                                  onClick={() => deleteModelYear(year.id, year.year, model.name)}
                                  disabled={(year.Vehicle?.reduce((total, vehicle) => total + (vehicle._count?.DiagnosticJob || 0), 0) || 0) > 0}
                                  style={{
                                    color: (year.Vehicle?.reduce((total, vehicle) => total + (vehicle._count?.DiagnosticJob || 0), 0) || 0) > 0 ? colors.gray[400] : colors.error[500],
                                    cursor: (year.Vehicle?.reduce((total, vehicle) => total + (vehicle._count?.DiagnosticJob || 0), 0) || 0) > 0 ? 'not-allowed' : 'pointer'
                                  }}
                                  title={(year.Vehicle?.reduce((total, vehicle) => total + (vehicle._count?.DiagnosticJob || 0), 0) || 0) > 0 ? 'Cannot delete: Has diagnostic jobs' : 'Delete Year'}
                                />
                              </div>
                            </Card>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  ))}
                </div>
              </Card>
            ) : (
              <div className="ds-empty-state">
                <Building size={48} style={{ color: colors.gray[400] }} />
                <h3 className="ds-heading-3">No Results Found</h3>
                <p>Try adjusting your filters or search criteria</p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSelectedOEM('')
                    setSelectedModel('')
                    setSelectedYear('')
                    setSearchQuery('')
                    setShowOnlyWithJobs(false)
                  }}
                  style={{ marginTop: spacing[4] }}
                >
                  Clear All Filters
                </Button>
              </div>
            )
          ) : (
            <div className="ds-empty-state">
              <Building size={48} style={{ color: colors.gray[400] }} />
              <h3 className="ds-heading-3">No Vehicle Hierarchy Yet</h3>
              <p>Start by creating your first OEM to build your vehicle hierarchy</p>
              <Button
                variant="primary"
                icon={<Plus size={16} />}
                onClick={() => setShowOEMForm(true)}
                style={{ marginTop: spacing[4] }}
              >
                Create First OEM
              </Button>
            </div>
          )}
        </Card>
      </div>
    </PageLayout>
  )
}