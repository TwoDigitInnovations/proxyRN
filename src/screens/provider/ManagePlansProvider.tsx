import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import moment from 'moment';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text } from '../../components/Text';
import { TextField } from '../../components/TextField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { Icon, type IconName } from '../../components/Icon';
import { subscriptionApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useUi } from '../../context/UiContext';
import { colors } from '../../theme/colors';
import {
  CARD_NUMBER_DIGITS,
  CVV_MAX,
  sanitizeCardNumber,
  sanitizeCvv,
  sanitizeEmail,
  sanitizeExpiry,
  sanitizePhone,
  validateCardNumber,
  validateCvv,
  validateEmail,
  validateExpiry,
  validatePhone,
} from '../../utils/validation';
import type {
  BillingCycle,
  PaymentMethod,
  Plan,
  Subscription,
  SubscriptionSummary,
} from '../../types/models';
import type { SettingsProviderStackParamList } from '../../navigation/types';

type NavigationProp = NativeStackNavigationProp<SettingsProviderStackParamList>;

/** The same four methods a visitor sees when paying for a queue ticket. */
const PAYMENT_METHODS: { key: PaymentMethod; iconName: IconName; color: string; bg: string }[] = [
  { key: 'Orange Money', iconName: 'smartphone', color: '#EA580C', bg: '#FFF3E0' },
  { key: 'Credit Card', iconName: 'credit-card', color: '#1D4ED8', bg: '#E8F0FE' },
  { key: 'PayPal', iconName: 'dollar', color: '#003087', bg: '#E8F0FE' },
  { key: 'Stripe', iconName: 'zap', color: '#7C3AED', bg: '#F3E8FF' },
];

function priceFor(plan: Plan, cycle: BillingCycle) {
  return cycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
}

function durationFor(plan: Plan, cycle: BillingCycle) {
  return cycle === 'yearly' ? plan.yearlyDurationDays : plan.monthlyDurationDays;
}

/** How much a year up front saves against twelve monthly payments, in percent. */
function yearlySavingPercent(plan: Plan) {
  const twelveMonths = plan.monthlyPrice * 12;
  if (twelveMonths <= 0 || plan.yearlyPrice >= twelveMonths) return 0;
  return Math.round(((twelveMonths - plan.yearlyPrice) / twelveMonths) * 100);
}

export default function ManagePlansProvider() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { userDetail, updateUserDetail, can } = useAuth();
  const canManage = can('subscription.manage');
  const { showLoading, hideLoading, showToast } = useUi();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [summary, setSummary] = useState<SubscriptionSummary | null>(null);
  const [history, setHistory] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<BillingCycle>('monthly');

  // Checkout sheet
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('Orange Money');
  const [accountNumber, setAccountNumber] = useState('');
  const [paypalEmail, setPaypalEmail] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paySubmitted, setPaySubmitted] = useState(false);

  const load = useCallback(async () => {
    try {
      const [plansRes, mineRes, historyRes]: any[] = await Promise.all([
        subscriptionApi.getPlans(),
        subscriptionApi.getMySubscription(),
        subscriptionApi.getMySubscriptionHistory(),
      ]);
      setPlans(plansRes?.data ?? []);
      setSummary(mineRes?.data ?? null);
      setHistory(historyRes?.data ?? []);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t('Something went wrong'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  /** Keeps the plan badge on the settings and profile screens in step. */
  const cacheOnUser = useCallback(
    async (next: SubscriptionSummary | null) => {
      if (!userDetail) return;
      await updateUserDetail({
        ...userDetail,
        plan_name: next?.subscription?.planName ?? null,
        plan_cycle: next?.billingCycle ?? null,
        plan_expires_at: next?.endDate ?? null,
        planLabel: next?.planLabel ?? 'Free',
      });
    },
    [userDetail, updateUserDetail],
  );

  function openCheckout(plan: Plan) {
    setCheckoutPlan(plan);
    setPaymentError(null);
    setPaySubmitted(false);
  }

  function closeCheckout() {
    setCheckoutPlan(null);
    setPaymentError(null);
    setPaySubmitted(false);
    setAccountNumber('');
    setPaypalEmail('');
    setCardNumber('');
    setCardExpiry('');
    setCardCvv('');
  }

  /** First failing rule for the currently selected payment method. */
  function paymentMethodError(): string | undefined {
    if (selectedMethod === 'Orange Money') {
      return validatePhone(accountNumber, 'Mobile/Account Number is required.');
    }
    if (selectedMethod === 'PayPal') {
      return validateEmail(paypalEmail, 'PayPal Email is required.');
    }
    return validateCardNumber(cardNumber) || validateExpiry(cardExpiry) || validateCvv(cardCvv);
  }

  async function onSubmitPayment() {
    if (!checkoutPlan) return;

    setPaySubmitted(true);
    const methodError = paymentMethodError();
    if (methodError) {
      setPaymentError(t(methodError));
      return;
    }
    setPaymentError(null);

    const amount = priceFor(checkoutPlan, cycle);
    const txnId = `TXN-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    showLoading();
    try {
      const res: any = await subscriptionApi.subscribe({
        planId: checkoutPlan._id,
        billingCycle: cycle,
        paymentMethod: selectedMethod,
        paymentAmount: amount,
        transactionId: txnId,
        paymentStatus: 'Completed',
      });

      const subscriptionId = res?.data?._id;
      closeCheckout();

      const mineRes: any = await subscriptionApi.getMySubscription();
      const next: SubscriptionSummary | null = mineRes?.data ?? null;
      setSummary(next);
      await cacheOnUser(next);

      if (subscriptionId) {
        navigation.navigate('SubscriptionSuccess', { subscriptionId });
      }
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t('Something went wrong'));
    } finally {
      hideLoading();
    }
  }

  function confirmCancel() {
    Alert.alert(
      t('Cancel Subscription'),
      t('Your agency will go back to the Free plan straight away. Continue?'),
      [
        { text: t('Keep Plan'), style: 'cancel' },
        {
          text: t('Cancel Subscription'),
          style: 'destructive',
          onPress: async () => {
            showLoading();
            try {
              await subscriptionApi.cancelSubscription();
              const mineRes: any = await subscriptionApi.getMySubscription();
              const next: SubscriptionSummary | null = mineRes?.data ?? null;
              setSummary(next);
              await cacheOnUser(next);
              showToast(t('Subscription cancelled'));
              load();
            } catch (err) {
              showToast(err instanceof ApiError ? err.message : t('Something went wrong'));
            } finally {
              hideLoading();
            }
          },
        },
      ],
    );
  }

  const accountNumberError = paySubmitted
    ? validatePhone(accountNumber, 'Mobile/Account Number is required.')
    : undefined;
  const paypalEmailError = paySubmitted
    ? validateEmail(paypalEmail, 'PayPal Email is required.')
    : undefined;
  const cardNumberError = paySubmitted ? validateCardNumber(cardNumber) : undefined;
  const cardExpiryError = paySubmitted ? validateExpiry(cardExpiry) : undefined;
  const cardCvvError = paySubmitted ? validateCvv(cardCvv) : undefined;

  const currentPlanKey = summary?.planKey ?? null;
  const isSubscribed = !!summary?.isSubscribed;
  const planLabel = summary?.planLabel || 'Free';

  const checkoutAmount = useMemo(
    () => (checkoutPlan ? priceFor(checkoutPlan, cycle) : 0),
    [checkoutPlan, cycle],
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primaryAlt} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Current plan */}
        <View style={[styles.currentCard, isSubscribed && styles.currentCardPaid]}>
          <View style={styles.currentHeader}>
            <View style={styles.currentHeaderLeft}>
              <View style={[styles.planIconWrap, isSubscribed && styles.planIconWrapPaid]}>
                <Icon name="crown" size={18} color={isSubscribed ? '#B45309' : colors.gray} />
              </View>
              <View>
                <Text style={styles.currentLabel}>{t('Your current plan')}</Text>
                <Text style={styles.currentPlanName}>{planLabel}</Text>
              </View>
            </View>
            <View style={[styles.planTag, isSubscribed ? styles.planTagPaid : styles.planTagFree]}>
              <Text style={[styles.planTagText, isSubscribed && styles.planTagTextPaid]}>
                {isSubscribed ? t(summary?.billingCycle === 'yearly' ? 'Yearly' : 'Monthly') : t('Free')}
              </Text>
            </View>
          </View>

          {isSubscribed ? (
            <>
              <View style={styles.currentMetaRow}>
                <View style={styles.currentMetaCol}>
                  <Text style={styles.currentMetaLabel}>{t('Renews on')}</Text>
                  <Text style={styles.currentMetaValue}>
                    {moment(summary?.endDate).format('DD MMM YYYY')}
                  </Text>
                </View>
                <View style={styles.currentMetaDivider} />
                <View style={styles.currentMetaCol}>
                  <Text style={styles.currentMetaLabel}>{t('Days left')}</Text>
                  <Text style={styles.currentMetaValue}>{summary?.daysRemaining ?? 0}</Text>
                </View>
              </View>
              {canManage ? (
                <TouchableOpacity style={styles.cancelLink} onPress={confirmCancel} activeOpacity={0.7}>
                  <Text style={styles.cancelLinkText}>{t('Cancel Subscription')}</Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : (
            <Text style={styles.currentFreeHint}>
              {t('You are on the Free plan. Choose a subscription below to upgrade your agency.')}
            </Text>
          )}
        </View>

        {/* Billing cycle switch */}
        <View style={styles.cycleSwitch}>
          {(['monthly', 'yearly'] as BillingCycle[]).map(option => {
            const active = cycle === option;
            return (
              <TouchableOpacity
                key={option}
                activeOpacity={0.85}
                style={[styles.cycleOption, active && styles.cycleOptionActive]}
                onPress={() => setCycle(option)}>
                <Text style={[styles.cycleOptionText, active && styles.cycleOptionTextActive]}>
                  {t(option === 'monthly' ? 'Monthly' : 'Yearly')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {plans.length === 0 ? (
          <View style={styles.emptyBox}>
            <Icon name="crown" size={28} color={colors.grayLight} />
            <Text style={styles.emptyText}>{t('No subscription plans are available right now.')}</Text>
          </View>
        ) : null}

        {/* Plan cards */}
        {plans.map(plan => {
          const isCurrent = isSubscribed && currentPlanKey === plan.key;
          const isCurrentCycle = isCurrent && summary?.billingCycle === cycle;
          const saving = cycle === 'yearly' ? yearlySavingPercent(plan) : 0;

          return (
            <View key={plan._id} style={[styles.planCard, isCurrent && styles.planCardCurrent]}>
              <View style={styles.planCardHeader}>
                <View style={styles.planCardHeaderLeft}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  {plan.tagline ? <Text style={styles.planTagline}>{plan.tagline}</Text> : null}
                </View>
                {isCurrent ? (
                  <View style={styles.currentChip}>
                    <Icon name="check-circle" size={12} color="#15803D" />
                    <Text style={styles.currentChipText}>{t('Current')}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.priceRow}>
                <Text style={styles.priceAmount}>
                  {plan.currency === 'USD' ? '$' : ''}
                  {priceFor(plan, cycle).toFixed(2)}
                </Text>
                <Text style={styles.pricePeriod}>
                  {t('for {{days}} days', { days: durationFor(plan, cycle) })}
                </Text>
              </View>

              {saving > 0 ? (
                <View style={styles.savingBadge}>
                  <Text style={styles.savingBadgeText}>
                    {t('Save {{percent}}% vs monthly', { percent: saving })}
                  </Text>
                </View>
              ) : null}

              <View style={styles.featureList}>
                {plan.features?.map((feature, index) => (
                  <View key={index} style={styles.featureRow}>
                    <Icon name="check-circle" size={14} color={colors.success} />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              <PrimaryButton
                title={
                  isCurrentCycle
                    ? t('Current Plan')
                    : isSubscribed
                      ? t('Switch to {{plan}}', { plan: plan.name })
                      : t('Choose {{plan}}', { plan: plan.name })
                }
                disabled={isCurrentCycle || !canManage}
                style={styles.choosePlanButton}
                onPress={() => openCheckout(plan)}
              />
            </View>
          );
        })}

        {/* Billing history */}
        {history.length > 0 ? (
          <View style={styles.historyCard}>
            <Text style={styles.historyTitle}>{t('BILLING HISTORY')}</Text>
            {history.map(item => (
              <View key={item._id} style={styles.historyRow}>
                <View style={styles.historyRowLeft}>
                  <Text style={styles.historyPlan}>
                    {item.planName} · {t(item.billingCycle === 'yearly' ? 'Yearly' : 'Monthly')}
                  </Text>
                  <Text style={styles.historyMeta}>
                    {moment(item.startDate).format('DD MMM YYYY')} · {item.paymentMethod}
                  </Text>
                </View>
                <View style={styles.historyRowRight}>
                  <Text style={styles.historyAmount}>
                    {item.currency === 'USD' ? '$' : ''}
                    {Number(item.amount).toFixed(2)}
                  </Text>
                  <Text style={styles.historyStatus}>{t(item.status)}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {/* Checkout - the same payment sheet the visitor sees for a queue ticket */}
      <Modal
        visible={!!checkoutPlan}
        animationType="slide"
        transparent
        onRequestClose={closeCheckout}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
          <ScrollView
            style={styles.sheetScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.sheet, { paddingBottom: 200 + insets.bottom }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t('Payment Checkout')}</Text>
            <Text style={styles.sheetSubtitle}>
              {t('Complete payment to activate your subscription')}
            </Text>

            {/* Order summary */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryBadgeRow}>
                <View style={styles.flexRowGap}>
                  <Icon name="crown" size={14} color={colors.primaryAlt} />
                  <Text style={styles.summaryBadgeText}>{t('SUBSCRIPTION')}</Text>
                </View>
                <View style={styles.secureBadge}>
                  <Icon name="shield" size={12} color="#15803D" />
                  <Text style={styles.secureBadgeText}>{t('Secure SSL')}</Text>
                </View>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('Plan')}</Text>
                <Text style={styles.summaryVal}>{checkoutPlan?.name}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('Billing')}</Text>
                <Text style={styles.summaryVal}>
                  {t(cycle === 'yearly' ? 'Yearly' : 'Monthly')}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{t('Access period')}</Text>
                <Text style={styles.summaryVal}>
                  {checkoutPlan
                    ? t('{{days}} days', { days: durationFor(checkoutPlan, cycle) })
                    : ''}
                </Text>
              </View>

              <View style={[styles.summaryRow, styles.summaryTotalRow]}>
                <Text style={styles.summaryTotalLabel}>{t('Total Amount Due')}</Text>
                <Text style={styles.summaryTotalVal}>
                  {checkoutPlan?.currency === 'USD' ? '$' : ''}
                  {checkoutAmount.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Method picker */}
            <Text style={styles.methodTitle}>{t('Select Payment Method')}</Text>
            <View style={styles.paymentMethodsGrid}>
              {PAYMENT_METHODS.map(item => {
                const active = selectedMethod === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    activeOpacity={0.8}
                    style={[
                      styles.paymentGridCard,
                      active && { borderColor: item.color, backgroundColor: item.bg },
                    ]}
                    onPress={() => {
                      setPaymentError(null);
                      setPaySubmitted(false);
                      setSelectedMethod(item.key);
                    }}>
                    <Icon name={item.iconName} size={18} color={active ? item.color : colors.gray} />
                    <Text
                      style={[
                        styles.paymentCardLabel,
                        active && { color: item.color, fontWeight: '700' },
                      ]}>
                      {item.key}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedMethod === 'Orange Money' && (
              <View style={styles.methodInputBox}>
                <TextField
                  label={t('Orange Money Account / Mobile No.')}
                  value={accountNumber}
                  onChangeText={value => {
                    setPaymentError(null);
                    setAccountNumber(sanitizePhone(value));
                  }}
                  keyboardType="phone-pad"
                  maxLength={16}
                  placeholder="+225 0700000000"
                  error={accountNumberError ? t(accountNumberError) : undefined}
                />
              </View>
            )}

            {selectedMethod === 'PayPal' && (
              <View style={styles.methodInputBox}>
                <TextField
                  label={t('PayPal Email Address')}
                  value={paypalEmail}
                  onChangeText={value => {
                    setPaymentError(null);
                    setPaypalEmail(sanitizeEmail(value));
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={254}
                  placeholder="user@paypal.com"
                  error={paypalEmailError ? t(paypalEmailError) : undefined}
                />
              </View>
            )}

            {(selectedMethod === 'Credit Card' || selectedMethod === 'Stripe') && (
              <View style={styles.methodInputBox}>
                <TextField
                  label={t('Card Number')}
                  value={cardNumber}
                  onChangeText={value => {
                    setPaymentError(null);
                    setCardNumber(sanitizeCardNumber(value));
                  }}
                  keyboardType="number-pad"
                  // 16 digits + the 3 grouping spaces.
                  maxLength={CARD_NUMBER_DIGITS + 3}
                  placeholder="4111 2222 3333 4444"
                  error={cardNumberError ? t(cardNumberError) : undefined}
                />
                <View style={styles.cardInline}>
                  <View style={styles.cardFlex}>
                    <TextField
                      label={t('Expiry (MM/YY)')}
                      value={cardExpiry}
                      onChangeText={value => {
                        setPaymentError(null);
                        setCardExpiry(sanitizeExpiry(value));
                      }}
                      keyboardType="number-pad"
                      maxLength={5}
                      placeholder="12/28"
                      error={cardExpiryError ? t(cardExpiryError) : undefined}
                    />
                  </View>
                  <View style={styles.cardFlex}>
                    <TextField
                      label={t('CVV')}
                      value={cardCvv}
                      onChangeText={value => {
                        setPaymentError(null);
                        setCardCvv(sanitizeCvv(value));
                      }}
                      keyboardType="number-pad"
                      maxLength={CVV_MAX}
                      secureTextEntry
                      placeholder="123"
                      error={cardCvvError ? t(cardCvvError) : undefined}
                    />
                  </View>
                </View>
              </View>
            )}

            {paymentError ? (
              <View style={styles.errorAlertCard}>
                <Icon name="alert-triangle" size={18} color="#DC2626" />
                <Text style={styles.errorAlertText}>{paymentError}</Text>
              </View>
            ) : null}

            <PrimaryButton
              title={t('Pay {{amount}} Now', {
                amount: `${checkoutPlan?.currency === 'USD' ? '$' : ''}${checkoutAmount.toFixed(2)}`,
              })}
              style={styles.payButton}
              onPress={onSubmitPayment}
            />
            <TouchableOpacity onPress={closeCheckout}>
              <Text style={styles.sheetCancel}>{t('Cancel')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
  },
  scroll: { padding: 16, paddingBottom: 40 },

  currentCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  currentCardPaid: { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
  currentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  currentHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  planIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planIconWrapPaid: { backgroundColor: '#FEF3C7' },
  currentLabel: { fontSize: 12, color: colors.gray },
  currentPlanName: { fontSize: 18, fontWeight: '800', color: colors.textDarker, marginTop: 2 },
  planTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  planTagFree: { backgroundColor: '#F3F4F6' },
  planTagPaid: { backgroundColor: '#FEF3C7' },
  planTagText: { fontSize: 11, fontWeight: '700', color: colors.gray },
  planTagTextPaid: { color: '#B45309' },
  currentFreeHint: { fontSize: 13, color: colors.gray, marginTop: 12, lineHeight: 19 },
  currentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  currentMetaCol: { flex: 1, alignItems: 'center' },
  currentMetaDivider: { width: 1, height: 24, backgroundColor: '#FDE68A' },
  currentMetaLabel: { fontSize: 11, color: colors.gray },
  currentMetaValue: { fontSize: 14, fontWeight: '700', color: colors.textDarker, marginTop: 2 },
  cancelLink: { alignSelf: 'center', paddingVertical: 10, marginTop: 4 },
  cancelLinkText: { fontSize: 13, fontWeight: '600', color: '#DC2626' },

  cycleSwitch: {
    flexDirection: 'row',
    backgroundColor: '#EFEFEF',
    borderRadius: 14,
    padding: 4,
    marginTop: 20,
  },
  cycleOption: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10 },
  cycleOptionActive: { backgroundColor: colors.white },
  cycleOptionText: { fontSize: 14, fontWeight: '600', color: colors.gray },
  cycleOptionTextActive: { color: colors.textDarker, fontWeight: '700' },

  emptyBox: { alignItems: 'center', padding: 30, gap: 10 },
  emptyText: { fontSize: 13, color: colors.gray, textAlign: 'center' },

  planCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 18,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  planCardCurrent: { borderColor: colors.primaryAlt, borderWidth: 1.5 },
  planCardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  planCardHeaderLeft: { flex: 1, paddingRight: 10 },
  planName: { fontSize: 18, fontWeight: '800', color: colors.textDarker },
  planTagline: { fontSize: 12, color: colors.gray, marginTop: 3 },
  currentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  currentChipText: { fontSize: 10, fontWeight: '700', color: '#15803D' },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 14 },
  priceAmount: { fontSize: 28, fontWeight: '800', color: colors.primaryAlt },
  pricePeriod: { fontSize: 12, color: colors.gray, paddingBottom: 5 },
  savingBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 8,
  },
  savingBadgeText: { fontSize: 11, fontWeight: '700', color: '#15803D' },
  featureList: { marginTop: 14, gap: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  featureText: { flex: 1, fontSize: 13, color: colors.textDark, lineHeight: 19 },
  choosePlanButton: { marginTop: 18 },

  historyCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  historyTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gray,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  historyRowLeft: { flex: 1, paddingRight: 10 },
  historyRowRight: { alignItems: 'flex-end' },
  historyPlan: { fontSize: 14, fontWeight: '700', color: colors.textDarker },
  historyMeta: { fontSize: 11, color: colors.gray, marginTop: 2 },
  historyAmount: { fontSize: 14, fontWeight: '800', color: colors.textDark },
  historyStatus: { fontSize: 11, color: colors.gray, marginTop: 2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheetScroll: { maxHeight: '90%' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: colors.textDarker },
  sheetSubtitle: { fontSize: 14, color: colors.gray, marginTop: 2 },
  sheetCancel: {
    textAlign: 'center',
    color: colors.gray,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 8,
  },

  summaryCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  summaryBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  flexRowGap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryAlt,
    letterSpacing: 0.5,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  secureBadgeText: { fontSize: 10, fontWeight: '700', color: '#15803D' },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: { fontSize: 13, color: colors.gray },
  summaryVal: { fontSize: 13, fontWeight: '600', color: colors.textDark },
  summaryTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 10,
    marginTop: 4,
    marginBottom: 0,
  },
  summaryTotalLabel: { fontSize: 14, fontWeight: '700', color: colors.textDarker },
  summaryTotalVal: { fontSize: 18, fontWeight: '800', color: colors.primaryAlt },

  methodTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textDarker,
    marginTop: 20,
    marginBottom: 10,
  },
  paymentMethodsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  paymentGridCard: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  paymentCardLabel: { fontSize: 13, color: colors.gray },
  methodInputBox: { marginTop: 4, marginBottom: 8 },
  cardInline: { flexDirection: 'row', gap: 12 },
  cardFlex: { flex: 1 },
  errorAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    gap: 10,
  },
  errorAlertText: { flex: 1, fontSize: 13, color: '#B91C1C' },
  payButton: { marginTop: 18 },
});
