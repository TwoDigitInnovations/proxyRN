import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  Asset,
  ImagePickerResponse,
  PhotoQuality,
} from 'react-native-image-picker';
// Outside the React tree, so translate through the i18n instance rather than a hook.
import i18n from '../i18n';

type Source = 'camera' | 'gallery';

export interface PickOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: PhotoQuality;
  includeBase64?: boolean;
}

const DEFAULT_OPTIONS: Required<Omit<PickOptions, 'includeBase64'>> = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.8,
};

async function ensureCameraPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
    title: i18n.t('Camera access'),
    message: i18n.t('Proxy needs your camera to take document and profile photos.'),
    buttonPositive: i18n.t('OK'),
    buttonNegative: i18n.t('Cancel'),
  });

  if (result === PermissionsAndroid.RESULTS.GRANTED) return true;

  if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
    Alert.alert(i18n.t('Camera access'), i18n.t('Enable camera access for Proxy in Settings to take a photo.'), [
      { text: i18n.t('Cancel'), style: 'cancel' },
      { text: i18n.t('Open Settings'), onPress: () => Linking.openSettings() },
    ]);
  }
  return false;
}

function chooseSource(title: string): Promise<Source | null> {
  return new Promise(resolve => {
    let settled = false;
    const settle = (source: Source | null) => {
      if (settled) return;
      settled = true;
      resolve(source);
    };

    Alert.alert(
      title,
      i18n.t('Choose a source'),
      [
        { text: i18n.t('Cancel'), style: 'cancel', onPress: () => settle(null) },
        { text: i18n.t('Gallery'), onPress: () => settle('gallery') },
        { text: i18n.t('Camera'), onPress: () => settle('camera') },
      ],
      { cancelable: true, onDismiss: () => settle(null) },
    );
  });
}

function readResponse(response: ImagePickerResponse): Asset[] {
  if (response.didCancel) return [];

  if (response.errorCode) {
    const message =
      response.errorCode === 'camera_unavailable'
        ? i18n.t('No camera is available on this device.')
        : response.errorCode === 'permission'
        ? i18n.t('Permission denied. Allow photo access for Proxy in Settings.')
        : response.errorMessage || i18n.t('Could not open the photo picker.');
    Alert.alert(i18n.t('Photo unavailable'), message);
    return [];
  }

  return (response.assets ?? []).filter(asset => !!asset.uri);
}

async function launch(source: Source, selectionLimit: number, options?: PickOptions): Promise<Asset[]> {
  const common = { mediaType: 'photo', ...DEFAULT_OPTIONS, ...options } as const;

  if (source === 'camera') {
    if (!(await ensureCameraPermission())) return [];
    return readResponse(await launchCamera({ ...common, saveToPhotos: false }));
  }
  return readResponse(await launchImageLibrary({ ...common, selectionLimit }));
}

export async function pickImage(options?: PickOptions): Promise<Asset | null> {
  const source = await chooseSource(i18n.t('Select Photo'));
  if (!source) return null;
  const assets = await launch(source, 1, options);
  return assets[0] ?? null;
}

export async function pickMultipleImages(maxCount: number, options?: PickOptions): Promise<Asset[]> {
  const limit = Math.max(1, maxCount);
  const source = await chooseSource(i18n.t('Select Photos'));
  if (!source) return [];
  const assets = await launch(source, limit, options);
  return assets.slice(0, limit);
}
