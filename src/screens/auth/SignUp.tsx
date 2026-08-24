import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Asset } from 'react-native-image-picker';
import { Text } from '../../components/Text';
import { TextField } from '../../components/TextField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { authApi, type UserRole } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useUi } from '../../context/UiContext';
import { colors } from '../../theme/colors';
import { Icon } from '../../components/Icon';
import { pickImage } from '../../utils/imagePicker';
import type { RootStackParamList } from '../../navigation/types';

import {
  NAME_MAX,
  sanitizeEmail,
  sanitizeName,
  sanitizePassword,
  sanitizePhone,
  validateEmail,
  validateName,
  validatePassword,
  validatePhone,
} from '../../utils/validation';

type Props = NativeStackScreenProps<RootStackParamList, 'SignUp'>;

export default function SignUp({ navigation }: Props) {
  const { t } = useTranslation();
  const { showLoading, hideLoading, showToast } = useUi();

  const [role, setRole] = useState<UserRole>('user');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [docAsset, setDocAsset] = useState<Asset | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const tr = (key?: string) => (key ? t(key) : undefined);

  const nameError = submitted ? tr(validateName(fullName)) : undefined;
  const emailError = submitted ? tr(validateEmail(email)) : undefined;
  const phoneError = submitted ? tr(validatePhone(phoneNumber, 'Mobile Number is required.')) : undefined;
  const passwordError = submitted ? tr(validatePassword(password)) : undefined;
  const docError =
    submitted && role === 'provider' && !docAsset
      ? t('Verification document is required for providers.')
      : undefined;

  async function handlePickDocument() {
    const asset = await pickImage({ maxWidth: 1280, maxHeight: 1280, quality: 0.7, includeBase64: true });
    if (!asset) return;
    if (!asset.base64) {
      showToast(t('Unable to pick document photo'));
      return;
    }
    setDocAsset(asset);
  }

  async function handleSignUp() {
    setSubmitted(true);
    if (
      validateName(fullName) ||
      validateEmail(email) ||
      validatePhone(phoneNumber, 'Mobile Number is required.') ||
      validatePassword(password)
    ) {
      return;
    }
    if (role === 'provider' && !docAsset) {
      showToast(t('Verification document is required for Provider sign-up'));
      return;
    }

    showLoading();
    try {
      const docPayload: string[] = docAsset?.base64
        ? [`data:${docAsset.type || 'image/jpeg'};base64,${docAsset.base64}`]
        : [];

      const res: any = await authApi.register({
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phoneNumber,
        password,
        role,
        document: docPayload,
      });

      const successMsg =
        res?.message ||
        (role === 'provider'
          ? t('Registration successful! Your provider account is under review by Admin.')
          : t('Sign-up process successful.'));

      showToast(successMsg);
      setSubmitted(false);
      setFullName('');
      setEmail('');
      setPhoneNumber('');
      setPassword('');
      setDocAsset(null);
      navigation.navigate('SignIn');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t('Something went wrong'));
    } finally {
      hideLoading();
    }
  }

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.welcomeBlock}>
            <Text style={styles.welcomeText}>{t('Welcome')}</Text>
            <Text style={styles.subText}>{t('Please enter your sign up details.')}</Text>
          </View>

          <View style={styles.roleRow}>
            <PrimaryButton
              title={t('User')}
              onPress={() => setRole('user')}
              style={[styles.roleButton, role !== 'user' && styles.roleButtonInactive]}
              textStyle={role !== 'user' ? styles.roleButtonTextInactive : undefined}
            />
            <PrimaryButton
              title={t('Provider')}
              onPress={() => setRole('provider')}
              style={[styles.roleButton, role !== 'provider' && styles.roleButtonInactive]}
              textStyle={role !== 'provider' ? styles.roleButtonTextInactive : undefined}
            />
          </View>

          <TextField
            label={t('Name')}
            placeholder={t('Enter Name')}
            value={fullName}
            onChangeText={value => setFullName(sanitizeName(value))}
            autoCapitalize="words"
            maxLength={NAME_MAX}
            error={nameError}
          />
          <TextField
            label={t('Email')}
            placeholder={t('Enter email')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={254}
            value={email}
            onChangeText={value => setEmail(sanitizeEmail(value))}
            error={emailError}
          />
          <TextField
            label={t('Mobile Number')}
            placeholder={t('Enter Mobile Number')}
            keyboardType="phone-pad"
            maxLength={16}
            value={phoneNumber}
            onChangeText={value => setPhoneNumber(sanitizePhone(value))}
            error={phoneError}
          />
          <TextField
            label={t('Password')}
            placeholder="**************"
            secureTextEntry
            maxLength={64}
            value={password}
            onChangeText={value => setPassword(sanitizePassword(value))}
            error={passwordError}
          />

          {/* Provider Verification Document Upload Section */}
          {role === 'provider' && (
            <View style={styles.docSection}>
              <Text style={styles.docSectionTitle}>{t('Identity Verification Document *')}</Text>
              <Text style={styles.docSectionSub}>
                {t('Upload ID card, passport, or business license for Admin review.')}
              </Text>

              {docAsset?.uri ? (
                <View style={styles.docPreviewCard}>
                  <Image source={{ uri: docAsset.uri }} style={styles.docImageThumb} />
                  <View style={styles.docInfoWrap}>
                    <Text style={styles.docFileName} numberOfLines={1}>
                      {docAsset.fileName || 'Verification_Document.jpg'}
                    </Text>
                    <Text style={styles.docFileSize}>{t('Ready for verification')}</Text>
                  </View>
                  <TouchableOpacity style={styles.docRemoveBtn} onPress={() => setDocAsset(null)}>
                    <Icon name="trash" size={18} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.uploadBox} onPress={handlePickDocument} activeOpacity={0.8}>
                  <View style={styles.uploadIconCircle}>
                    <Icon name="file-text" size={24} color={colors.primaryAlt} />
                  </View>
                  <Text style={styles.uploadTitle}>{t('Attach ID Document / License')}</Text>
                  <Text style={styles.uploadSub}>{t('Tap to take a photo or browse your gallery')}</Text>
                </TouchableOpacity>
              )}

              {docError ? <Text style={styles.errorText}>{docError}</Text> : null}
            </View>
          )}

          <Text style={styles.termsText}>
            {t('By clicking Sign up, you agree with our')}{' '}
            <Text style={styles.link} onPress={() => navigation.navigate('TermsAndConditions')}>
              {t('Terms and Conditions')}{' '}
            </Text>
            {t('and')}{' '}
            <Text style={styles.link} onPress={() => navigation.navigate('PrivacyPolicy')}>
              {t('Privacy Policy')}
            </Text>
          </Text>

          <PrimaryButton
            title={role === 'provider' ? t('Submit for Verification') : t('Sign Up')}
            onPress={handleSignUp}
          />

          <Text style={styles.accountText}>
            {t('Already have an account?')}{' '}
            <Text style={styles.link} onPress={() => navigation.navigate('SignIn')}>
              {t('Sign in')}
            </Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.white },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  welcomeBlock: { alignItems: 'flex-start', marginBottom: 12 },
  welcomeText: { fontSize: 28, fontWeight: '700', color: colors.textDarker, marginBottom: 3 },
  subText: { fontSize: 14, color: colors.border },
  roleRow: { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 8 },
  roleButton: { flex: 1 },
  roleButtonInactive: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.primaryAlt },
  roleButtonTextInactive: { color: colors.primaryAlt },
  termsText: { fontSize: 12, lineHeight: 16, textAlign: 'center', color: colors.border, paddingVertical: 20 },
  link: { fontWeight: '700', color: colors.primaryAlt },
  accountText: { fontSize: 12, textAlign: 'center', color: colors.border, paddingVertical: 16 },
  docSection: {
    backgroundColor: '#FFF8F0',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FFE8DA',
  },
  docSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textDarker,
  },
  docSectionSub: {
    fontSize: 12,
    color: colors.gray,
    marginTop: 2,
    marginBottom: 12,
  },
  uploadBox: {
    borderWidth: 1.5,
    borderColor: colors.primaryAlt,
    borderStyle: 'dashed',
    borderRadius: 14,
    backgroundColor: colors.white,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF3E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  uploadTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryAlt,
  },
  uploadSub: {
    fontSize: 11,
    color: colors.gray,
    marginTop: 2,
  },
  docPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  docImageThumb: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  docInfoWrap: {
    flex: 1,
  },
  docFileName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textDark,
  },
  docFileSize: {
    fontSize: 11,
    color: '#15803D',
    fontWeight: '600',
    marginTop: 2,
  },
  docRemoveBtn: {
    padding: 6,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 6,
    fontWeight: '600',
  },
});
