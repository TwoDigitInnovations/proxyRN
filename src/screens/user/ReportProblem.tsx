import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Text';
import { colors } from '../../theme/colors';
import { reportApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useUi } from '../../context/UiContext';
import { DESCRIPTION_MAX, sanitizeText, SUBJECT_MAX } from '../../utils/validation';

// Values stay in English: they are sent to the API. Only the label is translated.
const PROBLEM_CATEGORIES = [
  'Booking Issue',
  'Technical Bug',
  'Account & Profile',
  'Payment / Billing',
  'Other'
];

export default function ReportProblem() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { showToast } = useUi();

  const [selectedCategory, setSelectedCategory] = useState<string>('Booking Issue');
  const [subject, setSubject] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  async function handleSubmit() {
    if (subject.trim().length < 5) {
      Alert.alert(t('Validation Error'), t('Please enter a subject or title for your problem.'));
      return;
    }
    if (description.trim().length < 10) {
      Alert.alert(t('Validation Error'), t('Please describe your problem in detail.'));
      return;
    }

    setIsSubmitting(true);
    try {
      await reportApi.createReport({
        category: selectedCategory,
        subject: subject.trim(),
        description: description.trim(),
      });

      Alert.alert(
        t('Report Submitted'),
        t('Thank you for reporting your issue. Our support team will review your report shortly.'),
        [
          {
            text: t('OK'),
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : t('Failed to submit report. Please try again.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Text style={styles.heading}>{t('Describe Your Problem')}</Text>
      <Text style={styles.subHeading}>
        {t('Please select a category and fill in the details below so our support team can assist you.')}
      </Text>

      {/* Category Selection */}
      <Text style={styles.label}>{t('Select Category')}</Text>
      <View style={styles.categoryContainer}>
        {PROBLEM_CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.categoryChip,
              selectedCategory === cat && styles.categoryChipActive
            ]}
            onPress={() => setSelectedCategory(cat)}>
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === cat && styles.categoryChipTextActive
              ]}>
              {t(cat)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Subject Input */}
      <Text style={styles.label}>{t('Subject / Issue Title')}</Text>
      <TextInput
        style={styles.textInput}
        placeholder={t('e.g. Unable to book appointment slot')}
        placeholderTextColor="#9e9e9e"
        value={subject}
        onChangeText={value => setSubject(sanitizeText(value, SUBJECT_MAX))}
        maxLength={SUBJECT_MAX}
      />

      {/* Description Input */}
      <Text style={styles.label}>{t('Detailed Description')}</Text>
      <TextInput
        style={[styles.textInput, styles.textArea]}
        placeholder={t('Please describe the issue in detail, including any error messages...')}
        placeholderTextColor="#9e9e9e"
        multiline
        numberOfLines={6}
        textAlignVertical="top"
        value={description}
        onChangeText={value => setDescription(sanitizeText(value, DESCRIPTION_MAX))}
        maxLength={DESCRIPTION_MAX}
      />

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        disabled={isSubmitting}
        onPress={handleSubmit}>
        <Text style={styles.submitButtonText}>
          {isSubmitting ? t('Submitting Report...') : t('Submit Report')}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: 6,
  },
  subHeading: {
    fontSize: 13,
    color: colors.gray,
    marginBottom: 20,
    lineHeight: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 8,
    marginTop: 12,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  categoryChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.backgroundLight,
  },
  categoryChipActive: {
    backgroundColor: colors.primaryAlt,
    borderColor: colors.primaryAlt,
  },
  categoryChipText: {
    fontSize: 13,
    color: colors.textDark,
  },
  categoryChipTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.textDark,
    backgroundColor: colors.backgroundLight,
  },
  textArea: {
    height: 140,
  },
  submitButton: {
    backgroundColor: colors.primaryAlt,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
