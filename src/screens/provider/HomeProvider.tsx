import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Switch, View, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Text } from '../../components/Text';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import moment from 'moment';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/PageHeader';
import { AppointmentListItem } from '../../components/AppointmentListItem';
import { EmptyState } from '../../components/EmptyState';
import { PlanStatusNotice } from '../../components/PlanNotice';
import { appointmentApi, authApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useUi } from '../../context/UiContext';
import { colors } from '../../theme/colors';
import type { Appointment } from '../../types/models';
import type { ProviderTabParamList } from '../../navigation/types';

interface VisitorsStatus {
  totalAppoint: number;
  pendingAppoint: number;
  completedAppoint: number;
}

export default function HomeProvider() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<ProviderTabParamList>>();
  const { userDetail, updateUserDetail, entitlements } = useAuth();
  const { showToast } = useUi();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<VisitorsStatus | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isAvailable, setIsAvailable] = useState(userDetail?.isAvailable !== false);
  const [togglingAvailability, setTogglingAvailability] = useState(false);

  const load = useCallback(async () => {
    try {
      const [statusRes, appointmentsRes]: [any, any] = await Promise.all([
        appointmentApi.getVisitorsStatus(),
        appointmentApi.getAppointmentByProvider({ limit: 5, page: 1 }),
      ]);
      setStatus(statusRes?.data ?? null);
      setAppointments(appointmentsRes?.data ?? []);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t('Unable to load dashboard'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    load();
  }, [load]);

  function onRefresh() {
    setRefreshing(true);
    load();
  }

  async function toggleAvailability(value: boolean) {
    // Listing yourself as open for business is itself a paid action.
    if (!entitlements.canWrite) {
      showToast(t(entitlements.lockKey('Renew your plan to change your availability.')));
      return;
    }
    setIsAvailable(value);
    setTogglingAvailability(true);
    try {
      const formData = new FormData();
      formData.append('isAvailable', String(value));
      const res: any = await authApi.updateProfile(formData);
      if (res?.data && userDetail) {
        await updateUserDetail({ ...userDetail, ...res.data });
      }
    } catch (err) {
      setIsAvailable(!value);
      showToast(err instanceof ApiError ? err.message : t('Unable to update availability'));
    } finally {
      setTogglingAvailability(false);
    }
  }

  if (loading) {
    return <ActivityIndicator style={styles.loading} size="large" color={colors.primary} />;
  }

  return (
    <View style={styles.flex}>
      {userDetail?.status === 'Suspended' && (
        <View style={{ backgroundColor: '#ffebee', padding: 14, borderRadius: 10, marginHorizontal: 16, marginTop: 12, borderWidth: 1, borderColor: '#ef5350' }}>
          <Text style={{ color: '#c62828', fontWeight: 'bold', fontSize: 16 }}>{t('Account Suspended')}</Text>
          <Text style={{ color: '#d32f2f', fontSize: 13, marginTop: 4 }}>
            {t('Your account has been suspended by Admin. Please contact support.')}
          </Text>
        </View>
      )}
      {userDetail?.status === 'Pending' && (
        <View style={{ backgroundColor: '#fff3e0', padding: 14, borderRadius: 10, marginHorizontal: 16, marginTop: 12, borderWidth: 1, borderColor: '#ffb74d' }}>
          <Text style={{ color: '#e65100', fontWeight: 'bold', fontSize: 16 }}>{t('Verification Pending')}</Text>
          <Text style={{ color: '#ef6c00', fontSize: 13, marginTop: 4 }}>
            {t('Your account is under verification by Admin.')}
          </Text>
        </View>
      )}
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}>
        <PageHeader title={t('Hi, {{name}}', { name: userDetail?.name ?? t('Provider') })} />

        <PlanStatusNotice
          entitlements={entitlements}
          onViewPlans={() => navigation.navigate('SettingsProvider', { screen: 'ManagePlansProvider' })}
          style={styles.planNotice}
        />

        <View style={styles.availabilityRow}>
          <View>
            <Text style={styles.availabilityTitle}>{t('Accepting Appointments')}</Text>
            <Text style={styles.availabilitySubtitle}>{t('Show agency listing as available on map')}</Text>
          </View>
          <Switch
            value={isAvailable}
            onValueChange={toggleAvailability}
            disabled={togglingAvailability || !entitlements.canWrite}
            trackColor={{ true: colors.primaryAlt, false: '#D1D5DB' }}
          />
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: '#E8F0FE' }]}>
            <Text style={[styles.statValue, { color: '#1D4ED8' }]}>{status?.totalAppoint ?? 0}</Text>
            <Text style={styles.statLabel}>{t('Total Bookings')}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#FEF3C7' }]}>
            <Text style={[styles.statValue, { color: '#D97706' }]}>{status?.pendingAppoint ?? 0}</Text>
            <Text style={styles.statLabel}>{t('Pending')}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#DCFCE7' }]}>
            <Text style={[styles.statValue, { color: '#15803D' }]}>{status?.completedAppoint ?? 0}</Text>
            <Text style={styles.statLabel}>{t('Completed')}</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('Upcoming Appointments')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('MyAppointmentsProvider' as never)}>
            <Text style={styles.seeAll}>{t('See All ›')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.listWrap}>
          {appointments.length === 0 ? (
            <EmptyState message={t('No pending appointments.')} />
          ) : (
            appointments.map(item => (
              <AppointmentListItem
                key={item._id}
                title={item.user?.name ?? t('Visitor')}
                subtitle={item.purpose_of_visit}
                dateLabel={moment(item.full_date).format('DD MMM YYYY, h:mm A')}
                status={item.status}
                avatarUrl={item.user?.profile}
                onPress={() => navigation.navigate('MyAppointmentsProvider' as never)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F8F9FA' },
  loading: { flex: 1 },
  scroll: { paddingBottom: 40 },
  planNotice: { marginHorizontal: 16, marginBottom: 16 },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  availabilityTitle: { fontSize: 15, fontWeight: '700', color: colors.textDarker },
  availabilitySubtitle: { fontSize: 12, color: colors.gray, marginTop: 2 },
  statsRow: { flexDirection: 'row', marginHorizontal: 16, gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600', color: colors.textDark, marginTop: 4 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.textDarker },
  seeAll: { fontSize: 13, color: colors.primaryAlt, fontWeight: '700' },
  listWrap: { marginHorizontal: 16 },
});
