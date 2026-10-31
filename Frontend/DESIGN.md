# Design system

<!-- impeccable:design-schema 1 -->

## Direction

Quiet Linen Closet — cool mist sage and slate, crisp white cloth panels, seafoam accent. Marketing home persuades with full-bleed laundry atmosphere; booking and portal operate calmly. Seed `8ef30738`, assigned grounded index 5.

## Platform

web

## Color

| Token | Value | Role |
|---|---|---|
| background | `#E6ECE9` | Mist linen ground |
| panel | `#F4F8F6` | Cloth planes |
| ink | `#142028` | Primary text |
| muted-foreground | `#5A6B72` | Secondary text |
| line | `#C5D2CC` | Borders |
| primary | `#2F7A74` | Seafoam action / focus |
| deep | `#0F1A20` | Footer / closing band |
| ticket | `#8A7350` | Tiny status marks only |

Strategy: Restrained neutrals tinted from mist linen + one seafoam accent. Light scene: daytime home booking on a phone.

## Typography

- Display: **Bricolage Grotesque** — brand and section titles
- Body / UI: **Figtree** — forms, nav, supporting copy
- Tracking on display ≈ `-0.03em`; body measure ~65ch

## Layout

- Full-bleed hero first viewport; brand wordmark at hero scale with animated logo
- One job per section; cloth panels instead of card grids in heroes
- Booking as two sliding planes: Contact → When
- Containers: `container-wide` 1240 / `container-tight` 720

## Motion

1. Logo cloth-gather breathe (scale + soft teal shadow, ~5.6s loop, reduced-motion safe)
2. Hero copy rise on load
3. Booking step plane slide (x-axis, Rietveld raise)

## Components

- Primary CTA: seafoam filled pill — “Schedule pickup”
- Inputs: soft rounded rectangles on panel ground
- Ticket marks: tiny uppercase brass-tint labels (not page kickers)
- Status: received → cleaning → ready → out → delivered

## Imagery

- `/public/images/atmosphere/linen-fold.jpg` — hero (Unsplash sourced)
- `/public/images/atmosphere/hanging-shirts.jpg` — care section
- Brand logo: `/public/logo.webp` (preserve)

## Do not

- Cream + gold + Playfair/Inter luxury template
- Purple / neon / glow defaults
- Service/package pickers in booking
- Card clutter or floating badges in the hero
