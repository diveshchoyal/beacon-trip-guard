# Beacon Safety First

Create a new project with Supabase enabled.

MASTER LOVABLE PROMPT — BEACON Frontend (Glassmorphism)

==========================================================

Paste this as ONE message in your new Lovable project. Connect

Supabase to this project first (native "Connect Supabase" button,

select the existing BEACON project) before sending this prompt.

PROMPT TO PASTE:

-----------------

Build "BEACON" — a smart tourist safety app — as a mobile-first,

fully responsive web app. Connect to my existing Supabase project

(tables already exist: profiles, digital_ids, id_ledger,

geofence_zones, location_pings, alerts, efir_records — use these

exact tables, do not invent new ones). Use Supabase Auth, Database,

and Realtime.

DESIGN SYSTEM — Glassmorphism, light + dark theme toggle

- Core style: frosted-glass cards — translucent backgrounds

  (rgba white or black at 10-20% opacity), backdrop blur (16-24px),

  thin 1px semi-transparent border with a subtle light glow on the

  top edge, soft drop shadow, rounded corners (20px).

- Color palette:

  - Light theme: background is a soft cream white (#F7F3EC) with a

    very subtle warm gradient behind the glass cards. Accent colors:

    dusty blush pink (#E8B4B8) and warm sandal tan (#C9A574).

    Text: deep espresso brown (#2B2118) for high contrast.

  - Dark theme: background is deep espresso black (#1C1410) with the

    same blush pink (#E8B4B8) and sandal tan (#C9A574) accents

    glowing softly against the dark glass. Text: cream white

    (#F7F3EC).

  - A theme toggle (sun/moon icon) accessible from the top bar on

    every screen, persisted across sessions.

- Typography: Poppins or Inter, clear hierarchy, generous spacing,

  never cramped. High contrast text against glass at all times —

  never let text sit directly on a busy background without a glass

  panel behind it.

- Motion: use Framer Motion for smooth screen transitions (fade +

  slight slide), a satisfying press/ripple animation on all primary

  buttons, and a pulsing glow animation specifically on the SOS

  button so it feels alive, not static.

- This should feel premium, calm, and trustworthy — like a modern

  fintech or travel app, not like a government form. Avoid harsh

  pure-black text on pure-white, avoid neon oversaturation, avoid

  clutter. Generous whitespace and breathing room between elements.

LOGO

- Use the uploaded BEACON logo (lighthouse + shield + hiker) as the

  app icon and on the login/signup screens, but recolor it to match

  this app's palette — swap the bronze/copper tones for the sandal

  tan (#C9A574) and blush pink (#E8B4B8) accents, keep it on a clean

  glass panel rather than pure black.

NAVIGATION

- Mobile: a hamburger menu (top-left) opening a slide-in glass panel

  with links to all tourist screens, plus a bottom tab bar for the

  4 most-used sections: Home, Map, Digital ID, Alerts.

- Desktop (used for the police/admin dashboard role): a persistent

  glass sidebar instead of hamburger + tabs, same link set plus

  Tourist Registry and E-FIR Log.

- Every screen has a clear title in the top bar next to the theme

  toggle.

AUTH SCREENS (make these visually distinct and premium, this is the

first impression)

- Landing/welcome screen: BEACON logo centered on a glass card,

  tagline "Safe Travel. Smart Response.", two buttons — "Log In" and

  "Sign Up" — with a soft blurred travel-themed background (subtle,

  not distracting).

- Login: glass card with email + password fields, "Log In" button,

  link to Sign Up.

- Sign Up: glass card with role selection (Tourist / Police-Admin as

  a segmented toggle, not a plain dropdown), full name, email,

  password. On submit, pass full_name and role as user metadata to

  Supabase Auth signUp so the existing database trigger can create

  the matching profile row correctly.

- After login: tourists route to /app (mobile nav layout), police/

  admin route to /dashboard (sidebar layout).

TOURIST SCREENS (/app)

1. Home — safety score badge in a glass card, current zone status

   color-coded (green/yellow/red) using the palette's tone logic

   (soft success green, warm amber, soft alert red — no harsh neon),

   large circular pulsing SOS button as the visual centerpiece,

   quick-access glass cards linking to Map and Digital ID.

2. Map — a real, working, minimal map (use Leaflet via react-leaflet,

   OpenStreetMap tiles, free, no API key needed) showing geofence

   zones as colored translucent polygon overlays matching the risk

   palette, and the tourist's current location as a pulsing pin.

   Keep the map itself clean and uncluttered — glass control panel

   overlaid in a corner for zone legend, not covering the map.

3. Digital ID — registration form (id number, destination, trip

   dates, emergency contact) in glass card style. On submit, call

   the Supabase Edge Function "generate-digital-id" (POST, Bearer

   token from the current session, JSON body of the form fields).

   On success, show an ID card view: glass card styled like a

   passport/boarding pass, tourist name, trip details, QR code

   generated from the returned qr_payload, and a "Verify Integrity"

   button that calls the Edge Function "verify-digital-id" (POST,

   JSON body { digital_id }) and shows a clear green/red result

   state.

4. Alerts — list of the tourist's own alerts in glass cards, status

   badges (open/acknowledged/resolved), most recent first.

5. Profile — name, phone, theme toggle, logout, all in glass cards.

POLICE/ADMIN DASHBOARD (/dashboard)

1. Live Map — same Leaflet map, showing all tourist location pins

   and geofence zones, active alerts highlighted with a pulsing red

   marker.

2. Alerts — real-time list (Supabase Realtime subscription) of

   incoming alerts, newest first, each row in a glass card with

   tourist name, type, location, timestamp, and Acknowledge /

   Resolve / File E-FIR actions.

3. Tourist Registry — searchable table of registered tourists and

   Digital ID status.

4. E-FIR Log — list of filed E-FIR records.

TECHNICAL NOTES

- All screens must be functionally wired to real Supabase data, not

  placeholder mock content — every form submits real data, every

  list reads real rows.

- Keep the SOS button's tap action writing a real row to the alerts

  table with the tourist's current location and a timestamp.

- Fully responsive: correct on narrow mobile widths first, scaling

  up cleanly to desktop for the dashboard role.

Build this as a complete first pass across all screens listed above

in this single response — I have a limited credit budget and need

this working end-to-end rather than partially built.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/fc5b43cb-ce16-4a35-b1b9-7e03096f8426).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
