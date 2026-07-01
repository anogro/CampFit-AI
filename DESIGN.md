# CampFit AI Design System

## 1. Atmosphere & Identity

CampFit AI should feel like a quiet consulting note inside a workspace app: warm, minimal, and parent-friendly. The UI borrows from Notion-style document products: white paper surfaces, warm gray canvas, thin dividers, restrained blue actions, and practical copy.

The product should not feel like a marketing landing page or an admin form. Parents should feel they are calmly narrowing a decision with a consultant, not completing a test.

## 2. Color

### Palette

| Role | Token | Light | Usage |
|------|-------|-------|-------|
| Surface/primary | --surface-primary | #F6F5F4 | Page background |
| Surface/secondary | --surface-secondary | #FFFFFF | Main cards and form blocks |
| Surface/elevated | --surface-elevated | #FBFBFA | Quiet callouts and nested work areas |
| Surface/tint blue | --surface-tint-blue | #F2F9FF | Selected states and info badges |
| Surface/tint green | --surface-tint-green | #EDF3EC | Positive fit badges |
| Surface/tint yellow | --surface-tint-yellow | #FBF3DB | Cautions and tension notes |
| Text/primary | --text-primary | rgb(0 0 0 / 0.95) | Headlines and main text |
| Text/secondary | --text-secondary | #615D59 | Supporting text |
| Text/tertiary | --text-tertiary | #A39E98 | Captions and hints |
| Border/default | --border-default | rgb(0 0 0 / 0.10) | Cards, inputs, controls |
| Border/subtle | --border-subtle | rgb(0 0 0 / 0.06) | Internal dividers |
| Accent/primary | --accent-primary | #0075DE | Primary CTA, links, progress |
| Accent/hover | --accent-hover | #005BAB | Primary hover |
| Accent/soft | --accent-soft | #F2F9FF | Soft selected surface |
| Status/success | --status-success | #346538 | Positive fit |
| Status/warning | --status-warning | #956400 | Cautions |
| Status/error | --status-error | #9F2F2D | Validation and failures |
| Status/info | --status-info | #097FE8 | Informational state |
| Focus/ring | --focus-ring | rgb(9 127 232 / 0.38) | Keyboard focus outline |

### Rules

- Blue is used sparingly: progress, primary actions, and selected states only.
- Surfaces stay warm white or white; avoid large saturated sections.
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

- Primary: "Helvetica Neue", Arial, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
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

- The app opens directly on the useful workflow, not a marketing hero.
- Avoid nested decorative cards. Nested areas must be functional callouts, field groups, or result blocks.
- Main surfaces use 8px radius or less.

## 5. Components

### Progress

- **Structure**: compact label, percentage, 6px progress bar.
- **States**: current progress only; no visible six-step navigation.
- **Motion**: width transition only.

### Workspace Card

- **Structure**: white paper surface, 1px warm border, 8px radius, soft Notion-style shadow.
- **Usage**: main form and result cards.
- **Motion**: hover is optional; no floating card drama.

### Form Control

- **Structure**: label, optional hint, input/select/textarea.
- **Variants**: text, number, select, textarea, radio tile.
- **Radius**: 6px for inputs and buttons.
- **States**: hover border, focus outline, selected blue tint.
- **Accessibility**: labels are always connected to controls.

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
| --shadow-card | 0 4px 18px rgb(0 0 0 / 0.04), 0 2px 8px rgb(0 0 0 / 0.027), 0 1px 3px rgb(0 0 0 / 0.02) |
