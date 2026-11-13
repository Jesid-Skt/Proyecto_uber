# UberClone — Pantallas y componentes pendientes
## Versión Conductor · React Native + Expo

## 1. Estado actual del proyecto

### Ya implementado
- Registro del conductor.
- Inicio de sesión.
- Perfil y configuración con los datos del conductor.
- Historial de viajes.
- Pantalla de ganancias.

**Importante:** estas pantallas existentes deben reutilizarse. No se deben reconstruir ni duplicar.

### Pendiente de desarrollo
1. Inicio operativo del conductor.
2. Solicitud entrante.
3. Navegación hacia el punto de recogida.
4. Viaje en curso.
5. Cobro del viaje.
6. Resumen del viaje.
7. Detalle del viaje, únicamente si todavía no existe.
8. Componentes y servicios compartidos necesarios para conectar todo el flujo.

---

## 2. Pantalla de inicio operativo

**Archivo sugerido:** `src/screens/driver/DriverHomeScreen.jsx`

### Objetivo
Permitir que el conductor aprobado se ponga disponible y reciba solicitudes de viaje.

### Componentes visuales
- Mapa con ubicación actual.
- Control Disponible / No disponible.
- Indicador de aprobación de la cuenta.
- Panel inferior con información contextual.
- Indicador de conexión y ubicación.
- Accesos al perfil, historial y ganancias existentes.

### Funcionalidad
- Consultar el estado del conductor al entrar.
- Consultar si existe un viaje activo.
- Impedir que un conductor pendiente de aprobación se ponga disponible.
- Solicitar permisos de ubicación.
- Enviar la ubicación al backend mediante el servicio existente.
- Detener el seguimiento al desactivar la disponibilidad.
- Recuperar el viaje activo al reabrir la aplicación.

### Criterios de aceptación
- [ ] La disponibilidad se confirma con el backend.
- [ ] No se activa un conductor sin aprobación.
- [ ] No se crean seguimientos de ubicación duplicados.
- [ ] Se muestran estados de carga y error.
- [ ] Un viaje activo se recupera al reiniciar la aplicación.

---

## 3. Pantalla de solicitud entrante

**Archivo sugerido:** `src/screens/trips/TripRequestScreen.jsx`

### Objetivo
Mostrar una solicitud nueva y permitir aceptarla o rechazarla.

### Información
- Origen y dirección.
- Destino y dirección.
- Distancia y duración estimadas.
- Categoría del viaje.
- Tarifa estimada.
- Cuenta regresiva de 15 segundos.
- Botones Aceptar y Rechazar.

### Funcionalidad
- Recibir la solicitud mediante el mecanismo de tiempo real del proyecto.
- Iniciar el temporizador de 15 segundos.
- Enviar la aceptación al backend.
- Navegar a la recogida solo después de confirmar la aceptación.
- Rechazar o marcar como vencida la solicitud cuando se agote el tiempo, según el contrato del backend.
- Deshabilitar botones mientras se procesa una acción.
- Limpiar temporizadores y listeners al salir.

### Criterios de aceptación
- [ ] La solicitud muestra información correcta.
- [ ] El temporizador dura 15 segundos.
- [ ] No se acepta dos veces la misma solicitud.
- [ ] Los errores de red se muestran claramente.
- [ ] La navegación depende del estado confirmado por el backend.

---

## 4. Pantalla de camino a recoger al pasajero

**Archivo sugerido:** `src/screens/trips/PickupNavigationScreen.jsx`

### Objetivo
Guiar al conductor hasta el origen del viaje.

### Componentes visuales
- Mapa con ruta al punto de recogida.
- Dirección del pasajero.
- Distancia y tiempo restante, si están disponibles.
- Resumen de la solicitud.
- Botón Pasajero a bordo.

### Funcionalidad
- Cargar el viaje aceptado.
- Mostrar la ruta al origen.
- Actualizar la ubicación del conductor.
- Enviar al backend la confirmación de recogida.
- Navegar al viaje en curso solo después de confirmar el cambio.
- Sincronizar cancelaciones o modificaciones externas del viaje.

### Criterios de aceptación
- [ ] La ruta apunta al origen.
- [ ] La recogida se registra en el backend.
- [ ] No se avanza si el backend rechaza la transición.
- [ ] Los errores de navegación tienen una alternativa informativa.

---

## 5. Pantalla de viaje en curso

**Archivo sugerido:** `src/screens/trips/ActiveTripScreen.jsx`

### Objetivo
Mostrar la ruta hacia el destino y permitir finalizar el viaje.

### Componentes visuales
- Mapa con ruta al destino.
- Dirección del destino.
- Distancia y duración, si están disponibles.
- Indicador Viaje en curso.
- Botón Finalizar viaje.

### Funcionalidad
- Recuperar el viaje activo desde el backend.
- Mostrar la ruta al destino.
- Mantener sincronizado el estado del viaje.
- Evitar envíos duplicados al finalizar.
- Solicitar al backend el cierre y la tarifa definitiva.
- Navegar al cobro cuando el cierre sea confirmado.

### Criterios de aceptación
- [ ] La ruta cambia al destino después de confirmar la recogida.
- [ ] El cierre del viaje se registra una sola vez.
- [ ] La tarifa final proviene del backend.
- [ ] El viaje puede recuperarse después de reiniciar la app.

---

## 6. Pantalla de cobro

**Archivo sugerido:** `src/screens/trips/TripPaymentScreen.jsx`

### Objetivo
Completar el registro del pago del viaje.

### Información
- Tarifa final.
- Comisión de la plataforma.
- Propina, si aplica.
- Ganancia neta.
- Método de pago.
- Estado del pago.

### Pago mediante pasarela
- Solicitar al backend la creación del proceso de pago.
- Abrir el checkout de prueba configurado.
- Consultar el resultado confirmado por el backend.
- Mostrar aprobado, pendiente o fallido según el estado real.

### Pago en efectivo
- Mostrar el monto a cobrar.
- Permitir marcar Efectivo recibido.
- Enviar la confirmación al backend.
- Actualizar el estado del pago y la comisión correspondiente.

### Seguridad
- No incluir claves secretas de Mercado Pago o Stripe en la aplicación.
- No guardar datos de tarjetas en AsyncStorage.
- No marcar un pago como aprobado solamente porque el usuario regresó del checkout.

### Criterios de aceptación
- [ ] El monto coincide con el backend.
- [ ] Los pagos pendientes no se muestran como aprobados.
- [ ] El efectivo requiere confirmación explícita.
- [ ] Los errores permiten consultar o reintentar el pago.

---

## 7. Pantalla de resumen del viaje

**Archivo sugerido:** `src/screens/trips/TripSummaryScreen.jsx`

### Objetivo
Mostrar el resultado del viaje y el desglose económico.

### Información
- Confirmación de viaje completado.
- Origen y destino.
- Distancia y duración registradas.
- Tarifa total.
- Comisión de la plataforma.
- Propina.
- Ganancia neta.
- Método y estado del pago.
- Botón Volver al inicio.
- Acceso al historial existente.

### Reglas económicas indicadas en las especificaciones
- Comisión de referencia: 20 %.
- La propina corresponde íntegramente al conductor.
- La tarifa se redondea al múltiplo de 100 COP más cercano antes de calcular la comisión.
- El frontend debe mostrar los valores validados por el backend y no duplicar la lógica de cálculo.

### Ejemplo de prueba
Para un viaje Económico de 8,5 km y 22 minutos, sin propina:
- Tarifa redondeada: 19.200 COP.
- Comisión del 20 %: 3.840 COP.
- Ganancia neta: 15.360 COP.

Este ejemplo sirve como referencia de prueba, no como tarifa comercial real.

### Criterios de aceptación
- [ ] Se muestra el desglose completo.
- [ ] Los datos proceden del viaje persistido.
- [ ] Volver al inicio no crea otro viaje.
- [ ] El viaje aparece una sola vez en el historial existente.

---

## 8. Detalle de viaje

**Archivo sugerido:** `src/screens/trips/TripDetailScreen.jsx`

Implementar esta pantalla solo si el historial actual no permite abrir un viaje individual con todos sus datos.

### Información
- Fecha y hora.
- Origen y destino.
- Ruta en mapa, si hay coordenadas.
- Distancia y duración.
- Categoría.
- Tarifa, comisión, propina y ganancia neta.
- Método y estado del pago.
- Calificación, si existe.

### Criterios de aceptación
- [ ] Recibe el identificador del viaje.
- [ ] Carga los datos persistidos desde el backend.
- [ ] Maneja viajes inexistentes y errores.
- [ ] Reutiliza el componente de desglose de tarifa.

---

## 9. Componentes reutilizables

### `TripRequestCard`
Muestra origen, destino, estimación, categoría y temporizador.

Props sugeridas: `request`, `secondsRemaining`, `onAccept`, `onReject`, `loading`, `disabled`.

### `MapBottomSheet`
Panel inferior superpuesto al mapa. Presenta el contenido contextual según el estado del conductor o del viaje.

### `AvailabilityToggle`
Control de disponibilidad. Debe admitir `value`, `disabled`, `loading` y `onChange`.

### `TripStatusBadge`
Muestra el estado actual del viaje con un estilo consistente y una etiqueta legible.

### `FareBreakdown`
Muestra tarifa, comisión, propina y ganancia neta. Solo formatea los importes; no calcula una tarifa paralela.

### `AddressSummary`
Presenta origen y destino con iconos y direcciones legibles.

### `PaymentStatus`
Representa el estado real del pago.

### `ScreenState`
Componente común para carga, error, estado vacío y reintento.

### `PrimaryActionButton`
Botón principal reutilizable con estados de carga, deshabilitado y accesibilidad.

---

## 10. Servicios y hooks necesarios

Los nombres son sugeridos. Antes de crearlos, revisar si el proyecto ya tiene servicios equivalentes.

### Servicio de viajes
Debe cubrir:
- Consultar el viaje activo.
- Aceptar y rechazar solicitudes.
- Confirmar recogida.
- Finalizar viaje.
- Consultar detalle.
- Consultar estado de pago.

Mapear las funciones a los endpoints reales del backend. No inventar rutas HTTP.

### Servicio de ubicación
Debe cubrir:
- Solicitar permisos.
- Obtener la ubicación actual.
- Iniciar seguimiento cuando el conductor esté aprobado y disponible.
- Enviar ubicación mediante el mecanismo existente.
- Detener el seguimiento y limpiar watchers.

### Servicio de tiempo real
Debe recibir solicitudes y cambios de estado. Usar la tecnología ya presente en el proyecto y limpiar listeners al cerrar sesión.

La aplicación móvil no debe conectarse directamente a MongoDB.

### Hooks opcionales
- `useDriverTrip`: gestiona el viaje activo y sus transiciones.
- `useDriverAvailability`: gestiona disponibilidad, permisos y seguimiento.

No crear estos hooks si un Context o store existente ya centraliza esa lógica.

### Utilidad monetaria
Reutilizar o crear un formateador de COP. El formateo no reemplaza los cálculos del backend.

---

## 11. Flujo de estados

Usar los valores reales definidos en el backend. El siguiente flujo es orientativo:

```text
ESPERANDO SOLICITUD
        |
        v
SOLICITUD RECIBIDA
   |           |
Aceptar      Rechazar/vencer
   |           |
   v           v
CAMINO A RECOGER  INICIO
   |
   v
PASAJERO A BORDO
   |
   v
VIAJE EN CURSO
   |
   v
VIAJE FINALIZADO
   |
   v
COBRO PENDIENTE
   |
   v
PAGO CONFIRMADO / EFECTIVO RECIBIDO
   |
   v
RESUMEN DEL VIAJE
```

El backend es la fuente de verdad. No cambiar los estados o enums sin revisar el contrato actual. Al abrir la app, consultar si hay un viaje activo y reanudarlo.

---

## 12. Navegación propuesta

```text
Autenticación existente
├── Registro existente
└── Inicio de sesión existente
    └── Aplicación del conductor
        ├── Inicio operativo
        ├── Flujo del viaje
        │   ├── Solicitud entrante
        │   ├── Camino a recoger
        │   ├── Viaje en curso
        │   ├── Cobro
        │   └── Resumen
        └── Menú existente
            ├── Perfil/Configuración
            ├── Historial
            │   └── Detalle de viaje (si falta)
            └── Ganancias
```

Al iniciar sesión, consultar primero si existe un viaje activo. No enviar siempre al inicio operativo sin comprobar el estado.

---

## 13. Estructura de archivos sugerida

Adaptar a la estructura real del repositorio. Usar `.js/.jsx` o `.ts/.tsx` según el lenguaje actual.

```text
src/
├── screens/
│   ├── driver/
│   │   └── DriverHomeScreen.jsx
│   └── trips/
│       ├── TripRequestScreen.jsx
│       ├── PickupNavigationScreen.jsx
│       ├── ActiveTripScreen.jsx
│       ├── TripPaymentScreen.jsx
│       ├── TripSummaryScreen.jsx
│       └── TripDetailScreen.jsx
├── components/
│   ├── trips/
│   │   ├── TripRequestCard.jsx
│   │   ├── MapBottomSheet.jsx
│   │   ├── TripStatusBadge.jsx
│   │   ├── FareBreakdown.jsx
│   │   ├── AddressSummary.jsx
│   │   └── PaymentStatus.jsx
│   ├── driver/
│   │   └── AvailabilityToggle.jsx
│   └── common/
│       ├── ScreenState.jsx
│       └── PrimaryActionButton.jsx
├── services/
│   ├── trips.service.js
│   ├── location.service.js
│   └── tripRealtime.service.js
├── hooks/
│   ├── useDriverTrip.js
│   └── useDriverAvailability.js
└── utils/
    └── currency.js
```

No mover archivos existentes solo para hacerlos coincidir con esta estructura.

---

## 14. Verificación del backend

Antes de conectar las pantallas, identificar las rutas reales para:
- Consultar perfil y aprobación.
- Cambiar disponibilidad.
- Recibir solicitudes.
- Aceptar/rechazar solicitudes.
- Confirmar recogida e inicio.
- Finalizar viaje.
- Obtener tarifa definitiva y desglose.
- Crear checkout y consultar pago.
- Recuperar viaje activo y consultar detalle.

Si falta una ruta, registrarla como tarea backend. No simular éxito desde el frontend.

---

## 15. Pruebas de aceptación

### Disponibilidad
- [ ] Conductor pendiente no puede activarse.
- [ ] Conductor aprobado puede activar y desactivar disponibilidad.
- [ ] El permiso denegado muestra una explicación.
- [ ] Desactivar detiene el seguimiento.

### Solicitudes
- [ ] Se muestran datos correctos.
- [ ] El temporizador es de 15 segundos.
- [ ] Aceptar navega solo después de confirmación.
- [ ] Rechazar o vencer devuelve al inicio.
- [ ] Doble toque no duplica acciones.

### Viajes
- [ ] La ruta inicial apunta al origen.
- [ ] La recogida persiste en backend.
- [ ] La ruta cambia al destino.
- [ ] El cierre se ejecuta una sola vez.
- [ ] Se recupera el viaje activo al reiniciar la app.

### Cobros
- [ ] El checkout de prueba no se marca pagado antes de la confirmación del backend.
- [ ] El efectivo requiere confirmación explícita.
- [ ] Se muestra tarifa, comisión, propina y ganancia neta.
- [ ] El viaje aparece una sola vez en el historial existente.

### Calidad
- [ ] Cada pantalla maneja carga, error y reintento.
- [ ] No quedan temporizadores, watchers ni listeners activos al salir.
- [ ] No hay secretos en el bundle móvil ni en los logs.
- [ ] Se prueba en teléfono pequeño y tableta.
- [ ] Se mantiene la bitácora `docs/AI_LOG.md` si forma parte de los entregables del proyecto.

---

## 16. Orden recomendado de desarrollo

1. Revisar navegación y contrato real del backend.
2. Implementar inicio operativo y disponibilidad.
3. Conectar solicitudes y temporizador.
4. Implementar navegación a recogida.
5. Implementar viaje en curso y cierre.
6. Implementar cobro de prueba/efectivo.
7. Implementar resumen y conectarlo con el historial existente.
8. Añadir detalle solo si no existe.
9. Probar recuperación del viaje, errores y limpieza de listeners.

## Criterio final de terminado

Un conductor aprobado puede ponerse disponible, recibir y responder una solicitud, llegar al origen, confirmar la recogida, navegar al destino, finalizar el viaje, registrar un pago de prueba o efectivo, ver el resumen y encontrar el viaje en el historial existente. Todos los estados deben persistir y sincronizarse con el backend.
