import { useLocalization } from '../localization/useLocalization';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import { tripPalette } from './trip-flow-theme';

export function FloatingMenuButton({
  onPress,
  label,
}: {
  onPress: () => void;
  label?: string;
}) {
  const { t } = useLocalization();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? t('Abrir menú')}
      onPress={onPress}
      style={styles.button}
      hitSlop={8}
    >
      <Ionicons name="menu" size={23} color={tripPalette.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: tripPalette.border,
  },
});
