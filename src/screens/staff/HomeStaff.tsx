import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import moment from 'moment';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Text';
import { PageHeader } from '../../components/PageHeader';
import { AppointmentListItem } from '../../components/AppointmentListItem';
import { EmptyState } from '../../components/EmptyState';
import { PlanStatusNotice } from '../../components/PlanNotice';
import { Icon } from '../../components/Icon';
import { appointmentApi, staffApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useUi } from '../../context/UiContext';
import { colors } from '../../theme/colors';
import type { Appointment, StaffServiceQueue } from '../../types/models';
import type { StaffTabParamList } from '../../navigation/types';

interface VisitorsStatus {
  totalAppoint: number;
  pendingAppoint: number;
  completedAppoint: number;
}

interface ProviderSummary {
  name?: string;
}

/**
 * A staff member's dashboard. Everything here is already scoped by the API to
 * the services their provider assigned, so the screen simply renders what
 * comes back - one card per assigned service, plus that same scope's visitors.
 */
export default function HomeStaff() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<StaffTabParamList>>();
  const { userDetail, can, entitlements } = useAuth();
  const { showToast } = useUi();
  const canSeeAppointments = can('appointments.view');
  const canBook = can('appointments.book');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [services, setServices] = useState<StaffServiceQueue[]>([]);
  const [provider, setProvider] = useState<ProviderSummary | null>(null);
  const [status, setStatus] = useState<VisitorsStatus | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const load = useCallback(async () => {
    try {
      const [servicesRes, statusRes, appointmentsRes]: [any, any, any] = await Promise.all([
        staffApi.getMyServices(),
        appointmentApi.getVisitorsStatus(),
        canSeeAppointments
          ? appointmentApi.getAppointmentByProvider({ limit: 5, page: 1 })
          : Promise.resolve(null),
      ]);
      setServices(servicesRes?.data?.services ?? []);
      setProvider(servicesRes?.data?.provider ?? null);
      setStatus(statusRes?.data ?? null);
      setAppointments(appointmentsRes?.data ?? []);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t('Unable to load dashboard'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canSeeAppointments, showToast, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function onRefresh() {
    setRefreshing(true);
    load();
  }

  function openBooking() {
    if (!entitlements.canWrite) {
      showToast(t(entitlements.lockKey('Renew your plan to book visitors in.')));
      return;
    }
    navigation.navigate('MyAppointmentsStaff', { screen: 'BookForVisitor' });
  }

  if (loading) {
    return <ActivityIndicator style={styles.loading} size="large" color={colors.primary} />;
  }

  const agencyName = provider?.name;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}>
      <PageHeader title={t('Hi, {{name}}', { name: userDetail?.name ?? t('Staff') })} />

      <PlanStatusNotice
        entitlements={entitlements}
        onViewPlans={
          can('subscription.view')
            ? () => navigation.navigate('SettingsStaff', { screen: 'ManagePlansProvider' })
            : undefined
        }
        style={styles.planNotice}
      />

      <View style={styles.agencyRow}>
        <Text style={styles.agencyLabel}>{t('Staff account')}</Text>
        <Text style={styles.agencyName}>
          {agencyName ? t('Working for {{agency}}', { agency: agencyName }) : t('Working for your agency')}
        </Text>
      </View>

      {canBook ? (
        <TouchableOpacity style={styles.bookRow} onPress={openBooking} activeOpacity={0.85}>
          <View style={styles.bookIconCircle}>
            <Icon name="calendar" size={18} color={colors.white} />
          </View>
          <View style={styles.bookTextWrap}>
            <Text style={styles.bookTitle}>{t('Book for a Visitor')}</Text>
            <Text style={styles.bookSubtitle}>
              {t('Raise a queue ticket for someone at your counter')}
            </Text>
          </View>
          <Icon name="chevron-right" size={16} color={colors.gray} />
        </TouchableOpacity>
      ) : null}

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
        <Text style={styles.sectionTitle}>{t('My Assigned Services')}</Text>
        <Text style={styles.sectionCount}>{services.length}</Text>
      </View>

      <View style={styles.listWrap}>
        {services.length === 0 ? (
          <EmptyState message={t('No services assigned to you yet. Ask your provider to assign one.')} />
        ) : (
          services.map(service => (
            <View key={service._id} style={styles.serviceCard}>
              <View style={styles.serviceHeader}>
                <Text style={styles.serviceName}>{service.service_name}</Text>
                <View style={styles.crowdBadge}>
                  <Text style={styles.crowdBadgeText}>{t(service.crowdLevel ?? 'Low')}</Text>
                </View>
              </View>
              {service.address ? (
                <Text style={styles.serviceAddress} numberOfLines={1}>
                  📍 {service.address}
                </Text>
              ) : null}
              <View style={styles.queueRow}>
                <View style={styles.queueStat}>
                  <Text style={styles.queueValue}>{service.waitingCount ?? 0}</Text>
                  <Text style={styles.queueLabel}>{t('Waiting')}</Text>
                </View>
                <View style={styles.queueStat}>
                  <Text style={styles.queueValue}>{service.nowServing ?? '—'}</Text>
                  <Text style={styles.queueLabel}>{t('Now Serving')}</Text>
                </View>
                <View style={styles.queueStat}>
                  <Text style={styles.queueValue}>{t('{{minutes}} min', { minutes: service.estimatedWaitMinutes ?? 0 })}</Text>
                  <Text style={styles.queueLabel}>{t('Est. Wait')}</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>

      {canSeeAppointments ? (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('Upcoming Appointments')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('MyAppointmentsStaff' as never)}>
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
                  title={item.user?.name ?? item.name ?? t('Visitor')}
                  subtitle={item.purpose_of_visit}
                  dateLabel={moment(item.full_date).format('DD MMM YYYY, h:mm A')}
                  status={item.status}
                  avatarUrl={item.user?.profile}
                  onPress={() => navigation.navigate('MyAppointmentsStaff' as never)}
                />
              ))
            )}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F8F9FA' },
  loading: { flex: 1 },
  scroll: { paddingBottom: 40 },
  planNotice: { marginHorizontal: 16, marginBottom: 16 },
  agencyRow: {
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  agencyLabel: { fontSize: 11, fontWeight: '700', color: '#A0A0A0', letterSpacing: 0.8 },
  agencyName: { fontSize: 15, fontWeight: '700', color: colors.textDarker, marginTop: 4 },
  bookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  bookIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primaryAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookTextWrap: { flex: 1 },
  bookTitle: { fontSize: 15, fontWeight: '700', color: colors.textDarker },
  bookSubtitle: { fontSize: 12, color: colors.gray, marginTop: 2 },
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
  sectionCount: { fontSize: 13, fontWeight: '700', color: colors.primaryAlt },
  seeAll: { fontSize: 13, color: colors.primaryAlt, fontWeight: '700' },
  listWrap: { marginHorizontal: 16, marginBottom: 20 },
  serviceCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    padding: 16,
    marginBottom: 12,
  },
  serviceHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  serviceName: { fontSize: 16, fontWeight: '700', color: colors.textDarker, flex: 1 },
  crowdBadge: { backgroundColor: colors.backgroundLight, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  crowdBadgeText: { fontSize: 11, fontWeight: '600', color: colors.primary },
  serviceAddress: { fontSize: 12, color: colors.gray, marginTop: 6 },
  queueRow: { flexDirection: 'row', marginTop: 14, gap: 10 },
  queueStat: { flex: 1, alignItems: 'center', backgroundColor: '#F8F9FA', borderRadius: 10, paddingVertical: 10 },
  queueValue: { fontSize: 16, fontWeight: '700', color: colors.textDarker },
  queueLabel: { fontSize: 11, color: colors.gray, marginTop: 2 },
});
