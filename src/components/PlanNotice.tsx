import React from 'react';
import { StyleSheet, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import moment from 'moment';
import { Text } from './Text';
import { Icon, type IconName } from './Icon';
import type { Entitlements } from '../utils/entitlements';

type Tone = 'locked' | 'warning' | 'info';

const TONES: Record<Tone, { bg: string; border: string; title: string; body: string; icon: IconName }> = {
  locked: { bg: '#FEE2E2', border: '#FCA5A5', title: '#B91C1C', body: '#DC2626', icon: 'lock' },
  warning: { bg: '#FEF3C7', border: '#FCD34D', title: '#B45309', body: '#D97706', icon: 'alert-triangle' },
  info: { bg: '#EEF2FF', border: '#C7D2FE', title: '#4338CA', body: '#4F46E5', icon: 'crown' },
};

interface PlanNoticeProps {
  tone: Tone;
  title: string;
  message: string;
  /** Renders the "View plans" link when given. */
  onViewPlans?: () => void;
  actionLabel?: string;
  /** Overrides the tone's default icon. */
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}

/** The bar every gated screen puts above its content. */
export function PlanNotice({ tone, title, message, onViewPlans, actionLabel, icon, style }: PlanNoticeProps) {
  const { t } = useTranslation();
  const palette = TONES[tone];

  return (
    <View style={[styles.wrap, { backgroundColor: palette.bg, borderColor: palette.border }, style]}>
      <Icon name={icon ?? palette.icon} size={18} color={palette.title} style={styles.icon} />
      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: palette.title }]}>{title}</Text>
        <Text style={[styles.message, { color: palette.body }]}>{message}</Text>
        {onViewPlans ? (
          <TouchableOpacity style={styles.action} onPress={onViewPlans} activeOpacity={0.7}>
            <Text style={[styles.actionText, { color: palette.title }]}>
              {actionLabel ?? t('View plans')} ›
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export function PlanStatusNotice({
  entitlements,
  onViewPlans,
  style,
}: {
  entitlements: Entitlements;
  onViewPlans?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation();
  const { state, managedByMe, planLabel, endDate, daysRemaining, isVerified } = entitlements;

  if (!isVerified) return null;
  if (state === 'active' || state === 'open') return null;

  const date = moment(endDate).format('DD MMM YYYY');

  if (state === 'expiring') {
    return (
      <PlanNotice
        tone="warning"
        title={managedByMe ? t('Your plan ends soon') : t('Your agency plan ends soon')}
        message={
          managedByMe
            ? t('{{plan}} runs out in {{days}} days, on {{date}}. Renew to keep managing your agency.', {
              plan: planLabel,
              days: daysRemaining,
              date,
            })
            : t('{{plan}} runs out in {{days}} days, on {{date}}. Ask your provider to renew it.', {
              plan: planLabel,
              days: daysRemaining,
              date,
            })
        }
        onViewPlans={onViewPlans}
        actionLabel={managedByMe ? t('Renew now') : t('View plans')}
        style={style}
      />
    );
  }

  if (state === 'expired') {
    return (
      <PlanNotice
        tone="locked"
        title={managedByMe ? t('Your plan has expired') : t('Your agency plan has expired')}
        message={
          managedByMe
            ? t('It ended on {{date}}. You can still see your agency, but adding and editing is off until you renew.', { date })
            : t('It ended on {{date}}. You can still see the agency, but adding and editing is off until your provider renews it.', { date })
        }
        onViewPlans={onViewPlans}
        actionLabel={managedByMe ? t('Renew now') : t('View plans')}
        style={style}
      />
    );
  }

  return (
    <PlanNotice
      tone="locked"
      title={managedByMe ? t('You are on the Free plan') : t('Your agency is on the Free plan')}
      message={
        managedByMe
          ? t('Choose a plan to add services, hire staff and run your queue. Until then your agency is read-only.')
          : t('Your provider has not chosen a plan yet. Until they do, the agency is read-only.')
      }
      onViewPlans={onViewPlans}
      actionLabel={managedByMe ? t('Choose a plan') : t('View plans')}
      style={style}
    />
  );
}

export function VerificationNotice({
  entitlements,
  style,
}: {
  entitlements: Entitlements;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation();
  const { isVerified, verification, managedByMe } = entitlements;

  if (isVerified) return null;

  if (verification === 'Suspended') {
    return (
      <PlanNotice
        tone="locked"
        icon="alert-triangle"
        title={managedByMe ? t('Your account is suspended') : t('Your agency is suspended')}
        message={
          managedByMe
            ? t('An admin has suspended your agency. Managing it is off until this is resolved - please contact support.')
            : t('An admin has suspended this agency. Ask your provider to contact support.')
        }
        style={style}
      />
    );
  }

  return (
    <PlanNotice
      tone="warning"
      icon="shield"
      title={managedByMe ? t('Your account is under review') : t('Your agency is under review')}
      message={
        managedByMe
          ? t('An admin is checking your agency details. After verification you choose a plan, adding services, hiring staff and running your queue open up once you are verified.')
          : t('An admin is still checking this agency. Until it is verified you can look around, but nothing can be changed.')
      }
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  icon: { marginTop: 1 },
  textWrap: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700' },
  message: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  action: { marginTop: 8, alignSelf: 'flex-start' },
  actionText: { fontSize: 12, fontWeight: '700' },
});
