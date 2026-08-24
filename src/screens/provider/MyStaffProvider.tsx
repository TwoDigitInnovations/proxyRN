import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Text';
import { TextField } from '../../components/TextField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { EmptyState } from '../../components/EmptyState';
import { serviceApi, staffApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useUi } from '../../context/UiContext';
import { colors } from '../../theme/colors';
import {
  PASSWORD_MAX,
  sanitizeEmail,
  sanitizeName,
  sanitizePassword,
  sanitizePhone,
  validateEmail,
  validateName,
  validatePassword,
  validatePhone,
  EMAIL_MAX,
  NAME_MAX,
  PHONE_MAX_DIGITS,
} from '../../utils/validation';
import type { ServiceListing, StaffMember } from '../../types/models';

export default function MyStaffProvider() {
  const { t } = useTranslation();
  const { showLoading, hideLoading, showToast } = useUi();

  const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [services, setServices] = useState<ServiceListing[]>([]);

  const [staffId, setStaffId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  async function loadStaff() {
    try {
      const [staffRes, serviceRes]: [any, any] = await Promise.all([
        staffApi.getStaff(),
        serviceApi.getService(),
      ]);
      setStaffList(staffRes?.data ?? []);
      const resData = serviceRes?.data;
      setServices(Array.isArray(resData) ? resData : resData ? [resData] : []);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t('Unable to load staff'));
    }
  }

  useEffect(() => {
    loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setStaffId(null);
    setName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setSelectedServices([]);
    setIsActive(true);
    setSubmitted(false);
  }

  function startAddStaff() {
    if (services.length === 0) {
      showToast(t('Create a service first, then assign staff to it.'));
      return;
    }
    resetForm();
    setViewMode('form');
  }

  function startEditStaff(member: StaffMember) {
    setStaffId(member._id);
    setName(member.name ?? '');
    setEmail(member.email ?? '');
    setPhone(member.phone ?? '');
    // The password is never sent back: an empty box means "keep the old one".
    setPassword('');
    setSelectedServices((member.assigned_services ?? []).map(item => item._id));
    setIsActive(member.isActive !== false);
    setSubmitted(false);
    setViewMode('form');
  }

  function toggleService(id: string) {
    setSelectedServices(prev => (prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]));
  }

  function handleRemoveStaff(member: StaffMember) {
    Alert.alert(
      t('Remove Staff'),
      t('Remove {{name}}? They will no longer be able to sign in.', { name: member.name }),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Remove'),
          style: 'destructive',
          onPress: async () => {
            showLoading();
            try {
              await staffApi.deleteStaff(member._id);
              showToast(t('Staff member removed'));
              await loadStaff();
            } catch (err) {
              showToast(err instanceof ApiError ? err.message : t('Failed to remove staff member'));
            } finally {
              hideLoading();
            }
          },
        },
      ],
    );
  }

  const tr = (key?: string) => (key ? t(key) : undefined);

  const nameValidation = validateName(name);
  const emailValidation = validateEmail(email);
  // On edit, a blank password is allowed and simply leaves the old one in place.
  const passwordValidation = staffId && !password ? undefined : validatePassword(password);
  const phoneValidation = phone ? validatePhone(phone) : undefined;

  const nameError = submitted ? tr(nameValidation) : undefined;
  const emailError = submitted ? tr(emailValidation) : undefined;
  const passwordError = submitted ? tr(passwordValidation) : undefined;
  const phoneError = submitted ? tr(phoneValidation) : undefined;
  const servicesError = submitted && selectedServices.length === 0 ? t('Select at least one service.') : undefined;

  async function handleSave() {
    setSubmitted(true);
    if (nameValidation || emailValidation || passwordValidation || phoneValidation || selectedServices.length === 0) {
      return;
    }

    showLoading();
    try {
      const payload = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        assigned_services: selectedServices,
      };

      if (staffId) {
        await staffApi.updateStaff({
          ...payload,
          id: staffId,
          isActive,
          ...(password ? { password } : {}),
        });
        showToast(t('Staff member updated'));
      } else {
        await staffApi.createStaff({ ...payload, password });
        showToast(t('Staff member added'));
      }
      resetForm();
      await loadStaff();
      setViewMode('list');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t('Something went wrong'));
    } finally {
      hideLoading();
    }
  }

  if (viewMode === 'list') {
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.topHeader}>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>{t('My Staff')}</Text>
            <Text style={styles.headerSubtitle}>
              {t('{{total}} staff accounts', { total: staffList.length })}
            </Text>
          </View>
          <TouchableOpacity style={styles.createBtn} onPress={startAddStaff}>
            <Text style={styles.createBtnText}>{t('+ Add Staff')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.caption}>
          {t('Staff sign in with the email and password you set here, and only see the services you assign to them.')}
        </Text>

        {staffList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <EmptyState message={t('No staff added yet.')} />
            <PrimaryButton title={t('+ Add First Staff')} onPress={startAddStaff} style={styles.firstBtn} />
          </View>
        ) : (
          <View style={styles.cardList}>
            {staffList.map(member => (
              <View key={member._id} style={styles.staffCard}>
                <View style={styles.cardTopRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{(member.name ?? 'S').charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.cardHeadings}>
                    <Text style={styles.cardTitle}>{member.name}</Text>
                    <Text style={styles.cardEmail} numberOfLines={1}>
                      {member.email}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, member.isActive === false && styles.statusBadgeOff]}>
                    <Text style={[styles.statusBadgeText, member.isActive === false && styles.statusBadgeTextOff]}>
                      {member.isActive === false ? t('Disabled') : t('Active')}
                    </Text>
                  </View>
                </View>

                <Text style={styles.assignedLabel}>
                  {t('{{total}} services assigned', { total: member.assigned_services?.length ?? 0 })}
                </Text>
                <View style={styles.chipRow}>
                  {(member.assigned_services ?? []).map(service => (
                    <View key={service._id} style={styles.assignedChip}>
                      <Text style={styles.assignedChipText}>{service.service_name}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.editBtn} onPress={() => startEditStaff(member)}>
                    <Text style={styles.editBtnText}>✏️ {t('Edit')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleRemoveStaff(member)}>
                    <Text style={styles.deleteBtnText}>🗑️ {t('Remove')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.formHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setViewMode('list')}>
          <Text style={styles.backBtnText}>{t('← Back to List')}</Text>
        </TouchableOpacity>
        <Text style={styles.formTitle}>{staffId ? t('Edit Staff') : t('Add Staff')}</Text>
      </View>

      <TextField
        label={t('Staff Name')}
        value={name}
        onChangeText={value => setName(sanitizeName(value))}
        maxLength={NAME_MAX}
        error={nameError}
      />

      <TextField
        label={t('Email')}
        value={email}
        onChangeText={value => setEmail(sanitizeEmail(value))}
        maxLength={EMAIL_MAX}
        autoCapitalize="none"
        keyboardType="email-address"
        error={emailError}
      />

      <TextField
        label={t('Phone (optional)')}
        value={phone}
        onChangeText={value => setPhone(sanitizePhone(value))}
        maxLength={PHONE_MAX_DIGITS + 1}
        keyboardType="phone-pad"
        error={phoneError}
      />

      <TextField
        label={staffId ? t('New Password (leave blank to keep current)') : t('Password')}
        value={password}
        onChangeText={value => setPassword(sanitizePassword(value))}
        maxLength={PASSWORD_MAX}
        autoCapitalize="none"
        secureTextEntry
        error={passwordError}
      />

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>{t('Assigned Services')}</Text>
        <Text style={styles.hint}>{t('Tap to select. Staff can only see what you pick here.')}</Text>
        <View style={styles.chipRow}>
          {services.map(service => {
            const active = selectedServices.includes(service._id);
            return (
              <TouchableOpacity
                key={service._id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggleService(service._id)}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {active ? '✓ ' : ''}
                  {service.service_name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {servicesError ? <Text style={styles.error}>{servicesError}</Text> : null}
      </View>

      {staffId ? (
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.switchTitle}>{t('Account Active')}</Text>
            <Text style={styles.hint}>{t('Turn off to block sign in without deleting the account.')}</Text>
          </View>
          <Switch
            value={isActive}
            onValueChange={setIsActive}
            trackColor={{ true: colors.primaryAlt, false: '#D1D5DB' }}
          />
        </View>
      ) : null}

      <PrimaryButton
        title={staffId ? t('Update Staff') : t('Save Staff')}
        onPress={handleSave}
        style={styles.button}
      />
      <TouchableOpacity style={styles.cancelBtn} onPress={() => setViewMode('list')}>
        <Text style={styles.cancelBtnText}>{t('Cancel')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 60 },
  topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.textDarker },
  headerSubtitle: { fontSize: 13, color: colors.gray, marginTop: 2 },
  createBtn: { backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  createBtnText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  caption: { fontSize: 13, color: colors.gray, marginTop: 14, marginBottom: 18, lineHeight: 19 },
  emptyContainer: { marginTop: 30, alignItems: 'center' },
  firstBtn: { marginTop: 20, width: '80%' },
  cardList: { gap: 16 },
  staffCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.backgroundLightAlt,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primaryAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: colors.white, fontSize: 18, fontWeight: '700' },
  cardHeadings: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.textDarker },
  cardEmail: { fontSize: 12, color: colors.gray, marginTop: 2 },
  statusBadge: { backgroundColor: '#DCFCE7', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeOff: { backgroundColor: '#FEE2E2' },
  statusBadgeText: { fontSize: 11, fontWeight: '600', color: '#15803D' },
  statusBadgeTextOff: { color: '#DC2626' },
  assignedLabel: { fontSize: 12, fontWeight: '600', color: colors.textDark, marginTop: 14, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  assignedChip: { backgroundColor: colors.backgroundLight, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  assignedChipText: { fontSize: 11, color: colors.primary, fontWeight: '600' },
  cardActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  editBtn: { flex: 1, borderWidth: 1, borderColor: colors.primary, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  editBtnText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  deleteBtn: { flex: 1, borderWidth: 1, borderColor: '#e53935', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  deleteBtnText: { fontSize: 13, color: '#e53935', fontWeight: '600' },
  formHeader: { marginBottom: 6 },
  backBtn: { marginBottom: 10 },
  backBtnText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  formTitle: { fontSize: 20, fontWeight: '700', color: colors.textDarker },
  fieldWrap: { marginTop: 20 },
  label: { fontSize: 13, color: colors.gray, marginBottom: 4 },
  hint: { fontSize: 12, color: colors.grayLight, marginBottom: 10 },
  error: { fontSize: 13, color: 'red', marginTop: 5 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipActive: { backgroundColor: colors.primaryAlt, borderColor: colors.primaryAlt },
  chipText: { fontSize: 13, color: colors.textDark },
  chipTextActive: { color: colors.white },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22 },
  switchText: { flex: 1, marginRight: 12 },
  switchTitle: { fontSize: 15, fontWeight: '600', color: colors.textDarker, marginBottom: 2 },
  button: { marginTop: 28 },
  cancelBtn: { alignItems: 'center', marginTop: 14, paddingVertical: 10 },
  cancelBtnText: { color: colors.gray, fontSize: 14 },
});
