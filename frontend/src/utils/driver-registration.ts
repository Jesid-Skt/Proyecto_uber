export type RegistrationData = Record<string, string>;

function isValidDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(date.getTime())
    && date.getFullYear() === Number(value.slice(0, 4))
    && date.getMonth() + 1 === Number(value.slice(5, 7))
    && date.getDate() === Number(value.slice(8, 10));
}

function isFutureDate(value: string, now: Date): boolean {
  if (!isValidDate(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return date > today;
}

function isAdult(value: string, now: Date): boolean {
  if (!isValidDate(value)) return false;
  const birthDate = new Date(`${value}T00:00:00`);
  const cutoff = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
  return birthDate <= cutoff;
}

function isValidEmail(value: string): boolean {
  return value.trim().length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function getRegistrationStepErrors(
  data: RegistrationData,
  step: number,
  termsAccepted: boolean,
  now = new Date(),
): Record<string, string> {
  const errors: Record<string, string> = {};
  const required = (key: string, label: string) => {
    if (!data[key]?.trim()) errors[key] = `${label} es obligatorio.`;
  };

  if (step === 0) {
    required('profilePhoto', 'La foto de perfil');
    required('fullName', 'El nombre');
    if (data.fullName && !/^[\p{L}\s]{1,50}$/u.test(data.fullName.trim())) {
      errors.fullName = 'Usa solo letras y espacios (máximo 50 caracteres).';
    }
    required('idNumber', 'El documento');
    if (data.idNumber && !/^\d{6,10}$/.test(data.idNumber)) {
      errors.idNumber = 'Debe contener entre 6 y 10 dígitos.';
    }
    required('phone', 'El celular');
    if (data.phone && !/^\d{10}$/.test(data.phone)) {
      errors.phone = 'Debe contener exactamente 10 dígitos.';
    }
    required('birthDate', 'La fecha de nacimiento');
    if (data.birthDate && !isAdult(data.birthDate, now)) {
      errors.birthDate = 'Debes tener al menos 18 años.';
    }
    required('gender', 'El género');
    required('email', 'El correo');
    if (data.email && !isValidEmail(data.email)) {
      errors.email = 'Ingresa un correo válido de máximo 254 caracteres.';
    }
    required('password', 'La contraseña');
    if (
      data.password
      && (
        data.password.length < 10
        || data.password.length > 72
        || !/[A-Za-z]/.test(data.password)
        || !/\d/.test(data.password)
      )
    ) {
      errors.password = 'Usa 10 a 72 caracteres e incluye al menos una letra y un número.';
    }
    required('language', 'El idioma');
  }

  if (step === 1) {
    required('category', 'La categoría');
    required('plate', 'La placa');
    if (data.plate && !/^[A-Z]{3}\d{3}$/.test(data.plate.toUpperCase())) {
      errors.plate = 'Formato requerido: ABC123.';
    }
    required('make', 'La marca');
    if (data.make.trim().length > 30) errors.make = 'Máximo 30 caracteres.';
    required('model', 'El modelo');
    if (data.model.trim().length > 30) errors.model = 'Máximo 30 caracteres.';
    required('year', 'El año');
    if (
      data.year
      && (
        !/^\d{4}$/.test(data.year)
        || Number(data.year) < 1950
        || Number(data.year) > now.getFullYear()
      )
    ) {
      errors.year = `Ingresa un año entre 1950 y ${now.getFullYear()}.`;
    }
    required('color', 'El color');
    if (data.color.trim().length > 30) errors.color = 'Máximo 30 caracteres.';
    required('capacity', 'La capacidad');
    if (
      data.capacity
      && (
        !/^\d+$/.test(data.capacity)
        || Number(data.capacity) < 1
        || Number(data.capacity) > 20
        || (data.category === 'XL' && Number(data.capacity) < 6)
      )
    ) {
      errors.capacity = data.category === 'XL'
        ? 'XL requiere de 6 a 20 pasajeros.'
        : 'Ingresa una capacidad de 1 a 20 pasajeros.';
    }
    required('vehiclePhoto', 'La foto del vehículo');
  }

  if (step === 2) {
    required('licenseNumber', 'El número de licencia');
    if (data.licenseNumber.trim().length > 40) {
      errors.licenseNumber = 'Máximo 40 caracteres.';
    }
    required('licensePhoto', 'La foto de licencia');
    required('licenseExpiry', 'El vencimiento de licencia');
    if (data.licenseExpiry && !isFutureDate(data.licenseExpiry, now)) {
      errors.licenseExpiry = 'La fecha debe ser futura.';
    }
    required('soatPhoto', 'La foto del SOAT');
    required('soatExpiry', 'El vencimiento del SOAT');
    if (data.soatExpiry && !isFutureDate(data.soatExpiry, now)) {
      errors.soatExpiry = 'La fecha debe ser futura.';
    }
    if (data.year && Number(data.year) <= now.getFullYear() - 6) {
      required('revisionPhoto', 'La foto de revisión técnico-mecánica');
      required('revisionExpiry', 'El vencimiento de revisión');
      if (data.revisionExpiry && !isFutureDate(data.revisionExpiry, now)) {
        errors.revisionExpiry = 'La fecha debe ser futura.';
      }
    }
    required('mercadoPagoEmail', 'El correo de Mercado Pago');
    if (data.mercadoPagoEmail && !isValidEmail(data.mercadoPagoEmail)) {
      errors.mercadoPagoEmail = 'Ingresa un correo válido de máximo 254 caracteres.';
    }
    if (!termsAccepted) {
      errors.termsAccepted = 'Debes aceptar los términos y la comisión indicada.';
    }
  }

  return errors;
}
