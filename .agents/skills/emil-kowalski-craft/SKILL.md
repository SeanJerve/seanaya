---
name: emil-kowalski-craft
description: >-
  Emil Kowalski's design engineering craft, animations.dev principles, and micro-interactions.
  Enforces fluid 60fps spring animations, shared layout transitions (layoutId), gesture-driven
  drag-to-dismiss, interactive physics, and anti-jank GPU rendering standards.
---

# Emil Kowalski Design Engineering & Motion Craft

Adapted directly from **Emil Kowalski**'s (`animations.dev`, Sonner, craft) design engineering methodology.

## 1. The Core Philosophy of Motion

1. **Motion is not decoration; it is spatial continuity.**
   When an element changes state or position, motion explains to the human brain where it came from and where it went. Without motion, state changes feel like abrupt visual glitches.
2. **Never animate layout geometry directly.**
   Animating CSS `width`, `height`, `top`, `left`, `margin`, or `padding` forces the browser to recalculate layout and repaint pixels on every frame (causing frame drops and battery drain).
   **Rule:** Only animate `transform` (`scale`, `translate`, `rotate`) and `opacity`. Use Framer Motion's `layout` and `layoutId` which internally calculate FLIP (First, Last, Invert, Play) transformations using GPU matrices.
3. **Animations must never get in the way of user intent.**
   If a user taps an action three times fast, never make them wait for an animation to complete before accepting input. Cancel, interrupt, or spring to the latest target immediately.

---

## 2. Spring Physics Parameter Cheatsheet

Ditch rigid CSS `transition: 0.3s ease`. Physical springs model real-world momentum:

```typescript
// 1. Responsive & Snappy (Buttons, Toggles, Micro-clicks)
export const snappySpring = {
  type: "spring",
  stiffness: 500,
  damping: 35,
  mass: 0.8,
};

// 2. Gentle & Organic (Modals, Sheets, Expanding Cards)
export const organicSpring = {
  type: "spring",
  stiffness: 300,
  damping: 30,
  mass: 1.0,
};

// 3. Playful & Bouncy (Hugs, Reactions, Stickers, Easter Eggs)
export const bouncySpring = {
  type: "spring",
  stiffness: 400,
  damping: 18,
  mass: 0.9,
};

// 4. Heavy & Stable (Large viewport takeovers, Photo Booth shutters)
export const cinematicSpring = {
  type: "spring",
  stiffness: 220,
  damping: 24,
  mass: 1.2,
};
```

---

## 3. Shared Element Transitions (`layoutId`)

When expanding a card into a full modal, or morphing a thumbnail into a photo booth strip:

- Wrap both elements with `<motion.div layoutId="unique-id">`.
- Ensure border-radius and inner padding are explicitly controlled to prevent distorting text aspect ratios during morphing.
- Use `layout="position"` when animating list re-ordering to prevent text stretching.

---

## 4. Tactile Micro-Interactions

- **Button Press (The Kowalski "Squish"):**
  ```tsx
  <motion.button
    whileTap={{ scale: 0.96 }}
    whileHover={{ scale: 1.02 }}
    transition={{ type: "spring", stiffness: 400, damping: 25 }}
  >
    {children}
  </motion.button>
  ```
- **Swipe-to-Dismiss / Pull-Down Sheet:**
  Use `drag="y"` with `dragConstraints={{ top: 0 }}` and `dragElastic={0.2}`. If drag distance exceeds threshold or velocity exceeds flick speed, trigger exit.
- **Tab Underline / Active Pill Morphing:**
  Use a single `<motion.div layoutId="active-pill" className="absolute inset-0 bg-primary/10 rounded-full" />` inside the active tab. It glides seamlessly across tabs when selected.
