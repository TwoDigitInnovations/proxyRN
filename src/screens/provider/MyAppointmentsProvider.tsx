import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import moment from 'moment';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Text';
import { PageHeader } from '../../components/PageHeader';
import { AppointmentListItem } from '../../components/AppointmentListItem';
import {
  AppointmentFilters,
  appointmentFilterParams,
  emptyAppointmentFilters,
  hasActiveFilters,
  type AppointmentFilterState,
} from '../../components/AppointmentFilters';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { appointmentApi } from '../../api/endpoints';
import { usePaginatedList } from '../../hooks/usePaginatedList';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useAuth } from '../../context/AuthContext';
import { describeBookedBy } from '../../utils/bookedBy';
import { useUi } from '../../context/UiContext';
import { colors } from '../../theme/colors';
import type { Appointment } from '../../types/models';
import type { MyAppointmentsProviderStackParamList } from '../../navigation/types';

export default function MyAppointmentsProvider() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<MyAppointmentsProviderStackParamList>>();
  const { can, entitlements } = useAuth();
  const { showToast } = useUi();
  const canBook = can('appointments.book');
  const [filters, setFilters] = useState<AppointmentFilterState>(emptyAppointmentFilters);
  const { date, bookedBy } = filters;
  // Typing must not fire a request per keystroke; the other two apply at once.
  const search = useDebouncedValue(filters.search);
  const applied = useMemo(() => ({ search, date, bookedBy }), [search, date, bookedBy]);
  const filtered = hasActiveFilters(applied);

  const params = useMemo(() => appointmentFilterParams(applied), [applied]);

  function openBooking() {
    if (!entitlements.canWrite) {
      showToast(t(entitlements.lockKey('Renew your plan to book visitors in.')));
      return;
    }
    navigation.navigate('BookForVisitor');
  }

  const fetchPage = useCallback(
    async (page: number, limit: number) => {
      const res: any = await appointmentApi.getAppointmentByProvider({ page, limit, ...params });
      return (res?.data ?? []) as Appointment[];
    },
    [params],
  );

  const { items, loading, refreshing, hasMore, refresh, loadMore } = usePaginatedList<Appointment>(fetchPage);

  return (
    <View style={styles.flex}>
      <PageHeader
        title={t('Appointments')}
        right={
          canBook ? (
            <TouchableOpacity style={styles.bookButton} onPress={openBooking} activeOpacity={0.85}>
              <Icon name="calendar" size={14} color={colors.white} />
              <Text style={styles.bookButtonText}>{t('Book')}</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />
      {/* Kept outside the loading branch so the search box never loses focus. */}
      <AppointmentFilters value={filters} onChange={setFilters} />
      {loading ? (
        <ActivityIndicator style={styles.loading} size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item._id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.primary]} />}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListHeaderComponent={
            items.length > 0 ? (
              <Text style={styles.caption}>
                {t('Open a request to view visitor details and mark it completed.')}
              </Text>
            ) : undefined
          }
          ListFooterComponent={
            hasMore && items.length > 0 ? (
              <ActivityIndicator style={styles.footerLoader} color={colors.primary} />
            ) : undefined
          }
          ListEmptyComponent={
            filtered ? (
              <EmptyState
                icon="🔍"
                title={t('No matching appointments')}
                message={t('Try another date, another search or clear the filters.')}
              />
            ) : (
              <EmptyState
                icon="📅"
                title={t('No appointments yet')}
                message={t('New visitor requests will appear here as soon as they are booked.')}
              />
            )
          }
          renderItem={({ item }) => (
            <AppointmentListItem
              title={item.user?.name ?? item.name ?? t('Visitor')}
              subtitle={item.purpose_of_visit}
              dateLabel={moment(item.full_date).format('DD MMM YYYY, h:mm A')}
              meta={t('Booked by: {{who}}', { who: describeBookedBy(item, t) })}
              status={item.status}
              avatarUrl={item.user?.profile}
              onPress={() => navigation.navigate('MyAppointmentsDetailsProvider', { appointmentId: item._id })}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.white },
  loading: { flex: 1 },
  list: { paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1 },
  caption: { fontSize: 13, color: colors.gray, marginBottom: 14 },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryAlt,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  bookButtonText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  footerLoader: { marginVertical: 12 },
});
