---
name: Ilham
description: A studio's light table for references — the work glows, the table recedes.
colors:
  table-black: "#0b0b0c"
  table-surface: "#121214"
  raised-sheet: "#1a1a1d"
  hover-sheet: "#222226"
  hairline: "rgb(255 255 255 / 0.07)"
  hairline-strong: "rgb(255 255 255 / 0.13)"
  ink: "#f4f4f5"
  ink-muted: "#a1a1aa"
  ink-faint: "#85858e"
  signal-lime: "#c6ff3d"
  alarm-coral: "#ff5c5f"
typography:
  display:
    fontFamily: "IBM Plex Sans Arabic, Geist, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "IBM Plex Sans Arabic, Geist, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontFamily: "Geist, IBM Plex Sans Arabic, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.4
  body:
    fontFamily: "Geist, IBM Plex Sans Arabic, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  caption:
    fontFamily: "Geist, IBM Plex Sans Arabic, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: "Geist, IBM Plex Sans Arabic, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
  micro:
    fontFamily: "Geist, IBM Plex Sans Arabic, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.3
  wordmark:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.01em"
rounded:
  card: "10px"
  field: "12px"
  dialog: "16px"
  sheet: "24px"
  pill: "9999px"
spacing:
  gutter-phone: "16px"
  gutter-desktop: "40px"
  grid-gap-phone: "12px"
  grid-gap-desktop: "20px"
  row-gap-phone: "24px"
  row-gap-desktop: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.table-black}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.raised-sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "40px"
  button-ghost:
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "40px"
  chip:
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "32px"
  chip-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.table-black}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "32px"
  input:
    backgroundColor: "{colors.table-black}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "0 14px"
    height: "44px"
  reference-card:
    backgroundColor: "{colors.raised-sheet}"
    rounded: "{rounded.card}"
  menu:
    backgroundColor: "{colors.raised-sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "4px"
---

# Design System: Ilham

## Overview

**Creative North Star: "The Light Table"**

Ilham is the table a studio lays its references on. The table is dark and quiet; the references are the only light. Every surface decision serves that contrast: neutral sheets and hairlines instead of decoration, so that a Dribbble shot, a Vimeo still or a Behance spread is the brightest, most colorful thing in view. The tools sit at the edges of the table (the sidebar, menus that appear on demand, a bottom bar on phones) and stay precise and calm, the way a good loupe or a pencil does.

The table is for working, not browsing: projects are boards a team builds over time, capture costs one gesture, and the grid is dense enough to compare references side by side. It is Arabic and right-to-left, while most references are titled in English; both directions sit naturally on one table. Motion is part of the material: references that move come alive under the cursor or in the middle of a phone screen, one at a time, and settle back to stills.

**Key Characteristics:**
- Dark tonal sheets with white hairlines; color comes only from the work.
- A 4:3 reference grid (2 → 3 → 4 → 5 columns), each preview on its own dominant color.
- One signal color, Signal Lime, reserved for anything an agent touched.
- RTL Arabic interface with English titles that keep their own direction.
- Living previews for motion references: muted, single, revealed only when actually playing.
- Phones get 44px touch targets and bottom sheets; desktops get hover and keyboard paste.

## Colors

A near-black neutral table with three stepped sheets, three ink levels, and one reserved signal.

### Primary
- **Signal Lime** (`signal-lime`): the agent's mark. The ✦ badge on agent-added references, agent status and the Inbox. It means "an agent did this" and nothing else.

### Neutral
- **Table Black** (`table-black`): the page itself and input wells. Everything else is laid on it.
- **Table Surface** (`table-surface`): dialogs and bottom sheets, one step off the table.
- **Raised Sheet** (`raised-sheet`): reference cards before their preview loads, menus, selected sidebar rows, secondary buttons.
- **Hover Sheet** (`hover-sheet`): the hover and highlighted state of raised items, and avatar wells.
- **Hairline** (`hairline`) / **Hairline Strong** (`hairline-strong`): dividers, the sidebar edge, field and chip borders. The only lines on the table.
- **Ink** (`ink`): titles, primary text, and the fill of primary buttons and active chips.
- **Ink Muted** (`ink-muted`): secondary text, idle navigation, icons.
- **Ink Faint** (`ink-faint`): counts, bylines, hints and placeholders. Still ≥4.5:1 on table, surface and raised sheets.
- **Alarm Coral** (`alarm-coral`): destructive actions and error text only.

### Named Rules
**The Only Light Rule.** The references are the only saturated color on screen. UI chrome stays in the neutrals; a platform's brand color appears only as a 6px dot beside a caption and as the tint of its fallback tile.

**The Signal Rule.** Signal Lime marks agent work and is never decoration: not text selection, not the user's own toasts, not loading states.

## Typography

**Display Font:** IBM Plex Sans Arabic (with Geist)
**Body Font:** Geist (with IBM Plex Sans Arabic)

**Character:** One humanist Arabic voice for the interface's own words, one crisp Latin sans for the references' titles and numbers. Each script renders in its own face from the same stack, so mixed lines read as one hand.

### Hierarchy
- **Display** (600, 40px desktop / 30px phone, 1.1): page titles: "المشاريع" and project names.
- **Headline** (600, 18–20px, 1.3): dialog titles, empty-state headings, the `/add` question.
- **Title** (500, 15px, 1.4): project names on cover cards, fallback-tile titles, field text.
- **Body** (400, 14px, 1.6): descriptions, dialog copy, empty-state explanations (max ~40ch in empty states).
- **Caption** (500, 13px, 1.4): reference captions under cards, chip text, field labels.
- **Label** (500, 12px, 1.4): counts, bylines, nav labels, hints.
- **Micro** (400, 11px, 1.3): the host under a pending preview, keyboard hints. Never for sentences.
- **Wordmark** (600, 17px, Geist): the "✦ Ilham" mark only.

### Named Rules
**The Mirror Rule.** The interface is right-to-left. English strings get `dir="auto"` so they keep their own reading order, and they align with the UI: to the right edge, next to their marker, never floating left.

## Layout

Two-pane on desktop: a 256px sidebar at the start edge (right) holding Add, navigation and the project list, and a fluid board. Phones drop the sidebar for a bottom bar with a central Add button in the thumb zone.

The reference grid is the core: 2 columns on phones, 3 from 768px, 4 from 1280px, 5 from 1536px. Gutters are 16px on phones and 40px on desktop; column gaps 12px → 20px, row gaps 24px → 32px, so each caption stays attached to its own card. Project covers use the same 4:3 frame in a 2 → 3 → 4 column grid. Headers align titles at the start edge and actions at the end edge, bottom-aligned to the title.

Filters appear only when a board has at least 6 references from 2 or more platforms. On phones the chip row scrolls horizontally and fades at its end edge to show there is more.

### Named Rules
**The 44 Rule.** On phones every control is at least 44px to touch, even when its visual is smaller (32px chips, 28px card menus extend their hit area invisibly).

## Elevation & Depth

Flat by default, layered by tone. The table, surface, raised and hover sheets carry hierarchy through lightness steps and hairlines, not shadows. Shadows appear only on things that float above the table (dialogs, bottom sheets, menus, toasts) as a soft black ambient shadow (`shadow-2xl` / `shadow-xl` at black 50–60%). Over images, small controls use a translucent black pill with a light backdrop blur, purely for legibility on unknown artwork.

### Named Rules
**The Hairline Rule.** Cards have no border and no shadow. A reference's own image, sitting on its dominant color, is the card's edge.

## Shapes

Gently rounded and consistent: references and covers at 10px, fields and menus at 12px, dialogs at 16px, bottom sheets at 24px on their top corners, and every button and chip a full pill. Icons are Lucide at 16px (20px in the bottom bar), 2px stroke. The brand mark is a four-point spark with curved sides; in ink it is the brand, in Signal Lime it means an agent.

## Components

### Buttons
- **Shape:** full pill (`rounded.pill`).
- **Primary:** ink fill with table-black text, 40px tall (48px for hero actions). One per view: the sidebar's "أضف مرجع" on desktop, the bottom-bar "+" on phones.
- **Secondary:** raised sheet with a strong hairline. Header actions such as "أضف مرجع" on a board and "مشروع جديد".
- **Ghost:** muted ink, raised-sheet background on hover.
- **Danger:** coral text on a 12% coral wash, inside confirmations only.
- **Press:** every button scales to 0.97 on press (150ms).

### Chips
- **Style:** 32px pill, strong hairline, muted ink, with the platform's 6px dot and a count.
- **State:** active is an ink fill with table-black text and `aria-pressed`. One group, single-select, "الكل" first.

### Reference Cards
- **Corner Style:** 10px.
- **Background:** the preview's dominant color under a blurred LQIP, and the WebP fading in on top. Very wide OG images (wider than 1.85:1) are contained on the dominant color instead of cropped.
- **Shadow Strategy:** none (see the Hairline Rule).
- **States:** pending shows a shimmer with a thin scanning bar and the host name. Failed shows a fallback tile tinted with the platform color, its label and title, and an "أضف بريفيو" action. Ready shows the work.
- **Hover (desktop):** the image scales to 1.02 (300ms) and a single pill appears: "افتح في {platform or host} ↗". The caption below already carries title and byline, so the overlay never repeats them.
- **Caption:** platform dot, title, byline at the end edge.
- **Menu:** a quiet 28px dot inside a 44px hit area at the top end corner; on desktop it appears on hover or focus.

### Living Preview (signature)
Motion references come alive: after a 280ms hover dwell on desktop, or when the card crosses the middle band of a phone screen. A stored muted loop (`loop.mp4`) plays if we have one; otherwise the official muted, chrome-less YouTube or Vimeo embed. It fades in (300ms) only after the player reports playback, plays one at a time, and is skipped entirely for reduced motion or Data Saver.

### Inputs / Fields
- **Style:** 44px tall, table-black well, strong hairline, 12px radius, 15px text.
- **Focus:** the border brightens to ink (no extra outline ring).
- **Selects:** carry a chevron at the end edge.

### Navigation
- **Desktop sidebar:** wordmark, primary Add with a paste hint ("أو الصق رابط في أي مكان" with ⌘V or Ctrl V), "المشاريع", then the project list with a 28px cover thumbnail, name and count. The active row is a raised sheet.
- **Phone bottom bar:** blurred table-black bar with a hairline top, Projects / Add / Account, labels 12px in muted ink, hidden on the focused `/add` flow.

### Dialogs
A bottom sheet on phones (24px top corners, safe-area padding) and a centered 448px card on desktop. Each has a headline, an optional one-line description and a close button at the end edge.

## Do's and Don'ts

### Do:
- **Do** let the reference be the brightest thing in view: neutral chrome, dominant-color backings, and no grey placeholder boxes ever.
- **Do** keep text at ≥4.5:1: use `ink-faint` (#85858e) as the floor for small text, and never anything dimmer.
- **Do** give every phone control a 44px hit area, and put the primary action in the thumb zone.
- **Do** keep English titles in their own direction (`dir="auto"`) and align them with the RTL UI.
- **Do** use the strong ease-out curve (`cubic-bezier(0.22, 1, 0.36, 1)`), keep UI motion under 300ms, and stagger lists by 30ms.
- **Do** honor reduced motion fully: no loops, no autoplaying previews, no movement.
- **Do** name a reference's destination honestly in the hover pill (a platform name, or the host for any other site).

### Don't:
- **Don't** use Signal Lime or the lime ✦ for anything an agent didn't do.
- **Don't** add borders, shadows or nested containers to reference cards.
- **Don't** repeat the caption's title inside the card's hover overlay, or show the overlay on a card without a preview.
- **Don't** crop text-heavy wide OG images; contain them on their dominant color.
- **Don't** reveal a motion embed before the player reports playback.
- **Don't** let two previews play at once.
