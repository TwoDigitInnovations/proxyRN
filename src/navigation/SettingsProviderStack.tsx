import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import SettingsProvider from '../screens/provider/SettingsProvider';
import ProfileProvider from '../screens/provider/ProfileProvider';
import MyServiceProvider from '../screens/provider/MyServiceProvider';
import MyStaffProvider from '../screens/provider/MyStaffProvider';
import ManagePlansProvider from '../screens/provider/ManagePlansProvider';
import SubscriptionSuccess from '../screens/provider/SubscriptionSuccess';
import type { SettingsProviderStackParamList } from './types';

const Stack = createNativeStackNavigator<SettingsProviderStackParamList>();

export function SettingsProviderStack() {
  const { t } = useTranslation();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SettingsProvider" component={SettingsProvider} />
      <Stack.Screen
        name="ProfileProvider"
        component={ProfileProvider}
        options={{ headerShown: true, title: t('Profile') }}
      />
      <Stack.Screen
        name="MyServiceProvider"
        component={MyServiceProvider}
        options={{ headerShown: true, title: t('My Service') }}
      />
      <Stack.Screen
        name="MyStaffProvider"
        component={MyStaffProvider}
        options={{ headerShown: true, title: t('My Staff') }}
      />
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
    </Stack.Navigator>
  );
}
