import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text } from '../../components/Text';
import { TextField } from '../../components/TextField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { authApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useUi } from '../../context/UiContext';
import { colors } from '../../theme/colors';
import type { RootStackParamList } from '../../navigation/types';

import {
  OTP_LENGTH,
  sanitizeEmail,
  sanitizeOtp,
  sanitizePassword,
  validateEmail,
  validateOtp,
  validatePassword,
} from '../../utils/validation';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

export default function ForgotPassword({ navigation }: Props) {
  const { t } = useTranslation();
  const { showLoading, hideLoading, showToast } = useUi();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const tr = (key?: string) => (key ? t(key) : undefined);

  const emailError = submitted ? tr(validateEmail(email)) : undefined;
  const otpError = submitted ? tr(validateOtp(otp)) : undefined;
  const passwordError = submitted ? tr(validatePassword(password)) : undefined;
  const confirmPasswordError = submitted && !confirmPassword
    ? t('Confirm password is required.')
    : submitted && confirmPassword !== password
    ? t("Confirm password don't match with password")
    : undefined;

  async function sendOTP() {
    const res: any = await authApi.sendOTP({ email: email.trim().toLowerCase() });
    showToast(res?.data?.message ?? t('OTP sent'));
    setToken(res?.data?.token ?? '');
    setEmail('');
    setStep(2);
  }

  async function verifyOTP() {
    const res: any = await authApi.verifyOTP({ otp, token });
    showToast(res?.data?.message ?? t('OTP verified'));
    setToken(res?.data?.token ?? token);
    setOtp('');
    setStep(3);
  }

  async function changePassword() {
    if (password !== confirmPassword) {
      showToast(t("Confirm password don't match with password"));
      return;
    }
    const res: any = await authApi.changePassword({ password, token });
    showToast(res?.data?.message ?? t('Password changed'));
    setPassword('');
    setConfirmPassword('');
    setStep(1);
    navigation.navigate('SignIn');
  }

  async function handleSubmit() {
    setSubmitted(true);
    if (step === 1 && validateEmail(email)) return;
    if (step === 2 && validateOtp(otp)) return;
    if (step === 3 && (validatePassword(password) || password !== confirmPassword)) return;

    showLoading();
    try {
      if (step === 1) await sendOTP();
      else if (step === 2) await verifyOTP();
      else await changePassword();
      setSubmitted(false);
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>

        <View style={styles.welcomeBlock}>
          <Text style={styles.welcomeText}>{t('Forgot password')}</Text>
        </View>

        <Image source={require('../../assets/images/forgotPasswordBg.png')} style={styles.bgImage} resizeMode="contain" />

        {step === 1 && (
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
        )}

        {step === 2 && (
          <TextField
            label={t('OTP')}
            placeholder="******"
            keyboardType="number-pad"
            maxLength={OTP_LENGTH}
            value={otp}
            onChangeText={value => setOtp(sanitizeOtp(value))}
            error={otpError}
          />
        )}

        {step === 3 && (
          <>
            <TextField
              label={t('Enter Password')}
              placeholder="**************"
              secureTextEntry
              maxLength={64}
              value={password}
              onChangeText={value => setPassword(sanitizePassword(value))}
              error={passwordError}
            />
            <TextField
              label={t('Enter Confirm Password')}
              placeholder="**************"
              secureTextEntry
              maxLength={64}
              value={confirmPassword}
              onChangeText={value => setConfirmPassword(sanitizePassword(value))}
              error={confirmPasswordError}
            />
          </>
        )}

        <PrimaryButton title={t('Save')} onPress={handleSubmit} style={styles.saveButton} />
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.white },
  scroll: { flexGrow: 1, padding: 20 },
  backButton: { width: 32, height: 32, justifyContent: 'center' },
  backIcon: { fontSize: 28, color: colors.textDarker },
  welcomeBlock: { marginTop: 12 },
  welcomeText: { fontSize: 28, fontWeight: '700', color: colors.textDarker },
  bgImage: { height: 200, width: 200, alignSelf: 'center', marginVertical: 20 },
  saveButton: { marginTop: 30 },
});
