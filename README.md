# UberClone Conductor

Proyecto dividido en dos aplicaciones:

- `frontend/`: cliente móvil React Native y Expo.
- `backend/`: API REST Node.js/Express y MongoDB Atlas.

Los perfiles de conductor, los datos de vehículo y la metadata de documentos se guardan en MongoDB. Las imágenes se guardan en GridFS dentro del mismo clúster y sus referencias quedan en el perfil. Las imágenes se sirven solo con un token válido del propietario. Las contraseñas se guardan con hash bcrypt; el token de sesión móvil usa SecureStore.

## Requisitos

- Node.js 22.14 o superior y npm.
- Un clúster MongoDB Atlas de tipo replica set, usuario de base de datos y la dirección IP del desarrollador permitida en **Network Access**. MongoDB Change Streams requiere replica set.
- Proyecto Google Cloud con Maps SDK, Directions API y Distance Matrix API habilitadas; usa claves separadas y restringidas para móvil y servidor.
- Proyecto Firebase con Cloud Messaging (FCM) y credenciales de servidor configuradas mediante Application Default Credentials.
- Un build de desarrollo nativo de Expo para FCM; Expo Go no incluye React Native Firebase.

## 1. Configurar MongoDB Atlas

1. Crea un usuario de base de datos de mínimo privilegio y habilita la IP que ejecutará el backend en Atlas.
2. No uses la cadena de ejemplo como credencial real ni pegues la contraseña en el código. Copia en `backend/.env` la URI que entrega Atlas y reemplaza los marcadores por el usuario, contraseña codificada para URL y host del clúster:

   ```text
   mongodb+srv://<db_user>:<url_encoded_password>@<cluster-host>/uber_clone?retryWrites=true&w=majority
   ```

   Si la contraseña contiene `@`, `:`, `/`, `#`, `%` u otros caracteres reservados, codifícala para URL. No compartas la URI. `.env` está ignorado por Git.

3. Genera un secreto JWT local de al menos 32 caracteres:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
   ```

4. Copia `backend/.env.example` a `backend/.env`, configura `MONGODB_URI` y `JWT_SECRET`, genera una clave privada de al menos 32 caracteres para `TRIP_REQUEST_API_KEY`, y deja `NODE_ENV=development`:

   ```powershell
   Copy-Item backend\.env.example backend\.env
   node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
   notepad backend\.env
   ```

   Guarda la clave generada solo en `backend/.env`; no la incluyas en la app móvil ni la compartas.

5. Configura los servicios del servidor en `backend/.env`:

   - `GOOGLE_MAPS_SERVER_API_KEY`: clave restringida a Directions API y Distance Matrix API. Solo se usa en el backend.
   - `FIREBASE_PROJECT_ID` y `GOOGLE_APPLICATION_CREDENTIALS`: proyecto y ruta local, fuera del repositorio, a las credenciales de Firebase Admin. En Azure/GCP puedes usar identidad administrada/credenciales del entorno.
   - `ORS_API_KEY`: opcional; se usa como alternativa para rutas si no está configurado Google Directions.
   - `MERCADO_PAGO_ACCESS_TOKEN`: token `TEST-` de la aplicación de Mercado Pago.
   - `MERCADO_PAGO_WEBHOOK_SECRET`: clave secreta configurada para firmar los webhooks.
   - `BACKEND_PUBLIC_URL`: URL HTTPS pública del backend para que Mercado Pago pueda enviar webhooks. En desarrollo usa un túnel HTTPS; `localhost` no es accesible desde Mercado Pago.

   El backend valida que el token, el secreto de webhook y la URL pública estén configurados juntos. En producción también exige Google Maps y Firebase. No copies credenciales a `.env.example`, al frontend ni a Git.

   En el panel de Mercado Pago, registra `https://<dominio-publico>/api/payments/mercadopago/webhook` como URL de notificaciones y habilita eventos de pagos.

## 2. Ejecutar backend

```powershell
cd .\backend
npm install
npm run dev
```

La API escucha en el puerto `4000`. `GET http://localhost:4000/api/health` responde `ok` solo cuando MongoDB conecta. Si Atlas rechaza la conexión, revisa la IP permitida, el usuario y la URI; el servidor no imprime secretos.

La app crea el índice único de correo, documento y placa al iniciar el backend. Si ya hay registros duplicados en la base, resuélvelos antes de iniciar el servicio.

### Endpoints principales

- `POST /api/auth/register`: valida el registro, recibe las fotos con `multipart/form-data`, las guarda en GridFS, crea el perfil con estado `pending` y devuelve un token de sesión.
- `POST /api/auth/login`: inicia sesión con correo y contraseña.
- `GET /api/drivers/me`: obtiene el perfil de la sesión.
- `PATCH /api/drivers/me`: actualiza nombre, celular, idioma, vehículo y metadata de documentos validada.
- `PATCH /api/drivers/me/availability`: actualiza la disponibilidad; solo permite conectarse a conductores aprobados.
- `PATCH /api/drivers/me/location`: guarda coordenadas recientes solo para conductores aprobados y disponibles.
- `PUT/DELETE /api/drivers/me/push-token`: registra o retira el token FCM de la sesión autenticada.
- `POST /api/trip-requests`: publica una solicitud dirigida a un conductor disponible. Requiere `Authorization: Bearer <TRIP_REQUEST_API_KEY>` y crea una solicitud con vencimiento de 15 segundos.
- `GET /api/drivers/me/trips/next-request`: consulta la solicitud entrante del conductor autenticado.
- `PATCH /api/drivers/me/trips/:tripId/accept` y `/reject`: acepta o rechaza la solicitud; al vencer los 15 segundos, se marca automáticamente como `rejected`.
- `PATCH /api/drivers/me/trips/:tripId/arriving`, `/start` y `/complete`: registra el camino a recogida, el inicio y la finalización del viaje, validando cada transición en el backend.
- `PATCH /api/drivers/me/trips/:tripId/cash-payment`: confirma explícitamente efectivo recibido solo en viajes marcados para pago en efectivo.
- `POST /api/drivers/me/trips/:tripId/checkout`: crea o devuelve el checkout de Mercado Pago para el viaje finalizado.
- `GET /api/drivers/me/trips/active`: recupera un viaje aceptado o en curso al restaurar la sesión.
- `GET /api/drivers/me/trips/history` y `GET /api/drivers/me/trips/:tripId`: consultan hasta 100 viajes propios con filtros por fecha y medio de pago.
- `GET /api/drivers/me/documents/:documentId`: descarga una imagen solo si el documento pertenece al conductor autenticado.
- `PUT /api/drivers/me/documents/:kind`: sustituye una imagen propia (`profile`, `vehicle`, `license`, `soat`, `revision`).

- `POST /api/trip-requests/:tripId/checkout`: crea o devuelve el enlace de Checkout Pro para un viaje en Mercado Pago después de que el conductor lo acepte. Requiere la clave privada de publicación y devuelve `checkoutUrl`; solo lo debe consumir un servidor de la experiencia del pasajero.
- `GET /api/trip-requests/:tripId/payment`: consulta el estado de pago desde ese servidor, también con la clave privada.
- `POST /api/payments/mercadopago/webhook`: recibe notificaciones, valida la firma y confirma el estado consultando el pago directamente a Mercado Pago.
- `POST /api/drivers/me/trips/:tripId/route`: devuelve una ruta de Google Directions (OpenRouteService opcional); admite `pickup`, `destination` y `history`.

El cuerpo de `POST /api/trip-requests` contiene `driverId`, `origin` y `destination` (cada punto con `lat`, `lng` y `address`), `category` (`economy`, `xl` o `premium`) y `paymentMethod` (`cash` o `mercadopago`). No acepta distancia, duración ni tarifa enviados por el cliente: Google Distance Matrix calcula los primeros y la función compartida `shared/pricing.ts` determina tarifa, comisión y ganancia neta. El cálculo se repite al aceptar el viaje.

Para viajes con Mercado Pago, el conductor abre el checkout de prueba desde la pantalla de cobro. El estado no se marca como pagado por regresar del checkout: solo un webhook con firma válida y un pago verificado por el backend lo confirma. Stripe no está integrado; Mercado Pago y efectivo son los medios implementados.

Mientras está disponible, el cliente envía la ubicación cada pocos segundos al backend. MongoDB Change Streams propaga ubicación y transiciones por Socket.IO; FCM avisa nuevas solicitudes cuando la app está en segundo plano. La app también conserva consulta periódica como respaldo. Google Directions calcula la ruta al iniciar cada etapa del viaje, no en cada actualización GPS; Google Maps puede abrirse para navegación externa en vivo.

La aplicación de pasajero no está incluida. La ruta protegida `POST /api/trip-requests` es el punto de integración para publicar solicitudes desde ese cliente.

La aprobación no se puede cambiar desde la app del conductor. Para la demo académica se permite aprobar manualmente desde Atlas:

```javascript
db.drivers.updateOne(
  { email: "correo-del-conductor" },
  { $set: { approvalStatus: "approved" } }
)
```

Después de cambiar el estado, pulsa **Actualizar estado** en Inicio. Mientras la cuenta siga en `pending` o `rejected`, el control de disponibilidad permanecerá bloqueado; al pasarla a `approved`, el conductor podrá conectarse.

## 3. Ejecutar frontend

1. Copia `frontend/.env.example` a `frontend/.env`:

   ```powershell
   Copy-Item frontend\.env.example frontend\.env
   notepad frontend\.env
   ```
2. Configura `EXPO_PUBLIC_API_URL`. En un teléfono físico usa la IP LAN del computador que ejecuta el backend, no `localhost`, por ejemplo `http://192.168.1.10:4000`. El emulador puede requerir una URL diferente.
3. Configura `GOOGLE_MAPS_API_KEY` con una clave restringida por aplicación para los SDK nativos de Maps.
4. Para FCM, descarga `google-services.json` y `GoogleService-Info.plist` de tu proyecto Firebase y colócalos en `frontend/`. También puedes indicar sus rutas relativas en `GOOGLE_SERVICES_JSON` y `GOOGLE_SERVICES_PLIST`. Estos archivos locales se excluyen de Git.
5. Asegúrate de que el firewall permite conexiones al puerto 4000 desde el dispositivo.

En desarrollo, la API acepta orígenes Expo Go (`exp://`) y web (`http://`) desde direcciones IP privadas en los puertos `8081` y `19006`. En producción, configura los orígenes exactos en `FRONTEND_ORIGINS`.

```powershell
cd .\frontend
npm install
npx expo install expo-dev-client
npx expo prebuild --platform android
npx expo run:android
```

React Native Firebase no funciona en Expo Go. Instala y ejecuta la app con el cliente nativo de desarrollo (`npx expo run:android`); después inicia Metro con `npx expo start` y abre el cliente UberClone, no Expo Go. Vuelve a compilar el cliente si cambian las dependencias nativas o la configuración. Para iOS, compila en macOS o con Expo Build. El registro del conductor organiza datos personales, vehículo y documentos/pagos en tres pestañas; valida los campos en línea y solo permite enviar el formulario completo. Acepta fotos JPEG/PNG/WebP (máximo 5 MB por imagen) desde cámara o galería. Las cuentas nuevas quedan `pending`. Solo se guarda el correo de Mercado Pago para pagos; no se solicitan ni guardan números de tarjetas o cuentas bancarias en AsyncStorage. El conductor también puede iniciar/cerrar sesión, editar perfil, vehículo y documentos, cambiar idioma, seguir viajes, pagar y consultar ganancias e historial.

El Drawer contiene Inicio, Historial, Ganancias, Viaje activo, Perfil y Configuración. El registro usa pestañas con navegación directa y el flujo de viaje usa Stack.

Para probar la aplicación en un iPhone sin compilar un cliente nativo, instala Expo Go y ejecuta `npm run start:go -- --lan` dentro de `frontend`; conecta el iPhone a la misma red Wi-Fi, escanea el QR con la cámara y abre el enlace en Expo Go. En Expo Go se omite la inicialización de Firebase Messaging para evitar cargar un módulo nativo que ese cliente no incluye. Los viajes siguen usando Socket.IO y consulta periódica mientras la aplicación está abierta, pero las notificaciones push de FCM requieren un development build nativo. Si la red local impide conectarse, ejecuta `npm run start:go -- --tunnel`.

## Persistencia y límites de esta fase

- Los perfiles, documentos, disponibilidad, última ubicación, tokens FCM, solicitudes, transiciones y estados de pago se persisten en MongoDB. La sincronización Socket.IO usa Change Streams; configura un replica set.
- La app usa Distance Matrix al publicar y aceptar cada solicitud, y Directions al comenzar cada etapa; no consulta estas APIs con cada movimiento del GPS. La tarifa y la comisión provienen de `shared/pricing.ts`.
- El cliente actual es la versión del conductor. La experiencia del pasajero que publica solicitudes todavía se debe integrar con el endpoint protegido de publicación.
- Imágenes se guardan en GridFS; las claves de MongoDB permanecen solo en `backend/.env`.
- Los datos de tarjetas o cuentas bancarias no se guardan. Mercado Pago procesa el checkout y el backend almacena solo sus identificadores y estado.
- La aprobación de conductores se realiza manualmente en MongoDB para la demo. Antes de producción añade un panel administrativo, verificación de correo, recuperación/rotación de sesión, límites de almacenamiento y pruebas de integración con un clúster de pruebas.
- No subas documentos personales reales hasta probar y revisar los controles de acceso, Atlas backups, retención y privacidad aplicables.

## Verificación

```powershell
cd .\frontend
npm test
npx tsc --noEmit
npx expo lint
npm run build
npx expo-doctor

cd ..\backend
npm test
```

Los tests del frontend cubren validación por pestaña, documentos, fechas, edad, vehículo y términos. Los tests de API cubren validaciones de edad, expiración de documentos, inspección técnico-mecánica según el año, categoría XL y bloqueo de campos protegidos. Para probar registro/login de extremo a extremo configura MongoDB de pruebas y ejecuta backend y frontend con dos terminales.

## Uso de IA

La bitácora está en [frontend/docs/AI_LOG.md](./frontend/docs/AI_LOG.md), con exportación a PDF en [frontend/docs/AI_LOG.pdf](./frontend/docs/AI_LOG.pdf). Completa el nombre del integrante y el hash final del commit.
