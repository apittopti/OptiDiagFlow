/**
 * OptiDiagFlow Design System Components
 * Export all reusable design system components
 */

export { Card, StatCard } from './Card'
export { Button, IconButton } from './Button'
export { Badge, StatusBadge, DiagnosticBadge } from './Badge'

// Re-export design tokens and styles for easy access
export { colors, spacing, typography, borderRadius, shadows, transitions, semantic } from '@/lib/design-system/tokens'
export {
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
  getStatusBackground
} from '@/lib/design-system/styles'