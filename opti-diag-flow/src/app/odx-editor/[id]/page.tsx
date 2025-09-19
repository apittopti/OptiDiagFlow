"use client"

import { useEffect, useState } from 'react'
import { PageLayout } from '@/components/layout/page-layout'
import {
  ChevronRight,
  ChevronDown,
  Database,
  Cpu,
  FileText,
  Settings,
  Package,
  Network,
  Download,
  Upload,
  Edit,
  Save,
  Plus,
  Trash2,
  Search,
  AlertCircle,
  CheckCircle,
  Hash,
  Zap,
  Car,
  X,
  FileCode,
  Code,
  Terminal,
  Layers,
  Activity,
  Shield,
  Lock,
  Folder,
  FolderOpen
} from 'lucide-react'

interface ODXNode {
  id: string
  name: string
  type: 'project' | 'vehicle' | 'ecu' | 'service' | 'dtc' | 'did' | 'routine' | 'layer'
  children?: ODXNode[]
  metadata?: any
  expanded?: boolean
}

export default function ODXEditorPage() {
  const [odxTree, setOdxTree] = useState<ODXNode[]>([])
  const [selectedNode, setSelectedNode] = useState<ODXNode | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('properties')

  useEffect(() => {
    fetchODXData()
  }, [])

  const fetchODXData = async () => {
    try {
      const response = await fetch('/api/odx-management/hierarchy')
      if (response.ok) {
        const data = await response.json()
        const tree = buildODXTree(data)
        setOdxTree(tree)
      }
    } catch (error) {
      console.error('Error fetching ODX data:', error)
    } finally {
      setLoading(false)
    }
  }

  const buildODXTree = (data: any): ODXNode[] => {
    return [
      {
        id: '1',
        name: 'OptiDiagFlow Project',
        type: 'project',
        expanded: true,
        children: [
          {
            id: '2',
            name: 'Vehicles',
            type: 'vehicle',
            expanded: true,
            children: [
              {
                id: '3',
                name: 'Land Rover Defender 2020',
                type: 'vehicle',
                metadata: { vin: 'SALXXXXXX', year: 2020 },
                children: [
                  {
                    id: '4',
                    name: 'Camera Control Module (1706)',
                    type: 'ecu',
                    metadata: { address: '1706' },
                    children: [
                      {
                        id: '5',
                        name: 'Services',
                        type: 'service',
                        children: [
                          { id: '6', name: 'Session Control (0x10)', type: 'service' },
                          { id: '7', name: 'Read Data (0x22)', type: 'service' },
                          { id: '8', name: 'Routine Control (0x31)', type: 'service' }
                        ]
                      },
                      {
                        id: '9',
                        name: 'Data Identifiers',
                        type: 'did',
                        children: [
                          { id: '10', name: 'ECU Status (DD09)', type: 'did' },
                          { id: '11', name: 'Software Version (F189)', type: 'did' }
                        ]
                      },
                      {
                        id: '12',
                        name: 'Routines',
                        type: 'routine',
                        children: [
                          { id: '13', name: 'Camera Calibration (0800)', type: 'routine' }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {
            id: '14',
            name: 'Protocol Layers',
            type: 'layer',
            children: [
              { id: '15', name: 'ISO 14229 UDS', type: 'layer' },
              { id: '16', name: 'ISO 13400 DOIP', type: 'layer' }
            ]
          }
        ]
      }
    ]
  }

  const toggleNode = (nodeId: string) => {
    const toggleRecursive = (nodes: ODXNode[]): ODXNode[] => {
      return nodes.map(node => {
        if (node.id === nodeId) {
          return { ...node, expanded: !node.expanded }
        }
        if (node.children) {
          return { ...node, children: toggleRecursive(node.children) }
        }
        return node
      })
    }
    setOdxTree(toggleRecursive(odxTree))
  }

  const renderTreeNode = (node: ODXNode, level: number = 0) => {
    const hasChildren = node.children && node.children.length > 0
    const isExpanded = node.expanded

    const getNodeIcon = () => {
      switch (node.type) {
        case 'project': return <Database className="h-4 w-4 text-gray-600" />
        case 'vehicle': return <Car className="h-4 w-4 text-gray-600" />
        case 'ecu': return <Cpu className="h-4 w-4 text-gray-600" />
        case 'service': return <Settings className="h-4 w-4 text-gray-600" />
        case 'dtc': return <AlertCircle className="h-4 w-4 text-gray-600" />
        case 'did': return <Hash className="h-4 w-4 text-gray-600" />
        case 'routine': return <Zap className="h-4 w-4 text-gray-600" />
        case 'layer': return <Layers className="h-4 w-4 text-gray-600" />
        default: return <FileText className="h-4 w-4 text-gray-600" />
      }
    }

    return (
      <div key={node.id}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 12px',
            paddingLeft: `${level * 20 + 12}px`,
            backgroundColor: selectedNode?.id === node.id ? '#f3f4f6' : 'transparent',
            borderRadius: '6px',
            cursor: 'pointer',
            marginBottom: '2px',
            border: selectedNode?.id === node.id ? '1px solid #d1d5db' : '1px solid transparent'
          }}
          onClick={() => {
            setSelectedNode(node)
            if (hasChildren) toggleNode(node.id)
          }}
        >
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleNode(node.id)
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px',
                marginRight: '4px',
                display: 'flex',
                alignItems: 'center',
                color: '#6b7280'
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          {!hasChildren && <span style={{ marginRight: '20px' }} />}
          <span style={{ marginRight: '8px' }}>{getNodeIcon()}</span>
          <span style={{
            fontSize: '14px',
            fontWeight: selectedNode?.id === node.id ? '600' : '400',
            color: selectedNode?.id === node.id ? '#111827' : '#374151'
          }}>
            {node.name}
          </span>
        </div>
        {isExpanded && hasChildren && (
          <div>
            {node.children!.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  const exportODX = async () => {
    try {
      const response = await fetch('/api/odx-management/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId: selectedNode?.id })
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `odx-export-${Date.now()}.xml`
        a.click()
      }
    } catch (error) {
      console.error('Error exporting ODX:', error)
    }
  }

  return (
    <PageLayout
      title="ODX Editor"
      description="Edit and manage ODX structures for discovered ECUs">

      {/* Action Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '32px'
      }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 16px',
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '14px',
            cursor: 'pointer'
          }}>
            <Upload className="h-4 w-4 text-gray-600" />
            <span>Import ODX</span>
          </button>
          <button
            onClick={exportODX}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 16px',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              cursor: 'pointer'
            }}>
            <Download className="h-4 w-4" />
            <span>Export ODX</span>
          </button>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          color: '#6b7280'
        }}>
          <Activity className="h-4 w-4" />
          <span>Live Sync</span>
          <div style={{
            height: '8px',
            width: '8px',
            backgroundColor: '#10b981',
            borderRadius: '50%'
          }}></div>
        </div>
      </div>

      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '32px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px'
        }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 8px 0' }}>
              ODX Structure
            </h2>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
              Explore and edit ODX diagnostic elements and their properties
            </p>
          </div>
          <button style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            backgroundColor: '#3b82f6',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer'
          }}>
            <Plus size={16} />
            Add Element
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
          {/* Tree View */}
          <div>
            <div style={{
              backgroundColor: '#fafafa',
              borderRadius: '8px',
              padding: '16px',
              border: '1px solid #e5e7eb',
              minHeight: '700px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px'
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>
                  Element Tree
                </h3>
                <button style={{
                  padding: '6px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}>
                  <Plus className="h-4 w-4 text-gray-600" />
                </button>
              </div>
              <div style={{ position: 'relative', marginBottom: '16px' }}>
                <Search style={{
                  position: 'absolute',
                  left: '12px',
                  top: '10px',
                  height: '16px',
                  width: '16px',
                  color: '#9ca3af'
                }} />
                <input
                  type="text"
                  placeholder="Search elements..."
                  style={{
                    width: '100%',
                    paddingLeft: '36px',
                    paddingRight: '12px',
                    paddingTop: '8px',
                    paddingBottom: '8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div style={{ overflowY: 'auto', maxHeight: '600px' }}>
                {loading ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '48px 0'
                  }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      border: '2px solid #e5e7eb',
                      borderTopColor: '#3b82f6',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    <span style={{
                      fontSize: '14px',
                      color: '#6b7280',
                      marginTop: '12px'
                    }}>Loading ODX structure...</span>
                  </div>
                ) : (
                  <div style={{ padding: '4px 0' }}>
                    {odxTree.map(node => renderTreeNode(node))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Detail View */}
          <div>
            {selectedNode ? (
              <div style={{
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                padding: '20px',
                border: '1px solid #e5e7eb',
                minHeight: '700px'
              }}>
                <div style={{
                  paddingBottom: '16px',
                  borderBottom: '1px solid #e5e7eb',
                  marginBottom: '16px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {(() => {
                        switch (selectedNode.type) {
                          case 'ecu': return <Cpu className="h-5 w-5 text-gray-600" />
                          case 'service': return <Settings className="h-5 w-5 text-gray-600" />
                          case 'did': return <Hash className="h-5 w-5 text-gray-600" />
                          case 'routine': return <Zap className="h-5 w-5 text-gray-600" />
                          case 'vehicle': return <Car className="h-5 w-5 text-gray-600" />
                          case 'layer': return <Layers className="h-5 w-5 text-gray-600" />
                          default: return <FileText className="h-5 w-5 text-gray-600" />
                        }
                      })()}
                      <div>
                        <h2 style={{
                          fontSize: '18px',
                          fontWeight: '600',
                          margin: 0,
                          color: '#111827'
                        }}>{selectedNode.name}</h2>
                        <p style={{
                          fontSize: '12px',
                          color: '#6b7280',
                          textTransform: 'uppercase',
                          margin: 0
                        }}>{selectedNode.type}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {editMode ? (
                        <>
                          <button
                            onClick={() => setEditMode(false)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 12px',
                              backgroundColor: '#10b981',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '14px',
                              cursor: 'pointer'
                            }}>
                            <Save className="h-3.5 w-3.5" />
                            Save
                          </button>
                          <button
                            onClick={() => setEditMode(false)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#f3f4f6',
                              color: '#374151',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              fontSize: '14px',
                              cursor: 'pointer'
                            }}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setEditMode(true)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            backgroundColor: '#ffffff',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '14px',
                            cursor: 'pointer'
                          }}>
                          <Edit className="h-3.5 w-3.5 text-gray-600" />
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div style={{
                  borderBottom: '1px solid #e5e7eb',
                  backgroundColor: '#f9fafb',
                  marginBottom: '16px'
                }}>
                  <nav style={{ display: 'flex', gap: 0, paddingLeft: '0' }}>
                    {['Properties', 'Parameters', 'Responses', 'Raw XML'].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab.toLowerCase().replace(' ', ''))}
                        style={{
                          padding: '12px 16px',
                          borderBottom: activeTab === tab.toLowerCase().replace(' ', '') ? '2px solid #3b82f6' : '2px solid transparent',
                          fontWeight: '500',
                          fontSize: '14px',
                          backgroundColor: activeTab === tab.toLowerCase().replace(' ', '') ? '#ffffff' : 'transparent',
                          color: activeTab === tab.toLowerCase().replace(' ', '') ? '#3b82f6' : '#6b7280',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        {tab}
                      </button>
                    ))}
                  </nav>
                </div>

                {/* Tab Content */}
                <div style={{ overflowY: 'auto', padding: '0' }}>
                {activeTab === 'properties' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      padding: '20px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <h4 style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        marginBottom: '16px',
                        color: '#111827'
                      }}>Basic Properties</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px', width: '100%' }}>
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: '500',
                            marginBottom: '6px',
                            color: '#374151'
                          }}>Identifier</label>
                          <input
                            type="text"
                            value={selectedNode.id}
                            disabled={!editMode}
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              fontSize: '14px',
                              backgroundColor: editMode ? '#ffffff' : '#f9fafb',
                              color: editMode ? '#111827' : '#6b7280',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: '500',
                            marginBottom: '6px',
                            color: '#374151'
                          }}>Type</label>
                          <input
                            type="text"
                            value={selectedNode.type.toUpperCase()}
                            disabled
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              fontSize: '14px',
                              backgroundColor: '#f9fafb',
                              color: '#6b7280',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                          <label style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: '500',
                            marginBottom: '6px',
                            color: '#374151'
                          }}>Name</label>
                          <input
                            type="text"
                            value={selectedNode.name}
                            disabled={!editMode}
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              fontSize: '14px',
                              backgroundColor: editMode ? '#ffffff' : '#f9fafb',
                              color: editMode ? '#111827' : '#6b7280',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {selectedNode.type === 'ecu' && (
                      <div style={{
                        backgroundColor: '#eff6ff',
                        borderRadius: '8px',
                        padding: '20px',
                        border: '1px solid #bfdbfe'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '16px'
                        }}>
                          <Shield className="h-5 w-5 text-blue-600" />
                          <h4 style={{
                            fontSize: '16px',
                            fontWeight: '600',
                            color: '#111827',
                            margin: 0
                          }}>ECU Information</h4>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div style={{
                            backgroundColor: '#ffffff',
                            borderRadius: '6px',
                            padding: '16px',
                            border: '1px solid #dbeafe'
                          }}>
                            <p style={{
                              fontSize: '12px',
                              color: '#6b7280',
                              marginBottom: '4px',
                              textTransform: 'uppercase',
                              fontWeight: '500'
                            }}>Physical Address</p>
                            <p style={{
                              fontSize: '14px',
                              fontWeight: '600',
                              color: '#111827',
                              margin: 0
                            }}>0x{selectedNode.metadata?.address || '0000'}</p>
                          </div>
                          <div style={{
                            backgroundColor: '#ffffff',
                            borderRadius: '6px',
                            padding: '16px',
                            border: '1px solid #dbeafe'
                          }}>
                            <p style={{
                              fontSize: '12px',
                              color: '#6b7280',
                              marginBottom: '4px',
                              textTransform: 'uppercase',
                              fontWeight: '500'
                            }}>Protocol</p>
                            <p style={{
                              fontSize: '14px',
                              fontWeight: '600',
                              color: '#111827',
                              margin: 0
                            }}>ISO 14229 (UDS)</p>
                          </div>
                          <div style={{
                            backgroundColor: '#ffffff',
                            borderRadius: '6px',
                            padding: '16px',
                            border: '1px solid #dbeafe'
                          }}>
                            <p style={{
                              fontSize: '12px',
                              color: '#6b7280',
                              marginBottom: '4px',
                              textTransform: 'uppercase',
                              fontWeight: '500'
                            }}>Transport</p>
                            <p style={{
                              fontSize: '14px',
                              fontWeight: '600',
                              color: '#111827',
                              margin: 0
                            }}>DOIP</p>
                          </div>
                          <div style={{
                            backgroundColor: '#ffffff',
                            borderRadius: '6px',
                            padding: '16px',
                            border: '1px solid #dbeafe'
                          }}>
                            <p style={{
                              fontSize: '12px',
                              color: '#6b7280',
                              marginBottom: '4px',
                              textTransform: 'uppercase',
                              fontWeight: '500'
                            }}>Security Level</p>
                            <p style={{
                              fontSize: '14px',
                              fontWeight: '600',
                              color: '#111827',
                              margin: 0
                            }}>Level 1</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedNode.type === 'service' && (
                      <div style={{
                        backgroundColor: '#fff7ed',
                        borderRadius: '8px',
                        padding: '20px',
                        border: '1px solid #fed7aa'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '16px'
                        }}>
                          <Terminal className="h-5 w-5 text-orange-600" />
                          <h4 style={{
                            fontSize: '16px',
                            fontWeight: '600',
                            color: '#111827',
                            margin: 0
                          }}>Service Configuration</h4>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px 16px',
                            backgroundColor: '#ffffff',
                            borderRadius: '6px',
                            border: '1px solid #fde68a'
                          }}>
                            <span style={{ fontSize: '14px', color: '#6b7280' }}>Service ID</span>
                            <span style={{
                              fontSize: '14px',
                              fontFamily: 'monospace',
                              fontWeight: '600',
                              color: '#111827'
                            }}>0x10</span>
                          </div>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px 16px',
                            backgroundColor: '#ffffff',
                            borderRadius: '6px',
                            border: '1px solid #fde68a'
                          }}>
                            <span style={{ fontSize: '14px', color: '#6b7280' }}>Addressing Mode</span>
                            <span style={{
                              fontSize: '14px',
                              fontWeight: '600',
                              color: '#111827'
                            }}>Physical</span>
                          </div>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px 16px',
                            backgroundColor: '#ffffff',
                            borderRadius: '6px',
                            border: '1px solid #fde68a'
                          }}>
                            <span style={{ fontSize: '14px', color: '#6b7280' }}>Response Required</span>
                            <span style={{
                              fontSize: '14px',
                              fontWeight: '600',
                              color: '#111827'
                            }}>Yes</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'parameters' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      padding: '20px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '16px'
                      }}>
                        <h4 style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          color: '#111827',
                          margin: 0
                        }}>Request Parameters</h4>
                        {editMode && (
                          <button style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            backgroundColor: '#3b82f6',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            cursor: 'pointer'
                          }}>
                            <Plus className="h-3.5 w-3.5" />
                            Add Parameter
                          </button>
                        )}
                      </div>

                      <div style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        overflow: 'hidden'
                      }}>
                        <table style={{ width: '100%' }}>
                          <thead style={{
                            backgroundColor: '#f9fafb',
                            borderBottom: '1px solid #e5e7eb'
                          }}>
                            <tr>
                              <th style={{
                                padding: '12px 16px',
                                textAlign: 'left',
                                fontSize: '12px',
                                fontWeight: '500',
                                color: '#6b7280',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                              }}>Name</th>
                              <th style={{
                                padding: '12px 16px',
                                textAlign: 'left',
                                fontSize: '12px',
                                fontWeight: '500',
                                color: '#6b7280',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                              }}>Position</th>
                              <th style={{
                                padding: '12px 16px',
                                textAlign: 'left',
                                fontSize: '12px',
                                fontWeight: '500',
                                color: '#6b7280',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                              }}>Length</th>
                              <th style={{
                                padding: '12px 16px',
                                textAlign: 'left',
                                fontSize: '12px',
                                fontWeight: '500',
                                color: '#6b7280',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                              }}>Type</th>
                            </tr>
                          </thead>
                          <tbody style={{ backgroundColor: '#ffffff' }}>
                            <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{
                                padding: '12px 16px',
                                fontSize: '14px',
                                color: '#111827'
                              }}>diagnosticSessionType</td>
                              <td style={{
                                padding: '12px 16px',
                                fontSize: '14px',
                                color: '#6b7280'
                              }}>1</td>
                              <td style={{
                                padding: '12px 16px',
                                fontSize: '14px',
                                color: '#6b7280'
                              }}>1 byte</td>
                              <td style={{
                                padding: '12px 16px',
                                fontSize: '14px',
                                fontFamily: 'monospace',
                                color: '#111827'
                              }}>UINT8</td>
                            </tr>
                            <tr>
                              <td style={{
                                padding: '12px 16px',
                                fontSize: '14px',
                                color: '#111827'
                              }}>suppressPosRspMsgIndicationBit</td>
                              <td style={{
                                padding: '12px 16px',
                                fontSize: '14px',
                                color: '#6b7280'
                              }}>2</td>
                              <td style={{
                                padding: '12px 16px',
                                fontSize: '14px',
                                color: '#6b7280'
                              }}>1 byte</td>
                              <td style={{
                                padding: '12px 16px',
                                fontSize: '14px',
                                fontFamily: 'monospace',
                                color: '#111827'
                              }}>BOOL</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'responses' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      padding: '20px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <h4 style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#111827',
                        margin: '0 0 16px 0'
                      }}>Response Structure</h4>

                      <div style={{
                        backgroundColor: '#f0fdf4',
                        borderRadius: '8px',
                        padding: '16px',
                        border: '1px solid #bbf7d0',
                        marginBottom: '16px'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '12px'
                        }}>
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <span style={{
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#111827'
                          }}>Positive Response</span>
                        </div>
                        <div style={{
                          backgroundColor: '#ffffff',
                          borderRadius: '6px',
                          padding: '12px',
                          border: '1px solid #bbf7d0'
                        }}>
                          <code style={{
                            fontSize: '14px',
                            fontFamily: 'monospace',
                            color: '#374151',
                            backgroundColor: 'transparent'
                          }}>
                            0x50 + diagnosticSessionType
                          </code>
                        </div>
                      </div>

                      <div style={{
                        backgroundColor: '#fef2f2',
                        borderRadius: '8px',
                        padding: '16px',
                        border: '1px solid #fecaca'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '12px'
                        }}>
                          <AlertCircle className="h-5 w-5 text-red-600" />
                          <span style={{
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#111827'
                          }}>Negative Response</span>
                        </div>
                        <div style={{
                          backgroundColor: '#ffffff',
                          borderRadius: '6px',
                          padding: '12px',
                          border: '1px solid #fecaca'
                        }}>
                          <code style={{
                            fontSize: '14px',
                            fontFamily: 'monospace',
                            color: '#374151',
                            backgroundColor: 'transparent'
                          }}>
                            0x7F + serviceId + NRC
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'rawxml' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <h3 style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#111827'
                      }}>ODX XML Structure</h3>
                      <button style={{
                        padding: '6px 12px',
                        backgroundColor: '#f3f4f6',
                        color: '#374151',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '14px',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#e5e7eb'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = '#f3f4f6'}>
                        <FileCode style={{ height: '14px', width: '14px' }} />
                        Copy XML
                      </button>
                    </div>
                    <div style={{
                      backgroundColor: '#1f2937',
                      borderRadius: '8px',
                      padding: '16px',
                      overflowX: 'auto',
                      border: '1px solid #374151'
                    }}>
                      <pre style={{
                        color: '#f9fafb',
                        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                        fontSize: '12px',
                        margin: '0',
                        lineHeight: '1.6'
                      }}>
{`<DIAG-SERVICE ID="${selectedNode.id}">
  <SHORT-NAME>${selectedNode.name}</SHORT-NAME>
  <LONG-NAME>${selectedNode.name} Service</LONG-NAME>
  <ADDRESSING>PHYSICAL-ADDRESSING</ADDRESSING>
  <REQUEST>
    <PARAMS>
      <PARAM SEMANTIC="SERVICE-ID">
        <SHORT-NAME>diagnosticSessionType</SHORT-NAME>
        <BYTE-POSITION>1</BYTE-POSITION>
        <DOP-REF>
          <DOP-SNREF>diagnosticSessionType_DOP</DOP-SNREF>
        </DOP-REF>
      </PARAM>
    </PARAMS>
  </REQUEST>
  <POS-RESPONSE>
    <PARAMS>
      <PARAM SEMANTIC="SERVICE-ID">
        <SHORT-NAME>diagnosticSessionType</SHORT-NAME>
        <BYTE-POSITION>2</BYTE-POSITION>
      </PARAM>
    </PARAMS>
  </POS-RESPONSE>
</DIAG-SERVICE>`}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
            ) : (
              <div style={{
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                padding: '20px',
                border: '1px solid #e5e7eb',
                minHeight: '700px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <Database style={{
                    height: '48px',
                    width: '48px',
                    color: '#9ca3af',
                    margin: '0 auto 16px auto'
                  }} />
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#111827',
                    marginBottom: '8px'
                  }}>No Element Selected</h3>
                  <p style={{
                    fontSize: '14px',
                    color: '#6b7280'
                  }}>
                    Select an element from the ODX structure tree to view and edit its properties
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  )
}