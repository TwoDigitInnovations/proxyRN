import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, StyleSheet, View } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import moment from 'moment';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Text';
import { EmptyState } from '../../components/EmptyState';
import { StarRating } from '../../components/StarRating';
import { Icon } from '../../components/Icon';
import { reviewApi } from '../../api/endpoints';
import { usePaginatedList } from '../../hooks/usePaginatedList';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import type { RatingSummary, Review, ServiceProviderUser } from '../../types/models';
import type { RootStackParamList } from '../../navigation/types';

const EMPTY_SUMMARY: RatingSummary = {
  averageRating: 0,
  totalReviews: 0,
  breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

const STAR_LEVELS = ['5', '4', '3', '2', '1'] as const;

function reviewerOf(review: Review): ServiceProviderUser | null {
  return review.user && typeof review.user === 'object' ? review.user : null;
}

function SummaryHeader({ summary, providerName }: { summary: RatingSummary; providerName?: string }) {
  const { t } = useTranslation();
  const total = summary.totalReviews;

  return (
    <View style={styles.summaryCard}>
      {providerName ? <Text style={styles.providerName}>{providerName}</Text> : null}

      <View style={styles.summaryTop}>
        <View style={styles.scoreBlock}>
          <Text style={styles.scoreValue}>{summary.averageRating.toFixed(1)}</Text>
          <StarRating rating={summary.averageRating} size={16} />
          <Text style={styles.scoreCount}>
            {total === 1 ? t('1 review') : t('{{total}} reviews', { total })}
          </Text>
        </View>

        <View style={styles.breakdownBlock}>
          {STAR_LEVELS.map(level => {
            const count = summary.breakdown?.[level] ?? 0;
            const ratio = total > 0 ? count / total : 0;
            return (
              <View key={level} style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{level}</Text>
                <Icon name="star" size={11} color={colors.star} />
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.round(ratio * 100)}%` }]} />
                </View>
                <Text style={styles.breakdownCount}>{count}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function ProviderReviews() {
  const { t } = useTranslation();
  const route = useRoute<RouteProp<RootStackParamList, 'ProviderReviews'>>();
  const { agencyId } = useAuth();
  const providerId = route.params?.providerId ?? agencyId ?? '';
  const providerName = route.params?.providerName;

  const [summary, setSummary] = useState<RatingSummary>(EMPTY_SUMMARY);

  const fetchPage = useCallback(
    async (page: number, limit: number) => {
      if (!providerId) return [];
      const res: any = await reviewApi.getReviewsByProvider(providerId, { page, limit });
      if (res?.summary) setSummary(res.summary as RatingSummary);
      return (res?.data ?? []) as Review[];
    },
    [providerId],
  );

  const { items, loading, refreshing, refresh, loadMore } = usePaginatedList<Review>(fetchPage);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.flex}
      data={items}
      keyExtractor={item => item._id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.primary]} />}
      onEndReachedThreshold={0.4}
      onEndReached={loadMore}
      ListHeaderComponent={<SummaryHeader summary={summary} providerName={providerName} />}
      ListEmptyComponent={
        <EmptyState icon="⭐" title={t('No reviews yet')} message={t('Reviews appear here once visitors rate a completed appointment.')} />
      }
      renderItem={({ item }) => {
        const reviewer = reviewerOf(item);
        const name = reviewer?.name ?? t('Visitor');
        return (
          <View style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              {reviewer?.profile ? (
                <Image source={{ uri: reviewer.profile }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarInitial}>{name.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.reviewHeaderBody}>
                <Text style={styles.reviewerName} numberOfLines={1}>
                  {name}
                </Text>
                <StarRating rating={item.rating} size={13} style={styles.reviewStars} />
              </View>
              <Text style={styles.reviewDate}>{moment(item.createdAt).format('DD MMM YYYY')}</Text>
            </View>

            {item.message ? <Text style={styles.reviewMessage}>{item.message}</Text> : null}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F8F9FA' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F9FA' },
  list: { padding: 16, paddingBottom: 40, flexGrow: 1 },

  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  providerName: { fontSize: 16, fontWeight: '700', color: colors.textDarker, marginBottom: 14 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  scoreBlock: { alignItems: 'center', gap: 6, minWidth: 92 },
  scoreValue: { fontSize: 38, fontWeight: '700', color: colors.textDarker, lineHeight: 42 },
  scoreCount: { fontSize: 12, color: colors.gray },
  breakdownBlock: { flex: 1, gap: 6 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  breakdownLabel: { fontSize: 11, color: colors.grayAlt, width: 8, textAlign: 'right' },
  barTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#F0F0F0', overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.star },
  breakdownCount: { fontSize: 11, color: colors.grayAlt, minWidth: 18, textAlign: 'right' },

  reviewCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: { backgroundColor: colors.backgroundLight, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  reviewHeaderBody: { flex: 1 },
  reviewerName: { fontSize: 14, fontWeight: '600', color: colors.textDarker },
  reviewStars: { marginTop: 4 },
  reviewDate: { fontSize: 11, color: colors.grayLight },
  reviewMessage: { fontSize: 13, lineHeight: 20, color: colors.textDark, marginTop: 12 },
});
