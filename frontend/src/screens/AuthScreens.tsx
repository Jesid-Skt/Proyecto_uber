import { useLocalization } from '../localization/useLocalization';
// AI-assisted: see docs/AI_LOG.md #1.
import React, { useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Field, Label, Page, PageHeading, commonStyles } from '../components/ui';
import { useDriver } from '../context/DriverContext';

export function LoginScreen() {
  const { t, translateText } = useLocalization();
  const { login, sessionError, retrySession } = useDriver();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/home');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "No se pudo iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Page>
      <PageHeading title={t("UberClone Conductor")} subtitle={t("Inicia sesión para consultar tu perfil guardado.")} />
      {sessionError ? (
        <Card>
          <Text style={commonStyles.errorText}>{translateText(sessionError)}</Text>
          <Button title={t("Reintentar conexión")} variant="secondary" onPress={() => void retrySession()} />
        </Card>
      ) : null}
      {error ? <Card><Text style={commonStyles.errorText}>{translateText(error)}</Text></Card> : null}
      <Card>
        <Field label={t("Correo electrónico")} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        <Field label={t("Contraseña")} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="password" />
        <Button title={submitting ? t("Ingresando…") : t("Iniciar sesión")} onPress={() => void submit()} disabled={submitting || !email || !password} />
      </Card>
      <Label muted>{t("¿Aún no tienes cuenta? Completa el registro del conductor.")}</Label>
      <Button title={t("Crear perfil de conductor")} variant="secondary" onPress={() => router.push('/register')} />
    </Page>
  );
}
