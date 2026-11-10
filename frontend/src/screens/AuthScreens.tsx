// AI-assisted: see docs/AI_LOG.md #1.
import React, { useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Field, Label, Page, PageHeading, commonStyles } from '../components/ui';
import { useDriver } from '../context/DriverContext';

export function LoginScreen() {
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
      setError(loginError instanceof Error ? loginError.message : 'No se pudo iniciar sesión.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Page>
      <PageHeading title="UberClone Conductor" subtitle="Inicia sesión para consultar tu perfil guardado." />
      {sessionError ? (
        <Card>
          <Text style={commonStyles.errorText}>{sessionError}</Text>
          <Button title="Reintentar conexión" variant="secondary" onPress={() => void retrySession()} />
        </Card>
      ) : null}
      {error ? <Card><Text style={commonStyles.errorText}>{error}</Text></Card> : null}
      <Card>
        <Field label="Correo electrónico" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        <Field label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="password" />
        <Button title={submitting ? 'Ingresando…' : 'Iniciar sesión'} onPress={() => void submit()} disabled={submitting || !email || !password} />
      </Card>
      <Label muted>¿Aún no tienes cuenta? Completa el registro del conductor.</Label>
      <Button title="Crear perfil de conductor" variant="secondary" onPress={() => router.push('/register')} />
    </Page>
  );
}
