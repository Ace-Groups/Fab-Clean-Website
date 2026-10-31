# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are households and professionals in Pollachi / Kinathukadavu / Udumalaipettai who want doorstep laundry and dry cleaning without managing garment details online. They book a pickup, hand garments to the agent, and later track status on the phone.

Secondary users: returning customers checking order status and a light profile after phone OTP login.

## Product Purpose

Fab Clean’s customer website lets people schedule a free pickup, sign in with phone OTP, and track orders in a simple portal. Success means booking feels effortless (minutes, not a form farm), login is trustworthy without passwords, and status is clear without ERP complexity.

## Positioning

Doorstep garment care with agent-collected details at pickup and confirmation before service — customers do not pre-select packages or itemize garments on the marketing site. Free pickup within the supported radius; clear phone OTP access to track and portal.

## Operating Context

- Marketing site + customer portal (Vite/React) talking to Express API and ERP-backed orders.
- Physical flow: schedule pickup → agent collects garments and confirms details → clean → ready / out for delivery → delivered.
- Branches: Pollachi, Kinathukadavu, Udumalaipettai (Yadvik Traders / Fab Clean).
- Hours: Mon–Sat, 10:00 AM–8:00 PM.

## Capabilities and Constraints

- Primary CTA everywhere: one Book / Schedule Pickup action.
- Booking collects only what is needed to schedule pickup: name, phone, address, preferred date/slot (and branch when required). No forced service/package/garment selection on the marketing booking flow. Copy must state that the agent collects garment/service details at pickup and confirmation happens before service.
- Track Order requires login.
- Login = phone number + MSG91 OTP widget (not password). Widget IDs and verification go through configured env / server patterns; AuthKey stays server-only.
- After login: Track Order + simple customer portal (orders, status, profile-lite) — surface only what customers need.
- Preserve real brand assets (name Fab Clean, logo at `public/logo.webp`, phones, emails, legal name).
- Do not invent testimonials, prices, or capabilities the product does not have.
- Stack is the existing Vite + React + Tailwind + Express monorepo (not greenfield).

## Brand Commitments

- Name: Fab Clean (legal: Yadvik Traders).
- Logo: `/public/logo.webp` — animate thoughtfully for presence, not noise.
- Contact: phones `93630 59595` / `93637 19595`, emails `info@myfabclean.in` / `myfabclean@gmail.com`.
- Voice: calm, human-friendly, trustworthy — a web app feel, not a cluttered marketing form farm.
- Binding UX brief: brand-first hero, full-bleed laundry/cleaning imagery, no card clutter in hero, one job per section, expressive typography (not Inter/Roboto/system defaults), intentional motion (2–3+), avoid purple/AI-slop and cream-serif-terracotta defaults; mobile-first, accessible, fast.

## Evidence on Hand

- Logo: `Frontend/public/logo.webp`
- Existing site copy and branch/store APIs; pricing and reviews from live APIs when available.
- ERP/app status language available for simplification (do not dump ERP fields).
- Absence: do not fabricate customer testimonials or unverified claims.

## Product Principles

1. One clear action to book pickup; defer garment complexity to the agent at the door.
2. Trust through clarity: say what happens next, confirm before service.
3. Login and track should feel like a calm app, not a marketing afterthought.
4. Show only what a customer needs to know about an order.
5. Preserve real Fab Clean identity assets while replacing the old visual world.

## Accessibility & Inclusion

Mobile-first; keyboard-accessible controls; readable contrast; form errors name the problem and recovery. OTP and booking flows must work on small screens without horizontal scroll.
