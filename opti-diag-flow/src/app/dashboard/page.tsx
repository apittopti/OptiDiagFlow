"use client"

import { useEffect, useState } from 'react'
import { PageLayout } from '@/components/layout/page-layout'
import {
  Activity,
  Car,
  Database,
  FileText,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  ChevronRight,
  Package,
  FileCode,
  Plus
} from 'lucide-react'
import { useRouter } from 'next/navigation'

interface DashboardStats {
  totalJobs: number
  activeJobs: number
  totalVehicles: number
  discoveredECUs: number
  totalDTCs: number
  odxPatterns: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalJobs: 0,
    activeJobs: 0,
    totalVehicles: 0,
    discoveredECUs: 0,
    totalDTCs: 0,
    odxPatterns: 0
  })

  const [recentJobs, setRecentJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      // Fetch stats
      const statsResponse = await fetch('/api/stats')
      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData)
      }

      // Fetch recent jobs
      const jobsResponse = await fetch('/api/jobs?limit=5')
      if (jobsResponse.ok) {
        const jobsData = await jobsResponse.json()
        setRecentJobs(jobsData.jobs || [])
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    {
      title: 'Total Jobs',
      value: stats.totalJobs,
      icon: FileText,
      color: '#3b82f6',
      bgColor: 'rgba(59, 130, 246, 0.1)'
    },
    {
      title: 'Active Jobs',
      value: stats.activeJobs,
      icon: Activity,
      color: '#10b981',
      bgColor: 'rgba(16, 185, 129, 0.1)'
    },
    {
      title: 'Total Vehicles',
      value: stats.totalVehicles,
      icon: Car,
      color: '#8b5cf6',
      bgColor: 'rgba(139, 92, 246, 0.1)'
    },
    {
      title: 'Discovered ECUs',
      value: stats.discoveredECUs,
      icon: Database,
      color: '#f59e0b',
      bgColor: 'rgba(245, 158, 11, 0.1)'
    },
    {
      title: 'Total DTCs',
      value: stats.totalDTCs,
      icon: AlertCircle,
      color: '#ef4444',
      bgColor: 'rgba(239, 68, 68, 0.1)'
    },
    {
      title: 'ODX Patterns',
      value: stats.odxPatterns,
      icon: FileCode,
      color: '#06b6d4',
      bgColor: 'rgba(6, 182, 212, 0.1)'
    }
  ]

  const getStatusColor = (status: string) => {
    switch(status?.toLowerCase()) {
      case 'completed':
        return '#10b981'
      case 'processing':
      case 'active':
        return '#3b82f6'
      case 'failed':
        return '#ef4444'
      default:
        return '#6b7280'
    }
  }

  const getStatusIcon = (status: string) => {
    switch(status?.toLowerCase()) {
      case 'completed':
        return <CheckCircle size={16} />
      case 'processing':
      case 'active':
        return <Clock size={16} />
      case 'failed':
        return <AlertCircle size={16} />
      default:
        return <Clock size={16} />
    }
  }

  return (
    <PageLayout
      title="Dashboard"
      description="Overview of your diagnostic activities">

      <div style={{ marginBottom: '32px' }}>
        {/* Quick Actions */}
        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '24px',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => router.push('/jobs')}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#3b82f6',
              color: 'white',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#2563eb'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#3b82f6'
            }}
          >
            <Plus size={16} />
            New Job
          </button>
          <button
            onClick={() => router.push('/vehicle-management')}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              backgroundColor: 'white',
              color: '#374151',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f9fafb'
              e.currentTarget.style.borderColor = '#d1d5db'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white'
              e.currentTarget.style.borderColor = '#e5e7eb'
            }}
          >
            <Car size={16} />
            Manage Vehicles
          </button>
          <button
            onClick={() => router.push('/odx-editor')}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              backgroundColor: 'white',
              color: '#374151',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f9fafb'
              e.currentTarget.style.borderColor = '#d1d5db'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white'
              e.currentTarget.style.borderColor = '#e5e7eb'
            }}
          >
            <FileCode size={16} />
            ODX Editor
          </button>
        </div>

        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px',
          marginBottom: '32px'
        }}>
          {statCards.map((card, index) => (
            <div
              key={index}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                padding: '20px',
                border: '1px solid #e5e7eb',
                transition: 'all 0.3s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.1)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px', margin: 0 }}>
                    {card.title}
                  </p>
                  <h3 style={{ fontSize: '32px', fontWeight: '700', color: '#111827', margin: 0 }}>
                    {loading ? '-' : card.value}
                  </h3>
                </div>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '10px',
                  backgroundColor: card.bgColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <card.icon size={24} style={{ color: card.color }} />
                </div>
              </div>
              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center' }}>
                <TrendingUp size={16} style={{ color: '#10b981', marginRight: '4px' }} />
                <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '500' }}>
                  +12%
                </span>
                <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '8px' }}>
                  from last week
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Jobs */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          padding: '24px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', margin: 0 }}>
              Recent Jobs
            </h2>
            <button
              onClick={() => router.push('/jobs')}
              style={{
                fontSize: '14px',
                color: '#3b82f6',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              View all
              <ChevronRight size={16} />
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '4px solid #f3f4f6',
                borderTop: '4px solid #3b82f6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto'
              }} />
            </div>
          ) : recentJobs.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentJobs.map((job: any) => (
                <div
                  key={job.id}
                  onClick={() => router.push(`/jobs/${job.id}`)}
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f9fafb'
                    e.currentTarget.style.borderColor = '#d1d5db'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.borderColor = '#e5e7eb'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        backgroundColor: '#f3f4f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <FileText size={20} style={{ color: '#6b7280' }} />
                      </div>
                      <div>
                        <p style={{
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#111827',
                          margin: 0,
                          marginBottom: '4px'
                        }}>
                          {job.name}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: getStatusColor(job.status)
                          }}>
                            {getStatusIcon(job.status)}
                            <span style={{ fontSize: '12px', fontWeight: '500' }}>
                              {job.status}
                            </span>
                          </div>
                          <span style={{ fontSize: '12px', color: '#6b7280' }}>
                            • {new Date(job.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={20} style={{ color: '#9ca3af' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#6b7280'
            }}>
              <Package size={48} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ margin: 0 }}>No recent jobs</p>
              <button
                onClick={() => router.push('/jobs')}
                style={{
                  marginTop: '12px',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Create your first job
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </PageLayout>
  )
}