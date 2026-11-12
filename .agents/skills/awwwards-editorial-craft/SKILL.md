---
name: awwwards-editorial-craft
description: Awwwards Site of the Day & Site of the Year digital design standard. Synthesizes editorial typography, spatial rhythm, luxury tactile materials, asymmetric layouts, and bespoke digital craftsmanship to eliminate cookie-cutter aesthetics.
---

# Awwwards Editorial Digital Craft Standard

## 1. Core Philosophy: The Handcrafted Editorial Object
Modern web design in the era of generative AI has fallen into a trap of generic sameness: rounded pastel pills, identical hero headers, centered cards within cards, and gratuitous icon clutter.

Awwwards-level digital design treats a digital interface as a **handcrafted editorial artifact**—akin to a bespoke luxury magazine (Kinfolk, Cereal, The Gentlewoman) or an exquisite Swiss publication.

### The 5 Tenets of Editorial Digital Craft:
1. **Typographic Supremacy:** Typography is not just text; it is the primary visual architecture. Pair a characterful, high-contrast serif (Fraunces, Playfair, Cormorant) with a razor-sharp, tight-tracked neutral sans (Inter, SF Pro, Neue Haas Grotesk).
2. **Intentional Spatial Asymmetry:** Avoid endless rows of identical centered cards. Use alternating rhythm, editorial pull-quotes, wide margins, and deliberate asymmetry that guides the human eye with curiosity.
3. **Bespoke Micro-Contrast:** Replace muddy shadows (`box-shadow: 0 4px 20px rgba(0,0,0,0.08)`) with razor-sharp 1px hairline dividers (`1px solid rgba(0,0,0,0.06)` or `rgba(255,255,255,0.08)`), subtle surface luminosity, and tactile depth.
4. **Restraint & Negative Space:** Luxury breathes. Crammed elements scream cheapness; generous padding (32px to 64px) and proportional vertical rhythm signal confidence and exclusivity.
5. **Zero Generic AI Clutter:** No decorative emoji badges, no redundant icons next to unambiguous words, and no gradient blobs that serve no purpose.

---

## 2. Typographic Palette & Hierarchy Rules

### Hierarchy Scale:
| Level | Font Family | Size | Weight | Tracking | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display Title** | High-contrast Serif | 36px–56px | 400 or 500 (Italic accents) | `-0.03em` | Emotional anchor, poetic titles |
| **Section Label** | Neutral Sans | 10px–11px | 600 or 700 | `+0.18em` to `+0.25em` | Monospaced or uppercase categorization |
| **Editorial Headline** | Display Serif | 20px–28px | 500 or 600 | `-0.02em` | Card anchors and narrative callouts |
| **Body Reading** | Crisp Sans | 14px–16px | 400 | `-0.01em` | Highly legible narratives, 1.6 line height |
| **Metadata / Numbers** | Monospace or Sans | 11px–12px | 500 (tabular-nums) | `+0.05em` | Dates, coordinates, timestamps |

### Editorial Typographic Techniques:
- **Italicized Emotional Accents:** Emphasize emotional words within a serif headline with italics (e.g., *"Three months of* quiet devotion*."*).
- **Hairline Dividers:** Use `h-px bg-foreground/8` instead of thick gray borders.
- **Editorial Em-dashes:** Use typographical em-dashes `—` or bullet points `•` with generous spacing rather than tacky emojis.

---

## 3. Surface & Material Palette

### Light / Warm Alabaster Palette (Romantic Editorial):
- **Base Background:** `#fcfbf9` or `#faf8f5` (warm parchment/linen, never pure sterile `#ffffff` or muddy gray `#f3f4f6`).
- **Surface Elevation 1 (Cards):** `rgba(255, 255, 255, 0.72)` with `backdrop-filter: blur(24px)` and `1px solid rgba(0, 0, 0, 0.05)`.
- **Text Primary:** `#18181b` (zinc-900 / warm charcoal, never `#000000`).
- **Text Secondary:** `#71717a` (zinc-500).
- **Text Muted:** `#a1a1aa` (zinc-400).
- **Accent Rose / Terracotta:** `#d97768` / `#e11d48` used with extreme restraint (tiny status pips or heart pins).

---

## 4. Spacing, Rhythm & Layout Composition

### Negative Space Rules:
- **Card Padding:** Minimum `24px` on mobile, `32px` on desktop. Never crowd card borders.
- **Section Gap:** Minimum `32px` to `48px` between narrative sections.
- **Micro-gaps:** `8px` between label and value, `16px` between title and descriptive paragraph.

### Layout Rhythm:
- Break symmetrical grids with an **Editorial Hero Spread**: An expansive top section with an architectural typography header, a live dual-city transit status line, and a serene narrative milestone.
- Complement with a 2-column or asymmetric 12-column layout on larger viewports.

---

## 5. Micro-Interactions & Physics
- **Hover Lift:** `translateY(-2px)` with subtle border highlight (`rgba(0,0,0,0.12)`), never bouncy spring cartoons on basic cards.
- **Active State:** `scale(0.985)` with smooth 120ms release.
- **Transitions:** `cubic-bezier(0.16, 1, 0.3, 1)` (Apple/Kowalski smooth deceleration curve).
