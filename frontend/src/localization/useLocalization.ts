import { useMemo } from 'react';
import { useDriver } from '../context/DriverContext';
import { createLocalization } from './index';

/** Reactively follows the persisted profile; unauthenticated screens default to Spanish. */
export function useLocalization() {
  const { profile } = useDriver();
  return useMemo(() => createLocalization(profile?.language), [profile?.language]);
}

