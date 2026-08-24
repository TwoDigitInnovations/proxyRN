import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text } from '../../components/Text';
import { TextField } from '../../components/TextField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { authApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useUi } from '../../context/UiContext';
import { colors } from '../../theme/colors';
import { fontFamilies } from '../../theme/typography';
import { Icon } from '../../components/Icon';
import type { RootStackParamList } from '../../navigation/types';

import { sanitizeEmail, sanitizePassword, validateEmail } from '../../utils/validation';

type Props = NativeStackScreenProps<RootStackParamList, 'SignIn'>;

export default function SignIn({ navigation }: Props) {
  const { t } = useTranslation();
  const { login } = useAuth();
  const { showLoading, hideLoading, showToast } = useUi();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Status Alert Modal State
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [statusType, setStatusType] = useState<'Suspended' | 'Pending'>('Pending');
  const [statusMessage, setStatusMessage] = useState('');

  const emailValidation = validateEmail(email);
  const emailError = submitted && emailValidation ? t(emailValidation) : undefined;
  const passwordError = submitted && !password ? t('Password is required.') : undefined;

  async function handleSignIn() {
    setSubmitted(true);
    if (emailValidation || !password) {
      return;
    }

    showLoading();
    try {
      const res: any = await authApi.login({ email: email.trim().toLowerCase(), password });
      await login(res.token, res.user);
      showToast(t('You are successfully logged in'));
      setSubmitted(false);
      setEmail('');
      setPassword('');
    } catch (err: any) {
      console.log('SignIn error:', err);
      const msg = err instanceof ApiError ? err.message : t('Something went wrong');

      if (err instanceof ApiError && (err.status === 403 || msg.toLowerCase().includes('suspended') || msg.toLowerCase().includes('pending') || msg.toLowerCase().includes('review'))) {
        if (msg.toLowerCase().includes('suspended')) {
          setStatusType('Suspended');
        } else {
          setStatusType('Pending');
        }
        setStatusMessage(msg);
        setStatusModalVisible(true);
      } else {
        showToast(msg);
      }
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
            <Text style={styles.subText}>{t('Please enter your sign in details.')}</Text>
          </View>

          <Image source={require('../../assets/images/bgImg.png')} style={styles.bgImage} resizeMode="contain" />

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
            label={t('Password')}
            placeholder="**************"
            secureTextEntry
            maxLength={64}
            value={password}
            onChangeText={value => setPassword(sanitizePassword(value))}
            error={passwordError}
          />

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

          <PrimaryButton title={t('Sign in')} onPress={handleSignIn} style={styles.signInButton} />

          <Text style={styles.accountText}>
            {t("Didn't have any account?")}{' '}
            <Text style={styles.link} onPress={() => navigation.navigate('SignUp')}>
              {t('Sign up')}
            </Text>
          </Text>

          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={styles.forgotPassword}>{t('Forget Password ?')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Account Status Alert Modal Pop-up */}
      <Modal visible={statusModalVisible} animationType="fade" transparent onRequestClose={() => setStatusModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Header Icon Circle */}
            <View style={[styles.iconCircle, statusType === 'Suspended' ? styles.iconBgDanger : styles.iconBgWarning]}>
              <Icon
                name={statusType === 'Suspended' ? 'alert-triangle' : 'shield'}
                size={34}
                color={statusType === 'Suspended' ? '#DC2626' : '#D97706'}
              />
            </View>

            {/* Title */}
            <Text style={styles.modalTitle}>
              {statusType === 'Suspended' ? t('Account Suspended') : t('Verification Pending')}
            </Text>

            {/* Subtitle Message */}
            <Text style={styles.modalBody}>
              {statusMessage ||
                (statusType === 'Suspended'
                  ? t('Your account has been suspended by Admin. Please contact support.')
                  : t('Your account is under review by Admin. You will be notified once verified.'))}
            </Text>

            {/* Support Note */}
            <View style={styles.supportBox}>
              <Icon name="file-text" size={14} color={colors.primaryAlt} />
              <Text style={styles.supportText}>
                {t('Questions? Reach us at {{email}}', { email: 'support@proxi.com' })}
              </Text>
            </View>

            {/* Action Button */}
            <PrimaryButton
              title={t('Understand & Close')}
              onPress={() => setStatusModalVisible(false)}
              style={styles.modalBtn}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.white },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  welcomeBlock: { alignItems: 'flex-start' },
  welcomeText: { fontSize: 28, fontWeight: '700', color: colors.textDarker, marginBottom: 3 },
  subText: { fontSize: 14, color: colors.border },
  bgImage: { height: 200, width: 200, alignSelf: 'center', marginVertical: 20 },
  termsText: { fontSize: 12, lineHeight: 16, textAlign: 'center', color: colors.border, paddingVertical: 30 },
  link: { fontWeight: '700', color: colors.border },
  signInButton: { shadowColor: colors.overlayBlue, shadowOpacity: 1, shadowRadius: 20, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  accountText: { fontSize: 12, textAlign: 'center', color: colors.border, paddingVertical: 20, fontFamily: fontFamilies.poppins.regular },
  forgotPassword: { fontSize: 12, fontWeight: '700', textAlign: 'center', color: colors.border },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconBgDanger: {
    backgroundColor: '#FEE2E2',
  },
  iconBgWarning: {
    backgroundColor: '#FEF3C7',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textDarker,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalBody: {
    fontSize: 14,
    color: colors.textDark,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  supportBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFE8DA',
  },
  supportText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryAlt,
  },
  modalBtn: {
    width: '100%',
  },
});
