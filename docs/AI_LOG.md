# Bitácora de uso de inteligencia artificial

> Completa el nombre del integrante y el hash del commit cuando el equipo integre estos cambios. El repositorio conserva el commit inicial de plantilla; esta implementación todavía no está comprometida.

### Entrada #1
- Fecha: 2026-10-28
- Integrante: Pendiente de completar por el equipo
- Herramienta: Copilot SDK en VS Code
- Objetivo: Iniciar el desarrollo de la aplicación móvil para conductores a partir de la especificación funcional y técnica.
- Prompt: "sigue las intrucciones del md para el desarrollo de la aplicaion"
- Resumen de la respuesta: Se creó el cliente Expo Router con cálculo de tarifas, registro y flujo de viajes demostrativo.
- Qué se usó / modificó / descartó: Se usó el ejemplo de tarifa de 8,5 km/22 minutos. El backend de demostración inicial fue reemplazado posteriormente por la API Mongo descrita en la Entrada #2.
- Archivos y commit: `frontend/`, `backend/`, `README.md` — cambios sin commit; completar el hash al integrarlos.
- Verificación: Pruebas iniciales de tarifas, validación TypeScript, lint y compilación Android.
- Aprendizaje: Las claves secretas deben permanecer en el backend; no guardar URI de Mongo, contraseñas ni tokens dentro del bundle móvil.

### Entrada #2
- Fecha: 2026-10-28
- Integrante: Pendiente de completar por el equipo
- Herramienta: Copilot SDK en VS Code
- Objetivo: Separar frontend y backend y persistir perfiles de conductor usando MongoDB.
- Prompt: "okey para la persistencia de datos vamos a utilizar mongodb [URI omitida intencionalmente por seguridad] con la clave de conecion a cluster y necesito separar el backend del fronted en folders separados para tener mejor orden"
- Resumen de la respuesta: Se creó una API Express con MongoDB Atlas, autenticación con contraseña hasheada y token de sesión, validación de perfiles y almacenamiento privado de imágenes en GridFS. El cliente ahora registra conductores, inicia/cierra sesión y carga/edita el perfil.
- Qué se usó / modificó / descartó: Se guardan los documentos relacionados al perfil en el mismo documento MongoDB y las imágenes fuera del documento en GridFS; se exige aprobación administrativa y se evita guardar secretos en el repositorio. La URI enviada no se guardó ni se usó como credencial.
- Archivos y commit: `frontend/`, `backend/`, `README.md`, `.gitignore` — cambios sin commit; completar el hash al integrarlos.
- Verificación: Backend `npm test` (4/4) y build TypeScript; frontend `npm test` (3/3), `npx tsc --noEmit`, `npx expo lint`, `npx expo-doctor` (20/20) y bundle Android.
- Aprendizaje: La URI de Atlas debe respetar el formato `mongodb+srv://usuario:contraseña@host/base` y la contraseña debe codificarse para URL si contiene caracteres reservados. La siguiente verificación requiere conectar un clúster de pruebas sin exponer su credencial.

### Entrada #3
- Fecha: 2026-10-31
- Integrante: Pendiente de completar por el equipo
- Herramienta: Copilot SDK en VS Code
- Objetivo: Leer la especificación PDF del conductor y alinear las funcionalidades, integraciones y flujos existentes.
- Prompt: "lee todo el pdf con las especificasiones de codigo, funcionalidades, flujos y herramientas solicitadas y propuestas, y modifica lo que tenemos para que sigua lo que nos piden"
- Resumen de la respuesta: Se extrajo y leyó el PDF completo. Se implementaron ubicación persistida, Socket.IO con MongoDB Change Streams, FCM, Google Maps/Distance Matrix, precio compartido, checkout Mercado Pago, rechazo por vencimiento, filtros de historial y secciones de perfil/configuración.
- Qué se usó / modificó / descartó: Se usó MongoDB Change Streams, FCM, Google Maps y Mercado Pago de prueba como recomienda la especificación; OpenRouteService queda como alternativa opcional. Stripe y el cliente de pasajero no se añadieron porque Mercado Pago es la pasarela recomendada y el alcance del repositorio es el conductor.
- Archivos y commit: `frontend/`, `backend/`, `shared/pricing.ts`, `README.md`, `.gitignore` — cambios sin commit; completar el hash al integrarlos.
- Verificación: `backend/npm test` (22/22), `frontend/npm test` (3/3), `frontend/npx tsc --noEmit`, `frontend/npm run lint` y `frontend/npm run build` (export Android) pasan. No se conectó a MongoDB, Google Maps, Firebase ni Mercado Pago reales; el flujo nativo de FCM requiere credenciales y un build de desarrollo.
- Aprendizaje: Los tokens, claves de servidor y credenciales de Firebase deben permanecer fuera del cliente y del repositorio; FCM requiere credenciales y archivos nativos por plataforma.

### Entrada #4
- Fecha: 2026-11-11
- Integrante: Pendiente de completar por el equipo
- Herramienta: Copilot SDK en VS Code
- Objetivo: Revisar la configuración de API y cerrar el flujo del proyecto conforme a los requisitos del PDF del conductor.
- Prompt: "okey ya esta terminado la configuracion de las api keys, revisalo y terminemos de cerrar todo el flujo del proyecto que se indica en los requisitos del pdf"
- Resumen de la respuesta: Se verificaron pruebas, compilación Android, configuración local y entregables. Se comprobó que la configuración de Mercado Pago exige el prefijo reconocido por el proveedor (`TEST-` o `APP_USR-`); el proyecto debe usar `TEST-` durante las pruebas.
- Qué se usó / modificó / descartó: Se usó el token del entorno únicamente para comprobar si era de prueba, sin mostrar ni enviar secretos. Se identificaron claves de Google Maps vacías y no se realizaron llamadas a servicios externos; la verificación real queda pendiente de configurarlas localmente.
- Archivos y commit: `backend/src/config/env.ts`, `backend/src/config/env.test.ts`, `backend/src/config/test-env.ts`, `backend/package.json`, `README.md`, `docs/AI_LOG.md`, `docs/AI_LOG.pdf` — cambios sin commit; completar el hash al integrarlos.
- Verificación: Frontend: 7/7 pruebas, TypeScript, lint y export Android. Backend: compilación TypeScript y 25/25 pruebas con entorno aislado del `.env` local; no se validó una carrera end-to-end porque el backend no estaba activo y faltan las claves de Google Maps.
- Aprendizaje: Comprobar la presencia y el tipo de credenciales en los archivos locales, sin revelar sus valores, antes de dar por terminada una integración con servicios externos.

### Entrada #5
- Fecha: 2026-11-11
- Integrante: Pendiente de completar por el equipo
- Herramienta: Copilot SDK en VS Code
- Objetivo: Corregir el mapa de Inicio para que use la ubicación actual del teléfono y documentar cómo iniciar ambos servidores.
- Prompt: "con que comando arranco el proyecto y tenemos una situacion con el mapa en la pantalla de inicio no se puede activar el boton de conectarse, aparte que el mapa sale en bogota y deberia salir en medellin con la ubicacion de mi movil actual"
- Resumen de la respuesta: El mapa obtiene la ubicación del dispositivo al abrir Inicio, aunque el conductor todavía no esté disponible; solo envía coordenadas al backend cuando se conecta. Medellín queda como centro inicial mientras se obtiene la ubicación.
- Qué se usó / modificó / descartó: Se mantuvo la regla de aprobación previa para conectarse. Se actualizaron el hook de ubicación, la pantalla de Inicio y el arranque rápido del README.
- Archivos y commit: `frontend/src/hooks/useDriverLocation.ts`, `frontend/src/screens/features/HomeScreen.tsx`, `README.md`, `docs/AI_LOG.md`, `docs/AI_LOG.pdf` — cambios sin commit; completar el hash al integrarlos.
- Verificación: Frontend: 7/7 pruebas, TypeScript y lint pasan. La ubicación precisa requiere conceder permiso y probar en el teléfono; no se ha validado en un dispositivo físico en esta sesión.
- Aprendizaje: La ubicación que se muestra en el mapa no debe depender del estado de disponibilidad; el envío al servidor sí debe depender de que el conductor se haya conectado.

### Entrada #6
- Fecha: 2026-11-11
- Integrante: Pendiente de completar por el equipo
- Herramienta: Copilot SDK en VS Code
- Objetivo: Usar OpenRouteService como proveedor alternativo de distancia y duración para crear solicitudes y calcular tarifas cuando Google Maps no esté configurado.
- Prompt: "El endpoint POST /api/trip-requests devuelve 503 porque exige GOOGLE_MAPS_SERVER_API_KEY aunque ORS_API_KEY está configurado. Conecta OpenRouteService al cálculo de distancia y duración y evita exigir la clave de Google."
- Resumen de la respuesta: El backend ahora usa OpenRouteService Directions para derivar kilómetros y minutos si Google Distance Matrix no está configurado. Google se mantiene como proveedor preferido si su clave está presente.
- Qué se usó / modificó / descartó: Se reutilizó la respuesta de ruta de OpenRouteService para derivar métricas; no se agregó un fallback geodésico aproximado porque produciría distancias y tarifas distintas a una ruta real.
- Archivos y commit: `backend/src/services/google-maps.ts`, `backend/src/services/google-maps.test.ts`, `backend/src/services/openrouteservice.ts`, `backend/src/routes/trips.ts`, `backend/src/config/test-env.ts`, `README.md`, `docs/AI_LOG.md`, `docs/AI_LOG.pdf` — cambios sin commit; completar el hash al integrarlos.
- Verificación: Backend TypeScript y 26/26 pruebas. El caso ORS está cubierto con una respuesta HTTP simulada para no transmitir la API key real. La respuesta `201` aún depende de usar un conductor real aprobado y disponible en MongoDB.
- Aprendizaje: El proveedor que calcula métricas de precio y el que dibuja la ruta deben compartir el mismo proveedor alternativo; las tarifas deben derivarse de rutas reales, no de aproximaciones silenciosas.

### Entrada #7
- Fecha: 2026-11-11
- Integrante: Pendiente de completar por el equipo
- Herramienta: Copilot SDK en VS Code
- Objetivo: Revisar el error `Maximum update depth exceeded` que apareció al publicar un viaje desde Postman y evitar el bucle de navegación en el cliente.
- Prompt: "revisa la consola del frontend con los errores de callback que nos arrogo a la hora de mandar la requiest del trip por medio de postman"
- Resumen de la respuesta: El runtime de Expo no entregó logs recientes; el stack compartido apunta a la actualización repetida del árbol de navegación de Expo Router. Se encontraron dos rutas que pueden resolver al mismo path `/trip-request`, una modal y otra dentro del Drawer.
- Qué se usó / modificó / descartó: Se eliminó la entrada duplicada de solicitud del Drawer; la solicitud entrante sigue abriéndose como modal desde Inicio. No se modificó el endpoint de Postman ni las transiciones del viaje.
- Archivos y commit: `frontend/src/app/(drawer)/_layout.tsx`, `frontend/src/app/(drawer)/trip-request.tsx` (eliminado), `frontend/src/screens/DriverScreens.tsx`, `frontend/src/screens/features/TripRequestScreens.tsx`, `docs/AI_LOG.md`, `docs/AI_LOG.pdf` — cambios sin commit; completar el hash al integrarlos.
- Verificación: Frontend: 7/7 pruebas, TypeScript, lint y export Android completados. Falta repetir la publicación con Postman y una sesión móvil activa para confirmar que ya no se reproduce el error.
- Aprendizaje: Mantener una única ruta canónica para la solicitud entrante; el error de navegación del cliente es independiente de la respuesta HTTP del endpoint.

### Entrada #8
- Fecha: 2026-11-11
- Integrante: Pendiente de completar por el equipo
- Herramienta: Copilot SDK en VS Code
- Objetivo: Investigar por qué un pago aprobado no actualizó MongoDB y habilitar sincronización manual segura cuando el webhook no llega.
- Prompt: "El pago de prueba por $12.900 ya quedó aprobado en Mercado Pago, pero el estado en MongoDB no cambió porque la notificación del Webhook no llegó o fue rechazada por tu servidor local. Revisa los cuatro puntos críticos del túnel, la URL del webhook, los logs y el botón Consultar estado del pago."
- Resumen de la respuesta: Se confirmó que el botón solo consultaba el viaje en MongoDB y no contactaba a Mercado Pago. Se agregó una consulta autenticada por referencia de viaje para recuperar el estado directamente del proveedor.
- Qué se usó / modificó / descartó: El backend verifica que el pago pertenezca al viaje y que el monto y moneda COP coincidan antes de persistir el estado; no se marca pagado por el retorno del checkout ni por una respuesta de cliente.
- Archivos y commit: `backend/src/routes/trips.ts`, `backend/src/services/mercado-pago.ts`, `backend/src/services/mercado-pago.test.ts`, `frontend/src/services/api.ts`, `frontend/src/context/DriverContext.tsx`, `frontend/src/screens/features/TripPaymentScreens.tsx`, `README.md`, `docs/AI_LOG.md`, `docs/AI_LOG.pdf` — cambios sin commit; completar el hash al integrarlos.
- Verificación: Backend TypeScript y 28/28 pruebas, incluyendo búsqueda simulada de pago y validación de referencia, monto, moneda y estado; frontend 7/7 pruebas, TypeScript y lint. No se consultó la cuenta real ni se envió ningún webhook en esta sesión.
- Aprendizaje: El botón de recuperación debe verificar el pago directamente en el proveedor y limitar la consulta a viajes del conductor autenticado.

### Entrada #9
- Fecha: 2026-11-12
- Integrante: Pendiente de completar por el equipo
- Herramienta: Copilot SDK en VS Code
- Objetivo: Ejecutar los puntos prioritarios de la auditoría del cliente conductor y cerrar la paginación del historial, cancelación segura y resumen financiero.
- Prompt: "ejecutemos el plan de accion priorizado punto por punto"
- Resumen de la respuesta: Se corrigió el reintento de registro al resolver errores de campos, se limitó el seguimiento GPS al estado conectado, se implementó la cancelación segura de viajes aceptados/en camino, se reconocieron reembolsos y contracargos, y se agregaron ganancias agregadas y paginación del historial. Se vació la URL de API en la plantilla del frontend.
- Qué se usó / modificó / descartó: Se conservaron las tres pestañas accesibles del formulario sin crear un navigator Tabs separado. Se confirmó que el alcance de datos es solo-conductor y no incluye `passengerId`; los viajes siguen identificados por el conductor y los campos de pago específicos del proveedor. No se modificaron los archivos sin seguimiento preexistentes `.vscode/` ni `desarrolo_pantallas.md`.
- Archivos y commit: `backend/src/models/Trip.ts`, `backend/src/routes/trips.ts`, `backend/src/services/mercado-pago.ts`, `backend/src/services/mercado-pago.test.ts`, `frontend/.env.example`, `frontend/src/context/DriverContext.tsx`, `frontend/src/hooks/useDriverLocation.ts`, `frontend/src/hooks/useEarnings.ts`, `frontend/src/screens/features/DriverRegistrationScreen.tsx`, `frontend/src/screens/features/EarningsScreen.tsx`, `frontend/src/screens/features/HistoryScreen.tsx`, `frontend/src/screens/features/TripNavigationScreens.tsx`, `frontend/src/screens/features/TripPaymentScreens.tsx`, `frontend/src/services/api.ts`, `frontend/src/types/domain.ts`, `frontend/src/utils/driver-registration.ts`, `frontend/src/utils/driver-registration.test.ts`, `README.md`, `docs/AI_LOG.md` — cambios sin commit; completar el hash al integrarlos.
- Verificación: Backend `npm test` (build TypeScript y 28/28 pruebas); frontend `npm test` (8/8), `npx tsc --noEmit`, `npm run lint` y `npm run build` (export Android) pasan. No se conectó a MongoDB ni a servicios externos en esta sesión.
- Aprendizaje: El resumen financiero debe agregarse en el servidor para evitar que la paginación del historial limite los totales; la cancelación y el GPS deben reforzarse tanto en la API como en el estado del cliente.

### Entrada #10
- Fecha: 2026-11-12
- Integrante: Pendiente de completar por el equipo
- Herramienta: Copilot SDK en VS Code
- Objetivo: Investigar los avisos de barra de estado de iOS y navegación Drawer reportados al avanzar por el flujo del viaje.
- Prompt: "Al aceptar un viaje y avanzar por camino a recoger, pasajero a bordo y finalizar, aparecen el aviso `UIViewControllerBasedStatusBarAppearance` y `The action 'CLOSE_DRAWER' was not handled by any navigator`. Revisar el layout y el flujo de navegación para identificar su origen."
- Resumen de la respuesta: Se encontró que el layout aplica estilos dinámicos de barra de estado globalmente y en las pantallas del viaje. Se dejó de modificar el estilo en iOS, conservando el estilo claro en Android. No se encontró una llamada `closeDrawer` en el código de la app; el único control de Drawer usa `toggleDrawer` dentro de su propio layout.
- Qué se usó / modificó / descartó: Se omitió el componente Expo StatusBar y `statusBarStyle` en iOS para evitar que Expo Go intente cambiar dinámicamente una barra controlada por su propio Info.plist. No se modificó el Modal del registro porque no contiene StatusBar y no participa en el flujo de viaje. No se aplicó un cierre de Drawer desde pantallas externas, pues no existe tal llamada y hacerlo sin reproducción confirmada sería especulativo.
- Archivos y commit: `frontend/src/app/_layout.tsx`, `frontend/src/app/(drawer)/_layout.tsx`, `docs/AI_LOG.md` — cambios sin commit; completar el hash al integrarlos.
- Verificación: Frontend `npm test` (8/8), `npx tsc --noEmit` y `npm run lint` pasan. Falta confirmar el comportamiento en Expo Go/iPhone; el aviso de Drawer requiere reproducción para identificar qué acción lo dispara.
- Aprendizaje: La configuración `ios.infoPlist` del proyecto no cambia el Info.plist de Expo Go; en ese entorno conviene evitar modificaciones dinámicas de la barra de estado de iOS.

### Entrada #11
- Fecha: 2026-11-12
- Integrante: Pendiente de completar por el equipo
- Herramienta: Copilot SDK en VS Code
- Objetivo: Revisar y mostrar en el formulario de registro los mínimos, máximos, formatos y condiciones de cada dato.
- Prompt: "En el formulario de registro necesito un detalle para los datos; no se sabe qué cantidad de caracteres mínimos y máximos se requieren en el campo, sobre todo en el documento y en el número de móvil. Revísalo, por favor, con cada uno de los campos."
- Resumen de la respuesta: Se cotejaron las validaciones del cliente y del backend y se agregaron textos de ayuda junto a campos de texto, selectores, fechas y fotos en las tres pestañas del registro.
- Qué se usó / modificó / descartó: Se explicitaron los límites que ya valida el sistema: nombre 1–50, documento 6–10 dígitos, celular exactamente 10, correo hasta 254, contraseña 10–72, placa ABC123, marca/modelo 1–30, año 1950–año actual, capacidad 1–20 (XL 6–20), licencia 1–40, fechas vigentes y fotos JPEG/PNG/WebP hasta 5 MB. No se inventó un formato numérico para el número de licencia porque el backend acepta el texto tal como aparece en el documento.
- Archivos y commit: `frontend/src/components/ui.tsx`, `frontend/src/screens/features/DriverRegistrationScreen.tsx`, `frontend/src/screens/features/registrationStyles.ts`, `docs/AI_LOG.md` — cambios sin commit; completar el hash al integrarlos.
- Verificación: Frontend `npm test` (8/8), `npx tsc --noEmit`, `npm run lint` y `npm run build` (export Android) pasan.
- Aprendizaje: Los límites mostrados en la interfaz deben provenir de las reglas existentes del backend para evitar que la ayuda prometa formatos que el servidor rechaza.

### Entrada #12
- Fecha: 2026-11-12
- Integrante: Pendiente de completar por el equipo
- Herramienta: Copilot SDK en VS Code
- Objetivo: Corregir la solicitud del permiso de notificaciones Android para que FCM pueda registrar el token y mostrar solicitudes con la app en segundo plano.
- Prompt: "La aplicación no está trabajando en segundo plano y no está mostrando las notificaciones de viaje asignado."
- Resumen de la respuesta: Se confirmó que el backend envía un payload FCM con notificación visible y que el cliente registra tokens en builds nativos. Se añadió la declaración del permiso Android 13+ y su solicitud explícita en tiempo de ejecución; si se deniega, la app informa cómo volver a activarlo.
- Qué se usó / modificó / descartó: Se dejó que Android/iOS presente el payload `notification` de FCM cuando la app está en segundo plano; el manejador JS `onMessage` permanece para primer plano. No se añadió seguimiento GPS en segundo plano porque requiere permisos de ubicación "siempre" y confirmación del comportamiento esperado.
- Archivos y commit: `frontend/app.json`, `frontend/src/hooks/useDriverRealtime.ts`, `README.md`, `docs/AI_LOG.md` — cambios sin commit; completar el hash al integrarlos.
- Verificación: Frontend `npm test` (8/8), `npx tsc --noEmit` y `npm run lint` pasan. Falta generar/reinstalar el development build Android para incorporar el permiso nativo y probar entrega real desde Firebase.
- Aprendizaje: Android 13+ requiere declarar `POST_NOTIFICATIONS` en el manifiesto y pedir aprobación en runtime; Expo Go no carga React Native Firebase.

### Entrada #13
- Fecha: 2026-11-12
- Integrante: Pendiente de completar por el equipo
- Herramienta: Copilot SDK en VS Code
- Objetivo: Permitir que la app comparta ubicación y reciba avisos de viajes asignados cuando se ejecuta en segundo plano.
- Prompt: "La aplicación no está trabajando en segundo plano y no está mostrando las notificaciones de viaje asignado. Necesito tanto notificaciones como compartir la ubicación en segundo plano."
- Resumen de la respuesta: Se añadió una tarea Expo Location definida globalmente que envía ubicaciones al backend usando el token de sesión protegido en SecureStore. El seguimiento solicita permisos de ubicación en primer plano y en segundo plano y se liga al estado disponible/aprobado del conductor; también se configuró el servicio foreground de Android, los modos de ubicación de fondo y el handler FCM de background para builds nativos.
- Qué se usó / modificó / descartó: Se reutilizó el endpoint autenticado de ubicación existente. El inicio de disponibilidad se revierte si no se puede arrancar el seguimiento y se detiene si el conductor deja de estar disponible o pierde aprobación. No se garantiza ejecución después de forzar el cierre en iOS, por las restricciones del sistema.
- Archivos y commit: `frontend/index.js`, `frontend/src/services/driver-background-location.ts`, `frontend/src/services/driver-session.ts`, `frontend/src/context/DriverContext.tsx`, `frontend/src/hooks/useDriverRealtime.ts`, `frontend/app.json`, `frontend/app.config.js`, `frontend/eas.json`, `frontend/package.json`, `frontend/package-lock.json`, `README.md`, `docs/AI_LOG.md` — cambios sin commit; completar el hash al integrarlos.
- Verificación: Backend `npm test` (28/28); frontend `npm test` (8/8), `npx tsc --noEmit`, `npm run lint` y `npm run build` (export Android) pasan. `npx expo config --json` confirma los permisos, plugins FCM y EAS; `android.package` coincide con `google-services.json` y el `applicationId` nativo. Falta generar e instalar el development build, publicar los archivos Firebase ignorados como variables de tipo File en EAS y probar GPS/FCM en dispositivo; la entrega real no se verificó en este entorno.
- Aprendizaje: Expo Go no valida los permisos nativos ni FCM; el seguimiento y los avisos en background requieren instalar un build nativo y verificar los permisos del sistema y la configuración APNs de Firebase.

### Entrada #14
- Fecha: 2026-11-13
- Integrante: Pendiente de completar por el equipo
- Herramienta: OpenAI Codex
- Objetivo: Avanzar la migración y correcciones autorizadas de los puntos 1–6, separando implementación, pruebas automáticas y evidencia manual; dejar el video para después.
- Prompt: "okey procede con el punto 1 hasta el 6 el video lo grabo despues de terminar la migracion y correcciones de codigo"
- Resumen de la respuesta: Se implementaron pestañas reales de Expo Router para el registro, conservando `/register` y un contexto compartido para datos, fotos, términos, errores y estado de envío. Se revisó el código de la migración a MapLibre v11 y se documentaron OpenFreeMap, `EXPO_PUBLIC_MAP_STYLE_URL`, la ausencia de clave Google móvil, el fallback ORS del backend y la necesidad de un nuevo build nativo. Se añadió un checklist de entrega con verificaciones pendientes para mapas, localización, historial, pagos y FCM.
- Qué se usó / modificó / descartó: Se consultaron las instrucciones de `frontend/AGENTS.md`, la documentación Expo SDK 58 y la guía oficial MapLibre. Se conservaron las reglas y el payload de registro y se corrigió el retorno a la pestaña de vehículo para errores de `vehicleModel`. El fallback ORS depende de que falte la clave Google del servidor; la validación actual de producción aún exige esa clave. No se presenta un export JavaScript como prueba nativa ni una respuesta simulada como pago sandbox o recepción FCM. Las entradas #1–#13 se conservan como registro histórico; sus referencias anteriores a Expo Go o pestañas manuales no describen la arquitectura migrada.
- Archivos y commit: Registro: `frontend/src/screens/features/DriverRegistrationScreen.tsx`, sustitución de `frontend/src/app/(auth)/register.tsx` por `frontend/src/app/(auth)/register/`, y `frontend/src/context/RegistrationContext.tsx`. Actualización documental: `README.md`, `docs/DELIVERY_CHECKLIST.md` y `docs/AI_LOG.md`. Mapas, historial y localización se integran en paralelo por sus responsables. Sin commit creado en esta intervención; hash y autoría pendientes de datos reales. No se acredita revisión de PR.
- Verificación: Para el cambio de registro se ejecutaron frontend `npm test` (8/8), `npx tsc --noEmit` y `npm run lint`, con resultado satisfactorio; se regeneraron los tipos de rutas mediante Expo antes de repetir TypeScript. Las pruebas existentes cubren tarifas y validación, no la interacción del navigator en dispositivo. Esta actualización documental coteja código y configuración, sin afirmar una nueva ejecución completa de tests de la integración. Quedan pendientes build nativo instalado, pruebas manuales de mapas/registro/idioma/historial, pagos sandbox contra el proveedor, entrega FCM y GPS en segundo plano. Los PDF finales los gestiona la integración principal; el usuario grabará el video después de terminar la migración y correcciones.
- Aprendizaje: El estado del formulario debe vivir por encima de las rutas de las pestañas. El proveedor visual del mapa es independiente del proveedor de rutas y tarifas del servidor. La entrega debe distinguir resultados automatizados de evidencias manuales todavía no obtenidas.
