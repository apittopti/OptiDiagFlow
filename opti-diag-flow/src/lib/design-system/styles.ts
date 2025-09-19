/**
 * OptiDiagFlow Component Styles
 * Reusable style objects for consistent component styling
 */

import { CSSProperties } from 'react'
import { colors, spacing, typography, borderRadius, shadows, transitions, components, semantic } from './tokens'

// ============================================
// CARD STYLES
// ============================================

export const cardStyles = {
  base: {
    backgroundColor: components.card.background,
    border: `1px solid ${components.card.border}`,
    borderRadius: components.card.borderRadius,
    padding: components.card.padding,
    transition: transitions.all,
  } as CSSProperties,

  hover: {
    backgroundColor: components.card.background,
    border: `1px solid ${components.card.border}`,
    borderRadius: components.card.borderRadius,
    padding: components.card.padding,
    transition: transitions.all,
    cursor: 'pointer',
    '&:hover': {
      boxShadow: components.card.hoverShadow,
      transform: 'translateY(-2px)',
    },
  } as CSSProperties,

  elevated: {
    backgroundColor: components.card.background,
    borderRadius: components.card.borderRadius,
    padding: components.card.padding,
    boxShadow: shadows.md,
    border: 'none',
  } as CSSProperties,

  outlined: {
    backgroundColor: 'transparent',
    border: `1px solid ${colors.border.default}`,
    borderRadius: components.card.borderRadius,
    padding: components.card.padding,
  } as CSSProperties,

  // Stat card specific
  stat: {
    backgroundColor: components.statCard.background,
    border: `1px solid ${components.statCard.border}`,
    borderRadius: components.statCard.borderRadius,
    padding: components.statCard.padding,
    transition: transitions.all,
    cursor: 'pointer',
  } as CSSProperties,
} as const

// ============================================
// BUTTON STYLES
// ============================================

export const buttonStyles = {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: typography.fontWeight.medium,
    transition: transitions.all,
    cursor: 'pointer',
    border: 'none',
    outline: 'none',
  } as CSSProperties,

  // Variants
  primary: {
    backgroundColor: colors.primary[500],
    color: colors.text.inverse,
    '&:hover': {
      backgroundColor: colors.primary[600],
    },
    '&:active': {
      backgroundColor: colors.primary[700],
    },
  } as CSSProperties,

  secondary: {
    backgroundColor: colors.gray[100],
    color: colors.text.primary,
    border: `1px solid ${colors.border.default}`,
    '&:hover': {
      backgroundColor: colors.gray[200],
      borderColor: colors.border.strong,
    },
  } as CSSProperties,

  ghost: {
    backgroundColor: 'transparent',
    color: colors.text.secondary,
    '&:hover': {
      backgroundColor: colors.gray[100],
      color: colors.text.primary,
    },
  } as CSSProperties,

  danger: {
    backgroundColor: colors.error[500],
    color: colors.text.inverse,
    '&:hover': {
      backgroundColor: colors.error[600],
    },
  } as CSSProperties,

  // Sizes
  sizes: {
    sm: {
      height: components.button.height.sm,
      padding: components.button.padding.sm,
      fontSize: components.button.fontSize.sm,
      borderRadius: borderRadius.sm,
    } as CSSProperties,
    md: {
      height: components.button.height.md,
      padding: components.button.padding.md,
      fontSize: components.button.fontSize.md,
      borderRadius: components.button.borderRadius,
    } as CSSProperties,
    lg: {
      height: components.button.height.lg,
      padding: components.button.padding.lg,
      fontSize: components.button.fontSize.lg,
      borderRadius: components.button.borderRadius,
    } as CSSProperties,
  },

  // Icon button
  icon: {
    padding: spacing[2],
    borderRadius: borderRadius.md,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as CSSProperties,
} as const

// ============================================
// INPUT STYLES
// ============================================

export const inputStyles = {
  base: {
    width: '100%',
    height: components.input.height,
    padding: components.input.padding,
    fontSize: components.input.fontSize,
    borderRadius: components.input.borderRadius,
    border: `1px solid ${components.input.borderColor}`,
    backgroundColor: colors.background.primary,
    color: colors.text.primary,
    transition: transitions.colors,
    outline: 'none',
  } as CSSProperties,

  focus: {
    borderColor: components.input.focusBorderColor,
    boxShadow: `0 0 0 3px ${colors.primary[500]}20`,
  } as CSSProperties,

  error: {
    borderColor: colors.error[500],
    '&:focus': {
      borderColor: colors.error[500],
      boxShadow: `0 0 0 3px ${colors.error[500]}20`,
    },
  } as CSSProperties,

  disabled: {
    backgroundColor: colors.gray[50],
    color: colors.text.muted,
    cursor: 'not-allowed',
    opacity: 0.6,
  } as CSSProperties,
} as const

// ============================================
// LAYOUT STYLES
// ============================================

export const layoutStyles = {
  container: {
    maxWidth: '1280px',
    margin: '0 auto',
    padding: `0 ${spacing[6]}`,
  } as CSSProperties,

  grid: {
    display: 'grid',
    gap: spacing[5],
  } as CSSProperties,

  flexRow: {
    display: 'flex',
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: spacing[3],
  } as CSSProperties,

  flexColumn: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: spacing[3],
  } as CSSProperties,

  section: {
    marginBottom: spacing[8],
  } as CSSProperties,

  pageHeader: {
    marginBottom: spacing[6],
  } as CSSProperties,
} as const

// ============================================
// TABLE STYLES
// ============================================

export const tableStyles = {
  container: {
    width: '100%',
    overflowX: 'auto' as const,
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.lg,
    border: `1px solid ${colors.border.light}`,
  } as CSSProperties,

  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
  } as CSSProperties,

  header: {
    backgroundColor: components.table.headerBackground,
    borderBottom: `1px solid ${components.table.borderColor}`,
  } as CSSProperties,

  headerCell: {
    padding: components.table.cellPadding,
    textAlign: 'left' as const,
    fontWeight: typography.fontWeight.semibold,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textTransform: 'uppercase' as const,
    letterSpacing: typography.letterSpacing.wider,
  } as CSSProperties,

  row: {
    borderBottom: `1px solid ${components.table.borderColor}`,
    transition: transitions.colors,
    '&:hover': {
      backgroundColor: components.table.rowHoverBackground,
    },
  } as CSSProperties,

  cell: {
    padding: components.table.cellPadding,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  } as CSSProperties,
} as const

// ============================================
// TAB STYLES
// ============================================

export const tabStyles = {
  container: {
    borderBottom: `1px solid ${components.tabs.borderColor}`,
    marginBottom: spacing[6],
  } as CSSProperties,

  list: {
    display: 'flex',
    gap: spacing[1],
  } as CSSProperties,

  tab: {
    padding: components.tabs.padding,
    color: components.tabs.inactiveColor,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: `${components.tabs.indicatorHeight} solid transparent`,
    cursor: 'pointer',
    transition: transitions.all,
    position: 'relative' as const,
  } as CSSProperties,

  activeTab: {
    color: components.tabs.activeColor,
    borderBottomColor: components.tabs.activeColor,
  } as CSSProperties,

  panel: {
    paddingTop: spacing[6],
  } as CSSProperties,
} as const

// ============================================
// BADGE STYLES
// ============================================

export const badgeStyles = {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: `${spacing[1]} ${spacing[2]}`,
    borderRadius: borderRadius.full,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    textTransform: 'uppercase' as const,
    letterSpacing: typography.letterSpacing.wide,
  } as CSSProperties,

  // Status variants
  status: {
    active: {
      backgroundColor: `${semantic.status.active}15`,
      color: semantic.status.active,
    } as CSSProperties,
    completed: {
      backgroundColor: `${semantic.status.completed}15`,
      color: semantic.status.completed,
    } as CSSProperties,
    processing: {
      backgroundColor: `${semantic.status.processing}15`,
      color: semantic.status.processing,
    } as CSSProperties,
    failed: {
      backgroundColor: `${semantic.status.failed}15`,
      color: semantic.status.failed,
    } as CSSProperties,
    pending: {
      backgroundColor: `${semantic.status.pending}15`,
      color: semantic.status.pending,
    } as CSSProperties,
  },

  // Diagnostic variants
  diagnostic: {
    ecu: {
      backgroundColor: `${semantic.diagnostic.ecu}15`,
      color: semantic.diagnostic.ecu,
    } as CSSProperties,
    dtc: {
      backgroundColor: `${semantic.diagnostic.dtc}15`,
      color: semantic.diagnostic.dtc,
    } as CSSProperties,
    did: {
      backgroundColor: `${semantic.diagnostic.did}15`,
      color: semantic.diagnostic.did,
    } as CSSProperties,
    routine: {
      backgroundColor: `${semantic.diagnostic.routine}15`,
      color: semantic.diagnostic.routine,
    } as CSSProperties,
  },
} as const

// ============================================
// STAT CARD STYLES
// ============================================

export const statCardStyles = {
  container: {
    ...cardStyles.stat,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  } as CSSProperties,

  content: {
    flex: 1,
  } as CSSProperties,

  label: {
    fontSize: components.statCard.labelFontSize,
    color: colors.text.secondary,
    marginBottom: spacing[2],
    fontWeight: typography.fontWeight.medium,
  } as CSSProperties,

  value: {
    fontSize: components.statCard.valueFontSize,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    lineHeight: typography.lineHeight.tight,
  } as CSSProperties,

  icon: {
    width: components.statCard.iconSize,
    height: components.statCard.iconSize,
    borderRadius: borderRadius.lg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as CSSProperties,

  trend: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[1],
    marginTop: spacing[3],
    fontSize: typography.fontSize.xs,
  } as CSSProperties,
} as const

// ============================================
// MODAL STYLES
// ============================================

export const modalStyles = {
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: components.modal.overlayBackground,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: zIndex.modal,
  } as CSSProperties,

  content: {
    backgroundColor: components.modal.contentBackground,
    borderRadius: components.modal.borderRadius,
    padding: components.modal.padding,
    maxWidth: components.modal.maxWidth,
    width: '90%',
    maxHeight: '90vh',
    overflowY: 'auto' as const,
    boxShadow: shadows['2xl'],
  } as CSSProperties,

  header: {
    marginBottom: spacing[4],
    paddingBottom: spacing[4],
    borderBottom: `1px solid ${colors.border.light}`,
  } as CSSProperties,

  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  } as CSSProperties,

  body: {
    color: colors.text.secondary,
    lineHeight: typography.lineHeight.relaxed,
  } as CSSProperties,

  footer: {
    marginTop: spacing[6],
    paddingTop: spacing[4],
    borderTop: `1px solid ${colors.border.light}`,
    display: 'flex',
    justifyContent: 'flex-end',
    gap: spacing[3],
  } as CSSProperties,
} as const

// ============================================
// UTILITY STYLES
// ============================================

export const utilityStyles = {
  spinner: {
    width: '40px',
    height: '40px',
    border: `4px solid ${colors.gray[200]}`,
    borderTop: `4px solid ${colors.primary[500]}`,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  } as CSSProperties,

  divider: {
    width: '100%',
    height: '1px',
    backgroundColor: colors.border.light,
    margin: `${spacing[4]} 0`,
  } as CSSProperties,

  skeleton: {
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.md,
    animation: 'pulse 2s infinite',
  } as CSSProperties,

  scrollable: {
    overflowY: 'auto' as const,
    scrollbarWidth: 'thin' as const,
    scrollbarColor: `${colors.gray[300]} ${colors.gray[100]}`,
  } as CSSProperties,
} as const

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Combine multiple style objects
 */
export const combineStyles = (...styles: (CSSProperties | undefined)[]): CSSProperties => {
  return Object.assign({}, ...styles.filter(Boolean))
}

/**
 * Get status color based on status string
 */
export const getStatusColor = (status: string): string => {
  const normalizedStatus = status?.toLowerCase()
  switch (normalizedStatus) {
    case 'completed':
    case 'success':
      return semantic.status.completed
    case 'processing':
    case 'active':
    case 'running':
      return semantic.status.processing
    case 'failed':
    case 'error':
      return semantic.status.failed
    case 'pending':
    case 'warning':
      return semantic.status.pending
    default:
      return semantic.status.inactive
  }
}

/**
 * Get status background color with opacity
 */
export const getStatusBackground = (status: string, opacity: number = 0.1): string => {
  const color = getStatusColor(status)
  return `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`
}

export default {
  cardStyles,
  buttonStyles,
  inputStyles,
  layoutStyles,
  tableStyles,
  tabStyles,
  badgeStyles,
  statCardStyles,
  modalStyles,
  utilityStyles,
  combineStyles,
  getStatusColor,
  getStatusBackground,
}