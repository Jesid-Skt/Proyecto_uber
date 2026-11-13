# Checklist de entrega: migración y correcciones

Fecha de actualización: 2026-11-13.

Autorización del usuario: «okey procede con el punto 1 hasta el 6 el video lo grabo despues de terminar la migracion y correcciones de codigo».

Los seis bloques siguientes organizan la verificación de esta entrega. Una implementación visible en el código o una prueba unitaria aprobada no acredita una prueba en dispositivo ni una transacción real de sandbox. La integración continúa en paralelo; no se declara cerrada la entrega completa.

## 1. Mapas y configuración

- [x] Documentado MapLibre React Native v11, plugin nativo y estilo OpenFreeMap predeterminado: `https://tiles.openfreemap.org/styles/liberty`.
- [x] Documentada la sustitución opcional mediante `EXPO_PUBLIC_MAP_STYLE_URL`, sin clave Google Maps móvil.
- [x] Documentada la separación: MapLibre dibuja; el backend obtiene rutas y métricas con Google o con `ORS_API_KEY` cuando falta la clave Google del servidor.
- [x] La validación de producción permite Google o ORS; se aclaró que ORS se selecciona cuando Google no está configurado, no como reintento ante errores del proveedor.
- [x] MapLibre encuadra rutas y marcadores en Inicio, recogida, viaje y detalle; la lógica de límites tiene pruebas automatizadas.
- [x] Retirado el seguimiento GPS en segundo plano para cumplir el PDF: se comparte ubicación únicamente en Inicio mientras el conductor está disponible y se limpian las suscripciones al salir.
- [ ] Generar e instalar builds nativos nuevos Android/iOS y registrar dispositivo, versión del build y resultado. Expo Go o un export JavaScript no prueban la integración nativa.
- [ ] Comprobar teselas, atribución, ubicación, marcadores y geometría de rutas en inicio, recogida, viaje y detalle histórico.

## 2. Registro con Expo Router Tabs

- [x] Implementadas rutas `/register`, `/register/vehicle` y `/register/documents` con `Tabs` de `expo-router/ui`.
- [x] Contexto compartido para datos, fotos, términos, errores y envío; navegación Continuar/Anterior y retorno al campo con error.
- [x] En la verificación del cambio de registro: `npx tsc --noEmit`, `npm run lint` y `npm test` aprobados (8/8 pruebas existentes de tarifas y validación).
- [ ] Prueba manual: escribir en las tres pestañas, adjuntar fotos, aceptar términos, alternar rutas y usar Atrás; comprobar que el borrador no se reinicia dentro del registro.
- [ ] Verificar fechas/cámara/galería en Android e iOS, envío a MongoDB de pruebas, error de servidor y corrección sin perder datos. Las pruebas existentes no montan el navigator ni automatizan estos pasos.

## 3. Idioma e interfaz

- [x] Identificada la implementación de localización basada en `profile.language`, con catálogos Español/Inglés y fallback a español.
- [x] Localización integrada en registro, navegación, cobro, historial, perfil y pantallas principales; sus 5 pruebas se incluyen ahora en `npm test`.
- [ ] Comprobar cambio de idioma, persistencia al volver a iniciar sesión, formatos COP, accesibilidad y textos largos.
- [x] Actualizada la documentación de localización para reflejar las pantallas conectadas y los límites de traducción de datos de usuario y mensajes arbitrarios del servidor.

## 4. Historial y regresión del flujo

- [x] Las respuestas de filtros/paginación obsoletas no reemplazan la lista actual ni muestran errores de filtros anteriores.
- [x] El filtro Stripe se mantiene como filtro de datos históricos; no se presenta como integración de cobro.
- [ ] Comprobar filtros combinados, rango de fechas, lista vacía, varias páginas, cambio de filtro durante una carga, detalle y ruta histórica con datos de pruebas.
- [ ] Verificar solicitud, aceptación/rechazo, temporizador, recogida, inicio, finalización, cancelación y ganancias contra el backend. Un selector que enumere Stripe no acredita una integración Stripe.
- [ ] Ejecutar y conservar resultados finales de frontend `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npx expo-doctor` y backend `npm test`. Los resultados históricos de la bitácora no sustituyen esta ejecución tras integrar todos los cambios.

## 5. Evidencia manual de pagos, FCM y segundo plano

- [ ] Mercado Pago sandbox: usar credenciales `TEST-`, registrar un viaje y pago de prueba, demostrar checkout, webhook firmado o sincronización autenticada, estado en MongoDB y actualización de ganancias. No guardar tokens ni información sensible en capturas.
- [ ] Verificar pago rechazado/pendiente, retorno del checkout sin aprobación y confirmación explícita del efectivo.
- [ ] FCM: registrar token en un build nativo, publicar una solicitud real de prueba con la app en segundo plano y capturar recepción/apertura en Android/iOS; verificar permiso Android 13+ y APNs en iOS.
- [ ] GPS: demostrar actualización solo en Inicio con la app visible y disponibilidad activa; comprobar que se detiene al desconectarse y salir de Inicio. No se solicita ni se implementa GPS en segundo plano porque el PDF exige detenerlo al salir de la pantalla.

Estado: evidencia manual de sandbox, FCM y GPS pendiente. Las respuestas HTTP simuladas y los tests unitarios no demuestran entrega push, pagos del proveedor ni persistencia real en Atlas.

## 6. Documentación y entrega

- [x] README actualizado con configuración, fallback ORS, límites y recompilación nativa.
- [x] Añadida Entrada #14 de IA con el prompt exacto; conservadas las entradas anteriores.
- [ ] Generar y revisar los PDF de entrega desde la versión final de los documentos; lo gestiona la integración principal. Esta actualización solo entrega Markdown.
- [ ] Completar nombres de integrantes, hashes y referencias de revisión únicamente cuando existan. No se creó commit ni se acredita revisión de PR.
- [ ] Adjuntar evidencias manuales con fecha, plataforma/build, pasos, resultado esperado y observado; registrar fallos sin marcarlos aprobados.
- [ ] Video: lo grabará el usuario después de terminar la migración y las correcciones de código. Pendiente por decisión expresa del usuario.
