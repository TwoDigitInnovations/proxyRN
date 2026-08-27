import type { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  Tabs: undefined;
  PaymentSuccess: { appointmentId: string };
  PrivacyPolicy: undefined;
  TermsAndConditions: undefined;
  ReportProblem: undefined;
  ProviderReviews: { providerId?: string; providerName?: string } | undefined;
};

export type UserTabParamList = {
  Home: undefined;
  MyAppointments: undefined;
  History: undefined;
  Settings: undefined;
};

export type ProviderTabParamList = {
  HomeProvider: undefined;
  MyAppointmentsProvider: NavigatorScreenParams<MyAppointmentsProviderStackParamList> | undefined;
  HistoryProvider: undefined;
  SettingsProvider: NavigatorScreenParams<SettingsProviderStackParamList> | undefined;
};

export type MyAppointmentsStackParamList = {
  MyAppointments: undefined;
  MyAppointmentsDetails: { appointmentId: string };
  PurposeOfVisit: { appointmentId: string };
};

export type SettingsStackParamList = {
  Settings: undefined;
  Profile: undefined;
};

export type MyAppointmentsProviderStackParamList = {
  MyAppointmentsProvider: undefined;
  MyAppointmentsDetailsProvider: { appointmentId: string };
  BookForVisitor: undefined;
};

export type SettingsProviderStackParamList = {
  SettingsProvider: undefined;
  ProfileProvider: undefined;
  MyServiceProvider: undefined;
  MyStaffProvider: undefined;
  ManagePlansProvider: undefined;
  SubscriptionSuccess: { subscriptionId: string };
};

export type StaffTabParamList = {
  HomeStaff: undefined;
  MyAppointmentsStaff: NavigatorScreenParams<MyAppointmentsProviderStackParamList> | undefined;
  HistoryStaff: undefined;
  SettingsStaff: NavigatorScreenParams<SettingsStaffStackParamList> | undefined;
};

export type SettingsStaffStackParamList = {
  SettingsStaff: undefined;
  ProfileProvider: undefined;
  MyServiceProvider: undefined;
  MyStaffProvider: undefined;
  ManagePlansProvider: undefined;
  SubscriptionSuccess: { subscriptionId: string };
};
