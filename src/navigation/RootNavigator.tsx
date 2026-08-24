import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { UserTabs } from './UserTabs';
import { ProviderTabs } from './ProviderTabs';
import { StaffTabs } from './StaffTabs';
import SignIn from '../screens/auth/SignIn';
import SignUp from '../screens/auth/SignUp';
import ForgotPassword from '../screens/auth/ForgotPassword';
import PaymentSuccess from '../screens/user/PaymentSuccess';
import PrivacyPolicy from '../screens/user/PrivacyPolicy';
import TermsAndConditions from '../screens/user/TermsAndConditions';
import ReportProblem from '../screens/user/ReportProblem';
import ProviderReviews from '../screens/common/ProviderReviews';
import type { RootStackParamList } from './types';
import { colors } from '../theme/colors';

const Stack = createNativeStackNavigator<RootStackParamList>();

function RoleTabs() {
  const { userDetail } = useAuth();
  if (userDetail?.role === 'provider') return <ProviderTabs />;
  if (userDetail?.role === 'staff') return <StaffTabs />;
  return <UserTabs />;
}

export function RootNavigator() {
  const { t } = useTranslation();
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!token ? (
          <>
            <Stack.Screen name="SignIn" component={SignIn} />
            <Stack.Screen name="SignUp" component={SignUp} />
            <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
          </>
        ) : (
          <>
            <Stack.Screen name="Tabs" component={RoleTabs} />
            <Stack.Screen
              name="PaymentSuccess"
              component={PaymentSuccess}
              options={{ headerShown: true, title: t('Confirmation') }}
            />
          </>
        )}
        <Stack.Screen
          name="PrivacyPolicy"
          component={PrivacyPolicy}
          options={{ headerShown: true, title: t('Privacy Policy') }}
        />
        <Stack.Screen
          name="TermsAndConditions"
          component={TermsAndConditions}
          options={{ headerShown: true, title: t('Terms & Conditions') }}
        />
        <Stack.Screen
          name="ReportProblem"
          component={ReportProblem}
          options={{ headerShown: true, title: t('Report a Problem') }}
        />
        <Stack.Screen
          name="ProviderReviews"
          component={ProviderReviews}
          options={{ headerShown: true, title: t('Reviews & Ratings') }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
});
