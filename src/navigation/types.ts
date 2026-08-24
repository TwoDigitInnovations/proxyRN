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
  MyAppointmentsProvider: undefined;
  HistoryProvider: undefined;
  SettingsProvider: undefined;
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
};

export type SettingsProviderStackParamList = {
  SettingsProvider: undefined;
  ProfileProvider: undefined;
  MyServiceProvider: undefined;
  MyStaffProvider: undefined;
};

export type StaffTabParamList = {
  HomeStaff: undefined;
  MyAppointmentsStaff: undefined;
  HistoryStaff: undefined;
  SettingsStaff: undefined;
};
