
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Indica si la aplicación puede utilizar módulos nativos
 * de Firebase.
 *
 * No comprueba que Firebase esté inicializado.
 */
export function supportsNativeFirebase(): boolean {
  if (Platform.OS === 'web') {
    return false;
  }

  return (
    Constants.executionEnvironment !==
    ExecutionEnvironment.StoreClient
  );
}
