import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import moment from 'moment';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text } from '../../components/Text';
import { PrimaryButton } from '../../components/PrimaryButton';
import { Icon } from '../../components/Icon';
import { subscriptionApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { colors } from '../../theme/colors';
import type { Subscription } from '../../types/models';
import type { SettingsProviderStackParamList } from '../../navigation/types';

type NavigationProp = NativeStackNavigationProp<SettingsProviderStackParamList>;

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.receiptRow}>
      <Text style={styles.receiptLabel}>{label}</Text>
      <Text style={styles.receiptVal}>{value}</Text>
    </View>
  );
}

export default function SubscriptionSuccess() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp<SettingsProviderStackParamList, 'SubscriptionSuccess'>>();
  const { subscriptionId } = route.params;

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res: any = await subscriptionApi.getMySubscriptionHistory();
        const found = (res?.data ?? []).find((item: Subscription) => item._id === subscriptionId);
        if (mounted) setSubscription(found ?? null);
      } catch (err) {
        if (mounted) setError(err instanceof ApiError ? err.message : 'Something went wrong');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [subscriptionId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primaryAlt} />
        <Text style={styles.loadingText}>{t('Fetching subscription details...')}</Text>
      </View>
    );
  }

  if (error || !subscription) {
    return (
      <View style={styles.loadingContainer}>
        <Icon name="alert-triangle" size={40} color="#DC2626" />
        <Text style={styles.errorText}>{error ? t(error) : t('Subscription not found')}</Text>
        <PrimaryButton
          title={t('Back to Plans')}
          style={styles.errButton}
          onPress={() => navigation.navigate('ManagePlansProvider')}
        />
      </View>
    );
  }

  const currency = subscription.currency === 'USD' ? '$' : '';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <View style={styles.celebrationWrap}>
        <View style={styles.successOuterCircle}>
          <View style={styles.successInnerCircle}>
            <Icon name="crown" size={38} color="#B45309" />
          </View>
        </View>
        <Text style={styles.title}>{t('{{plan}} plan activated!', { plan: subscription.planName })}</Text>
        <Text style={styles.subtitle}>
          {t('Your agency is subscribed until {{date}}', {
            date: moment(subscription.endDate).format('DD MMM YYYY'),
          })}
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardBadgeLabel}>{t('SUBSCRIPTION')}</Text>
            <Text style={styles.cardPlanName}>{subscription.planName}</Text>
          </View>
          <View style={styles.statusChip}>
            <View style={styles.statusDot} />
            <Text style={styles.statusChipText}>{t(subscription.status)}</Text>
          </View>
        </View>

        <View style={styles.periodCard}>
          <View style={styles.periodCol}>
            <Icon name="calendar" size={14} color={colors.primaryAlt} />
            <Text style={styles.periodVal}>{moment(subscription.startDate).format('DD MMM YYYY')}</Text>
          </View>
          <View style={styles.periodDivider} />
          <View style={styles.periodCol}>
            <Icon name="clock" size={14} color={colors.primaryAlt} />
            <Text style={styles.periodVal}>{moment(subscription.endDate).format('DD MMM YYYY')}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('WHAT IS INCLUDED')}</Text>
          {subscription.features?.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <Icon name="check-circle" size={14} color={colors.success} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        <View style={styles.paymentSection}>
          <Text style={styles.sectionTitle}>{t('PAYMENT RECEIPT')}</Text>
          <ReceiptRow
            label={t('Billing Cycle')}
            value={t(subscription.billingCycle === 'yearly' ? 'Yearly' : 'Monthly')}
          />
          <ReceiptRow label={t('Payment Method')} value={subscription.paymentMethod || '—'} />
          <ReceiptRow
            label={t('Amount Paid')}
            value={`${currency}${Number(subscription.amount).toFixed(2)}`}
          />
          <ReceiptRow
            label={t('Transaction Reference')}
            value={subscription.transactionId || '—'}
          />
          <ReceiptRow
            label={t('Payment Status')}
            value={t(subscription.paymentStatus || 'Completed')}
          />
        </View>
      </View>

      <PrimaryButton
        title={t('Back to Plans')}
        style={styles.homeButton}
        onPress={() => navigation.navigate('ManagePlansProvider')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { padding: 20, alignItems: 'center', paddingBottom: 40 },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    padding: 20,
  },
  loadingText: { marginTop: 12, fontSize: 14, color: colors.gray, fontWeight: '500' },
  errorText: { color: colors.textDark, fontSize: 15, marginVertical: 16, textAlign: 'center' },
  errButton: { minWidth: 160, paddingHorizontal: 20 },

  celebrationWrap: { alignItems: 'center', marginTop: 10, marginBottom: 20 },
  successOuterCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  successInnerCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 21, fontWeight: '800', color: colors.textDarker, textAlign: 'center' },
  subtitle: { fontSize: 13, color: colors.gray, marginTop: 4, textAlign: 'center' },

  card: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardBadgeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryAlt,
    letterSpacing: 0.5,
  },
  cardPlanName: { fontSize: 18, fontWeight: '800', color: colors.textDarker, marginTop: 2 },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16A34A' },
  statusChipText: { fontSize: 11, fontWeight: '700', color: '#15803D' },

  periodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8F0',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#FFE8DA',
  },
  periodCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  periodDivider: { width: 1, height: 20, backgroundColor: '#FFE0CC' },
  periodVal: { fontSize: 13, fontWeight: '700', color: colors.textDarker },

  section: { marginTop: 18 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gray,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  featureText: { flex: 1, fontSize: 13, color: colors.textDark, lineHeight: 19 },

  paymentSection: {
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginTop: 18,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  receiptLabel: { fontSize: 12, color: colors.gray },
  receiptVal: { fontSize: 13, fontWeight: '700', color: colors.textDark },

  homeButton: { width: '100%', marginTop: 20 },
});
