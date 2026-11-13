# UberClone Conductor

Proyecto dividido en dos aplicaciones:

- `frontend/`: cliente móvil React Native y Expo.
- `backend/`: API REST Node.js/Express y MongoDB Atlas.

Los perfiles de conductor, los datos de vehículo y la metadata de documentos se guardan en MongoDB. Las imágenes se guardan en GridFS dentro del mismo clúster y sus referencias quedan en el perfil. Las imágenes se sirven solo con un token válido del propietario. Las contraseñas se guardan con hash bcrypt; el token de sesión móvil usa SecureStore.

## Requisitos

- Node.js 22.14 o superior y npm.
- Un clúster MongoDB Atlas de tipo replica set, usuario de base de datos y la dirección IP del desarrollador permitida en **Network Access**. MongoDB Change Streams requiere replica set.
- MapLibre React Native v11 para el mapa móvil, con estilo OpenFreeMap predeterminado; no requiere una clave Google Maps móvil.
- Para rutas y métricas del backend: `ORS_API_KEY` de OpenRouteService o `GOOGLE_MAPS_SERVER_API_KEY` restringida a Directions API y Distance Matrix API. En producción se debe configurar al menos uno; ORS se usa cuando Google no está configurado, no como reintento automático ante fallos de Google.
- Proyecto Firebase con Cloud Messaging (FCM) y credenciales de servidor configuradas mediante Application Default Credentials.
- Un build de desarrollo nativo recompilado para MapLibre y FCM; Expo Go no incluye estos módulos nativos.

## Inicio rápido para probar la app

Abre dos terminales desde la raíz del proyecto. En la primera, inicia la API:

```powershell
cd .\backend
npm run dev
```

En la segunda, inicia Expo en la red local:

```powershell
cd .\frontend
npm run start -- --dev-client --lan
```

Instala primero un development build de UberClone que incluya MapLibre v11 (sección 3). Conecta el teléfono a la misma Wi-Fi y abre el QR en ese cliente. `frontend/.env` debe apuntar a la IP LAN del computador en `EXPO_PUBLIC_API_URL` (no uses `localhost` en un teléfono físico). Al abrir Inicio, la app solicita permiso de ubicación y centra el mapa en la ubicación real del dispositivo; si todavía no está disponible, centra inicialmente la vista en Medellín. Mientras Inicio está visible, solo un conductor aprobado y disponible comparte ubicación con el backend. Al salir de Inicio o desconectarse, el seguimiento se detiene según la especificación. Expo Go no permite validar MapLibre ni FCM.

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
   - `ORS_API_KEY`: alternativa para calcular distancia, duración y ruta de conducción si Google Maps no está configurado. Esta selección depende de la configuración: no es un reintento automático con ORS cuando una petición a Google falla. Ambas claves permanecen exclusivamente en el backend.
   - `MERCADO_PAGO_ACCESS_TOKEN`: token `TEST-` de la aplicación de Mercado Pago.
   - `MERCADO_PAGO_WEBHOOK_SECRET`: clave secreta configurada para firmar los webhooks.
   - `BACKEND_PUBLIC_URL`: URL HTTPS pública del backend para que Mercado Pago pueda enviar webhooks. En desarrollo usa un túnel HTTPS; `localhost` no es accesible desde Mercado Pago.

   El backend valida que el token, el secreto de webhook y la URL pública estén configurados juntos, y acepta únicamente tokens con prefijo `TEST-` o `APP_USR-`. Usa siempre credenciales `TEST-` para las pruebas de este proyecto; `APP_USR-` corresponde a credenciales de producción. En producción exige al menos un proveedor de rutas (Google Maps u ORS) y Firebase. No copies credenciales a `.env.example`, al frontend ni a Git.

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
- `POST /api/drivers/me/trips/:tripId/route`: devuelve una ruta de Google Directions si hay clave del servidor; en su ausencia usa OpenRouteService. Admite `pickup`, `destination` y `history`. MapLibre dibuja la geometría recibida; no calcula las rutas ni las tarifas.

El cuerpo de `POST /api/trip-requests` contiene `driverId`, `origin` y `destination` (cada punto con `lat`, `lng` y `address`), `category` (`economy`, `xl` o `premium`) y `paymentMethod` (`cash` o `mercadopago`). No acepta distancia, duración ni tarifa enviados por el cliente: Google Distance Matrix calcula las métricas cuando está configurado; de lo contrario, OpenRouteService las obtiene con una ruta de conducción si `ORS_API_KEY` está disponible. La función compartida `shared/pricing.ts` determina tarifa, comisión y ganancia neta. El cálculo se repite al aceptar el viaje. Si ambos proveedores faltan, la API responde `503` sin inventar distancia ni tarifa.

Para viajes con Mercado Pago, el conductor abre el checkout desde la pantalla de cobro. El webhook firmado confirma los pagos automáticamente; si la notificación no llega, **Consultar estado del pago** invoca el endpoint autenticado de sincronización, que consulta Mercado Pago y valida el pago antes de actualizar la base de datos. Regresar del checkout no confirma el pago. Stripe no está integrado; Mercado Pago y efectivo son los medios implementados.

Cuando el conductor aprobado está disponible, el cliente comparte su ubicación con el backend únicamente mientras Inicio está visible; al salir de Inicio o desconectarse, detiene el seguimiento. MongoDB Change Streams propaga ubicación y transiciones por Socket.IO; FCM avisa nuevas solicitudes cuando la app está en segundo plano, independientemente del GPS. La app también conserva consulta periódica como respaldo. El proveedor del backend (Google Directions u OpenRouteService) calcula la ruta al iniciar cada etapa del viaje, no en cada actualización GPS. Abrir Google Maps para navegación externa es independiente del mapa MapLibre integrado y no requiere una clave Google móvil en esta app.

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
3. Configura opcionalmente `EXPO_PUBLIC_MAP_STYLE_URL`. Si está ausente o vacío, el mapa usa `https://tiles.openfreemap.org/styles/liberty` (OpenFreeMap). Debe ser una URL de estilo compatible con MapLibre; es pública en el bundle, no un lugar para secretos. No configures `GOOGLE_MAPS_API_KEY`: el mapa móvil ya no usa el SDK Google Maps. Los archivos Firebase del siguiente paso sí siguen siendo necesarios para FCM.
4. Para FCM, descarga `google-services.json` y `GoogleService-Info.plist` de tu proyecto Firebase y colócalos en `frontend/`. También puedes indicar sus rutas relativas en `GOOGLE_SERVICES_JSON` y `GOOGLE_SERVICES_PLIST`. Estos archivos locales se excluyen de Git.
5. En Android 13 o posterior, acepta el permiso de notificaciones que solicita la app. Si fue denegado anteriormente, habilítalo en Ajustes del dispositivo y vuelve a abrir UberClone. Después de cambiar permisos nativos en `app.json`, sincroniza y recompila el cliente con `npx expo prebuild --platform android` y `npx expo run:android`.
6. Asegúrate de que el firewall permite conexiones al puerto 4000 desde el dispositivo.
7. El seguimiento GPS usa únicamente el permiso de ubicación **mientras se usa la app** y se mantiene activo solo en Inicio mientras el conductor está disponible. No se solicita ubicación **Siempre** ni se comparte GPS en segundo plano: la especificación exige detener el seguimiento al salir de Inicio. FCM en segundo plano es independiente y requiere su propia configuración nativa. Para generar un build de desarrollo iOS desde Windows, inicia sesión en EAS con `npx eas-cli login` y ejecuta `npx eas-cli build --profile development --platform ios`. EAS solicitará vincular el proyecto y las credenciales de Apple necesarias para instalar el build en un iPhone.

En desarrollo, la API acepta orígenes Expo Go (`exp://`) y web (`http://`) desde direcciones IP privadas en los puertos `8081` y `19006`. En producción, configura los orígenes exactos en `FRONTEND_ORIGINS`.

```powershell
cd .\frontend
npm install
npx expo install expo-dev-client
npx expo prebuild --platform android
npx expo run:android
```

MapLibre y React Native Firebase requieren el cliente nativo de desarrollo. La migración a MapLibre v11 exige recompilar e instalar ese cliente: reiniciar Metro o actualizar solo JavaScript no agrega el módulo nativo. Instala y ejecuta la app con `npx expo run:android`; después inicia Metro con `npx expo start --dev-client` y abre UberClone. En Android 13+ permite las notificaciones del sistema; en iOS acepta los permisos de notificaciones y configura una clave APNs en Firebase. La ubicación solo necesita permiso mientras se usa la app. Vuelve a compilar el cliente si cambian las dependencias nativas o la configuración. Para iOS, compila en macOS o con Expo Build/EAS. Consulta la [guía oficial de MapLibre](https://maplibre.org/maplibre-react-native/docs/setup/getting-started/) y la [referencia Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/).

El registro del conductor organiza datos personales, vehículo y documentos/pagos en tres pestañas; valida los campos en línea y solo permite enviar el formulario completo. Acepta fotos JPEG/PNG/WebP (máximo 5 MB por imagen) desde cámara o galería. Las cuentas nuevas quedan `pending`. Solo se guarda el correo de Mercado Pago para pagos; no se solicitan ni guardan números de tarjetas o cuentas bancarias en AsyncStorage. El conductor también puede iniciar/cerrar sesión, editar perfil, vehículo y documentos, cambiar idioma, seguir viajes, pagar y consultar ganancias e historial.

El Drawer contiene Inicio, Historial, Ganancias, Viaje activo, Perfil y Configuración. El registro usa un navigator real `Tabs` de `expo-router/ui`: `/register` (datos personales), `/register/vehicle` y `/register/documents`. Un contexto sobre las pestañas conserva campos, fotos, términos, errores y estado de envío al cambiar de ruta; el borrador no se persiste al salir del registro. El flujo de viaje usa Stack.

Para probar en iPhone desde Windows, genera e instala el development build iOS con Expo Build/EAS y ejecuta `npm run start -- --dev-client --lan`. Si la red local impide conectarse, usa `npm run start -- --dev-client --tunnel`. El script legado `start:go` no sustituye este build para la aplicación migrada.

## Persistencia y límites de esta fase

- Los perfiles, documentos, disponibilidad, última ubicación, tokens FCM, solicitudes, transiciones y estados de pago se persisten en MongoDB. La sincronización Socket.IO usa Change Streams; configura un replica set. El GPS se consulta y comparte solo desde Inicio mientras está visible y el conductor disponible; al salir de la pantalla o desconectarse, se limpian las suscripciones.
- El backend usa Distance Matrix/Directions o el fallback por configuración de OpenRouteService al publicar y aceptar solicitudes y comenzar etapas; no consulta estas APIs con cada movimiento del GPS. La tarifa y la comisión provienen de `shared/pricing.ts`. OpenFreeMap suministra el estilo y las teselas, no las métricas de cobro.
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

La bitácora está en [docs/AI_LOG.md](./docs/AI_LOG.md). El [checklist de entrega](./docs/DELIVERY_CHECKLIST.md) separa verificaciones automáticas de evidencias manuales pendientes. La actualización y revisión de los PDF corresponde a la integración final; un PDF anterior no acredita estos cambios. El video lo grabará el usuario después de terminar la migración y las correcciones. Completa autoría y hash únicamente con datos reales al integrar; no hay una revisión de PR acreditada en esta actualización.
