import { useLocalization } from '../../localization/useLocalization';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Card, colors, commonStyles, Field, Label, Page, PageHeading } from '../../components/ui';
import { useDriver } from '../../context/DriverContext';
import { type DriverProfile } from '../../services/api';

export function ProfileScreen() {
  const { t } = useLocalization();
  const { profile } = useDriver();
  if (!profile) {
    return <Page><PageHeading title={t("Inicia sesión para ver tu perfil.")} /></Page>;
  }
  return <ProfileEditor key={profile.id} profile={profile} />;
}

function ProfileEditor({ profile }: { profile: DriverProfile }) {
  const { t, translateText } = useLocalization();
  const { updateProfile, uploadDocument, logout } = useDriver();
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.fullName);
  const [phone, setPhone] = useState(profile.phone);
  const [category, setCategory] = useState(profile.vehicle.category);
  const [plate, setPlate] = useState(profile.vehicle.plate);
  const [make, setMake] = useState(profile.vehicle.make);
  const [model, setModel] = useState(profile.vehicle.model);
  const [year, setYear] = useState(String(profile.vehicle.year));
  const [color, setColor] = useState(profile.vehicle.color);
  const [capacity, setCapacity] = useState(String(profile.vehicle.capacity));
  const [licenseNumber, setLicenseNumber] = useState(profile.documents.licenseNumber);
  const [licenseExpiry, setLicenseExpiry] = useState(profile.documents.licenseExpiry);
  const [soatExpiry, setSoatExpiry] = useState(profile.documents.soatExpiry);
  const [revisionExpiry, setRevisionExpiry] = useState(profile.documents.revisionExpiry ?? '');
  const [mercadoPagoEmail, setMercadoPagoEmail] = useState(profile.documents.mercadoPagoEmail);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await updateProfile({
        fullName: fullName.trim(),
        phone,
        vehicle: {
          category,
          plate: plate.toUpperCase(),
          make: make.trim(),
          model: model.trim(),
          year: Number(year),
          color,
          capacity: Number(capacity),
        },
        documents: {
          licenseNumber: licenseNumber.trim(),
          licenseExpiry,
          soatExpiry,
          revisionExpiry: revisionExpiry || null,
          mercadoPagoEmail: mercadoPagoEmail.trim().toLowerCase(),
        },
      });
      setMessage("Perfil, vehículo y documentos guardados.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el perfil.");
    } finally {
      setSaving(false);
    }
  };
  const signOut = async () => {
    try {
      await logout();
      router.replace('/login');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cerrar la sesión.");
    }
  };
  const uploadPhoto = async (kind: 'profile' | 'vehicle' | 'license' | 'soat' | 'revision') => {
    setMessage(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setMessage("Permite el acceso a la galería para actualizar el documento.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (result.canceled) return;
      setUploading(kind);
      const image = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
      );
      await uploadDocument(kind, image.uri);
      setMessage("Documento actualizado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar el documento.");
    } finally {
      setUploading(null);
    }
  };
  const choice = (label: string, value: string, options: string[], onChange: (value: string) => void) => (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.ink, fontWeight: '700' }}>{label}</Text>
      <View style={commonStyles.chipRow}>
        {options.map((option) => (
          <Pressable
            key={translateText(option)}
            onPress={() => onChange(option)}
            style={[
              commonStyles.chip,
              value === option ? commonStyles.chipSelected : null,
            ]}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={[
                commonStyles.chipText,
                value === option ? commonStyles.chipTextSelected : null,
              ]}
            >
              {option}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
  const photoAction = (kind: 'profile' | 'vehicle' | 'license' | 'soat' | 'revision', label: string) => (
    <View style={commonStyles.spread}>
      <Label>{label}</Label>
      <Button
        title={uploading === kind ? t("Subiendo…") : t("Actualizar foto")}
        variant="secondary"
        disabled={uploading !== null}
        onPress={() => void uploadPhoto(kind)}
      />
    </View>
  );
  return (
    <Page>
      <PageHeading title={t("Tu perfil")} subtitle={profile.fullName} />
      <Card>
        <Label>{t('Correo:')} {profile.email}</Label>
        <Label>{t('Documento:')} {profile.idNumber}</Label>
        <Label>{t('Estado:')} {profile.approvalStatus === 'approved' ? t("Aprobado") : profile.approvalStatus === 'rejected' ? t("Rechazado") : t("Pendiente de aprobación")}</Label>
        <Label muted>{t("Perfil cargado desde el backend. Las fotos y documentos se guardan de forma privada en GridFS.")}</Label>
      </Card>
      <Card>
        <Text style={commonStyles.sectionTitle}>{t("Datos personales")}</Text>
        <Field label={t("Nombre completo")} value={fullName} onChangeText={setFullName} />
        <Field label={t("Celular")} value={phone} onChangeText={setPhone} keyboardType="numeric" />
        {photoAction('profile', t("Foto de perfil"))}
      </Card>
      <Card>
        <Text style={commonStyles.sectionTitle}>{t("Vehículo")}</Text>
        {choice(t("Categoría"), category, ['Económico', 'XL', 'Premium'], (value) => setCategory(value as typeof category))}
        <Field label={t("Placa")} value={plate} onChangeText={(value) => setPlate(value.toUpperCase())} autoCapitalize="characters" />
        <Field label={t("Marca")} value={make} onChangeText={setMake} />
        <Field label={t("Modelo")} value={model} onChangeText={setModel} />
        <Field label={t("Año")} value={year} onChangeText={setYear} keyboardType="numeric" />
        {choice(t("Color"), color, ['Blanco', 'Negro', 'Gris', 'Rojo', 'Azul'], setColor)}
        <Field label={t("Capacidad de pasajeros")} value={capacity} onChangeText={setCapacity} keyboardType="numeric" />
        {photoAction('vehicle', t("Foto del vehículo"))}
      </Card>
      <Card>
        <Text style={commonStyles.sectionTitle}>{t("Documentos y pagos")}</Text>
        <Field label={t("Número de licencia")} value={licenseNumber} onChangeText={setLicenseNumber} />
        <Field label={t("Vencimiento de licencia (AAAA-MM-DD)")} value={licenseExpiry} onChangeText={setLicenseExpiry} />
        {photoAction('license', t("Licencia de conducción"))}
        <Field label={t("Vencimiento del SOAT (AAAA-MM-DD)")} value={soatExpiry} onChangeText={setSoatExpiry} />
        {photoAction('soat', t("SOAT"))}
        {Number(year) <= new Date().getFullYear() - 6 ? (
          <>
            <Field label={t("Vencimiento de revisión (AAAA-MM-DD)")} value={revisionExpiry} onChangeText={setRevisionExpiry} />
            {photoAction('revision', t("Revisión técnico-mecánica"))}
          </>
        ) : null}
        <Field
          label={t("Correo de Mercado Pago")}
          value={mercadoPagoEmail}
          onChangeText={setMercadoPagoEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Button title={saving ? t("Guardando…") : t("Guardar cambios")} onPress={() => void save()} disabled={saving} />
        {message ? <Label>{translateText(message)}</Label> : null}
      </Card>
      <Card>
        <Button title={t("Cerrar sesión")} variant="secondary" onPress={() => void signOut()} />
      </Card>
    </Page>
  );
}

export function SettingsScreen() {
  const { t, translateText } = useLocalization();
  const { profile, setLanguage } = useDriver();
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const chooseLanguage = async (language: 'Español' | 'Inglés') => {
    if (saving || language === profile?.language) return;
    setSaving(true);
    setMessage(null);
    try {
      await setLanguage(language);
      setMessage("Idioma actualizado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo actualizar el idioma.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Page>
      <PageHeading title={t("Configuración")} subtitle={t("Preferencias de la aplicación.")} />
      <Card>
        <Text style={commonStyles.sectionTitle}>{t("Idioma")}</Text>
        <View style={commonStyles.row}>
          <View style={{ flex: 1 }}>
            <Button
              title="Español"
              disabled={saving}
              variant={profile?.language === 'Español' ? 'primary' : 'secondary'}
              onPress={() => void chooseLanguage('Español')}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="English"
              disabled={saving}
              variant={profile?.language === 'Inglés' ? 'primary' : 'secondary'}
              onPress={() => void chooseLanguage('Inglés')}
            />
          </View>
        </View>
        {message ? <Label>{translateText(message)}</Label> : null}
      </Card>
      <Card>
        <Label>{t("Las preferencias se sincronizan con tu perfil. Los datos de pago sensibles permanecen en la pasarela.")}</Label>
      </Card>
    </Page>
  );
}
