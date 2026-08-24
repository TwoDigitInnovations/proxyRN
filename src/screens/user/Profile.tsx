import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import moment from 'moment';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Text';
import { TextField } from '../../components/TextField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { InfoRow, SectionCard } from '../../components/SectionCard';
import { authApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useUi } from '../../context/UiContext';
import { pickImage } from '../../utils/imagePicker';
import { colors } from '../../theme/colors';
import { GOOGLE_MAPS_API_KEY } from '../../config/maps';
import {
  ADDRESS_MAX,
  NAME_MAX,
  sanitizeEmail,
  sanitizeName,
  sanitizePhone,
  sanitizeText,
  validateEmail,
  validateName,
  validatePhone,
} from '../../utils/validation';
import type { Gender, UserProfile } from '../../types/models';

interface PlacePrediction {
  place_id: string;
  description: string;
}

interface ProfileSnapshot {
  name: string;
  email: string;
  phone: string;
  address: string;
  dob?: Date;
  gender?: Gender;
  latitude?: number;
  longitude?: number;
  photoUri?: string;
}

const GENDER_OPTIONS: Gender[] = ['Male', 'Female', 'Other'];

const DOB_PICKER_ANCHOR = moment().subtract(18, 'years').toDate();

function parseDob(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = moment.utc(value);
  if (!parsed.isValid()) return undefined;
  return new Date(parsed.year(), parsed.month(), parsed.date());
}

export default function Profile() {
  const { t } = useTranslation();
  const { userDetail, updateUserDetail } = useAuth();
  const { showLoading, hideLoading, showToast } = useUi();

  const [isEdit, setIsEdit] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [dob, setDob] = useState<Date | undefined>(undefined);
  const [gender, setGender] = useState<Gender | undefined>(undefined);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);
  const [newPhoto, setNewPhoto] = useState<{ uri: string; type: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const predictionsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapshot = useRef<ProfileSnapshot | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res: any = await authApi.getProfile();
        const profile: UserProfile = res?.data;
        if (mounted && profile) {
          setName(profile.name ?? '');
          setEmail(profile.email ?? '');
          setPhone(profile.phone ?? '');
          setAddress(profile.address ?? '');
          setDob(parseDob(profile.dob));
          setGender(profile.gender);
          setLatitude(profile.latitude);
          setLongitude(profile.longitude);
          setPhotoUri(profile.profile);
        }
      } catch (err) {
        showToast(err instanceof ApiError ? err.message : t('Unable to load profile'));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startEditing() {
    snapshot.current = { name, email, phone, address, dob, gender, latitude, longitude, photoUri };
    setIsEdit(true);
  }

  function cancelEditing() {
    const saved = snapshot.current;
    if (saved) {
      setName(saved.name);
      setEmail(saved.email);
      setPhone(saved.phone);
      setAddress(saved.address);
      setDob(saved.dob);
      setGender(saved.gender);
      setLatitude(saved.latitude);
      setLongitude(saved.longitude);
      setPhotoUri(saved.photoUri);
    }
    if (predictionsTimer.current) clearTimeout(predictionsTimer.current);
    setNewPhoto(null);
    setPredictions([]);
    setShowDobPicker(false);
    setSubmitted(false);
    setIsEdit(false);
  }

  async function handlePickPhoto() {
    const asset = await pickImage();
    if (!asset?.uri) return;
    setPhotoUri(asset.uri);
    setNewPhoto({ uri: asset.uri, type: asset.type ?? 'image/jpeg', name: asset.fileName ?? 'profile.jpg' });
  }

  function onDobChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowDobPicker(false);
    if (event.type === 'dismissed') return;
    if (selected) setDob(selected);
  }

  function onChangeAddressText(raw: string) {
    const text = sanitizeText(raw, ADDRESS_MAX);
    setAddress(text);
    setLatitude(undefined);
    setLongitude(undefined);
    if (!isEdit) return;
    if (predictionsTimer.current) clearTimeout(predictionsTimer.current);
    if (!text) {
      setPredictions([]);
      return;
    }
    predictionsTimer.current = setTimeout(async () => {
      try {
        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
          text,
        )}&key=${GOOGLE_MAPS_API_KEY}`;
        const res = await fetch(url);
        const json = await res.json();
        setPredictions(json?.predictions ?? []);
      } catch {
        setPredictions([]);
      }
    }, 400);
  }

  async function onSelectPrediction(prediction: PlacePrediction) {
    setAddress(prediction.description);
    setPredictions([]);
    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&fields=geometry&key=${GOOGLE_MAPS_API_KEY}`;
      const res = await fetch(url);
      const json = await res.json();
      const loc = json?.result?.geometry?.location;
      if (loc) {
        setLatitude(loc.lat);
        setLongitude(loc.lng);
      }
    } catch {
      // Fallback
    }
  }

  const tr = (key?: string) => (key ? t(key) : undefined);

  // Phone stays optional here, but must be a real number once something is typed.
  const phoneValidation = phone ? validatePhone(phone) : undefined;
  const nameError = submitted ? tr(validateName(name)) : undefined;
  const emailError = submitted ? tr(validateEmail(email)) : undefined;
  const phoneError = submitted ? tr(phoneValidation) : undefined;

  async function handleSave() {
    setSubmitted(true);
    if (validateName(name) || validateEmail(email) || phoneValidation) return;

    showLoading();
    try {
      let lat = latitude;
      let lng = longitude;

      if (address && (lat === undefined || lng === undefined)) {
        try {
          const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
            address,
          )}&key=${GOOGLE_MAPS_API_KEY}`;
          const geoRes = await fetch(geoUrl);
          const geoJson = await geoRes.json();
          const location = geoJson?.results?.[0]?.geometry?.location;
          if (location) {
            lat = location.lat;
            lng = location.lng;
            setLatitude(lat);
            setLongitude(lng);
          }
        } catch {
          // Geocode fallback
        }
      }

      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('email', email.trim().toLowerCase());
      formData.append('phone', phone);
      formData.append('address', address);
      if (dob) formData.append('dob', moment(dob).format('YYYY-MM-DD'));
      if (gender) formData.append('gender', gender);
      if (lat !== undefined) formData.append('latitude', String(lat));
      if (lng !== undefined) formData.append('longitude', String(lng));

      if (newPhoto) {
        formData.append('profile', newPhoto as unknown as Blob);
      }

      const res: any = await authApi.updateProfile(formData);
      const updatedUser = res?.data || {};

      if (lat !== undefined && lng !== undefined) {
        await AsyncStorage.setItem(
          'user_saved_location',
          JSON.stringify({ address, latitude: lat, longitude: lng }),
        );
      }

      if (userDetail) {
        await updateUserDetail({ ...userDetail, ...updatedUser, address, latitude: lat, longitude: lng });
      }

      showToast(t('Profile & Location updated successfully'));
      setIsEdit(false);
      setSubmitted(false);
      setPredictions([]);
      setShowDobPicker(false);
      setNewPhoto(null);
      snapshot.current = null;
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t('Something went wrong'));
    } finally {
      hideLoading();
    }
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const dobLabel = dob ? moment(dob).format('DD MMM YYYY') : '';
  const hasCoordinates = latitude !== undefined && longitude !== undefined;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <TouchableOpacity
            onPress={isEdit ? handlePickPhoto : undefined}
            activeOpacity={isEdit ? 0.8 : 1}
            style={styles.avatarWrap}>
            <View style={styles.avatarRing}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarInitial}>{(name || 'U').charAt(0).toUpperCase()}</Text>
                </View>
              )}
            </View>
            {isEdit ? (
              <View style={styles.cameraBadge}>
                <Text style={styles.cameraBadgeIcon}>✎</Text>
              </View>
            ) : null}
          </TouchableOpacity>

          <Text style={styles.heroName} numberOfLines={1}>
            {name || t('Your profile')}
          </Text>
          {email ? (
            <Text style={styles.heroEmail} numberOfLines={1}>
              {email}
            </Text>
          ) : null}

          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{t('Customer')}</Text>
          </View>

          {isEdit ? <Text style={styles.heroHint}>{t('Tap the photo to change it')}</Text> : null}
        </View>

        <SectionCard title={t('Personal details')}>
          {isEdit ? (
            <View style={styles.fieldStack}>
              <TextField
                label={t('Name')}
                value={name}
                onChangeText={value => setName(sanitizeName(value))}
                editable
                autoCapitalize="words"
                maxLength={NAME_MAX}
                placeholder={t('Enter your full name')}
                error={nameError}
                style={styles.input}
              />
              <TextField
                label={t('Email')}
                value={email}
                onChangeText={value => setEmail(sanitizeEmail(value))}
                editable
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={254}
                placeholder="you@example.com"
                error={emailError}
                style={styles.input}
              />
              <TextField
                label={t('Phone')}
                value={phone}
                onChangeText={value => setPhone(sanitizePhone(value))}
                editable
                keyboardType="phone-pad"
                maxLength={16}
                placeholder={t('Enter your phone number')}
                error={phoneError}
                style={styles.input}
              />
            </View>
          ) : (
            <View>
              <InfoRow label={t('Name')} value={name} />
              <InfoRow label={t('Email')} value={email} />
              <InfoRow label={t('Phone')} value={phone} last />
            </View>
          )}
        </SectionCard>

        <SectionCard title={t('About you')}>
          {isEdit ? (
            <View style={styles.fieldStack}>
              <TouchableOpacity onPress={() => setShowDobPicker(true)} activeOpacity={0.7}>
                <View pointerEvents="none">
                  <TextField
                    label={t('Date of Birth')}
                    value={dobLabel}
                    editable={false}
                    placeholder={t('Select your date of birth')}
                    style={styles.input}
                  />
                </View>
              </TouchableOpacity>

              {showDobPicker && (
                <DateTimePicker
                  value={dob ?? DOB_PICKER_ANCHOR}
                  mode="date"
                  maximumDate={new Date()}
                  display={Platform.OS === 'android' ? 'default' : 'spinner'}
                  onChange={onDobChange}
                />
              )}
              {showDobPicker && Platform.OS === 'ios' && (
                <PrimaryButton
                  title={t('Done')}
                  onPress={() => setShowDobPicker(false)}
                  style={styles.doneButton}
                />
              )}

              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>{t('Gender')}</Text>
                <View style={styles.genderRow}>
                  {GENDER_OPTIONS.map(option => {
                    const selected = gender === option;
                    return (
                      <TouchableOpacity
                        key={option}
                        style={[styles.genderChip, selected && styles.genderChipSelected]}
                        onPress={() => setGender(option)}
                        activeOpacity={0.7}>
                        <Text style={[styles.genderChipText, selected && styles.genderChipTextSelected]}>
                          {t(option)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          ) : (
            <View>
              <InfoRow label={t('Date of Birth')} value={dobLabel} />
              <InfoRow label={t('Gender')} value={gender ? t(gender) : undefined} last />
            </View>
          )}
        </SectionCard>

        <SectionCard
          title={t('Location')}
          action={hasCoordinates ? <Text style={styles.cardCount}>{t('Pinned')}</Text> : undefined}>
          {isEdit ? (
            <View style={styles.fieldStack}>
              <TextField
                label={t('Home / City Address')}
                value={address}
                onChangeText={onChangeAddressText}
                editable
                maxLength={ADDRESS_MAX}
                placeholder={t('e.g. Rajajipuram, Lucknow, Uttar Pradesh')}
                style={styles.input}
              />
              {predictions.length > 0 ? (
                <View style={styles.predictionsList}>
                  {predictions.map(item => (
                    <TouchableOpacity
                      key={item.place_id}
                      style={styles.predictionRow}
                      onPress={() => onSelectPrediction(item)}>
                      <Text style={styles.predictionText} numberOfLines={1}>
                        {item.description}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              <Text style={styles.locationHint}>
                {t('Pick a suggestion so we can match you with providers nearby.')}
              </Text>
            </View>
          ) : (
            <Text style={[styles.addressText, !address && styles.infoValueEmpty]}>
              {address || t('No address added yet.')}
            </Text>
          )}
        </SectionCard>

        {isEdit ? (
          <View style={styles.actionRow}>
            <PrimaryButton
              title={t('Cancel')}
              onPress={cancelEditing}
              style={styles.secondaryButton}
              textStyle={styles.secondaryButtonText}
            />
            <PrimaryButton title={t('Save Changes')} onPress={handleSave} style={styles.primaryButton} />
          </View>
        ) : (
          <PrimaryButton title={t('Edit Profile')} onPress={startEditing} style={styles.fullButton} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.white },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  scroll: { paddingBottom: 40 },

  hero: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 28,
    paddingHorizontal: 20,
    backgroundColor: colors.backgroundLight,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  avatarWrap: { marginBottom: 14 },
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
  avatar: { width: 104, height: 104, borderRadius: 52 },
  avatarPlaceholder: { backgroundColor: colors.backgroundLightAlt, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: colors.primary, fontSize: 40, fontWeight: '700' },
  cameraBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primaryAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
  },
  cameraBadgeIcon: { color: colors.white, fontSize: 14, lineHeight: 18 },
  heroName: { fontSize: 20, fontWeight: '700', color: colors.textDarker },
  heroEmail: { fontSize: 13, color: colors.grayAlt, marginTop: 4 },
  heroBadge: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.white,
  },
  heroBadgeText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  heroHint: { fontSize: 12, color: colors.grayAlt, marginTop: 12 },

  cardCount: { fontSize: 12, fontWeight: '600', color: colors.primary },
  infoValueEmpty: { color: colors.grayLight },

  fieldStack: { marginTop: -4 },
  input: { backgroundColor: colors.white, borderColor: colors.grayLight, color: colors.textDark },
  addressText: { fontSize: 14, lineHeight: 21, color: colors.textDark, marginTop: 12 },

  doneButton: { marginTop: 12 },
  fieldWrap: { marginTop: 16 },
  fieldLabel: { fontSize: 13, color: colors.gray, marginBottom: 6 },
  genderRow: { flexDirection: 'row', gap: 10 },
  genderChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.grayLight,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  genderChipSelected: { borderColor: colors.primary, backgroundColor: colors.backgroundLight },
  genderChipText: { fontSize: 15, color: colors.gray },
  genderChipTextSelected: { color: colors.primary, fontWeight: '600' },

  predictionsList: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.backgroundLightAlt,
    overflow: 'hidden',
  },
  predictionRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundLightAlt,
  },
  predictionText: { fontSize: 14, color: colors.textDark },
  locationHint: { fontSize: 12, color: colors.gray, marginTop: 12 },

  fullButton: { marginTop: 24, marginHorizontal: 20 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 24, marginHorizontal: 20 },
  primaryButton: { flex: 1 },
  secondaryButton: { flex: 1, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.grayLight },
  secondaryButtonText: { color: colors.textDark },
});
