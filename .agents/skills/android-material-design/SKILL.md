---
name: android-material-design
description: >-
  Google Material Design 3 (Material You / M3 Expressive) design standard.
  Enforces dynamic color tonal palettes, M3 elevation without muddy drop shadows,
  edge-to-edge system drawing, tactile ripple feedback, and adaptive window size classes.
---

# Android Material Design 3 (Material You) Standard

An exhaustive engineering and design specification based on Google's **Material Design 3 (M3 Expressive)** and **Material You**.

## 1. Dynamic Color Roles & Tonal Surfaces

Material Design 3 moves away from single accent colors to cohesive tonal palettes:

| M3 Token Role                 | Functional Purpose                        | Usage Rule                                                        |
| :---------------------------- | :---------------------------------------- | :---------------------------------------------------------------- |
| **Primary**                   | High-emphasis fill (FABs, key buttons)    | Use sparingly for the one defining action per screen.             |
| **On Primary**                | Text/icon displayed on top of Primary     | Guaranteed high-contrast pairing (e.g. white or dark on primary). |
| **Primary Container**         | Standout background for secondary actions | Low-contrast emphasis (e.g. badge, active nav tab).               |
| **On Primary Container**      | Text/icon displayed on Primary Container  | Harmonious color derived from primary tone.                       |
| **Surface**                   | Base screen canvas                        | Baseline background color.                                        |
| **Surface Dim / Bright**      | Adaptive elevation surfaces               | Shifts subtly in ambient conditions.                              |
| **Surface Container Lowest**  | Sunken cards, inset text fields           | Distinct layer below baseline.                                    |
| **Surface Container**         | Standard cards and dialog containers      | Level 1 elevation without muddy drop shadows.                     |
| **Surface Container High**    | Popups, sheets, floating menus            | Level 2 elevation.                                                |
| **Outline / Outline Variant** | Hairline division lines                   | `1px solid var(--outline-variant)` with subtle opacity.           |

---

## 2. M3 Tonal Elevation (Replacing Muddy Shadows)

In M3, higher elevation is communicated primarily by **tinting the surface container with the primary color**, not by casting large dark drop shadows:

- **Level 0 (Flat):** `bg-surface`
- **Level 1 (Card):** `bg-surface-container` (5% primary tint) + subtle 1px ambient occlusion (`shadow-sm`)
- **Level 2 (Menu/Sheet):** `bg-surface-container-high` (8% primary tint) + `shadow-md`
- **Level 3 (Modal/Dialog):** `bg-surface-container-highest` (11% primary tint) + `shadow-lg`

---

## 3. Touch Feedback & Interaction States

1. **State Layers (Hover, Focus, Pressed, Dragged):**
   - **Hover:** 8% opacity tint of foreground color on surface.
   - **Focus:** 10% opacity tint + 2px outline ring with offset.
   - **Pressed / Active:** 10%–12% opacity radial ripple expanding from touch coordinate.
   - **Dragged:** 16% opacity tint + lift elevation (+1 level).
2. **Tactile Ripple (Web Implementation):**
   - Ripple effect must originate directly from the `(clientX, clientY)` coordinates where the user's finger touched the button, blooming outwards in `< 300ms`.

---

## 4. Edge-to-Edge System Layout & Window Size Classes

- **Edge-to-Edge Drawing:**
  - Content draws underneath the status bar and navigation bar.
  - Transparent system bars with translucent scrim on scroll.
- **Window Size Classes (Adaptive Responsive Breakpoints):**
  - **Compact (< 600dp / < 600px):** Single-column layout, bottom navigation bar (3-5 destinations), full-width bottom sheets.
  - **Medium (600dp - 839dp):** Navigation rail on the left, side-by-side split panels, expanded card grids.
  - **Expanded (>= 840dp):** Persistent drawer navigation, dual-pane master-detail view.

---

## 5. M3 Motion & Expressive Easing

Material 3 uses physics-informed easing curves:

- **Emphasized Decelerate (Enter):** `cubic-bezier(0.05, 0.7, 0.1, 1.0)` — Elements enter rapidly and softly settle into place (300ms–500ms).
- **Emphasized Accelerate (Exit):** `cubic-bezier(0.3, 0.0, 0.8, 0.15)` — Elements leave swiftly (150ms–250ms).
- **Standard (Move / Morph):** `cubic-bezier(0.2, 0.0, 0, 1.0)` — For position and size adjustments.
