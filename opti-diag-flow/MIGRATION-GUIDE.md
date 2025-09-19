# Design System Migration Guide

## Quick Start

The new design system has been successfully implemented! Here's how to migrate your pages:

## 1. Import Design System Components

Replace inline styles with design system components:

```typescript
// OLD - Inline styles
<div style={{ backgroundColor: '#f9fafb', padding: '20px', borderRadius: '8px' }}>

// NEW - Design system
import { Card } from '@/components/design-system'
<Card variant="nested">
```

## 2. Use Design Tokens

Replace hardcoded values with tokens:

```typescript
// OLD
style={{ marginBottom: '24px', padding: '32px' }}

// NEW
import { spacing } from '@/lib/design-system/tokens'
style={{ marginBottom: spacing[6], padding: spacing[8] }}
```

## 3. CSS Classes Alternative

You can also use CSS utility classes:

```html
<!-- Stats Cards -->
<div class="ds-grid-4">
  <div class="ds-stat-card">...</div>
</div>

<!-- Buttons -->
<button class="ds-btn ds-btn-primary">Action</button>

<!-- Cards -->
<div class="ds-card ds-card-hover">...</div>
```

## 4. Common Replacements

### Stat Cards
```typescript
// OLD
<div style={{
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  padding: '20px',
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
}}>

// NEW
<StatCard
  label="Total ECUs"
  value={ecus.length}
  icon={<Cpu size={24} />}
  color="primary"
/>
```

### Buttons
```typescript
// OLD
<button style={{
  padding: '10px 20px',
  backgroundColor: '#3b82f6',
  color: 'white',
  border: 'none',
  borderRadius: '8px'
}}>

// NEW
<Button variant="primary">Click Me</Button>
```

### Tabs
```typescript
// OLD
<div style={{
  display: 'flex',
  gap: '8px',
  backgroundColor: '#e5e7eb',
  borderRadius: '8px',
  padding: '4px'
}}>

// NEW
<div className="ds-tabs">
  <button className="ds-tab ds-tab-active">Tab 1</button>
  <button className="ds-tab">Tab 2</button>
</div>
```

## 5. Color Consistency

Replace these colors globally:

| Old Color | New Token | Usage |
|-----------|-----------|--------|
| #ffffff | colors.background.primary | Main backgrounds |
| #f9fafb, #fafafa | colors.background.secondary | Nested cards |
| #e5e7eb | colors.border.light | Light borders |
| #3b82f6 | colors.primary[500] | Primary actions |
| #10b981 | colors.success[500] | Success states |
| #ef4444 | colors.error[500] | Error states |

## 6. Spacing System

Use consistent spacing (4px base unit):

| Pixels | Token | Usage |
|--------|-------|--------|
| 4px | spacing[1] | Tight spacing |
| 8px | spacing[2] | Small gaps |
| 12px | spacing[3] | Default gaps |
| 16px | spacing[4] | Section gaps |
| 24px | spacing[6] | Large gaps |
| 32px | spacing[8] | Page padding |

## 7. Typography

Use semantic classes:

```css
.ds-heading-1  /* Page titles */
.ds-heading-2  /* Section titles */
.ds-heading-3  /* Subsections */
.ds-heading-4  /* Card titles */
.ds-label      /* Field labels */
.ds-value      /* Data values */
.ds-text-secondary  /* Muted text */
```

## 8. Grid Layouts

Replace custom grids with utility classes:

```css
.ds-grid-2  /* 2 column grid */
.ds-grid-3  /* 3 column grid */
.ds-grid-4  /* 4 column grid */
.ds-stack   /* Vertical stack */
```

## 9. Migration Priority

1. **Phase 1**: Update all stat cards and buttons
2. **Phase 2**: Standardize card styles and borders
3. **Phase 3**: Update tabs and navigation
4. **Phase 4**: Standardize forms and inputs
5. **Phase 5**: Update tables and data displays

## 10. Testing Checklist

After migration, verify:
- [ ] All cards have consistent shadows and borders
- [ ] Buttons follow the variant system
- [ ] Spacing is consistent using tokens
- [ ] Colors match the design system palette
- [ ] Typography uses semantic classes
- [ ] Responsive layouts work correctly
- [ ] Hover states are consistent
- [ ] Focus states are accessible

## Example: Complete Page Migration

See `src/app/jobs/[id]/page-refactored.tsx` for a complete example of a migrated page using the design system.

## Need Help?

- Design tokens: `src/lib/design-system/tokens.ts`
- Style objects: `src/lib/design-system/styles.ts`
- Components: `src/components/design-system/`
- CSS classes: `src/app/globals-design-system.css`
- Documentation: `DESIGN-SYSTEM.md`