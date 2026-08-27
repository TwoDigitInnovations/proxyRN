import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, View } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import moment from 'moment';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Text';
import { PrimaryButton } from '../../components/PrimaryButton';
import { InfoRow, SectionCard } from '../../components/SectionCard';
import { StatusPill } from '../../components/StatusPill';
import { appointmentApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useUi } from '../../context/UiContext';
import { colors } from '../../theme/colors';
import type { Appointment } from '../../types/models';
import type { MyAppointmentsProviderStackParamList } from '../../navigation/types';

export default function MyAppointmentsDetailsProvider() {
  const { t } = useTranslation();
  const route = useRoute<RouteProp<MyAppointmentsProviderStackParamList, 'MyAppointmentsDetailsProvider'>>();
  const { appointmentId } = route.params;
  const { showLoading, hideLoading, showToast } = useUi();
  const { can, entitlements } = useAuth();
  const canManage = can('appointments.manage') && entitlements.canWrite;

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res: any = await appointmentApi.getRequestAppointmentByProviderId(appointmentId);
      setAppointment(res?.data ?? null);
    } catch (err) {
      // Store the key, not the translation, so the callback stays independent of
      // the language and the message re-translates when it is switched.
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleComplete() {
    if (!canManage) {
      showToast(t(entitlements.lockKey('Renew your plan to update this booking.')));
      return;
    }
    showLoading();
    try {
      await appointmentApi.updateAppointmentStatusByProvider({ status: 'Completed', id: appointmentId });
      showToast(t('Appointment marked as completed'));
      await load();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t('Something went wrong'));
    } finally {
      hideLoading();
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !appointment) {
    return (
      <View style={styles.centered}>
        <View style={styles.errorIconCircle}>
          <Text style={styles.errorIcon}>!</Text>
        </View>
        <Text style={styles.errorText}>{error ? t(error) : t('Appointment not found')}</Text>
      </View>
    );
  }

  const visitorName = appointment.name || appointment.user?.name || t('Visitor');
  const isPending = appointment.status === 'Pending';
  // Set only when the agency raised the ticket at its own desk.
  const bookedByName =
    appointment.bookedByRole && appointment.bookedByRole !== 'user' && typeof appointment.bookedBy === 'object'
      ? appointment.bookedBy?.name
      : undefined;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.avatarRing}>
          {appointment.user?.profile ? (
            <Image source={{ uri: appointment.user.profile }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>{visitorName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>

        <Text style={styles.heroName} numberOfLines={1}>
          {visitorName}
        </Text>
        <Text style={styles.heroMeta} numberOfLines={1}>
          {moment(appointment.full_date).format('DD MMM YYYY, h:mm A')}
        </Text>

        <StatusPill status={appointment.status} style={styles.heroStatus} />
      </View>

      <SectionCard
        title={t('Visitor details')}
        action={
          appointment.ticketNumber ? <Text style={styles.cardAction}>#{appointment.ticketNumber}</Text> : undefined
        }>
        <InfoRow label={t('Phone')} value={appointment.phone} />
        <InfoRow label={t('Email')} value={appointment.email} />
        <InfoRow label={t('Gender')} value={appointment.gender ? t(appointment.gender) : undefined} last />
      </SectionCard>

      <SectionCard title={t('Appointment')}>
        <InfoRow
          label={t('Check-in time')}
          value={moment(appointment.full_date).format('DD MMM YYYY, h:mm A')}
        />
        <InfoRow label={t('Booked on')} value={moment(appointment.createdAt).format('DD MMM YYYY')} />
        <InfoRow label={t('Status')} value={t(appointment.status)} last />
      </SectionCard>

      <SectionCard title={t('Purpose of visit')}>
        <Text style={[styles.bodyText, !appointment.purpose_of_visit && styles.bodyTextEmpty]}>
          {appointment.purpose_of_visit || t('No purpose added.')}
        </Text>
      </SectionCard>

      {appointment.paymentMethod ? (
        <SectionCard
          title={t('Payment')}
          action={
            <Text style={styles.cardAction}>{t(appointment.paymentStatus ?? 'Completed')}</Text>
          }>
          <InfoRow label={t('Method')} value={appointment.paymentMethod} />
          <InfoRow label={t('Amount')} value={`$${appointment.paymentAmount?.toFixed(2) ?? '5.50'}`} />
          {appointment.transactionId ? (
            <InfoRow label={t('Transaction ID')} value={appointment.transactionId} last />
          ) : null}
          {appointment.paymentStatus === 'Pending' ? (
            <Text style={styles.paymentDueText}>
              {t('To be collected at the counter before the visitor is served.')}
            </Text>
          ) : null}
        </SectionCard>
      ) : null}

      {bookedByName ? (
        <SectionCard title={t('Booked at the counter')}>
          <Text style={styles.bodyText}>
            {t('Raised by {{name}} for this visitor.', { name: bookedByName })}
          </Text>
        </SectionCard>
      ) : null}

      {isPending && canManage ? (
        <PrimaryButton title={t('Mark as Completed')} onPress={handleComplete} style={styles.button} />
      ) : isPending ? (
        <View style={styles.readOnlyBanner}>
          <Text style={styles.readOnlyText}>
            {entitlements.canWrite
              ? t('You can view this booking but not change its status.')
              : t(entitlements.lockKey('Your plan is not active, so this booking cannot be updated.'))}
          </Text>
        </View>
      ) : (
        <View style={styles.completedBanner}>
          <Text style={styles.completedIcon}>✓</Text>
          <Text style={styles.completedText}>{t('This appointment has been completed.')}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.white },
  paymentDueText: { fontSize: 12, color: '#B45309', marginTop: 10 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, backgroundColor: colors.white },
  errorIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.backgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  errorIcon: { fontSize: 24, fontWeight: '700', color: colors.primary },
  errorText: { color: colors.gray, fontSize: 14, textAlign: 'center' },
  scroll: { paddingBottom: 40 },

  hero: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 20,
    backgroundColor: colors.backgroundLight,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  avatarRing: {
    padding: 4,
    borderRadius: 60,
    backgroundColor: colors.white,
    shadowColor: colors.black,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarPlaceholder: { backgroundColor: colors.backgroundLightAlt, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: colors.primary, fontSize: 36, fontWeight: '700' },
  heroName: { fontSize: 20, fontWeight: '700', color: colors.textDarker, marginTop: 14 },
  heroMeta: { fontSize: 13, color: colors.grayAlt, marginTop: 4 },
  heroStatus: { marginTop: 12, backgroundColor: colors.white },

  cardAction: { fontSize: 12, fontWeight: '600', color: colors.primary },
  bodyText: { fontSize: 14, lineHeight: 21, color: colors.textDark, marginTop: 12 },
  bodyTextEmpty: { color: colors.grayLight },

  button: { marginTop: 24, marginHorizontal: 20 },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 24,
    marginHorizontal: 20,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.successLight,
  },
  readOnlyBanner: {
    marginTop: 24,
    marginHorizontal: 20,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.backgroundLight,
  },
  readOnlyText: { fontSize: 13, color: colors.gray, textAlign: 'center' },
  completedIcon: { fontSize: 15, fontWeight: '700', color: colors.success },
  completedText: { flex: 1, fontSize: 13, color: colors.success },
});
