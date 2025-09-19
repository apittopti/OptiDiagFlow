'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageLayout } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '32px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '32px'
      }}>
        <div style={{
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          padding: '20px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>ECU Definitions</p>
              <p style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>{stats?.ecuCount || 0}</p>
              <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Discovered from parsed jobs</p>
            </div>
            <Package size={24} style={{ color: '#3b82f6' }} />
          </div>
        </div>

        <div style={{
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          padding: '20px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>DID Definitions</p>
              <p style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>{stats?.didCount || 0}</p>
              <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Discovered from parsed jobs</p>
            </div>
            <BookOpen size={24} style={{ color: '#10b981' }} />
          </div>
        </div>

        <div style={{
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          padding: '20px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>DTC Definitions</p>
              <p style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>{stats?.dtcCount || 0}</p>
              <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Discovered from parsed jobs</p>
            </div>
            <AlertCircle size={24} style={{ color: '#f97316' }} />
          </div>
        </div>

        <div style={{
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          padding: '20px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Routine Definitions</p>
              <p style={{ fontSize: '24px', fontWeight: '700', margin: 0 }}>{stats?.routineCount || 0}</p>
              <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Discovered from parsed jobs</p>
            </div>
            <Wrench size={24} style={{ color: '#8b5cf6' }} />
          </div>
        </div>
      </div>

      {/* Reparse All Jobs Button */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '24px'
      }}>
        <Button
          onClick={handleReparseAllJobs}
          disabled={reparsingAll}
          style={{
            backgroundColor: reparsingAll ? '#9ca3af' : '#dc2626',
            color: '#ffffff',
            padding: '12px 24px',
            fontSize: '16px',
            fontWeight: '600',
            borderRadius: '8px',
            border: 'none',
            cursor: reparsingAll ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {reparsingAll ? (
            <>
              ⏳ Reparsing All Jobs...
            </>
          ) : (
            <>
              <Zap size={16} />
              Reparse All Jobs
            </>
          )}
        </Button>
      </div>

      {/* Main Content */}
      <div style={{
        backgroundColor: '#fafafa',
        borderRadius: '8px',
        padding: '24px',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <div style={{
            display: 'flex',
            gap: '8px',
            backgroundColor: '#e5e7eb',
            borderRadius: '8px',
            padding: '4px'
          }}>
              <button
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: activeTab === 'ecu' ? '#3b82f6' : 'transparent',
                  color: activeTab === 'ecu' ? '#ffffff' : '#6b7280',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
                onClick={() => setActiveTab('ecu')}
              >
                ECUs
              </button>
              <button
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: activeTab === 'did' ? '#3b82f6' : 'transparent',
                  color: activeTab === 'did' ? '#ffffff' : '#6b7280',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
                onClick={() => setActiveTab('did')}
              >
                DIDs
              </button>
              <button
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: activeTab === 'dtc' ? '#3b82f6' : 'transparent',
                  color: activeTab === 'dtc' ? '#ffffff' : '#6b7280',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
                onClick={() => setActiveTab('dtc')}
              >
                DTCs
              </button>
              <button
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: activeTab === 'routine' ? '#3b82f6' : 'transparent',
                  color: activeTab === 'routine' ? '#ffffff' : '#6b7280',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
                onClick={() => setActiveTab('routine')}
              >
                Routines
              </button>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleExport}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  backgroundColor: '#ffffff',
                  color: '#374151',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                <Download size={16} />
                Export
              </button>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                backgroundColor: '#ffffff',
                color: '#374151',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}>
                <Upload size={16} />
                Import
                <input
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImport(file);
                  }}
                />
              </label>
            </div>
          </div>

          {/* Filters */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <div>
              <p style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>OEM</p>
              <select
                value={selectedOem}
                onChange={(e) => {
                  setSelectedOem(e.target.value);
                  setSelectedModel('all');
                  setSelectedModelYear('all');
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  backgroundColor: '#ffffff',
                  color: '#374151',
                  fontSize: '14px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
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
              <div>
                <p style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>Model</p>
                <select
                  value={selectedModel}
                  onChange={(e) => {
                    setSelectedModel(e.target.value);
                    setSelectedModelYear('all');
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    color: '#374151',
                    fontSize: '14px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
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
              <div>
                <p style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>Model Year</p>
                <select
                  value={selectedModelYear}
                  onChange={(e) => setSelectedModelYear(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    color: '#374151',
                    fontSize: '14px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
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

            <div style={{ gridColumn: 'span 2' }}>
              <p style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#374151' }}>Search</p>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9ca3af'
                }} />
                <input
                  type="text"
                  placeholder="Search definitions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 40px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Definitions Table */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            overflow: 'hidden'
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px'
            }}>
              <thead style={{
                backgroundColor: '#f9fafb',
                borderBottom: '2px solid #e5e7eb'
              }}>
                <tr>
                  {activeTab === 'ecu' && (
                    <>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Address</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Name</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Description</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Job Name</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>OEM</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Model</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Model Year</th>
                    </>
                  )}
                  {activeTab === 'did' && (
                    <>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>DID</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Name</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Description</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Data Type</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Job Name</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>OEM</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Model</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Model Year</th>
                    </>
                  )}
                  {activeTab === 'dtc' && (
                    <>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Code</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Description</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Severity</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Job Name</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>OEM</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Model</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Model Year</th>
                    </>
                  )}
                  {activeTab === 'routine' && (
                    <>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Routine ID</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Name</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Description</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Job Name</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>OEM</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Model</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Model Year</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={activeTab === 'ecu' ? 7 : activeTab === 'did' ? 8 : activeTab === 'dtc' ? 7 : 7} style={{
                      textAlign: 'center',
                      padding: '32px',
                      color: '#9ca3af'
                    }}>
                      Loading definitions...
                    </td>
                  </tr>
                ) : filteredDefinitions.length === 0 ? (
                  <tr>
                    <td colSpan={activeTab === 'ecu' ? 7 : activeTab === 'did' ? 8 : activeTab === 'dtc' ? 7 : 7} style={{
                      textAlign: 'center',
                      padding: '48px',
                      color: '#6b7280'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                        <Database size={32} style={{ color: '#9ca3af' }} />
                        <div>
                          <p style={{ fontSize: '16px', fontWeight: '500', margin: '0 0 8px 0' }}>
                            No {activeTab.toUpperCase()} definitions yet
                          </p>
                          <p style={{ fontSize: '14px', margin: 0, lineHeight: '1.5' }}>
                            Knowledge base definitions are automatically discovered and populated<br/>
                            when processing diagnostic jobs. Upload and parse trace files to build your knowledge base.
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredDefinitions.map((def) => (
                    <tr key={def.id} style={{
                      borderBottom: '1px solid #f3f4f6'
                    }}>
                      {activeTab === 'ecu' && (
                        <>
                          <td style={{
                            padding: '12px 16px',
                            fontFamily: 'monospace',
                            fontSize: '12px'
                          }}>{def.address}</td>
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
                      {activeTab === 'did' && (
                        <>
                          <td style={{
                            padding: '12px 16px',
                            fontFamily: 'monospace',
                            fontSize: '12px'
                          }}>{def.did}</td>
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
          </div>
        </div>
      </div>
    </PageLayout>
  );
}