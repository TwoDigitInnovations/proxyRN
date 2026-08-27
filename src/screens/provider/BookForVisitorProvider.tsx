import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import moment from 'moment';
import { Text } from '../../components/Text';
import { TextField } from '../../components/TextField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { EmptyState } from '../../components/EmptyState';
import { PlanStatusNotice } from '../../components/PlanNotice';
import { Icon, type IconName } from '../../components/Icon';
import { appointmentApi, staffApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useUi } from '../../context/UiContext';
import { useNotifications } from '../../context/NotificationContext';
import { colors } from '../../theme/colors';
import {
  CARD_NUMBER_DIGITS,
  CVV_MAX,
  GENDER_OPTIONS,
  NAME_MAX,
  PURPOSE_MAX,
  PURPOSE_MIN,
  sanitizeCardNumber,
  sanitizeCvv,
  sanitizeEmail,
  sanitizeExpiry,
  sanitizeName,
  sanitizePhone,
  sanitizeText,
  validateCardNumber,
  validateCvv,
  validateEmail,
  validateExpiry,
  validateGender,
  validateName,
  validatePhone,
  validateRequiredText,
} from '../../utils/validation';
import {
  SLOT_DATE_FORMAT,
  SLOT_TIME_FORMAT,
  buildBookingDates,
  buildDaySlots,
  formatSlotLabel,
  type BookingDate,
  type TimeSlot,
} from '../../utils/slots';
import { COUNTER_PAYMENT_METHOD, type BookingPaymentMethod, type StaffServiceQueue } from '../../types/models';
import type { RootStackParamList } from '../../navigation/types';

/** The same fee the visitor pays in the app - $5.00 ticket + $0.50 platform fee. */
const TICKET_FEE = 5.5;

const PURPOSE_SUGGESTIONS = [
  'General Consultation',
  'Document Verification',
  'Medical Checkup',
  'Account Opening',
];

const METHODS: { key: BookingPaymentMethod; iconName: IconName; color: string; bg: string }[] = [
  { key: COUNTER_PAYMENT_METHOD, iconName: 'dollar', color: '#15803D', bg: '#DCFCE7' },
  { key: 'Orange Money', iconName: 'smartphone', color: '#EA580C', bg: '#FFF3E0' },
  { key: 'Credit Card', iconName: 'credit-card', color: '#1D4ED8', bg: '#E8F0FE' },
  { key: 'PayPal', iconName: 'dollar', color: '#003087', bg: '#E8F0FE' },
  { key: 'Stripe', iconName: 'zap', color: '#7C3AED', bg: '#F3E8FF' },
];

export default function BookForVisitorProvider() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { userDetail, can, entitlements } = useAuth();
  const { showLoading, hideLoading, showToast } = useUi();
  const { addNotification } = useNotifications();

  const canBook = can('appointments.book') && entitlements.canWrite;

  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<StaffServiceQueue[]>([]);
  const [serviceId, setServiceId] = useState<string | null>(null);

  const [bookingDates, setBookingDates] = useState<BookingDate[]>(buildBookingDates());
  const [selectedDate, setSelectedDate] = useState(buildBookingDates()[0].date);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [purpose, setPurpose] = useState('');

  const [method, setMethod] = useState<BookingPaymentMethod>(COUNTER_PAYMENT_METHOD);
  const [accountNumber, setAccountNumber] = useState('');
  const [paypalEmail, setPaypalEmail] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const service = useMemo(
    () => services.find(item => item._id === serviceId) ?? null,
    [services, serviceId],
  );

  /** Turns a validator's message key into a translated error, or nothing. */
  const tr = (key?: string) => (key ? t(key) : undefined);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res: any = await staffApi.getMyServices();
        if (!mounted) return;
        const list: StaffServiceQueue[] = res?.data?.services ?? [];
        setServices(list);
        if (list.length === 1) setServiceId(list[0]._id);
      } catch (err) {
        if (mounted) showToast(err instanceof ApiError ? err.message : t('Unable to load your services'));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [showToast, t]);

  const loadSlots = useCallback(async (target: StaffServiceQueue, date: string) => {
    setSlotsLoading(true);
    // The service's own slots, so something is on screen before the call lands.
    setTimeSlots(buildDaySlots(date, target.service_slot));
    try {
      const res: any = await appointmentApi.getAvailableSlots(target._id, { date });
      const data = res?.data;
      if (Array.isArray(data?.dates) && data.dates.length > 0) setBookingDates(data.dates);
      if (Array.isArray(data?.slots)) setTimeSlots(data.slots);
    } catch {
      // Offline list already rendered.
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!service) {
      setTimeSlots([]);
      return;
    }
    loadSlots(service, selectedDate);
  }, [service, selectedDate, loadSlots]);

  function onSelectService(id: string) {
    if (id === serviceId) return;
    setServiceId(id);
    setSelectedTime(null);
    setFormError(null);
  }

  function onSelectDate(date: string) {
    if (date === selectedDate) return;
    setSelectedDate(date);
    setSelectedTime(null);
  }

  function validatePurpose(value: string) {
    return validateRequiredText(
      value,
      'Purpose of visit is required.',
      PURPOSE_MIN,
      PURPOSE_MAX,
      'Purpose of visit is too short.',
    );
  }

  /** First failing rule for the selected payment method. Cash needs nothing. */
  function paymentMethodError(): string | undefined {
    if (method === COUNTER_PAYMENT_METHOD) return undefined;
    if (method === 'Orange Money') {
      return validatePhone(accountNumber, 'Mobile/Account Number is required.');
    }
    if (method === 'PayPal') {
      return validateEmail(paypalEmail, 'PayPal Email is required.');
    }
    return validateCardNumber(cardNumber) || validateExpiry(cardExpiry) || validateCvv(cardCvv);
  }

  async function onSubmit() {
    setSubmitted(true);

    if (!service) {
      setFormError(t('Pick the service this visitor is queuing for.'));
      return;
    }
    if (!selectedTime) {
      setFormError(t('Pick a time slot for this visitor.'));
      return;
    }
    const detailError =
      validateName(name) ||
      validateEmail(email) ||
      validatePhone(phone) ||
      validateGender(gender) ||
      validatePurpose(purpose);
    if (detailError) {
      setFormError(t(detailError));
      return;
    }
    const methodError = paymentMethodError();
    if (methodError) {
      setFormError(t(methodError));
      return;
    }
    setFormError(null);

    const payOnCounter = method === COUNTER_PAYMENT_METHOD;
    const fullDate = moment(
      `${selectedDate} ${selectedTime}`,
      `${SLOT_DATE_FORMAT} ${SLOT_TIME_FORMAT}`,
    ).format();

    showLoading();
    try {
      const res: any = await appointmentApi.createAppointment({
        name,
        email,
        phone,
        gender,
        purpose_of_visit: purpose,
        date: moment(selectedDate, SLOT_DATE_FORMAT).format(),
        time: formatSlotLabel(selectedTime),
        service: service._id,
        full_date: fullDate,
        service_ref: service._id,
        paymentMethod: method,
        paymentAmount: TICKET_FEE,
        ...(payOnCounter
          ? { paymentStatus: 'Pending' }
          : {
              transactionId: `TXN-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`,
              paymentStatus: 'Completed',
            }),
      });

      const ticketNum = res?.data?.ticketNumber || 'N/A';
      addNotification(
        t('Ticket issued for {{visitor}}', { visitor: name }),
        t('Ticket #{{ticket}} for {{service}} on {{date}} at {{time}}.', {
          ticket: ticketNum,
          service: service.service_name,
          date: moment(selectedDate, SLOT_DATE_FORMAT).format('DD MMM YYYY'),
          time: formatSlotLabel(selectedTime),
        }),
        'success',
      );

      resetForm();
      navigation.navigate('PaymentSuccess', { appointmentId: res?.data?._id });
    } catch (err) {
      // 409: somebody took the slot while this booking was being filled in.
      if (err instanceof ApiError && err.status === 409) {
        setSelectedTime(null);
        if (service) loadSlots(service, selectedDate);
      }
      showToast(err instanceof ApiError ? err.message : t('Something went wrong'));
    } finally {
      hideLoading();
    }
  }

  function resetForm() {
    setSelectedTime(null);
    setName('');
    setEmail('');
    setPhone('');
    setGender('');
    setPurpose('');
    setAccountNumber('');
    setPaypalEmail('');
    setCardNumber('');
    setCardExpiry('');
    setCardCvv('');
    setMethod(COUNTER_PAYMENT_METHOD);
    setSubmitted(false);
    setFormError(null);
  }

  const nameError = submitted ? tr(validateName(name)) : undefined;
  const emailError = submitted ? tr(validateEmail(email)) : undefined;
  const phoneError = submitted ? tr(validatePhone(phone)) : undefined;
  const genderError = submitted ? tr(validateGender(gender)) : undefined;
  const purposeError = submitted ? tr(validatePurpose(purpose)) : undefined;
  const accountNumberError = submitted
    ? tr(validatePhone(accountNumber, 'Mobile/Account Number is required.'))
    : undefined;
  const paypalEmailError = submitted
    ? tr(validateEmail(paypalEmail, 'PayPal Email is required.'))
    : undefined;
  const cardNumberError = submitted ? tr(validateCardNumber(cardNumber)) : undefined;
  const cardExpiryError = submitted ? tr(validateExpiry(cardExpiry)) : undefined;
  const cardCvvError = submitted ? tr(validateCvv(cardCvv)) : undefined;

  if (loading) {
    return <ActivityIndicator style={styles.loading} size="large" color={colors.primary} />;
  }

  if (services.length === 0) {
    return (
      <EmptyState
        icon="🏢"
        title={t('No services to book into')}
        message={
          userDetail?.role === 'staff'
            ? t('No services assigned to you yet. Ask your provider to assign one.')
            : t('Publish a service with time slots before booking visitors into it.')
        }
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {!entitlements.canWrite ? (
          <PlanStatusNotice entitlements={entitlements} style={styles.notice} />
        ) : null}
        {!can('appointments.book') ? (
          <View style={styles.errorCard}>
            <Icon name="lock" size={18} color="#B91C1C" />
            <Text style={styles.errorCardText}>
              {t('Your provider has not given you access to this feature')}
            </Text>
          </View>
        ) : null}

        <Text style={styles.lead}>
          {t('Raise a queue ticket for a visitor at your counter. They do not need the app.')}
        </Text>

        {/* 1. Which queue */}
        <Text style={styles.stepTitle}>{t('1. Service')}</Text>
        <View style={styles.serviceList}>
          {services.map(item => {
            const active = item._id === serviceId;
            return (
              <TouchableOpacity
                key={item._id}
                activeOpacity={0.85}
                style={[styles.serviceCard, active && styles.serviceCardActive]}
                onPress={() => onSelectService(item._id)}>
                <View style={styles.serviceTextWrap}>
                  <Text style={[styles.serviceName, active && styles.serviceNameActive]} numberOfLines={1}>
                    {item.service_name}
                  </Text>
                  {item.address ? (
                    <Text style={styles.serviceAddress} numberOfLines={1}>
                      {item.address}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.serviceMeta}>
                  <Text style={styles.serviceMetaValue}>{item.waitingCount ?? 0}</Text>
                  <Text style={styles.serviceMetaLabel}>{t('Waiting')}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 2. When */}
        <Text style={styles.stepTitle}>{t('2. Date & time slot')}</Text>
        <View style={styles.chipRow}>
          {bookingDates.map(item => {
            const active = item.date === selectedDate;
            return (
              <TouchableOpacity
                key={item.date}
                style={[styles.dateChip, active && styles.dateChipActive]}
                onPress={() => onSelectDate(item.date)}>
                <Text style={[styles.dateChipWeekday, active && styles.dateChipTextActive]}>
                  {item.isToday ? t('Today') : item.weekday}
                </Text>
                <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {slotsLoading ? <ActivityIndicator style={styles.slotLoader} color={colors.primary} /> : null}
        <View style={styles.chipRow}>
          {timeSlots.map(slot => {
            const active = slot.time === selectedTime;
            const disabled = !slot.isAvailable;
            return (
              <TouchableOpacity
                key={slot.time}
                disabled={disabled}
                style={[styles.slotChip, active && styles.slotChipActive, disabled && styles.slotChipDisabled]}
                onPress={() => {
                  setSelectedTime(slot.time);
                  setFormError(null);
                }}>
                <Text
                  style={[
                    styles.slotChipText,
                    active && styles.dateChipTextActive,
                    disabled && styles.slotChipTextDisabled,
                  ]}>
                  {slot.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {!serviceId ? (
          <Text style={styles.hint}>{t('Pick a service to see its time slots.')}</Text>
        ) : !slotsLoading && timeSlots.length === 0 ? (
          <Text style={styles.hint}>{t('This agency has not opened any time slots yet.')}</Text>
        ) : !slotsLoading && timeSlots.every(slot => !slot.isAvailable) ? (
          <Text style={styles.hint}>{t('No slots left for this day. Please pick another date.')}</Text>
        ) : (
          <Text style={styles.hint}>{t('Each slot is for one visitor only.')}</Text>
        )}

        {/* 3. Who */}
        <Text style={styles.stepTitle}>{t('3. Visitor details')}</Text>
        <Text style={styles.hint}>
          {t('If the email matches an existing account, the ticket also shows up in their app.')}
        </Text>
        <TextField
          label={t('Full Name')}
          value={name}
          onChangeText={value => setName(sanitizeName(value))}
          autoCapitalize="words"
          maxLength={NAME_MAX}
          placeholder={t('Enter full name')}
          error={nameError}
        />
        <TextField
          label={t('Email Address')}
          value={email}
          onChangeText={value => setEmail(sanitizeEmail(value))}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={254}
          placeholder="visitor@example.com"
          error={emailError}
        />
        <TextField
          label={t('Phone Number')}
          value={phone}
          onChangeText={value => setPhone(sanitizePhone(value))}
          keyboardType="phone-pad"
          maxLength={16}
          placeholder="+228 90 00 00 00"
          error={phoneError}
        />

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>{t('Gender')}</Text>
          <View style={styles.chipRow}>
            {GENDER_OPTIONS.map(option => {
              const active = gender.toLowerCase() === option.toLowerCase();
              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.dateChip, active && styles.dateChipActive]}
                  onPress={() => setGender(option)}>
                  <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>
                    {t(option)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {genderError ? <Text style={styles.inlineError}>{genderError}</Text> : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>{t('Purpose of Visit')}</Text>
          <View style={styles.chipRow}>
            {PURPOSE_SUGGESTIONS.map(item => {
              const active = purpose === item;
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.dateChip, active && styles.dateChipActive]}
                  onPress={() => setPurpose(item)}>
                  <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>{t(item)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TextField
            label=""
            value={purpose}
            onChangeText={value => setPurpose(sanitizeText(value, PURPOSE_MAX))}
            maxLength={PURPOSE_MAX}
            placeholder={t('Describe purpose of visit...')}
            error={purposeError}
          />
        </View>

        {/* 4. How it is paid */}
        <Text style={styles.stepTitle}>{t('4. Payment')}</Text>
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('Queue Ticket Fee')}</Text>
            <Text style={styles.summaryVal}>$5.00</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('Service & Platform Fee')}</Text>
            <Text style={styles.summaryVal}>$0.50</Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryTotalRow]}>
            <Text style={styles.summaryTotalLabel}>{t('Total Amount Due')}</Text>
            <Text style={styles.summaryTotalVal}>${TICKET_FEE.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.methodsGrid}>
          {METHODS.map(item => {
            const active = method === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                activeOpacity={0.8}
                style={[
                  styles.methodCard,
                  active && { borderColor: item.color, backgroundColor: item.bg },
                ]}
                onPress={() => {
                  setFormError(null);
                  setMethod(item.key);
                }}>
                <Icon name={item.iconName} size={18} color={active ? item.color : colors.gray} />
                <Text style={[styles.methodLabel, active && { color: item.color, fontWeight: '700' }]}>
                  {item.key === COUNTER_PAYMENT_METHOD ? t(COUNTER_PAYMENT_METHOD) : item.key}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {method === COUNTER_PAYMENT_METHOD ? (
          <View style={styles.counterNote}>
            <Icon name="dollar" size={16} color="#15803D" />
            <Text style={styles.counterNoteText}>
              {t('The ticket is issued straight away and left unpaid. Collect ${{amount}} at the counter.', {
                amount: TICKET_FEE.toFixed(2),
              })}
            </Text>
          </View>
        ) : null}

        {method === 'Orange Money' ? (
          <TextField
            label={t('Orange Money Account / Mobile No.')}
            value={accountNumber}
            onChangeText={value => {
              setFormError(null);
              setAccountNumber(sanitizePhone(value));
            }}
            keyboardType="phone-pad"
            maxLength={16}
            placeholder="+225 0700000000"
            error={accountNumberError}
          />
        ) : null}

        {method === 'PayPal' ? (
          <TextField
            label={t('PayPal Email Address')}
            value={paypalEmail}
            onChangeText={value => {
              setFormError(null);
              setPaypalEmail(sanitizeEmail(value));
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={254}
            placeholder="user@paypal.com"
            error={paypalEmailError}
          />
        ) : null}

        {method === 'Credit Card' || method === 'Stripe' ? (
          <>
            <TextField
              label={t('Card Number')}
              value={cardNumber}
              onChangeText={value => {
                setFormError(null);
                setCardNumber(sanitizeCardNumber(value));
              }}
              keyboardType="number-pad"
              // 16 digits + the 3 grouping spaces.
              maxLength={CARD_NUMBER_DIGITS + 3}
              placeholder="4111 2222 3333 4444"
              error={cardNumberError}
            />
            <View style={styles.cardInline}>
              <View style={styles.cardFlex}>
                <TextField
                  label={t('Expiry (MM/YY)')}
                  value={cardExpiry}
                  onChangeText={value => {
                    setFormError(null);
                    setCardExpiry(sanitizeExpiry(value));
                  }}
                  keyboardType="number-pad"
                  maxLength={5}
                  placeholder="12/28"
                  error={cardExpiryError}
                />
              </View>
              <View style={styles.cardFlex}>
                <TextField
                  label={t('CVV')}
                  value={cardCvv}
                  onChangeText={value => {
                    setFormError(null);
                    setCardCvv(sanitizeCvv(value));
                  }}
                  keyboardType="number-pad"
                  maxLength={CVV_MAX}
                  secureTextEntry
                  placeholder="123"
                  error={cardCvvError}
                />
              </View>
            </View>
          </>
        ) : null}

        {formError ? (
          <View style={styles.errorCard}>
            <Icon name="alert-triangle" size={18} color="#DC2626" />
            <Text style={styles.errorCardText}>{formError}</Text>
          </View>
        ) : null}

        <PrimaryButton
          title={
            method === COUNTER_PAYMENT_METHOD
              ? t('Issue Ticket (Pay on Counter)')
              : t('Confirm & Pay (${{amount}})', { amount: TICKET_FEE.toFixed(2) })
          }
          onPress={onSubmit}
          disabled={!canBook}
          style={styles.submit}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.white },
  loading: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 60 },
  notice: { marginBottom: 12 },
  lead: { fontSize: 13, color: colors.gray, marginBottom: 4 },
  stepTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textDarker,
    marginTop: 22,
    marginBottom: 10,
  },
  hint: { fontSize: 12, color: colors.gray, marginTop: 8 },

  serviceList: { gap: 10 },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRadius: 14,
    padding: 14,
    backgroundColor: colors.white,
  },
  serviceCardActive: { borderColor: colors.primaryAlt, backgroundColor: colors.backgroundLight },
  serviceTextWrap: { flex: 1 },
  serviceName: { fontSize: 15, fontWeight: '700', color: colors.textDarker },
  serviceNameActive: { color: colors.primaryAlt },
  serviceAddress: { fontSize: 12, color: colors.gray, marginTop: 2 },
  serviceMeta: { alignItems: 'center', marginLeft: 12 },
  serviceMetaValue: { fontSize: 16, fontWeight: '800', color: colors.textDarker },
  serviceMetaLabel: { fontSize: 10, color: colors.gray },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dateChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  dateChipActive: { borderColor: colors.primaryAlt, backgroundColor: colors.primaryAlt },
  dateChipWeekday: { fontSize: 10, color: colors.gray },
  dateChipText: { fontSize: 13, fontWeight: '600', color: colors.textDark },
  dateChipTextActive: { color: colors.white },
  slotLoader: { marginVertical: 10 },
  slotChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    backgroundColor: colors.white,
  },
  slotChipActive: { borderColor: colors.primaryAlt, backgroundColor: colors.primaryAlt },
  slotChipDisabled: { backgroundColor: '#F3F4F6', borderColor: '#F3F4F6' },
  slotChipText: { fontSize: 13, fontWeight: '600', color: colors.textDark },
  slotChipTextDisabled: { color: colors.grayLight, textDecorationLine: 'line-through' },

  fieldGroup: { marginTop: 16 },
  fieldLabel: { fontSize: 13, color: colors.gray, marginBottom: 8 },
  inlineError: { fontSize: 13, color: 'red', marginTop: 5 },

  summaryCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 14,
    marginBottom: 14,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 13, color: colors.gray },
  summaryVal: { fontSize: 13, fontWeight: '600', color: colors.textDark },
  summaryTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 10,
    marginBottom: 0,
  },
  summaryTotalLabel: { fontSize: 14, fontWeight: '700', color: colors.textDarker },
  summaryTotalVal: { fontSize: 16, fontWeight: '800', color: colors.primaryAlt },

  methodsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  methodCard: {
    flexGrow: 1,
    flexBasis: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  methodLabel: { fontSize: 13, color: colors.textDark },
  counterNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  counterNoteText: { flex: 1, fontSize: 12, color: '#15803D', fontWeight: '600' },

  cardInline: { flexDirection: 'row', gap: 12 },
  cardFlex: { flex: 1 },

  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  errorCardText: { flex: 1, fontSize: 13, color: '#B91C1C', fontWeight: '600' },

  submit: { marginTop: 20 },
});
