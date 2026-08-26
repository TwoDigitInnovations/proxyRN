import type { PermissionKey } from '../utils/permissions';

export type Gender = 'Male' | 'Female' | 'Other';

/** The four methods offered at every checkout - ticket booking and plans alike. */
export type PaymentMethod = 'Orange Money' | 'PayPal' | 'Stripe' | 'Credit Card';

export interface Category {
  _id: string;
  name: string;
  image: string;
}

export interface ServiceProviderUser {
  _id: string;
  name: string;
  profile?: string;
  phone?: string;
  about_us?: string;
}

export interface ServiceListing {
  _id: string;
  service_name: string;
  service_description?: string;
  service_slot: string[];
  service_photo?: string[];
  address?: string;
  category: string;
  service_location: {
    type: 'Point';
    coordinates: [number, number];
  };
  user: ServiceProviderUser;
  queueCount?: number;
  estimatedWaitMinutes?: number;
  crowdLevel?: 'Low' | 'Moderate' | 'High';
  averageRating?: number;
  reviewCount?: number;
}

export interface Review {
  _id: string;
  appointment: string;
  user?: ServiceProviderUser | string;
  service_provider: string;
  service_ref?: string;
  rating: number;
  message?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface RatingSummary {
  averageRating: number;
  totalReviews: number;
  breakdown: Record<'1' | '2' | '3' | '4' | '5', number>;
}

export interface Appointment {
  _id: string;
  name: string;
  email: string;
  phone: string;
  gender: string;
  purpose_of_visit: string;
  date: string;
  time: string;
  full_date: string;
  status: 'Pending' | 'Completed';
  ticketNumber?: string;
  paymentMethod?: PaymentMethod;
  paymentAmount?: number;
  transactionId?: string;
  paymentStatus?: 'Completed' | 'Pending';
  service?: string;
  service_ref?: string;
  service_provider?: ServiceProviderUser;
  user?: ServiceProviderUser;
  review?: Review | null;
  createdAt: string;
}

/** A service as it appears on a staff member's card - name and address only. */
export interface AssignedService {
  _id: string;
  service_name: string;
  address?: string;
}

export interface StaffMember {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  profile?: string;
  role: 'staff';
  isActive: boolean;
  assigned_services: AssignedService[];
  permissions: PermissionKey[];
  createdAt?: string;
}

/** One assigned service on the staff home screen, with today's queue numbers. */
export interface StaffServiceQueue extends AssignedService {
  service_photo?: string[];
  service_slot?: string[];
  queueCount?: number;
  waitingCount?: number;
  servingCount?: number;
  estimatedWaitMinutes?: number;
  crowdLevel?: 'Low' | 'Moderate' | 'High';
  nowServing?: string | null;
}

export type BillingCycle = 'monthly' | 'yearly';

export type PlanKey = 'starter' | 'business' | 'network';

export type SupportLevel = 'email' | 'priority' | 'dedicated';

/** Numeric allowances. -1 means unlimited; 0 means not included at all. */
export interface PlanLimits {
  serviceListings: number;
  queueTicketsPerDay: number;
  staffAccounts: number;
  counters: number;
  branches: number;
  historyRetentionDays: number;
}

/** The on/off features the admin ticks on a plan. */
export interface PlanCapabilities {
  liveQueueBoard: boolean;
  appointmentSlots: boolean;
  priorityCounter: boolean;
  kioskCheckIn: boolean;
  smsNotifications: boolean;
  analyticsDashboard: boolean;
  multiBranchReporting: boolean;
  dataExport: boolean;
  customBranding: boolean;
  apiAccess: boolean;
}

/** A subscription tier as the admin configured it. */
export interface Plan {
  _id: string;
  key: PlanKey;
  name: string;
  tagline?: string;
  limits?: PlanLimits;
  capabilities?: PlanCapabilities;
  supportLevel?: SupportLevel;
  customFeatures?: string[];
  /** Card bullets the server derives from the fields above. Read-only. */
  features: string[];
  monthlyPrice: number;
  yearlyPrice: number;
  monthlyDurationDays: number;
  yearlyDurationDays: number;
  currency: string;
  isActive: boolean;
  sortOrder: number;
}

/** One purchase. Plan name, price and features are frozen at purchase time. */
export interface Subscription {
  _id: string;
  provider: string;
  plan?: Plan | string;
  planKey?: PlanKey;
  planName: string;
  /** Entitlements as they stood on the day this was bought. */
  limits?: PlanLimits;
  capabilities?: PlanCapabilities;
  supportLevel?: SupportLevel;
  features: string[];
  billingCycle: BillingCycle;
  amount: number;
  currency: string;
  durationDays: number;
  startDate: string;
  endDate: string;
  status: 'Active' | 'Expired' | 'Cancelled';
  paymentMethod?: PaymentMethod;
  paymentAmount?: number;
  transactionId?: string;
  paymentStatus?: 'Completed' | 'Pending';
  createdAt?: string;
}

/** What the provider is on right now. planLabel is "Free" when unsubscribed. */
export interface SubscriptionSummary {
  isSubscribed: boolean;
  planLabel: string;
  planKey: PlanKey | null;
  billingCycle: BillingCycle | null;
  startDate: string | null;
  endDate: string | null;
  daysRemaining: number;
  subscription: Subscription | null;
}

export interface UserProfile {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  profile?: string;
  about_us?: string;
  role: 'user' | 'provider' | 'staff';
  permissions?: PermissionKey[];
  isAvailable?: boolean;
  document?: string[];
  status?: 'Pending' | 'Verified' | 'Suspended';
  address?: string;
  latitude?: number;
  longitude?: number;
  dob?: string;
  gender?: Gender;
  // Providers only: a cache of the live subscription, absent when on Free.
  plan_name?: string | null;
  plan_cycle?: BillingCycle | null;
  plan_expires_at?: string | null;
  planLabel?: string;
  subscription?: SubscriptionSummary;
}
