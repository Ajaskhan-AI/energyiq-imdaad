import {
  Activity,
  ArrowDown,
  Banknote,
  ArrowRight,
  Building,
  Cable,
  ChartColumn,
  ClipboardList,
  Cloud,
  Cpu,
  Droplet,
  FileText,
  Flame,
  Gauge,
  Fuel,
  Globe,
  Mail,
  Radio,
  RadioTower,
  Receipt,
  ShieldCheck,
  Snowflake,
  Waves,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { Fragment } from 'react'
import { Link } from 'react-router'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'

interface Step {
  icon: LucideIcon
  title: string
  detail: string
  points: string[]
}

const CHAIN: Step[] = [
  {
    icon: Zap,
    title: 'Selec energy meters',
    detail: 'On each sub-main distribution board (SMDB)',
    points: ['kWh, kW, kVA, power factor', 'Voltage and current per phase', 'RS-485 / Modbus output'],
  },
  {
    icon: Cpu,
    title: 'ESP32-S3 IoT node',
    detail: 'Small gateway in the electrical room',
    points: ['Reads up to 4 meters every minute', 'Also reads CT clamps on motors', 'Buffers data if the link drops, back-fills later'],
  },
  {
    icon: RadioTower,
    title: 'SIM7080G cellular',
    detail: 'LTE-M / NB-IoT modem',
    points: ['Sends data over the cellular network', 'Kept separate from the building / client IT network', 'No new cabling to a server room'],
  },
  {
    icon: Cloud,
    title: 'EnergyIQ cloud platform',
    detail: 'What Imdaad and its clients use',
    points: ['Live monitoring and alerts', 'Energy analytics and waste detection', 'Billing, work orders and monthly client reports'],
  },
]

const MODULES: Array<{ icon: LucideIcon; title: string; to: string; text: string }> = [
  { icon: Zap, title: 'SMDB live monitoring', to: '/smdb', text: 'Live load, voltage, current and power factor per board across every client site, with alerts for overload, imbalance, voltage, low PF and trips.' },
  { icon: ChartColumn, title: 'Energy analytics', to: '/energy', text: 'Every board compared with its site’s opening hours and the UAE calendar, so waste (e.g. HVAC on at weekends, lights on all night) is found automatically.' },
  { icon: Waves, title: 'Power quality', to: '/power-quality', text: 'Power factor, phase balance, voltage and harmonics, with recommendations such as capacitor-bank sizing.' },
  { icon: Activity, title: 'Asset health', to: '/assets', text: 'CT clamps on chillers, AHUs, pumps and cooling towers reveal developing faults from the motor current signature.' },
  { icon: Gauge, title: 'Capacity & demand', to: '/capacity', text: 'Metered peak demand against each breaker rating, spare capacity, and a check before new load is connected.' },
  { icon: ShieldCheck, title: 'Supply reliability', to: '/reliability', text: 'Every trip and supply interruption detected by the meters, with availability per board and per site.' },
  { icon: Banknote, title: 'Budget & forecast', to: '/budget', text: 'Cost so far this month per site, a month-end forecast and an early warning before a site overspends.' },
  { icon: Receipt, title: 'Billing & sub-metering', to: '/billing', text: 'Estimated DEWA charges per site and metered recharge to each tenant or cost centre.' },
  { icon: ClipboardList, title: 'Work orders', to: '/work-orders', text: 'Any alert or insight becomes a work order, ready to hand over to Imdaad’s CAFM system.' },
  { icon: Radio, title: 'Device health', to: '/devices', text: 'Signal, data completeness and firmware for every Kuroshio IoT node, so no data gap goes unnoticed.' },
  { icon: FileText, title: 'Monthly client report', to: '/report', text: 'One-click PDF per client or site: energy, cost, waste found, power quality, alerts and indicative Scope 2 CO₂.' },
]

const ADD_ONS: Array<{ icon: LucideIcon; title: string; text: string }> = [
  { icon: Snowflake, title: 'Cold-room & chiller temperature', text: 'Temperature sensors for cold stores, server rooms and chilled-water lines, with alerts before stock or equipment is at risk.' },
  { icon: Droplet, title: 'Water & leak monitoring', text: 'Water meters and leak sensors in plant rooms, risers and car parks.' },
  { icon: Fuel, title: 'Generator monitoring', text: 'Run hours, fuel level, battery voltage and test-run records for standby generators.' },
  { icon: Flame, title: 'Panel hot-spot sensors', text: 'Wireless temperature sensors on busbars and terminals to catch loose connections early.' },
]

const PILOT = [
  ['Choose', 'Imdaad selects one or two client sites (e.g. an office tower and a mall) and their main SMDBs.'],
  ['Install', 'Fit Selec meters (or read existing Modbus meters) and CT clamps on key motors; mount the IoT nodes. No shutdown for CT clamps.'],
  ['Run', 'Use EnergyIQ alongside the current way of working: alerts, waste detection, monthly client reports.'],
  ['Measure', 'Compare energy use, alerts caught early and work orders raised. Results are measured during the pilot.'],
] as const

/** Sales/explanation page: the hardware chain, what each module does, add-ons and a pilot outline. */
export default function HowItWorksPage() {
  return (
    <>
      <PageHeader
        title="How it works"
        description="From the electrical panel to the dashboard: the Kuroshio EnergyIQ platform behind this demo, packaged for an FM provider managing many client sites."
      />

      <Card title="Data flow" subtitle="One IoT node per electrical room collects meter and motor data and sends it to the cloud">
        <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-stretch">
          {CHAIN.map((step, i) => {
            const Icon = step.icon
            return (
              <Fragment key={step.title}>
                <div className="flex-1 rounded-xl border border-navy-100 bg-navy-50/50 p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600 ring-1 ring-teal-100">
                      <Icon className="size-6" aria-hidden />
                    </span>
                    <div>
                      <p className="font-semibold text-navy-900">{step.title}</p>
                      <p className="text-xs text-navy-500">{step.detail}</p>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1 text-sm text-navy-700">
                    {step.points.map((p) => (
                      <li key={p} className="flex gap-2">
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-teal-500" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                {i < CHAIN.length - 1 && (
                  <div className="flex items-center justify-center text-teal-600" aria-hidden>
                    <ArrowRight className="hidden size-6 lg:block" />
                    <ArrowDown className="size-6 lg:hidden" />
                  </div>
                )}
              </Fragment>
            )
          })}
        </div>
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50 p-4">
          <Cable className="mt-0.5 size-5 shrink-0 text-teal-700" aria-hidden />
          <p className="text-sm text-navy-800">
            <strong>CT clamps for predictive maintenance:</strong> split-core current transformers clip around the motor supply cables of chillers,
            AHUs and pumps: no rewiring and no shutdown needed. The same IoT node reads them and EnergyIQ analyses the current signature.
          </p>
        </div>
      </Card>

      <h2 className="mt-8 mb-3 text-lg font-semibold text-navy-900">What Imdaad gets</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {MODULES.map(({ icon: Icon, title, to, text }) => (
          <Link key={title} to={to} className="group rounded-xl border border-navy-100 bg-white p-5 shadow-sm transition hover:border-teal-300 hover:shadow-md">
            <Icon className="size-6 text-teal-600" aria-hidden />
            <p className="mt-2 font-semibold text-navy-900 group-hover:text-teal-700">{title}</p>
            <p className="mt-1 text-sm text-navy-600">{text}</p>
          </Link>
        ))}
      </div>

      <h2 className="mt-8 mb-3 text-lg font-semibold text-navy-900">Available add-ons</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ADD_ONS.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-xl border border-dashed border-navy-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <Icon className="size-6 text-navy-600" aria-hidden />
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-600/20">Add-on</span>
            </div>
            <p className="mt-2 font-semibold text-navy-900">{title}</p>
            <p className="mt-1 text-sm text-navy-600">{text}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <Card title="Suggested pilot" className="xl:col-span-2">
          <ol className="grid gap-4 sm:grid-cols-2">
            {PILOT.map(([title, text], i) => (
              <li key={title} className="flex gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white">{i + 1}</span>
                <span>
                  <span className="block font-semibold text-navy-900">{title}</span>
                  <span className="text-sm text-navy-600">{text}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-navy-500">
            All figures in this demo are sample data. Energy savings and other benefits are not promised: they are to be measured during the pilot.
          </p>
        </Card>

        <Card title="About Kuroshio AI">
          <div className="space-y-3 text-sm text-navy-700">
            <p>Deep tech startup building IoT and AI tools for facilities, energy and industry.</p>
            <p className="flex items-start gap-2">
              <Building className="mt-0.5 size-4 shrink-0 text-navy-500" aria-hidden />
              <span>
                <strong>UAE:</strong> Kuroshio AI Ltd, RAKEZ, Ras Al Khaimah
                <br />
                <strong>India:</strong> Kuroshio AI Private Limited, STPI Trivandrum
              </span>
            </p>
            <p className="flex items-center gap-2">
              <Globe className="size-4 shrink-0 text-navy-500" aria-hidden />
              <a href="https://www.kuroshioai.com" target="_blank" rel="noreferrer" className="text-teal-700 hover:underline">
                www.kuroshioai.com
              </a>
              ·
              <a href="https://www.kuroshioai.ae" target="_blank" rel="noreferrer" className="text-teal-700 hover:underline">
                www.kuroshioai.ae
              </a>
            </p>
            <p className="flex items-center gap-2">
              <Mail className="size-4 shrink-0 text-navy-500" aria-hidden />
              <a href="mailto:info@kuroshioai.com" className="text-teal-700 hover:underline">
                info@kuroshioai.com
              </a>
            </p>
          </div>
        </Card>
      </div>
    </>
  )
}
