'use client';

import React, { useState } from 'react';
import PageLayout from '@/components/layout/page-layout';
import { ChevronRight, ChevronDown, Car, Calendar, Package, Layers, Database, AlertTriangle, Settings, FileText, Plus, Edit, Trash2, Copy, Download, Upload, Search } from 'lucide-react';

interface OdxNode {
  id: string;
  name: string;
  type: 'oem' | 'model' | 'year' | 'variant' | 'layer';
  children?: OdxNode[];
  metadata?: {
    ecuCount?: number;
    dtcCount?: number;
    didCount?: number;
    serviceCount?: number;
    lastModified?: string;
    version?: string;
    status?: 'active' | 'draft' | 'deprecated';
  };
}

const mockOdxStructure: OdxNode[] = [
  {
    id: '1',
    name: 'BMW',
    type: 'oem',
    children: [
      {
        id: '2',
        name: '3 Series',
        type: 'model',
        children: [
          {
            id: '3',
            name: '2021',
            type: 'year',
            metadata: { ecuCount: 42, dtcCount: 285, didCount: 1523, serviceCount: 98, lastModified: '2024-01-15', version: '2.3.1', status: 'active' },
            children: [
              { id: '4', name: 'Base Variant', type: 'variant', metadata: { ecuCount: 35, dtcCount: 220 } },
              { id: '5', name: 'M Sport Package', type: 'variant', metadata: { ecuCount: 42, dtcCount: 285 } }
            ]
          },
          {
            id: '6',
            name: '2022',
            type: 'year',
            metadata: { ecuCount: 45, dtcCount: 298, didCount: 1612, serviceCount: 102, lastModified: '2024-02-10', version: '2.4.0', status: 'active' }
          }
        ]
      },
      {
        id: '7',
        name: 'X5',
        type: 'model',
        children: [
          {
            id: '8',
            name: '2022',
            type: 'year',
            metadata: { ecuCount: 48, dtcCount: 312, didCount: 1789, serviceCount: 105, lastModified: '2024-01-20', version: '1.8.2', status: 'active' }
          }
        ]
      }
    ]
  },
  {
    id: '9',
    name: 'Mercedes-Benz',
    type: 'oem',
    children: [
      {
        id: '10',
        name: 'C-Class',
        type: 'model',
        children: [
          {
            id: '11',
            name: '2020',
            type: 'year',
            metadata: { ecuCount: 38, dtcCount: 256, didCount: 1423, serviceCount: 89, lastModified: '2023-12-05', version: '3.1.0', status: 'active' }
          }
        ]
      }
    ]
  },
  {
    id: '12',
    name: 'Audi',
    type: 'oem',
    children: [
      {
        id: '13',
        name: 'A4',
        type: 'model',
        children: [
          {
            id: '14',
            name: '2022',
            type: 'year',
            metadata: { ecuCount: 45, dtcCount: 278, didCount: 1567, serviceCount: 95, lastModified: '2024-02-01', version: '2.0.5', status: 'active' }
          }
        ]
      }
    ]
  }
];

const typeIcons = {
  oem: Car,
  model: Package,
  year: Calendar,
  variant: Layers,
  layer: Database
};

const typeColors = {
  oem: '#3b82f6',
  model: '#8b5cf6',
  year: '#10b981',
  variant: '#f59e0b',
  layer: '#ef4444'
};

const statusColors = {
  active: '#10b981',
  draft: '#f59e0b',
  deprecated: '#6b7280'
};

export default function OdxManagementPage() {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['1', '2', '3']));
  const [selectedNode, setSelectedNode] = useState<OdxNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const renderHierarchyNode = (node: OdxNode, level: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const Icon = typeIcons[node.type];
    const iconColor = typeColors[node.type];

    return (
      <div key={node.id}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 12px',
            paddingLeft: `${12 + level * 28}px`,
            cursor: 'pointer',
            backgroundColor: selectedNode?.id === node.id ? '#e0e7ff' : 'transparent',
            borderRadius: '8px',
            margin: '2px 0',
            transition: 'all 0.2s'
          }}
          onClick={() => {
            if (hasChildren) {
              toggleNode(node.id);
            }
            setSelectedNode(node);
          }}
          onMouseEnter={(e) => {
            if (selectedNode?.id !== node.id) {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
            }
          }}
          onMouseLeave={(e) => {
            if (selectedNode?.id !== node.id) {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          {hasChildren && (
            <div style={{ marginRight: '6px' }}>
              {isExpanded ? (
                <ChevronDown style={{ width: 16, height: 16, color: '#6b7280' }} />
              ) : (
                <ChevronRight style={{ width: 16, height: 16, color: '#6b7280' }} />
              )}
            </div>
          )}
          {!hasChildren && <div style={{ width: '22px' }} />}

          <div style={{
            padding: '6px',
            backgroundColor: `${iconColor}15`,
            borderRadius: '6px',
            marginRight: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Icon style={{ width: 16, height: 16, color: iconColor }} />
          </div>

          <span style={{ fontSize: '14px', color: '#111827', fontWeight: '500', flex: 1 }}>
            {node.name}
          </span>

          {node.metadata?.status && (
            <span style={{
              fontSize: '11px',
              padding: '3px 8px',
              borderRadius: '12px',
              backgroundColor: `${statusColors[node.metadata.status]}15`,
              color: statusColors[node.metadata.status],
              fontWeight: '500',
              textTransform: 'uppercase'
            }}>
              {node.metadata.status}
            </span>
          )}

          {node.metadata?.ecuCount && (
            <span style={{
              fontSize: '12px',
              color: '#6b7280',
              backgroundColor: '#f3f4f6',
              padding: '3px 8px',
              borderRadius: '6px',
              marginLeft: '8px'
            }}>
              {node.metadata.ecuCount} ECUs
            </span>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div>
            {node.children!.map(child => renderHierarchyNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <PageLayout
      title="ODX Management"
      description="Manage diagnostic data layers and ECU variants"
    >
      <div style={{ display: 'flex', height: 'calc(100vh - 180px)' }}>
        {/* Hierarchy Panel */}
        <div style={{
          width: '400px',
          borderRight: '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Search and Actions */}
          <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <Search style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: 18,
                height: 18,
                color: '#6b7280'
              }} />
              <input
                type="text"
                placeholder="Search ODX files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 10px 10px 40px',
                  borderRadius: '10px',
                  border: '2px solid #e5e7eb',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={{
                flex: 1,
                padding: '8px 12px',
                backgroundColor: '#3b82f6',
                color: 'white',
                borderRadius: '8px',
                border: 'none',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
              >
                <Plus style={{ width: 14, height: 14 }} />
                New ODX
              </button>

              <button style={{
                flex: 1,
                padding: '8px 12px',
                backgroundColor: '#10b981',
                color: 'white',
                borderRadius: '8px',
                border: 'none',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#059669'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
              >
                <Upload style={{ width: 14, height: 14 }} />
                Import
              </button>
            </div>
          </div>

          {/* Hierarchy Tree */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            {mockOdxStructure.map(node => renderHierarchyNode(node))}
          </div>
        </div>

        {/* Details Panel */}
        <div style={{ flex: 1, backgroundColor: '#f9fafb', overflowY: 'auto' }}>
          {selectedNode ? (
            <div style={{ padding: '24px' }}>
              {/* Header */}
              <div style={{
                padding: '24px',
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                marginBottom: '24px',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      {React.createElement(typeIcons[selectedNode.type], {
                        style: {
                          width: 32,
                          height: 32,
                          color: typeColors[selectedNode.type],
                          padding: '6px',
                          backgroundColor: `${typeColors[selectedNode.type]}15`,
                          borderRadius: '8px'
                        }
                      })}
                      <div>
                        <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#111827' }}>
                          {selectedNode.name}
                        </h2>
                        <div style={{ fontSize: '14px', color: '#6b7280', textTransform: 'capitalize' }}>
                          {selectedNode.type}
                        </div>
                      </div>
                      {selectedNode.metadata?.status && (
                        <span style={{
                          padding: '6px 12px',
                          borderRadius: '20px',
                          backgroundColor: `${statusColors[selectedNode.metadata.status]}15`,
                          color: statusColors[selectedNode.metadata.status],
                          fontSize: '13px',
                          fontWeight: '500',
                          textTransform: 'uppercase'
                        }}>
                          {selectedNode.metadata.status}
                        </span>
                      )}
                    </div>

                    {selectedNode.metadata && (
                      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                        {selectedNode.metadata.version && (
                          <div style={{ fontSize: '14px', color: '#6b7280' }}>
                            <strong>Version:</strong> {selectedNode.metadata.version}
                          </div>
                        )}
                        {selectedNode.metadata.lastModified && (
                          <div style={{ fontSize: '14px', color: '#6b7280' }}>
                            <strong>Last Modified:</strong> {selectedNode.metadata.lastModified}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button style={{
                      padding: '8px',
                      backgroundColor: '#f3f4f6',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                    >
                      <Edit style={{ width: 16, height: 16, color: '#6b7280' }} />
                    </button>
                    <button style={{
                      padding: '8px',
                      backgroundColor: '#f3f4f6',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                    >
                      <Copy style={{ width: 16, height: 16, color: '#6b7280' }} />
                    </button>
                    <button style={{
                      padding: '8px',
                      backgroundColor: '#f3f4f6',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                    >
                      <Download style={{ width: 16, height: 16, color: '#6b7280' }} />
                    </button>
                    <button style={{
                      padding: '8px',
                      backgroundColor: '#fee2e2',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fecaca'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                    >
                      <Trash2 style={{ width: 16, height: 16, color: '#ef4444' }} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Statistics */}
              {selectedNode.metadata && (selectedNode.metadata.ecuCount || selectedNode.metadata.dtcCount) && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '16px',
                  marginBottom: '24px'
                }}>
                  {selectedNode.metadata.ecuCount !== undefined && (
                    <div style={{
                      padding: '20px',
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      border: '1px solid #e5e7eb',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px'
                    }}>
                      <div style={{
                        padding: '12px',
                        backgroundColor: '#dbeafe',
                        borderRadius: '10px',
                        display: 'flex'
                      }}>
                        <Layers style={{ width: 24, height: 24, color: '#3b82f6' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '24px', fontWeight: '600', color: '#111827' }}>
                          {selectedNode.metadata.ecuCount}
                        </div>
                        <div style={{ fontSize: '13px', color: '#6b7280' }}>ECU Modules</div>
                      </div>
                    </div>
                  )}

                  {selectedNode.metadata.dtcCount !== undefined && (
                    <div style={{
                      padding: '20px',
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      border: '1px solid #e5e7eb',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px'
                    }}>
                      <div style={{
                        padding: '12px',
                        backgroundColor: '#fef3c7',
                        borderRadius: '10px',
                        display: 'flex'
                      }}>
                        <AlertTriangle style={{ width: 24, height: 24, color: '#f59e0b' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '24px', fontWeight: '600', color: '#111827' }}>
                          {selectedNode.metadata.dtcCount}
                        </div>
                        <div style={{ fontSize: '13px', color: '#6b7280' }}>DTC Definitions</div>
                      </div>
                    </div>
                  )}

                  {selectedNode.metadata.didCount !== undefined && (
                    <div style={{
                      padding: '20px',
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      border: '1px solid #e5e7eb',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px'
                    }}>
                      <div style={{
                        padding: '12px',
                        backgroundColor: '#dcfce7',
                        borderRadius: '10px',
                        display: 'flex'
                      }}>
                        <Database style={{ width: 24, height: 24, color: '#10b981' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '24px', fontWeight: '600', color: '#111827' }}>
                          {selectedNode.metadata.didCount}
                        </div>
                        <div style={{ fontSize: '13px', color: '#6b7280' }}>Data IDs</div>
                      </div>
                    </div>
                  )}

                  {selectedNode.metadata.serviceCount !== undefined && (
                    <div style={{
                      padding: '20px',
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      border: '1px solid #e5e7eb',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px'
                    }}>
                      <div style={{
                        padding: '12px',
                        backgroundColor: '#ede9fe',
                        borderRadius: '10px',
                        display: 'flex'
                      }}>
                        <Settings style={{ width: 24, height: 24, color: '#8b5cf6' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '24px', fontWeight: '600', color: '#111827' }}>
                          {selectedNode.metadata.serviceCount}
                        </div>
                        <div style={{ fontSize: '13px', color: '#6b7280' }}>Services</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Diagnostic Layers */}
              <div style={{
                padding: '24px',
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
              }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '20px' }}>
                  Diagnostic Layers
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {['Base Variant', 'Protocol Layer', 'ECU Variant', 'Functional Layer'].map((layer, index) => (
                    <div key={index} style={{
                      padding: '16px',
                      backgroundColor: '#f9fafb',
                      borderRadius: '12px',
                      border: '1px solid #e5e7eb',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f3f4f6';
                      e.currentTarget.style.transform = 'translateX(4px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#f9fafb';
                      e.currentTarget.style.transform = 'translateX(0)';
                    }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Layers style={{ width: 18, height: 18, color: '#6b7280' }} />
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                            {layer}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>
                            Last updated: {selectedNode.metadata?.lastModified || '2024-01-15'}
                          </div>
                        </div>
                      </div>
                      <ChevronRight style={{ width: 16, height: 16, color: '#6b7280' }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column'
            }}>
              <FileText style={{ width: 48, height: 48, color: '#9ca3af', marginBottom: '16px' }} />
              <div style={{ fontSize: '18px', color: '#6b7280', marginBottom: '8px' }}>
                Select an ODX file
              </div>
              <div style={{ fontSize: '14px', color: '#9ca3af' }}>
                Choose an item from the hierarchy to view details
              </div>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}