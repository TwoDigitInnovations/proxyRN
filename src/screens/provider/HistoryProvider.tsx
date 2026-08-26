import React, { useCallback } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import moment from 'moment';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/PageHeader';
import { AppointmentListItem } from '../../components/AppointmentListItem';
import { EmptyState } from '../../components/EmptyState';
import { appointmentApi } from '../../api/endpoints';
import { usePaginatedList } from '../../hooks/usePaginatedList';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import type { Appointment } from '../../types/models';

export default function HistoryProvider() {
  const { t } = useTranslation();
  // A staff login reads its parent provider's history, not its own id's.
  const { agencyId: providerId } = useAuth();

  const fetchPage = useCallback(
    async (page: number, limit: number) => {
      if (!providerId) return [];
      const res: any = await appointmentApi.getHistoryByProviderId(providerId, { page, limit });
      return (res?.data ?? []) as Appointment[];
    },
    [providerId],
  );

  const { items, loading, refreshing, refresh, loadMore } = usePaginatedList<Appointment>(fetchPage);

  return (
    <View style={styles.flex}>
      <PageHeader title={t('History')} />
      {loading ? (
        <ActivityIndicator style={styles.loading} size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item._id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.primary]} />}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListEmptyComponent={<EmptyState message={t('No appointment history yet.')} />}
          renderItem={({ item }) => (
            <AppointmentListItem
              title={item.user?.name ?? t('Visitor')}
              subtitle={item.purpose_of_visit}
              dateLabel={moment(item.full_date).format('DD MMM YYYY, h:mm A')}
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
  list: { padding: 20, flexGrow: 1 },
});
