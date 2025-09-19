# OptiDiagFlow Design System

A comprehensive design system for consistent UI across the OptiDiagFlow application.

## Overview

The OptiDiagFlow Design System provides a centralized set of design tokens, styles, and reusable components to ensure consistency across all pages and features. It's built with TypeScript and integrates seamlessly with Next.js 15.5.3.

## Quick Start

### Using Design Tokens

```typescript
import { colors, spacing, typography } from '@/lib/design-system/tokens'

// Use in inline styles
const style = {
  color: colors.primary[500],
  padding: spacing[4],
  fontSize: typography.fontSize.lg
}
```

### Using Style Objects

```typescript
import { cardStyles, buttonStyles, combineStyles } from '@/lib/design-system/styles'

// Apply predefined styles
<div style={cardStyles.base}>Content</div>

// Combine multiple styles
<div style={combineStyles(cardStyles.base, { marginTop: spacing[4] })}>
  Content
</div>
```

### Using Components

```typescript
import { Card, Button, Badge, StatCard } from '@/components/design-system'

// Card component
<Card variant="hover" onClick={() => console.log('clicked')}>
  Card content
</Card>

// Button component
<Button variant="primary" size="md" icon={<PlusIcon />}>
  Add New
</Button>

// Badge component
<Badge variant="success">Active</Badge>
<StatusBadge status="completed" />
<DiagnosticBadge type="ecu" count={5} />

// StatCard component
<StatCard
  label="Total Jobs"
  value={42}
  icon={<ActivityIcon />}
  iconColor={colors.primary[500]}
  trend={{ value: "12%", positive: true }}
/>
```

## Design Tokens

### Color Palette

#### Primary Colors (Blue)
- **Primary 500** (`#3b82f6`): Main brand color for CTAs and key actions
- **Primary 600** (`#2563eb`): Hover state for primary elements
- **Primary 700** (`#1d4ed8`): Active/pressed state

#### Status Colors
- **Success** (`#22c55e`): Completed diagnostics, successful operations
- **Warning** (`#f59e0b`): Attention required, pending states
- **Error** (`#ef4444`): Failed diagnostics, errors
- **Info** (`#06b6d4`): ECU information, processing states
- **Purple** (`#a855f7`): Advanced features, premium options

#### Neutral Colors (Gray)
- **Gray 50** (`#fafafa`): Light backgrounds, hover states
- **Gray 100** (`#f4f4f5`): Secondary backgrounds
- **Gray 500** (`#71717a`): Muted text
- **Gray 700** (`#3f3f46`): Primary text
- **Gray 900** (`#18181b`): Headings

### Spacing Scale

Based on a 4px unit system:
- `spacing[1]`: 4px
- `spacing[2]`: 8px
- `spacing[3]`: 12px
- `spacing[4]`: 16px
- `spacing[5]`: 20px
- `spacing[6]`: 24px
- `spacing[8]`: 32px

### Typography

```typescript
// Font sizes
fontSize.xs: '12px'  // Small labels, badges
fontSize.sm: '14px'  // Body text, buttons
fontSize.base: '16px' // Default text
fontSize.lg: '18px'  // Subheadings
fontSize.xl: '20px'  // Section headings
fontSize['2xl']: '24px' // Page headings
fontSize['3xl']: '30px' // Large values

// Font weights
fontWeight.normal: 400
fontWeight.medium: 500
fontWeight.semibold: 600
fontWeight.bold: 700
```

### Border Radius

- `borderRadius.sm`: 4px - Small elements
- `borderRadius.md`: 8px - Buttons, inputs
- `borderRadius.lg`: 12px - Cards, containers
- `borderRadius.xl`: 16px - Modals
- `borderRadius.full`: 9999px - Pills, badges

### Shadows

- `shadows.sm`: Subtle elevation for cards
- `shadows.md`: Hover state elevation
- `shadows.lg`: Modal and dropdown shadows
- `shadows.xl`: High elevation elements

## Component Guidelines

### Cards

Three main card styles for different use cases:

```typescript
// Standard card
<Card variant="base">Content</Card>

// Hoverable card (for clickable items)
<Card variant="hover" onClick={handleClick}>Content</Card>

// Elevated card (for important content)
<Card variant="elevated">Content</Card>

// Stat card (for metrics)
<StatCard
  label="Total ECUs"
  value={25}
  icon={<DatabaseIcon />}
  iconColor={colors.purple[500]}
/>
```

### Buttons

Consistent button styles across the application:

```typescript
// Primary action
<Button variant="primary">Save Changes</Button>

// Secondary action
<Button variant="secondary">Cancel</Button>

// Ghost button (minimal style)
<Button variant="ghost">Learn More</Button>

// Danger action
<Button variant="danger">Delete</Button>

// With icon
<Button icon={<PlusIcon />} iconPosition="left">
  Add Item
</Button>

// Icon-only button
<IconButton
  icon={<SettingsIcon />}
  variant="ghost"
  ariaLabel="Settings"
/>
```

### Badges

For status indicators and labels:

```typescript
// Status badges
<StatusBadge status="completed" />
<StatusBadge status="processing" />
<StatusBadge status="failed" />

// Diagnostic badges
<DiagnosticBadge type="ecu" count={5} />
<DiagnosticBadge type="dtc" count={3} />

// Custom badges
<Badge variant="info">New</Badge>
<Badge variant="warning" dot>Attention</Badge>
```

### Tables

Consistent table styling:

```typescript
<div style={tableStyles.container}>
  <table style={tableStyles.table}>
    <thead style={tableStyles.header}>
      <tr>
        <th style={tableStyles.headerCell}>Column</th>
      </tr>
    </thead>
    <tbody>
      <tr style={tableStyles.row}>
        <td style={tableStyles.cell}>Data</td>
      </tr>
    </tbody>
  </table>
</div>
```

### Forms

Input field styling:

```typescript
<input
  style={inputStyles.base}
  onFocus={(e) => Object.assign(e.target.style, inputStyles.focus)}
  onBlur={(e) => Object.assign(e.target.style, inputStyles.base)}
/>
```

## Migration Guide

### Replacing Inline Styles

**Before:**
```typescript
<div style={{
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  padding: '20px',
  border: '1px solid #e5e7eb'
}}>
```

**After:**
```typescript
import { Card } from '@/components/design-system'

<Card variant="base">
```

### Updating Color Values

**Before:**
```typescript
style={{ color: '#3b82f6', backgroundColor: '#f9fafb' }}
```

**After:**
```typescript
import { colors } from '@/lib/design-system/tokens'

style={{
  color: colors.primary[500],
  backgroundColor: colors.gray[50]
}}
```

### Standardizing Spacing

**Before:**
```typescript
style={{ padding: '24px', marginBottom: '32px' }}
```

**After:**
```typescript
import { spacing } from '@/lib/design-system/tokens'

style={{
  padding: spacing[6],
  marginBottom: spacing[8]
}}
```

## Best Practices

1. **Always use design tokens** instead of hardcoded values
2. **Prefer component usage** over style objects when possible
3. **Use semantic color names** (e.g., `semantic.status.completed` instead of `colors.green[500]`)
4. **Maintain consistency** - if a pattern exists, use it
5. **Document deviations** - if you need custom styles, comment why

## CSS Classes (Alternative Approach)

If you prefer CSS classes, use the utility classes defined in `globals-design-system.css`:

```html
<!-- Card -->
<div className="ds-card ds-card-hover">Content</div>

<!-- Button -->
<button className="ds-btn ds-btn-primary">Click Me</button>

<!-- Badge -->
<span className="ds-badge ds-badge-success">Active</span>

<!-- Stat Card -->
<div className="ds-stat-card">...</div>

<!-- Table -->
<table className="ds-table">
  <thead className="ds-table-header">...</thead>
  <tbody>
    <tr className="ds-table-row">...</tr>
  </tbody>
</table>
```

## File Structure

```
src/
├── lib/
│   └── design-system/
│       ├── tokens.ts      # Design tokens (colors, spacing, etc.)
│       └── styles.ts      # Reusable style objects
├── components/
│   └── design-system/
│       ├── Card.tsx       # Card components
│       ├── Button.tsx     # Button components
│       ├── Badge.tsx      # Badge components
│       └── index.ts       # Barrel export
└── app/
    ├── globals.css        # Original global styles
    └── globals-design-system.css # Design system CSS classes
```

## Examples

### Dashboard Stat Card

```typescript
import { StatCard } from '@/components/design-system'
import { Activity } from 'lucide-react'
import { colors } from '@/lib/design-system/tokens'

<StatCard
  label="Active Jobs"
  value={stats.activeJobs}
  icon={<Activity size={24} />}
  iconColor={colors.success[500]}
  iconBackground={`${colors.success[500]}15`}
  trend={{ value: "12%", positive: true }}
  loading={loading}
  onClick={() => router.push('/jobs')}
/>
```

### Job Status Card

```typescript
import { Card, StatusBadge } from '@/components/design-system'
import { spacing } from '@/lib/design-system/tokens'

<Card variant="hover" onClick={() => router.push(`/jobs/${job.id}`)}>
  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
    <div>
      <h3>{job.name}</h3>
      <StatusBadge status={job.status} />
    </div>
    <span>{job.date}</span>
  </div>
</Card>
```

### Action Buttons Group

```typescript
import { Button } from '@/components/design-system'
import { Plus, Download, RefreshCw } from 'lucide-react'

<div style={{ display: 'flex', gap: spacing[3] }}>
  <Button variant="primary" icon={<Plus size={16} />}>
    New Job
  </Button>
  <Button variant="secondary" icon={<Download size={16} />}>
    Export
  </Button>
  <Button variant="ghost" icon={<RefreshCw size={16} />}>
    Refresh
  </Button>
</div>
```

## Accessibility

The design system includes accessibility features:
- Focus states with visible outlines
- ARIA labels for icon-only buttons
- Sufficient color contrast ratios
- Keyboard navigation support
- Screen reader friendly components

## Future Enhancements

Planned additions to the design system:
- Dark mode support
- Animation presets
- Toast/notification components
- Modal components
- Form validation styles
- Loading states and skeletons
- Data visualization color scales

## Support

For questions or suggestions about the design system, please refer to the main project documentation or create an issue in the repository.