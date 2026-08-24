import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import moment from 'moment';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text } from '../../components/Text';
import { PrimaryButton } from '../../components/PrimaryButton';
import { TextField } from '../../components/TextField';
import { authApi, categoryApi, serviceApi, appointmentApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { useUi } from '../../context/UiContext';
import { NotificationBellButton, useNotifications } from '../../context/NotificationContext';
import { getCurrentLocation, requestLocationPermission } from '../../utils/location';
import { colors } from '../../theme/colors';
import { Icon, type IconName } from '../../components/Icon';
import { RatingStat } from '../../components/StarRating';
import { GOOGLE_MAPS_API_KEY } from '../../config/maps';
import type { Category, ServiceListing } from '../../types/models';
import type { RootStackParamList } from '../../navigation/types';
import {
  SLOT_DATE_FORMAT,
  SLOT_TIME_FORMAT,
  buildBookingDates,
  buildDaySlots,
  formatSlotLabel,
  type BookingDate,
  type TimeSlot,
} from '../../utils/slots';

interface PlacePrediction {
  place_id: string;
  description: string;
}

function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
  const points: { latitude: number; longitude: number }[] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

export default function Home() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { userDetail, updateUserDetail } = useAuth();
  const { showLoading, hideLoading, showToast } = useUi();
  const { addNotification } = useNotifications();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const mapRef = useRef<MapView>(null);

  const [region, setRegion] = useState<Region | null>(null);
  const [hasCustomLocation, setHasCustomLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceListing[]>([]);

  const [address, setAddress] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const predictionsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedService, setSelectedService] = useState<ServiceListing | null>(null);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const [bookingDates, setBookingDates] = useState<BookingDate[]>(() => buildBookingDates());
  const [selectedDate, setSelectedDate] = useState(() => buildBookingDates()[0].date);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>(() => buildDaySlots(buildBookingDates()[0].date));
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const [payName, setPayName] = useState('');
  const [payEmail, setPayEmail] = useState('');
  const [payPhone, setPayPhone] = useState('');
  const [payGender, setPayGender] = useState('');
  const [payPurpose, setPayPurpose] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const [routeCoordinates, setRouteCoordinates] = useState<{ latitude: number; longitude: number }[]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [activeTargetCoords, setActiveTargetCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const initLocation = useCallback(async () => {
    try {
      let initialLat: number | null = null;
      let initialLng: number | null = null;
      let initialAddr: string | null = null;

      const storedLoc = await AsyncStorage.getItem('user_saved_location');
      if (storedLoc) {
        try {
          const parsed = JSON.parse(storedLoc);
          if (parsed?.latitude && parsed?.longitude) {
            initialLat = parsed.latitude;
            initialLng = parsed.longitude;
            initialAddr = parsed.address || null;
          }
        } catch {}
      }

      if (!initialLat && userDetail?.latitude && userDetail?.longitude) {
        initialLat = userDetail.latitude;
        initialLng = userDetail.longitude;
        initialAddr = userDetail.address || null;
      }

      if (initialLat && initialLng) {
        setHasCustomLocation(true);
        if (initialAddr) setAddress(initialAddr);
        const newRegion = { latitude: initialLat, longitude: initialLng, latitudeDelta: 0.05, longitudeDelta: 0.05 };
        setRegion(newRegion);
        setTimeout(() => {
          mapRef.current?.animateToRegion(newRegion, 600);
        }, 300);
      } else {
        setHasCustomLocation(false);
        const granted = await requestLocationPermission();
        if (granted) {
          const loc = await getCurrentLocation();
          const newRegion = { latitude: loc.latitude, longitude: loc.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 };
          setRegion(newRegion);
          setTimeout(() => {
            mapRef.current?.animateToRegion(newRegion, 600);
          }, 300);
        } else {
          setLocationError('Location permission denied');
        }
      }

      loadCategories();
    } catch {
      setLocationError('Unable to fetch location');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userDetail?.latitude, userDetail?.longitude]);

  useFocusEffect(
    useCallback(() => {
      initLocation();
    }, [initLocation]),
  );

  useEffect(() => {
    if (userDetail) {
      if (userDetail.name) setPayName(prev => prev || userDetail.name);
      if (userDetail.email) setPayEmail(prev => prev || userDetail.email);
      const phoneNum = userDetail.phone || userDetail.phoneNumber || userDetail.mobile || userDetail.phone_number || userDetail.contact;
      if (phoneNum) setPayPhone(prev => prev || String(phoneNum));
      if (userDetail.gender) setPayGender(prev => prev || userDetail.gender);
    }
  }, [userDetail?.name, userDetail?.email, userDetail?.phone]);

  async function loadCategories() {
    try {
      const res: any = await categoryApi.getCategory();
      const list: Category[] = res?.data ?? [];
      setCategories(list);
      if (list.length > 0) {
        setSelectedCategoryId(list[0]._id);
      }
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t('Unable to load categories'));
    }
  }

  const loadServices = useCallback(
    async (categoryId: string, loc: Region) => {
      try {
        const res: any = await serviceApi.nearMeServicebyCategory({
          category: categoryId,
          location: [loc.longitude, loc.latitude],
        });
        setServices(res?.data ?? []);
      } catch (err) {
        showToast(err instanceof ApiError ? err.message : t('Unable to load services'));
      }
    },
    [showToast, t],
  );

  useEffect(() => {
    if (selectedCategoryId && region) {
      loadServices(selectedCategoryId, region);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategoryId, region?.latitude, region?.longitude]);

  function onSelectCategory(id: string) {
    setSelectedCategoryId(id);
  }

  function onChangeAddress(text: string) {
    setAddress(text);
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
        const newRegion = { latitude: loc.lat, longitude: loc.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 };
        setRegion(newRegion);
        mapRef.current?.animateToRegion(newRegion, 500);
      }
    } catch {
      showToast(t('Unable to find that location'));
    }
  }

  function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function openExternalNavigation(lat: number, lng: number) {
    const latLng = `${lat},${lng}`;
    const url = Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${latLng}&dirflg=d`
      : `google.navigation:q=${latLng}`;

    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${latLng}`;
        Linking.openURL(webUrl);
      }
    }).catch(() => {
      const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${latLng}`;
      Linking.openURL(webUrl);
    });
  }

  async function handleStartNavigation(service: ServiceListing) {
    if (!region) return;
    const originLat = region.latitude;
    const originLng = region.longitude;
    const destLat = service.service_location.coordinates[1];
    const destLng = service.service_location.coordinates[0];

    const distKm = calculateDistanceKm(originLat, originLng, destLat, destLng);

    setActiveTargetCoords({ latitude: destLat, longitude: destLng });
    setShowServiceModal(false);
    showLoading();

    try {
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLng}&destination=${destLat},${destLng}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;
      const res = await fetch(url);
      const json = await res.json();

      let coords: { latitude: number; longitude: number }[] = [];
      let distText = `${distKm.toFixed(1)} km`;
      let durationText = `${Math.max(2, Math.round(distKm * 2.5))} mins in traffic`;

      if (json?.routes?.[0]?.overview_polyline?.points) {
        coords = decodePolyline(json.routes[0].overview_polyline.points);
        const leg = json.routes[0].legs?.[0];
        if (leg?.distance?.text) distText = leg.distance.text;
        if (leg?.duration?.text) durationText = leg.duration.text;
      }

      if (!coords || coords.length < 2) {
        coords = [
          { latitude: originLat, longitude: originLng },
          { latitude: (originLat + destLat) / 2 + 0.003, longitude: (originLng + destLng) / 2 - 0.003 },
          { latitude: destLat, longitude: destLng },
        ];
      }

      setRouteInfo({ distance: distText, duration: durationText });
      setRouteCoordinates(coords);

      if (distKm < 0.1) {
        mapRef.current?.animateToRegion(
          {
            latitude: (originLat + destLat) / 2,
            longitude: (originLng + destLng) / 2,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          500,
        );
      } else {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 160, right: 60, bottom: 220, left: 60 },
          animated: true,
        });
      }
    } catch {
      const fallbackCoords = [
        { latitude: originLat, longitude: originLng },
        { latitude: (originLat + destLat) / 2 + 0.003, longitude: (originLng + destLng) / 2 - 0.003 },
        { latitude: destLat, longitude: destLng },
      ];
      setRouteInfo({
        distance: `${distKm.toFixed(1)} km`,
        duration: `${Math.max(2, Math.round(distKm * 2.5))} mins in traffic`,
      });
      setRouteCoordinates(fallbackCoords);
      mapRef.current?.animateToRegion(
        {
          latitude: (originLat + destLat) / 2,
          longitude: (originLng + destLng) / 2,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        500,
      );
    } finally {
      hideLoading();
    }
  }

  function clearRouteNavigation() {
    setRouteCoordinates([]);
    setRouteInfo(null);
    setActiveTargetCoords(null);
  }

  function recenterUserLocation() {
    if (region) {
      mapRef.current?.animateToRegion(region, 500);
    }
  }

  function zoomIn() {
    if (!region) return;
    const newRegion = {
      ...region,
      latitudeDelta: Math.max(0.002, region.latitudeDelta / 2),
      longitudeDelta: Math.max(0.002, region.longitudeDelta / 2),
    };
    setRegion(newRegion);
    mapRef.current?.animateToRegion(newRegion, 300);
  }

  function zoomOut() {
    if (!region) return;
    const newRegion = {
      ...region,
      latitudeDelta: Math.min(180, region.latitudeDelta * 2),
      longitudeDelta: Math.min(360, region.longitudeDelta * 2),
    };
    setRegion(newRegion);
    mapRef.current?.animateToRegion(newRegion, 300);
  }

  async function onMarkerPress(service: ServiceListing) {
    setSelectedService(service);
    setSelectedTime(null);

    if (region) {
      const originLat = region.latitude;
      const originLng = region.longitude;
      const destLat = service.service_location.coordinates[1];
      const destLng = service.service_location.coordinates[0];

      const distKm = calculateDistanceKm(originLat, originLng, destLat, destLng);
      setActiveTargetCoords({ latitude: destLat, longitude: destLng });

      try {
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLng}&destination=${destLat},${destLng}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;
        const res = await fetch(url);
        const json = await res.json();

        let coords: { latitude: number; longitude: number }[] = [];
        let distText = `${distKm.toFixed(1)} km`;
        let durationText = `${Math.max(2, Math.round(distKm * 2.5))} mins in traffic`;

        if (json?.routes?.[0]?.overview_polyline?.points) {
          coords = decodePolyline(json.routes[0].overview_polyline.points);
          const leg = json.routes[0].legs?.[0];
          if (leg?.distance?.text) distText = leg.distance.text;
          if (leg?.duration?.text) durationText = leg.duration.text;
        }

        if (!coords || coords.length < 2) {
          coords = [
            { latitude: originLat, longitude: originLng },
            { latitude: (originLat + destLat) / 2 + 0.003, longitude: (originLng + destLng) / 2 - 0.003 },
            { latitude: destLat, longitude: destLng },
          ];
        }

        setRouteInfo({ distance: distText, duration: durationText });
        setRouteCoordinates(coords);
      } catch {
        const fallbackCoords = [
          { latitude: originLat, longitude: originLng },
          { latitude: (originLat + destLat) / 2 + 0.003, longitude: (originLng + destLng) / 2 - 0.003 },
          { latitude: destLat, longitude: destLng },
        ];
        setRouteInfo({
          distance: `${distKm.toFixed(1)} km`,
          duration: `${Math.max(2, Math.round(distKm * 2.5))} mins in traffic`,
        });
        setRouteCoordinates(fallbackCoords);
      }
    }

    setShowServiceModal(true);
  }

  const loadSlots = useCallback(async (serviceId: string, date: string) => {
    setSlotsLoading(true);
    setTimeSlots(buildDaySlots(date));
    try {
      const res: any = await appointmentApi.getAvailableSlots(serviceId, { date });
      const data = res?.data;
      if (Array.isArray(data?.dates) && data.dates.length > 0) setBookingDates(data.dates);
      if (Array.isArray(data?.slots) && data.slots.length > 0) setTimeSlots(data.slots);
    } catch {
      // Offline grid already rendered.
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!showSlotModal || !selectedService) return;
    loadSlots(selectedService._id, selectedDate);
  }, [showSlotModal, selectedService, selectedDate, loadSlots]);

  function onBookAppointment() {
    // Rebuild the window in case the app has been open since before midnight.
    const dates = buildBookingDates();
    setBookingDates(dates);
    setSelectedDate(dates[0].date);
    setSelectedTime(null);
    setShowServiceModal(false);
    setShowSlotModal(true);
  }

  function onSelectDate(date: string) {
    if (date === selectedDate) return;
    setSelectedDate(date);
    setSelectedTime(null);
  }

  function onConfirmSlot() {
    setShowSlotModal(false);
    if (userDetail) {
      if (!payName && userDetail.name) setPayName(userDetail.name);
      if (!payEmail && userDetail.email) setPayEmail(userDetail.email);
      const phoneNum = userDetail.phone || userDetail.phoneNumber || userDetail.mobile || userDetail.phone_number || userDetail.contact;
      if (!payPhone && phoneNum) setPayPhone(String(phoneNum));
      if (!payGender && userDetail.gender) setPayGender(userDetail.gender);
    }
    setShowPaymentModal(true);
  }

  type PaymentMethod = 'Orange Money' | 'PayPal' | 'Stripe' | 'Credit Card';

  const [paymentStep, setPaymentStep] = useState<'details' | 'payment'>('details');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('Orange Money');
  const [accountNumber, setAccountNumber] = useState('');
  const [paypalEmail, setPaypalEmail] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  function onProceedToPayment() {
    setSubmitted(true);
    if (!payName || !payEmail || !payPhone || !payGender || !payPurpose) {
      return;
    }
    setPaymentError(null);
    setPaymentStep('payment');
  }

  async function onSubmitPayment() {
    setPaymentError(null);
    if (selectedMethod === 'Orange Money' && !accountNumber) {
      setPaymentError(t('Mobile/Account Number is required.'));
      return;
    }
    if (selectedMethod === 'PayPal' && !paypalEmail) {
      setPaymentError(t('PayPal Email is required.'));
      return;
    }
    if ((selectedMethod === 'Credit Card' || selectedMethod === 'Stripe') && (!cardNumber || !cardExpiry || !cardCvv)) {
      setPaymentError(t('Complete card details are required.'));
      return;
    }

    if (!selectedService || !selectedTime) return;

    const fullDate = moment(`${selectedDate} ${selectedTime}`, `${SLOT_DATE_FORMAT} ${SLOT_TIME_FORMAT}`).format();
    const txnId = `TXN-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    showLoading();
    try {
      const res: any = await appointmentApi.createAppointment({
        name: payName,
        email: payEmail,
        phone: payPhone,
        gender: payGender,
        purpose_of_visit: payPurpose,
        date: moment(selectedDate, SLOT_DATE_FORMAT).format(),
        time: formatSlotLabel(selectedTime),
        service: selectedService._id,
        full_date: fullDate,
        service_provider: selectedService.user._id,
        service_ref: selectedService._id,
        paymentMethod: selectedMethod,
        paymentAmount: 5.50,
        transactionId: txnId,
        paymentStatus: 'Completed',
      });

      const ticketNum = res?.data?.ticketNumber || 'N/A';
      addNotification(
        t('Appointment Confirmed'),
        t('Your ticket #{{ticket}} for {{service}} on {{date}} at {{time}} is confirmed.', {
          ticket: ticketNum,
          service: selectedService.service_name,
          date: moment(selectedDate, SLOT_DATE_FORMAT).format('DD MMM YYYY'),
          time: formatSlotLabel(selectedTime),
        }),
        'success',
      );

      setShowPaymentModal(false);
      setSubmitted(false);
      setPaymentStep('details');
      setPayName('');
      setPayEmail('');
      setPayPhone('');
      setPayGender('');
      setPayPurpose('');
      setAccountNumber('');
      setPaypalEmail('');
      setCardNumber('');
      setCardExpiry('');
      setCardCvv('');
      navigation.navigate('PaymentSuccess', { appointmentId: res?.data?._id });
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t('Something went wrong'));
    } finally {
      hideLoading();
    }
  }

  function openProviderReviews(service: ServiceListing) {
    setShowServiceModal(false);
    navigation.navigate('ProviderReviews', {
      providerId: service.user?._id,
      providerName: service.user?.name,
    });
  }

  const nameError = submitted && !payName ? t('Name is required.') : undefined;
  const emailError = submitted && !payEmail ? t('Email is required.') : undefined;
  const phoneError = submitted && !payPhone ? t('Phone is required.') : undefined;
  const genderError = submitted && !payGender ? t('Gender is required.') : undefined;
  const purposeError = submitted && !payPurpose ? t('Purpose of visit is required.') : undefined;

  return (
    <View style={styles.flex}>
      {/* Top Floating Glassmorphism Search & Categories Header */}
      <View style={[styles.topFloatingHeader, { top: insets.top + 8 }]}>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <View style={styles.searchIconWrap}>
              <Icon name="search" size={18} color={colors.primaryAlt} />
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder={t('Search location or agency...')}
              value={address}
              onChangeText={onChangeAddress}
              placeholderTextColor="#9CA3AF"
            />
          </View>
          <NotificationBellButton />
        </View>

        {/* Predictions Dropdown */}
        {predictions.length > 0 && (
          <View style={styles.predictionsList}>
            {predictions.map(item => (
              <TouchableOpacity key={item.place_id} style={styles.predictionRow} onPress={() => onSelectPrediction(item)}>
                <Text style={styles.predictionText} numberOfLines={1}>
                  {item.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Top Category Floating Filter Chips */}
        <View style={styles.categoryBar}>
          <FlatList
            data={categories}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={item => item._id}
            contentContainerStyle={styles.categoryList}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.categoryChip, selectedCategoryId === item._id && styles.categoryChipActive]}
                onPress={() => onSelectCategory(item._id)}>
                <Text style={[styles.categoryChipText, selectedCategoryId === item._id && styles.categoryChipTextActive]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>

      {/* Active Driving Route Banner */}
      {routeInfo && (
        <View style={[styles.routeBanner, { top: insets.top + 130 }]}>
          <View style={styles.routeBannerContent}>
            <View style={styles.routeBannerHeader}>
              <Icon name="navigation" size={16} color="#3B82F6" />
              <Text style={styles.routeBannerText}>
                {routeInfo.distance} • {routeInfo.duration}
              </Text>
            </View>
            {activeTargetCoords && (
              <TouchableOpacity onPress={() => openExternalNavigation(activeTargetCoords.latitude, activeTargetCoords.longitude)}>
                <Text style={styles.openMapsLink}>{t('Open in Google Maps →')}</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={clearRouteNavigation} style={styles.closeRouteBtn}>
            <Icon name="x" size={18} color={colors.grayLight} />
          </TouchableOpacity>
        </View>
      )}

      {/* Map View */}
      {region ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={region}
          showsUserLocation={!hasCustomLocation}>
          {services.map(service => (
            <Marker
              key={service._id}
              coordinate={{
                latitude: service.service_location.coordinates[1],
                longitude: service.service_location.coordinates[0],
              }}
              title={service.service_name}
              onPress={() => onMarkerPress(service)}
            />
          ))}

          {routeCoordinates.length > 0 && (
            <Polyline coordinates={routeCoordinates} strokeWidth={6} strokeColor="#1A73E8" />
          )}
        </MapView>
      ) : (
        <View style={styles.mapPlaceholder}>
          {locationError ? (
            <Text style={styles.errorText}>{locationError}</Text>
          ) : (
            <ActivityIndicator size="large" color={colors.primary} />
          )}
        </View>
      )}

      {/* Floating Map Controls on Right Side */}
      <View style={styles.mapControlsContainer}>
        <TouchableOpacity style={styles.controlBtn} onPress={recenterUserLocation} activeOpacity={0.8}>
          <Icon name="map-pin" size={18} color={colors.primaryAlt} />
        </TouchableOpacity>
        <View style={styles.controlDivider} />
        <TouchableOpacity style={styles.controlBtn} onPress={zoomIn} activeOpacity={0.8}>
          <Text style={styles.zoomText}>+</Text>
        </TouchableOpacity>
        <View style={styles.controlDivider} />
        <TouchableOpacity style={styles.controlBtn} onPress={zoomOut} activeOpacity={0.8}>
          <Text style={styles.zoomText}>−</Text>
        </TouchableOpacity>
      </View>

      {/* Service Detail Bottom Sheet Modal */}
      <Modal visible={showServiceModal} animationType="slide" transparent onRequestClose={() => setShowServiceModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.sheet, { paddingBottom: 24 + insets.bottom }]}>
            <View style={styles.sheetHandle} />
            {selectedService && (
              <>
                {selectedService.service_photo?.[0] ? (
                  <Image source={{ uri: selectedService.service_photo[0] }} style={styles.serviceImage} />
                ) : null}
                <Text style={styles.sheetTitle}>{selectedService.service_name}</Text>
                <Text style={styles.sheetSubtitle}>{selectedService.user?.name}</Text>

                <TouchableOpacity
                  style={styles.ratingRow}
                  activeOpacity={0.7}
                  onPress={() => openProviderReviews(selectedService)}>
                  <RatingStat
                    average={selectedService.averageRating ?? 0}
                    count={selectedService.reviewCount ?? 0}
                    size={15}
                  />
                  {(selectedService.reviewCount ?? 0) > 0 ? (
                    <Text style={styles.viewReviewsText}>{t('View all reviews')}</Text>
                  ) : null}
                </TouchableOpacity>

                <View style={styles.crowdStatusCard}>
                  <View
                    style={[
                      styles.crowdBadge,
                      selectedService.crowdLevel === 'High'
                        ? styles.crowdHigh
                        : selectedService.crowdLevel === 'Moderate'
                        ? styles.crowdModerate
                        : styles.crowdLow,
                    ]}>
                    <Text style={styles.crowdBadgeText}>
                      {selectedService.crowdLevel === 'High'
                        ? t('Heavy Rush')
                        : selectedService.crowdLevel === 'Moderate'
                        ? t('Moderate Rush')
                        : t('Low Rush')}
                    </Text>
                  </View>
                  <Text style={styles.queueMetaText}>
                    {(selectedService.queueCount ?? 0) === 0
                      ? t('No waiting line • Direct entry available')
                      : (selectedService.queueCount ?? 0) === 1
                      ? t('1 person ahead • ~5 mins wait')
                      : t('{{people}} people ahead • ~{{minutes}} mins wait', {
                          people: selectedService.queueCount,
                          minutes: selectedService.estimatedWaitMinutes,
                        })}
                  </Text>
                </View>

                {selectedService.service_description ? (
                  <Text style={styles.sheetBody}>{selectedService.service_description}</Text>
                ) : null}

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.routeBtn}
                    onPress={() => handleStartNavigation(selectedService)}>
                    <Icon name="navigation" size={16} color={colors.primaryAlt} />
                    <Text style={styles.routeBtnText}>{t('Get Directions')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.bookBtn}
                    onPress={onBookAppointment}>
                    <Icon name="calendar" size={16} color={colors.white} />
                    <Text style={styles.bookBtnText}>{t('Book Ticket')}</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={() => setShowServiceModal(false)} style={styles.closeModalBtn}>
                  <Text style={styles.sheetCancel}>{t('Close')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Time Slot Modal */}
      <Modal visible={showSlotModal} animationType="slide" transparent onRequestClose={() => setShowSlotModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.sheet, { paddingBottom: 24 + insets.bottom }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t('Select Date & Time')}</Text>
            <Text style={styles.sheetSubtitle}>
              {t('Appointments run every 15 minutes, 10:00 AM to 5:45 PM')}
            </Text>

            <Text style={styles.slotSectionLabel}>{t('Select Date')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dayChipRow}>
              {bookingDates.map(day => {
                const isSelected = selectedDate === day.date;
                return (
                  <TouchableOpacity
                    key={day.date}
                    style={[styles.dayChip, isSelected && styles.dateChipActive]}
                    onPress={() => onSelectDate(day.date)}>
                    <Text style={[styles.dayChipWeekday, isSelected && styles.dateChipTextActive]}>
                      {day.isToday ? t('Today') : day.weekday}
                    </Text>
                    <Text style={[styles.dayChipDate, isSelected && styles.dateChipTextActive]}>
                      {day.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.slotSectionHeader}>
              <Text style={styles.slotSectionLabel}>{t('Select Time')}</Text>
              {slotsLoading ? <ActivityIndicator size="small" color={colors.primaryAlt} /> : null}
            </View>

            {/* Capped height so the 32 slots stay scrollable on short screens. */}
            <ScrollView
              style={[styles.slotScroll, { maxHeight: Math.max(160, windowHeight * 0.32) }]}
              contentContainerStyle={styles.slotGrid}
              showsVerticalScrollIndicator
              nestedScrollEnabled>
              {timeSlots.map(slot => {
                const isSelected = selectedTime === slot.time;
                const isDisabled = !slot.isAvailable;
                return (
                  <TouchableOpacity
                    key={slot.time}
                    disabled={isDisabled}
                    style={[
                      styles.slotChip,
                      isSelected && styles.dateChipActive,
                      isDisabled && styles.slotChipDisabled,
                    ]}
                    onPress={() => setSelectedTime(slot.time)}>
                    <Text
                      style={[
                        styles.dateChipText,
                        isSelected && styles.dateChipTextActive,
                        isDisabled && styles.slotChipTextDisabled,
                      ]}>
                      {slot.label || formatSlotLabel(slot.time)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {!slotsLoading && timeSlots.every(slot => !slot.isAvailable) ? (
              <Text style={styles.slotEmptyText}>
                {t('No slots left for this day. Please pick another date.')}
              </Text>
            ) : null}

            <PrimaryButton
              title={t('Continue to Booking Details')}
              onPress={onConfirmSlot}
              style={styles.sheetButton}
              disabled={!selectedTime}
            />
            <TouchableOpacity onPress={() => setShowSlotModal(false)}>
              <Text style={styles.sheetCancel}>{t('Cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Payment / Visitor Details Modal */}
      <Modal visible={showPaymentModal} animationType="slide" transparent onRequestClose={() => setShowPaymentModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
          <ScrollView
            style={styles.sheetScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.sheet, { paddingBottom: 240 + insets.bottom }]}>
            <View style={styles.sheetHandle} />
            {paymentStep === 'details' ? (
              <>
                <Text style={styles.sheetTitle}>{t('Visitor Details')}</Text>
                <Text style={styles.sheetSubtitle}>
                  {t('Review or update your details for this booking')}
                </Text>

                {selectedService && selectedTime ? (
                  <View style={styles.bookingMiniSummary}>
                    <Text style={styles.bookingMiniTitle}>{selectedService.service_name}</Text>
                    <View style={styles.bookingMiniMetaRow}>
                      <Icon name="calendar" size={12} color={colors.primaryAlt} />
                      <Text style={styles.bookingMiniMetaText}>
                        {moment(selectedDate, SLOT_DATE_FORMAT).format('ddd, DD MMM YYYY')}
                      </Text>
                      <Text style={styles.bookingDot}>•</Text>
                      <Icon name="clock" size={12} color={colors.primaryAlt} />
                      <Text style={styles.bookingMiniMetaText}>{formatSlotLabel(selectedTime)}</Text>
                    </View>
                  </View>
                ) : null}

                <TextField
                  label={t('Full Name')}
                  value={payName}
                  onChangeText={setPayName}
                  placeholder={t('Enter full name')}
                  error={nameError}
                />
                <TextField
                  label={t('Email Address')}
                  value={payEmail}
                  onChangeText={setPayEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="user@example.com"
                  error={emailError}
                />
                <TextField
                  label={t('Phone Number')}
                  value={payPhone}
                  onChangeText={setPayPhone}
                  keyboardType="phone-pad"
                  placeholder="+1 234 567 890"
                  error={phoneError}
                />

                {/* Quick Gender Chips */}
                <View style={styles.quickFieldGroup}>
                  <Text style={styles.fieldLabel}>{t('Gender')}</Text>
                  <View style={styles.chipRow}>
                    {['Male', 'Female', 'Other'].map(g => {
                      const isSelected = payGender.toLowerCase() === g.toLowerCase();
                      return (
                        <TouchableOpacity
                          key={g}
                          style={[styles.dateChip, isSelected && styles.dateChipActive]}
                          onPress={() => setPayGender(g)}>
                          <Text style={[styles.dateChipText, isSelected && styles.dateChipTextActive]}>
                            {t(g)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <TextField
                    label=""
                    value={payGender}
                    onChangeText={setPayGender}
                    placeholder={t('Or type gender')}
                    error={genderError}
                  />
                </View>

                {/* Quick Purpose Suggestions */}
                <View style={styles.quickFieldGroup}>
                  <Text style={styles.fieldLabel}>{t('Purpose of Visit')}</Text>
                  <View style={styles.chipRow}>
                    {['General Consultation', 'Document Verification', 'Medical Checkup', 'Account Opening'].map(p => {
                      const isSelected = payPurpose === p;
                      return (
                        <TouchableOpacity
                          key={p}
                          style={[styles.dateChip, isSelected && styles.dateChipActive]}
                          onPress={() => setPayPurpose(p)}>
                          <Text style={[styles.dateChipText, isSelected && styles.dateChipTextActive]}>
                            {t(p)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <TextField
                    label=""
                    value={payPurpose}
                    onChangeText={setPayPurpose}
                    placeholder={t('Describe purpose of visit...')}
                    error={purposeError}
                  />
                </View>

                <PrimaryButton
                  title={t('Proceed to Payment Checkout')}
                  onPress={onProceedToPayment}
                  style={styles.sheetButton}
                />
                <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                  <Text style={styles.sheetCancel}>{t('Cancel')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.sheetTitle}>{t('Payment Checkout')}</Text>
                <Text style={styles.sheetSubtitle}>
                  {t('Complete payment to confirm your queue ticket')}
                </Text>

                {/* Hero Summary Card */}
                <View style={styles.summaryCard}>
                  <View style={styles.summaryBadgeRow}>
                    <View style={styles.flexRowGap}>
                      <Icon name="file-text" size={14} color={colors.primaryAlt} />
                      <Text style={styles.summaryBadgeText}>{t('TICKET RESERVATION')}</Text>
                    </View>
                    <View style={styles.secureBadge}>
                      <Icon name="shield" size={12} color="#15803D" />
                      <Text style={styles.secureBadgeText}>{t('Secure SSL')}</Text>
                    </View>
                  </View>

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
                    <Text style={styles.summaryTotalVal}>$5.50</Text>
                  </View>
                </View>

                {/* Payment Method Selector Grid */}
                <Text style={styles.methodTitle}>{t('Select Payment Method')}</Text>
                <View style={styles.paymentMethodsGrid}>
                  {[
                    { key: 'Orange Money', iconName: 'smartphone', color: '#EA580C', bg: '#FFF3E0' },
                    { key: 'Credit Card', iconName: 'credit-card', color: '#1D4ED8', bg: '#E8F0FE' },
                    { key: 'PayPal', iconName: 'dollar', color: '#003087', bg: '#E8F0FE' },
                    { key: 'Stripe', iconName: 'zap', color: '#7C3AED', bg: '#F3E8FF' },
                  ].map(item => {
                    const active = selectedMethod === item.key;
                    return (
                      <TouchableOpacity
                        key={item.key}
                        activeOpacity={0.8}
                        style={[
                          styles.paymentGridCard,
                          active && { borderColor: item.color, backgroundColor: item.bg },
                        ]}
                        onPress={() => {
                          setPaymentError(null);
                          setSelectedMethod(item.key as PaymentMethod);
                        }}>
                        <Icon name={item.iconName as IconName} size={18} color={active ? item.color : colors.gray} />
                        <Text style={[styles.paymentCardLabel, active && { color: item.color, fontWeight: '700' }]}>
                          {item.key}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Method Specific Inputs */}
                {selectedMethod === 'Orange Money' && (
                  <View style={styles.methodInputBox}>
                    <TextField
                      label={t('Orange Money Account / Mobile No.')}
                      value={accountNumber}
                      onChangeText={value => { setPaymentError(null); setAccountNumber(value); }}
                      keyboardType="phone-pad"
                      placeholder="+225 0700000000"
                    />
                  </View>
                )}

                {selectedMethod === 'PayPal' && (
                  <View style={styles.methodInputBox}>
                    <TextField
                      label={t('PayPal Email Address')}
                      value={paypalEmail}
                      onChangeText={value => { setPaymentError(null); setPaypalEmail(value); }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      placeholder="user@paypal.com"
                    />
                  </View>
                )}

                {(selectedMethod === 'Credit Card' || selectedMethod === 'Stripe') && (
                  <View style={styles.methodInputBox}>
                    <TextField
                      label={t('Card Number')}
                      value={cardNumber}
                      onChangeText={value => { setPaymentError(null); setCardNumber(value); }}
                      keyboardType="numeric"
                      placeholder="4111 2222 3333 4444"
                    />
                    <View style={styles.cardInline}>
                      <View style={styles.cardFlex}>
                        <TextField
                          label={t('Expiry (MM/YY)')}
                          value={cardExpiry}
                          onChangeText={value => { setPaymentError(null); setCardExpiry(value); }}
                          placeholder="12/28"
                        />
                      </View>
                      <View style={styles.cardFlex}>
                        <TextField
                          label={t('CVV')}
                          value={cardCvv}
                          onChangeText={value => { setPaymentError(null); setCardCvv(value); }}
                          keyboardType="numeric"
                          secureTextEntry
                          placeholder="123"
                        />
                      </View>
                    </View>
                  </View>
                )}

                {/* Validation Error Alert Card */}
                {paymentError ? (
                  <View style={styles.errorAlertCard}>
                    <Icon name="alert-triangle" size={18} color="#DC2626" />
                    <Text style={styles.errorAlertText}>{paymentError}</Text>
                  </View>
                ) : null}

                <PrimaryButton
                  title={t('Confirm & Pay ($5.50)')}
                  onPress={onSubmitPayment}
                  style={styles.sheetButton}
                />
                <TouchableOpacity onPress={() => setPaymentStep('details')} style={styles.backBtnWrap}>
                  <View style={styles.flexRowGap}>
                    <Icon name="arrow-left" size={14} color={colors.gray} />
                    <Text style={styles.sheetCancel}>{t('Back to Visitor Details')}</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.white },
  flexRowGap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  topFloatingHeader: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingHorizontal: 14,
    height: 48,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  searchIconWrap: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.textDark,
    paddingVertical: 0,
  },
  predictionsList: {
    backgroundColor: colors.white,
    borderRadius: 16,
    marginTop: 8,
    overflow: 'hidden',
    elevation: 7,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  predictionRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  predictionText: {
    fontSize: 14,
    color: colors.textDark,
    fontWeight: '500',
  },
  categoryBar: {
    marginTop: 10,
  },
  categoryList: {
    gap: 8,
  },
  categoryChip: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 6,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  categoryChipActive: {
    backgroundColor: colors.primaryAlt,
    borderColor: colors.primaryAlt,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textDark,
  },
  categoryChipTextActive: {
    color: colors.white,
    fontWeight: '700',
  },
  routeBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9,
    backgroundColor: '#1E1E24',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 7,
    borderWidth: 1,
    borderColor: '#33333E',
  },
  routeBannerContent: {
    flex: 1,
  },
  routeBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeBannerText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  openMapsLink: {
    color: colors.primaryAlt,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  closeRouteBtn: {
    paddingLeft: 12,
  },
  clearRouteText: {
    color: colors.grayLight,
    fontSize: 18,
    fontWeight: '700',
  },
  mapControlsContainer: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    zIndex: 10,
    backgroundColor: colors.white,
    borderRadius: 16,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  controlBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  controlDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  zoomText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textDarker,
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: colors.gray,
    fontSize: 14,
  },
  errorTextSmall: {
    color: '#e53935',
    fontSize: 13,
    marginTop: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetScroll: {
    maxHeight: '85%',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    alignSelf: 'center',
    marginBottom: 16,
  },
  serviceImage: {
    width: '100%',
    height: 170,
    borderRadius: 16,
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textDarker,
  },
  sheetSubtitle: {
    fontSize: 14,
    color: colors.gray,
    marginTop: 2,
  },
  sheetBody: {
    fontSize: 14,
    color: colors.textDark,
    marginTop: 12,
    lineHeight: 22,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 10,
  },
  viewReviewsText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryAlt,
  },
  crowdStatusCard: {
    backgroundColor: '#FFF8F0',
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#FFE8DA',
  },
  crowdBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  crowdLow: {
    backgroundColor: '#DCFCE7',
  },
  crowdModerate: {
    backgroundColor: '#FEF3C7',
  },
  crowdHigh: {
    backgroundColor: '#FEE2E2',
  },
  crowdBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  queueMetaText: {
    fontSize: 12,
    color: colors.textDark,
    fontWeight: '600',
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  routeBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.primaryAlt,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 13,
  },
  routeBtnText: {
    color: colors.primaryAlt,
    fontSize: 14,
    fontWeight: '700',
  },
  bookBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: colors.primaryAlt,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 13,
  },
  bookBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  closeModalBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  sheetButton: {
    marginTop: 20,
  },
  sheetCancel: {
    textAlign: 'center',
    color: colors.gray,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    marginBottom: 12,
  },
  dateChip: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FAFAFA',
  },
  dateChipActive: {
    backgroundColor: colors.primaryAlt,
    borderColor: colors.primaryAlt,
  },
  dateChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textDark,
  },
  dateChipTextActive: {
    color: colors.white,
    fontWeight: '700',
  },
  slotSectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDarker,
    marginTop: 16,
  },
  slotSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayChipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 10,
    paddingRight: 4,
  },
  dayChip: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
    minWidth: 64,
  },
  dayChipWeekday: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.gray,
  },
  dayChipDate: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDark,
    marginTop: 2,
  },
  slotScroll: {
    marginTop: 10,
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 4,
  },
  slotChip: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FAFAFA',
    minWidth: 92,
    alignItems: 'center',
  },
  slotChipDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#EDEFF2',
  },
  slotChipTextDisabled: {
    color: '#B6BBC4',
    textDecorationLine: 'line-through',
  },
  slotEmptyText: {
    fontSize: 13,
    color: colors.gray,
    marginTop: 10,
  },
  summaryCard: {
    backgroundColor: '#FFF8F0',
    borderRadius: 14,
    padding: 16,
    marginTop: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFE8DA',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.gray,
  },
  summaryVal: {
    fontSize: 13,
    color: colors.textDark,
    fontWeight: '600',
  },
  summaryTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#FFE0CC',
    paddingTop: 10,
    marginTop: 4,
    marginBottom: 0,
  },
  summaryTotalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textDarker,
  },
  summaryTotalVal: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  methodTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textDark,
    marginTop: 10,
  },
  cardInline: {
    flexDirection: 'row',
    gap: 12,
  },
  cardFlex: {
    flex: 1,
  },
  bookingMiniSummary: {
    backgroundColor: '#FFF8F0',
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FFE8DA',
  },
  bookingMiniTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textDarker,
  },
  bookingMiniMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  bookingMiniMetaText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryAlt,
  },
  bookingDot: {
    fontSize: 12,
    color: colors.gray,
    marginHorizontal: 4,
  },
  quickFieldGroup: {
    marginTop: 10,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 4,
  },
  summaryBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryAlt,
    letterSpacing: 0.5,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  secureBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  paymentMethodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
    marginBottom: 12,
  },
  paymentGridCard: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  paymentCardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textDark,
  },
  methodInputBox: {
    marginTop: 4,
    marginBottom: 8,
  },
  errorAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    gap: 10,
  },
  errorAlertText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
    flex: 1,
  },
  backBtnWrap: {
    alignItems: 'center',
    paddingVertical: 6,
  },
});
