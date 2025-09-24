"use client"

import { useEffect, useState } from 'react'
import { PageLayout } from '@/components/layout/page-layout'
import { Card, Button, Badge, StatCard } from '@/components/design-system'
import { colors, spacing } from '@/lib/design-system/tokens'
import { containerStyles } from '@/lib/design-system/styles'
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
  Plus,
  Calendar,
  Settings
} from 'lucide-react'
import { useRouter } from 'next/navigation'

interface DashboardStats {
  totalJobs: number
  activeJobs: number
  totalVehicles: number
  discoveredECUs: number
  totalDTCs: number
  totalDIDs: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalJobs: 0,
    activeJobs: 0,
    totalVehicles: 0,
    discoveredECUs: 0,
    totalDTCs: 0,
    totalDIDs: 0
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

  return (
    <PageLayout
      title="Dashboard"
      description="Overview of your diagnostic activities">

      <div className="ds-container">
        {/* Quick Actions */}
        <div className="ds-flex-row" style={{ gap: spacing[3], marginBottom: spacing[6], flexWrap: 'wrap' }}>
          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => router.push('/jobs')}
          >
            New Job
          </Button>
          <Button
            variant="secondary"
            icon={<Car size={16} />}
            onClick={() => router.push('/vehicle-management')}
          >
            Manage Vehicles
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="ds-grid-3" style={{ marginBottom: spacing[8] }}>
          <StatCard
            label="Total Jobs"
            value={stats.totalJobs}
            icon={<FileText size={24} />}
            color="primary"
            trend={{ value: '12%', positive: true }}
            loading={loading}
          />
          <StatCard
            label="Active Jobs"
            value={stats.activeJobs}
            icon={<Activity size={24} />}
            color="success"
            trend={{ value: '8%', positive: true }}
            loading={loading}
          />
          <StatCard
            label="Total Vehicles"
            value={stats.totalVehicles}
            icon={<Car size={24} />}
            color="purple"
            trend={{ value: '5%', positive: true }}
            loading={loading}
          />
          <StatCard
            label="Discovered ECUs"
            value={stats.discoveredECUs}
            icon={<Database size={24} />}
            color="warning"
            loading={loading}
          />
          <StatCard
            label="Total DTCs"
            value={stats.totalDTCs}
            icon={<AlertCircle size={24} />}
            color="error"
            loading={loading}
          />
          <StatCard
            label="Discovered DIDs"
            value={stats.totalDIDs}
            icon={<FileCode size={24} />}
            color="info"
            loading={loading}
          />
        </div>

        {/* Recent Jobs Section */}
        <Card>
          <h3 className="ds-heading-3">Recent Jobs</h3>

          {loading ? (
            <div className="ds-loading">Loading jobs...</div>
          ) : recentJobs.length === 0 ? (
            <div className="ds-empty-state">
              <p>No recent jobs found</p>
              <Button
                variant="primary"
                size="small"
                onClick={() => router.push('/jobs')}
                style={{ marginTop: spacing[4] }}
              >
                Create First Job
              </Button>
            </div>
          ) : (
            <div className="ds-stack" style={{ gap: spacing[4] }}>
              {recentJobs.map((job) => (
                <Card
                  key={job.id}
                  variant="hover"
                  style={{
                    background: 'linear-gradient(135deg, white 0%, #f8fafc 100%)',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: spacing[6],
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onClick={() => router.push(`/jobs/${job.id}`)}
                  onMouseEnter={(e) => {
                    const target = e.currentTarget as HTMLDivElement
                    target.style.transform = 'translateY(-4px) scale(1.01)'
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
                    background: job.status === 'completed' ?
                      'linear-gradient(90deg, #10b981 0%, #34d399 100%)' :
                      job.status === 'failed' ?
                      'linear-gradient(90deg, #ef4444 0%, #f87171 100%)' :
                      'linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)',
                    borderRadius: '12px 12px 0 0'
                  }} />

                  {/* Job Header */}
                  <div style={{ marginBottom: spacing[4] }}>
                    <div className="ds-flex-row" style={{
                      gap: spacing[3],
                      marginBottom: spacing[2],
                      alignItems: 'center'
                    }}>
                      <h4 style={{
                        fontSize: '18px',
                        fontWeight: 600,
                        color: colors.text.primary,
                        margin: 0,
                        flex: 1
                      }}>
                        {job.name || job.procedureType || `Job #${job.id.slice(0, 8)}`}
                      </h4>
                      <Badge
                        variant={
                          job.status === 'completed' ? 'success' :
                          job.status === 'failed' ? 'error' :
                          job.status === 'processing' ? 'info' : 'secondary'
                        }
                        size="small"
                        style={{
                          fontWeight: 500,
                          padding: '4px 8px'
                        }}
                      >
                        {job.status === 'completed' ? 'Completed' :
                         job.status === 'failed' ? 'Failed' :
                         job.status === 'processing' ? 'Processing' :
                         'Pending'}
                      </Badge>
                    </div>

                    {job.procedureType && job.procedureType !== job.name && (
                      <p style={{
                        fontSize: '14px',
                        color: colors.text.secondary,
                        margin: 0
                      }}>
                        {job.procedureType}
                      </p>
                    )}
                  </div>

                  {/* Data Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: spacing[4],
                    marginBottom: spacing[4]
                  }}>
                    <div className="ds-flex-row" style={{ gap: spacing[2], alignItems: 'center' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        backgroundColor: colors.primary[100],
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Car size={16} color={colors.primary[600]} />
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', color: colors.text.muted, display: 'block' }}>Vehicle</span>
                        <span style={{ fontSize: '14px', fontWeight: 500, color: colors.text.primary }}>
                          {job.Vehicle?.modelName || 'Unknown'}
                        </span>
                      </div>
                    </div>

                    <div className="ds-flex-row" style={{ gap: spacing[2], alignItems: 'center' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        backgroundColor: colors.success[100],
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Calendar size={16} color={colors.success[600]} />
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', color: colors.text.muted, display: 'block' }}>Year</span>
                        <span style={{ fontSize: '14px', fontWeight: 500, color: colors.text.primary }}>
                          {job.Vehicle?.year || 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="ds-flex-row" style={{ gap: spacing[2], alignItems: 'center' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        backgroundColor: colors.warning[100],
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Activity size={16} color={colors.warning[600]} />
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', color: colors.text.muted, display: 'block' }}>Messages</span>
                        <span style={{ fontSize: '14px', fontWeight: 500, color: colors.text.primary }}>
                          {job.messageCount || 0}
                        </span>
                      </div>
                    </div>

                    <div className="ds-flex-row" style={{ gap: spacing[2], alignItems: 'center' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        backgroundColor: colors.error[100],
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Settings size={16} color={colors.error[600]} />
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', color: colors.text.muted, display: 'block' }}>ECUs</span>
                        <span style={{ fontSize: '14px', fontWeight: 500, color: colors.text.primary }}>
                          {job.ECUConfiguration?.length || job._count?.ECUConfiguration || 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: spacing[3],
                    borderTop: `1px solid ${colors.border.light}`
                  }}>
                    <div className="ds-flex-row" style={{ gap: spacing[4], fontSize: '13px' }}>
                      {job.Vehicle?.vin && (
                        <div style={{
                          padding: `${spacing[1]} ${spacing[2]}`,
                          backgroundColor: '#e0e7ff',
                          borderRadius: '4px',
                          color: '#4c1d95',
                          fontWeight: 500
                        }}>
                          {job.Vehicle.vin}
                        </div>
                      )}
                      <span style={{ color: colors.text.muted, display: 'flex', alignItems: 'center', gap: spacing[1] }}>
                        <Clock size={14} />
                        {new Date(job.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <ChevronRight size={20} color={colors.gray[400]} />
                  </div>
                </Card>
              ))}
            </div>
          )}

          <div style={{ marginTop: spacing[4], paddingTop: spacing[4], borderTop: `1px solid ${colors.border.light}` }}>
            <Button
              variant="ghost"
              onClick={() => router.push('/jobs')}
              icon={<ChevronRight size={16} />}
              iconPosition="right"
              style={{ width: '100%' }}
            >
              View All Jobs
            </Button>
          </div>
        </Card>
      </div>
    </PageLayout>
  )
}