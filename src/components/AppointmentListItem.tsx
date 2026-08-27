import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from './Text';
import { AppointmentStatus, StatusPill } from './StatusPill';
import { colors } from '../theme/colors';

interface AppointmentListItemProps {
  title: string;
  subtitle?: string;
  dateLabel: string;
  meta?: string;
  status: AppointmentStatus;
  avatarUrl?: string;
  onPress?: () => void;
  footer?: React.ReactNode;
}

export function AppointmentListItem({
  title,
  subtitle,
  dateLabel,
  meta,
  status,
  avatarUrl,
  onPress,
  footer,
}: AppointmentListItemProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} disabled={!onPress} activeOpacity={0.85}>
      <View style={styles.topRow}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>{title.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {onPress ? <Text style={styles.chevron}>›</Text> : null}
      </View>

      <View style={styles.divider} />

      <View style={styles.footerRow}>
        <View style={styles.footerText}>
          <Text style={styles.date} numberOfLines={1}>
            {dateLabel}
          </Text>
          {meta ? (
            <Text style={styles.meta} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
        <StatusPill status={status} />
      </View>

      {footer ? <View style={styles.footerSlot}>{footer}</View> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.backgroundLightAlt,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: colors.black,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  avatarPlaceholder: { backgroundColor: colors.backgroundLight, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: colors.primary, fontSize: 18, fontWeight: '700' },
  body: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', color: colors.textDarker },
  subtitle: { fontSize: 13, color: colors.gray, marginTop: 3, lineHeight: 18 },
  chevron: { fontSize: 24, color: colors.grayLight, marginLeft: 8, marginTop: -2 },
  divider: { height: 1, backgroundColor: colors.backgroundLightAlt, marginVertical: 12 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  footerText: { flex: 1 },
  date: { fontSize: 12, color: colors.grayAlt },
  meta: { fontSize: 11, color: colors.grayLight, marginTop: 3 },
  footerSlot: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.backgroundLightAlt, paddingTop: 12 },
});
