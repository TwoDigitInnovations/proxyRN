import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import SettingsStaff from '../screens/staff/SettingsStaff';
import ProfileProvider from '../screens/provider/ProfileProvider';
import MyServiceProvider from '../screens/provider/MyServiceProvider';
import MyStaffProvider from '../screens/provider/MyStaffProvider';
import ManagePlansProvider from '../screens/provider/ManagePlansProvider';
import SubscriptionSuccess from '../screens/provider/SubscriptionSuccess';
import { useAuth } from '../context/AuthContext';
import type { SettingsStaffStackParamList } from './types';

const Stack = createNativeStackNavigator<SettingsStaffStackParamList>();

/**
 * Everything a staff member reaches from their Settings tab.
 */
export function SettingsStaffStack() {
  const { t } = useTranslation();
  const { can } = useAuth();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SettingsStaff" component={SettingsStaff} />
      {can('profile.manage') ? (
        <Stack.Screen
          name="ProfileProvider"
          component={ProfileProvider}
          options={{ headerShown: true, title: t('Profile') }}
        />
      ) : null}
      {can('services.view') ? (
        <Stack.Screen
          name="MyServiceProvider"
          component={MyServiceProvider}
          options={{ headerShown: true, title: t('My Service') }}
        />
      ) : null}
      {can('staff.manage') ? (
        <Stack.Screen
          name="MyStaffProvider"
          component={MyStaffProvider}
          options={{ headerShown: true, title: t('My Staff') }}
        />
      ) : null}
      {can('subscription.view') ? (
        <>
          <Stack.Screen
            name="ManagePlansProvider"
            component={ManagePlansProvider}
            options={{ headerShown: true, title: t('Plans & Subscriptions') }}
          />
          <Stack.Screen
            name="SubscriptionSuccess"
            component={SubscriptionSuccess}
            options={{ headerShown: true, title: t('Subscription') }}
          />
        </>
      ) : null}
    </Stack.Navigator>
  );
}
