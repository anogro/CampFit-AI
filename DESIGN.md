# CampFit AI Design System

## 1. Atmosphere & Identity

CampFit AI feels like a calm education consulting desk: structured, trustworthy, and parent-friendly without becoming clinical. The signature is a guided fit report that pairs navy editorial hierarchy with soft blue and mint surfaces, so parents feel they are reviewing a thoughtful consultation note rather than taking a test.

## 2. Color

### Palette

| Role | Token | Light | Dark | Usage |
|------|-------|-------|------|-------|
| Surface/primary | --surface-primary | #F8FBFF | #07111F | Page background |
| Surface/secondary | --surface-secondary | #FFFFFF | #0D1B2D | Panels and cards |
| Surface/elevated | --surface-elevated | #F0F7FF | #13243A | Emphasized report areas |
| Text/primary | --text-primary | #102033 | #F8FBFF | Headlines and main text |
| Text/secondary | --text-secondary | #516174 | #B8C7D9 | Supporting text |
| Text/tertiary | --text-tertiary | #7A8A9F | #8798AD | Captions and hints |
| Border/default | --border-default | #D7E3F1 | #263A52 | Inputs, cards, dividers |
| Border/subtle | --border-subtle | #EAF1F8 | #1B2B40 | Soft separations |
| Accent/primary | --accent-primary | #155EEF | #72A7FF | Primary actions, links, focus |
| Accent/hover | --accent-hover | #0F49BC | #9BC1FF | Hover state |
| Accent/soft | --accent-soft | #DDF5F0 | #123B38 | Supportive highlights |
| Status/success | --status-success | #0E8F63 | #4ADE80 | Positive feedback |
| Status/warning | --status-warning | #B7791F | #F6C453 | Cautions and fit notes |
| Status/error | --status-error | #C2413A | #FCA5A5 | Validation and failures |
| Status/info | --status-info | #155EEF | #72A7FF | Informational state |

### Rules

- Accent blue is reserved for navigation, focus, primary buttons, and selected controls.
- Warning uses amber instead of red unless the user must correct an error.
- No color outside this table is used in application CSS.

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Tracking | Usage |
|-------|------|--------|-------------|----------|-------|
| Display | 48px / 3rem | 760 | 1.08 | 0 | Page title |
| H1 | 36px / 2.25rem | 720 | 1.16 | 0 | Section headers |
| H2 | 28px / 1.75rem | 680 | 1.25 | 0 | Step titles |
| H3 | 21px / 1.3125rem | 650 | 1.35 | 0 | Card titles |
| Body/lg | 18px / 1.125rem | 450 | 1.6 | 0 | Lead paragraphs |
| Body | 16px / 1rem | 420 | 1.6 | 0 | Default text |
| Body/sm | 14px / 0.875rem | 420 | 1.5 | 0 | Secondary info |
| Caption | 12px / 0.75rem | 620 | 1.4 | 0 | Labels and metadata |

### Font Stack

- Primary: Arial, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
- Mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace
- Serif: none

### Rules

- Body text never falls below 14px.
- Form labels and result captions use the Caption scale with normal letter spacing.

## 4. Spacing & Layout

### Base Unit

All spacing derives from a base of 4px.

| Token | Value | Usage |
|-------|-------|-------|
| --space-1 | 4px | Icon to label |
| --space-2 | 8px | Compact groups |
| --space-3 | 12px | Inputs |
| --space-4 | 16px | Default element gap |
| --space-5 | 20px | Form group gap |
| --space-6 | 24px | Card padding |
| --space-8 | 32px | Step spacing |
| --space-10 | 40px | Report sections |
| --space-12 | 48px | Page section spacing |
| --space-16 | 64px | Hero and dashboard rhythm |

### Grid

- Max content width: 1180px
- Column system: 12 columns on desktop, single column on mobile
- Breakpoints: sm 640px, md 768px, lg 1024px, xl 1280px

### Rules

- All spacing uses 4px multiples.
- Dense report content uses two-column grids only from 1024px upward.

## 5. Components

### Stepper
- **Structure**: ordered step buttons with current, complete, and locked states.
- **Variants**: compact mobile list, desktop horizontal progress.
- **Spacing**: --space-2 to --space-4.
- **States**: current, complete, disabled.
- **Accessibility**: buttons expose disabled state and current step text.
- **Motion**: transform-only active feedback.

### Report Card
- **Structure**: title, metadata row, score badge, body sections.
- **Variants**: recommendation, insight, caution.
- **Spacing**: --space-4 to --space-6.
- **States**: default and selected feedback.
- **Accessibility**: semantic headings and button labels.
- **Motion**: hover border and transform.

### Form Control
- **Structure**: label, optional hint, input/select/textarea, validation message.
- **Variants**: text, select, radio tile, textarea.
- **Spacing**: --space-2 to --space-5.
- **States**: hover, focus, error, disabled.
- **Accessibility**: labels are always connected to controls.
- **Motion**: focus ring transition.

## 6. Motion & Interaction

### Timing

| Type | Duration | Easing | Usage |
|------|----------|--------|-------|
| Micro | 120ms | ease-out | Button press |
| Standard | 220ms | ease-in-out | Step reveal, card hover |
| Emphasis | 420ms | cubic-bezier(0.16, 1, 0.3, 1) | Result dashboard entry |

### Rules

- Only transform and opacity are animated.
- Every interactive element has hover, active, and focus states.
- Reduced motion removes non-essential transitions.

## 7. Depth & Surface

### Strategy

Mixed, with borders as the default and soft shadows only for the main workspace and result cards.

| Level | Value | Usage |
|-------|-------|-------|
| Subtle | 0 1px 2px rgb(16 32 51 / 0.04) | Small controls |
| Default | 0 14px 40px rgb(21 94 239 / 0.10) | Main panel |
| Prominent | 0 24px 70px rgb(16 32 51 / 0.14) | Result cards |

| Type | Value | Usage |
|------|-------|-------|
| Default | 1px solid var(--border-default) | Cards and controls |
| Subtle | 1px solid var(--border-subtle) | Internal dividers |
