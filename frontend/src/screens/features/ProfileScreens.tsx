import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Card, colors, commonStyles, Field, Label, Page, PageHeading } from '../../components/ui';
import { useDriver } from '../../context/DriverContext';
import { type DriverProfile } from '../../services/api';

export function ProfileScreen() {
  const { profile } = useDriver();
  if (!profile) {
    return <Page><PageHeading title="Inicia sesión para ver tu perfil." /></Page>;
  }
  return <ProfileEditor key={profile.id} profile={profile} />;
}

function ProfileEditor({ profile }: { profile: DriverProfile }) {
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
      setMessage('Perfil, vehículo y documentos guardados.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar el perfil.');
    } finally {
      setSaving(false);
    }
  };
  const signOut = async () => {
    try {
      await logout();
      router.replace('/login');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo cerrar la sesión.');
    }
  };
  const uploadPhoto = async (kind: 'profile' | 'vehicle' | 'license' | 'soat' | 'revision') => {
    setMessage(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setMessage('Permite el acceso a la galería para actualizar el documento.');
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
      setMessage('Documento actualizado.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo actualizar el documento.');
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
            key={option}
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
        title={uploading === kind ? 'Subiendo…' : 'Actualizar foto'}
        variant="secondary"
        disabled={uploading !== null}
        onPress={() => void uploadPhoto(kind)}
      />
    </View>
  );
  return (
    <Page>
      <PageHeading title="Tu perfil" subtitle={profile.fullName} />
      <Card>
        <Label>Correo: {profile.email}</Label>
        <Label>Documento: {profile.idNumber}</Label>
        <Label>Estado: {profile.approvalStatus === 'approved' ? 'Aprobado' : profile.approvalStatus === 'rejected' ? 'Rechazado' : 'Pendiente de aprobación'}</Label>
        <Label muted>Perfil cargado desde el backend. Las fotos y documentos se guardan de forma privada en GridFS.</Label>
      </Card>
      <Card>
        <Text style={commonStyles.sectionTitle}>Datos personales</Text>
        <Field label="Nombre completo" value={fullName} onChangeText={setFullName} />
        <Field label="Celular" value={phone} onChangeText={setPhone} keyboardType="numeric" />
        {photoAction('profile', 'Foto de perfil')}
      </Card>
      <Card>
        <Text style={commonStyles.sectionTitle}>Vehículo</Text>
        {choice('Categoría', category, ['Económico', 'XL', 'Premium'], (value) => setCategory(value as typeof category))}
        <Field label="Placa" value={plate} onChangeText={(value) => setPlate(value.toUpperCase())} autoCapitalize="characters" />
        <Field label="Marca" value={make} onChangeText={setMake} />
        <Field label="Modelo" value={model} onChangeText={setModel} />
        <Field label="Año" value={year} onChangeText={setYear} keyboardType="numeric" />
        {choice('Color', color, ['Blanco', 'Negro', 'Gris', 'Rojo', 'Azul'], setColor)}
        <Field label="Capacidad de pasajeros" value={capacity} onChangeText={setCapacity} keyboardType="numeric" />
        {photoAction('vehicle', 'Foto del vehículo')}
      </Card>
      <Card>
        <Text style={commonStyles.sectionTitle}>Documentos y pagos</Text>
        <Field label="Número de licencia" value={licenseNumber} onChangeText={setLicenseNumber} />
        <Field label="Vencimiento de licencia (AAAA-MM-DD)" value={licenseExpiry} onChangeText={setLicenseExpiry} />
        {photoAction('license', 'Licencia de conducción')}
        <Field label="Vencimiento del SOAT (AAAA-MM-DD)" value={soatExpiry} onChangeText={setSoatExpiry} />
        {photoAction('soat', 'SOAT')}
        {Number(year) <= new Date().getFullYear() - 6 ? (
          <>
            <Field label="Vencimiento de revisión (AAAA-MM-DD)" value={revisionExpiry} onChangeText={setRevisionExpiry} />
            {photoAction('revision', 'Revisión técnico-mecánica')}
          </>
        ) : null}
        <Field
          label="Correo de Mercado Pago"
          value={mercadoPagoEmail}
          onChangeText={setMercadoPagoEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Button title={saving ? 'Guardando…' : 'Guardar cambios'} onPress={() => void save()} disabled={saving} />
        {message ? <Label>{message}</Label> : null}
      </Card>
      <Card>
        <Button title="Cerrar sesión" variant="secondary" onPress={() => void signOut()} />
      </Card>
    </Page>
  );
}

export function SettingsScreen() {
  const { profile, setLanguage } = useDriver();
  const [message, setMessage] = useState<string | null>(null);
  const chooseLanguage = async (language: 'Español' | 'Inglés') => {
    try {
      await setLanguage(language);
      setMessage('Idioma actualizado.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo actualizar el idioma.');
    }
  };
  return (
    <Page>
      <PageHeading title="Configuración" subtitle="Preferencias de la aplicación." />
      <Card>
        <Text style={commonStyles.sectionTitle}>Idioma</Text>
        <View style={commonStyles.row}>
          <View style={{ flex: 1 }}>
            <Button
              title="Español"
              variant={profile?.language === 'Español' ? 'primary' : 'secondary'}
              onPress={() => void chooseLanguage('Español')}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="English"
              variant={profile?.language === 'Inglés' ? 'primary' : 'secondary'}
              onPress={() => void chooseLanguage('Inglés')}
            />
          </View>
        </View>
        {message ? <Label>{message}</Label> : null}
      </Card>
      <Card>
        <Label>Las preferencias se sincronizan con tu perfil. Los datos de pago sensibles permanecen en la pasarela.</Label>
      </Card>
    </Page>
  );
}
