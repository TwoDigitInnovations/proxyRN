import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
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
import { appointmentApi } from '../../api/endpoints';
import { usePaginatedList } from '../../hooks/usePaginatedList';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useAuth } from '../../context/AuthContext';
import { describeBookedBy } from '../../utils/bookedBy';
import { colors } from '../../theme/colors';
import type { Appointment } from '../../types/models';

export default function HistoryProvider() {
  const { t } = useTranslation();
  // A staff login reads its parent provider's history, not its own id's.
  const { agencyId: providerId, entitlements } = useAuth();
  const [filters, setFilters] = useState<AppointmentFilterState>(emptyAppointmentFilters);
  const { date, bookedBy } = filters;
  // Typing must not fire a request per keystroke; the other two apply at once.
  const search = useDebouncedValue(filters.search);
  const applied = useMemo(() => ({ search, date, bookedBy }), [search, date, bookedBy]);
  const filtered = hasActiveFilters(applied);

  // How far back the plan lets the agency look. `null` means no cut-off.
  const retentionDays = entitlements.remaining('historyRetentionDays', 0);

  const params = useMemo(() => appointmentFilterParams(applied), [applied]);

  const fetchPage = useCallback(
    async (page: number, limit: number) => {
      if (!providerId) return [];
      const res: any = await appointmentApi.getHistoryByProviderId(providerId, { page, limit, ...params });
      return (res?.data ?? []) as Appointment[];
    },
    [providerId, params],
  );

  const { items, loading, refreshing, refresh, loadMore } = usePaginatedList<Appointment>(fetchPage);

  return (
    <View style={styles.flex}>
      <PageHeader title={t('History')} />
      {/* Kept outside the loading branch so the search box never loses focus. */}
      <AppointmentFilters value={filters} onChange={setFilters} />
      {loading ? (
        <ActivityIndicator style={styles.loading} size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item._id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.primary]} />}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListHeaderComponent={
            retentionDays !== null ? (
              <Text style={styles.caption}>
                {t('Your plan keeps {{days}} days of history.', { days: retentionDays })}
              </Text>
            ) : undefined
          }
          ListEmptyComponent={
            <EmptyState
              message={filtered ? t('No history matches these filters.') : t('No appointment history yet.')}
            />
          }
          renderItem={({ item }) => (
            <AppointmentListItem
              title={item.user?.name ?? item.name ?? t('Visitor')}
              subtitle={item.purpose_of_visit}
              dateLabel={moment(item.full_date).format('DD MMM YYYY, h:mm A')}
              meta={t('Booked by: {{who}}', { who: describeBookedBy(item, t) })}
              status={item.status}
              avatarUrl={item.user?.profile}
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
  list: { paddingHorizontal: 20, paddingBottom: 20, flexGrow: 1 },
  caption: { fontSize: 12, color: colors.grayLight, marginBottom: 14 },
});
