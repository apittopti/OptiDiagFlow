'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageLayout } from '@/components/layout/page-layout'
import { Card, Button, Badge, StatCard } from '@/components/design-system'
import { colors, spacing } from '@/lib/design-system/tokens'
import { AlertCircle, CheckCircle, Database, Search, Upload, Download, Zap, BookOpen, Code, Wrench, Package } from 'lucide-react';

interface ECUDefinition {
  id: string;
  address: string;
  name: string;
  fullName?: string;
  description?: string;
  level: 'global' | 'oem' | 'model' | 'modelYear' | 'vehicle';
  oemId?: string;
  modelId?: string;
  modelYearId?: string;
  vehicleId?: string;
}

interface DIDDefinition {
  id: string;
  did: string;
  name: string;
  description?: string;
  dataType?: string;
  unit?: string;
  level: 'global' | 'oem' | 'model' | 'modelYear' | 'vehicle';
  oemId?: string;
  modelId?: string;
  modelYearId?: string;
  vehicleId?: string;
}

interface DTCDefinition {
  id: string;
  code: string;
  description: string;
  severity?: string;
  possibleCauses?: string;
  level: 'global' | 'oem' | 'model' | 'modelYear' | 'vehicle';
  oemId?: string;
  modelId?: string;
  modelYearId?: string;
  vehicleId?: string;
}

interface RoutineDefinition {
  id: string;
  routineId: string;
  name: string;
  description?: string;
  inputParams?: string;
  outputParams?: string;
  level: 'global' | 'oem' | 'model' | 'modelYear' | 'vehicle';
  oemId?: string;
  modelId?: string;
  modelYearId?: string;
  vehicleId?: string;
}

export default function KnowledgePage() {
  const [activeTab, setActiveTab] = useState<'ecu' | 'did' | 'dtc' | 'routine'>('ecu');
  const [searchTerm, setSearchTerm] = useState('');
  const [oems, setOems] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [modelYears, setModelYears] = useState<any[]>([]);
  const [selectedOem, setSelectedOem] = useState<string>('all');
  const [selectedModel, setSelectedModel] = useState<string>('all');
  const [selectedModelYear, setSelectedModelYear] = useState<string>('all');
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [reparsingAll, setReparsingAll] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<{name?: string, description?: string}>({});

  useEffect(() => {
    fetchHierarchy();
  }, []);

  useEffect(() => {
    fetchDefinitions();
    fetchFilteredStats();
  }, [activeTab, selectedOem, selectedModel, selectedModelYear]);

  const fetchHierarchy = async () => {
    try {
      const [oemsRes, modelsRes, modelYearsRes] = await Promise.all([
        fetch('/api/oems'),
        fetch('/api/models'),
        fetch('/api/model-years')
      ]);

      if (oemsRes.ok) setOems(await oemsRes.json());
      if (modelsRes.ok) setModels(await modelsRes.json());
      if (modelYearsRes.ok) setModelYears(await modelYearsRes.json());
    } catch (error) {
      console.error('Error fetching hierarchy:', error);
    }
  };

  // Filter models based on selected OEM
  const filteredModels = selectedOem === 'all'
    ? models
    : models.filter(model => model.oemId === selectedOem);

  // Filter model years based on selected model
  const filteredModelYears = selectedModel === 'all'
    ? modelYears
    : modelYears.filter(year => year.modelId === selectedModel);

  const fetchFilteredStats = async () => {
    try {
      // Build filter params for all definition types
      const params = new URLSearchParams();
      if (selectedOem !== 'all') params.append('oemId', selectedOem);
      if (selectedModel !== 'all') params.append('modelId', selectedModel);
      if (selectedModelYear !== 'all') params.append('modelYearId', selectedModelYear);

      // Fetch counts for all definition types in parallel
      const [ecuRes, didRes, dtcRes, routineRes] = await Promise.all([
        fetch(`/api/knowledge/definitions?type=ecu&${params}`),
        fetch(`/api/knowledge/definitions?type=did&${params}`),
        fetch(`/api/knowledge/definitions?type=dtc&${params}`),
        fetch(`/api/knowledge/definitions?type=routine&${params}`)
      ]);

      let ecuCount = 0, didCount = 0, dtcCount = 0, routineCount = 0;

      if (ecuRes.ok) {
        const ecuData = await ecuRes.json();
        ecuCount = Array.isArray(ecuData) ? ecuData.length : 0;
      }
      if (didRes.ok) {
        const didData = await didRes.json();
        didCount = Array.isArray(didData) ? didData.length : 0;
      }
      if (dtcRes.ok) {
        const dtcData = await dtcRes.json();
        dtcCount = Array.isArray(dtcData) ? dtcData.length : 0;
      }
      if (routineRes.ok) {
        const routineData = await routineRes.json();
        routineCount = Array.isArray(routineData) ? routineData.length : 0;
      }

      setStats({
        ecuCount,
        didCount,
        dtcCount,
        routineCount
      });
    } catch (error) {
      console.error('Error fetching filtered stats:', error);
    }
  };

  const fetchDefinitions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('type', activeTab);
      if (selectedOem !== 'all') params.append('oemId', selectedOem);
      if (selectedModel !== 'all') params.append('modelId', selectedModel);
      if (selectedModelYear !== 'all') params.append('modelYearId', selectedModelYear);

      const response = await fetch(`/api/knowledge/definitions?${params}`);
      if (response.ok) {
        setDefinitions(await response.json());
      }
    } catch (error) {
      console.error('Error fetching definitions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', activeTab);
    if (selectedOem) formData.append('oemId', selectedOem);
    if (selectedModel) formData.append('modelId', selectedModel);
    if (selectedModelYear) formData.append('modelYearId', selectedModelYear);

    try {
      const response = await fetch('/api/knowledge/import', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        alert("Import Successful: Knowledge definitions have been imported.");
        fetchDefinitions();
        fetchFilteredStats();
      } else {
        alert("Import Failed: There was an error importing the definitions.");
      }
    } catch (error) {
      alert("Import Error: Failed to import definitions.");
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      params.append('type', activeTab);
      if (selectedOem !== 'all') params.append('oemId', selectedOem);
      if (selectedModel !== 'all') params.append('modelId', selectedModel);
      if (selectedModelYear !== 'all') params.append('modelYearId', selectedModelYear);

      const response = await fetch(`/api/knowledge/export?${params}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `knowledge_${activeTab}_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      alert("Export Error: Failed to export definitions.");
    }
  };

  const handleEditStart = (def: any) => {
    setEditingId(def.id);
    setEditingValues({
      name: def.name,
      description: def.description || ''
    });
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditingValues({});
  };

  const handleEditSave = async (def: any) => {
    try {
      console.log('Saving definition:', def.id, editingValues);
      const response = await fetch('/api/knowledge/definitions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: activeTab,
          id: def.id,
          ...editingValues
        })
      });

      if (response.ok) {
        console.log('Update successful');
        // Update the local state immediately
        const updatedDefinitions = definitions.map(d =>
          d.id === def.id ? { ...d, ...editingValues } : d
        );
        setDefinitions(updatedDefinitions);

        // Clear editing state
        setEditingId(null);
        setEditingValues({});

        // Refresh from server
        fetchDefinitions();
      } else {
        const errorData = await response.json();
        console.error('Update failed:', errorData);
        alert(`Failed to update definition: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Update error:', error);
      alert(`Failed to update definition: ${error}`);
    }
  };

  const handleReparseAllJobs = async () => {
    if (!confirm('This will clear all knowledge base data and reparse all jobs from scratch. This process may take several minutes. Are you sure?')) {
      return;
    }

    setReparsingAll(true);
    try {
      const response = await fetch('/api/jobs/reparse-all', {
        method: 'POST'
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Reparse All Jobs Successful: ${result.summary.processed} jobs processed, ${result.summary.skipped} skipped, ${result.summary.errors} errors`);
        // Refresh the data after successful reparsing
        fetchDefinitions();
        fetchFilteredStats();
      } else {
        const error = await response.json();
        alert(`Reparse Failed: ${error.details || "There was an error reparsing all jobs."}`);
      }
    } catch (error) {
      alert("Reparse Error: Failed to reparse all jobs.");
    } finally {
      setReparsingAll(false);
    }
  };

  const filteredDefinitions = definitions.filter(def => {
    const searchLower = searchTerm.toLowerCase();
    switch (activeTab) {
      case 'ecu':
        return (def.address?.toLowerCase().includes(searchLower) ||
                def.name?.toLowerCase().includes(searchLower) ||
                def.description?.toLowerCase().includes(searchLower));
      case 'did':
        return (def.did?.toLowerCase().includes(searchLower) ||
                def.name?.toLowerCase().includes(searchLower) ||
                def.description?.toLowerCase().includes(searchLower));
      case 'dtc':
        return (def.code?.toLowerCase().includes(searchLower) ||
                def.description?.toLowerCase().includes(searchLower));
      case 'routine':
        return (def.routineId?.toLowerCase().includes(searchLower) ||
                def.name?.toLowerCase().includes(searchLower) ||
                def.description?.toLowerCase().includes(searchLower));
      default:
        return true;
    }
  });

  return (
    <PageLayout
      title="Knowledge Repository"
      description="Manage ECU, DID, DTC, and Routine definitions across different vehicle hierarchies"
    >
      <div className="ds-container">

      {/* Stats Cards */}
      <div className="ds-grid-4" style={{ marginBottom: spacing[8] }}>
        <StatCard
          label="ECU Definitions"
          value={stats?.ecuCount || 0}
          icon={<Package size={24} />}
          color="primary"
          loading={loading}
          helpText="Discovered from parsed jobs"
        />
        <StatCard
          label="DID Definitions"
          value={stats?.didCount || 0}
          icon={<BookOpen size={24} />}
          color="success"
          loading={loading}
          helpText="Discovered from parsed jobs"
        />
        <StatCard
          label="DTC Definitions"
          value={stats?.dtcCount || 0}
          icon={<AlertCircle size={24} />}
          color="warning"
          loading={loading}
          helpText="Discovered from parsed jobs"
        />
        <StatCard
          label="Routine Definitions"
          value={stats?.routineCount || 0}
          icon={<Wrench size={24} />}
          color="purple"
          loading={loading}
          helpText="Discovered from parsed jobs"
        />
      </div>

      {/* Reparse All Jobs Button */}
      <div className="ds-flex-center" style={{ marginBottom: spacing[6] }}>
        <Button
          variant="error"
          onClick={handleReparseAllJobs}
          disabled={reparsingAll}
          icon={reparsingAll ? undefined : <Zap size={16} />}
        >
          {reparsingAll ? 'Reparsing All Jobs...' : 'Reparse All Jobs'}
        </Button>
      </div>

      {/* Main Content */}
      <Card>
        <div className="ds-flex-between" style={{ marginBottom: spacing[6] }}>
          <div className="ds-tab-group">
            <button
              className={`ds-tab ${activeTab === 'ecu' ? 'ds-tab-active' : ''}`}
              onClick={() => setActiveTab('ecu')}
            >
              ECUs
            </button>
            <button
              className={`ds-tab ${activeTab === 'did' ? 'ds-tab-active' : ''}`}
              onClick={() => setActiveTab('did')}
            >
              DIDs
            </button>
            <button
              className={`ds-tab ${activeTab === 'dtc' ? 'ds-tab-active' : ''}`}
              onClick={() => setActiveTab('dtc')}
            >
              DTCs
            </button>
            <button
              className={`ds-tab ${activeTab === 'routine' ? 'ds-tab-active' : ''}`}
              onClick={() => setActiveTab('routine')}
            >
              Routines
            </button>
          </div>
          <div className="ds-flex-row" style={{ gap: spacing[3] }}>
            <Button
              variant="secondary"
              onClick={handleExport}
              icon={<Download size={16} />}
            >
              Export
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div style={{
          display: 'flex',
          gap: spacing[4],
          marginBottom: spacing[6],
          flexWrap: 'wrap'
        }}>
          <div className="ds-form-group" style={{ minWidth: '150px', flex: '0 1 200px' }}>
            <label className="ds-label">OEM</label>
            <select
              value={selectedOem}
              onChange={(e) => {
                setSelectedOem(e.target.value);
                setSelectedModel('all');
                setSelectedModelYear('all');
              }}
              className="ds-select"
            >
              <option value="all">All OEMs</option>
              {oems.map(oem => (
                <option key={oem.id} value={oem.id}>
                  {oem.name}
                </option>
              ))}
            </select>
          </div>

          {selectedOem !== 'all' && (
            <div className="ds-form-group" style={{ minWidth: '150px', flex: '0 1 200px' }}>
              <label className="ds-label">Model</label>
              <select
                value={selectedModel}
                onChange={(e) => {
                  setSelectedModel(e.target.value);
                  setSelectedModelYear('all');
                }}
                className="ds-select"
              >
                <option value="all">All Models</option>
                {filteredModels.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedModel !== 'all' && (
            <div className="ds-form-group" style={{ minWidth: '150px', flex: '0 1 200px' }}>
              <label className="ds-label">Model Year</label>
              <select
                value={selectedModelYear}
                onChange={(e) => setSelectedModelYear(e.target.value)}
                className="ds-select"
              >
                <option value="all">All Years</option>
                {filteredModelYears.map(year => (
                  <option key={year.id} value={year.id}>
                    {year.year}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="ds-form-group" style={{ minWidth: '200px', flex: '1 1 300px', maxWidth: '400px' }}>
            <label className="ds-label">Search</label>
            <div className="ds-search-wrapper">
              <Search size={16} className="ds-search-icon" />
              <input
                type="text"
                placeholder="Search definitions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="ds-search-input"
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>

        {/* Definitions Table */}
        <Card variant="nested">
            <table className="ds-table">
              <thead>
                <tr>
                  {activeTab === 'ecu' && (
                    <>
                      <th>Address</th>
                      <th>Name</th>
                      <th>Description</th>
                      <th>Job Name</th>
                      <th>OEM</th>
                      <th>Model</th>
                      <th>Model Year</th>
                    </>
                  )}
                  {activeTab === 'did' && (
                    <>
                      <th>DID</th>
                      <th>Name</th>
                      <th>Description</th>
                      <th>Data Type</th>
                      <th>Job Name</th>
                      <th>OEM</th>
                      <th>Model</th>
                      <th>Model Year</th>
                    </>
                  )}
                  {activeTab === 'dtc' && (
                    <>
                      <th>Code</th>
                      <th>Description</th>
                      <th>Severity</th>
                      <th>Job Name</th>
                      <th>OEM</th>
                      <th>Model</th>
                      <th>Model Year</th>
                    </>
                  )}
                  {activeTab === 'routine' && (
                    <>
                      <th>Routine ID</th>
                      <th>Name</th>
                      <th>Description</th>
                      <th>Job Name</th>
                      <th>OEM</th>
                      <th>Model</th>
                      <th>Model Year</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={activeTab === 'ecu' ? 7 : activeTab === 'did' ? 8 : activeTab === 'dtc' ? 7 : 7} className="ds-table-empty">
                      <div className="ds-loading-container">
                        <div className="ds-spinner-large" />
                        <p className="ds-text-secondary">Loading definitions...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredDefinitions.length === 0 ? (
                  <tr>
                    <td colSpan={activeTab === 'ecu' ? 7 : activeTab === 'did' ? 8 : activeTab === 'dtc' ? 7 : 7} className="ds-table-empty">
                      <div className="ds-empty-state">
                        <Database size={32} color={colors.gray[400]} />
                        <h3 className="ds-heading-3">
                          No {activeTab.toUpperCase()} definitions yet
                        </h3>
                        <p className="ds-text-secondary">
                          Knowledge base definitions are automatically discovered and populated<br/>
                          when processing diagnostic jobs. Upload and parse trace files to build your knowledge base.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredDefinitions.map((def) => (
                    <tr key={def.id}>
                      {activeTab === 'ecu' && (
                        <>
                          <td className="ds-text-mono">{def.address}</td>
                          <td onClick={() => !editingId && handleEditStart(def)}>
                            {editingId === def.id ? (
                              <input
                                type="text"
                                value={editingValues.name || ''}
                                onChange={(e) => setEditingValues({...editingValues, name: e.target.value})}
                                onClick={(e) => e.stopPropagation()}
                                className="ds-input-inline"
                              />
                            ) : (
                              <Badge variant="secondary" size="small">{def.name}</Badge>
                            )}
                          </td>
                          <td>
                            {editingId === def.id ? (
                              <div className="ds-flex-row" style={{ gap: spacing[2] }}>
                                <input
                                  type="text"
                                  value={editingValues.description || ''}
                                  onChange={(e) => setEditingValues({...editingValues, description: e.target.value})}
                                  placeholder="Add description"
                                  className="ds-input-inline"
                                  style={{ flex: 1 }}
                                />
                                <Button
                                  variant="success"
                                  size="small"
                                  onClick={() => handleEditSave(def)}
                                >
                                  ✓
                                </Button>
                                <Button
                                  variant="error"
                                  size="small"
                                  onClick={handleEditCancel}
                                >
                                  ✕
                                </Button>
                              </div>
                            ) : (
                              <span
                                onClick={() => handleEditStart(def)}
                                className="ds-editable-text"
                              >
                                {def.description || 'Click to add description'}
                              </span>
                            )}
                          </td>
                          <td className="ds-text-secondary">{def.jobName || '-'}</td>
                          <td>{def.oem?.name || '-'}</td>
                          <td>{def.model?.name || '-'}</td>
                          <td>{def.modelYear?.year || '-'}</td>
                        </>
                      )}
                      {activeTab === 'did' && (
                        <>
                          <td className="ds-text-mono">{def.did}</td>
                          <td style={{ padding: '12px 16px' }} onClick={() => !editingId && handleEditStart(def)}>
                            {editingId === def.id ? (
                              <input
                                type="text"
                                value={editingValues.name || ''}
                                onChange={(e) => setEditingValues({...editingValues, name: e.target.value})}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '13px',
                                  border: '1px solid #3b82f6',
                                  borderRadius: '4px',
                                  backgroundColor: '#ffffff',
                                  outline: 'none'
                                }}
                              />
                            ) : (
                              <span style={{
                                fontSize: '11px',
                                backgroundColor: '#f3f4f6',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                border: '1px solid #e5e7eb',
                                cursor: 'pointer'
                              }}>{def.name}</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {editingId === def.id ? (
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input
                                  type="text"
                                  value={editingValues.description || ''}
                                  onChange={(e) => setEditingValues({...editingValues, description: e.target.value})}
                                  placeholder="Add description"
                                  style={{
                                    flex: 1,
                                    padding: '4px 8px',
                                    fontSize: '13px',
                                    border: '1px solid #3b82f6',
                                    borderRadius: '4px',
                                    backgroundColor: '#ffffff',
                                    outline: 'none'
                                  }}
                                />
                                <button
                                  onClick={() => handleEditSave(def)}
                                  style={{
                                    padding: '4px 8px',
                                    backgroundColor: '#10b981',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    cursor: 'pointer'
                                  }}
                                >✓</button>
                                <button
                                  onClick={handleEditCancel}
                                  style={{
                                    padding: '4px 8px',
                                    backgroundColor: '#ef4444',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    cursor: 'pointer'
                                  }}
                                >✕</button>
                              </div>
                            ) : (
                              <span
                                onClick={() => handleEditStart(def)}
                                style={{
                                  display: 'block',
                                  padding: '4px 8px',
                                  fontSize: '13px',
                                  color: def.description ? '#374151' : '#9ca3af',
                                  cursor: 'pointer',
                                  borderRadius: '4px',
                                  border: '1px solid transparent',
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                {def.description || 'Click to add description'}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '14px' }}>{def.dataType}</td>
                          <td style={{
                            padding: '12px 16px',
                            fontSize: '13px',
                            color: '#6b7280'
                          }}>{def.jobName || '-'}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px' }}>{def.oem?.name || '-'}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px' }}>{def.model?.name || '-'}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px' }}>{def.modelYear?.year || '-'}</td>
                        </>
                      )}
                      {activeTab === 'dtc' && (
                        <>
                          <td style={{
                            padding: '12px 16px',
                            fontFamily: 'monospace',
                            fontSize: '12px'
                          }}>{def.code}</td>
                          <td style={{ padding: '12px 16px' }}>
                            {editingId === def.id ? (
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input
                                  type="text"
                                  value={editingValues.description || ''}
                                  onChange={(e) => setEditingValues({...editingValues, description: e.target.value})}
                                  placeholder="Add description"
                                  style={{
                                    flex: 1,
                                    padding: '4px 8px',
                                    fontSize: '13px',
                                    border: '1px solid #3b82f6',
                                    borderRadius: '4px',
                                    backgroundColor: '#ffffff',
                                    outline: 'none'
                                  }}
                                />
                                <button
                                  onClick={() => handleEditSave(def)}
                                  style={{
                                    padding: '4px 8px',
                                    backgroundColor: '#10b981',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    cursor: 'pointer'
                                  }}
                                >✓</button>
                                <button
                                  onClick={handleEditCancel}
                                  style={{
                                    padding: '4px 8px',
                                    backgroundColor: '#ef4444',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    cursor: 'pointer'
                                  }}
                                >✕</button>
                              </div>
                            ) : (
                              <span
                                onClick={() => handleEditStart(def)}
                                style={{
                                  display: 'block',
                                  padding: '4px 8px',
                                  fontSize: '13px',
                                  color: def.description ? '#374151' : '#9ca3af',
                                  cursor: 'pointer',
                                  borderRadius: '4px',
                                  border: '1px solid transparent',
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                {def.description || 'Click to add description'}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {def.severity && (
                              <span style={{
                                fontSize: '11px',
                                backgroundColor: def.severity === 'HIGH' ? '#ef4444' : def.severity === 'MEDIUM' ? '#f59e0b' : '#6b7280',
                                color: '#ffffff',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontWeight: '500'
                              }}>
                                {def.severity}
                              </span>
                            )}
                          </td>
                          <td style={{
                            padding: '12px 16px',
                            fontSize: '13px',
                            color: '#6b7280'
                          }}>{def.jobName || '-'}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px' }}>{def.oem?.name || '-'}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px' }}>{def.model?.name || '-'}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px' }}>{def.modelYear?.year || '-'}</td>
                        </>
                      )}
                      {activeTab === 'routine' && (
                        <>
                          <td style={{
                            padding: '12px 16px',
                            fontFamily: 'monospace',
                            fontSize: '12px'
                          }}>{def.routineId}</td>
                          <td style={{ padding: '12px 16px' }} onClick={() => !editingId && handleEditStart(def)}>
                            {editingId === def.id ? (
                              <input
                                type="text"
                                value={editingValues.name || ''}
                                onChange={(e) => setEditingValues({...editingValues, name: e.target.value})}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '13px',
                                  border: '1px solid #3b82f6',
                                  borderRadius: '4px',
                                  backgroundColor: '#ffffff',
                                  outline: 'none'
                                }}
                              />
                            ) : (
                              <span style={{
                                fontSize: '11px',
                                backgroundColor: '#f3f4f6',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                border: '1px solid #e5e7eb',
                                cursor: 'pointer'
                              }}>{def.name}</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {editingId === def.id ? (
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input
                                  type="text"
                                  value={editingValues.description || ''}
                                  onChange={(e) => setEditingValues({...editingValues, description: e.target.value})}
                                  placeholder="Add description"
                                  style={{
                                    flex: 1,
                                    padding: '4px 8px',
                                    fontSize: '13px',
                                    border: '1px solid #3b82f6',
                                    borderRadius: '4px',
                                    backgroundColor: '#ffffff',
                                    outline: 'none'
                                  }}
                                />
                                <button
                                  onClick={() => handleEditSave(def)}
                                  style={{
                                    padding: '4px 8px',
                                    backgroundColor: '#10b981',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    cursor: 'pointer'
                                  }}
                                >✓</button>
                                <button
                                  onClick={handleEditCancel}
                                  style={{
                                    padding: '4px 8px',
                                    backgroundColor: '#ef4444',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    cursor: 'pointer'
                                  }}
                                >✕</button>
                              </div>
                            ) : (
                              <span
                                onClick={() => handleEditStart(def)}
                                style={{
                                  display: 'block',
                                  padding: '4px 8px',
                                  fontSize: '13px',
                                  color: def.description ? '#374151' : '#9ca3af',
                                  cursor: 'pointer',
                                  borderRadius: '4px',
                                  border: '1px solid transparent',
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                {def.description || 'Click to add description'}
                              </span>
                            )}
                          </td>
                          <td style={{
                            padding: '12px 16px',
                            fontSize: '13px',
                            color: '#6b7280'
                          }}>{def.jobName || '-'}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px' }}>{def.oem?.name || '-'}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px' }}>{def.model?.name || '-'}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px' }}>{def.modelYear?.year || '-'}</td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
        </Card>
      </Card>
      </div>
    </PageLayout>
  );
}