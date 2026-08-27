import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/Text';
import moment from 'moment';
import { TextField } from '../../components/TextField';
import { PrimaryButton } from '../../components/PrimaryButton';
import { EmptyState } from '../../components/EmptyState';
import { PlanNotice, PlanStatusNotice } from '../../components/PlanNotice';
import { categoryApi, serviceApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useUi } from '../../context/UiContext';
import { pickMultipleImages } from '../../utils/imagePicker';
import { colors } from '../../theme/colors';
import { GOOGLE_MAPS_API_KEY } from '../../config/maps';
import { ADDRESS_MAX, sanitizeText, validateRequiredText } from '../../utils/validation';
import type { Category, ServiceListing } from '../../types/models';
import type { SettingsProviderStackParamList } from '../../navigation/types';

const MAX_PHOTOS = 5;
const SERVICE_NAME_MAX = 80;
const SERVICE_DESCRIPTION_MAX = 500;

interface PlacePrediction {
  place_id: string;
  description: string;
}

export default function MyServiceProvider() {
  const { t } = useTranslation();
  const { showLoading, hideLoading, showToast } = useUi();
  const { can, entitlements } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<SettingsProviderStackParamList>>();
  const canManage = can('services.manage') && entitlements.canWrite;

  const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
  const [servicesList, setServicesList] = useState<ServiceListing[]>([]);

  const [serviceId, setServiceId] = useState<string | null>(null);
  const [serviceName, setServiceName] = useState('');
  const [address, setAddress] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const predictionsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const [slots, setSlots] = useState<string[]>([]);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerTime, setPickerTime] = useState(new Date());

  const [description, setDescription] = useState('');
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<{ uri: string; type: string; name: string }[]>([]);

  const [submitted, setSubmitted] = useState(false);

  // How many listings the plan covers, and whether there is room for one more.
  const listingLimit = entitlements.limitOf('serviceListings');
  const listingsLeft = entitlements.remaining('serviceListings', servicesList.length);
  const hasListingRoom = entitlements.hasRoom('serviceListings', servicesList.length);
  const openPlans = () => navigation.navigate('ManagePlansProvider');

  function resetForm(catList = categories) {
    setServiceId(null);
    setServiceName('');
    setAddress('');
    setLocation(null);
    setSlots([]);
    setDescription('');
    setExistingPhotos([]);
    setNewPhotos([]);
    setSubmitted(false);
    if (catList.length > 0) {
      setCategoryId(catList[0]._id);
    }
  }

  function startAddNewService() {
    if (!canManage) {
      showToast(t('Renew your plan to add a service.'));
      return;
    }
    if (!hasListingRoom) {
      showToast(
        t('Your plan covers {{limit}} service listings and all of them are in use.', {
          limit: listingLimit,
        }),
      );
      return;
    }
    resetForm();
    setViewMode('form');
  }

  function startEditService(service: ServiceListing) {
    if (!canManage) {
      showToast(t('Renew your plan to edit a service.'));
      return;
    }
    setServiceId(service._id);
    setServiceName(service.service_name ?? '');
    setAddress(service.address ?? '');
    setDescription(service.service_description ?? '');
    setSlots(service.service_slot ?? []);
    setExistingPhotos(service.service_photo ?? []);
    setNewPhotos([]);
    setSubmitted(false);
    setCategoryId(typeof service.category === 'string' ? service.category : (service.category as any)?._id);
    if (service.service_location?.coordinates) {
      setLocation({ lng: service.service_location.coordinates[0], lat: service.service_location.coordinates[1] });
    }
    setViewMode('form');
  }

  async function loadServicesList() {
    try {
      const [categoryRes, serviceRes]: [any, any] = await Promise.all([categoryApi.getCategory(), serviceApi.getService()]);
      const catList: Category[] = categoryRes?.data ?? [];
      setCategories(catList);

      const resData = serviceRes?.data;
      const list: ServiceListing[] = Array.isArray(resData) ? resData : resData ? [resData] : [];
      setServicesList(list);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t('Unable to load services'));
    }
  }

  useEffect(() => {
    loadServicesList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDeleteService(item: ServiceListing) {
    if (!canManage) {
      showToast(t('Renew your plan to delete a service.'));
      return;
    }
    Alert.alert(
      t('Delete Service'),
      t('Are you sure you want to delete "{{name}}"?', { name: item.service_name }),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Delete'),
          style: 'destructive',
          onPress: async () => {
            showLoading();
            try {
              await serviceApi.deleteService(item._id);
              showToast(t('Service deleted successfully'));
              await loadServicesList();
            } catch (err) {
              showToast(err instanceof ApiError ? err.message : t('Failed to delete service'));
            } finally {
              hideLoading();
            }
          },
        },
      ],
    );
  }

  function onChangeAddress(raw: string) {
    const text = sanitizeText(raw, ADDRESS_MAX);
    setAddress(text);
    // A hand-typed address no longer matches the pinned coordinates.
    setLocation(null);
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
      if (loc) setLocation({ lat: loc.lat, lng: loc.lng });
    } catch {
      showToast(t('Unable to find that address'));
    }
  }

  function onTimeChange(event: any, selectedDate?: Date) {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
      if (event.type === 'set' && selectedDate) {
        setPickerTime(selectedDate);
        const formatted = moment(selectedDate).format('HH:mm');
        if (!slots.includes(formatted)) {
          setSlots(prev => [...prev, formatted].sort());
        }
      }
    } else {
      if (selectedDate) {
        setPickerTime(selectedDate);
      }
    }
  }

  function addSlot() {
    const formatted = moment(pickerTime).format('HH:mm');
    if (!slots.includes(formatted)) {
      setSlots(prev => [...prev, formatted].sort());
    }
    setShowTimePicker(false);
  }

  function removeSlot(slot: string) {
    setSlots(prev => prev.filter(s => s !== slot));
  }

  async function handlePickPhotos() {
    const remaining = MAX_PHOTOS - existingPhotos.length - newPhotos.length;
    if (remaining <= 0) return;
    const assets = await pickMultipleImages(remaining);
    const picked = assets
      .filter(a => a.uri)
      .slice(0, remaining)
      .map(a => ({ uri: a.uri as string, type: a.type ?? 'image/jpeg', name: a.fileName ?? 'service.jpg' }));
    setNewPhotos(prev => [...prev, ...picked]);
  }

  function removeExistingPhoto(uri: string) {
    setExistingPhotos(prev => prev.filter(p => p !== uri));
  }

  function removeNewPhoto(uri: string) {
    setNewPhotos(prev => prev.filter(p => p.uri !== uri));
  }

  const tr = (key?: string) => (key ? t(key) : undefined);

  const serviceNameValidation = validateRequiredText(
    serviceName,
    'Service name is required.',
    3,
    SERVICE_NAME_MAX,
    'Service name is too short.',
  );
  const addressValidation = validateRequiredText(
    address,
    'Address is required.',
    5,
    ADDRESS_MAX,
    'Enter a complete address.',
  );

  const nameError = submitted ? tr(serviceNameValidation) : undefined;
  // The address is only usable once a suggestion pins it to coordinates.
  const addressError = submitted
    ? tr(addressValidation) ?? (!location ? t('Pick an address from the suggestions.') : undefined)
    : undefined;
  const categoryError = submitted && !categoryId ? t('Category is required.') : undefined;
  const slotsError = submitted && slots.length === 0 ? t('Add at least one service slot.') : undefined;

  async function handleSave() {
    setSubmitted(true);
    // The plan can lapse while the form is open, so re-check on submit too.
    if (!canManage) {
      showToast(t('Renew your plan to save this service.'));
      return;
    }
    if (!serviceId && !hasListingRoom) {
      showToast(
        t('Your plan covers {{limit}} service listings and all of them are in use.', {
          limit: listingLimit,
        }),
      );
      return;
    }
    if (serviceNameValidation || addressValidation || !categoryId || !location || slots.length === 0) {
      return;
    }

    showLoading();
    try {
      const formData = new FormData();
      if (serviceId) formData.append('id', serviceId);
      formData.append('service_name', serviceName.trim());
      formData.append('address', address.trim());
      formData.append('category', categoryId);
      formData.append('service_description', description.trim());
      formData.append('service_location', JSON.stringify(location));
      formData.append('service_slot', JSON.stringify(slots));
      formData.append('oldImages', JSON.stringify(existingPhotos));
      newPhotos.forEach(photo => {
        formData.append('service_photo', photo as unknown as Blob);
      });

      if (serviceId) {
        await serviceApi.updateService(formData);
        showToast(t('Service updated successfully'));
      } else {
        await serviceApi.createService(formData);
        showToast(t('New service created successfully'));
      }
      setSubmitted(false);
      setNewPhotos([]);
      await loadServicesList();
      setViewMode('list');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t('Something went wrong'));
    } finally {
      hideLoading();
    }
  }

  function getCategoryName(catId: any) {
    const idStr = typeof catId === 'string' ? catId : catId?._id;
    const found = categories.find(c => c._id === idStr);
    return found ? found.name : t('Category');
  }

  if (viewMode === 'list') {
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.topHeader}>
          <View>
            <Text style={styles.headerTitle}>{t('My Services')}</Text>
            <Text style={styles.headerSubtitle}>
              {listingsLeft === null
                ? t('{{total}} services created', { total: servicesList.length })
                : t('{{total}} of {{limit}} services used', {
                    total: servicesList.length,
                    limit: listingLimit,
                  })}
            </Text>
          </View>
          {canManage && hasListingRoom ? (
            <TouchableOpacity style={styles.createBtn} onPress={startAddNewService}>
              <Text style={styles.createBtnText}>{t('+ Add Service')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <PlanStatusNotice entitlements={entitlements} onViewPlans={openPlans} style={styles.planNotice} />

        {entitlements.canWrite && !hasListingRoom ? (
          <PlanNotice
            tone="info"
            title={t('Service limit reached')}
            message={t('Your plan covers {{limit}} service listings and all of them are in use.', {
              limit: listingLimit,
            })}
            onViewPlans={openPlans}
            actionLabel={t('Upgrade plan')}
            style={styles.planNotice}
          />
        ) : null}

        {!canManage && entitlements.canWrite ? (
          <Text style={styles.readOnlyCaption}>
            {t('You can view these services but not change them.')}
          </Text>
        ) : null}

        {servicesList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <EmptyState message={t('No services created yet.')} />
            {canManage && hasListingRoom ? (
              <PrimaryButton
                title={t('+ Create First Service')}
                onPress={startAddNewService}
                style={styles.firstServiceBtn}
              />
            ) : null}
          </View>
        ) : (
          <View style={styles.cardList}>
            {servicesList.map(item => (
              <View key={item._id} style={styles.serviceCard}>
                {item.service_photo?.[0] ? (
                  <Image source={{ uri: item.service_photo[0] }} style={styles.cardImg} />
                ) : (
                  <View style={[styles.cardImg, styles.cardImgPlaceholder]}>
                    <Text style={styles.placeholderInitial}>{(item.service_name ?? 'S').charAt(0).toUpperCase()}</Text>
                  </View>
                )}

                <View style={styles.cardInfo}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitle}>{item.service_name}</Text>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>{getCategoryName(item.category)}</Text>
                    </View>
                  </View>

                  {item.address ? (
                    <Text style={styles.cardAddress} numberOfLines={1}>
                      📍 {item.address}
                    </Text>
                  ) : null}

                  <Text style={styles.cardSlots}>
                    ⏰ {t('{{total}} Available Slots', { total: item.service_slot?.length ?? 0 })}
                  </Text>

                  {canManage ? (
                    <View style={styles.cardActions}>
                      <TouchableOpacity style={styles.editBtn} onPress={() => startEditService(item)}>
                        <Text style={styles.editBtnText}>✏️ {t('Edit')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteService(item)}>
                        <Text style={styles.deleteBtnText}>🗑️ {t('Delete')}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.formHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setViewMode('list')}>
          <Text style={styles.backBtnText}>{t('← Back to List')}</Text>
        </TouchableOpacity>
        <Text style={styles.formTitle}>{serviceId ? t('Edit Service') : t('Add New Service')}</Text>
      </View>

      <TextField
        label={t('Service Name')}
        value={serviceName}
        onChangeText={value => setServiceName(sanitizeText(value, SERVICE_NAME_MAX))}
        maxLength={SERVICE_NAME_MAX}
        error={nameError}
      />

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>{t('Address')}</Text>
        <TextInput
          style={styles.input}
          value={address}
          onChangeText={onChangeAddress}
          maxLength={ADDRESS_MAX}
          placeholder={t('Enter address')}
          placeholderTextColor={colors.border}
        />
        {addressError ? <Text style={styles.error}>{addressError}</Text> : null}
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
      </View>

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>{t('Category')}</Text>
        <View style={styles.chipRow}>
          {categories.map(item => (
            <TouchableOpacity
              key={item._id}
              style={[styles.chip, categoryId === item._id && styles.chipActive]}
              onPress={() => setCategoryId(item._id)}>
              <Text style={[styles.chipText, categoryId === item._id && styles.chipTextActive]}>{item.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {categoryError ? <Text style={styles.error}>{categoryError}</Text> : null}
      </View>

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>{t('Service Slots')}</Text>
        <View style={styles.chipRow}>
          {slots.map(slot => (
            <TouchableOpacity key={slot} style={styles.slotChip} onPress={() => removeSlot(slot)}>
              <Text style={styles.slotChipText}>{slot} ×</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.addSlotButton} onPress={() => setShowTimePicker(true)}>
            <Text style={styles.addSlotText}>{t('+ Add Slot')}</Text>
          </TouchableOpacity>
        </View>
        {showTimePicker && (
          <DateTimePicker
            value={pickerTime}
            mode="time"
            is24Hour={false}
            display={Platform.OS === 'android' ? 'default' : 'spinner'}
            onChange={onTimeChange}
          />
        )}
        {showTimePicker && Platform.OS === 'ios' && (
          <PrimaryButton title={t('Add')} onPress={addSlot} style={styles.confirmSlotButton} />
        )}
        {slotsError ? <Text style={styles.error}>{slotsError}</Text> : null}
      </View>

      <TextField
        label={t('Description')}
        value={description}
        onChangeText={value => setDescription(sanitizeText(value, SERVICE_DESCRIPTION_MAX))}
        maxLength={SERVICE_DESCRIPTION_MAX}
        multiline
      />

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>{t('Photos')}</Text>
        <View style={styles.chipRow}>
          {existingPhotos.map(uri => (
            <View key={uri} style={styles.photoThumbWrap}>
              <Image source={{ uri }} style={styles.photoThumb} />
              <TouchableOpacity style={styles.removeBadge} onPress={() => removeExistingPhoto(uri)}>
                <Text style={styles.removeBadgeText}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
          {newPhotos.map(photo => (
            <View key={photo.uri} style={styles.photoThumbWrap}>
              <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
              <TouchableOpacity style={styles.removeBadge} onPress={() => removeNewPhoto(photo.uri)}>
                <Text style={styles.removeBadgeText}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
          {existingPhotos.length + newPhotos.length < MAX_PHOTOS ? (
            <TouchableOpacity style={styles.addPhotoButton} onPress={handlePickPhotos}>
              <Text style={styles.addPhotoText}>+</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <PrimaryButton
        title={serviceId ? t('Update Service') : t('Save Service')}
        onPress={handleSave}
        style={styles.button}
      />
      <TouchableOpacity style={styles.cancelBtn} onPress={() => setViewMode('list')}>
        <Text style={styles.cancelBtnText}>{t('Cancel')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 60 },
  topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.textDarker },
  headerSubtitle: { fontSize: 13, color: colors.gray, marginTop: 2 },
  readOnlyCaption: { fontSize: 12, color: colors.grayLight, marginTop: 12, lineHeight: 18 },
  planNotice: { marginBottom: 16 },
  createBtn: { backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  createBtnText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  emptyContainer: { marginTop: 40, alignItems: 'center' },
  firstServiceBtn: { marginTop: 20, width: '80%' },
  cardList: { gap: 16 },
  serviceCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.backgroundLightAlt,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardImg: { width: '100%', height: 140 },
  cardImgPlaceholder: { backgroundColor: colors.backgroundLight, alignItems: 'center', justifyContent: 'center' },
  placeholderInitial: { fontSize: 36, fontWeight: '700', color: colors.primary },
  cardInfo: { padding: 16 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.textDarker, flex: 1 },
  categoryBadge: { backgroundColor: colors.backgroundLight, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  categoryBadgeText: { fontSize: 11, color: colors.primary, fontWeight: '600' },
  cardAddress: { fontSize: 13, color: colors.gray, marginTop: 4 },
  cardSlots: { fontSize: 13, color: colors.textDark, fontWeight: '500', marginTop: 6 },
  cardActions: { flexDirection: 'row', gap: 12, marginTop: 14 },
  editBtn: { flex: 1, borderWidth: 1, borderColor: colors.primary, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  editBtnText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  deleteBtn: { flex: 1, borderWidth: 1, borderColor: '#e53935', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  deleteBtnText: { fontSize: 13, color: '#e53935', fontWeight: '600' },
  formHeader: { marginBottom: 16 },
  backBtn: { marginBottom: 10 },
  backBtnText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  formTitle: { fontSize: 20, fontWeight: '700', color: colors.textDarker },
  fieldWrap: { marginTop: 16 },
  label: { fontSize: 13, color: colors.gray, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.gray,
  },
  error: { fontSize: 13, color: 'red', marginTop: 5 },
  predictionsList: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.backgroundLightAlt, borderRadius: 10, marginTop: 6, overflow: 'hidden' },
  predictionRow: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.backgroundLightAlt },
  predictionText: { fontSize: 14, color: colors.textDark },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  chipActive: { backgroundColor: colors.primaryAlt, borderColor: colors.primaryAlt },
  chipText: { fontSize: 13, color: colors.textDark },
  chipTextActive: { color: colors.white },
  slotChip: { borderWidth: 1, borderColor: colors.primaryAlt, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  slotChipText: { fontSize: 13, color: colors.primaryAlt },
  addSlotButton: { borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  addSlotText: { fontSize: 13, color: colors.gray },
  confirmSlotButton: { marginTop: 10 },
  photoThumbWrap: { position: 'relative' },
  photoThumb: { width: 64, height: 64, borderRadius: 8 },
  removeBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.textDarker,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBadgeText: { color: colors.white, fontSize: 13, lineHeight: 14 },
  addPhotoButton: {
    width: 64,
    height: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoText: { fontSize: 24, color: colors.border },
  button: { marginTop: 24 },
  cancelBtn: { alignItems: 'center', marginTop: 14, paddingVertical: 10 },
  cancelBtnText: { color: colors.gray, fontSize: 14 },
});
