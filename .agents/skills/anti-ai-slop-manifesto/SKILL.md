---
name: anti-ai-slop-manifesto
description: Strict anti-AI-slop heuristics and design enforcement. Banishes emoji decoration, gratuitous icons, card-in-card nesting, low-contrast pastel gradients, and generic AI templates in favor of authentic, human-crafted software design.
---

# The Anti-AI-Slop Design Manifesto

## What is "AI-Slop" in UI Design?
AI-generated code and design templates suffer from recognizable, low-effort visual hallmarks:
1. **The Emoji Infestation:** Slapping ✈️, 🎉, 💖, 📷, ☀️, 💍, 🌸, 💌 on every headline, pill, button, and card badge because the LLM lacks confidence in its typography.
2. **Icon Fatigue:** Placing an icon next to every single word (`<Calendar /> Calendar`, `<MapPin /> Location`, `<Clock /> Time`, `<Heart /> Love`). When every button has an icon, no icon has meaning.
3. **Card-in-Card Russian Dolls:** Nesting 3 to 4 layers of rounded rectangles inside each other, creating visual claustrophobia.
4. **Weak Micro-Contrast:** Pale gray text on pale pastel backgrounds, unreadable at glance and failing accessibility.
5. **Generic Pastel Gradients:** Blurry pink-to-purple or sky-to-pink gradient backgrounds that scream "2023 AI demo wrapper".
6. **Vague, Generic Copy:** Placeholders like "My heart", "Special moments", "Connected across distance" that lack real personal grounding.

---

## The Non-Negotiable Anti-AI Rules:

### Rule 1: Zero Raw Emojis in Functional UI Chrome
- **Rule:** Never use raw Unicode emojis (`✈️`, `🎉`, `✨`, `❤️`, `📸`, etc.) inside headings, button labels, badge chips, navigation bars, or system status displays.
- **Replacement:** Use clean typography, refined geometric accents, subtle SVG vectors, or editorial punctuation (e.g. `—`, `•`, `/`). Emojis are permitted ONLY if user-typed in a personal message or user note.

### Rule 2: Radical Icon Restraint
- **Rule:** If a text label is clear (e.g. "Add Memory", "Take Photos", "Settings"), **do not** add a redundant icon unless it acts as an essential functional affordance (e.g. a camera shutter trigger, an audio play/pause toggle, an arrow or close button).
- Maximum 1 purposeful icon per primary action. Secondary action chips should rely on pure typography.

### Rule 3: Ban Card Nesting (Flat Architectural Layers)
- **Rule:** Do not place a rounded card inside another rounded card inside a container card.
- **Replacement:** Use hairline rules (`border-b border-foreground/5`), clean tabular layouts, or single cohesive surface planes with whitespace grouping.

### Rule 4: High-Contrast Typographic Anchors
- **Rule:** Every screen must have a clear visual hierarchy. The primary metric or headline must command attention (`font-serif`, `text-3xl` to `text-5xl`, `tracking-tight`), supported by crisp, legible neutral body text (`text-foreground/75`).
- Never use low-contrast gray text (`#9ca3af` on `#f3f4f6`) for crucial info.

### Rule 5: Authentic Personal Specificity
- **Rule:** Real long-distance couples have real cities, real kilometers, real timezones, and real countdowns.
- Always display the accurate city names (e.g. `Bacolod` and `Manila`), exact calculated distance (`485 km`), dual synchronous clocks with timezone indicators, and precise anniversary milestones rather than generic filler text.
