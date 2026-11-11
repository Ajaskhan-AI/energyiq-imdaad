import type { User } from '../types'

const IMDAAD = 'Imdaad · FM provider'

/** Fictional demo logins (one card each on the demo login screen). Not real Imdaad staff. */
export const SEED_USERS: User[] = [
  { id: 'u-manager', name: 'Khalid Al Suwaidi', role: 'fm_manager', siteIds: 'ALL', initials: 'KS', jobTitle: 'FM Operations Manager', organisation: IMDAAD },
  { id: 'u-engineer', name: 'Anitha Menon', role: 'energy_engineer', siteIds: 'ALL', initials: 'AM', jobTitle: 'Energy & MEP Engineer', organisation: IMDAAD },
  { id: 'u-sup-gulfstone', name: 'Omar Farouk', role: 'site_supervisor', siteIds: ['HBT', 'DLH'], initials: 'OF', jobTitle: 'Site Supervisor — Gulfstone sites', organisation: IMDAAD },
  { id: 'u-sup-retail', name: 'Ravi Shankar', role: 'site_supervisor', siteIds: ['ANM', 'PMR'], initials: 'RS', jobTitle: 'Site Supervisor — Mall & Residences', organisation: IMDAAD },
  { id: 'u-client-gulfstone', name: 'Sarah Thompson', role: 'client_viewer', siteIds: ['HBT', 'DLH'], clientId: 'CL-01', initials: 'ST', jobTitle: 'Asset Manager', organisation: 'Gulfstone Real Estate · client' },
  { id: 'u-client-alnoor', name: 'Hamad Al Nuaimi', role: 'client_viewer', siteIds: ['ANM'], clientId: 'CL-03', initials: 'HN', jobTitle: 'Mall General Manager', organisation: 'Al Noor Retail Group · client' },
  { id: 'u-admin', name: 'Kuroshio Admin', role: 'admin', siteIds: 'ALL', initials: 'KA', jobTitle: 'System Admin', organisation: 'Kuroshio AI' },
]
