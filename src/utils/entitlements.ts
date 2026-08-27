import type { PlanCapabilities, PlanLimits } from '../types/models';

/** A limit set to this means "no ceiling". Matches `Plan.UNLIMITED`. */
export const UNLIMITED = -1;

/** How close to `endDate` the renewal warning starts showing. */
export const EXPIRING_SOON_DAYS = 7;

export type LimitKey = keyof PlanLimits;
export type CapabilityKey = keyof PlanCapabilities;

interface LimitDescriptor {
  key: LimitKey;
  label: string;
  exhausted: string;
  enforced: boolean;
  /** Why it is not enforced, for whoever picks the work up next. */
  note?: string;
}

interface CapabilityDescriptor {
  key: CapabilityKey;
  label: string;
  enforced: boolean;
  note?: string;
}

export const LIMIT_CATALOG: LimitDescriptor[] = [
  {
    key: 'serviceListings',
    label: 'Service listings',
    exhausted: 'Your plan covers {{limit}} service listings and all of them are in use.',
    enforced: true,
  },
  {
    key: 'staffAccounts',
    label: 'Staff accounts',
    exhausted: 'Your plan covers {{limit}} staff accounts and all of them are in use.',
    enforced: true,
  },
  {
    key: 'queueTicketsPerDay',
    label: 'Queue tickets per day',
    exhausted: 'Your plan issues {{limit}} tickets a day and today is full.',
    enforced: false,
    note: 'Counted per day server-side; the app never sees the running total. Needs the backend to refuse the booking.',
  },
  {
    key: 'counters',
    label: 'Service counters',
    exhausted: 'Your plan covers {{limit}} counters and all of them are in use.',
    enforced: false,
    note: 'Multiple counters are not built yet - every agency runs a single counter.',
  },
  {
    key: 'branches',
    label: 'Branches',
    exhausted: 'Your plan covers {{limit}} branches and all of them are in use.',
    enforced: false,
    note: 'Branches are not built yet.',
  },
  {
    key: 'historyRetentionDays',
    label: 'Queue history',
    exhausted: 'Your plan keeps {{limit}} days of history.',
    enforced: false,
    note: 'Shown as a caption on the History tab; the cut-off itself has to be applied by the query that returns the rows.',
  },
];

export const CAPABILITY_CATALOG: CapabilityDescriptor[] = [
  {
    key: 'liveQueueBoard',
    label: 'Live queue board',
    enforced: false,
    note: 'The provider app has no queue board screen yet - only the staff dashboard lists live queues.',
  },
  {
    key: 'appointmentSlots',
    label: 'Appointment slots',
    enforced: false,
    note: 'The service form requires at least one slot, so switching this off today would leave Starter unable to publish any service. Needs the walk-in-only booking path first.',
  },
  {
    key: 'priorityCounter',
    label: 'Priority counter for remote bookings',
    enforced: false,
    note: 'Remote bookings are flagged isPriority by the backend regardless of plan.',
  },
  { key: 'kioskCheckIn', label: 'Kiosk check-in', enforced: false, note: 'Not built yet.' },
  { key: 'smsNotifications', label: 'SMS notifications to visitors', enforced: false, note: 'Not built yet.' },
  { key: 'analyticsDashboard', label: 'Advanced analytics dashboard', enforced: false, note: 'Not built yet.' },
  { key: 'multiBranchReporting', label: 'Multi-branch reporting', enforced: false, note: 'Not built yet.' },
  { key: 'dataExport', label: 'Export reports (CSV / PDF)', enforced: false, note: 'Not built yet.' },
  { key: 'customBranding', label: 'Custom branding', enforced: false, note: 'Not built yet.' },
  { key: 'apiAccess', label: 'API access', enforced: false, note: 'Not built yet.' },
];

const LIMIT_KEYS = LIMIT_CATALOG.map(item => item.key);
const CAPABILITY_KEYS = CAPABILITY_CATALOG.map(item => item.key);

export const FREE_LIMITS: PlanLimits = {
  serviceListings: 0,
  queueTicketsPerDay: 0,
  staffAccounts: 0,
  counters: 0,
  branches: 0,
  historyRetentionDays: 7,
};

export const FREE_CAPABILITIES: PlanCapabilities = CAPABILITY_KEYS.reduce(
  (all, key) => ({ ...all, [key]: false }),
  {} as PlanCapabilities,
);

const OPEN_LIMITS: PlanLimits = LIMIT_KEYS.reduce(
  (all, key) => ({ ...all, [key]: UNLIMITED }),
  {} as PlanLimits,
);

const OPEN_CAPABILITIES: PlanCapabilities = CAPABILITY_KEYS.reduce(
  (all, key) => ({ ...all, [key]: true }),
  {} as PlanCapabilities,
);

/**
 * `active`   - paid up, everything the plan covers is on.
 * `expiring` - still active but inside the renewal window.
 * `expired`  - a plan that ran out; read-only until it is renewed.
 * `free`     - never subscribed; read-only until a plan is bought.
 * `open`     - not a provider account, so no plan governs it (see below).
 */
export type PlanState = 'active' | 'expiring' | 'expired' | 'free' | 'open';

export interface Entitlements {
  state: PlanState;
  /** True while a paid plan is live - the single switch every write is gated on. */
  isActive: boolean;
  /** Create, edit and delete. False on `free` and `expired`. */
  canWrite: boolean;
  planLabel: string;
  endDate: string | null;
  daysRemaining: number;
  limits: PlanLimits;
  capabilities: PlanCapabilities;
  allows: (key: CapabilityKey) => boolean;
  limitOf: (key: LimitKey) => number;
  isUnlimited: (key: LimitKey) => boolean;
  /** Is there room for one more, given how many already exist? */
  hasRoom: (key: LimitKey, used: number) => boolean;
  /** How many are left, or `null` when the plan sets no ceiling. */
  remaining: (key: LimitKey, used: number) => number | null;
}

function readNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mergeLimits(source: unknown, fallback: PlanLimits): PlanLimits {
  const raw = (source ?? {}) as Partial<Record<LimitKey, unknown>>;
  return LIMIT_KEYS.reduce(
    (all, key) => ({ ...all, [key]: readNumber(raw[key], fallback[key]) }),
    {} as PlanLimits,
  );
}

function mergeCapabilities(source: unknown, fallback: PlanCapabilities): PlanCapabilities {
  const raw = (source ?? {}) as Partial<Record<CapabilityKey, unknown>>;
  return CAPABILITY_KEYS.reduce(
    (all, key) => ({ ...all, [key]: raw[key] === undefined ? fallback[key] : !!raw[key] }),
    {} as PlanCapabilities,
  );
}

function wholeDaysUntil(endDate: string | null): number {
  if (!endDate) return 0;
  const diff = new Date(endDate).getTime() - Date.now();
  if (!Number.isFinite(diff) || diff <= 0) return 0;
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

function build(
  state: PlanState,
  planLabel: string,
  endDate: string | null,
  daysRemaining: number,
  limits: PlanLimits,
  capabilities: PlanCapabilities,
): Entitlements {
  const isActive = state === 'active' || state === 'expiring' || state === 'open';

  const limitOf = (key: LimitKey) => limits[key];
  const isUnlimited = (key: LimitKey) => limits[key] === UNLIMITED;

  return {
    state,
    isActive,
    canWrite: isActive,
    planLabel,
    endDate,
    daysRemaining,
    limits,
    capabilities,
    limitOf,
    isUnlimited,
    allows: (key: CapabilityKey) => isActive && !!capabilities[key],
    hasRoom: (key: LimitKey, used: number) => isUnlimited(key) || used < limits[key],
    remaining: (key: LimitKey, used: number) =>
      isUnlimited(key) ? null : Math.max(0, limits[key] - used),
  };
}

interface SubscriptionLike {
  isSubscribed?: boolean;
  planLabel?: string;
  endDate?: string | null;
  subscription?: { limits?: unknown; capabilities?: unknown; planName?: string } | null;
}

interface AccountLike {
  role?: string;
  plan_name?: string | null;
  plan_expires_at?: string | null;
  planLabel?: string;
  subscription?: SubscriptionLike | null;
}

/**
 * Reads the plan off the account `authApi.getProfile` returned.
 */
export function resolveEntitlements(account?: AccountLike | null): Entitlements {
  if (!account || account.role !== 'provider') {
    return build('open', account?.planLabel ?? 'Free', null, 0, OPEN_LIMITS, OPEN_CAPABILITIES);
  }

  const summary = account.subscription ?? null;
  const endDate = summary?.endDate ?? account.plan_expires_at ?? null;
  const daysRemaining = wholeDaysUntil(endDate);
  const live = !!(summary?.isSubscribed ?? account.plan_name) && daysRemaining > 0;

  if (!live) {
    const state: PlanState = endDate ? 'expired' : 'free';
    return build(state, 'Free', endDate, 0, FREE_LIMITS, FREE_CAPABILITIES);
  }

  const planLabel = summary?.planLabel || summary?.subscription?.planName || account.plan_name || 'Free';
  const state: PlanState = daysRemaining <= EXPIRING_SOON_DAYS ? 'expiring' : 'active';

  return build(
    state,
    planLabel,
    endDate,
    daysRemaining,
    mergeLimits(summary?.subscription?.limits, OPEN_LIMITS),
    mergeCapabilities(summary?.subscription?.capabilities, OPEN_CAPABILITIES),
  );
}

/** The English label for a limit, ready to pass through `t()`. */
export function limitLabel(key: LimitKey): string {
  return LIMIT_CATALOG.find(item => item.key === key)?.label ?? key;
}

/** The English label for a capability, ready to pass through `t()`. */
export function capabilityLabel(key: CapabilityKey): string {
  return CAPABILITY_CATALOG.find(item => item.key === key)?.label ?? key;
}
