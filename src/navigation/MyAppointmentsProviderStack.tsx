import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import MyAppointmentsProvider from '../screens/provider/MyAppointmentsProvider';
import MyAppointmentsDetailsProvider from '../screens/provider/MyAppointmentsDetailsProvider';
import BookForVisitorProvider from '../screens/provider/BookForVisitorProvider';
import type { MyAppointmentsProviderStackParamList } from './types';

const Stack = createNativeStackNavigator<MyAppointmentsProviderStackParamList>();

export function MyAppointmentsProviderStack() {
  const { t } = useTranslation();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MyAppointmentsProvider" component={MyAppointmentsProvider} />
      <Stack.Screen
        name="MyAppointmentsDetailsProvider"
        component={MyAppointmentsDetailsProvider}
        options={{ headerShown: true, title: t('Appointment Details') }}
      />
      <Stack.Screen
        name="BookForVisitor"
        component={BookForVisitorProvider}
        options={{ headerShown: true, title: t('Book for a Visitor') }}
      />
    </Stack.Navigator>
  );
}
