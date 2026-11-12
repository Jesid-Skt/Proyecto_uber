// AI-assisted: see docs/AI_LOG.md #11.
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useState } from 'react';
import { Image, Modal, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, commonStyles, Field, Label, Page, PageHeading } from '../../components/ui';
import { PRICING } from '../../config/pricing';
import { useDriver } from '../../context/DriverContext';
import { ApiError, appendImage } from '../../services/api';
import { registrationStyles } from './registrationStyles';
import {
  clearRegistrationFieldError,
  getRegistrationStepErrors,
  type RegistrationData,
} from '../../utils/driver-registration';
import { formatDateInput } from '../shared/formatters';

function formatRegistrationDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

const initialRegistration: RegistrationData = {
  fullName: '',
  idNumber: '',
  phone: '',
  birthDate: '',
  gender: '',
  email: '',
  language: 'Español',
  password: '',
  profilePhoto: '',
  category: 'Económico',
  plate: '',
  make: '',
  model: '',
  year: '',
  color: '',
  capacity: '',
  vehiclePhoto: '',
  licenseNumber: '',
  licensePhoto: '',
  licenseExpiry: '',
  soatPhoto: '',
  soatExpiry: '',
  revisionPhoto: '',
  revisionExpiry: '',
  mercadoPagoEmail: '',
};

export function DriverRegistrationScreen() {
  const { register, profile } = useDriver();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [data, setData] = useState(initialRegistration);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [attemptedSteps, setAttemptedSteps] = useState<Record<number, boolean>>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [mediaErrors, setMediaErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [dateField, setDateField] = useState<string | null>(null);
  const [pendingDate, setPendingDate] = useState(new Date(2000, 0, 1));
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const commissionRate = Math.round(PRICING.commissionRate * 100);
  const allErrors = [0, 1, 2].flatMap((targetStep) =>
    Object.keys(getRegistrationStepErrors(data, targetStep, termsAccepted)),
  );
  const registrationReady = allErrors.length === 0 && Object.keys(serverErrors).length === 0;
  const fieldErrors = {
    ...(attemptedSteps[step] ? getRegistrationStepErrors(data, step, termsAccepted) : {}),
    ...serverErrors,
    ...mediaErrors,
  };
  const update = (key: string, value: string) => {
    setData((current) => ({ ...current, [key]: value }));
    setServerErrors((current) => clearRegistrationFieldError(current, key));
    setMediaErrors((current) => ({ ...current, [key]: '' }));
    setMessage(null);
  };
  const showDatePicker = (key: string, current?: string) => {
    const today = new Date();
    const defaultDate = key === 'birthDate'
      ? new Date(today.getFullYear() - 18, today.getMonth(), today.getDate())
      : new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    setPendingDate(current ? new Date(`${current}T12:00:00`) : defaultDate);
    setDateField(key);
  };
  const pickPhoto = async (field: string, useCamera: boolean) => {
    try {
      const permission = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setMediaErrors((current) => ({ ...current, [field]: 'Permite el acceso a la cámara o galería.' }));
        return;
      }
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (!result.canceled) {
        const image = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
        );
        update(field, image.uri);
      }
    } catch (error) {
      console.error('No se pudo seleccionar la imagen.', error);
      setMediaErrors((current) => ({ ...current, [field]: 'No se pudo seleccionar la imagen.' }));
    }
  };
  const validate = (targetStep: number) => {
    setAttemptedSteps((current) => ({ ...current, [targetStep]: true }));
    return Object.keys(getRegistrationStepErrors(data, targetStep, termsAccepted)).length === 0;
  };
  const next = () => {
    if (validate(step)) {
      const nextStep = Math.min(step + 1, 2);
      setAttemptedSteps((current) => ({ ...current, [nextStep]: true }));
      setStep(nextStep);
    }
  };
  const submit = async () => {
    for (const targetStep of [0, 1, 2]) {
      if (!validate(targetStep)) {
        setStep(targetStep);
        return;
      }
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const form = new FormData();
      const fields: Record<string, string> = {
        fullName: data.fullName.trim(),
        email: data.email.trim().toLowerCase(),
        password: data.password,
        idNumber: data.idNumber,
        phone: data.phone,
        birthDate: data.birthDate,
        gender: data.gender,
        language: data.language,
        category: data.category,
        plate: data.plate.toUpperCase(),
        make: data.make.trim(),
        vehicleModel: data.model.trim(),
        year: data.year,
        color: data.color,
        capacity: data.capacity,
        licenseNumber: data.licenseNumber.trim(),
        licenseExpiry: data.licenseExpiry,
        soatExpiry: data.soatExpiry,
        revisionExpiry: data.revisionExpiry,
        mercadoPagoEmail: data.mercadoPagoEmail.trim().toLowerCase(),
        termsAccepted: String(termsAccepted),
      };
      Object.entries(fields).forEach(([key, value]) => form.append(key, value));
      for (const key of ['profilePhoto', 'vehiclePhoto', 'licensePhoto', 'soatPhoto']) {
        await appendImage(form, key, data[key]);
      }
      if (data.revisionPhoto) await appendImage(form, 'revisionPhoto', data.revisionPhoto);
      await register(form);
      router.replace('/home');
    } catch (error) {
      const details = error instanceof ApiError ? error.details : undefined;
      const nextErrors: Record<string, string> = {};
      if (Array.isArray(details)) {
        for (const detail of details) {
          if (
            detail
            && typeof detail === 'object'
            && 'field' in detail
            && 'message' in detail
            && typeof detail.field === 'string'
            && typeof detail.message === 'string'
          ) {
                  const field = detail.field === 'vehicleModel' ? 'model' : detail.field;
                  nextErrors[field] = detail.message;
                }
        }
      } else if (
        details
        && typeof details === 'object'
        && 'field' in details
        && typeof details.field === 'string'
      ) {
          const field = details.field === 'vehicleModel' ? 'model' : details.field;
          nextErrors[field] = error instanceof Error ? error.message : 'Revisa este campo.';
      }

      if (Object.keys(nextErrors).length) {
        setServerErrors(nextErrors);
        const personalFields = new Set([
          'profilePhoto', 'fullName', 'idNumber', 'phone', 'birthDate', 'gender',
          'email', 'password', 'language',
        ]);
        const vehicleFields = new Set([
          'category', 'plate', 'make', 'vehicleModel', 'year', 'color', 'capacity', 'vehiclePhoto',
        ]);
        const firstField = Object.keys(nextErrors)[0];
        const errorStep = personalFields.has(firstField) ? 0 : vehicleFields.has(firstField) ? 1 : 2;
        setAttemptedSteps((current) => ({ ...current, [errorStep]: true }));
        setStep(errorStep);
        setMessage(null);
      } else {
        setMessage(error instanceof Error ? error.message : 'No se pudo completar el registro.');
      }
    } finally {
      setSubmitting(false);
    }
  };
  const section = (
    key: string,
    label: string,
    options?: {
      keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
      upper?: boolean;
      maxLength?: number;
      secureTextEntry?: boolean;
      autoCapitalize?: 'none' | 'sentences';
      helperText?: string;
    },
  ) => (
    <View style={registrationStyles.formField}>
      <Field
        label={label}
        required
        value={data[key]}
        onChangeText={(value) => update(key, options?.upper ? value.toUpperCase() : value)}
        error={fieldErrors[key]}
        keyboardType={options?.keyboardType}
        maxLength={options?.maxLength}
        secureTextEntry={options?.secureTextEntry}
        helperText={options?.helperText}
        autoCapitalize={options?.upper ? 'characters' : options?.autoCapitalize ?? 'sentences'}
        autoCorrect={false}
      />
    </View>
  );
  const photo = (field: string, label: string) => (
    <View style={registrationStyles.photoField}>
      <View style={commonStyles.spread}>
        <Text style={registrationStyles.fieldLabel}>
          {label}<Text style={registrationStyles.requiredMark}> *</Text>
        </Text>
        <Text style={registrationStyles.requiredTag}>Obligatorio</Text>
      </View>
      {data[field] ? (
        <Image
          accessibilityLabel={`Vista previa: ${label}`}
          source={{ uri: data[field] }}
          style={registrationStyles.photoPreview}
          resizeMode="cover"
        />
      ) : (
        <View style={registrationStyles.photoPlaceholder}>
          <Text style={registrationStyles.photoGlyph}>＋</Text>
          <Text style={registrationStyles.photoHint}>Agrega una imagen clara y legible.</Text>
        </View>
      )}
      <Text style={registrationStyles.helperText}>Imagen JPEG, PNG o WebP; máximo 5 MB.</Text>
      <View style={commonStyles.row}>
        <View style={registrationStyles.photoButton}>
          <Button title="Elegir de galería" variant="secondary" onPress={() => void pickPhoto(field, false)} />
        </View>
        <View style={registrationStyles.photoButton}>
          <Button title="Tomar foto" variant="secondary" onPress={() => void pickPhoto(field, true)} />
        </View>
      </View>
      {fieldErrors[field] ? <Text style={registrationStyles.error}>{fieldErrors[field]}</Text> : null}
    </View>
  );
  const dropdown = (key: string, label: string, options: string[], helperText?: string) => {
    const expanded = openDropdown === key;
    return (
      <View style={registrationStyles.formField}>
        <Text style={registrationStyles.fieldLabel}>
          {label}<Text style={registrationStyles.requiredMark}> *</Text>
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={() => setOpenDropdown(expanded ? null : key)}
          style={[
            registrationStyles.dropdownTrigger,
            fieldErrors[key] ? registrationStyles.invalidField : null,
          ]}
        >
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            style={[
              registrationStyles.dropdownLabel,
              data[key] ? registrationStyles.dropdownValue : registrationStyles.dropdownPlaceholder,
            ]}
          >
            {data[key] || 'Selecciona una opción'}
          </Text>
          <Text style={registrationStyles.dropdownChevron}>{expanded ? '⌃' : '⌄'}</Text>
        </Pressable>
        {expanded ? (
          <View style={registrationStyles.dropdownMenu}>
            {options.map((option) => (
              <Pressable
                accessibilityRole="button"
                key={option}
                onPress={() => {
                  update(key, option);
                  setOpenDropdown(null);
                }}
                style={registrationStyles.dropdownOption}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  style={[
                    registrationStyles.dropdownOptionText,
                    data[key] === option ? registrationStyles.selectedOption : null,
                  ]}
                >
                  {option}
                </Text>
                {data[key] === option ? <Text style={registrationStyles.selectedOption}>✓</Text> : null}
              </Pressable>
            ))}
          </View>
        ) : null}
        {helperText ? <Text style={registrationStyles.helperText}>{helperText}</Text> : null}
        {fieldErrors[key] ? <Text style={registrationStyles.error}>{fieldErrors[key]}</Text> : null}
      </View>
    );
  };
  const dateFieldControl = (key: string, label: string, helperText: string) => (
    <View style={registrationStyles.formField}>
      <Text style={registrationStyles.fieldLabel}>
        {label}<Text style={registrationStyles.requiredMark}> *</Text>
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${data[key] ? formatRegistrationDate(new Date(`${data[key]}T12:00:00`)) : 'seleccionar fecha'}`}
        onPress={() => showDatePicker(key, data[key])}
        style={[
          registrationStyles.dropdownTrigger,
          fieldErrors[key] ? registrationStyles.invalidField : null,
        ]}
      >
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={[
            registrationStyles.dropdownLabel,
            data[key] ? registrationStyles.dropdownValue : registrationStyles.dropdownPlaceholder,
          ]}
        >
          {data[key] ? formatRegistrationDate(new Date(`${data[key]}T12:00:00`)) : 'Selecciona una fecha'}
        </Text>
        <Text style={registrationStyles.calendarGlyph}>▦</Text>
      </Pressable>
      <Text style={registrationStyles.helperText}>{helperText}</Text>
      {fieldErrors[key] ? <Text style={registrationStyles.error}>{fieldErrors[key]}</Text> : null}
    </View>
  );

  return (
    <Page>
      <View style={registrationStyles.header}>
        <Text style={registrationStyles.eyebrow}>CREA TU PERFIL</Text>
        <PageHeading
          title="Registro del conductor"
          subtitle="Completa tus datos para empezar el proceso de aprobación."
        />
      </View>
      <Card style={registrationStyles.progressCard}>
        <View style={commonStyles.spread}>
          <Text style={registrationStyles.progressTitle}>Paso {step + 1} de 3</Text>
          <Text style={registrationStyles.progressPercent}>{Math.round(((step + 1) / 3) * 100)} %</Text>
        </View>
        <View style={registrationStyles.progressTrack}>
          {[0, 1, 2].map((index) => (
            <View
              key={index}
              style={[
                registrationStyles.progressSegment,
                index <= step ? registrationStyles.progressSegmentActive : null,
              ]}
            />
          ))}
        </View>
        <Text style={registrationStyles.commissionNote}>
          La comisión de la plataforma es del {commissionRate} % por viaje.
        </Text>
      </Card>
      <View style={registrationStyles.tabRow}>
        {['Datos personales', 'Vehículo', 'Documentos'].map((name, index) => (
          <Pressable
            key={name}
            onPress={() => {
              setAttemptedSteps((current) => ({ ...current, [index]: true }));
              setStep(index);
              setOpenDropdown(null);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: step === index }}
            style={[
              registrationStyles.tab,
              step === index ? registrationStyles.activeTab : null,
            ]}
          >
            <Text style={[
              registrationStyles.tabNumber,
              step === index ? registrationStyles.activeTabText : null,
            ]}>
              {Object.keys(getRegistrationStepErrors(data, index, termsAccepted)).length === 0 ? '✓' : index + 1}
            </Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={[
                registrationStyles.tabLabel,
                step === index ? registrationStyles.activeTabText : null,
              ]}
            >
              {name}
            </Text>
          </Pressable>
        ))}
      </View>
      <Card style={registrationStyles.formCard}>
        {step === 0 ? (
          <>
            <View style={registrationStyles.sectionIntro}>
              <Text style={registrationStyles.formTitle}>Cuéntanos sobre ti</Text>
              <Text style={registrationStyles.formSubtitle}>Usaremos esta información para verificar tu identidad.</Text>
            </View>
            {photo('profilePhoto', 'Foto de perfil')}
            {section('fullName', 'Nombre completo', {
              maxLength: 50,
              helperText: 'De 1 a 50 caracteres; solo letras y espacios.',
            })}
            {section('idNumber', 'Documento de identidad', {
              keyboardType: 'numeric',
              maxLength: 10,
              helperText: 'De 6 a 10 dígitos numéricos, sin puntos ni espacios.',
            })}
            {section('phone', 'Número de celular', {
              keyboardType: 'phone-pad',
              maxLength: 10,
              helperText: 'Exactamente 10 dígitos, sin indicativo ni espacios.',
            })}
            {dateFieldControl('birthDate', 'Fecha de nacimiento', 'Debes tener 18 años o más.')}
            {dropdown('gender', 'Género', ['Femenino', 'Masculino', 'Otro'], 'Selecciona una opción.')}
            {section('email', 'Correo electrónico', {
              keyboardType: 'email-address',
              maxLength: 254,
              autoCapitalize: 'none',
              helperText: 'Máximo 254 caracteres; escribe una dirección de correo válida.',
            })}
            {section('password', 'Contraseña', {
              maxLength: 72,
              secureTextEntry: true,
              autoCapitalize: 'none',
              helperText: 'De 10 a 72 caracteres; incluye al menos una letra y un número.',
            })}
            {dropdown('language', 'Idioma', ['Español', 'Inglés'], 'Selecciona el idioma de la aplicación.')}
          </>
        ) : null}
        {step === 1 ? (
          <>
            <View style={registrationStyles.sectionIntro}>
              <Text style={registrationStyles.formTitle}>Registra tu vehículo</Text>
              <Text style={registrationStyles.formSubtitle}>Elige una categoría disponible para los viajes.</Text>
            </View>
            {dropdown('category', 'Categoría', ['Económico', 'XL', 'Premium'], 'Selecciona la categoría de servicio del vehículo.')}
            {section('plate', 'Placa', {
              upper: true,
              maxLength: 6,
              helperText: '6 caracteres: 3 letras y 3 números (ABC123). Se convierte a mayúsculas.',
            })}
            {section('make', 'Marca', { maxLength: 30, helperText: 'De 1 a 30 caracteres.' })}
            {section('model', 'Modelo', { maxLength: 30, helperText: 'De 1 a 30 caracteres.' })}
            {section('year', 'Año', {
              keyboardType: 'numeric',
              maxLength: 4,
              helperText: `4 dígitos; desde 1950 hasta ${new Date().getFullYear()}.`,
            })}
            {dropdown('color', 'Color', ['Blanco', 'Negro', 'Gris', 'Rojo', 'Azul'], 'Selecciona el color del vehículo.')}
            {section('capacity', 'Capacidad de pasajeros', {
              keyboardType: 'numeric',
              maxLength: 2,
              helperText: data.category === 'XL'
                ? 'De 6 a 20 pasajeros para categoría XL.'
                : 'De 1 a 20 pasajeros.',
            })}
            {photo('vehiclePhoto', 'Foto del vehículo con la placa visible')}
          </>
        ) : null}
        {step === 2 ? (
          <>
            <View style={registrationStyles.sectionIntro}>
              <Text style={registrationStyles.formTitle}>Documentos y pagos</Text>
              <Text style={registrationStyles.formSubtitle}>Las fotos deben ser legibles y las fechas estar vigentes.</Text>
            </View>
            {section('licenseNumber', 'Número de licencia', {
              maxLength: 40,
              helperText: 'De 1 a 40 caracteres; escríbelo como aparece en la licencia.',
            })}
            {photo('licensePhoto', 'Foto de licencia de conducción')}
            {dateFieldControl('licenseExpiry', 'Vencimiento de licencia', 'Selecciona una fecha posterior a hoy.')}
            {photo('soatPhoto', 'Foto del SOAT')}
            {dateFieldControl('soatExpiry', 'Vencimiento del SOAT', 'Selecciona una fecha posterior a hoy.')}
            {data.year && Number(data.year) <= new Date().getFullYear() - 6 ? (
              <>
                <Text style={registrationStyles.helperText}>
                  Obligatoria para vehículos modelo {new Date().getFullYear() - 6} o anteriores.
                </Text>
                {photo('revisionPhoto', 'Foto de revisión técnico-mecánica')}
                {dateFieldControl('revisionExpiry', 'Vencimiento de revisión', 'Selecciona una fecha posterior a hoy.')}
              </>
            ) : null}
            {section('mercadoPagoEmail', 'Correo de cuenta Mercado Pago', {
              keyboardType: 'email-address',
              maxLength: 254,
              autoCapitalize: 'none',
              helperText: 'Máximo 254 caracteres; debe ser un correo válido asociado a Mercado Pago.',
            })}
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: termsAccepted }}
              onPress={() => setTermsAccepted((value) => !value)}
              style={registrationStyles.termsRow}
            >
              <View style={[
                registrationStyles.checkbox,
                termsAccepted ? registrationStyles.checkboxChecked : null,
              ]}>
                {termsAccepted ? <Text style={registrationStyles.checkmark}>✓</Text> : null}
              </View>
              <Text style={registrationStyles.termsText}>
                Acepto los términos y autorizo una comisión del {commissionRate} % por viaje.
              </Text>
            </Pressable>
            {fieldErrors.termsAccepted ? (
              <Text style={registrationStyles.error}>{fieldErrors.termsAccepted}</Text>
            ) : null}
            <Text style={registrationStyles.paymentHint}>
              Solo guardamos el correo de Mercado Pago. No solicitamos datos de tarjetas ni cuentas bancarias.
            </Text>
          </>
        ) : null}
      </Card>
      {message ? <Card><Text style={commonStyles.errorText}>{message}</Text></Card> : null}
      <View style={registrationStyles.navigation}>
        {step > 0 ? (
          <View style={registrationStyles.navigationButton}>
            <Button
              title="Anterior"
              variant="secondary"
              onPress={() => {
                setStep((current) => current - 1);
                setOpenDropdown(null);
              }}
            />
          </View>
        ) : null}
        {step < 2 ? (
          <View style={step === 0
            ? registrationStyles.navigationSoloButton
            : registrationStyles.navigationButton}
          >
            <Button title="Continuar" onPress={next} />
          </View>
        ) : (
          <View style={registrationStyles.navigationButton}>
            <Button
              title={submitting ? 'Enviando registro…' : 'Enviar registro'}
              onPress={() => void submit()}
              disabled={submitting || !registrationReady}
            />
          </View>
        )}
      </View>
      <Label muted>
        {step === 2 && !registrationReady
          ? 'Completa y corrige los campos obligatorios para habilitar el envío.'
          : profile
            ? 'Ya tienes una sesión iniciada.'
            : 'Tus datos se envían al backend de forma segura. Tu cuenta quedará pendiente de aprobación.'}
      </Label>
      {Platform.OS === 'ios' ? (
        <Modal
          visible={dateField !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setDateField(null)}
        >
          <View style={registrationStyles.dateModalBackdrop}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar selector de fecha"
              style={registrationStyles.dateModalDismiss}
              onPress={() => setDateField(null)}
            />
            <View
              style={[
                registrationStyles.dateModalSheet,
                { paddingBottom: Math.max(insets.bottom, 20) },
              ]}
            >
              <View style={registrationStyles.dateModalHeader}>
                <Text style={registrationStyles.dateModalTitle}>
                  {dateField === 'birthDate'
                    ? 'Fecha de nacimiento'
                    : dateField === 'licenseExpiry'
                      ? 'Vencimiento de licencia'
                      : dateField === 'soatExpiry'
                        ? 'Vencimiento del SOAT'
                        : 'Vencimiento de revisión'}
                </Text>
                <Button
                  title="Listo"
                  onPress={() => {
                    if (dateField) update(dateField, formatDateInput(pendingDate));
                    setDateField(null);
                  }}
                />
              </View>
              {dateField ? (
                <DateTimePicker
                  style={registrationStyles.datePicker}
                  value={pendingDate}
                  mode="date"
                  display="spinner"
                  locale="es-CO"
                  maximumDate={dateField === 'birthDate'
                    ? new Date(new Date().getFullYear() - 18, new Date().getMonth(), new Date().getDate())
                    : undefined}
                  minimumDate={dateField === 'birthDate'
                    ? undefined
                    : new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 1)}
                  onValueChange={(_, selectedDate) => setPendingDate(selectedDate)}
                />
              ) : null}
            </View>
          </View>
        </Modal>
      ) : dateField ? (
        <DateTimePicker
          value={pendingDate}
          mode="date"
          display="default"
          maximumDate={dateField === 'birthDate'
            ? new Date(new Date().getFullYear() - 18, new Date().getMonth(), new Date().getDate())
            : undefined}
          minimumDate={dateField === 'birthDate'
            ? undefined
            : new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 1)}
          onValueChange={(_, selectedDate) => {
            update(dateField, formatDateInput(selectedDate));
            setDateField(null);
          }}
          onDismiss={() => setDateField(null)}
        />
      ) : null}
    </Page>
  );
}
