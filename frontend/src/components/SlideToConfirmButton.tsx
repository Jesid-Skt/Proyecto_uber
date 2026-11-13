import { useLocalization } from '../localization/useLocalization';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { tripPalette } from './trip-flow-theme';

const HANDLE_SIZE = 50;
const TRACK_PADDING = 5;

export function SlideToConfirmButton({
  title,
  disabled = false,
  onConfirm,
}: {
  title: string;
  disabled?: boolean;
  onConfirm: () => void;
}) {
  const { t } = useLocalization();
  const trackWidth = useSharedValue(0);
  const translateX = useSharedValue(0);

  const notifyComplete = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch((error: unknown) => {
      console.warn('No se pudo reproducir la respuesta háptica.', error);
    });
    onConfirm();
  }, [onConfirm]);

  useEffect(() => {
    if (disabled) {
      // Reanimated shared values are intentionally updated outside render.
      // eslint-disable-next-line react-hooks/immutability
      translateX.value = withSpring(0, { damping: 18, stiffness: 180 });
    }
  }, [disabled, translateX]);

  const gesture = useMemo(() => Gesture.Pan()
    .enabled(!disabled)
    .onUpdate((event) => {
      const maxTranslation = Math.max(0, trackWidth.value - HANDLE_SIZE - TRACK_PADDING * 2);
      // eslint-disable-next-line react-hooks/immutability
      translateX.value = Math.max(0, Math.min(event.translationX, maxTranslation));
    })
    .onEnd(() => {
      const maxTranslation = Math.max(0, trackWidth.value - HANDLE_SIZE - TRACK_PADDING * 2);
      if (maxTranslation > 0 && translateX.value / maxTranslation >= 0.85) {
        // eslint-disable-next-line react-hooks/immutability
        translateX.value = withSpring(maxTranslation, { damping: 18, stiffness: 180 });
        runOnJS(notifyComplete)();
      } else {
        translateX.value = withSpring(0, { damping: 18, stiffness: 180 });
      }
    }), [disabled, notifyComplete, trackWidth, translateX]);

  const fillStyle = useAnimatedStyle(() => ({
    width: translateX.value + HANDLE_SIZE + TRACK_PADDING,
  }));
  const handleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View
      style={[styles.track, disabled && styles.disabled]}
      onLayout={(event) => {
        // eslint-disable-next-line react-hooks/immutability
        trackWidth.value = event.nativeEvent.layout.width;
      }}
    >
      <Animated.View pointerEvents="none" style={[styles.fill, fillStyle]} />
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <GestureDetector gesture={gesture}>
        <Animated.View
          accessible
          accessibilityRole="button"
          accessibilityLabel={title}
          accessibilityHint={t("Desliza hacia la derecha para confirmar")}
          accessibilityState={{ disabled }}
          onAccessibilityTap={() => {
            if (!disabled) notifyComplete();
          }}
          style={[styles.handle, handleStyle]}
        >
          <Ionicons name="arrow-forward" size={23} color={tripPalette.background} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 60,
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 30,
    backgroundColor: tripPalette.elevated,
    borderWidth: 1,
    borderColor: tripPalette.border,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 30,
    backgroundColor: tripPalette.accent,
  },
  title: {
    paddingHorizontal: HANDLE_SIZE + 20,
    color: tripPalette.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  handle: {
    position: 'absolute',
    left: TRACK_PADDING,
    top: TRACK_PADDING,
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: HANDLE_SIZE / 2,
    backgroundColor: tripPalette.text,
  },
  disabled: { opacity: 0.5 },
});
