import {
  DynamicColorIOS,
  Platform,
  StyleSheet,
  type ColorValue,
} from 'react-native';

function adaptiveColor(light: string, dark: string): ColorValue {
  if (Platform.OS === 'ios') return DynamicColorIOS({ light, dark });
  return light;
}

export const colors = {
  background: adaptiveColor('#F4F6F5', '#101713'),
  surface: adaptiveColor('#FFFFFF', '#19221D'),
  ink: adaptiveColor('#17211C', '#F3F6F4'),
  muted: adaptiveColor('#64716A', '#AAB6AE'),
  accent: '#087F5B',
  accentLight: adaptiveColor('#E5F3EC', '#20382D'),
  danger: adaptiveColor('#B42318', '#FF8A80'),
  line: adaptiveColor('#E0E6E2', '#303B35'),
  navy: '#10251C',
  onAccent: '#FFFFFF',
  onDarkSurface: '#DCE8E1',
  placeholder: adaptiveColor('#89948E', '#89958E'),
  photoSurface: adaptiveColor('#F8FAF9', '#1D2923'),
  photoBorder: adaptiveColor('#C7D3CC', '#526057'),
  chipSurface: adaptiveColor('#E9EEEB', '#29352E'),
  checkboxBorder: adaptiveColor('#A8B5AD', '#7F8D84'),
};

export const spacing = {
  xxs: 3,
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  page: 18,
  pageBottom: 36,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

export const typography = {
  caption: 12,
  label: 14,
  body: 15,
  subtitle: 14,
  section: 18,
  title: 28,
  display: 30,
  lineBody: 22,
  lineCaption: 18,
  regular: '400' as const,
  medium: '600' as const,
  semibold: '700' as const,
  bold: '800' as const,
};

export const borders = {
  hairline: StyleSheet.hairlineWidth,
  regular: 1,
  strong: 1.5,
};

export const shadows = StyleSheet.create({
  card: {
    shadowColor: '#0A2015',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },
});
