import {
  Activity,
  ArrowRight,
  Banknote,
  Building2,
  Cable,
  ChartColumn,
  ClipboardList,
  Cloud,
  Cpu,
  DatabaseBackup,
  Droplet,
  FileText,
  Flame,
  Fuel,
  Gauge,
  Globe,
  LayoutDashboard,
  Mail,
  Radio,
  RadioTower,
  Receipt,
  ShieldCheck,
  Snowflake,
  Timer,
  Users,
  Waves,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { Fragment } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'
import { KuroshioLogo } from '../../components/layout/BrandMark'
import { Badge } from '../../components/ui/Badge'
import { NODES, SMDBS } from '../../data/smdbs'
import { SITES } from '../../data/sites'
import { formatNumber } from '../../lib/format'
import { useSimulator } from '../../sim/simulatorContext'

// ---------------------------------------------------------------- content

interface Stage {
  icon: LucideIcon
  title: string
  where: string
  points: string[]
}

/** The data chain, left to right. `link` = what connects a stage to the next one. */
const STAGES: Array<Stage & { link?: string }> = [
  {
    icon: Zap,
    title: 'Selec energy meter',
    where: 'On every SMDB',
    points: ['Voltage, current, kW, PF, kWh per board', 'Fits existing panels; existing Modbus meters can be read too'],
    link: 'RS-485 · Modbus',
  },
  {
    icon: Cpu,
    title: 'Kuroshio IoT node',
    where: 'ESP32-S3, in the electrical room',
    points: ['Reads the meters every minute', 'Also reads CT clamps on motors', 'Stores readings if the signal drops'],
    link: 'LTE-M / NB-IoT',
  },
  {
    icon: Cloud,
    title: 'EnergyIQ cloud',
    where: 'Analytics platform',
    points: ['Checks every reading against limits', 'Learns each board’s normal pattern', 'Runs the analytics and reports'],
    link: 'Web app',
  },
  {
    icon: Users,
    title: 'Imdaad & its clients',
    where: 'Any browser, any device',
    points: ['FM team: alerts, work orders', 'Engineers: analytics', 'Clients: their own sites only'],
  },
]

const MEASURED: Array<{ label: string; unit: string }> = [
  { label: 'Voltage per phase', unit: 'V' },
  { label: 'Current per phase', unit: 'A' },
  { label: 'Active power', unit: 'kW' },
  { label: 'Apparent power', unit: 'kVA' },
  { label: 'Reactive power', unit: 'kVAr' },
  { label: 'Power factor', unit: 'PF' },
  { label: 'Frequency', unit: 'Hz' },
  { label: 'Energy', unit: 'kWh' },
  { label: 'Current harmonics', unit: 'THD %' },
]

interface Module {
  icon: LucideIcon
  title: string
  to: string
  text: string
}

/** Same groups as the sidebar. */
const GROUPS: Array<{ name: string; tagline: string; modules: Module[] }> = [
  {
    name: 'Monitor',
    tagline: 'See every board, live',
    modules: [
      { icon: LayoutDashboard, title: 'Portfolio overview', to: '/overview', text: 'Every client site on one screen: live load, alerts, waste found, cost and CO₂.' },
      { icon: Zap, title: 'SMDB live monitoring', to: '/smdb', text: 'Live readings per board with alerts for overload, imbalance, voltage, low PF and trips.' },
      { icon: ShieldCheck, title: 'Supply reliability', to: '/reliability', text: 'Every trip and supply interruption, with availability per board and per site.' },
      { icon: Radio, title: 'Device health', to: '/devices', text: 'Signal, data completeness and firmware of every IoT node.' },
    ],
  },
  {
    name: 'Analyse',
    tagline: 'Turn readings into findings',
    modules: [
      { icon: ChartColumn, title: 'Energy analytics', to: '/energy', text: 'Use compared with opening hours and the UAE calendar, so waste is found automatically.' },
      { icon: Gauge, title: 'Capacity & demand', to: '/capacity', text: 'Peak demand against breaker ratings, and a check before new load is added.' },
      { icon: Waves, title: 'Power quality', to: '/power-quality', text: 'Power factor, balance, voltage and harmonics, with recommendations.' },
      { icon: Activity, title: 'Asset health', to: '/assets', text: 'CT clamps on motors reveal developing faults weeks ahead.' },
    ],
  },
  {
    name: 'Operate',
    tagline: 'Act, bill and report',
    modules: [
      { icon: ClipboardList, title: 'Work orders', to: '/work-orders', text: 'Any alert or finding becomes a work order, ready for Imdaad’s CAFM.' },
      { icon: Banknote, title: 'Budget & forecast', to: '/budget', text: 'Cost so far, month-end forecast and early overspend warnings.' },
      { icon: Receipt, title: 'Billing & sub-metering', to: '/billing', text: 'Estimated DEWA charges and metered recharge per tenant.' },
      { icon: FileText, title: 'Monthly client report', to: '/report', text: 'A ready-to-send PDF for each client or site.' },
    ],
  },
]

const ADD_ONS: Array<{ icon: LucideIcon; title: string; text: string }> = [
  { icon: Snowflake, title: 'Cold-room & chiller temperature', text: 'Alerts before stock or equipment is at risk.' },
  { icon: Droplet, title: 'Water & leak monitoring', text: 'Water meters and leak sensors in plant rooms and risers.' },
  { icon: Fuel, title: 'Generator monitoring', text: 'Run hours, fuel level, battery and test-run records.' },
  { icon: Flame, title: 'Panel hot-spot sensors', text: 'Busbar and terminal temperature to catch loose connections.' },
]

const PILOT: Array<{ title: string; text: string }> = [
  { title: 'Choose', text: 'Imdaad picks one or two client sites (e.g. an office tower and a mall) and their main SMDBs.' },
  { title: 'Install', text: 'Fit Selec meters (or read existing Modbus meters) and CT clamps on key motors; mount the IoT nodes. No shutdown for CT clamps.' },
  { title: 'Run', text: 'Use EnergyIQ alongside today’s way of working: alerts, waste detection, monthly client reports.' },
  { title: 'Measure', text: 'Compare energy use, issues caught early and work orders raised. Results are measured during the pilot.' },
]

// ---------------------------------------------------------------- page

/** Explains the platform: hardware chain, what is measured, modules, pilot and add-ons. */
export default function HowItWorksPage() {
  const sim = useSimulator()
  const nodesOnline = sim.nodes.filter((n) => n.status !== 'offline').length

  return (
    <div className="space-y-12">
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden rounded-2xl border border-teal-100 bg-teal-50/50 px-6 py-8 sm:px-10 sm:py-10">
        <svg className="pointer-events-none absolute inset-0 size-full text-teal-600 opacity-[0.06]" aria-hidden>
          <defs>
            <pattern id="hiw-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M32 0H0V32" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hiw-grid)" />
        </svg>
        <div className="relative flex flex-wrap items-center gap-8">
          <div className="min-w-0 flex-1 basis-96">
            <p className="text-sm font-semibold tracking-widest text-teal-700 uppercase">How it works</p>
            <h1 className="mt-2 text-3xl leading-tight font-bold tracking-tight text-navy-950 sm:text-4xl">From the switchboard to a decision, in minutes.</h1>
            <p className="mt-3 max-w-2xl text-lg text-navy-600">
              A Selec meter on each SMDB, a Kuroshio IoT node in the electrical room, and the EnergyIQ cloud. No changes to the building’s IT network, and no
              new cabling to a server room.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {[
                { icon: Timer, text: 'Readings every minute' },
                { icon: RadioTower, text: 'Own cellular link, separate from the building network' },
                { icon: DatabaseBackup, text: 'No data lost if the signal drops' },
              ].map(({ icon: Icon, text }) => (
                <span key={text} className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-white px-3 py-1.5 text-sm font-medium text-navy-800">
                  <Icon className="size-4 text-teal-600" aria-hidden />
                  {text}
                </span>
              ))}
            </div>
          </div>
          <dl className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:grid-cols-2">
            {[
              ['Client sites', SITES.length],
              ['SMDBs metered', SMDBS.length],
              ['IoT nodes online', `${nodesOnline} / ${NODES.length}`],
              ['Readings per day', formatNumber(SMDBS.length * 1440)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-teal-100 bg-white px-5 py-4 shadow-sm">
                <dt className="text-xs font-medium text-navy-500">{label}</dt>
                <dd className="mt-1 text-2xl font-bold text-navy-950 tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------- Architecture ---------- */}
      <section>
        <SectionTitle eyebrow="The data chain" title="Four steps from the panel to the dashboard" />
        <div className="flex flex-col items-stretch lg:flex-row">
          {STAGES.map((stage, i) => (
            <Fragment key={stage.title}>
              <StageCard stage={stage} step={i + 1} />
              {stage.link && <Connector label={stage.link} />}
            </Fragment>
          ))}
        </div>
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-navy-100 bg-white p-4 text-sm text-navy-700 shadow-sm">
          <Cable className="mt-0.5 size-5 shrink-0 text-teal-600" aria-hidden />
          <p>
            <strong className="text-navy-950">CT clamps for asset health:</strong> split-core current sensors clip around the motor cables of chillers, AHUs and pumps. No
            rewiring and no shutdown. The same IoT node reads them, and EnergyIQ analyses the motor current signature.
          </p>
        </div>
      </section>

      {/* ---------- What is measured ---------- */}
      <section className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <SectionTitle eyebrow="What the meter sees" title="Nine values on every board, every minute" />
          <p className="-mt-2 text-navy-600">
            Every module in EnergyIQ is built from these readings. Nothing is typed in by hand: alerts, waste, capacity, reliability, billing and reports all come from
            the meters.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-3">
          {MEASURED.map((m) => (
            <div key={m.label} className="rounded-xl border border-navy-100 bg-white px-4 py-3 shadow-sm">
              <p className="font-mono text-lg font-bold text-teal-700">{m.unit}</p>
              <p className="text-sm text-navy-700">{m.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Modules ---------- */}
      <section>
        <SectionTitle eyebrow="What Imdaad gets" title="Monitor, analyse, operate" />
        <div className="grid gap-6 lg:grid-cols-3">
          {GROUPS.map((group, gi) => (
            <div key={group.name} className="rounded-2xl border border-navy-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white">{gi + 1}</span>
                <div>
                  <h3 className="font-bold text-navy-950">{group.name}</h3>
                  <p className="text-sm text-navy-500">{group.tagline}</p>
                </div>
              </div>
              <ul className="space-y-1">
                {group.modules.map(({ icon: Icon, title, to, text }) => (
                  <li key={to}>
                    <Link to={to} className="group -mx-2 flex gap-3 rounded-lg px-2 py-2.5 transition hover:bg-teal-50">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600 ring-1 ring-teal-100 group-hover:bg-white">
                        <Icon className="size-[18px]" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1 font-semibold text-navy-950 group-hover:text-teal-700">
                          {title}
                          <ArrowRight className="size-3.5 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" aria-hidden />
                        </span>
                        <span className="block text-sm text-navy-600">{text}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Pilot ---------- */}
      <section>
        <SectionTitle eyebrow="Getting started" title="A pilot on one or two sites" />
        <ol className="grid gap-4 md:grid-cols-4">
          {PILOT.map((step, i) => (
            <li key={step.title} className="relative rounded-2xl border border-navy-100 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-teal-600 font-bold text-white">{i + 1}</span>
                <h3 className="text-lg font-bold text-navy-950">{step.title}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-navy-600">{step.text}</p>
              {i < PILOT.length - 1 && <ArrowRight className="absolute top-7 -right-3.5 z-10 hidden size-5 rounded-full bg-white text-teal-600 md:block" aria-hidden />}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-navy-500">All figures in this demo are sample data. Savings and other benefits are not promised: they are measured during the pilot.</p>
      </section>

      {/* ---------- Add-ons + About ---------- */}
      <section className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <SectionTitle eyebrow="Same IoT node, more sensors" title="Available add-ons" />
          <div className="grid gap-3 sm:grid-cols-2">
            {ADD_ONS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-3 rounded-xl border border-dashed border-navy-200 bg-white p-4">
                <Icon className="mt-0.5 size-5 shrink-0 text-navy-500" aria-hidden />
                <div>
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-navy-950">
                    {title}
                    <Badge tone="info">Add-on</Badge>
                  </p>
                  <p className="mt-0.5 text-sm text-navy-600">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2">
          <SectionTitle eyebrow="Who we are" title="About Kuroshio AI" />
          <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <KuroshioLogo className="h-10" />
              <p className="text-sm text-navy-700">Deep tech startup building IoT and AI tools for facilities, energy and industry.</p>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex gap-3">
                <Building2 className="mt-0.5 size-4 shrink-0 text-teal-600" aria-hidden />
                <span className="text-navy-700">
                  <strong className="text-navy-950">UAE:</strong> Kuroshio AI Ltd, RAKEZ, Ras Al Khaimah
                  <br />
                  <strong className="text-navy-950">India:</strong> Kuroshio AI Private Limited, STPI Trivandrum
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Globe className="size-4 shrink-0 text-teal-600" aria-hidden />
                <span>
                  <a href="https://www.kuroshioai.com" target="_blank" rel="noreferrer" className="font-medium text-teal-700 hover:underline">
                    www.kuroshioai.com
                  </a>
                  <span className="text-navy-300"> · </span>
                  <a href="https://www.kuroshioai.ae" target="_blank" rel="noreferrer" className="font-medium text-teal-700 hover:underline">
                    www.kuroshioai.ae
                  </a>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="size-4 shrink-0 text-teal-600" aria-hidden />
                <a href="mailto:info@kuroshioai.com" className="font-medium text-teal-700 hover:underline">
                  info@kuroshioai.com
                </a>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </div>
  )
}

// ---------------------------------------------------------------- pieces

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-5">
      <p className="text-xs font-semibold tracking-widest text-teal-700 uppercase">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-bold tracking-tight text-navy-950">{title}</h2>
    </div>
  )
}

function StageCard({ stage, step }: { stage: Stage; step: number }) {
  const Icon = stage.icon
  return (
    <div className="flex-1 rounded-2xl border border-navy-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="flex size-12 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm">
          <Icon className="size-6" aria-hidden />
        </span>
        <span className="text-3xl font-bold text-navy-100 tabular-nums">{String(step).padStart(2, '0')}</span>
      </div>
      <h3 className="mt-4 text-lg font-bold text-navy-950">{stage.title}</h3>
      <p className="text-sm font-medium text-teal-700">{stage.where}</p>
      <ul className="mt-3 space-y-1.5 text-sm text-navy-600">
        {stage.points.map((p) => (
          <li key={p} className="flex gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-teal-500" />
            {p}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Link between two stages: a line with moving "data" dots and the protocol name. */
function Connector({ label }: { label: string }) {
  return (
    <div className="relative flex shrink-0 items-center justify-center py-3 lg:w-24 lg:py-0" aria-hidden>
      {/* the line: vertical on phones, horizontal on large screens */}
      <span className="absolute h-full w-0.5 bg-teal-200 lg:h-0.5 lg:w-full" />
      <span className={cn('hiw-dot absolute size-2 rounded-full bg-teal-600')} />
      <span className={cn('hiw-dot hiw-dot-2 absolute size-2 rounded-full bg-teal-600')} />
      <span className="relative rounded-full border border-teal-200 bg-white px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-teal-700">{label}</span>
    </div>
  )
}
