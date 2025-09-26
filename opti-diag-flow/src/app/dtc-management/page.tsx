'use client'

import { useEffect, useState, useCallback } from 'react'
import { PageLayout } from '@/components/layout/page-layout'
import { Card, Button, Badge, StatCard } from '@/components/design-system'
import { colors, spacing } from '@/lib/design-system/tokens'
import { inputStyles, buttonStyles, combineStyles, tableStyles } from '@/lib/design-system/styles'
import {
  Search,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  Filter,
  Download,
  Upload,
  ChevronDown,
  X,
  Save,
  Shield,
  Car,
  Cpu,
  Hash,
  FileText,
  Activity,
  Settings,
  Stethoscope,
  Wrench,
  Database,
  Globe,
  Network
} from 'lucide-react'

interface DTCDefinition {
  id: string
  code: string
  name: string
  description?: string
  severity: 'CRITICAL' | 'WARNING' | 'INFORMATIONAL'
  category?: string
  system?: string
  oemId: string
  modelId: string
  modelYearId: string
  ecuAddress?: string
  symptoms?: string
  causes?: string
  diagnosticSteps?: string
  repairActions?: string
  isVerified: boolean
  createdAt: string
  updatedAt: string
  oem?: {
    id: string
    name: string
  }
  model?: {
    id: string
    name: string
  }
  modelYear?: {
    id: string
    year: number
  }
  _count?: {
    auditLogs: number
  }
}

interface OBDIIDTCDefinition {
  id: string
  code: string
  name: string
  description?: string
  system: string
  isGeneric: boolean
  category?: string
  symptoms?: string
  causes?: string
  diagnosticSteps?: string
  repairActions?: string
  createdAt: string
  updatedAt: string
}

interface VehicleHierarchy {
  id: string
  name: string
  models: {
    id: string
    name: string
    modelYears: {
      id: string
      year: number
    }[]
  }[]
}

export default function DTCManagementPage() {
  const [activeTab, setActiveTab] = useState<'uds' | 'obdii'>('uds')
  const [dtcs, setDtcs] = useState<DTCDefinition[]>([])
  const [obdiiDtcs, setObdiiDtcs] = useState<OBDIIDTCDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingDtc, setEditingDtc] = useState<DTCDefinition | null>(null)
  const [editingObdiiDtc, setEditingObdiiDtc] = useState<OBDIIDTCDefinition | null>(null)

  // Filter states
  const [filterSeverity, setFilterSeverity] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterVerified, setFilterVerified] = useState('')
  const [filterOEM, setFilterOEM] = useState('')
  const [filterModel, setFilterModel] = useState('')
  const [filterYear, setFilterYear] = useState('')
  const [filterSystem, setFilterSystem] = useState('')
  const [filterGeneric, setFilterGeneric] = useState('')

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalDTCs, setTotalDTCs] = useState(0)
  const [pageSize, setPageSize] = useState(50)

  // Form states
  const [formCode, setFormCode] = useState('')
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formSeverity, setFormSeverity] = useState<'CRITICAL' | 'WARNING' | 'INFORMATIONAL'>('INFORMATIONAL')
  const [formCategory, setFormCategory] = useState('')
  const [formSystem, setFormSystem] = useState('Powertrain')
  const [formIsGeneric, setFormIsGeneric] = useState(true)
  const [formOEM, setFormOEM] = useState('')
  const [formModel, setFormModel] = useState('')
  const [formYear, setFormYear] = useState('')
  const [formEcuAddress, setFormEcuAddress] = useState('')
  const [formSymptoms, setFormSymptoms] = useState('')
  const [formCauses, setFormCauses] = useState('')
  const [formDiagnosticSteps, setFormDiagnosticSteps] = useState('')
  const [formRepairActions, setFormRepairActions] = useState('')

  // Vehicle hierarchy data
  const [oems, setOEMs] = useState<VehicleHierarchy[]>([])
  const [selectedOEM, setSelectedOEM] = useState<VehicleHierarchy | null>(null)

  // Statistics
  const [stats, setStats] = useState({
    total: 0,
    critical: 0,
    warning: 0,
    informational: 0,
    verified: 0,
    totalObdii: 0,
    genericObdii: 0,
    manufacturerObdii: 0,
    powertrain: 0,
    body: 0,
    chassis: 0,
    network: 0
  })

  // Fetch vehicle hierarchy
  const fetchVehicleHierarchy = useCallback(async () => {
    try {
      const response = await fetch('/api/vehicles/hierarchy')
      if (!response.ok) throw new Error('Failed to fetch vehicle hierarchy')
      const data = await response.json()
      setOEMs(data)
    } catch (error) {
      console.error('Error fetching vehicle hierarchy:', error)
    }
  }, [])

  // Fetch UDS DTCs
  const fetchDTCs = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      if (filterSeverity) params.append('severity', filterSeverity)
      if (filterCategory) params.append('category', filterCategory)
      if (filterVerified) params.append('verified', filterVerified)
      if (filterOEM) params.append('oemId', filterOEM)
      if (filterModel) params.append('modelId', filterModel)
      if (filterYear) params.append('modelYearId', filterYear)

      const response = await fetch(`/api/dtc-definitions?${params}`)
      if (!response.ok) throw new Error('Failed to fetch DTCs')

      const data = await response.json()
      setDtcs(data.dtcs || [])

      // Update stats for UDS
      const stats = {
        total: data.total || 0,
        critical: 0,
        warning: 0,
        informational: 0,
        verified: 0,
        totalObdii: 0,
        genericObdii: 0,
        manufacturerObdii: 0
      }

      data.dtcs?.forEach((dtc: DTCDefinition) => {
        if (dtc.severity === 'CRITICAL') stats.critical++
        if (dtc.severity === 'WARNING') stats.warning++
        if (dtc.severity === 'INFORMATIONAL') stats.informational++
        if (dtc.isVerified) stats.verified++
      })

      setStats(prev => ({ ...prev, ...stats }))
    } catch (error) {
      console.error('Error fetching DTCs:', error)
    } finally {
      setLoading(false)
    }
  }, [searchTerm, filterSeverity, filterCategory, filterVerified, filterOEM, filterModel, filterYear])

  // Fetch OBD-II DTCs
  const fetchObdiiDTCs = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      if (filterSystem) params.append('system', filterSystem)
      if (filterCategory) params.append('category', filterCategory)
      if (filterGeneric) params.append('generic', filterGeneric)

      // Add pagination parameters
      const offset = (currentPage - 1) * pageSize
      params.append('limit', pageSize.toString())
      params.append('offset', offset.toString())

      const response = await fetch(`/api/obdii-dtcs?${params}`)
      if (!response.ok) throw new Error('Failed to fetch OBD-II DTCs')

      const data = await response.json()
      setObdiiDtcs(data.dtcs || [])

      // Update pagination info
      setTotalDTCs(data.total || 0)
      setTotalPages(Math.ceil((data.total || 0) / pageSize))

      // Fetch total stats separately (without filters for accurate totals)
      const statsResponse = await fetch('/api/obdii-dtcs/stats')
      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        // Find system counts
        const systemStats = {
          powertrain: 0,
          body: 0,
          chassis: 0,
          network: 0
        }
        statsData.systems?.forEach((sys: any) => {
          if (sys.system === 'Powertrain') systemStats.powertrain = sys.count
          else if (sys.system === 'Body') systemStats.body = sys.count
          else if (sys.system === 'Chassis') systemStats.chassis = sys.count
          else if (sys.system === 'Network') systemStats.network = sys.count
        })

        setStats(prev => ({
          ...prev,
          totalObdii: statsData.total || 0,
          genericObdii: statsData.generic || 0,
          manufacturerObdii: statsData.manufacturer || 0,
          ...systemStats
        }))
      } else {
        // Fallback to filtered total
        setStats(prev => ({
          ...prev,
          totalObdii: data.total || 0,
          genericObdii: 0,
          manufacturerObdii: 0
        }))
      }
    } catch (error) {
      console.error('Error fetching OBD-II DTCs:', error)
    } finally {
      setLoading(false)
    }
  }, [searchTerm, filterSystem, filterCategory, filterGeneric, currentPage, pageSize])

  useEffect(() => {
    fetchVehicleHierarchy()
  }, [fetchVehicleHierarchy])

  useEffect(() => {
    if (activeTab === 'uds') {
      fetchDTCs()
    } else {
      fetchObdiiDTCs()
    }
  }, [activeTab, fetchDTCs, fetchObdiiDTCs])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterSystem, filterCategory, filterGeneric])

  const handleCreateDTC = async () => {
    try {
      const endpoint = activeTab === 'uds' ? '/api/dtc-definitions' : '/api/obdii-dtcs'
      const body = activeTab === 'uds' ? {
        code: formCode,
        name: formName,
        description: formDescription,
        severity: formSeverity,
        category: formCategory,
        system: formSystem,
        oemId: formOEM,
        modelId: formModel,
        modelYearId: formYear,
        ecuAddress: formEcuAddress || undefined,
        symptoms: formSymptoms || undefined,
        causes: formCauses || undefined,
        diagnosticSteps: formDiagnosticSteps || undefined,
        repairActions: formRepairActions || undefined
      } : {
        code: formCode,
        name: formName,
        description: formDescription,
        system: formSystem,
        category: formCategory,
        isGeneric: formIsGeneric,
        symptoms: formSymptoms || undefined,
        causes: formCauses || undefined,
        diagnosticSteps: formDiagnosticSteps || undefined,
        repairActions: formRepairActions || undefined
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create DTC')
      }

      // Refresh the list
      if (activeTab === 'uds') {
        fetchDTCs()
      } else {
        fetchObdiiDTCs()
      }

      // Reset form
      setShowCreateForm(false)
      resetForm()
    } catch (error: any) {
      alert(error.message)
    }
  }

  const handleUpdateDTC = async () => {
    try {
      const endpoint = activeTab === 'uds'
        ? `/api/dtc-definitions/${editingDtc?.id}`
        : `/api/obdii-dtcs/${editingObdiiDtc?.id}`

      const body = activeTab === 'uds' ? {
        name: formName,
        description: formDescription,
        severity: formSeverity,
        category: formCategory,
        system: formSystem,
        symptoms: formSymptoms || undefined,
        causes: formCauses || undefined,
        diagnosticSteps: formDiagnosticSteps || undefined,
        repairActions: formRepairActions || undefined,
        isVerified: editingDtc?.isVerified
      } : {
        name: formName,
        description: formDescription,
        system: formSystem,
        category: formCategory,
        isGeneric: formIsGeneric,
        symptoms: formSymptoms || undefined,
        causes: formCauses || undefined,
        diagnosticSteps: formDiagnosticSteps || undefined,
        repairActions: formRepairActions || undefined
      }

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update DTC')
      }

      // Refresh the list
      if (activeTab === 'uds') {
        fetchDTCs()
      } else {
        fetchObdiiDTCs()
      }

      // Reset form
      setEditingDtc(null)
      setEditingObdiiDtc(null)
      resetForm()
    } catch (error: any) {
      alert(error.message)
    }
  }

  const handleDeleteDTC = async (id: string) => {
    if (!confirm('Are you sure you want to delete this DTC?')) return

    try {
      const endpoint = activeTab === 'uds'
        ? `/api/dtc-definitions/${id}`
        : `/api/obdii-dtcs/${id}`

      const response = await fetch(endpoint, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete DTC')
      }

      // Refresh the list
      if (activeTab === 'uds') {
        fetchDTCs()
      } else {
        fetchObdiiDTCs()
      }
    } catch (error: any) {
      alert(error.message)
    }
  }

  const resetForm = () => {
    setFormCode('')
    setFormName('')
    setFormDescription('')
    setFormSeverity('INFORMATIONAL')
    setFormCategory('')
    setFormSystem('Powertrain')
    setFormIsGeneric(true)
    setFormOEM('')
    setFormModel('')
    setFormYear('')
    setFormEcuAddress('')
    setFormSymptoms('')
    setFormCauses('')
    setFormDiagnosticSteps('')
    setFormRepairActions('')
  }

  const startEdit = (dtc: DTCDefinition | OBDIIDTCDefinition) => {
    if ('oemId' in dtc) {
      // UDS DTC
      setEditingDtc(dtc as DTCDefinition)
      setFormCode(dtc.code)
      setFormName(dtc.name)
      setFormDescription(dtc.description || '')
      setFormSeverity((dtc as DTCDefinition).severity)
      setFormCategory(dtc.category || '')
      setFormSystem(dtc.system || '')
      setFormOEM((dtc as DTCDefinition).oemId)
      setFormModel((dtc as DTCDefinition).modelId)
      setFormYear((dtc as DTCDefinition).modelYearId)
      setFormEcuAddress((dtc as DTCDefinition).ecuAddress || '')
      setFormSymptoms(dtc.symptoms || '')
      setFormCauses(dtc.causes || '')
      setFormDiagnosticSteps(dtc.diagnosticSteps || '')
      setFormRepairActions(dtc.repairActions || '')
    } else {
      // OBD-II DTC
      setEditingObdiiDtc(dtc as OBDIIDTCDefinition)
      setFormCode(dtc.code)
      setFormName(dtc.name)
      setFormDescription(dtc.description || '')
      setFormSystem(dtc.system || 'Powertrain')
      setFormCategory(dtc.category || '')
      setFormIsGeneric((dtc as OBDIIDTCDefinition).isGeneric)
      setFormSymptoms(dtc.symptoms || '')
      setFormCauses(dtc.causes || '')
      setFormDiagnosticSteps(dtc.diagnosticSteps || '')
      setFormRepairActions(dtc.repairActions || '')
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return <AlertCircle size={16} style={{ color: colors.error[500] }} />
      case 'WARNING':
        return <AlertTriangle size={16} style={{ color: colors.warning[500] }} />
      default:
        return <Info size={16} style={{ color: colors.info[500] }} />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return colors.error[500]
      case 'WARNING':
        return colors.warning[500]
      default:
        return colors.info[500]
    }
  }

  return (
    <PageLayout
      title="DTC Management"
      description="Manage Diagnostic Trouble Code definitions"
    >
      {/* Statistics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: spacing[4],
        marginBottom: spacing[6]
      }}>
        {activeTab === 'uds' ? (
          <>
            <StatCard label="Total DTCs" value={stats.total} />
            <StatCard
              label="Critical"
              value={stats.critical}
              icon={<AlertCircle size={20} style={{ color: colors.error[500] }} />}
            />
            <StatCard
              label="Warning"
              value={stats.warning}
              icon={<AlertTriangle size={20} style={{ color: colors.warning[500] }} />}
            />
            <StatCard
              label="Informational"
              value={stats.informational}
              icon={<Info size={20} style={{ color: colors.info[500] }} />}
            />
            <StatCard
              label="Verified"
              value={stats.verified}
              icon={<CheckCircle size={20} style={{ color: colors.success[500] }} />}
            />
          </>
        ) : (
          <>
            <StatCard label="Total OBD-II DTCs" value={stats.totalObdii} />
            <StatCard
              label="Generic Codes"
              value={stats.genericObdii}
              icon={<Globe size={20} style={{ color: colors.info[500] }} />}
            />
            <StatCard
              label="Manufacturer Codes"
              value={stats.manufacturerObdii}
              icon={<Car size={20} style={{ color: colors.warning[500] }} />}
            />
            <StatCard
              label="Powertrain (P)"
              value={stats.powertrain}
              icon={<Activity size={20} style={{ color: colors.primary[500] }} />}
            />
            <StatCard
              label="Body (B)"
              value={stats.body}
              icon={<Car size={20} style={{ color: colors.warning[500] }} />}
            />
            <StatCard
              label="Chassis (C)"
              value={stats.chassis}
              icon={<Shield size={20} style={{ color: colors.success[500] }} />}
            />
            <StatCard
              label="Network (U)"
              value={stats.network}
              icon={<Network size={20} style={{ color: colors.info[500] }} />}
            />
          </>
        )}
      </div>

      {/* Tab Selector */}
      <Card style={{ marginBottom: spacing[4] }}>
        <div style={{ display: 'flex', gap: spacing[2], borderBottom: `1px solid ${colors.border.default}` }}>
          <button
            onClick={() => setActiveTab('uds')}
            style={{
              padding: `${spacing[3]} ${spacing[4]}`,
              border: 'none',
              background: 'transparent',
              color: activeTab === 'uds' ? colors.primary[500] : colors.text.secondary,
              borderBottom: activeTab === 'uds' ? `2px solid ${colors.primary[500]}` : 'none',
              marginBottom: '-1px',
              cursor: 'pointer',
              fontWeight: activeTab === 'uds' ? 600 : 400,
              display: 'flex',
              alignItems: 'center',
              gap: spacing[2]
            }}
          >
            <Shield size={18} />
            UDS DTCs (Vehicle Specific)
          </button>
          <button
            onClick={() => setActiveTab('obdii')}
            style={{
              padding: `${spacing[3]} ${spacing[4]}`,
              border: 'none',
              background: 'transparent',
              color: activeTab === 'obdii' ? colors.primary[500] : colors.text.secondary,
              borderBottom: activeTab === 'obdii' ? `2px solid ${colors.primary[500]}` : 'none',
              marginBottom: '-1px',
              cursor: 'pointer',
              fontWeight: activeTab === 'obdii' ? 600 : 400,
              display: 'flex',
              alignItems: 'center',
              gap: spacing[2]
            }}
          >
            <Database size={18} />
            OBD-II DTCs (Standard)
          </button>
        </div>
      </Card>

      {/* Search and Actions */}
      <Card style={{ marginBottom: spacing[4] }}>
        <div style={{ display: 'flex', gap: spacing[3], alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={20} style={{
              position: 'absolute',
              left: spacing[3],
              top: '50%',
              transform: 'translateY(-50%)',
              color: colors.text.secondary
            }} />
            <input
              type="text"
              placeholder="Search DTCs by code, name or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                ...inputStyles.base,
                paddingLeft: spacing[6],
                width: '100%'
              }}
            />
          </div>

          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant="outline"
            style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}
          >
            <Filter size={18} />
            Filters
            <ChevronDown
              size={16}
              style={{
                transform: showFilters ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s'
              }}
            />
          </Button>

          <Button
            onClick={() => {
              resetForm()
              setShowCreateForm(true)
            }}
            style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}
          >
            <Plus size={18} />
            Add DTC
          </Button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div style={{
            marginTop: spacing[4],
            paddingTop: spacing[4],
            borderTop: `1px solid ${colors.border.default}`,
            display: 'grid',
            gridTemplateColumns: activeTab === 'uds' ? 'repeat(auto-fit, minmax(200px, 1fr))' : 'repeat(3, 1fr)',
            gap: spacing[3]
          }}>
            {activeTab === 'uds' ? (
              <>
                <select
                  value={filterSeverity}
                  onChange={(e) => setFilterSeverity(e.target.value)}
                  style={inputStyles.base}
                >
                  <option value="">All Severities</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="WARNING">Warning</option>
                  <option value="INFORMATIONAL">Informational</option>
                </select>

                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  style={inputStyles.base}
                >
                  <option value="">All Categories</option>
                  <optgroup label="Powertrain">
                    <option value="Fuel and Air Metering">Fuel and Air Metering</option>
                    <option value="Ignition System or Misfire">Ignition System or Misfire</option>
                    <option value="Auxiliary Emission Controls">Auxiliary Emission Controls</option>
                    <option value="Vehicle Speed Controls and Idle Control System">Vehicle Speed & Idle Control</option>
                    <option value="Computer Output Circuit">Computer Output Circuit</option>
                    <option value="Transmission">Transmission</option>
                    <option value="Fuel and Air Metering and Auxiliary Emission Controls">Fuel/Air & Emissions</option>
                  </optgroup>
                  <optgroup label="Body">
                    <option value="Airbag and Supplemental Restraint Systems">Airbag & SRS</option>
                    <option value="Climate Control">Climate Control</option>
                    <option value="Lighting">Lighting</option>
                    <option value="Security and Access">Security & Access</option>
                    <option value="Instrumentation">Instrumentation</option>
                    <option value="Body Electrical">Body Electrical</option>
                  </optgroup>
                  <optgroup label="Chassis">
                    <option value="ABS and Traction Control">ABS & Traction Control</option>
                    <option value="Steering">Steering</option>
                    <option value="Suspension">Suspension</option>
                    <option value="Chassis">Chassis General</option>
                  </optgroup>
                  <optgroup label="Network">
                    <option value="CAN Communication">CAN Communication</option>
                    <option value="Lost Communication with Module">Lost Communication</option>
                  </optgroup>
                  <optgroup label="Other">
                    <option value="Manufacturer Specific">Manufacturer Specific</option>
                  </optgroup>
                </select>

                <select
                  value={filterVerified}
                  onChange={(e) => setFilterVerified(e.target.value)}
                  style={inputStyles.base}
                >
                  <option value="">All Status</option>
                  <option value="true">Verified</option>
                  <option value="false">Unverified</option>
                </select>

                <select
                  value={filterOEM}
                  onChange={(e) => {
                    setFilterOEM(e.target.value)
                    setFilterModel('')
                    setFilterYear('')
                    const oem = oems.find(o => o.id === e.target.value)
                    setSelectedOEM(oem || null)
                  }}
                  style={inputStyles.base}
                >
                  <option value="">All OEMs</option>
                  {oems.map(oem => (
                    <option key={oem.id} value={oem.id}>{oem.name}</option>
                  ))}
                </select>

                {selectedOEM && (
                  <select
                    value={filterModel}
                    onChange={(e) => {
                      setFilterModel(e.target.value)
                      setFilterYear('')
                    }}
                    style={inputStyles.base}
                  >
                    <option value="">All Models</option>
                    {selectedOEM.models.map(model => (
                      <option key={model.id} value={model.id}>{model.name}</option>
                    ))}
                  </select>
                )}

                {filterModel && selectedOEM && (
                  <select
                    value={filterYear}
                    onChange={(e) => setFilterYear(e.target.value)}
                    style={inputStyles.base}
                  >
                    <option value="">All Years</option>
                    {selectedOEM.models
                      .find(m => m.id === filterModel)
                      ?.modelYears.map(year => (
                        <option key={year.id} value={year.id}>{year.year}</option>
                      ))
                    }
                  </select>
                )}
              </>
            ) : (
              <>
                <select
                  value={filterSystem}
                  onChange={(e) => setFilterSystem(e.target.value)}
                  style={inputStyles.base}
                >
                  <option value="">All Systems</option>
                  <option value="Powertrain">Powertrain</option>
                  <option value="Body">Body</option>
                  <option value="Chassis">Chassis</option>
                  <option value="Network">Network</option>
                </select>

                <select
                  value={filterGeneric}
                  onChange={(e) => setFilterGeneric(e.target.value)}
                  style={inputStyles.base}
                >
                  <option value="">All Types</option>
                  <option value="true">Generic (Standard OBD-II)</option>
                  <option value="false">Manufacturer-Specific</option>
                </select>
              </>
            )}
          </div>
        )}
      </Card>

      {/* DTCs Table */}
      <Card>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyles.base}>
            <thead>
              <tr>
                <th style={tableStyles.th}>Code</th>
                <th style={tableStyles.th}>Name</th>
                <th style={tableStyles.th}>
                  {activeTab === 'uds' ? 'Severity' : 'System'}
                </th>
                <th style={tableStyles.th}>Category</th>
                {activeTab === 'uds' && (
                  <>
                    <th style={tableStyles.th}>Vehicle</th>
                    <th style={tableStyles.th}>ECU</th>
                  </>
                )}
                {activeTab === 'obdii' && (
                  <th style={tableStyles.th}>Type</th>
                )}
                <th style={tableStyles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={activeTab === 'uds' ? 9 : 7} style={{ ...tableStyles.td, textAlign: 'center' }}>
                    Loading DTCs...
                  </td>
                </tr>
              ) : activeTab === 'uds' ? (
                dtcs.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ ...tableStyles.td, textAlign: 'center' }}>
                      No DTCs found
                    </td>
                  </tr>
                ) : (
                  dtcs.map((dtc) => (
                    <tr key={dtc.id}>
                      <td style={tableStyles.td}>
                        <Badge>{dtc.code}</Badge>
                      </td>
                      <td style={tableStyles.td}>{dtc.name}</td>
                      <td style={tableStyles.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
                          {getSeverityIcon(dtc.severity)}
                          <span style={{ color: getSeverityColor(dtc.severity) }}>
                            {dtc.severity}
                          </span>
                        </div>
                      </td>
                      <td style={tableStyles.td}>{dtc.category || '-'}</td>
                      <td style={tableStyles.td}>
                        {dtc.oem?.name && dtc.model?.name && dtc.modelYear?.year ? (
                          <div style={{ fontSize: '0.875rem' }}>
                            <div>{dtc.oem.name}</div>
                            <div style={{ color: colors.text.secondary }}>
                              {dtc.model.name} ({dtc.modelYear.year})
                            </div>
                          </div>
                        ) : '-'}
                      </td>
                      <td style={tableStyles.td}>
                        {dtc.ecuAddress ? (
                          <Badge variant="secondary">{dtc.ecuAddress}</Badge>
                        ) : '-'}
                      </td>
                      <td style={tableStyles.td}>
                        {dtc.isVerified ? (
                          <Badge variant="success" style={{ display: 'inline-flex', alignItems: 'center', gap: spacing[1] }}>
                            <CheckCircle size={14} />
                            Verified
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Unverified</Badge>
                        )}
                      </td>
                      <td style={tableStyles.td}>
                        <div style={{ display: 'flex', gap: spacing[2] }}>
                          <button
                            onClick={() => startEdit(dtc)}
                            style={{
                              ...combineStyles(buttonStyles.base, buttonStyles.ghost),
                              padding: spacing[2]
                            }}
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteDTC(dtc.id)}
                            style={{
                              ...combineStyles(buttonStyles.base, buttonStyles.ghost),
                              padding: spacing[2],
                              color: colors.error[500]
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )
              ) : (
                obdiiDtcs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ ...tableStyles.td, textAlign: 'center' }}>
                      No OBD-II DTCs found
                    </td>
                  </tr>
                ) : (
                  obdiiDtcs.map((dtc) => (
                    <tr key={dtc.id}>
                      <td style={tableStyles.td}>
                        <Badge>{dtc.code}</Badge>
                      </td>
                      <td style={tableStyles.td}>{dtc.name}</td>
                      <td style={tableStyles.td}>
                        <Badge variant="secondary">{dtc.system}</Badge>
                      </td>
                      <td style={tableStyles.td}>{dtc.category || '-'}</td>
                      <td style={tableStyles.td}>
                        {dtc.isGeneric ? (
                          <Badge variant="info">Generic</Badge>
                        ) : (
                          <Badge variant="warning">Manufacturer</Badge>
                        )}
                      </td>
                      <td style={tableStyles.td}>
                        <div style={{ display: 'flex', gap: spacing[2] }}>
                          <button
                            onClick={() => startEdit(dtc)}
                            style={{
                              ...combineStyles(buttonStyles.base, buttonStyles.ghost),
                              padding: spacing[2]
                            }}
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteDTC(dtc.id)}
                            style={{
                              ...combineStyles(buttonStyles.base, buttonStyles.ghost),
                              padding: spacing[2],
                              color: colors.error[500]
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls for OBD-II */}
        {activeTab === 'obdii' && totalPages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: spacing[4],
            borderTop: `1px solid ${colors.border.default}`,
            gap: spacing[4]
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
              <span style={{ color: colors.text.secondary, fontSize: '14px' }}>
                Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalDTCs)} of {totalDTCs} DTCs
              </span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(parseInt(e.target.value))
                  setCurrentPage(1)
                }}
                style={{
                  ...inputStyles.base,
                  width: 'auto',
                  padding: `${spacing[1]} ${spacing[2]}`,
                  fontSize: '14px'
                }}
              >
                <option value="25">25 per page</option>
                <option value="50">50 per page</option>
                <option value="100">100 per page</option>
                <option value="200">200 per page</option>
                <option value="500">500 per page</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: spacing[2] }}>
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                style={{
                  ...buttonStyles.base,
                  ...buttonStyles.secondary,
                  padding: `${spacing[1]} ${spacing[2]}`,
                  opacity: currentPage === 1 ? 0.5 : 1,
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                }}
              >
                First
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                style={{
                  ...buttonStyles.base,
                  ...buttonStyles.secondary,
                  padding: `${spacing[1]} ${spacing[2]}`,
                  opacity: currentPage === 1 ? 0.5 : 1,
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                }}
              >
                Previous
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: spacing[1] }}>
                {[...Array(Math.min(5, totalPages))].map((_, idx) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = idx + 1;
                  } else if (currentPage <= 3) {
                    pageNum = idx + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + idx;
                  } else {
                    pageNum = currentPage - 2 + idx;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      style={{
                        ...buttonStyles.base,
                        ...(pageNum === currentPage ? buttonStyles.primary : buttonStyles.secondary),
                        padding: `${spacing[1]} ${spacing[2]}`,
                        minWidth: '40px'
                      }}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                style={{
                  ...buttonStyles.base,
                  ...buttonStyles.secondary,
                  padding: `${spacing[1]} ${spacing[2]}`,
                  opacity: currentPage === totalPages ? 0.5 : 1,
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                }}
              >
                Next
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                style={{
                  ...buttonStyles.base,
                  ...buttonStyles.secondary,
                  padding: `${spacing[1]} ${spacing[2]}`,
                  opacity: currentPage === totalPages ? 0.5 : 1,
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                }}
              >
                Last
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Create/Edit Modal */}
      {(showCreateForm || editingDtc || editingObdiiDtc) && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <Card style={{
            width: '90%',
            maxWidth: '800px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: spacing[4],
              borderBottom: `1px solid ${colors.border.default}`,
              paddingBottom: spacing[3]
            }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>
                {editingDtc || editingObdiiDtc ? 'Edit DTC' : 'Create New DTC'}
              </h2>
              <button
                onClick={() => {
                  setShowCreateForm(false)
                  setEditingDtc(null)
                  setEditingObdiiDtc(null)
                  resetForm()
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: colors.text.secondary
                }}
              >
                <X size={24} />
              </button>
            </div>

            <div style={{ display: 'grid', gap: spacing[4] }}>
              {/* Basic Information */}
              <div>
                <h3 style={{ marginBottom: spacing[3], fontWeight: 500 }}>Basic Information</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: spacing[3] }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: spacing[2], fontSize: '0.875rem' }}>
                      DTC Code *
                    </label>
                    <input
                      type="text"
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value)}
                      placeholder="e.g., P0301"
                      disabled={!!editingDtc || !!editingObdiiDtc}
                      style={inputStyles.base}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: spacing[2], fontSize: '0.875rem' }}>
                      Name *
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="Short descriptive name"
                      style={inputStyles.base}
                    />
                  </div>
                </div>

                <div style={{ marginTop: spacing[3] }}>
                  <label style={{ display: 'block', marginBottom: spacing[2], fontSize: '0.875rem' }}>
                    Description
                  </label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Detailed description of the DTC"
                    rows={3}
                    style={{ ...inputStyles.base, resize: 'vertical' }}
                  />
                </div>
              </div>

              {/* Classification */}
              <div>
                <h3 style={{ marginBottom: spacing[3], fontWeight: 500 }}>Classification</h3>
                <div style={{ display: 'grid', gridTemplateColumns: activeTab === 'uds' ? '1fr 1fr 1fr' : '1fr 1fr', gap: spacing[3] }}>
                  {activeTab === 'uds' ? (
                    <>
                      <div>
                        <label style={{ display: 'block', marginBottom: spacing[2], fontSize: '0.875rem' }}>
                          Severity *
                        </label>
                        <select
                          value={formSeverity}
                          onChange={(e) => setFormSeverity(e.target.value as any)}
                          style={inputStyles.base}
                        >
                          <option value="INFORMATIONAL">Informational</option>
                          <option value="WARNING">Warning</option>
                          <option value="CRITICAL">Critical</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: spacing[2], fontSize: '0.875rem' }}>
                          System
                        </label>
                        <input
                          type="text"
                          value={formSystem}
                          onChange={(e) => setFormSystem(e.target.value)}
                          placeholder="e.g., Engine, Transmission"
                          style={inputStyles.base}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: spacing[2], fontSize: '0.875rem' }}>
                          Category
                        </label>
                        <input
                          type="text"
                          value={formCategory}
                          onChange={(e) => setFormCategory(e.target.value)}
                          placeholder="e.g., Emission, Fuel System"
                          style={inputStyles.base}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label style={{ display: 'block', marginBottom: spacing[2], fontSize: '0.875rem' }}>
                          System *
                        </label>
                        <select
                          value={formSystem}
                          onChange={(e) => setFormSystem(e.target.value)}
                          style={inputStyles.base}
                        >
                          <option value="Powertrain">Powertrain</option>
                          <option value="Body">Body</option>
                          <option value="Chassis">Chassis</option>
                          <option value="Network">Network</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: spacing[2], fontSize: '0.875rem' }}>
                          Type *
                        </label>
                        <select
                          value={formIsGeneric ? 'true' : 'false'}
                          onChange={(e) => setFormIsGeneric(e.target.value === 'true')}
                          style={inputStyles.base}
                        >
                          <option value="true">Generic</option>
                          <option value="false">Manufacturer Specific</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: spacing[2], fontSize: '0.875rem' }}>
                          Category
                        </label>
                        <input
                          type="text"
                          value={formCategory}
                          onChange={(e) => setFormCategory(e.target.value)}
                          placeholder="e.g., Fuel and Air Metering"
                          style={inputStyles.base}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Vehicle Context (UDS only) */}
              {activeTab === 'uds' && !editingDtc && (
                <div>
                  <h3 style={{ marginBottom: spacing[3], fontWeight: 500 }}>Vehicle Context</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: spacing[3] }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: spacing[2], fontSize: '0.875rem' }}>
                        OEM *
                      </label>
                      <select
                        value={formOEM}
                        onChange={(e) => {
                          setFormOEM(e.target.value)
                          setFormModel('')
                          setFormYear('')
                          const oem = oems.find(o => o.id === e.target.value)
                          setSelectedOEM(oem || null)
                        }}
                        style={inputStyles.base}
                      >
                        <option value="">Select OEM</option>
                        {oems.map(oem => (
                          <option key={oem.id} value={oem.id}>{oem.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: spacing[2], fontSize: '0.875rem' }}>
                        Model *
                      </label>
                      <select
                        value={formModel}
                        onChange={(e) => {
                          setFormModel(e.target.value)
                          setFormYear('')
                        }}
                        disabled={!formOEM}
                        style={inputStyles.base}
                      >
                        <option value="">Select Model</option>
                        {selectedOEM?.models.map(model => (
                          <option key={model.id} value={model.id}>{model.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: spacing[2], fontSize: '0.875rem' }}>
                        Year *
                      </label>
                      <select
                        value={formYear}
                        onChange={(e) => setFormYear(e.target.value)}
                        disabled={!formModel}
                        style={inputStyles.base}
                      >
                        <option value="">Select Year</option>
                        {selectedOEM?.models
                          .find(m => m.id === formModel)
                          ?.modelYears.map(year => (
                            <option key={year.id} value={year.id}>{year.year}</option>
                          ))
                        }
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: spacing[2], fontSize: '0.875rem' }}>
                        ECU Address
                      </label>
                      <input
                        type="text"
                        value={formEcuAddress}
                        onChange={(e) => setFormEcuAddress(e.target.value)}
                        placeholder="e.g., 0x7E0"
                        style={inputStyles.base}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Diagnostic Information */}
              <div>
                <h3 style={{ marginBottom: spacing[3], fontWeight: 500 }}>Diagnostic Information</h3>
                <div style={{ display: 'grid', gap: spacing[3] }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: spacing[2], fontSize: '0.875rem' }}>
                      <Stethoscope size={14} style={{ display: 'inline', marginRight: spacing[1] }} />
                      Symptoms
                    </label>
                    <textarea
                      value={formSymptoms}
                      onChange={(e) => setFormSymptoms(e.target.value)}
                      placeholder="Observable symptoms when this DTC is present"
                      rows={2}
                      style={{ ...inputStyles.base, resize: 'vertical' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: spacing[2], fontSize: '0.875rem' }}>
                      <AlertCircle size={14} style={{ display: 'inline', marginRight: spacing[1] }} />
                      Possible Causes
                    </label>
                    <textarea
                      value={formCauses}
                      onChange={(e) => setFormCauses(e.target.value)}
                      placeholder="Common causes for this DTC"
                      rows={2}
                      style={{ ...inputStyles.base, resize: 'vertical' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: spacing[2], fontSize: '0.875rem' }}>
                      <Settings size={14} style={{ display: 'inline', marginRight: spacing[1] }} />
                      Diagnostic Steps
                    </label>
                    <textarea
                      value={formDiagnosticSteps}
                      onChange={(e) => setFormDiagnosticSteps(e.target.value)}
                      placeholder="Steps to diagnose the issue"
                      rows={3}
                      style={{ ...inputStyles.base, resize: 'vertical' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: spacing[2], fontSize: '0.875rem' }}>
                      <Wrench size={14} style={{ display: 'inline', marginRight: spacing[1] }} />
                      Repair Actions
                    </label>
                    <textarea
                      value={formRepairActions}
                      onChange={(e) => setFormRepairActions(e.target.value)}
                      placeholder="Recommended repair actions"
                      rows={3}
                      style={{ ...inputStyles.base, resize: 'vertical' }}
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: spacing[3],
                paddingTop: spacing[3],
                borderTop: `1px solid ${colors.border.default}`
              }}>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateForm(false)
                    setEditingDtc(null)
                    setEditingObdiiDtc(null)
                    resetForm()
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={editingDtc || editingObdiiDtc ? handleUpdateDTC : handleCreateDTC}
                  style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}
                >
                  <Save size={18} />
                  {editingDtc || editingObdiiDtc ? 'Update DTC' : 'Create DTC'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </PageLayout>
  )
}