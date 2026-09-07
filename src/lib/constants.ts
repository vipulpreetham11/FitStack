import type { Role } from '@/types'
export const PERMISSIONS = {
  owner: ['members.view','members.create','members.edit','memberships.view','memberships.manage','payments.view','payments.create','plans.manage','promos.manage','attendance.scan','attendance.override','reports.view','reports.export','staff.manage','settings.manage','holidays.manage','credentials.manage','invoices.view','invoices.print','own.profile','own.membership','own.qr','own.payments','plans.browse','plans.buy'],
  admin: ['members.view','members.create','members.edit','memberships.view','memberships.manage','payments.view','payments.create','plans.manage','promos.manage','attendance.scan','attendance.override','reports.view','reports.export','staff.manage','settings.manage','holidays.manage','invoices.view','invoices.print','own.profile','own.membership','own.qr','own.payments','plans.browse','plans.buy'],
  receptionist: ['members.view','members.create','members.edit','memberships.view','payments.view','payments.create','attendance.scan','invoices.view','own.profile','own.membership','own.qr','own.payments','plans.browse','plans.buy'],
  trainer: ['own.profile','own.membership','own.qr','own.payments','plans.browse','plans.buy'],
  member: ['own.profile','own.membership','own.qr','own.payments','plans.browse','plans.buy'],
} as const satisfies Record<Role, readonly string[]>
export function hasPermission(role: Role | null, permission: string, superAdmin = false): boolean {
  return superAdmin || (role !== null && (PERMISSIONS[role] as readonly string[]).includes(permission))
}
export const ADMIN_ROLES: Role[] = ['owner', 'admin', 'receptionist']
