import React, { useEffect, useState } from 'react';
import {
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Text } from './Text';
import { PrimaryButton } from './PrimaryButton';
import { StarRating } from './StarRating';
import { KeyboardAwareScrollView, useKeyboardFocusReporter } from './KeyboardAwareScrollView';
import { reviewApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import { useUi } from '../context/UiContext';
import { colors } from '../theme/colors';
import type { Appointment, Review } from '../types/models';

const RATING_LABELS = ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

/** Sits inside the scroll view so it can report focus and be lifted above the keyboard. */
function ReviewInput({ value, onChangeText }: { value: string; onChangeText: (text: string) => void }) {
  const { t } = useTranslation();
  const reportFocus = useKeyboardFocusReporter();

  return (
    <TextInput
      style={styles.input}
      placeholder={t('Share a few words about your experience...')}
      placeholderTextColor={colors.grayLight}
      value={value}
      onChangeText={onChangeText}
      multiline
      numberOfLines={4}
      maxLength={500}
      textAlignVertical="top"
      onFocus={() => reportFocus?.()}
    />
  );
}

interface RateAppointmentSheetProps {
  visible: boolean;
  appointment: Appointment | null;
  onClose: () => void;
  onSubmitted?: (review: Review) => void;
}

export function RateAppointmentSheet({ visible, appointment, onClose, onSubmitted }: RateAppointmentSheetProps) {
  const { t } = useTranslation();
  const { showToast } = useUi();
  const insets = useSafeAreaInsets();

  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Kept so the sheet still shows its appointment while it slides closed.
  const [shown, setShown] = useState<Appointment | null>(appointment);

  useEffect(() => {
    if (appointment) setShown(appointment);
  }, [appointment]);

  const existingReview = shown?.review ?? null;

  useEffect(() => {
    if (visible) {
      setRating(existingReview?.rating ?? 0);
      setMessage(existingReview?.message ?? '');
    }
  }, [visible, existingReview]);

  async function handleSubmit() {
    if (!shown) return;
    if (rating < 1) {
      showToast(t('Please select a star rating.'));
      return;
    }

    setSubmitting(true);
    try {
      const res: any = await reviewApi.createReview({
        appointment: shown._id,
        rating,
        message: message.trim(),
      });
      showToast(t('Thanks for your feedback!'));
      onSubmitted?.(res?.data as Review);
      onClose();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t('Something went wrong'));
    } finally {
      setSubmitting(false);
    }
  }

  const providerName = shown?.service_provider?.name ?? t('Provider');

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAwareScrollView
        style={styles.flex}
        contentContainerStyle={styles.overlay}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.sheet, { paddingBottom: 24 + insets.bottom }]}>
          <View style={styles.handle} />

          <Text style={styles.title}>{existingReview ? t('Edit your review') : t('Rate your visit')}</Text>
          <Text style={styles.subtitle}>
            {t('How was your appointment with {{name}}?', { name: providerName })}
          </Text>

          <View style={styles.starsWrap}>
            <StarRating rating={rating} size={38} gap={10} onChange={setRating} />
            <Text style={[styles.ratingLabel, !rating && styles.ratingLabelEmpty]}>
              {rating ? t(RATING_LABELS[rating - 1]) : t('Tap a star to rate')}
            </Text>
          </View>

          <Text style={styles.label}>{t('Write a review (optional)')}</Text>
          <ReviewInput value={message} onChangeText={setMessage} />

          <PrimaryButton
            title={existingReview ? t('Update Review') : t('Submit Review')}
            style={styles.submit}
            loading={submitting}
            disabled={rating < 1}
            onPress={handleSubmit}
          />

          <TouchableOpacity onPress={onClose} style={styles.cancelBtn} disabled={submitting}>
            <Text style={styles.cancelText}>{t('Cancel')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { flexGrow: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.textDarker },
  subtitle: { fontSize: 14, color: colors.gray, marginTop: 4 },
  starsWrap: { alignItems: 'center', marginTop: 22, marginBottom: 6 },
  ratingLabel: { marginTop: 12, fontSize: 14, fontWeight: '600', color: colors.textDark },
  ratingLabelEmpty: { color: colors.grayLight, fontWeight: '400' },
  label: { fontSize: 13, color: colors.gray, marginTop: 18, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.backgroundLightAlt,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 96,
    color: colors.textDark,
  },
  submit: { marginTop: 20 },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { fontSize: 14, fontWeight: '600', color: colors.gray },
});
