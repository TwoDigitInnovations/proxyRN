import React, { useCallback, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import moment from 'moment';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Text';
import { PageHeader } from '../../components/PageHeader';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { Icon, type IconName } from '../../components/Icon';
import { reviewApi, staffApi, subscriptionApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import type { RatingSummary, StaffServiceQueue, SubscriptionSummary } from '../../types/models';
import type { RootStackParamList, SettingsStaffStackParamList } from '../../navigation/types';

type NavigationProp = NativeStackNavigationProp<SettingsStaffStackParamList & RootStackParamList>;

interface MenuItemProps {
  iconName: IconName;
  iconColor: string;
  iconBg: string;
  label: string;
  subtitle?: string;
  onPress: () => void;
  isLast?: boolean;
}

function SettingsMenuItem({ iconName, iconColor, iconBg, label, subtitle, onPress, isLast }: MenuItemProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[styles.menuItem, !isLast && styles.menuItemBorder]}
      onPress={onPress}>
      <View style={styles.menuItemLeft}>
        <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
          <Icon name={iconName} size={18} color={iconColor} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.menuLabel}>{label}</Text>
          {subtitle ? <Text style={styles.menuSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <Icon name="chevron-right" size={18} color="#C0C0C0" />
    </TouchableOpacity>
  );
}

/**
 * The staff member's Settings tab, and the one screen that is never taken away.
 */
export default function SettingsStaff() {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();
  const { userDetail, logout, can } = useAuth();

  const [services, setServices] = useState<StaffServiceQueue[]>([]);
  const [agency, setAgency] = useState<string | null>(null);
  const [rating, setRating] = useState<RatingSummary | null>(null);
  const [plan, setPlan] = useState<SubscriptionSummary | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        try {
          const res: any = await staffApi.getMyServices();
          if (!mounted) return;
          setServices(res?.data?.services ?? []);
          const provider = res?.data?.provider;
          setAgency(provider?.name || null);
        } catch {
          // The assigned list is supplementary here: keep settings usable.
        }
      })();
      if (can('reviews.view')) {
        (async () => {
          try {
            const res: any = await reviewApi.getMyRatingSummary();
            if (mounted) setRating(res?.data ?? null);
          } catch {
            // Supplementary: the row still opens without its subtitle.
          }
        })();
      }
      if (can('subscription.view')) {
        (async () => {
          try {
            const res: any = await subscriptionApi.getMySubscription();
            if (mounted) setPlan(res?.data ?? null);
          } catch {
            // Supplementary: the row falls back to the plain label.
          }
        })();
      }
      return () => {
        mounted = false;
      };
    }, [can]),
  );

  function confirmLogout() {
    Alert.alert(t('Logout'), t('Are you sure you want to log out of your staff account?'), [
      { text: t('Cancel'), style: 'cancel' },
      { text: t('Log Out'), style: 'destructive', onPress: () => logout() },
    ]);
  }

  const initialLetter = userDetail?.name ? userDetail.name.charAt(0).toUpperCase() : 'S';
  const isSubscribed = plan?.isSubscribed ?? false;
  const planLabel = plan?.planLabel || t('Free');

  const agencyRows = [
    can('profile.manage'),
    can('services.view'),
    can('staff.manage'),
    can('subscription.view'),
    can('reviews.view'),
  ];
  const lastAgencyRow = agencyRows.lastIndexOf(true);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <PageHeader title={t('Settings')} />

      <View style={styles.profileCard}>
        <View style={styles.avatarWrap}>
          {userDetail?.profile ? (
            <Image source={{ uri: userDetail.profile }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarText}>{initialLetter}</Text>
            </View>
          )}
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.userName}>{userDetail?.name || t('Staff')}</Text>
          <Text style={styles.userEmail}>{userDetail?.email || userDetail?.phone || t('Staff account')}</Text>
          <View style={styles.roleTag}>
            <Text style={styles.roleTagText}>
              {agency ? t('Staff at {{agency}}', { agency }) : t('Staff Account')}
            </Text>
          </View>
        </View>
        {can('profile.manage') ? (
          <TouchableOpacity
            style={styles.editProfileBtn}
            onPress={() => navigation.navigate('ProfileProvider')}>
            <Text style={styles.editProfileBtnText}>{t('Edit')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <LanguageSwitcher />

      <View style={styles.sectionCard}>
        <Text style={styles.sectionHeaderTitle}>{t('MY ACCESS')}</Text>
        <Text style={styles.accessCaption}>
          {t('You can only work on the services your provider assigned to you.')}
        </Text>
        {services.length === 0 ? (
          <Text style={styles.emptyServices}>{t('No services assigned to you yet.')}</Text>
        ) : (
          <View style={styles.chipRow}>
            {services.map(service => (
              <View key={service._id} style={styles.serviceChip}>
                <Text style={styles.serviceChipText}>{service.service_name}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {lastAgencyRow >= 0 ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeaderTitle}>{t('AGENCY')}</Text>

          {can('profile.manage') ? (
            <SettingsMenuItem
              iconName="user"
              iconColor="#1D4ED8"
              iconBg="#E8F0FE"
              label={t('My Profile')}
              subtitle={t('Update your name, photo and contact details')}
              onPress={() => navigation.navigate('ProfileProvider')}
              isLast={lastAgencyRow === 0}
            />
          ) : null}

          {can('services.view') ? (
            <SettingsMenuItem
              iconName="briefcase"
              iconColor="#EA580C"
              iconBg="#FFF3E0"
              label={t('My Service Listings')}
              subtitle={
                can('services.manage')
                  ? t('Manage the services you were assigned and their time slots')
                  : t('View the services you were assigned')
              }
              onPress={() => navigation.navigate('MyServiceProvider')}
              isLast={lastAgencyRow === 1}
            />
          ) : null}

          {can('staff.manage') ? (
            <SettingsMenuItem
              iconName="users"
              iconColor="#0F766E"
              iconBg="#CCFBF1"
              label={t('My Staff')}
              subtitle={t('Add employees and choose the services they can handle')}
              onPress={() => navigation.navigate('MyStaffProvider')}
              isLast={lastAgencyRow === 2}
            />
          ) : null}

          {can('subscription.view') ? (
            <SettingsMenuItem
              iconName="crown"
              iconColor="#B45309"
              iconBg="#FEF3C7"
              label={can('subscription.manage') ? t('Manage Plans & Subscriptions') : t('Plans & Subscriptions')}
              subtitle={
                isSubscribed
                  ? t('{{plan}} plan · renews {{date}}', {
                    plan: planLabel,
                    date: moment(plan?.endDate).format('DD MMM YYYY'),
                  })
                  : t('The agency is on the Free plan')
              }
              onPress={() => navigation.navigate('ManagePlansProvider')}
              isLast={lastAgencyRow === 3}
            />
          ) : null}

          {can('reviews.view') ? (
            <SettingsMenuItem
              iconName="star"
              iconColor="#B45309"
              iconBg="#FEF3C7"
              label={t('Reviews & Ratings')}
              subtitle={
                rating && rating.totalReviews > 0
                  ? t('{{average}} average from {{total}} reviews', {
                    average: rating.averageRating.toFixed(1),
                    total: rating.totalReviews,
                  })
                  : t('No reviews yet')
              }
              onPress={() =>
                navigation.navigate('ProviderReviews', {
                  providerId: undefined,
                  providerName: agency ?? undefined,
                })
              }
              isLast={lastAgencyRow === 4}
            />
          ) : null}
        </View>
      ) : null}

      <View style={styles.sectionCard}>
        <Text style={styles.sectionHeaderTitle}>{t('SUPPORT')}</Text>

        <SettingsMenuItem
          iconName="alert-triangle"
          iconColor="#D97706"
          iconBg="#FEF3C7"
          label={t('Report a Problem')}
          subtitle={t('Submit an issue or support request')}
          onPress={() => navigation.navigate('ReportProblem')}
        />

        <SettingsMenuItem
          iconName="file-text"
          iconColor="#7C3AED"
          iconBg="#F3E8FF"
          label={t('Terms & Conditions')}
          subtitle={t('Provider agreement terms')}
          onPress={() => navigation.navigate('TermsAndConditions')}
        />

        <SettingsMenuItem
          iconName="shield"
          iconColor="#15803D"
          iconBg="#DCFCE7"
          label={t('Privacy Policy')}
          subtitle={t('Data privacy & security policies')}
          onPress={() => navigation.navigate('PrivacyPolicy')}
          isLast={true}
        />
      </View>

      <View style={styles.dangerSection}>
        <TouchableOpacity style={styles.logoutButton} onPress={confirmLogout} activeOpacity={0.8}>
          <Icon name="logout" size={18} color="#DC2626" />
          <Text style={styles.logoutText}>{t('Log Out')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.versionText}>{t('Proxi Staff App • Version {{version}}', { version: '1.0.0' })}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  scroll: { paddingBottom: 40 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarWrap: { marginRight: 14 },
  avatarImage: { width: 54, height: 54, borderRadius: 27 },
  avatarBadge: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primaryAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontSize: 22, fontWeight: '700' },
  profileInfo: { flex: 1 },
  userName: { fontSize: 17, fontWeight: '700', color: colors.textDarker },
  userEmail: { fontSize: 12, color: colors.gray, marginTop: 2 },
  roleTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F0FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 6,
  },
  roleTagText: { fontSize: 11, color: '#1D4ED8', fontWeight: '600' },
  editProfileBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  editProfileBtnText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  sectionCard: {
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A0A0A0',
    letterSpacing: 0.8,
    marginBottom: 12,
    marginTop: 4,
  },
  accessCaption: { fontSize: 12, color: colors.gray, marginBottom: 12, lineHeight: 18 },
  emptyServices: { fontSize: 13, color: colors.grayLight, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  serviceChip: { backgroundColor: colors.backgroundLight, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  serviceChipText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: '#F2F2F2' },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  textWrap: { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: '600', color: colors.textDarker },
  menuSubtitle: { fontSize: 12, color: colors.gray, marginTop: 2 },
  dangerSection: { marginHorizontal: 16, marginTop: 8, marginBottom: 16 },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#DC2626' },
  footer: { alignItems: 'center', marginTop: 8, marginBottom: 20 },
  versionText: { fontSize: 12, color: '#9CA3AF' },
});
