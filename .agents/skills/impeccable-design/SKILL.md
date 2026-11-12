---
name: impeccable-design
description: >-
  Impeccable frontend design, anti-AI-slop standard, and visual polish system.
  Adapted from Paul Bakaus's Impeccable vocabulary and ruleset. Use whenever critiquing,
  typesetting, colorizing, refining layout hierarchy, or polishing web interfaces to eliminate
  generic AI-generated aesthetics.
---

# Impeccable Design & Anti-AI-Slop System

Adapted from Paul Bakaus's **Impeccable** (`pbakaus/impeccable`) design philosophy and mechanical anti-pattern detection rules.

## Core Tenet

AI models default to the mathematical average of their training data: generic Inter typography, cliché indigo-to-purple gradients, flat white cards with excessive drop shadows, lifeless buttons, and zero emotional resonance ("AI Slop").

**Impeccable software feels deliberately authored by human craftspeople.** Every curve, margin, color shade, and transition has intentional weight, purpose, and restraint.

---

## 1. The Impeccable Command Suite

When executing UI design and review, apply these cognitive passes:

### `/impeccable critique`

Audit an existing screen or component against:

1. **Visual Hierarchy:** Does the eye immediately know what to read first, second, and third? Or is everything competing with equal contrast?
2. **Intentional Contrast:** Are primary actions distinct from secondary actions? Is muted text still meeting WCAG AA contrast (minimum 4.5:1)?
3. **Density & Breathing Room:** Are items choked inside tiny paddings, or excessively floating in unanchored white space?
4. **Emotional Texture:** Does the design convey warmth, intimacy, precision, or romance appropriate to its domain?

### `/impeccable typeset`

Elevate typography from raw text to fine editorial print:

- **Heading Kerning:** Tighten letter spacing on large titles (`tracking-[-0.02em]` to `tracking-[-0.035em]`).
- **Body Measure:** Enforce line length between `45ch` and `68ch`. Never let paragraph text span edge-to-edge on desktop.
- **Line Heights:** Tighter line-height on large display text (`leading-[1.1]` to `leading-[1.2]`), generous line-height on body reading (`leading-[1.6]` to `leading-[1.7]`).
- **Tabular Numerals:** Apply `tabular-nums` / `font-variant-numeric: tabular-nums` to timers, countdowns, timestamps, and stat counters to eliminate jitter.
- **Font Pairing:** Contrast an expressive display font (e.g., serif like _Fraunces_ or _Cormorant_) with an ultra-readable geometric/humanist sans (_Nunito_, _Geist_, _SF Pro_).

### `/impeccable colorize`

Replace synthetic defaults with harmonious real-world color systems:

- **Never Pure Black or Gray:** Replace `#000000` with rich chromatic blacks (e.g., deep navy slate `oklch(0.20 0.04 265)` or warm obsidian `oklch(0.18 0.02 50)`).
- **Perceptual Uniformity:** Use modern `oklch()` color spaces to guarantee consistent perceived lightness across hues.
- **Subtle Surface Tints:** Modals, cards, and floating panels should take a 2–5% tint of the primary background instead of pure clinical `#ffffff`.
- **Eased Gradients:** Never use two-stop linear gradients that create sharp color collision bands. Use progressive alpha stops or cubic easing.

### `/impeccable spatial`

Establish rhythmic, dependable spatial harmony:

- **4px / 8px Spatial Grid:** All margins, paddings, gaps, and border-radii must be multiples of 4 (4, 8, 12, 16, 20, 24, 32, 48, 64px).
- **Proportional Nesting Radius:** Outer radius = Inner radius + Padding ($R_{outer} = R_{inner} + P$). Never have concentric nested boxes with the exact same corner radius.
- **Layered Ambient Shadows:** Avoid single harsh shadows (`box-shadow: 0 4px 6px rgba(0,0,0,0.3)`). Use multi-layered ambient occlusion + subtle key light + 1px hairline border (`border-white/10` or `border-black/5`).

---

## 2. Mechanical Anti-Pattern Checklist (Never Ship These)

| Anti-Pattern                   | Why It Breaks the Experience                                                | The Impeccable Fix                                                                                   |
| :----------------------------- | :-------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------- |
| **The Indigo SaaS Gradient**   | AI cliché #1: `from-indigo-500 to-purple-600`. Feels like a cheap template. | Curate domain-specific color palettes (e.g., pastel sky blue + fresh lily white + warm blush).       |
| **Dead Buttons**               | Buttons with no pressed state feel broken or unresponsive on touch.         | Add active depression: `active:scale-[0.97]` or `active:translate-y-[1px]`.                          |
| **Raw Border Lines**           | 1px solid gray borders (`#e5e7eb`) looking harsh and cut-out.               | Use semi-transparent borders: `border border-foreground/10` or `border-white/20` with backdrop blur. |
| **Jarring Full-Page Spinners** | Flash of empty white screen with a generic spinner destroys app immersion.  | Optimistic UI, skeleton shimmer, or instant cached shell with gentle progressive reveal.             |
| **Unconstrained Modal Widths** | Dialogs stretching across desktop monitors.                                 | Constrain dialogs to `max-w-md` or `max-w-lg` with centered focal positioning.                       |
| **Lack of Safe-Area Padding**  | Buttons touching the iPhone home indicator or notch.                        | Enforce `env(safe-area-inset-bottom)` and `env(safe-area-inset-top)` on sticky/fixed elements.       |
| **Squished Icons**             | Icons squashed into ovals inside flex containers.                           | Always attach `shrink-0` to icons and avatars.                                                       |
