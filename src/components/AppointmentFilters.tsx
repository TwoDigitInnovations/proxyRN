import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import moment from 'moment';
import { useTranslation } from 'react-i18next';
import { Text } from './Text';
import { Icon } from './Icon';
import { colors } from '../theme/colors';

/** Who raised the ticket, as the filter row offers it. */
export type BookedByFilter = 'all' | 'visitor' | 'agency';

export interface AppointmentFilterState {
  /** Free text matched against the visitor, the purpose and the ticket number. */
  search: string;
  /** A single calendar day as `YYYY-MM-DD`, or empty for every day. */
  date: string;
  bookedBy: BookedByFilter;
}

export const emptyAppointmentFilters: AppointmentFilterState = {
  search: '',
  date: '',
  bookedBy: 'all',
};

export function hasActiveFilters(filters: AppointmentFilterState): boolean {
  return Boolean(filters.search.trim()) || Boolean(filters.date) || filters.bookedBy !== 'all';
}

/** Drops the neutral values so the request only carries what the user picked. */
export function appointmentFilterParams(filters: AppointmentFilterState) {
  const params: { search?: string; date?: string; bookedBy?: Exclude<BookedByFilter, 'all'> } = {};
  const term = filters.search.trim();
  if (term) params.search = term;
  if (filters.date) params.date = filters.date;
  if (filters.bookedBy !== 'all') params.bookedBy = filters.bookedBy;
  return params;
}

interface AppointmentFiltersProps {
  value: AppointmentFilterState;
  onChange: (next: AppointmentFilterState) => void;
}

export function AppointmentFilters({ value, onChange }: AppointmentFiltersProps) {
  const { t } = useTranslation();
  const [showPicker, setShowPicker] = useState(false);

  const options: { key: BookedByFilter; label: string }[] = [
    { key: 'all', label: t('All') },
    { key: 'visitor', label: t('Visitor') },
    { key: 'agency', label: t('Provider / Staff') },
  ];

  function onDateChange(event: DateTimePickerEvent, picked?: Date) {
    if (Platform.OS === 'android') setShowPicker(false);
    if (event.type === 'dismissed' || !picked) return;
    onChange({ ...value, date: moment(picked).format('YYYY-MM-DD') });
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.searchBox}>
          <Icon name="search" size={16} color={colors.grayLight} />
          <TextInput
            style={styles.searchInput}
            value={value.search}
            onChangeText={search => onChange({ ...value, search })}
            placeholder={t('Search visitor, purpose or ticket')}
            placeholderTextColor={colors.grayLight}
            autoCorrect={false}
            returnKeyType="search"
          />
          {value.search ? (
            <TouchableOpacity onPress={() => onChange({ ...value, search: '' })} hitSlop={hitSlop}>
              <Icon name="x" size={16} color={colors.grayLight} />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.dateButton, value.date ? styles.dateButtonActive : null]}
          onPress={() => setShowPicker(true)}
          activeOpacity={0.85}>
          <Icon name="calendar" size={16} color={value.date ? colors.white : colors.gray} />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        keyboardShouldPersistTaps="handled">
        {value.date ? (
          <TouchableOpacity
            style={[styles.chip, styles.chipSelected]}
            onPress={() => onChange({ ...value, date: '' })}
            activeOpacity={0.85}>
            <Text style={[styles.chipText, styles.chipTextSelected]}>
              {moment(value.date, 'YYYY-MM-DD').format('DD MMM YYYY')}
            </Text>
            <Icon name="x" size={12} color={colors.white} />
          </TouchableOpacity>
        ) : null}

        {options.map(option => {
          const selected = value.bookedBy === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              style={[styles.chip, selected ? styles.chipSelected : null]}
              onPress={() => onChange({ ...value, bookedBy: option.key })}
              activeOpacity={0.85}>
              <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {showPicker ? (
        <DateTimePicker
          value={value.date ? moment(value.date, 'YYYY-MM-DD').toDate() : new Date()}
          mode="date"
          display={Platform.OS === 'android' ? 'default' : 'spinner'}
          onChange={onDateChange}
        />
      ) : null}
      {showPicker && Platform.OS === 'ios' ? (
        <TouchableOpacity style={styles.doneButton} onPress={() => setShowPicker(false)} activeOpacity={0.85}>
          <Text style={styles.doneText}>{t('Done')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 };

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.backgroundLightAlt,
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.textDarker, padding: 0 },
  dateButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.backgroundLightAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateButtonActive: { backgroundColor: colors.primaryAlt, borderColor: colors.primaryAlt },
  chipRow: { gap: 8, paddingTop: 10, paddingRight: 20 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.backgroundLightAlt,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipSelected: { backgroundColor: colors.primaryAlt, borderColor: colors.primaryAlt },
  chipText: { fontSize: 12, color: colors.gray, fontWeight: '600' },
  chipTextSelected: { color: colors.white },
  doneButton: { alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 8 },
  doneText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
});
