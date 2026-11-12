---
name: apple-design-hig
description: >-
  Apple Human Interface Guidelines (HIG) for web and mobile applications.
  Enforces Apple design standards: SF Pro typography, iOS touch targets (44pt+),
  translucency/vibrancy, spring physics, navigation hierarchies, modal sheets,
  and native iOS feel.
---

# Apple Human Interface Guidelines (HIG) Skill

A rigorous design and engineering standard grounded in Apple's **Human Interface Guidelines (HIG)** for modern web and progressive web apps (PWAs).

## 1. Core Principles: Clarity, Deference, Depth

1. **Clarity:**
   - Text is legible at every size; icons are precise and lucent; adornments are subtle and appropriate.
   - Negative space, color, fonts, graphics, and interface elements subtly highlight important content and convey interactive status.
2. **Deference:**
   - Fluid motion and a crisp, beautiful interface help people understand and interact with content without competing with it.
   - Content typically fills the entire screen, while translucency and blur hint at more content beneath.
3. **Depth:**
   - Distinct visual layers and realistic motion heighten hierarchy, vitality, and spatial understanding.
   - Touch and physical metaphors ground digital interactions in natural intuition.

---

## 2. Apple Typography Standard (SF Pro & Dynamic Scale)

Apple interfaces utilize a clear proportional type scale designed for rapid scanning and readability:

| Style           | Weight         | Size (CSS)       | Line Height | Tracking   | Purpose                                               |
| :-------------- | :------------- | :--------------- | :---------- | :--------- | :---------------------------------------------------- |
| **Large Title** | Bold / 700     | 34px (2.125rem)  | 41px        | `-0.022em` | Prominent header on page landing / collapse on scroll |
| **Title 1**     | Bold / 700     | 28px (1.75rem)   | 34px        | `-0.019em` | Major section headers                                 |
| **Title 2**     | Bold / 600     | 22px (1.375rem)  | 28px        | `-0.015em` | Subsection anchors                                    |
| **Title 3**     | SemiBold / 600 | 20px (1.25rem)   | 25px        | `-0.012em` | Card group titles                                     |
| **Headline**    | SemiBold / 600 | 17px (1.0625rem) | 22px        | `-0.01em`  | Primary interactive elements, table row labels        |
| **Body**        | Regular / 400  | 17px (1.0625rem) | 22px        | `-0.01em`  | Core readable content                                 |
| **Callout**     | Regular / 400  | 16px (1rem)      | 21px        | `-0.005em` | Highlights and callout summaries                      |
| **Subhead**     | Regular / 400  | 15px (0.9375rem) | 20px        | `0em`      | Secondary metadata                                    |
| **Footnote**    | Regular / 400  | 13px (0.8125rem) | 18px        | `0em`      | Timestamps, hints, badges                             |
| **Caption 1**   | Regular / 400  | 12px (0.75rem)   | 16px        | `0em`      | Fine print, tertiary captions                         |
| **Caption 2**   | Regular / 400  | 11px (0.6875rem) | 13px        | `0.005em`  | Icon subtext, tab labels                              |

---

## 3. Apple Touch Targets & Spatial Ergonomics

- **Minimum Hit Target:** 44 × 44 pt (`min-h-[44px] min-w-[44px]`). Even small 16px icons must have a padded hit target of at least 44px to prevent miss-taps.
- **Thumb Zone Design:** Primary interactive triggers (navigation bars, main action buttons, sheet grabbers) must reside in the bottom 40% of the viewport.
- **Safe Area Insets:**
  ```css
  padding-top: max(env(safe-area-inset-top), 1rem);
  padding-bottom: max(env(safe-area-inset-bottom), 1rem);
  padding-left: max(env(safe-area-inset-left), 1rem);
  padding-right: max(env(safe-area-inset-right), 1rem);
  ```
- **Haptic Simulation:** On touch devices, provide tactile feedback (Web Vibration API `navigator.vibrate?.([8])` on tap, `[15, 50, 15]` on success).

---

## 4. Vibrancy, Translucency & Glassmorphism

Apple's signature depth comes from materials that sample the content behind them:

- **Ultra-Thin Material:** `background: rgba(255, 255, 255, 0.45); backdrop-filter: blur(20px) saturate(180%);`
- **Dark Mode Vibrancy:** `background: rgba(30, 30, 35, 0.65); backdrop-filter: blur(25px) saturate(190%);`
- **Hairline Borders:** `border: 0.5px solid rgba(255, 255, 255, 0.25)` or `box-shadow: inset 0 0 0 0.5px rgba(255,255,255,0.2)`.

---

## 5. Apple Spring Physics & Modal Sheets

- **Spring Transitions:** Avoid linear or mechanical ease-in-out. Use Apple spring curves:
  - Spring Bounce: `transition: { type: "spring", stiffness: 350, damping: 28, mass: 0.8 }`
  - Quick Response: `transition: { type: "spring", stiffness: 450, damping: 35 }`
- **iOS Bottom Sheets:**
  - Pull-to-dismiss handle pill: `w-9 h-1 bg-muted-foreground/30 rounded-full mx-auto my-2`.
  - Drag velocity dismissal: If dragged down faster than 0.5px/ms or more than 35% of sheet height, complete dismissal.
  - Background scale-down: When a sheet expands, the parent view subtly scales down (`scale(0.96)`, `rounded-2xl`).
