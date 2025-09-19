'use client';

import React, { useState } from 'react';
import PageLayout from '@/components/layout/page-layout';
import { Cpu, Search, Download, RefreshCw, CheckCircle, XCircle, Activity, Zap, Database, Shield, Settings, Info } from 'lucide-react';

interface ECU {
  id: string;
  address: string;
  name: string;
  variant: string;
  partNumber: string;
  softwareVersion: string;
  hardwareVersion: string;
  supplier: string;
  protocol: string;
  supportedServices: string[];
  didCount: number;
  status: 'online' | 'offline' | 'error';
  responseTime: number;
}

const mockECUs: ECU[] = [
  {
    id: '1',
    address: '0x01',
    name: 'Engine Control Module',
    variant: 'ECM_V2.3',
    partNumber: '8V0907404G',
    softwareVersion: '4523',
    hardwareVersion: 'H12',
    supplier: 'Bosch',
    protocol: 'UDS',
    supportedServices: ['0x10', '0x11', '0x14', '0x19', '0x22', '0x27', '0x2E', '0x31'],
    didCount: 156,
    status: 'online',
    responseTime: 12
  },
  {
    id: '2',
    address: '0x03',
    name: 'ABS Control Unit',
    variant: 'ABS_MK100',
    partNumber: '5Q0614517T',
    softwareVersion: '0105',
    hardwareVersion: 'H02',
    supplier: 'Continental',
    protocol: 'UDS',
    supportedServices: ['0x10', '0x11', '0x14', '0x19', '0x22', '0x27'],
    didCount: 89,
    status: 'online',
    responseTime: 8
  },
  {
    id: '3',
    address: '0x09',
    name: 'Transmission Control',
    variant: 'TCM_DQ381',
    partNumber: '0CW927770K',
    softwareVersion: '3621',
    hardwareVersion: 'H08',
    supplier: 'ZF',
    protocol: 'UDS',
    supportedServices: ['0x10', '0x11', '0x14', '0x19', '0x22', '0x27', '0x2E'],
    didCount: 124,
    status: 'online',
    responseTime: 15
  },
  {
    id: '4',
    address: '0x15',
    name: 'Airbag Control Module',
    variant: 'ACM_GEN4',
    partNumber: '5Q0959655BK',
    softwareVersion: '0235',
    hardwareVersion: 'H04',
    supplier: 'Autoliv',
    protocol: 'KWP2000',
    supportedServices: ['0x10', '0x11', '0x14', '0x19'],
    didCount: 45,
    status: 'error',
    responseTime: 0
  },
  {
    id: '5',
    address: '0x19',
    name: 'Gateway Module',
    variant: 'J533_V5',
    partNumber: '5Q0907530Q',
    softwareVersion: '5612',
    hardwareVersion: 'H15',
    supplier: 'Hella',
    protocol: 'UDS',
    supportedServices: ['0x10', '0x11', '0x14', '0x19', '0x22', '0x27', '0x28', '0x3E'],
    didCount: 203,
    status: 'online',
    responseTime: 5
  },
  {
    id: '6',
    address: '0x46',
    name: 'Comfort Control Module',
    variant: 'CCM_BCM2',
    partNumber: '5Q0937086AK',
    softwareVersion: '0384',
    hardwareVersion: 'H06',
    supplier: 'Kostal',
    protocol: 'UDS',
    supportedServices: ['0x10', '0x11', '0x14', '0x19', '0x22'],
    didCount: 67,
    status: 'offline',
    responseTime: 0
  }
];

const statusColors = {
  online: '#10b981',
  offline: '#6b7280',
  error: '#ef4444'
};

const statusIcons = {
  online: <CheckCircle style={{ width: 16, height: 16 }} />,
  offline: <XCircle style={{ width: 16, height: 16 }} />,
  error: <XCircle style={{ width: 16, height: 16 }} />
};

export default function ECUDiscoveryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProtocol, setSelectedProtocol] = useState('all');
  const [ecus] = useState<ECU[]>(mockECUs);
  const [expandedECU, setExpandedECU] = useState<string | null>(null);

  const filteredECUs = ecus.filter(ecu => {
    const matchesSearch =
      ecu.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ecu.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ecu.supplier.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProtocol = selectedProtocol === 'all' || ecu.protocol === selectedProtocol;
    return matchesSearch && matchesProtocol;
  });

  const onlineCount = ecus.filter(e => e.status === 'online').length;
  const totalDIDs = ecus.reduce((sum, e) => sum + e.didCount, 0);

  return (
    <PageLayout
      title="ECU Discovery"
      description="Discover and analyze vehicle control units and their capabilities"
    >
      <div style={{ padding: '24px' }}>
        {/* Controls Bar */}
        <div style={{
          display: 'flex',
          gap: '16px',
          marginBottom: '32px',
          flexWrap: 'wrap'
        }}>
          <div style={{
            flex: '1',
            minWidth: '300px',
            position: 'relative'
          }}>
            <Search style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: 20,
              height: 20,
              color: '#6b7280'
            }} />
            <input
              type="text"
              placeholder="Search ECUs by name, address, or supplier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 12px 12px 44px',
                borderRadius: '12px',
                border: '2px solid #e5e7eb',
                fontSize: '14px',
                outline: 'none',
                transition: 'all 0.2s',
                backgroundColor: '#ffffff'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>

          <select
            value={selectedProtocol}
            onChange={(e) => setSelectedProtocol(e.target.value)}
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              border: '2px solid #e5e7eb',
              fontSize: '14px',
              outline: 'none',
              cursor: 'pointer',
              backgroundColor: '#ffffff'
            }}
          >
            <option value="all">All Protocols</option>
            <option value="UDS">UDS</option>
            <option value="KWP2000">KWP2000</option>
            <option value="J1939">J1939</option>
          </select>

          <button style={{
            padding: '12px 20px',
            backgroundColor: '#10b981',
            color: 'white',
            borderRadius: '12px',
            border: 'none',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#059669'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
          >
            <RefreshCw style={{ width: 16, height: 16 }} />
            Scan Network
          </button>

          <button style={{
            padding: '12px 20px',
            backgroundColor: '#6366f1',
            color: 'white',
            borderRadius: '12px',
            border: 'none',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4f46e5'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6366f1'}
          >
            <Download style={{ width: 16, height: 16 }} />
            Export Results
          </button>
        </div>

        {/* Statistics Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          marginBottom: '32px'
        }}>
          <div style={{
            padding: '20px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #3b82f615 0%, #3b82f605 100%)',
            border: '1px solid #3b82f620'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>Total ECUs</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#3b82f6' }}>{ecus.length}</div>
              </div>
              <Cpu style={{ width: 24, height: 24, color: '#3b82f6', opacity: 0.5 }} />
            </div>
          </div>

          <div style={{
            padding: '20px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #10b98115 0%, #10b98105 100%)',
            border: '1px solid #10b98120'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>Online</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#10b981' }}>{onlineCount}</div>
              </div>
              <Activity style={{ width: 24, height: 24, color: '#10b981', opacity: 0.5 }} />
            </div>
          </div>

          <div style={{
            padding: '20px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #8b5cf615 0%, #8b5cf605 100%)',
            border: '1px solid #8b5cf620'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>Total DIDs</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#8b5cf6' }}>{totalDIDs}</div>
              </div>
              <Database style={{ width: 24, height: 24, color: '#8b5cf6', opacity: 0.5 }} />
            </div>
          </div>

          <div style={{
            padding: '20px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #f59e0b15 0%, #f59e0b05 100%)',
            border: '1px solid #f59e0b20'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>Avg Response</div>
                <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f59e0b' }}>10ms</div>
              </div>
              <Zap style={{ width: 24, height: 24, color: '#f59e0b', opacity: 0.5 }} />
            </div>
          </div>
        </div>

        {/* ECU List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredECUs.length === 0 ? (
            <div style={{
              padding: '80px 20px',
              textAlign: 'center',
              backgroundColor: '#f9fafb',
              borderRadius: '16px',
              border: '2px dashed #e5e7eb'
            }}>
              <Cpu style={{ width: 48, height: 48, color: '#9ca3af', margin: '0 auto 16px' }} />
              <div style={{ fontSize: '18px', color: '#6b7280', marginBottom: '8px' }}>
                No ECUs found
              </div>
              <div style={{ fontSize: '14px', color: '#9ca3af' }}>
                Try adjusting your search or scan the network
              </div>
            </div>
          ) : (
            filteredECUs.map((ecu) => (
              <div
                key={ecu.id}
                style={{
                  borderRadius: '16px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                  overflow: 'hidden',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1)';
                }}
              >
                {/* ECU Header */}
                <div
                  style={{
                    padding: '20px',
                    cursor: 'pointer',
                    borderBottom: expandedECU === ecu.id ? '1px solid #e5e7eb' : 'none'
                  }}
                  onClick={() => setExpandedECU(expandedECU === ecu.id ? null : ecu.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <div style={{
                          padding: '8px',
                          backgroundColor: `${statusColors[ecu.status]}15`,
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Cpu style={{ width: 20, height: 20, color: statusColors[ecu.status] }} />
                        </div>
                        <div>
                          <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>
                            {ecu.name}
                          </h3>
                          <div style={{ fontSize: '13px', color: '#6b7280' }}>
                            {ecu.supplier} • {ecu.variant}
                          </div>
                        </div>
                        <div style={{
                          padding: '4px 12px',
                          borderRadius: '20px',
                          backgroundColor: `${statusColors[ecu.status]}15`,
                          color: statusColors[ecu.status],
                          fontSize: '12px',
                          fontWeight: '500',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          {statusIcons[ecu.status]}
                          <span style={{ textTransform: 'capitalize' }}>{ecu.status}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: '14px', color: '#6b7280' }}>
                          <strong>Address:</strong> {ecu.address}
                        </div>
                        <div style={{ fontSize: '14px', color: '#6b7280' }}>
                          <strong>Protocol:</strong> {ecu.protocol}
                        </div>
                        <div style={{ fontSize: '14px', color: '#6b7280' }}>
                          <strong>Part:</strong> {ecu.partNumber}
                        </div>
                        {ecu.status === 'online' && (
                          <div style={{ fontSize: '14px', color: '#10b981' }}>
                            <strong>Response:</strong> {ecu.responseTime}ms
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: '8px'
                    }}>
                      <div style={{
                        padding: '6px 12px',
                        backgroundColor: '#f3f4f6',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '500',
                        color: '#111827'
                      }}>
                        {ecu.didCount} DIDs
                      </div>
                      <div style={{
                        padding: '6px 12px',
                        backgroundColor: '#fef3c7',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '500',
                        color: '#92400e'
                      }}>
                        {ecu.supportedServices.length} Services
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedECU === ecu.id && (
                  <div style={{
                    padding: '20px',
                    backgroundColor: '#f9fafb'
                  }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                      gap: '20px',
                      marginBottom: '20px'
                    }}>
                      <div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Settings style={{ width: 12, height: 12 }} />
                          Hardware Version
                        </div>
                        <div style={{ fontSize: '14px', color: '#111827', fontWeight: '500' }}>
                          {ecu.hardwareVersion}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Info style={{ width: 12, height: 12 }} />
                          Software Version
                        </div>
                        <div style={{ fontSize: '14px', color: '#111827', fontWeight: '500' }}>
                          {ecu.softwareVersion}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Shield style={{ width: 12, height: 12 }} />
                        Supported Services
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {ecu.supportedServices.map((service) => (
                          <span
                            key={service}
                            style={{
                              padding: '4px 10px',
                              backgroundColor: '#e5e7eb',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontFamily: 'monospace',
                              color: '#374151'
                            }}
                          >
                            {service}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </PageLayout>
  );
}