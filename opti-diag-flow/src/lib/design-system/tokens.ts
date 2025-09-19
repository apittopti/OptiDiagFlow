/**
 * OptiDiagFlow Design System Tokens
 * Centralized design tokens for consistent styling across the application
 */

// ============================================
// COLOR PALETTE
// ============================================

/**
 * Base Colors
 * Professional automotive diagnostic theme with blue as primary
 */
export const colors = {
  // Primary Blue - Trust, Technology, Precision
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6', // Main primary
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },

  // Secondary Gray - Professional, Clean, Modern
  gray: {
    50: '#fafafa',
    100: '#f4f4f5',
    200: '#e4e4e7',
    300: '#d4d4d8',
    400: '#a1a1aa',
    500: '#71717a',
    600: '#52525b',
    700: '#3f3f46',
    800: '#27272a',
    900: '#18181b',
  },

  // Success Green - Diagnostics Passed, Connected
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e', // Main success
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },

  // Warning Amber - Attention Required
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b', // Main warning
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },

  // Error Red - Diagnostic Issues, Failures
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444', // Main error
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },

  // Info Cyan - Information, ECU Data
  info: {
    50: '#ecfeff',
    100: '#cffafe',
    200: '#a5f3fc',
    300: '#67e8f9',
    400: '#22d3ee',
    500: '#06b6d4', // Main info
    600: '#0891b2',
    700: '#0e7490',
    800: '#155e75',
    900: '#164e63',
  },

  // Purple - Premium Features, Advanced Diagnostics
  purple: {
    50: '#faf5ff',
    100: '#f3e8ff',
    200: '#e9d5ff',
    300: '#d8b4fe',
    400: '#c084fc',
    500: '#a855f7',
    600: '#9333ea',
    700: '#7e22ce',
    800: '#6b21a8',
    900: '#581c87',
  },

  // Background Colors
  background: {
    primary: '#ffffff',
    secondary: '#fafafa',
    tertiary: '#f5f5f5',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },

  // Text Colors
  text: {
    primary: '#111827',
    secondary: '#6b7280',
    tertiary: '#9ca3af',
    inverse: '#ffffff',
    muted: '#a1a1aa',
  },

  // Border Colors
  border: {
    light: '#e5e7eb',
    default: '#d1d5db',
    strong: '#9ca3af',
    focus: '#3b82f6',
  },
} as const

// ============================================
// SPACING SYSTEM
// ============================================

/**
 * Spacing Scale - 4px base unit
 * Consistent spacing for layouts and components
 */
export const spacing = {
  px: '1px',
  0: '0',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  2.5: '10px',
  3: '12px',
  3.5: '14px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  9: '36px',
  10: '40px',
  11: '44px',
  12: '48px',
  14: '56px',
  16: '64px',
  20: '80px',
  24: '96px',
  28: '112px',
  32: '128px',
} as const

// ============================================
// TYPOGRAPHY
// ============================================

/**
 * Typography System
 * Consistent font sizes, weights, and line heights
 */
export const typography = {
  fontFamily: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
  },

  fontSize: {
    xs: '12px',
    sm: '14px',
    base: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '30px',
    '4xl': '36px',
    '5xl': '48px',
  },

  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  lineHeight: {
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },

  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
} as const

// ============================================
// BORDER RADIUS
// ============================================

export const borderRadius = {
  none: '0',
  sm: '4px',
  default: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  full: '9999px',
} as const

// ============================================
// SHADOWS
// ============================================

/**
 * Shadow System
 * Elevation levels for depth hierarchy
 */
export const shadows = {
  none: 'none',
  xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  default: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',

  // Colored shadows for interactive elements
  primarySoft: '0 4px 14px 0 rgba(59, 130, 246, 0.25)',
  successSoft: '0 4px 14px 0 rgba(34, 197, 94, 0.25)',
  errorSoft: '0 4px 14px 0 rgba(239, 68, 68, 0.25)',
  warningSoft: '0 4px 14px 0 rgba(245, 158, 11, 0.25)',
} as const

// ============================================
// TRANSITIONS
// ============================================

export const transitions = {
  duration: {
    fast: '150ms',
    normal: '200ms',
    slow: '300ms',
    slower: '500ms',
  },

  easing: {
    linear: 'linear',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },

  // Common transition properties
  all: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
  colors: 'background-color 200ms cubic-bezier(0.4, 0, 0.2, 1), border-color 200ms cubic-bezier(0.4, 0, 0.2, 1), color 200ms cubic-bezier(0.4, 0, 0.2, 1)',
  shadow: 'box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1)',
  transform: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)',
} as const

// ============================================
// Z-INDEX SCALE
// ============================================

export const zIndex = {
  hide: -1,
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  overlay: 1200,
  modal: 1300,
  popover: 1400,
  tooltip: 1500,
  notification: 1600,
} as const

// ============================================
// BREAKPOINTS
// ============================================

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const

// ============================================
// COMPONENT TOKENS
// ============================================

/**
 * Standardized component-specific design tokens
 */
export const components = {
  card: {
    background: colors.background.primary,
    border: colors.border.light,
    borderRadius: borderRadius.lg,
    padding: spacing[6],
    shadow: shadows.sm,
    hoverShadow: shadows.md,
  },

  button: {
    height: {
      sm: '32px',
      md: '40px',
      lg: '48px',
    },
    padding: {
      sm: `${spacing[2]} ${spacing[3]}`,
      md: `${spacing[2.5]} ${spacing[4]}`,
      lg: `${spacing[3]} ${spacing[5]}`,
    },
    fontSize: {
      sm: typography.fontSize.sm,
      md: typography.fontSize.base,
      lg: typography.fontSize.lg,
    },
    borderRadius: borderRadius.md,
  },

  input: {
    height: '40px',
    padding: `${spacing[2]} ${spacing[3]}`,
    borderRadius: borderRadius.md,
    fontSize: typography.fontSize.base,
    borderColor: colors.border.default,
    focusBorderColor: colors.primary[500],
  },

  statCard: {
    background: colors.background.primary,
    border: colors.border.light,
    borderRadius: borderRadius.lg,
    padding: spacing[5],
    iconSize: '48px',
    valueFontSize: typography.fontSize['3xl'],
    labelFontSize: typography.fontSize.sm,
  },

  table: {
    headerBackground: colors.gray[50],
    borderColor: colors.border.light,
    rowHoverBackground: colors.gray[50],
    cellPadding: `${spacing[3]} ${spacing[4]}`,
  },

  tabs: {
    borderColor: colors.border.light,
    activeColor: colors.primary[500],
    inactiveColor: colors.text.secondary,
    indicatorHeight: '2px',
    padding: `${spacing[3]} ${spacing[4]}`,
  },

  modal: {
    overlayBackground: 'rgba(0, 0, 0, 0.5)',
    contentBackground: colors.background.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[6],
    maxWidth: '600px',
  },
} as const

// ============================================
// SEMANTIC TOKENS
// ============================================

/**
 * Semantic color mappings for common UI states
 */
export const semantic = {
  // Status colors
  status: {
    active: colors.primary[500],
    completed: colors.success[500],
    processing: colors.info[500],
    failed: colors.error[500],
    pending: colors.warning[500],
    inactive: colors.gray[400],
  },

  // Interactive states
  interactive: {
    hover: {
      primary: colors.primary[600],
      secondary: colors.gray[100],
      danger: colors.error[600],
    },
    active: {
      primary: colors.primary[700],
      secondary: colors.gray[200],
      danger: colors.error[700],
    },
    disabled: {
      background: colors.gray[100],
      text: colors.gray[400],
    },
  },

  // Diagnostic specific
  diagnostic: {
    ecu: colors.purple[500],
    dtc: colors.error[500],
    did: colors.info[500],
    routine: colors.warning[500],
    service: colors.success[500],
  },
} as const

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Helper function to create consistent hover styles
 */
export const getHoverStyle = (baseColor: string, hoverColor: string) => ({
  transition: transitions.colors,
  backgroundColor: baseColor,
  '&:hover': {
    backgroundColor: hoverColor,
  },
})

/**
 * Helper function to create consistent focus styles
 */
export const getFocusStyle = (color: string = colors.primary[500]) => ({
  outline: 'none',
  boxShadow: `0 0 0 3px ${color}33`, // 20% opacity
  borderColor: color,
})

export default {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
  transitions,
  zIndex,
  breakpoints,
  components,
  semantic,
}