'use client';

import React, { useState } from 'react';
import PageLayout from '@/components/layout/page-layout';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, Save, Download, Upload, CheckCircle, AlertTriangle, Code, Database, Settings, Package, Layers, FileText } from 'lucide-react';

interface TreeNode {
  id: string;
  name: string;
  type: 'folder' | 'file' | 'layer' | 'service' | 'did' | 'dtc';
  children?: TreeNode[];
  metadata?: {
    identifier?: string;
    value?: string;
    description?: string;
    dataType?: string;
  };
}

const mockOdxTree: TreeNode[] = [
  {
    id: '1',
    name: 'BMW_F30_2021',
    type: 'folder',
    children: [
      {
        id: '2',
        name: 'PROTOCOL',
        type: 'folder',
        children: [
          { id: '3', name: 'ISO_14229_UDS', type: 'file', metadata: { identifier: '0x01', description: 'Unified Diagnostic Services' } },
          { id: '4', name: 'ISO_14230_KWP2000', type: 'file', metadata: { identifier: '0x02', description: 'Keyword Protocol 2000' } }
        ]
      },
      {
        id: '5',
        name: 'BASE_VARIANT',
        type: 'folder',
        children: [
          {
            id: '6',
            name: 'ECM_BASE',
            type: 'layer',
            metadata: { identifier: '0x01', description: 'Engine Control Module Base Layer' },
            children: [
              {
                id: '7',
                name: 'Services',
                type: 'folder',
                children: [
                  { id: '8', name: 'DiagnosticSessionControl', type: 'service', metadata: { identifier: '0x10', dataType: 'uint8' } },
                  { id: '9', name: 'ECUReset', type: 'service', metadata: { identifier: '0x11', dataType: 'uint8' } },
                  { id: '10', name: 'ReadDataByIdentifier', type: 'service', metadata: { identifier: '0x22', dataType: 'uint16' } }
                ]
              },
              {
                id: '11',
                name: 'DIDs',
                type: 'folder',
                children: [
                  { id: '12', name: 'VIN', type: 'did', metadata: { identifier: '0xF190', value: 'WBA5U7C05M7G12345', dataType: 'ASCII' } },
                  { id: '13', name: 'ECU_Serial_Number', type: 'did', metadata: { identifier: '0xF18C', value: '12345678', dataType: 'HEX' } },
                  { id: '14', name: 'Software_Version', type: 'did', metadata: { identifier: '0xF189', value: '4523', dataType: 'ASCII' } }
                ]
              },
              {
                id: '15',
                name: 'DTCs',
                type: 'folder',
                children: [
                  { id: '16', name: 'P0171', type: 'dtc', metadata: { description: 'System Too Lean (Bank 1)', identifier: '0x0171' } },
                  { id: '17', name: 'P0300', type: 'dtc', metadata: { description: 'Random/Multiple Cylinder Misfire', identifier: '0x0300' } }
                ]
              }
            ]
          }
        ]
      },
      {
        id: '18',
        name: 'ECU_VARIANTS',
        type: 'folder',
        children: [
          { id: '19', name: 'ECM_N20B20', type: 'layer', metadata: { identifier: '0x01A', description: 'N20 2.0L Turbo Engine' } },
          { id: '20', name: 'TCM_8HP50', type: 'layer', metadata: { identifier: '0x03A', description: '8-Speed Automatic Transmission' } }
        ]
      }
    ]
  }
];

const nodeIcons = {
  folder: Folder,
  file: FileText,
  layer: Layers,
  service: Settings,
  did: Database,
  dtc: AlertTriangle
};

const nodeColors = {
  folder: '#6b7280',
  file: '#3b82f6',
  layer: '#8b5cf6',
  service: '#10b981',
  did: '#f59e0b',
  dtc: '#ef4444'
};

export default function OdxEditorPage() {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['1', '2', '5', '6', '7', '11', '15']));
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [editedContent, setEditedContent] = useState<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const selectNode = (node: TreeNode) => {
    setSelectedNode(node);
    setEditedContent(JSON.stringify(node.metadata || {}, null, 2));
    setHasUnsavedChanges(false);
  };

  const renderTreeNode = (node: TreeNode, level: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const Icon = nodeIcons[node.type];
    const iconColor = nodeColors[node.type];

    return (
      <div key={node.id}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 12px',
            paddingLeft: `${12 + level * 20}px`,
            cursor: 'pointer',
            backgroundColor: selectedNode?.id === node.id ? '#e0e7ff' : 'transparent',
            borderRadius: '6px',
            margin: '2px 0',
            transition: 'all 0.2s'
          }}
          onClick={() => {
            if (hasChildren) {
              toggleNode(node.id);
            }
            selectNode(node);
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
            <div style={{ marginRight: '4px' }}>
              {isExpanded ? (
                <ChevronDown style={{ width: 16, height: 16, color: '#6b7280' }} />
              ) : (
                <ChevronRight style={{ width: 16, height: 16, color: '#6b7280' }} />
              )}
            </div>
          )}
          {!hasChildren && <div style={{ width: '20px' }} />}

          <Icon style={{ width: 16, height: 16, color: iconColor, marginRight: '8px' }} />

          <span style={{ fontSize: '14px', color: '#374151', flex: 1 }}>
            {node.name}
          </span>

          {node.metadata?.identifier && (
            <span style={{
              fontSize: '12px',
              color: '#9ca3af',
              backgroundColor: '#f3f4f6',
              padding: '2px 6px',
              borderRadius: '4px',
              fontFamily: 'monospace'
            }}>
              {node.metadata.identifier}
            </span>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div>
            {node.children!.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <PageLayout
      title="ODX Editor"
      description="Edit and manage Open Diagnostic data eXchange files"
    >
      <div style={{ display: 'flex', height: 'calc(100vh - 180px)' }}>
        {/* Tree View Panel */}
        <div style={{
          width: '350px',
          borderRight: '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Toolbar */}
          <div style={{
            padding: '16px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            gap: '8px'
          }}>
            <button style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              borderRadius: '8px',
              border: 'none',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
            >
              <Upload style={{ width: 14, height: 14 }} />
              Import
            </button>

            <button style={{
              padding: '8px 16px',
              backgroundColor: '#10b981',
              color: 'white',
              borderRadius: '8px',
              border: 'none',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#059669'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
            >
              <Download style={{ width: 14, height: 14 }} />
              Export
            </button>
          </div>

          {/* Tree View */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px'
          }}>
            {mockOdxTree.map(node => renderTreeNode(node))}
          </div>
        </div>

        {/* Editor Panel */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#f9fafb'
        }}>
          {selectedNode ? (
            <>
              {/* Editor Header */}
              <div style={{
                padding: '20px',
                backgroundColor: '#ffffff',
                borderBottom: '1px solid #e5e7eb'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      {React.createElement(nodeIcons[selectedNode.type], {
                        style: { width: 24, height: 24, color: nodeColors[selectedNode.type] }
                      })}
                      <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#111827' }}>
                        {selectedNode.name}
                      </h2>
                      {hasUnsavedChanges && (
                        <span style={{
                          padding: '4px 8px',
                          backgroundColor: '#fef3c7',
                          color: '#92400e',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>
                          Unsaved Changes
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '14px', color: '#6b7280' }}>
                      Type: <span style={{ fontWeight: '500', textTransform: 'capitalize' }}>{selectedNode.type}</span>
                      {selectedNode.metadata?.identifier && (
                        <> • ID: <span style={{ fontFamily: 'monospace' }}>{selectedNode.metadata.identifier}</span></>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button style={{
                      padding: '10px 20px',
                      backgroundColor: '#10b981',
                      color: 'white',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s',
                      opacity: hasUnsavedChanges ? 1 : 0.5
                    }}
                    disabled={!hasUnsavedChanges}
                    onMouseEnter={(e) => {
                      if (hasUnsavedChanges) {
                        e.currentTarget.style.backgroundColor = '#059669';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#10b981';
                    }}
                    onClick={() => setHasUnsavedChanges(false)}
                    >
                      <Save style={{ width: 16, height: 16 }} />
                      Save
                    </button>

                    <button style={{
                      padding: '10px 20px',
                      backgroundColor: '#6366f1',
                      color: 'white',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4f46e5'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6366f1'}
                    >
                      <CheckCircle style={{ width: 16, height: 16 }} />
                      Validate
                    </button>
                  </div>
                </div>
              </div>

              {/* Editor Content */}
              <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
                {selectedNode.metadata?.description && (
                  <div style={{
                    padding: '16px',
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    marginBottom: '20px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', fontWeight: '500' }}>
                      DESCRIPTION
                    </div>
                    <div style={{ fontSize: '14px', color: '#374151' }}>
                      {selectedNode.metadata.description}
                    </div>
                  </div>
                )}

                <div style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    padding: '12px 16px',
                    backgroundColor: '#f3f4f6',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <Code style={{ width: 16, height: 16, color: '#6b7280' }} />
                    <span style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>
                      Properties
                    </span>
                  </div>

                  <textarea
                    value={editedContent}
                    onChange={(e) => {
                      setEditedContent(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    style={{
                      width: '100%',
                      minHeight: '400px',
                      padding: '16px',
                      border: 'none',
                      outline: 'none',
                      fontFamily: 'monospace',
                      fontSize: '13px',
                      lineHeight: '1.6',
                      resize: 'vertical',
                      backgroundColor: '#ffffff',
                      color: '#111827'
                    }}
                    spellCheck={false}
                  />
                </div>

                {selectedNode.metadata?.value && (
                  <div style={{
                    padding: '16px',
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    marginTop: '20px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', fontWeight: '500' }}>
                      CURRENT VALUE
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: '#374151',
                      fontFamily: 'monospace',
                      padding: '8px 12px',
                      backgroundColor: '#f9fafb',
                      borderRadius: '6px'
                    }}>
                      {selectedNode.metadata.value}
                    </div>
                    {selectedNode.metadata.dataType && (
                      <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                        Data Type: {selectedNode.metadata.dataType}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column'
            }}>
              <Package style={{ width: 48, height: 48, color: '#9ca3af', marginBottom: '16px' }} />
              <div style={{ fontSize: '18px', color: '#6b7280', marginBottom: '8px' }}>
                Select a node to edit
              </div>
              <div style={{ fontSize: '14px', color: '#9ca3af' }}>
                Choose an item from the tree view to see its properties
              </div>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}