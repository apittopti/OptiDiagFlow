/**
 * OptiDiagFlow Design System - Button Component
 * Reusable button component with consistent styling
 */

import React, { CSSProperties, ReactNode } from 'react'
import { buttonStyles, combineStyles } from '@/lib/design-system/styles'
import { colors, spacing } from '@/lib/design-system/tokens'

interface ButtonProps {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
  iconPosition?: 'left' | 'right'
  fullWidth?: boolean
  disabled?: boolean
  loading?: boolean
  className?: string
  style?: CSSProperties
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled = false,
  loading = false,
  className = '',
  style = {},
  onClick,
  type = 'button',
}) => {
  // Combine base, variant, and size styles
  const variantStyle = {
    primary: {
      backgroundColor: colors.primary[500],
      color: colors.text.inverse,
      border: 'none',
    },
    secondary: {
      backgroundColor: 'white',
      color: colors.text.primary,
      border: `1px solid ${colors.border.default}`,
    },
    ghost: {
      backgroundColor: 'transparent',
      color: colors.text.secondary,
      border: 'none',
    },
    danger: {
      backgroundColor: colors.error[500],
      color: colors.text.inverse,
      border: 'none',
    },
  }[variant]

  const sizeStyle = buttonStyles.sizes[size]

  const buttonStyle: CSSProperties = combineStyles(
    buttonStyles.base,
    variantStyle,
    sizeStyle,
    {
      width: fullWidth ? '100%' : 'auto',
      opacity: disabled || loading ? 0.6 : 1,
      cursor: disabled || loading ? 'not-allowed' : 'pointer',
      gap: spacing[2],
    },
    style
  )

  // Hover colors based on variant
  const hoverColors = {
    primary: colors.primary[600],
    secondary: colors.gray[50],
    ghost: colors.gray[100],
    danger: colors.error[600],
  }

  const activeColors = {
    primary: colors.primary[700],
    secondary: colors.gray[100],
    ghost: colors.gray[200],
    danger: colors.error[700],
  }

  return (
    <button
      type={type}
      className={className}
      style={buttonStyle}
      onClick={onClick}
      disabled={disabled || loading}
      onMouseEnter={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.backgroundColor = hoverColors[variant]
          if (variant === 'secondary') {
            e.currentTarget.style.borderColor = colors.border.strong
          }
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.backgroundColor = variantStyle.backgroundColor
          if (variant === 'secondary') {
            e.currentTarget.style.borderColor = colors.border.default
          }
        }
      }}
      onMouseDown={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.backgroundColor = activeColors[variant]
        }
      }}
      onMouseUp={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.backgroundColor = hoverColors[variant]
        }
      }}
    >
      {loading && (
        <span
          style={{
            display: 'inline-block',
            width: '16px',
            height: '16px',
            border: '2px solid currentColor',
            borderRadius: '50%',
            borderTopColor: 'transparent',
            animation: 'spin 0.6s linear infinite',
          }}
        />
      )}
      {icon && iconPosition === 'left' && !loading && icon}
      {children}
      {icon && iconPosition === 'right' && !loading && icon}
    </button>
  )
}

// Icon-only button variant
interface IconButtonProps {
  icon: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  className?: string
  style?: CSSProperties
  onClick?: () => void
  ariaLabel: string
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  variant = 'ghost',
  size = 'md',
  disabled = false,
  className = '',
  style = {},
  onClick,
  ariaLabel,
}) => {
  const sizeMap = {
    sm: '32px',
    md: '40px',
    lg: '48px',
  }

  const iconSizeMap = {
    sm: 16,
    md: 20,
    lg: 24,
  }

  const buttonStyle: CSSProperties = {
    width: sizeMap[size],
    height: sizeMap[size],
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-4)',
    transition: 'all 200ms ease',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    fontSize: `${iconSizeMap[size]}px`,
    ...style,
  }

  // Apply variant styles
  const variantStyles = {
    primary: {
      backgroundColor: colors.primary[500],
      color: colors.text.inverse,
      border: 'none',
    },
    secondary: {
      backgroundColor: 'white',
      color: colors.text.primary,
      border: `1px solid ${colors.border.default}`,
    },
    ghost: {
      backgroundColor: 'transparent',
      color: colors.text.secondary,
      border: 'none',
    },
    danger: {
      backgroundColor: colors.error[500],
      color: colors.text.inverse,
      border: 'none',
    },
  }

  Object.assign(buttonStyle, variantStyles[variant])

  return (
    <button
      className={className}
      style={buttonStyle}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      onMouseEnter={(e) => {
        if (!disabled) {
          if (variant === 'ghost') {
            e.currentTarget.style.backgroundColor = colors.gray[100]
          } else if (variant === 'primary') {
            e.currentTarget.style.backgroundColor = colors.primary[600]
          } else if (variant === 'secondary') {
            e.currentTarget.style.backgroundColor = colors.gray[50]
          } else if (variant === 'danger') {
            e.currentTarget.style.backgroundColor = colors.error[600]
          }
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = variantStyles[variant].backgroundColor
        }
      }}
    >
      {icon}
    </button>
  )
}