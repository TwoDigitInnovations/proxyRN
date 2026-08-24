import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SvgProps } from 'react-native-svg';
import HomeIcon from '../assets/tabsIcon/tabs-icon-1.svg';
import HomeIconSelected from '../assets/tabsIcon/tabs-icon-1selected.svg';
import AppointmentsIcon from '../assets/tabsIcon/tabs-icon-2.svg';
import AppointmentsIconSelected from '../assets/tabsIcon/tabs-icon-2selected.svg';
import HistoryIcon from '../assets/tabsIcon/tabs-icon-3.svg';
import HistoryIconSelected from '../assets/tabsIcon/tabs-icon-3selected.svg';
import SettingsIcon from '../assets/tabsIcon/tabs-icon-4.svg';
import SettingsIconSelected from '../assets/tabsIcon/tabs-icon-4selected.svg';
import HomeStaff from '../screens/staff/HomeStaff';
import SettingsStaff from '../screens/staff/SettingsStaff';
import HistoryProvider from '../screens/provider/HistoryProvider';
import { MyAppointmentsProviderStack } from './MyAppointmentsProviderStack';
import type { StaffTabParamList } from './types';
import { getTabBarStyle, tabBarLabelStyle, tabBarActiveTintColor, tabBarInactiveTintColor } from './tabBarStyle';

const Tab = createBottomTabNavigator<StaffTabParamList>();

const iconMap: Record<keyof StaffTabParamList, [React.FC<SvgProps>, React.FC<SvgProps>]> = {
  HomeStaff: [HomeIcon, HomeIconSelected],
  MyAppointmentsStaff: [AppointmentsIcon, AppointmentsIconSelected],
  HistoryStaff: [HistoryIcon, HistoryIconSelected],
  SettingsStaff: [SettingsIcon, SettingsIconSelected],
};

/**
 * The staff module. The appointment and history screens are the provider ones
 * reused as they are - the API already narrows every response to the services
 * this staff member was assigned, so there is nothing role-specific left in
 * them to fork.
 */
export function StaffTabs() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor,
        tabBarInactiveTintColor,
        tabBarStyle: getTabBarStyle(insets),
        tabBarLabelStyle,
        tabBarIcon: ({ focused, size }) => {
          const [Icon, IconSelected] = iconMap[route.name as keyof StaffTabParamList];
          const Component = focused ? IconSelected : Icon;
          return <Component width={size} height={size} />;
        },
      })}
    >
      <Tab.Screen name="HomeStaff" component={HomeStaff} options={{ title: t('Home') }} />
      <Tab.Screen
        name="MyAppointmentsStaff"
        component={MyAppointmentsProviderStack}
        options={{ title: t('Appointments') }}
      />
      <Tab.Screen name="HistoryStaff" component={HistoryProvider} options={{ title: t('History') }} />
      <Tab.Screen name="SettingsStaff" component={SettingsStaff} options={{ title: t('Settings') }} />
    </Tab.Navigator>
  );
}
