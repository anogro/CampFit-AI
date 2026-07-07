# CampFit Design System

## 1. Atmosphere & Identity

CampFit should feel like a deeper ANOGRO decision panel for parents choosing a child's first overseas camp: calm, trustworthy, premium, and easy to scan. The UI follows ANOGRO's soft layered clarity: white glass surfaces, subtle blur, restrained blue action states, green growth cues, and practical guidance copy.

The product should not feel like a generic AI tool, SaaS dashboard, admin form, or separate child-service brand. Parents should feel they are opening an ANOGRO diagnostic note that organizes the family's first-camp criteria.

## 2. Color

### Palette

| Role | Token | Light | Usage |
|------|-------|-------|-------|
| Surface/primary | --surface-primary | #FFFFFF | Panel and card base |
| Surface/secondary | --surface-secondary | #F9FAFB | Page background and soft sections |
| Surface/elevated | --surface-elevated | #FBFAF8 | Warm guidance surfaces |
| Surface/glass | --surface-glass | rgb(255 255 255 / 0.72) | ANOGRO glass shell |
| Surface/tint blue | --surface-tint-blue | #F2F9FF | Category chips, selected/info states |
| Surface/tint green | --surface-tint-green | #EEF8F1 | Positive/growth cues |
| Surface/tint yellow | --surface-tint-yellow | #FFF2D8 | Cautions and tension notes |
| Surface/tint lavender | --surface-tint-lavender | #F1ECFA | Gentle secondary highlight |
| Surface/tint peach | --surface-tint-peach | #FFF4EB | Very low warmth for image halo only |
| Text/primary | --text-primary | #111827 | Headlines and main text |
| Text/ink | --text-ink | #1F2933 | Hero copy |
| Text/secondary | --text-secondary | #4B5563 | Supporting text |
| Text/tertiary | --text-tertiary | #615D59 | Captions and hints |
| Border/default | --border-default | #E5E7EB | Cards, inputs, controls |
| Border/subtle | --border-subtle | rgb(0 0 0 / 0.08) | Internal dividers and panel cards |
| Accent/primary | --accent-primary | #0075DE | Primary diagnostic CTA and focus states |
| Accent/hover | --accent-hover | #005BAB | Primary hover |
| Accent/soft | --accent-soft | #F2F9FF | Soft selected surface |
| Accent/blue | --accent-blue | #097FE8 | Chips, focus ring, secondary link |
| Accent/brand green | --accent-brand-green | #15803D | Growth/positive criterion cue |
| Accent/lavender | --accent-lavender | #9A86BD | Small supporting accent |
| Accent/peach | --accent-peach | #F97316 | Small warmth accent |
| CTA/glass bg | --cta-glass-bg | rgb(255 255 255 / 0.66) | Primary hero CTA surface |
| CTA/glass bg hover | --cta-glass-bg-hover | rgb(255 255 255 / 0.84) | Primary hero CTA hover |
| CTA/glass border | --cta-glass-border | rgb(255 255 255 / 0.86) | Primary hero CTA edge |
| CTA/glass text | --cta-glass-text | #1F2933 | Primary hero CTA text |
| CTA/glass shadow | --cta-glass-shadow | inset 0 1px 0 rgb(255 255 255 / 0.92), 0 16px 34px rgb(17 24 39 / 0.08), 0 3px 12px rgb(9 127 232 / 0.08) | Primary hero CTA depth |
| Status/success | --status-success | #15803D | Positive fit |
| Status/warning | --status-warning | #946A2D | Cautions |
| Status/error | --status-error | #9F2F2D | Validation and failures |
| Status/info | --status-info | #097FE8 | Informational state |
| Focus/ring | --focus-ring | rgb(9 127 232 / 0.32) | Keyboard focus outline |

### Rules

- Primary hero CTA uses a glass surface with navy text; action blue is reserved for focus, progress, selected, and secondary action states.
- Brand green is reserved for growth/positive criterion cues and small directional accents.
- Surfaces stay white, warm white, or soft gray; CampFit should read as an ANOGRO panel, not as a separate cream-colored app.
- Warnings use pale yellow backgrounds, not red blocks.

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Tracking | Usage |
|-------|------|--------|-------------|----------|-------|
| Display | 56px / 3.5rem | 700 | 1.05 | -0.03em | Page title |
| H1 | 40px / 2.5rem | 700 | 1.08 | -0.03em | Desktop section lead |
| H2 | 26px / 1.625rem | 700 | 1.2 | -0.02em | Step titles |
| H3 | 22px / 1.375rem | 700 | 1.27 | -0.02em | Card titles |
| Body/lg | 18px / 1.125rem | 500 | 1.55 | 0 | Lead paragraphs |
| Body | 16px / 1rem | 400 | 1.5 | 0 | Default text |
| Body/sm | 14px / 0.875rem | 400 | 1.55 | 0 | Secondary info |
| Caption | 12px / 0.75rem | 600 | 1.4 | 0.01em | Labels and metadata |

### Font Stack

- Primary: Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, "Helvetica Neue", Arial, sans-serif
- Mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace

### Rules

- Body text never falls below 14px.
- Korean UI copy uses `[word-break:keep-all]` on headings, help text, cards, and legal notes.
- Headings use restrained negative tracking; controls and body text use normal tracking.

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
| --space-12 | 48px | Page section spacing |

### Grid

- Max content width: 1120px
- Column system: single column on mobile, two-column form workspace from 1024px upward
- Breakpoints: sm 640px, md 768px, lg 1024px, xl 1280px

### Rules

- The app opens directly on the useful workflow, with a warm guide-like first screen rather than a technical AI landing page.
- Avoid nested decorative cards. Nested areas must be functional callouts, field groups, or result blocks.
- Main surfaces use 8px radius or less.

## 5. Components

### Progress

- **Structure**: compact label, percentage, 6px progress bar.
- **States**: current progress only; no visible six-step navigation.
- **Motion**: width transition only.

### Guide Workspace Card

- **Structure**: warm white or translucent surface, 1px hairline border, 24-32px radius, restrained sage-tinted shadow.
- **Usage**: main form and result cards.
- **Motion**: hover may lift 2-4px with opacity/transform only.

### Form Control

- **Structure**: label, optional hint, input/select/textarea.
- **Variants**: text, number, select, textarea, radio tile.
- **Radius**: 14-18px for inputs and utility controls; CTAs use capsules.
- **States**: hover border, focus outline, selected sage or muted blue tint.
- **Accessibility**: labels are always connected to controls.

### Glass CTA

- **Structure**: capsule button, translucent white surface, hairline white edge, navy label, small green direction icon.
- **States**: hover increases opacity and lifts 2px; focus uses the standard blue focus ring.
- **Usage**: first-screen primary action where a solid blue button would feel too AI/SaaS-like.

### Muted Glass Button

- **Structure**: capsule button, softer translucent white surface, navy or secondary label, subtle inset highlight.
- **States**: hover increases opacity without filling the control with blue.
- **Usage**: previous, example, feedback, download, and secondary actions across the form and result pages.

### Result Card

- **Structure**: rank metadata, camp name, location traits, fit badge, score, reason, caution, questions, CTA.
- **Spacing**: 20px between major blocks.
- **Text**: explanations use keep-all word breaking and line-height 1.5.

### Visual Result Report

- **Structure**: compact metric cards, one radar chart, readiness bars, support tags, report download action.
- **Usage**: result summary before recommendation cards; it should make the decision criteria visible before long explanations.
- **Disclosure**: detailed reasons, cautions, and consultation questions stay inside expandable detail blocks.
- **Tone**: chart styling remains document-like and quiet; avoid saturated dashboard colors.

## 6. Motion & Interaction

### Timing

| Type | Duration | Easing | Usage |
|------|----------|--------|-------|
| Micro | 150ms | ease-out | Button press |
| Standard | 220ms | ease-in-out | Selected states, progress |
| Emphasis | 360ms | cubic-bezier(0.2, 0.6, 0.25, 1) | Result entry |

### Rules

- Only transform and opacity are animated, except the progress bar width.
- Buttons use subtle active scale, not bouncing or heavy movement.
- Reduced motion removes non-essential transitions.

## 7. Depth & Surface

### Strategy

Borders provide most separation. Shadows are quiet and only used on the primary workspace and recommendation cards.

| Level | Value | Usage |
|-------|-------|-------|
| Flat | none | Page background and text sections |
| Whisper | 1px solid var(--border-default) | Cards and controls |
| Card | var(--shadow-card) | Main workspace and result cards |

| Token | Value |
|-------|-------|
| --shadow-card | 0 32px 90px rgb(0 0 0 / 0.1), 0 4px 18px rgb(0 0 0 / 0.04), inset 0 1px 0 rgb(255 255 255 / 0.75) |
