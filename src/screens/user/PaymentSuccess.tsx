import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Text';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PrimaryButton } from '../../components/PrimaryButton';
import { appointmentApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { Icon } from '../../components/Icon';
import type { Appointment } from '../../types/models';
import type { RootStackParamList } from '../../navigation/types';

export default function PaymentSuccess() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'PaymentSuccess'>>();
  const { appointmentId } = route.params;
  const { userDetail } = useAuth();

  const role = userDetail?.role;
  const appointmentsTab =
    role === 'provider' ? 'MyAppointmentsProvider' : role === 'staff' ? 'MyAppointmentsStaff' : 'History';

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res: any = await appointmentApi.getRequestAppointmentById(appointmentId);
        if (mounted) setAppointment(res?.data ?? null);
      } catch (err) {
        // Store the key, not the translation, so the effect stays independent of
        // the language and the message re-translates when it is switched.
        if (mounted) setError(err instanceof ApiError ? err.message : 'Something went wrong');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [appointmentId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primaryAlt} />
        <Text style={styles.loadingText}>{t('Fetching ticket details...')}</Text>
      </View>
    );
  }

  if (error || !appointment) {
    return (
      <View style={styles.loadingContainer}>
        <Icon name="alert-triangle" size={40} color="#DC2626" />
        <Text style={styles.errorText}>{error ? t(error) : t('Appointment not found')}</Text>
        <PrimaryButton
          title={t('Go to Home')}
          style={styles.errButton}
          onPress={() => navigation.navigate('Tabs')}
        />
      </View>
    );
  }

  const serviceName = typeof appointment.service === 'object' && appointment.service?.service_name
    ? appointment.service.service_name
    : t('Queue Reservation');

  // "Pay on Counter" issues the ticket now and leaves the fee to the desk.
  const unpaid = appointment.paymentStatus === 'Pending';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* Success Celebration Badge */}
      <View style={styles.celebrationWrap}>
        <View style={styles.successOuterCircle}>
          <View style={styles.successInnerCircle}>
            <Icon name="check-circle" size={42} color="#16A34A" />
          </View>
        </View>
        <Text style={styles.title}>{t('Appointment Confirmed!')}</Text>
        <Text style={styles.subtitle}>
          {role === 'provider' || role === 'staff'
            ? t('The queue ticket for {{visitor}} is secured', { visitor: appointment.name })
            : t('Your queue ticket reservation is secured')}
        </Text>
      </View>

      {/* Ticket Pass Card */}
      <View style={styles.ticketCard}>
        {/* Ticket Top Header */}
        <View style={styles.ticketHeader}>
          <View style={styles.ticketBadgeWrap}>
            <Text style={styles.ticketBadgeLabel}>{t('OFFICIAL QUEUE TICKET')}</Text>
            <Text style={styles.ticketNumberText}>#{appointment.ticketNumber || 'PROXI-884'}</Text>
          </View>
          <View style={styles.statusChip}>
            <View style={styles.statusDot} />
            <Text style={styles.statusChipText}>{t(appointment.status || 'Confirmed')}</Text>
          </View>
        </View>

        <Text style={styles.serviceTitle}>{serviceName}</Text>

        {/* Date & Time Row */}
        <View style={styles.timeMetaCard}>
          <View style={styles.metaCol}>
            <Icon name="calendar" size={14} color={colors.primaryAlt} />
            <Text style={styles.metaValText}>{appointment.date || t('Today')}</Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaCol}>
            <Icon name="clock" size={14} color={colors.primaryAlt} />
            <Text style={styles.metaValText}>{appointment.time || t('Scheduled Slot')}</Text>
          </View>
        </View>

        {/* Decorative Ticket Perforated Divider Line */}
        <View style={styles.perforatedContainer}>
          <View style={styles.notchLeft} />
          <View style={styles.dashLine} />
          <View style={styles.notchRight} />
        </View>

        {/* Visitor Details Section */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionHeaderTitle}>{t('VISITOR INFORMATION')}</Text>

          <View style={styles.gridRow}>
            <View style={styles.gridCol}>
              <Text style={styles.gridLabel}>{t('Visitor Name')}</Text>
              <Text style={styles.gridVal}>{appointment.name}</Text>
            </View>
            <View style={styles.gridCol}>
              <Text style={styles.gridLabel}>{t('Phone Number')}</Text>
              <Text style={styles.gridVal}>{appointment.phone}</Text>
            </View>
          </View>

          <View style={styles.gridRow}>
            <View style={styles.gridCol}>
              <Text style={styles.gridLabel}>{t('Gender')}</Text>
              <Text style={styles.gridVal}>{t(appointment.gender)}</Text>
            </View>
            <View style={styles.gridCol}>
              <Text style={styles.gridLabel}>{t('Purpose of Visit')}</Text>
              <Text style={styles.gridVal} numberOfLines={1}>{appointment.purpose_of_visit}</Text>
            </View>
          </View>
        </View>

        {/* Payment Summary Section */}
        <View style={styles.paymentSection}>
          <Text style={styles.sectionHeaderTitle}>{t('PAYMENT RECEIPT')}</Text>

          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>{t('Payment Method')}</Text>
            <View style={styles.receiptMethodWrap}>
              <Icon name="credit-card" size={14} color={colors.textDark} />
              <Text style={styles.receiptVal}>{appointment.paymentMethod || 'Orange Money'}</Text>
            </View>
          </View>

          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>{unpaid ? t('Amount Due') : t('Amount Paid')}</Text>
            <Text style={styles.receiptAmountVal}>
              ${appointment.paymentAmount ? appointment.paymentAmount.toFixed(2) : '5.50'}
            </Text>
          </View>

          {appointment.transactionId ? (
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>{t('Transaction Reference')}</Text>
              <Text style={styles.receiptValSmall}>{appointment.transactionId}</Text>
            </View>
          ) : null}

          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>{t('Payment Status')}</Text>
            <View style={[styles.completedBadge, unpaid && styles.pendingBadge]}>
              <Icon
                name={unpaid ? 'clock' : 'check-circle'}
                size={12}
                color={unpaid ? '#B45309' : '#15803D'}
              />
              <Text style={[styles.completedBadgeText, unpaid && styles.pendingBadgeText]}>
                {t(appointment.paymentStatus || 'Completed')}
              </Text>
            </View>
          </View>

          {unpaid ? (
            <Text style={styles.pendingNote}>
              {t('To be collected at the counter before the visitor is served.')}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Primary Action Buttons */}
      <View style={styles.buttonGroup}>
        <PrimaryButton
          title={t('Return to Home Screen')}
          style={styles.homeButton}
          onPress={() => navigation.navigate('Tabs')}
        />
        <TouchableOpacity
          style={styles.historyLink}
          onPress={() => navigation.navigate('Tabs', { screen: appointmentsTab } as any)}>
          <Icon name="file-text" size={16} color={colors.primaryAlt} />
          <Text style={styles.historyLinkText}>{t('View All My Appointments')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { padding: 20, alignItems: 'center', paddingBottom: 40 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB', padding: 20 },
  loadingText: { marginTop: 12, fontSize: 14, color: colors.gray, fontWeight: '500' },
  errorText: { color: colors.textDark, fontSize: 15, marginVertical: 16, textAlign: 'center' },
  errButton: { minWidth: 160 },
  celebrationWrap: { alignItems: 'center', marginTop: 10, marginBottom: 20 },
  successOuterCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  successInnerCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.textDarker },
  subtitle: { fontSize: 13, color: colors.gray, marginTop: 4 },
  ticketCard: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  ticketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  ticketBadgeWrap: {
    flex: 1,
  },
  ticketBadgeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryAlt,
    letterSpacing: 0.5,
  },
  ticketNumberText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textDarker,
    marginTop: 2,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: 12,
  },
  timeMetaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8F0',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#FFE8DA',
  },
  metaCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  metaDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#FFE0CC',
  },
  metaValText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDarker,
  },
  perforatedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
    marginHorizontal: -20,
  },
  notchLeft: {
    width: 16,
    height: 24,
    backgroundColor: '#F9FAFB',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderLeftWidth: 0,
  },
  notchRight: {
    width: 16,
    height: 24,
    backgroundColor: '#F9FAFB',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRightWidth: 0,
  },
  dashLine: {
    flex: 1,
    height: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginHorizontal: 4,
  },
  sectionWrap: {
    marginBottom: 16,
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gray,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  gridCol: {
    flex: 1,
  },
  gridLabel: {
    fontSize: 12,
    color: colors.gray,
  },
  gridVal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDarker,
    marginTop: 2,
  },
  paymentSection: {
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  receiptLabel: {
    fontSize: 12,
    color: colors.gray,
  },
  receiptMethodWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  receiptVal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
  },
  receiptAmountVal: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primaryAlt,
  },
  receiptValSmall: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textDark,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  completedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  pendingBadge: { backgroundColor: '#FEF3C7' },
  pendingBadgeText: { color: '#B45309' },
  pendingNote: { fontSize: 11, color: '#B45309', marginTop: 4 },
  buttonGroup: {
    width: '100%',
    marginTop: 20,
    gap: 12,
    alignItems: 'center',
  },
  homeButton: {
    width: '100%',
  },
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  historyLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryAlt,
  },
});
