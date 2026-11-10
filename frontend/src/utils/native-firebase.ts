import Constants from 'expo-constants';
import { Platform } from 'react-native';

export function supportsNativeFirebase(): boolean {
  return Platform.OS !== 'web' && Constants.appOwnership !== 'expo';
}
