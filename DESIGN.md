---
name: Modern Editorial
colors:
  surface: '#fdf8f8'
  surface-dim: '#ddd9d8'
  surface-bright: '#fdf8f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f7f3f2'
  surface-container: '#f1edec'
  surface-container-high: '#ebe7e6'
  surface-container-highest: '#e5e2e1'
  on-surface: '#1c1b1b'
  on-surface-variant: '#444748'
  inverse-surface: '#313030'
  inverse-on-surface: '#f4f0ef'
  outline: '#747878'
  outline-variant: '#c4c7c7'
  surface-tint: '#5f5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1c1b1b'
  on-primary-container: '#858383'
  inverse-primary: '#c8c6c5'
  secondary: '#255dad'
  on-secondary: '#ffffff'
  secondary-container: '#79a9fd'
  on-secondary-container: '#003c7e'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1c1b1a'
  on-tertiary-container: '#868382'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e5e2e1'
  primary-fixed-dim: '#c8c6c5'
  on-primary-fixed: '#1c1b1b'
  on-primary-fixed-variant: '#474746'
  secondary-fixed: '#d7e2ff'
  secondary-fixed-dim: '#abc7ff'
  on-secondary-fixed: '#001b3f'
  on-secondary-fixed-variant: '#00458f'
  tertiary-fixed: '#e6e2df'
  tertiary-fixed-dim: '#cac6c4'
  on-tertiary-fixed: '#1c1b1a'
  on-tertiary-fixed-variant: '#484645'
  background: '#fdf8f8'
  on-background: '#1c1b1b'
  surface-variant: '#e5e2e1'
  paper-bg: '#F9F7F2'
  ink-text: '#1A1A1A'
  accent-red: '#E63946'
  selection-blue: '#E6F0FA'
  grid-line: rgba(26, 26, 26, 0.15)
  cell-locked: '#F1EFE9'
typography:
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-md:
    fontFamily: Playfair Display
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  clue-bar:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-clue:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  grid-input:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 24px
  grid-hint-turkish:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 11px
    letterSpacing: 0.02em
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
spacing:
  container-margin: 24px
  grid-gutter: 1px
  cell-padding: 4px
  section-gap: 32px
  stack-tight: 8px
---

## Brand & Style
The design system is rooted in the "Modern Editorial" movement, specifically tailored for the intellectual and rhythmic nature of the Turkish Çengel Bulmaca. It prioritizes the quiet, focused dignity of a high-end Sunday newspaper over typical mobile game aesthetics.

The visual narrative is built on the concept of **Tactile Intellectualism**. It uses high-contrast "Ink on Paper" aesthetics to evoke a premium, calm, and intelligent environment. The system deliberately avoids gamification tropes—such as heavy gradients, 3D shadows, or explosive animations—favoring instead a "Zen Mode" that respects the user's flow and intellectual satisfaction.

Key characteristics include:
- **Minimalism & Tactility:** Heavy use of whitespace and fine-line borders to define structure.
- **Flat Depth:** Reliance on tonal shifts and "pressed" states rather than elevation to signify interaction.
- **Turkish Context:** Optimized for the unique character set and directional flow of Turkish crosswords.

## Colors
The palette is intentionally restrained to mimic physical newsprint.

- **Primary Surface:** The "Paper" hex (`#F9F7F2`) serves as the foundation for all screens, providing a softer, more premium reading experience than pure white.
- **Ink:** The primary color (`#1A1A1A`) is used for all functional lines, text, and structural borders.
- **Interactive Accents:** `Accent Red` is reserved for high-priority selections and critical CTAs. `Newspaper Blue` acts as the secondary highlight for selected words or focus areas within the grid.
- **Selection State:** Use a highly desaturated version of the secondary blue for background highlights in the grid to maintain legibility of the "Ink" text.

## Typography
The system employs a sophisticated pairing of a classic Serif for editorial personality and a high-legibility Sans-Serif for functional gameplay.

- **Editorial Headers:** Use **Playfair Display** for page titles and section headers to establish the premium newspaper aesthetic.
- **Functional Interface:** **Inter** is used for all gameplay elements.
- **Grid Strategy:** The `grid-input` must be centered and clear. The `grid-hint-turkish` handles the small clues embedded within cells; these should be set in Uppercase with slightly tighter line-height to maximize space within the 1:1 grid ratio.
- **The Clue Bar:** This is the most critical legibility component, serving as a high-contrast mirror for the active grid clue.

## Layout & Spacing
The layout follows a **Fixed-Fluid Hybrid** model. Navigation and menu screens use a fixed-width container with generous 24px side margins to emphasize a "calm" atmosphere.

- **The Puzzle Grid:** Uses a strict 1px "Ink" gutter between cells to create a sharp, architectural look.
- **Responsive Panning:** On mobile, the grid may exceed the viewport. The "Active Word" must always be cleared of the Keyboard and Clue Bar.
- **Vertical Rhythm:** Use generous 32px gaps between major editorial sections (e.g., "Daily Puzzle" vs "Archive") to prevent visual clutter.

## Elevation & Depth
Elevation is conveyed through **Tonal Layers** rather than shadows.

- **Surface Levels:** The base layer is `paper-bg`. Active or "focused" elements do not rise in Z-space; instead, they change color (to `selection-blue`) or use a 1px "Ink" border.
- **Tactile Feedback:** Use "Pressed" states where the background color subtly darkens (e.g., to `#F1EFE9`) when a cell or button is touched, simulating the physical depression of a key or a stamp on paper.
- **Outlines:** Use low-opacity "Ink" outlines for input fields and secondary buttons. High-legibility is maintained through contrast rather than depth.

## Shapes
To maintain the "Modern Editorial" aesthetic, the system uses **Sharp (0px)** corners for almost all functional elements, including grid cells, clue bars, and buttons.

If a softer touch is required for tertiary interface elements (like chips or tags), a maximum of `rounded-sm` (4px) may be used, but the primary gameplay loop should remain strictly rectilinear to mirror the traditional newspaper grid.

## Components
- **Grid Cells:** 1:1 aspect ratio. Contains `grid-hint-turkish` (top-aligned) and `grid-input` (centered). Active cells use a 2px `primary` border.
- **Clue Bar:** A full-width sticky component above the keyboard. High contrast background (`primary` or `secondary`) with white text to draw focus to the current task.
- **Primary Button:** Rectangular, "Ink" background, "Paper" text. No rounded corners. Subtle 1px "Ink" border with padding.
- **The Turkish Keyboard:** Custom-built for the Turkish alphabet. Keys should be flat with "Pressed" tonal shifts. No shadows between keys.
- **Locked Word:** When a word is correctly solved, the cells transition to `cell-locked` background with a subtle "Ink" checkmark or tonal lock icon, preventing further edits.
- **Archive List:** Minimalist list items separated by a 1px hairline border, using `headline-md` for puzzle titles.
