export type Gender = 'Male' | 'Female' | 'Other';

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
  paymentMethod?: 'Orange Money' | 'PayPal' | 'Stripe' | 'Credit Card';
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

export interface UserProfile {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  profile?: string;
  about_us?: string;
  company?: string;
  role: 'user' | 'provider' | 'staff';
  isAvailable?: boolean;
  document?: string[];
  status?: 'Pending' | 'Verified' | 'Suspended';
  address?: string;
  latitude?: number;
  longitude?: number;
  dob?: string;
  gender?: Gender;
}
