/**
 * OptiDiagFlow Design System - Card Component
 * Reusable card component with consistent styling
 */

import React, { CSSProperties, ReactNode } from 'react'
import { cardStyles, combineStyles } from '@/lib/design-system/styles'
import { colors, spacing } from '@/lib/design-system/tokens'

interface CardProps {
  children: ReactNode
  variant?: 'base' | 'hover' | 'elevated' | 'outlined' | 'stat'
  className?: string
  style?: CSSProperties
  onClick?: () => void
  padding?: keyof typeof spacing
  borderColor?: string
  backgroundColor?: string
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'base',
  className = '',
  style = {},
  onClick,
  padding,
  borderColor,
  backgroundColor,
}) => {
  const baseStyle = cardStyles[variant] || cardStyles.base

  const customStyle: CSSProperties = {
    ...baseStyle,
    ...(padding && { padding: spacing[padding] }),
    ...(borderColor && { borderColor }),
    ...(backgroundColor && { backgroundColor }),
    ...style,
  }

  // Add hover effects if clickable
  if (onClick && variant === 'base') {
    Object.assign(customStyle, {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    })
  }

  return (
    <div
      className={className}
      style={customStyle}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (onClick || variant === 'hover' || variant === 'stat') {
          const target = e.currentTarget as HTMLDivElement
          target.style.boxShadow = 'var(--shadow-md)'
          target.style.transform = 'translateY(-2px)'
        }
      }}
      onMouseLeave={(e) => {
        if (onClick || variant === 'hover' || variant === 'stat') {
          const target = e.currentTarget as HTMLDivElement
          target.style.boxShadow = variant === 'elevated' ? 'var(--shadow-md)' : 'none'
          target.style.transform = 'translateY(0)'
        }
      }}
    >
      {children}
    </div>
  )
}

// Specialized StatCard component
interface StatCardProps {
  label: string
  value: string | number
  icon?: ReactNode
  iconColor?: string
  iconBackground?: string
  trend?: {
    value: string
    positive: boolean
  }
  loading?: boolean
  onClick?: () => void
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  iconColor,
  iconBackground,
  trend,
  loading = false,
  onClick,
}) => {
  return (
    <Card variant="stat" onClick={onClick}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <p
            style={{
              fontSize: 'var(--font-size-sm)',
              color: colors.text.secondary,
              marginBottom: spacing[2],
              margin: 0,
              fontWeight: 500,
            }}
          >
            {label}
          </p>
          <h3
            style={{
              fontSize: 'var(--stat-value-size)',
              fontWeight: 700,
              color: colors.text.primary,
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {loading ? '-' : value}
          </h3>
          {trend && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing[1],
                marginTop: spacing[3],
              }}
            >
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: trend.positive ? colors.success[500] : colors.error[500],
                  fontWeight: 500,
                }}
              >
                {trend.positive ? '+' : ''}{trend.value}
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div
            style={{
              width: 'var(--stat-card-icon-size)',
              height: 'var(--stat-card-icon-size)',
              borderRadius: 'var(--radius-4)',
              backgroundColor: iconBackground || `${iconColor}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: iconColor,
            }}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  )
}