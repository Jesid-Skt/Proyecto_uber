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

## Inicio rápido para probar la app

Abre dos terminales desde la raíz del proyecto. En la primera, inicia la API:

```powershell
cd .\backend
npm run dev
```

En la segunda, inicia Expo en la red local:

```powershell
cd .\frontend
npm run start -- --lan
```

Escanea el QR con el teléfono conectado a la misma Wi-Fi y abre la app en Expo Go o en el development build de UberClone. `frontend/.env` debe apuntar a la IP LAN del computador en `EXPO_PUBLIC_API_URL` (no uses `localhost` en un teléfono físico). Al abrir Inicio, la app solicita permiso de ubicación y centra el mapa en la ubicación real del dispositivo; si todavía no está disponible, centra inicialmente la vista en Medellín. Comparte ubicación con el backend únicamente cuando el conductor esté conectado. Expo Go sirve para probar la interfaz y la ubicación en primer plano; las notificaciones FCM y el seguimiento en segundo plano requieren un build nativo de desarrollo.

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

   - `GOOGLE_MAPS_SERVER_API_KEY`: clave restringida a Directions API y Distance Matrix API. Solo se usa en el backend; cuando no se configura, `ORS_API_KEY` proporciona tanto las métricas de distancia y duración como la ruta para la navegación.
   - `FIREBASE_PROJECT_ID` y `GOOGLE_APPLICATION_CREDENTIALS`: proyecto y ruta local, fuera del repositorio, a las credenciales de Firebase Admin. En Azure/GCP puedes usar identidad administrada/credenciales del entorno.
   - `ORS_API_KEY`: alternativa para calcular distancia, duración y ruta de conducción si Google Maps no está configurado.
   - `MERCADO_PAGO_ACCESS_TOKEN`: token `TEST-` de la aplicación de Mercado Pago.
   - `MERCADO_PAGO_WEBHOOK_SECRET`: clave secreta configurada para firmar los webhooks.
   - `BACKEND_PUBLIC_URL`: URL HTTPS pública del backend para que Mercado Pago pueda enviar webhooks. En desarrollo usa un túnel HTTPS; `localhost` no es accesible desde Mercado Pago.

   El backend valida que el token, el secreto de webhook y la URL pública estén configurados juntos, y acepta únicamente tokens con prefijo `TEST-` o `APP_USR-`. Usa siempre credenciales `TEST-` para las pruebas de este proyecto; `APP_USR-` corresponde a credenciales de producción. En producción también exige Google Maps y Firebase. No copies credenciales a `.env.example`, al frontend ni a Git.

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
- `PATCH /api/drivers/me/trips/:tripId/cancel`: cancela un viaje aceptado o en camino antes de iniciarlo; rechaza la cancelación si ya comenzó, tiene un pago aprobado o un checkout activo.
- `PATCH /api/drivers/me/trips/:tripId/cash-payment`: confirma explícitamente efectivo recibido solo en viajes marcados para pago en efectivo.
- `POST /api/drivers/me/trips/:tripId/checkout`: crea o devuelve el checkout de Mercado Pago para el viaje finalizado.
- `GET /api/drivers/me/trips/active`: recupera un viaje aceptado o en curso al restaurar la sesión.
- `POST /api/drivers/me/trips/:tripId/payment/sync`: consulta Mercado Pago por `external_reference`, verifica estado, monto y COP, y sincroniza el resultado. Solo el conductor dueño del viaje puede invocarlo.
- `GET /api/drivers/me/trips/history`: devuelve el historial propio ordenado del más reciente; admite `offset`, `limit` (20 por defecto, máximo 100), fechas `from`/`to` y `paymentMethod`, y responde con `hasMore` y `nextOffset`.
- `GET /api/drivers/me/trips/earnings`: agrega métricas de hoy, semana y mes (zona `America/Bogota`) y el saldo histórico del conductor, sin depender de la página cargada del historial.
- `GET /api/drivers/me/trips/:tripId`: consulta el detalle de un viaje propio.
- `GET /api/drivers/me/documents/:documentId`: descarga una imagen solo si el documento pertenece al conductor autenticado.
- `PUT /api/drivers/me/documents/:kind`: sustituye una imagen propia (`profile`, `vehicle`, `license`, `soat`, `revision`).

- `POST /api/trip-requests/:tripId/checkout`: crea o devuelve el enlace de Checkout Pro para un viaje en Mercado Pago después de que el conductor lo acepte. Requiere la clave privada de publicación y devuelve `checkoutUrl`; solo lo debe consumir un servidor de la experiencia del pasajero.
- `GET /api/trip-requests/:tripId/payment`: consulta el estado de pago desde ese servidor, también con la clave privada.
- `POST /api/payments/mercadopago/webhook`: recibe notificaciones, valida la firma y confirma el estado consultando el pago directamente a Mercado Pago.
- `POST /api/drivers/me/trips/:tripId/route`: devuelve una ruta de Google Directions (OpenRouteService opcional); admite `pickup`, `destination` y `history`.

El cuerpo de `POST /api/trip-requests` contiene `driverId`, `origin` y `destination` (cada punto con `lat`, `lng` y `address`), `category` (`economy`, `xl` o `premium`) y `paymentMethod` (`cash` o `mercadopago`). No acepta distancia, duración ni tarifa enviados por el cliente: Google Distance Matrix calcula las métricas cuando está configurado; de lo contrario, OpenRouteService las obtiene con una ruta de conducción si `ORS_API_KEY` está disponible. La función compartida `shared/pricing.ts` determina tarifa, comisión y ganancia neta. El cálculo se repite al aceptar el viaje. Si ambos proveedores faltan, la API responde `503` sin inventar distancia ni tarifa.

Para viajes con Mercado Pago, el conductor abre el checkout desde la pantalla de cobro. El webhook firmado confirma los pagos automáticamente; si la notificación no llega, **Consultar estado del pago** invoca el endpoint autenticado de sincronización, que consulta Mercado Pago y valida el pago antes de actualizar la base de datos. Regresar del checkout no confirma el pago. Stripe no está integrado; Mercado Pago y efectivo son los medios implementados.

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
3. Configura `GOOGLE_MAPS_API_KEY` con una clave restringida por aplicación para los SDK nativos de Maps. Sin esta clave, Android no puede mostrar correctamente las teselas del mapa.
4. Para FCM, descarga `google-services.json` y `GoogleService-Info.plist` de tu proyecto Firebase y colócalos en `frontend/`. También puedes indicar sus rutas relativas en `GOOGLE_SERVICES_JSON` y `GOOGLE_SERVICES_PLIST`. Estos archivos locales se excluyen de Git.
5. En Android 13 o posterior, acepta el permiso de notificaciones que solicita la app. Si fue denegado anteriormente, habilítalo en Ajustes del dispositivo y vuelve a abrir UberClone. Después de cambiar permisos nativos en `app.json`, sincroniza y recompila el cliente con `npx expo prebuild --platform android` y `npx expo run:android`.
6. Asegúrate de que el firewall permite conexiones al puerto 4000 desde el dispositivo.
7. Para compartir la ubicación mientras la app está minimizada, acepta el permiso de ubicación en segundo plano. En iOS selecciona **Siempre** (o cambia el permiso en Ajustes > UberClone > Ubicación); en Android permite la ubicación en segundo plano y mantén activa la notificación de servicio que muestra el sistema. El seguimiento solo funciona mientras el conductor aprobado está disponible. Hay que instalar un build nativo nuevo para que los permisos y modos de fondo configurados en `app.json` surtan efecto; compila iOS en macOS o con EAS. Para generar un build de desarrollo iOS desde Windows, inicia sesión en EAS con `npx eas-cli login` y ejecuta `npx eas-cli build --profile development --platform ios`. EAS solicitará vincular el proyecto y las credenciales de Apple necesarias para instalar el build en un iPhone. iOS puede suspender el seguimiento si el usuario fuerza el cierre de la app desde el selector.

En desarrollo, la API acepta orígenes Expo Go (`exp://`) y web (`http://`) desde direcciones IP privadas en los puertos `8081` y `19006`. En producción, configura los orígenes exactos en `FRONTEND_ORIGINS`.

```powershell
cd .\frontend
npm install
npx expo install expo-dev-client
npx expo prebuild --platform android
npx expo run:android
```

React Native Firebase no funciona en Expo Go. Instala y ejecuta la app con el cliente nativo de desarrollo (`npx expo run:android`); después inicia Metro con `npx expo start` y abre el cliente UberClone, no Expo Go. En Android 13+ permite las notificaciones del sistema; en iOS acepta los permisos de notificaciones y ubicación **Siempre**, y configura una clave APNs en Firebase. Vuelve a compilar el cliente si cambian las dependencias nativas o la configuración. Para iOS, compila en macOS o con Expo Build/EAS. El registro del conductor organiza datos personales, vehículo y documentos/pagos en tres pestañas; valida los campos en línea y solo permite enviar el formulario completo. Acepta fotos JPEG/PNG/WebP (máximo 5 MB por imagen) desde cámara o galería. Las cuentas nuevas quedan `pending`. Solo se guarda el correo de Mercado Pago para pagos; no se solicitan ni guardan números de tarjetas o cuentas bancarias en AsyncStorage. El conductor también puede iniciar/cerrar sesión, editar perfil, vehículo y documentos, cambiar idioma, seguir viajes, pagar y consultar ganancias e historial.

El Drawer contiene Inicio, Historial, Ganancias, Viaje activo, Perfil y Configuración. El registro conserva tres pestañas accesibles dentro del formulario (sin un navigator Expo Router Tabs separado) y el flujo de viaje usa Stack.

Para probar la interfaz en un iPhone sin compilar un cliente nativo, instala Expo Go y ejecuta `npm run start:go -- --lan` dentro de `frontend`; conecta el iPhone a la misma red Wi-Fi, escanea el QR con la cámara y abre el enlace en Expo Go. En Expo Go se omite la inicialización de Firebase Messaging para evitar cargar un módulo nativo que ese cliente no incluye. Los viajes siguen usando Socket.IO y consulta periódica mientras la aplicación está abierta, pero las notificaciones FCM y el seguimiento GPS en segundo plano requieren un development build nativo. Si la red local impide conectarse, ejecuta `npm run start:go -- --tunnel`.

## Persistencia y límites de esta fase

- Los perfiles, documentos, disponibilidad, última ubicación, tokens FCM, solicitudes, transiciones y estados de pago se persisten en MongoDB. La sincronización Socket.IO usa Change Streams; configura un replica set.
- La app usa Distance Matrix al publicar y aceptar cada solicitud, y Directions al comenzar cada etapa; no consulta estas APIs con cada movimiento del GPS. La tarifa y la comisión provienen de `shared/pricing.ts`.
- El cliente actual es la versión del conductor. La experiencia del pasajero que publica solicitudes todavía se debe integrar con el endpoint protegido de publicación; por eso el modelo actual de `trips` no almacena `passengerId`.
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

La bitácora está en [docs/AI_LOG.md](./docs/AI_LOG.md), con exportación a PDF en [docs/AI_LOG.pdf](./docs/AI_LOG.pdf). Completa el nombre del integrante y el hash final del commit.
