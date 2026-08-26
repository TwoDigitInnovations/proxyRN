import { apiClient } from './client';
import type { PermissionKey } from '../utils/permissions';

export type UserRole = 'user' | 'provider' | 'staff';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  document?: string[];
}

export const authApi = {
  login: (data: LoginPayload) => apiClient.post('auth/login', data),
  register: (data: RegisterPayload) => apiClient.post('auth/register', data),
  sendOTPForSignUp: (data: { email: string }) => apiClient.post('sendOTPForSignUp', data),
  sendOTP: (data: { email: string }) => apiClient.post('auth/sendOTP', data),
  verifyOTP: (data: { otp: string; token: string }) => apiClient.post('auth/verifyOTP', data),
  changePassword: (data: { password: string; token: string }) => apiClient.post('auth/changePassword', data),
  fileUpload: (data: FormData) => apiClient.post('auth/user/fileupload', data),
  getProfile: () => apiClient.get('auth/getProfile'),
  updateProfile: (data: FormData) => apiClient.post('auth/updateProfile', data),
};

export const categoryApi = {
  getCategory: () => apiClient.get('category/getCategory'),
};

export interface NearMeServicePayload {
  category: string;
  location: [number, number];
}

export const serviceApi = {
  nearMeServicebyCategory: (data: NearMeServicePayload) =>
    apiClient.post('service/nearMeServicebyCategory', data),
  createService: (data: FormData) => apiClient.post('service/createService', data),
  getService: () => apiClient.get('service/getService'),
  updateService: (data: FormData) => apiClient.post('service/updateService', data),
  deleteService: (id: string) => apiClient.delete(`service/deleteService/${id}`),
};

export interface CreateAppointmentPayload {
  name: string;
  email: string;
  phone: string;
  gender: string;
  purpose_of_visit: string;
  date: string;
  time: string;
  service: string;
  full_date: string;
  service_provider: string;
  service_ref: string;
  paymentMethod?: string;
  paymentAmount?: number;
  transactionId?: string;
  paymentStatus?: string;
}

export interface PageParams {
  limit: number;
  page: number;
}

export const appointmentApi = {
  createAppointment: (data: CreateAppointmentPayload) =>
    apiClient.post('appointment/createAppointment', data),
  getRequestAppointmentById: (id: string) =>
    apiClient.get(`appointment/getRequestAppointmentById/${id}`),
  getAppointmentByUser: (params: PageParams) =>
    apiClient.get('appointment/getAppointmentByUser', params),
  getAppointmentByProvider: (params: PageParams) =>
    apiClient.get('appointment/getAppointmentByProvider', params),
  getRequestAppointmentByProviderId: (id: string) =>
    apiClient.get(`appointment/getRequestAppointmentByProviderId/${id}`),
  updateAppointmentStatusByProvider: (data: { status: string; id: string }) =>
    apiClient.post('appointment/updateAppointmentStatusByProvider', data),
  getHistoryByUserId: (id: string, params: PageParams) =>
    apiClient.get(`appointment/getHistoryByUserId/${id}`, params),
  getHistoryByProviderId: (id: string, params: PageParams) =>
    apiClient.get(`appointment/getHistoryByProviderId/${id}`, params),
  getVisitorsStatus: () => apiClient.get('appointment/getVisitorsStatus'),
  getAvailableSlots: (serviceId: string, params?: { date?: string }) =>
    apiClient.get(`appointment/getAvailableSlots/${serviceId}`, params),
};

export interface CreateReviewPayload {
  appointment: string;
  rating: number;
  message?: string;
}

export const reviewApi = {
  createReview: (data: CreateReviewPayload) => apiClient.post('review/createReview', data),
  getReviewByAppointment: (id: string) => apiClient.get(`review/getReviewByAppointment/${id}`),
  getReviewsByProvider: (id: string, params: PageParams) =>
    apiClient.get(`review/getReviewsByProvider/${id}`, params),
  getProviderRatingSummary: (id: string) => apiClient.get(`review/getProviderRatingSummary/${id}`),
  getMyRatingSummary: () => apiClient.get('review/getMyRatingSummary'),
};

export interface StaffPayload {
  name: string;
  email: string;
  password?: string;
  phone?: string;
  assigned_services: string[];
  permissions?: PermissionKey[];
}

export const staffApi = {
  getStaff: () => apiClient.get('staff/getStaff'),
  createStaff: (data: StaffPayload) => apiClient.post('staff/createStaff', data),
  updateStaff: (data: StaffPayload & { id: string; isActive?: boolean }) =>
    apiClient.post('staff/updateStaff', data),
  deleteStaff: (id: string) => apiClient.delete(`staff/deleteStaff/${id}`),
  getMyServices: (params?: { date?: string }) => apiClient.get('staff/getMyServices', params),
};

export interface SubscribePayload {
  planId: string;
  billingCycle: 'monthly' | 'yearly';
  paymentMethod: string;
  paymentAmount: number;
  transactionId: string;
  paymentStatus?: string;
}

export const subscriptionApi = {
  getPlans: () => apiClient.get('subscription/getPlans'),
  getMySubscription: () => apiClient.get('subscription/getMySubscription'),
  getMySubscriptionHistory: () => apiClient.get('subscription/getMySubscriptionHistory'),
  subscribe: (data: SubscribePayload) => apiClient.post('subscription/subscribe', data),
  cancelSubscription: () => apiClient.post('subscription/cancelSubscription', {}),
};

export const contentApi = {
  getContent: () => apiClient.get('content/getContent'),
};

export interface CreateReportPayload {
  category: string;
  subject: string;
  description: string;
}

export const reportApi = {
  createReport: (data: CreateReportPayload) => apiClient.post('report/create', data),
};
