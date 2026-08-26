/**
 * What a staff account is allowed to do inside its provider's agency.
 */

export const PERMISSIONS = [
  'dashboard.view',
  'appointments.view',
  'appointments.manage',
  'queue.manage',
  'history.view',
  'services.view',
  'services.manage',
  'staff.manage',
  'profile.manage',
  'reviews.view',
  'subscription.view',
  'subscription.manage',
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

export const DEFAULT_STAFF_PERMISSIONS: PermissionKey[] = [
  'dashboard.view',
  'appointments.view',
  'appointments.manage',
  'queue.manage',
  'history.view',
  'services.view',
  'profile.manage',
];

/** Permissions that only make sense once the one they build on is granted. */
const IMPLIED_BY: Partial<Record<PermissionKey, PermissionKey[]>> = {
  'appointments.manage': ['appointments.view'],
  'queue.manage': ['appointments.view'],
  'services.manage': ['services.view'],
  'subscription.manage': ['subscription.view'],
};

/** The reverse of IMPLIED_BY: turning X off has to turn these off too. */
const DEPENDANTS: Partial<Record<PermissionKey, PermissionKey[]>> = (() => {
  const map: Partial<Record<PermissionKey, PermissionKey[]>> = {};
  (Object.keys(IMPLIED_BY) as PermissionKey[]).forEach(key => {
    (IMPLIED_BY[key] ?? []).forEach(base => {
      map[base] = [...(map[base] ?? []), key];
    });
  });
  return map;
})();

export interface PermissionOption {
  key: PermissionKey;
  label: string;
  description: string;
}

export interface PermissionGroup {
  title: string;
  options: PermissionOption[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    title: 'Queue & visitors',
    options: [
      {
        key: 'dashboard.view',
        label: 'See the dashboard',
        description: 'Home tab: booking counters and live queue per service',
      },
      {
        key: 'appointments.view',
        label: 'See appointments',
        description: 'Open the visitor list and each booking',
      },
      {
        key: 'appointments.manage',
        label: 'Manage appointments',
        description: 'Mark a visit completed and change its status',
      },
      {
        key: 'queue.manage',
        label: 'Run the queue',
        description: 'Call next, start serving, no-show, cancel a ticket',
      },
      {
        key: 'history.view',
        label: 'See history',
        description: 'History tab: visits that are already closed',
      },
    ],
  },
  {
    title: 'Agency',
    options: [
      {
        key: 'services.view',
        label: 'See service listings',
        description: 'Open the services they were assigned',
      },
      {
        key: 'services.manage',
        label: 'Manage service listings',
        description: 'Create, edit and delete services and their time slots',
      },
      {
        key: 'staff.manage',
        label: 'Manage staff',
        description: 'Add colleagues and set what they can do',
      },
      {
        key: 'reviews.view',
        label: 'See reviews & ratings',
        description: 'Read what visitors rated the agency',
      },
    ],
  },
  {
    title: 'Account & billing',
    options: [
      {
        key: 'profile.manage',
        label: 'Manage own profile',
        description: 'Edit their own name, photo and contact details',
      },
      {
        key: 'subscription.view',
        label: 'See the plan',
        description: 'Read the agency plan and its billing history',
      },
      {
        key: 'subscription.manage',
        label: 'Manage the subscription',
        description: 'Buy, upgrade or cancel the agency plan',
      },
    ],
  },
];

const ALL: Set<string> = new Set(PERMISSIONS);

const isPermission = (key: unknown): key is PermissionKey =>
  typeof key === 'string' && ALL.has(key);

export function sanitizePermissions(input: unknown): PermissionKey[] {
  const list = Array.isArray(input) ? input : input ? [input] : [];
  const wanted = new Set<PermissionKey>();
  list.filter(isPermission).forEach(key => {
    wanted.add(key);
    (IMPLIED_BY[key] ?? []).forEach(implied => wanted.add(implied));
  });
  return PERMISSIONS.filter(key => wanted.has(key));
}

/** Ticking a box in the form: adds the key plus anything it needs. */
export function grantPermission(current: PermissionKey[], key: PermissionKey): PermissionKey[] {
  return sanitizePermissions([...current, key]);
}

/** Un-ticking a box: drops the key plus anything that would be left dangling. */
export function revokePermission(current: PermissionKey[], key: PermissionKey): PermissionKey[] {
  const dropped = new Set<PermissionKey>([key]);
  (DEPENDANTS[key] ?? []).forEach(dependant => dropped.add(dependant));
  return current.filter(item => !dropped.has(item));
}

export function togglePermission(current: PermissionKey[], key: PermissionKey): PermissionKey[] {
  return current.includes(key) ? revokePermission(current, key) : grantPermission(current, key);
}

export function effectivePermissions(user?: {
  role?: string;
  permissions?: unknown;
} | null): PermissionKey[] {
  if (!user) return [];
  if (user.role !== 'staff') return [...PERMISSIONS];
  const stored = sanitizePermissions(user.permissions);
  return stored.length > 0 ? stored : [...DEFAULT_STAFF_PERMISSIONS];
}

/** The English label for a key, ready to pass through `t()`. */
export function permissionLabel(key: PermissionKey): string {
  for (const group of PERMISSION_GROUPS) {
    const option = group.options.find(item => item.key === key);
    if (option) return option.label;
  }
  return key;
}
