import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import moment from 'moment';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Text';
import { PrimaryButton } from '../../components/PrimaryButton';
import { InfoRow, SectionCard } from '../../components/SectionCard';
import { StatusPill } from '../../components/StatusPill';
import { appointmentApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { colors } from '../../theme/colors';
import type { Appointment } from '../../types/models';
import type { MyAppointmentsStackParamList } from '../../navigation/types';

export default function MyAppointmentsDetails() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<MyAppointmentsStackParamList>>();
  const route = useRoute<RouteProp<MyAppointmentsStackParamList, 'MyAppointmentsDetails'>>();
  const { appointmentId } = route.params;

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

  const provider = appointment.service_provider;
  const providerName = provider?.name ?? t('Service Provider');

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.avatarRing}>
          {provider?.profile ? (
            <Image source={{ uri: provider.profile }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>{providerName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>

        <Text style={styles.heroName} numberOfLines={1}>
          {providerName}
        </Text>
        {provider?.phone ? (
          <Text style={styles.heroMeta} numberOfLines={1}>
            {provider.phone}
          </Text>
        ) : null}

        <StatusPill status={appointment.status} style={styles.heroStatus} />
      </View>

      <SectionCard
        title={t('Appointment')}
        action={
          appointment.ticketNumber ? <Text style={styles.cardAction}>#{appointment.ticketNumber}</Text> : undefined
        }>
        <InfoRow
          label={t('Date & time')}
          value={moment(appointment.full_date).format('DD MMM YYYY, h:mm A')}
        />
        <InfoRow label={t('Booked for')} value={appointment.name} />
        <InfoRow label={t('Booked on')} value={moment(appointment.createdAt).format('DD MMM YYYY')} last />
      </SectionCard>

      <SectionCard title={t('Purpose of visit')}>
        <Text style={[styles.bodyText, !appointment.purpose_of_visit && styles.bodyTextEmpty]}>
          {appointment.purpose_of_visit || t('No purpose added.')}
        </Text>
      </SectionCard>

      {provider?.about_us ? (
        <SectionCard title={t('About the provider')}>
          <Text style={styles.bodyText}>{provider.about_us}</Text>
        </SectionCard>
      ) : null}

      {appointment.paymentMethod ? (
        <SectionCard
          title={t('Payment receipt')}
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

      <PrimaryButton
        title={t('View Purpose of Visit')}
        style={styles.button}
        onPress={() => navigation.navigate('PurposeOfVisit', { appointmentId })}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.white },
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
  paymentDueText: { fontSize: 12, color: '#B45309', marginTop: 10 },
  bodyText: { fontSize: 14, lineHeight: 21, color: colors.textDark, marginTop: 12 },
  bodyTextEmpty: { color: colors.grayLight },

  button: { marginTop: 24, marginHorizontal: 20 },
});
