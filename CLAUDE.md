# CLAUDE.md — EnergyIQ for Imdaad (Kuroshio AI)

## What this project is
A **clickable demo web app** that Kuroshio AI will show to **Imdaad** (www.imdaad.ae), a Dubai-based integrated facilities management (FM) company.
It demonstrates Kuroshio's **EnergyIQ** platform packaged for an FM provider: **SMDB monitoring through energy meters + Kuroshio IoT devices, and analytics on that data**, across many client sites.

This is a **sales demo, not a production system**:
- All data is **sample/mock data** generated in the browser. No backend, no database, no real sensors.
- Every screen must show a visible **"Sample data — for demonstration only"** label.
- Do not show specific savings percentages as promises. Use wording like "to be measured during pilot". Annual waste figures are "if the pattern continues" and indicative.
- Never claim Kuroshio already works with Imdaad or has done this for other FM companies.

## Rules for using the client's name (Imdaad is a real company)
- The app is **Kuroshio-branded** ("Kuroshio AI · EnergyIQ"), with only a small **"Prepared for Imdaad"** line. **No Imdaad logo, colours or look-alike branding.**
- All people, clients, sites and buildings are **fictional** (Gulfstone Real Estate, Palmyra Communities, Al Noor Retail Group, Wellspring Healthcare). Never use names of Imdaad's real customers or staff.
- Imdaad's own CAFM / helpdesk system is not part of the demo: work orders have a simulated **"Send to CAFM"** hand-over.

## Company
- **Kuroshio AI** — deep tech startup (India: Kuroshio AI Private Limited, STPI Trivandrum; UAE: Kuroshio AI Ltd, RAKEZ, Ras Al Khaimah).
- Website: www.kuroshioai.com · www.kuroshioai.ae · info@kuroshioai.com
- Hardware in the real system (shown on "How it works"): Selec energy meters (RS-485/Modbus) on each SMDB → Kuroshio IoT node (ESP32-S3) → SIM7080G cellular (LTE-M / NB-IoT) → EnergyIQ cloud. CT clamps on motors for asset health (predictive maintenance).

## Dubai context
- Sites are in Dubai → the utility is **DEWA**. Tariff (DEWA commercial slabs + fuel surcharge) and grid emission factor are **indicative** and labelled as such (`src/lib/tariff.ts`, `src/lib/co2.ts`).
- UAE weekend is Sat–Sun. Operating calendar has UAE public holidays, Ramadan (approximate dates), site shutdowns and events (e.g. Dubai Shopping Festival late opening for the mall).

## Portfolio structure
Imdaad (FM provider) → **clients** → **sites** → **buildings** → **SMDBs** (each with a Selec meter) → **IoT nodes** (one node reads up to 2 meters in the demo).
- 4 clients, 5 sites (office tower, logistics hub, residential towers, community mall, medical centre), 8 buildings, 24 SMDBs, 14 IoT nodes, 13 CT-monitored assets.
- Each site has a type and opening hours; these drive the load model and the waste analytics.
- The top-bar **site switcher** narrows every page to one site, or "All sites" the user may see.

## Modules
1. **Portfolio overview** — live KPIs (live load, alerts, waste found, cost, CO₂, nodes online), per-site status table, charts. All calculated live.
2. **SMDB live monitoring** — boards per site/building, live kW / V / A / PF / THD, status (Normal / Warning / Critical / Tripped / No data), alerts center (acknowledge, note, create work order), SMDB detail with gauges, 24 h trend and per-phase table.
3. **Energy analytics** — consumption vs expected, breakdown by load type, building benchmark (EUI, after-hours share), hourly heatmap, editable operating calendar, **waste detection** grouped into recurring patterns (closed-day use, after-hours use) with indicative AED and CSV export.
4. **Power quality** — PF, phase imbalance, voltage band, current THD per board, with recommendations (e.g. kVAr of capacitor bank needed).
5. **Asset health** — CT-clamp motor current signature → health score, diagnosis, recommended action, create work order, mark resolved.
6. **Billing & sub-metering** — estimated DEWA charges per site from the meters, recharge per tenant / cost centre, CSV + recharge statement PDF.
7. **Work orders** — raised from alerts, asset health and waste patterns; Open → In progress → Closed with history; simulated Send to CAFM; PDF.
8. **Device health** — IoT node status, signal, data completeness, last seen, firmware; admin can simulate comms loss / restart node.
9. **Monthly client report** — per client or per site; PDF (energy, cost, waste, CO₂, power quality, alerts, assets, work orders).
10. **Capacity & demand** — metered peak demand vs breaker rating per board, headroom, hours above the planning limit, load duration curve, "can this board take X kW?" checker (`src/lib/capacity.ts`).
11. **Budget & forecast** — month-to-date cost per site vs an editable monthly budget, month-end forecast from the load model, likely cause linked to waste patterns (`src/lib/budget.ts`; budgets stored per site).
12. **Supply reliability** — breaker trips and utility supply interruptions detected by the meters, availability per board and site, repeat-trip boards, event log; live demo trips appear too (`src/lib/reliability.ts`).
13. **Carbon emissions (Scope 2)** — t CO₂e per site, month and load type from metered kWh × the DEWA grid emission factor (indicative, set once in `src/lib/co2.ts`), location-based method, carbon intensity per m², avoidable emissions from open waste patterns, carbon report PDF (`src/lib/carbon.ts`, `src/pdf/carbonReport.ts`).
14. **How it works** — hardware chain, measured values, modules, pilot outline, about Kuroshio (no add-ons section).

## Role-based access (RBAC)
No real authentication: a **demo login screen** with one card per user, and a **Switch role** menu in the top bar. Current user is persisted in localStorage; "Reset demo data" logs out.

| Role | Demo user | Sites | Lands on |
|---|---|---|---|
| FM Operations Manager (Imdaad) | Khalid Al Suwaidi | All | Overview |
| Energy & MEP Engineer (Imdaad) | Anitha Menon | All | Energy analytics |
| Site Supervisor (Imdaad) | Omar Farouk (Gulfstone sites), Ravi Shankar (Mall + Residences) | Own sites | SMDB monitoring |
| Client (building owner) | Sarah Thompson (Gulfstone), Hamad Al Nuaimi (Al Noor mall) | Own client's sites | Overview |
| System Admin (Kuroshio) | Kuroshio Admin | All | Device health |

All names are fictional.

**Implementation rules**
- Roles and permissions live in one place: `src/auth/permissions.ts` (`can(user, 'energy.edit')`). Never compare role strings in components.
- Site scoping lives in `src/lib/scope.ts` (`allowedSiteIds`, `filterBySite`, `canSeeSite`). Detail pages check the user's sites; forbidden pages show "Access restricted for your role".
- Every action records **who did it** (name + role + timestamp) on alerts and work orders.

## Data & simulation
- **One load model** (`src/sim/loadModel.ts`) drives live readings, the 24 h trend and the 12-month history: site activity by hour (site type, opening hours, day type) × board base load × Dubai cooling season. A few boards have planted **waste patterns** for the analytics to find, and a few have power-quality issues.
- Live simulator (`src/sim/SimulatorProvider.tsx`) updates every 4 s, raises/resolves alerts, handles demo faults (trip, overload, low PF) and offline IoT nodes.
- Meter history (`src/data/energy.ts`) is generated from a seeded RNG (not stored); it always uses the original calendar, so editing the calendar only changes the analysis.
- Editable state (users, alerts, work orders, thresholds, calendar, reviewed waste patterns, asset resets) is in a React Context + reducer, persisted to localStorage (`src/store/`). Bump `STATE_VERSION` when its shape changes.

## Tech stack
- React + TypeScript (strict) + Vite, Tailwind CSS v4, shadcn/ui (Radix), Recharts, React Router (HashRouter), lucide-react. `@/` = `src/`.
- `jspdf` + `jspdf-autotable` for PDFs (loaded on demand).
- Shared types in `src/types/`. No `any`.
- Static site: deploys to Vercel / Netlify / GitHub Pages.

## Design
- Clean, professional, technical. Light theme. **Kuroshio blue theme** taken from the logo (#014CC3); no purple gradients.
- All colours are defined once in `src/index.css`: `navy-*` = deep blues (text, borders, sidebar), `teal-*` = the logo blue scale (buttons, links, highlights; the name is kept for compatibility). Change the theme there, not in components.
- UI built on **shadcn/ui** (components in `src/components/shadcn/`, added with `npx shadcn@latest add …`); the app's own wrappers in `src/components/ui/` (Card, Button, Badge, Modal, KpiCard, toasts) sit on top of them.
- Logo files: `public/kuroshio-logo.png` and `public/kuroshio-logo-white.png` (for dark backgrounds); used in the sidebar, login page, favicon and PDF cover.
- Status colours: green = normal/ok, amber = warning/watch, red = alert/tripped/critical, grey = no data.
- Readable on a projector (large KPI numbers, clear labels).

## Developer notes
- The developer (Ajas) is on **Windows, PowerShell 5.1**. Give PowerShell-compatible commands (no `&&` in PS 5.1 — use `;` or separate lines).
- Explain new concepts briefly — Ajas is learning full-stack development.
- Run `npm run build` (type-check + build) before each commit; fix all TypeScript errors. Small, clear commit messages.

## Commands
```powershell
npm install
npm run dev      # start local dev server
npm run build    # type-check + production build
npm run preview  # preview the production build
```
