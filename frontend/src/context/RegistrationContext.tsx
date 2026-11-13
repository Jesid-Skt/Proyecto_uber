import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import { createLocalization } from '../localization';
import type { RegistrationData } from '../utils/driver-registration';

const initialRegistration: RegistrationData = {
  fullName: '', idNumber: '', phone: '', birthDate: '', gender: '', email: '',
  language: 'Español', password: '', profilePhoto: '', category: 'Económico',
  plate: '', make: '', model: '', year: '', color: '', capacity: '', vehiclePhoto: '',
  licenseNumber: '', licensePhoto: '', licenseExpiry: '', soatPhoto: '', soatExpiry: '',
  revisionPhoto: '', revisionExpiry: '', mercadoPagoEmail: '',
};

export const registrationTabs = [
  { name: 'personal', href: '/register', label: 'Datos personales' },
  { name: 'vehicle', href: '/register/vehicle', label: 'Vehículo' },
  { name: 'documents', href: '/register/documents', label: 'Documentos' },
] as const;

function useRegistrationState() {
  const [data, setData] = useState(initialRegistration);
  const localization = useMemo(() => createLocalization(data.language), [data.language]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [attemptedSteps, setAttemptedSteps] = useState<Record<number, boolean>>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [mediaErrors, setMediaErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  return {
    localization,
    data, setData, termsAccepted, setTermsAccepted, attemptedSteps, setAttemptedSteps,
    serverErrors, setServerErrors, mediaErrors, setMediaErrors, message, setMessage,
    submitting, setSubmitting,
  };
}

const RegistrationContext = createContext<ReturnType<typeof useRegistrationState> | null>(null);

// The registration layout owns the draft, including photos and validation errors.
// Switching routes cannot reset it; leaving registration discards it.
export function RegistrationProvider({ children }: PropsWithChildren) {
  const state = useRegistrationState();
  return <RegistrationContext.Provider value={state}>{children}</RegistrationContext.Provider>;
}

export function useRegistration() {
  const state = useContext(RegistrationContext);
  if (!state) throw new Error('Registration screens require RegistrationProvider.');
  return state;
}
