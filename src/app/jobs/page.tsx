'use client';

import React, { useState } from 'react';
import PageLayout from '@/components/layout/page-layout';
import { Search, Filter, MoreVertical, Play, Pause, CheckCircle, XCircle, Clock, Edit, Trash2, Eye } from 'lucide-react';

interface Job {
  id: string;
  name: string;
  vehicle: string;
  status: 'running' | 'completed' | 'failed' | 'pending';
  progress: number;
  startTime: string;
  duration: string;
  dtcsFound: number;
}

const mockJobs: Job[] = [
  { id: '1', name: 'Full System Scan', vehicle: '2021 BMW 330i', status: 'running', progress: 65, startTime: '10:30 AM', duration: '5 min', dtcsFound: 3 },
  { id: '2', name: 'Engine Diagnostics', vehicle: '2020 Mercedes C300', status: 'completed', progress: 100, startTime: '09:15 AM', duration: '12 min', dtcsFound: 0 },
  { id: '3', name: 'Transmission Check', vehicle: '2022 Audi A4', status: 'failed', progress: 45, startTime: '08:45 AM', duration: '3 min', dtcsFound: 1 },
  { id: '4', name: 'ABS System Scan', vehicle: '2021 VW Golf', status: 'pending', progress: 0, startTime: 'Scheduled', duration: '-', dtcsFound: 0 },
  { id: '5', name: 'Climate Control Diag', vehicle: '2023 Porsche Cayenne', status: 'completed', progress: 100, startTime: '07:20 AM', duration: '8 min', dtcsFound: 2 },
];

const statusColors = {
  running: '#3b82f6',
  completed: '#10b981',
  failed: '#ef4444',
  pending: '#6b7280',
};

const statusIcons = {
  running: <Clock style={{ width: 16, height: 16 }} />,
  completed: <CheckCircle style={{ width: 16, height: 16 }} />,
  failed: <XCircle style={{ width: 16, height: 16 }} />,
  pending: <Clock style={{ width: 16, height: 16 }} />,
};

export default function JobsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [jobs] = useState<Job[]>(mockJobs);

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          job.vehicle.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || job.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  return (
    <PageLayout
      title="Diagnostic Jobs"
      description="Monitor and manage all diagnostic scanning jobs"
    >
      <div style={{ padding: '24px' }}>
        {/* Search and Filter Bar */}
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
              placeholder="Search jobs or vehicles..."
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

          <div style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center'
          }}>
            <Filter style={{ width: 20, height: 20, color: '#6b7280' }} />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                padding: '12px 16px',
                borderRadius: '12px',
                border: '2px solid #e5e7eb',
                fontSize: '14px',
                outline: 'none',
                cursor: 'pointer',
                backgroundColor: '#ffffff',
                minWidth: '150px'
              }}
            >
              <option value="all">All Status</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <button style={{
            padding: '12px 24px',
            backgroundColor: '#3b82f6',
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
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
          >
            <Play style={{ width: 16, height: 16 }} />
            New Job
          </button>
        </div>

        {/* Job Statistics */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '32px'
        }}>
          {Object.entries(statusColors).map(([status, color]) => {
            const count = jobs.filter(j => j.status === status).length;
            return (
              <div key={status} style={{
                padding: '20px',
                borderRadius: '16px',
                background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`,
                border: `1px solid ${color}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color }}>
                    {count}
                  </div>
                  <div style={{ fontSize: '14px', color: '#6b7280', textTransform: 'capitalize' }}>
                    {status}
                  </div>
                </div>
                <div style={{ color, opacity: 0.5 }}>
                  {statusIcons[status as keyof typeof statusIcons]}
                </div>
              </div>
            );
          })}
        </div>

        {/* Jobs List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredJobs.length === 0 ? (
            <div style={{
              padding: '80px 20px',
              textAlign: 'center',
              backgroundColor: '#f9fafb',
              borderRadius: '16px',
              border: '2px dashed #e5e7eb'
            }}>
              <div style={{ fontSize: '18px', color: '#6b7280', marginBottom: '8px' }}>
                No jobs found
              </div>
              <div style={{ fontSize: '14px', color: '#9ca3af' }}>
                Try adjusting your search or filter criteria
              </div>
            </div>
          ) : (
            filteredJobs.map((job) => (
              <div
                key={job.id}
                style={{
                  padding: '24px',
                  borderRadius: '16px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                  transition: 'all 0.2s',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 10px 20px 0 rgba(0, 0, 0, 0.1)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    {/* Job Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>
                        {job.name}
                      </h3>
                      <div style={{
                        padding: '4px 12px',
                        borderRadius: '20px',
                        backgroundColor: `${statusColors[job.status]}15`,
                        color: statusColors[job.status],
                        fontSize: '12px',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {statusIcons[job.status]}
                        <span style={{ textTransform: 'capitalize' }}>{job.status}</span>
                      </div>
                    </div>

                    {/* Job Details */}
                    <div style={{ display: 'flex', gap: '24px', marginBottom: '16px' }}>
                      <div style={{ fontSize: '14px', color: '#6b7280' }}>
                        <strong>Vehicle:</strong> {job.vehicle}
                      </div>
                      <div style={{ fontSize: '14px', color: '#6b7280' }}>
                        <strong>Started:</strong> {job.startTime}
                      </div>
                      <div style={{ fontSize: '14px', color: '#6b7280' }}>
                        <strong>Duration:</strong> {job.duration}
                      </div>
                      {job.dtcsFound > 0 && (
                        <div style={{
                          fontSize: '14px',
                          color: '#ef4444',
                          fontWeight: '500'
                        }}>
                          {job.dtcsFound} DTCs Found
                        </div>
                      )}
                    </div>

                    {/* Progress Bar */}
                    {job.status === 'running' && (
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: '4px'
                        }}>
                          <span style={{ fontSize: '12px', color: '#6b7280' }}>Progress</span>
                          <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>
                            {job.progress}%
                          </span>
                        </div>
                        <div style={{
                          height: '6px',
                          backgroundColor: '#e5e7eb',
                          borderRadius: '3px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            height: '100%',
                            width: `${job.progress}%`,
                            backgroundColor: '#3b82f6',
                            borderRadius: '3px',
                            transition: 'width 0.3s ease',
                            background: 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)'
                          }} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button style={{
                      padding: '8px',
                      backgroundColor: '#f3f4f6',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                    >
                      <Eye style={{ width: 16, height: 16, color: '#6b7280' }} />
                    </button>
                    {job.status === 'running' ? (
                      <button style={{
                        padding: '8px',
                        backgroundColor: '#fef3c7',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fde68a'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fef3c7'}
                      >
                        <Pause style={{ width: 16, height: 16, color: '#f59e0b' }} />
                      </button>
                    ) : (
                      <button style={{
                        padding: '8px',
                        backgroundColor: '#f3f4f6',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                      >
                        <Edit style={{ width: 16, height: 16, color: '#6b7280' }} />
                      </button>
                    )}
                    <button style={{
                      padding: '8px',
                      backgroundColor: '#fee2e2',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
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
            ))
          )}
        </div>
      </div>
    </PageLayout>
  );
}