/**
 * OptiDiagFlow Design System - Badge Component
 * Status and diagnostic badges with consistent styling
 */

import React, { CSSProperties, ReactNode } from 'react'
import { badgeStyles } from '@/lib/design-system/styles'
import { semantic } from '@/lib/design-system/tokens'

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info' | 'purple'
  status?: 'active' | 'completed' | 'processing' | 'failed' | 'pending'
  diagnostic?: 'ecu' | 'dtc' | 'did' | 'routine' | 'service'
  size?: 'sm' | 'md'
  dot?: boolean
  className?: string
  style?: CSSProperties
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant,
  status,
  diagnostic,
  size = 'sm',
  dot = false,
  className = '',
  style = {},
}) => {
  let badgeStyle: CSSProperties = { ...badgeStyles.base }

  // Apply status-based styling
  if (status) {
    badgeStyle = { ...badgeStyle, ...badgeStyles.status[status] }
  }
  // Apply diagnostic-based styling
  else if (diagnostic) {
    badgeStyle = { ...badgeStyle, ...badgeStyles.diagnostic[diagnostic] }
  }
  // Apply variant-based styling
  else if (variant) {
    const variantColors = {
      default: { bg: 'rgba(113, 113, 122, 0.1)', color: '#71717a' },
      success: { bg: 'rgba(34, 197, 94, 0.1)', color: semantic.status.completed },
      error: { bg: 'rgba(239, 68, 68, 0.1)', color: semantic.status.failed },
      warning: { bg: 'rgba(245, 158, 11, 0.1)', color: semantic.status.pending },
      info: { bg: 'rgba(6, 182, 212, 0.1)', color: semantic.status.processing },
      purple: { bg: 'rgba(168, 85, 247, 0.1)', color: semantic.diagnostic.ecu },
    }

    const colors = variantColors[variant] || variantColors.default
    badgeStyle.backgroundColor = colors.bg
    badgeStyle.color = colors.color
  }

  // Apply size variations
  if (size === 'md') {
    badgeStyle.padding = '6px 12px'
    badgeStyle.fontSize = '14px'
  }

  // Merge custom styles
  badgeStyle = { ...badgeStyle, ...style }

  return (
    <span className={className} style={badgeStyle}>
      {dot && (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: 'currentColor',
            marginRight: '6px',
            display: 'inline-block',
          }}
        />
      )}
      {children}
    </span>
  )
}

// Specialized StatusBadge component
interface StatusBadgeProps {
  status: string
  size?: 'sm' | 'md'
  showIcon?: boolean
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'sm',
  showIcon = false
}) => {
  const normalizedStatus = status?.toLowerCase()

  const getStatusConfig = () => {
    switch (normalizedStatus) {
      case 'completed':
      case 'success':
        return {
          variant: 'success' as const,
          text: 'Completed',
          icon: showIcon ? '✓' : null,
        }
      case 'processing':
      case 'active':
      case 'running':
        return {
          variant: 'info' as const,
          text: 'Processing',
          icon: showIcon ? '↻' : null,
        }
      case 'failed':
      case 'error':
        return {
          variant: 'error' as const,
          text: 'Failed',
          icon: showIcon ? '✗' : null,
        }
      case 'pending':
      case 'waiting':
        return {
          variant: 'warning' as const,
          text: 'Pending',
          icon: showIcon ? '⏳' : null,
        }
      default:
        return {
          variant: 'default' as const,
          text: status || 'Unknown',
          icon: null,
        }
    }
  }

  const config = getStatusConfig()

  return (
    <Badge variant={config.variant} size={size} dot={!showIcon}>
      {config.icon && <span style={{ marginRight: '4px' }}>{config.icon}</span>}
      {config.text}
    </Badge>
  )
}

// Specialized DiagnosticBadge component
interface DiagnosticBadgeProps {
  type: 'ecu' | 'dtc' | 'did' | 'routine' | 'service'
  count?: number
  size?: 'sm' | 'md'
}

export const DiagnosticBadge: React.FC<DiagnosticBadgeProps> = ({
  type,
  count,
  size = 'sm'
}) => {
  const labels = {
    ecu: 'ECU',
    dtc: 'DTC',
    did: 'DID',
    routine: 'Routine',
    service: 'Service',
  }

  return (
    <Badge diagnostic={type} size={size}>
      {labels[type]}
      {count !== undefined && ` (${count})`}
    </Badge>
  )
}