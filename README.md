# EnergyIQ for Imdaad — SMDB monitoring & energy analytics demo (Kuroshio AI)

A clickable demo of Kuroshio AI's **EnergyIQ** platform, prepared for **Imdaad**, an integrated FM provider in Dubai.
Selec energy meters on each sub-main distribution board (SMDB) are read by Kuroshio IoT nodes; EnergyIQ turns that
data into live monitoring and analytics across a multi-client FM portfolio.

> **Sample data — for demonstration only.** Everything runs in the browser with generated sample data.
> There is no backend, no database and no real sensors. All people, clients and buildings are fictional.
> Tariffs and emission factors are indicative. Savings are not promised — they are to be measured during a pilot.

## Modules

| Module | What it shows |
|--------|---------------|
| Portfolio overview | Live load, alerts, waste found, cost, CO₂, IoT nodes online, status per site |
| SMDB live monitoring | 24 boards on 5 sites, updated every 4 s; thresholds, alerts → acknowledge → work order, simulate fault |
| Energy analytics | Consumption vs expected (opening hours + UAE calendar), waste patterns, heatmap, building benchmark, editable calendar, CSV |
| Power quality | Power factor, imbalance, voltage, harmonics (THD) per board, with recommendations |
| Asset health | Motor current signature (CT clamps) → health score, diagnosis, work order |
| Billing & sub-metering | Estimated DEWA charges per site, metered recharge per tenant / cost centre, PDF statement |
| Work orders | From alerts, asset health and waste patterns; simulated "Send to CAFM"; PDF |
| Device health | Kuroshio IoT node signal, data completeness, firmware; simulate comms loss |
| Monthly client report | PDF per client or site |

## Run it (Windows PowerShell)

```powershell
npm install
npm run dev       # http://localhost:5173
npm run build     # type-check + production build into dist/
npm run preview   # serve the production build
```

## Demo users (no passwords — click a card)

| Role | User | Sites | Lands on |
|------|------|-------|----------|
| FM Operations Manager | Khalid Al Suwaidi | All | Overview |
| Energy & MEP Engineer | Anitha Menon | All | Energy analytics |
| Site Supervisor | Omar Farouk (Gulfstone), Ravi Shankar (Mall + Residences) | Own sites | SMDB monitoring |
| Client (building owner) | Sarah Thompson (Gulfstone), Hamad Al Nuaimi (Al Noor mall) | Own sites, read-only | Overview |
| System Admin | Kuroshio Admin | All | Device health |

Use **Switch role** (top right) to jump between users, the **site switcher** to focus on one site, and
**Reset demo data** to start fresh.

## Suggested demo flow (about 10 minutes)

1. **FM Manager → Overview** — the whole portfolio live; the sites table shows which site needs attention.
2. **Energy analytics → Waste detection** — the Business Tower HVAC runs every weekend (≈ AED 210k/yr if not fixed);
   open it to see the hourly evidence, then **Create work order** → **Send to CAFM**.
3. **Energy analytics → Operating calendar** — add a public holiday or shutdown and watch the analysis recalculate.
4. **Admin → SMDB monitoring** — *Simulate trip* → live alert + toast. **Engineer** acknowledges and creates a work order.
5. **Device health** — the Logistics Hub office node is offline (data buffered); *Restart node* brings it back.
6. **Power quality** — car-park board at PF 0.84 with the capacitor bank size needed; medical-centre UPS board with high THD.
7. **Billing** — metered recharge per tenant; download a recharge statement PDF.
8. **Switch to Client (Hamad, mall)** — sees only the mall; downloads the monthly client report PDF.

## Deploy (static site)

The app uses hash URLs (`/#/page`) and relative asset paths, so `dist/` works on any static host
(Vercel via `vercel.json`, Netlify via `netlify.toml`, or GitHub Pages via `.github/workflows/deploy-pages.yml`).

## Project structure

```
src/
  auth/        permissions matrix (can()), roles, route guard
  data/        sites, SMDBs + IoT nodes, assets, calendar, users, seed alerts / work orders, generated meter history
  sim/         load model, live SMDB simulator, IoT device model, asset-health model
  store/       React Context + reducer, saved to localStorage
  lib/         pure logic (site scoping, waste detection, billing, report numbers, tariff, CO₂, CSV…)
  pdf/         PDF generation (jsPDF + autotable), loaded on demand
  components/  layout shell and shared UI
  pages/       one folder per module
```

Kuroshio AI · www.kuroshioai.com · www.kuroshioai.ae · info@kuroshioai.com
