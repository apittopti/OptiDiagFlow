"use client"

import { useState } from 'react'
import {
  Activity,
  Car,
  FileText,
  Menu,
  X,
  Search,
  Bell,
  User,
  Settings,
  Database,
  AlertCircle
} from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'

interface PageLayoutProps {
  children: React.ReactNode
  title: string
  description?: string
}

export function PageLayout({ children, title, description }: PageLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  const menuItems = [
    { icon: Activity, label: 'Dashboard', path: '/dashboard' },
    { icon: FileText, label: 'Jobs', path: '/jobs' },
    { icon: Car, label: 'Vehicle Management', path: '/vehicle-management' },
    { icon: Database, label: 'Knowledge Base', path: '/knowledge' },
    { icon: AlertCircle, label: 'DTC Management', path: '/dtc-management' },
    { icon: Settings, label: 'Settings', path: '/settings' }
  ]

  const sidebarStyle = {
    width: sidebarOpen ? '280px' : '64px',
    backgroundColor: '#0f172a',
    position: 'fixed' as const,
    left: 0,
    top: 0,
    height: '100vh',
    overflow: 'hidden',
    transition: 'width 0.2s ease',
    zIndex: 50
  }

  const mainContentStyle = {
    marginLeft: sidebarOpen ? '280px' : '64px',
    transition: 'margin-left 0.2s ease',
    minHeight: '100vh'
  }

  const headerStyle = {
    backgroundColor: '#ffffff',
    padding: '16px 24px',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'sticky' as const,
    top: 0,
    zIndex: 10,
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
  }

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', color: '#111827' }}>
      {/* Sidebar */}
      <div style={sidebarStyle}>
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '32px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              marginRight: sidebarOpen ? '12px' : '0',
              transition: 'margin-right 0.2s ease'
            }} />
            {sidebarOpen && (
              <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: '#ffffff' }}>OptiDiagFlow</h2>
            )}
          </div>

          <nav>
            {menuItems.map((item) => {
              const isActive = pathname === item.path
              return (
                <div
                  key={item.path}
                  onClick={() => router.push(item.path)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: sidebarOpen ? '10px 12px' : '12px',
                    justifyContent: sidebarOpen ? 'flex-start' : 'center',
                    marginBottom: '2px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: isActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                    color: isActive ? '#3b82f6' : '#94a3b8',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'rgba(148, 163, 184, 0.1)'
                      e.currentTarget.style.color = '#cbd5e1'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent'
                      e.currentTarget.style.color = '#94a3b8'
                    }
                  }}
                >
                  {isActive && (
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '3px',
                      height: '28px',
                      backgroundColor: '#3b82f6',
                      borderRadius: '0 4px 4px 0'
                    }} />
                  )}
                  <item.icon size={20} style={{ marginRight: sidebarOpen ? '12px' : '0', flexShrink: 0 }} />
                  {sidebarOpen && (
                    <span style={{ fontSize: '14px', fontWeight: isActive ? '500' : '400' }}>
                      {item.label}
                    </span>
                  )}
                </div>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col bg-background" style={mainContentStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                padding: '10px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: sidebarOpen ? 'transparent' : '#f1f5f9',
                cursor: 'pointer',
                marginRight: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '600', margin: 0, color: '#0f172a' }}>{title}</h1>
              {description && (
                <p style={{ fontSize: '14px', color: '#64748b', marginTop: '4px', margin: 0 }}>
                  {description}
                </p>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="ds-search-wrapper" style={{ width: '240px' }}>
              <Search size={20} className="ds-search-icon" />
              <input
                type="text"
                placeholder="Search..."
                className="ds-search-input"
              />
            </div>

            <button style={{
              padding: '8px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#f3f4f6',
              cursor: 'pointer',
              position: 'relative'
            }}>
              <Bell size={20} />
              <span style={{
                position: 'absolute',
                top: '6px',
                right: '6px',
                width: '8px',
                height: '8px',
                backgroundColor: '#ef4444',
                borderRadius: '50%',
                border: '2px solid #f3f4f6'
              }} />
            </button>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: '#f3f4f6',
              cursor: 'pointer'
            }}>
              <User size={20} />
              <span style={{ fontSize: '14px', fontWeight: '500' }}>Admin</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="ds-container">
          {children}
        </div>
      </div>
    </div>
  )
}

export default PageLayout