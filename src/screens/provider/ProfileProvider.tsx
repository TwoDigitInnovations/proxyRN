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
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Text';
import { TextField } from '../../components/TextField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { InfoRow, SectionCard } from '../../components/SectionCard';
import { authApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useUi } from '../../context/UiContext';
import { pickImage, pickMultipleImages } from '../../utils/imagePicker';
import { colors } from '../../theme/colors';
import { Icon } from '../../components/Icon';
import {
  NAME_MAX,
  sanitizeEmail,
  sanitizeName,
  sanitizePhone,
  sanitizeText,
  validateEmail,
  validateName,
  validatePhone,
} from '../../utils/validation';
import type { SubscriptionSummary, UserProfile } from '../../types/models';

const MAX_DOCUMENTS = 5;

interface ProfileSnapshot {
  name: string;
  email: string;
  phone: string;
  company: string;
  aboutUs: string;
  photoUri?: string;
  documents: string[];
}

export default function ProfileProvider() {
  const { t } = useTranslation();
  const { userDetail, updateUserDetail } = useAuth();
  const { showLoading, hideLoading, showToast } = useUi();

  const [isEdit, setIsEdit] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [aboutUs, setAboutUs] = useState('');
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);
  const [newPhoto, setNewPhoto] = useState<{ uri: string; type: string; name: string } | null>(null);
  const [existingDocuments, setExistingDocuments] = useState<string[]>([]);
  const [newDocuments, setNewDocuments] = useState<{ uri: string; type: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  // getProfile carries the provider's live plan, so no second request here.
  const [plan, setPlan] = useState<SubscriptionSummary | null>(null);

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
          setCompany(profile.company ?? '');
          setAboutUs(profile.about_us ?? '');
          setPhotoUri(profile.profile);
          setExistingDocuments(profile.document ?? []);
          setPlan(profile.subscription ?? null);
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
    snapshot.current = { name, email, phone, company, aboutUs, photoUri, documents: existingDocuments };
    setIsEdit(true);
  }

  function cancelEditing() {
    const saved = snapshot.current;
    if (saved) {
      setName(saved.name);
      setEmail(saved.email);
      setPhone(saved.phone);
      setCompany(saved.company);
      setAboutUs(saved.aboutUs);
      setPhotoUri(saved.photoUri);
      setExistingDocuments(saved.documents);
    }
    setNewPhoto(null);
    setNewDocuments([]);
    setSubmitted(false);
    setIsEdit(false);
  }

  async function handlePickPhoto() {
    const asset = await pickImage();
    if (!asset?.uri) return;
    setPhotoUri(asset.uri);
    setNewPhoto({ uri: asset.uri, type: asset.type ?? 'image/jpeg', name: asset.fileName ?? 'profile.jpg' });
  }

  async function handlePickDocuments() {
    const remaining = MAX_DOCUMENTS - existingDocuments.length - newDocuments.length;
    if (remaining <= 0) return;
    const assets = await pickMultipleImages(remaining);
    const picked = assets
      .filter(a => a.uri)
      .slice(0, remaining)
      .map(a => ({ uri: a.uri as string, type: a.type ?? 'image/jpeg', name: a.fileName ?? 'document.jpg' }));
    setNewDocuments(prev => [...prev, ...picked]);
  }

  function removeExistingDocument(uri: string) {
    setExistingDocuments(prev => prev.filter(d => d !== uri));
  }

  function removeNewDocument(uri: string) {
    setNewDocuments(prev => prev.filter(d => d.uri !== uri));
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
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('email', email.trim().toLowerCase());
      formData.append('phone', phone);
      formData.append('company', company.trim());
      formData.append('about_us', aboutUs.trim());
      formData.append('oldImages', JSON.stringify(existingDocuments));
      if (newPhoto) {
        formData.append('profile', newPhoto as unknown as Blob);
      }
      newDocuments.forEach(doc => {
        formData.append('document', doc as unknown as Blob);
      });
      const res: any = await authApi.updateProfile(formData);
      if (res?.data && userDetail) {
        await updateUserDetail({ ...userDetail, ...res.data });
        setExistingDocuments(res.data.document ?? []);
      }
      showToast(t('Profile updated successfully'));
      setIsEdit(false);
      setSubmitted(false);
      setNewPhoto(null);
      setNewDocuments([]);
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

  const documentCount = existingDocuments.length + newDocuments.length;
  const canAddDocuments = documentCount < MAX_DOCUMENTS;

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
                  <Text style={styles.avatarInitial}>{(name || 'P').charAt(0).toUpperCase()}</Text>
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

          <View style={styles.heroBadgeRow}>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>{t('Service Provider')}</Text>
            </View>
            <View style={[styles.planBadge, plan?.isSubscribed ? styles.planBadgePaid : styles.planBadgeFree]}>
              <Icon name="crown" size={12} color={plan?.isSubscribed ? '#B45309' : colors.grayAlt} />
              <Text
                style={[styles.planBadgeText, plan?.isSubscribed && styles.planBadgeTextPaid]}>
                {plan?.isSubscribed ? plan.planLabel : t('Free')}
              </Text>
            </View>
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
              <TextField
                label={t('Company')}
                value={company}
                onChangeText={value => setCompany(sanitizeText(value, 80))}
                editable
                maxLength={80}
                placeholder={t('Enter your company or business name')}
                style={styles.input}
              />
            </View>
          ) : (
            <View>
              <InfoRow label={t('Name')} value={name} />
              <InfoRow label={t('Email')} value={email} />
              <InfoRow label={t('Phone')} value={phone} />
              <InfoRow label={t('Company')} value={company} last />
            </View>
          )}
        </SectionCard>

        <SectionCard title={t('About us')}>
          {isEdit ? (
            <TextField
              label={t('Tell customers about your service')}
              value={aboutUs}
              onChangeText={setAboutUs}
              editable
              multiline
              maxLength={500}
              placeholder={t('Describe your experience, services and what makes you stand out.')}
              style={[styles.input, styles.textArea]}
            />
          ) : (
            <Text style={[styles.aboutText, !aboutUs && styles.infoValueEmpty]}>
              {aboutUs || t('No description added yet.')}
            </Text>
          )}
        </SectionCard>

        <SectionCard
          title={t('Documents')}
          action={
            <Text style={styles.cardCount}>
              {documentCount}/{MAX_DOCUMENTS}
            </Text>
          }>
          {documentCount === 0 && !isEdit ? (
            <Text style={[styles.aboutText, styles.infoValueEmpty]}>{t('No documents uploaded yet.')}</Text>
          ) : (
            <View style={styles.documentsRow}>
              {existingDocuments.map(uri => (
                <View key={uri} style={styles.documentThumbWrap}>
                  <Image source={{ uri }} style={styles.documentThumb} />
                  {isEdit ? (
                    <TouchableOpacity
                      style={styles.removeBadge}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => removeExistingDocument(uri)}>
                      <Text style={styles.removeBadgeText}>×</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
              {newDocuments.map(doc => (
                <View key={doc.uri} style={styles.documentThumbWrap}>
                  <Image source={{ uri: doc.uri }} style={styles.documentThumb} />
                  {isEdit ? (
                    <TouchableOpacity
                      style={styles.removeBadge}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => removeNewDocument(doc.uri)}>
                      <Text style={styles.removeBadgeText}>×</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
              {isEdit && canAddDocuments ? (
                <TouchableOpacity style={styles.addDocumentButton} onPress={handlePickDocuments} activeOpacity={0.7}>
                  <Text style={styles.addDocumentIcon}>+</Text>
                  <Text style={styles.addDocumentText}>{t('Add')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
          {isEdit ? (
            <Text style={styles.documentsHint}>
              {t('Upload up to {{max}} images of your certificates or IDs.', { max: MAX_DOCUMENTS })}
            </Text>
          ) : null}
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
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  heroBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.white,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  planBadgeFree: { backgroundColor: colors.white },
  planBadgePaid: { backgroundColor: '#FEF3C7' },
  planBadgeText: { fontSize: 12, fontWeight: '700', color: colors.grayAlt },
  planBadgeTextPaid: { color: '#B45309' },
  heroBadgeText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  heroHint: { fontSize: 12, color: colors.grayAlt, marginTop: 12 },

  cardCount: { fontSize: 12, fontWeight: '600', color: colors.primary },
  infoValueEmpty: { color: colors.grayLight },

  fieldStack: { marginTop: -4 },
  input: { backgroundColor: colors.white, borderColor: colors.grayLight, color: colors.textDark },
  textArea: { height: 120, textAlignVertical: 'top', paddingTop: 12 },
  aboutText: { fontSize: 14, lineHeight: 21, color: colors.textDark, marginTop: 12 },

  documentsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14 },
  documentThumbWrap: { position: 'relative' },
  documentThumb: { width: 72, height: 72, borderRadius: 12, backgroundColor: colors.backgroundLightAlt },
  removeBadge: {
    position: 'absolute',
    top: -7,
    right: -7,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.textDarker,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  removeBadgeText: { color: colors.white, fontSize: 13, lineHeight: 15 },
  addDocumentButton: {
    width: 72,
    height: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primaryAlt,
    borderStyle: 'dashed',
    backgroundColor: colors.backgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addDocumentIcon: { fontSize: 22, lineHeight: 26, color: colors.primaryAlt },
  addDocumentText: { fontSize: 11, color: colors.primaryAlt, fontWeight: '600' },
  documentsHint: { fontSize: 12, color: colors.gray, marginTop: 12 },

  fullButton: { marginTop: 24, marginHorizontal: 20 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 24, marginHorizontal: 20 },
  primaryButton: { flex: 1 },
  secondaryButton: { flex: 1, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.grayLight },
  secondaryButtonText: { color: colors.textDark },
});
