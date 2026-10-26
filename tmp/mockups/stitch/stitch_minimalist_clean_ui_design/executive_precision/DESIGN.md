---
name: Executive Precision
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#45464d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#0051d5'
  on-secondary: '#ffffff'
  secondary-container: '#316bf3'
  on-secondary-container: '#fefcff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#002114'
  on-tertiary-container: '#069669'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b4c5ff'
  on-secondary-fixed: '#00174b'
  on-secondary-fixed-variant: '#003ea8'
  tertiary-fixed: '#85f8c4'
  tertiary-fixed-dim: '#68dba9'
  on-tertiary-fixed: '#002114'
  on-tertiary-fixed-variant: '#005137'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 2.25rem
    fontWeight: '600'
    lineHeight: 2.75rem
    letterSpacing: -0.025em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 1.75rem
    fontWeight: '600'
    lineHeight: 2.25rem
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: '600'
    lineHeight: 2rem
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Inter
    fontSize: 1.125rem
    fontWeight: '600'
    lineHeight: 1.5rem
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.5rem
    letterSpacing: -0.011em
  body-md:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.25rem
    letterSpacing: -0.006em
  body-sm:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: 1rem
    letterSpacing: '0'
  label-md:
    fontFamily: Inter
    fontSize: 0.8125rem
    fontWeight: '500'
    lineHeight: 1.125rem
    letterSpacing: -0.005em
  label-sm:
    fontFamily: Inter
    fontSize: 0.6875rem
    fontWeight: '600'
    lineHeight: 0.875rem
    letterSpacing: 0.04em
  data-mono-lg:
    fontFamily: JetBrains Mono
    fontSize: 1.125rem
    fontWeight: '500'
    lineHeight: 1.5rem
    letterSpacing: -0.02em
  data-mono-md:
    fontFamily: JetBrains Mono
    fontSize: 0.8125rem
    fontWeight: '400'
    lineHeight: 1.125rem
    letterSpacing: -0.01em
  data-mono-sm:
    fontFamily: JetBrains Mono
    fontSize: 0.6875rem
    fontWeight: '400'
    lineHeight: 0.875rem
    letterSpacing: '0'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-tablet: 1.5rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

This design system embodies high-throughput executive computing: a synthesis of Apple's typographic restraint and structural composure with the operational density and scannability demanded by institutional enterprise workflows. It is crafted for operators, dealmakers, and product teams who parse dense data sets, manage high-stakes pipelines, and require absolute clarity over decorative flair.

The aesthetic philosophy centers on:
- **Structural Quietude:** Interfaces recede so data takes precedence. Unnecessary background blocks, heavy dividers, and decorative illustrations are replaced with white space, microscopic contrast variations, and hairline borders.
- **Micro-Deliberation:** Every element—from table cell padding to tokenized badge margins—is tuned for zero optical drift.
- **Information Architecture as Luxury:** Visual premium is achieved through precision typography, strictly metered vertical rhythm, and decisive single-accent focus points.

## Colors

The palette operates on a neutral foundation of zinc and slate undertones, anchored by high-contrast ink blacks and calibrated semantic points.

### Palette Architecture
- **Primary Ink (`#0F172A`):** Deepest slate. Used for primary typography, core interactive framing, and dominant call-to-action states.
- **Cobalt Accent (`#2563EB`):** High-clarity executive blue. Reserved for active navigation indicators, key focus states, selection rings, and high-priority workflow triggers.
- **Success / Liquid (`#059669`):** Pure emerald. Restricted strictly to affirmative states: closed/won deals, connected integrations, operational health, and positive financial delta.
- **Warning / Stale (`#D97706`):** Warm amber. Used for decaying leads, expiring tokens, or attention-required pipeline phases.
- **Destructive / Flag (`#E11D48`):** Precision rose. High visibility for errors, blocking alerts, and critical anomalies.
- **Canvas & Elevation Tokens:**
  - Base canvas: `#FFFFFF`
  - Subtle layer/hover surface: `#F8FAFC`
  - Component container/active cell: `#F1F5F9`
  - Hairline structural border: `#E2E8F0`
  - Muted foreground/secondary text: `#64748B`

### Usage Rules
- Avoid broad color flooding; color is an instrument of signaling, not decoration.
- Status colors must always pair an alert pigment with a low-opacity tinted background (e.g., `#ECFDF5` backing emerald text) to maintain high contrast and soft visual density.

## Typography

The type system pairs a surgical grotesque (`Inter`) for structural UI hierarchy with a technical monospaced typeface (`JetBrains Mono`) for computational values.

### Role Allocation
- **Inter (Headlines, Body, Actions):** Neutral, high x-height, engineered for legibility across tight vertically-stacked components. Negative tracking is applied intentionally to larger weights to replicate premium editorial typesetting.
- **JetBrains Mono (Data, Timestamps, Metrics):** Mandatory for all currencies, IDs, percentage deltas, dates, and tabular numbers. Monospaced alignment prevents horizontal jitter during inline data updates and facilitates instant visual column comparison.
- **Micro Labels (`label-sm`):** Rendered in small caps or strict upper-case tracking (+0.04em) at 11px to designate section groupings, field metadata, and status indicators without overpowering surrounding data.

## Layout & Spacing

This layout uses a high-density, multi-pane shell structure governed by a 4px baseline rhythm.

### Grid & Canvas Structure
- **Global Structure:** A fixed-width left command sidebar (240px desktop, collapsed to 64px icon bar on sub-1280px views), coupled to an edge-to-edge flexible workspace divided into modular panels.
- **Data Workspaces:** Employ a fluid grid utilizing a standard 12-column layout with strict 16px (`gutter`) gaps on mobile and tablet, expanding to 24px (`gutter-desktop`) above 1440px.
- **Density Philosophy:** Vertical table cell padding is clamped to `0.5rem` (`space-sm`) to allow at least 18 rows within standard 1080p viewports without pagination or excessive scrolling.
- **Container Insets:** Component internal padding uses strict multiples: `0.75rem` (`space-md`) for compact widgets and `1.25rem` (`space-lg`) for standard card frames. Outer application boundaries adhere to rigid safe gutters: `1rem` on mobile, scaling to `2rem` across wide displays.

## Elevation & Depth

Depth is established almost entirely through micro-borders and hairline contrast separation rather than theatrical dropshadows.

### Layering Rules
- **Layer 0 (Canvas Base):** Pure white (`#FFFFFF`) or off-slate workspace backdrop (`#F8FAFC`).
- **Layer 1 (Card & Modular Panes):** Surface pure white (`#FFFFFF`) framed strictly by a 1px solid stroke in `#E2E8F0`. Shadow: `0 1px 2px 0 rgba(15, 23, 42, 0.04)`.
- **Layer 2 (Overlays, Flyouts & Menus):** Pure white surfaces bordered with `#CBD5E1`. Shadow: `0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -1px rgba(15, 23, 42, 0.04)`.
- **Layer 3 (Modals & Command Palettes):** Framed with a 1px hairline stroke (`#94A3B8`). Shadow: `0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.06)`. Backing scrim uses `rgba(15, 23, 42, 0.4)` combined with an 8px backdrop blur.
- **Active / Drag State:** Translates 1px upward, dropping a concentrated ambient shadow: `0 8px 16px -4px rgba(37, 99, 235, 0.12)`.

## Shapes

The design system employs a soft, controlled corner radius (Level 1) that communicates precision, engineering rigor, and maximum UI real-estate utilization.

### Curvature Tokens
- **Base UI Elements (Buttons, Inputs, Table Cells, Checkboxes):** 4px (`0.25rem`). Maintains structural firmness and avoids the consumer-grade feel of pill forms for transactional elements.
- **Mid Containers (Cards, Modals, Flyout Panels):** 8px (`0.5rem`). Softens high-level component blocks while sustaining crisp internal grid alignment.
- **Pill Exceptions:** High-visibility stage indicators, categorization tags, and notification dots are explicitly granted complete rounding (`9999px`) to create an unmistakable semantic distinction against rectangular data cells and buttons.

## Components

### Buttons
- **Primary:** Dark slate background (`#0F172A`), white label (`#FFFFFF`), 1px solid border (`#0F172A`), height 32px (compact) or 36px (standard). Hover: `#1E293B`. Active: `#334155`.
- **Secondary / Outline:** Background `#FFFFFF`, text `#0F172A`, border 1px `#E2E8F0`. Hover: `#F8FAFC` and border `#CBD5E1`.
- **Ghost / Icon Actions:** Transparent background, text `#64748B`, 28x28px or 32x32px square footprint. Hover: `#F1F5F9`, text `#0F172A`.

### Badges & Stage Pills
- Pill shape (`rounded-full`), height 20px, horizontal padding 8px.
- Typography: `JetBrains Mono` at 11px (`label-sm`), medium weight.
- Status Variants:
  - *Active / Won:* Background `#ECFDF5`, text `#047857`, border 1px `#A7F3D0`.
  - *In Review / Info:* Background `#EFF6FF`, text `#1D4ED8`, border 1px `#BFDBFE`.
  - *Stale / Pipeline Warning:* Background `#FFFBEB`, text `#B45309`, border 1px `#FDE68A`.
  - *Critical / Flag:* Background `#FFF1F2`, text `#BE123C`, border 1px `#FECDD3`.

### Dense Data Tables
- Table header: Height 32px, background `#F8FAFC`, uppercase `label-sm` text in `#64748B`, bottom border 1px `#E2E8F0`.
- Rows: Height 40px, surface `#FFFFFF`, bottom border 1px `#F1F5F9`. Hover state: `#F8FAFC`. Selected state: `#EFF6FF`.
- Alignment: Text is left-aligned; numerical values, currency metrics, and status pills are right-aligned.

### Input Fields & Controls
- Height 34px, background `#FFFFFF`, border 1px `#E2E8F0`, typography `body-md` in `#0F172A`.
- Placeholder: `#94A3B8`.
- Focus State: Border color `#2563EB`, box-shadow `0 0 0 1px #2563EB` (crisp ring without wide diffusion).
- Checkboxes: 16x16px, 4px rounded corner, border 1px `#CBD5E1`. Checked state: background `#2563EB`, white checkmark glyph.

### Cards & Metrics Blocks
- Background `#FFFFFF`, 1px perimeter border `#E2E8F0`, corner radius 8px (`rounded-lg`).
- Internal layout: Top section houses micro-label (`label-sm`) paired with an icon action; mid-section displays massive data metrics in `JetBrains Mono` (`data-mono-lg`); bottom reveals percentage deltas and period tags.