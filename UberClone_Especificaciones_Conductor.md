# UberClone --- Especificación funcional y técnica

## Versión Conductor

> Documento de requisitos derivado de **"UberClone --- Versión
> Conductor.pdf"**. Consolida las funcionalidades, reglas de negocio,
> validaciones, pantallas, estados, integraciones, modelo de datos,
> seguridad y entregables solicitados en el documento fuente. Los
> valores de tarifas son didácticos y no representan precios comerciales
> reales.

## 1. Descripción general

Aplicación móvil multiplataforma inspirada en Uber, enfocada en la
versión del conductor, desarrollada con **React Native y Expo** para iOS
y Android. Integra servicios de Google Maps y servicios de backend para
recibir solicitudes de viaje en tiempo real, navegar, procesar pagos y
consultar ganancias netas después de la comisión de la plataforma.

### 1.1 Funcionalidades principales

1.  Registro del conductor con datos personales, vehículo y documentos,
    incluyendo validaciones.
2.  Estado **Disponible / No disponible** y envío de ubicación en tiempo
    real.
3.  Recepción de solicitudes con límite de tiempo para aceptar o
    rechazar.
4.  Navegación al punto de recogida y al destino mediante Google
    Directions API.
5.  Cobro del viaje mediante Mercado Pago (recomendado), Stripe en modo
    de prueba o efectivo.
6.  Cálculo automático de tarifa, comisión de la plataforma y ganancia
    neta.
7.  Historial de carreras con filtros y resumen de ganancias por día,
    semana y mes.
8.  Navegación combinada: Stack para el flujo del viaje, Tabs para el
    registro y Drawer para perfil, historial, ganancias y configuración.

## 2. Registro del conductor

El registro debe dividirse en tres pestañas: **Datos personales**,
**Vehículo** y **Documentos y pagos**. El botón **Enviar registro** solo
se habilita cuando todos los campos de las tres pestañas estén completos
y válidos.

### Reglas generales del formulario

-   Ningún campo obligatorio puede quedar nulo o vacío.
-   Los errores de validación se muestran debajo del campo
    correspondiente; no se deben mostrar mediante `Alert`.
-   Después del envío, la cuenta queda en estado
    `Pendiente de aprobación`.
-   El conductor no puede cambiar a Disponible hasta que su estado sea
    `Aprobado`.
-   Para una demostración académica, el estado de aprobación puede
    cambiarse manualmente en la base de datos.
-   No guardar números de cuentas bancarias ni tarjetas en la aplicación
    ni en AsyncStorage. Los datos sensibles de pago deben ser manejados
    por la pasarela.

### 2.1 Pestaña: Datos personales

  -----------------------------------------------------------------------
  Campo                               Requisitos y validación
  ----------------------------------- -----------------------------------
  Foto de perfil                      Obligatoria; permitir seleccionar
                                      desde cámara o galería.

  Nombre completo                     Máximo 50 caracteres; solo letras y
                                      espacios.

  Documento de identidad              Numérico, entre 6 y 10 dígitos.

  Número de celular                   Numérico, exactamente 10 dígitos.

  Fecha de nacimiento                 Selector de fecha; el conductor
                                      debe ser mayor de 18 años.

  Género                              Lista desplegable.

  Correo electrónico                  Validar presencia de `@` y dominio.

  Idioma                              Selector Español / Inglés, igual al
                                      selector de la app del pasajero.
  -----------------------------------------------------------------------

### 2.2 Pestaña: Vehículo

  -----------------------------------------------------------------------
  Campo                               Requisitos y validación
  ----------------------------------- -----------------------------------
  Categoría                           Lista desplegable: Económico, XL,
                                      Premium; deben coincidir con las
                                      categorías que elige el pasajero.

  Placa                               Formato colombiano `ABC123` para
                                      carro. Convertir a mayúsculas antes
                                      de validar.

  Marca                               Texto de máximo 30 caracteres.

  Modelo                              Texto de máximo 30 caracteres.

  Año                                 Numérico, 4 dígitos, no superior al
                                      año actual.

  Color                               Lista desplegable.

  Capacidad de pasajeros              Numérica; la categoría XL exige
                                      mínimo 6 pasajeros.

  Foto del vehículo                   Obligatoria y debe permitir ver la
                                      placa.
  -----------------------------------------------------------------------

### 2.3 Pestaña: Documentos y pagos

  -----------------------------------------------------------------------
  Campo                               Requisitos y validación
  ----------------------------------- -----------------------------------
  Licencia de conducción              Número y foto obligatorios;
                                      vencimiento posterior a la fecha
                                      actual.

  SOAT                                Foto obligatoria y vencimiento
                                      posterior a la fecha actual.

  Revisión técnico-mecánica           Foto y fecha de vencimiento, si
                                      aplica según el año del vehículo.

  Correo de cuenta Mercado Pago       Correo donde el conductor recibiría
                                      los pagos; validar formato.

  Aceptación de términos              Checkbox obligatorio; mostrar
                                      claramente el porcentaje de
                                      comisión.
  -----------------------------------------------------------------------

## 3. Pantallas del conductor

### 3.1 Inicio

-   Mostrar un mapa centrado en la ubicación actual.
-   Incluir interruptor **Disponible / No disponible**.
-   Solo permitir activar disponibilidad si la cuenta está aprobada.
-   Mientras esté disponible, actualizar la ubicación en la base de
    datos cada pocos segundos.
-   Al pasar a No disponible o salir de la pantalla, detener el
    seguimiento.
-   La suscripción/seguimiento debe limpiarse con la función de limpieza
    de `useEffect`.

### 3.2 Solicitud entrante

Mostrar una tarjeta con:

-   Origen y destino.
-   Distancia y duración estimadas.
-   Categoría del servicio.
-   Método de pago.
-   Tarifa estimada.
-   Ganancia neta estimada del conductor.
-   Acciones para aceptar o rechazar.

La solicitud tiene un temporizador de **15 segundos**. Si llega a cero,
debe rechazarse automáticamente. Si se rechaza o vence, el sistema debe
pasar la solicitud al siguiente conductor o dejarla en estado
`rejected`, según el flujo disponible.

### 3.3 Viaje en curso

-   Inicialmente mostrar la ruta hacia el punto de recogida.
-   Al pulsar **Pasajero a bordo**, cambiar la ruta para navegar hacia
    el destino.
-   Incluir una acción para finalizar el viaje.
-   Reflejar y persistir los cambios de estado del viaje.

### 3.4 Cobro y resumen del viaje

Mostrar:

-   Tarifa final.
-   Comisión de la plataforma.
-   Ganancia neta del conductor.
-   Estado del pago: `Aprobado`, `Pendiente`, `Rechazado` o `Efectivo`.

La pantalla debe actualizarse cuando el backend confirme el pago o
registre el cobro en efectivo.

### 3.5 Ganancias

Mostrar totales para hoy, la semana y el mes. Para cada periodo incluir:

-   Número de viajes.
-   Total facturado.
-   Total de comisiones.
-   Propinas.
-   Ganancia neta.
-   Promedio de ganancia por viaje.

Los agregados se calculan a partir del historial usando `useMemo`.

### 3.6 Historial de carreras

-   Usar `FlatList`.
-   Ordenar del viaje más reciente al más antiguo.
-   Filtros de fecha: Hoy, Semana, Mes y Rango de fechas.
-   Filtro por método de pago.
-   Cada elemento muestra fecha y hora, origen → destino, categoría,
    tarifa, ganancia neta y estado del pago.
-   Al tocar un elemento, abrir detalle con ruta dibujada en mapa,
    duración, distancia, comisión, propina y calificación del pasajero.
-   Si no hay viajes para los filtros elegidos, mostrar un mensaje de
    estado vacío.
-   Paginar o limitar la consulta; referencia sugerida: 20 viajes por
    carga.

### 3.7 Perfil y configuración

Permitir consultar y editar los datos permitidos del perfil, vehículo y
documentos; cambiar idioma y cerrar sesión. Los datos de pago sensibles
no deben guardarse localmente en la aplicación.

## 4. Estados y ciclo de vida del viaje

El campo `status` controla el flujo y la pantalla correspondiente.

  -----------------------------------------------------------------------
  Estado                              Significado
  ----------------------------------- -----------------------------------
  `requested`                         El pasajero solicitó el viaje.

  `accepted`                          El conductor aceptó la solicitud.

  `driver_arriving`                   El conductor se dirige al punto de
                                      recogida.

  `in_progress`                       El pasajero está a bordo y el viaje
                                      está en curso.

  `completed`                         El viaje terminó; se calcularon
                                      tarifa, comisión y ganancia.

  `paid`                              El pago fue confirmado por la
                                      pasarela o registrado como
                                      efectivo.

  `cancelled`                         Viaje cancelado por cualquiera de
                                      las partes antes de `in_progress`.
  -----------------------------------------------------------------------

**Regla de transición:** si el conductor rechaza una solicitud o el
temporizador expira, la solicitud pasa al siguiente conductor o queda
como `rejected`. `rejected` aparece en la descripción del flujo de
solicitudes, aunque no forma parte de la lista principal de estados
persistidos del viaje; definir su tratamiento en la implementación.

## 5. Hooks y gestión del estado

Uso obligatorio de los hooks vistos en clase:

-   `useState`: estado de disponibilidad, solicitud activa y
    formularios.
-   `useEffect`: seguimiento de ubicación, temporizador de solicitudes y
    suscripciones en tiempo real; debe incluir funciones de limpieza.
-   `useContext` o Redux: sesión del conductor y viaje activo.
-   `useMemo`: cálculo de totales y resúmenes de ganancias.
-   `useCallback`: manejadores de aceptar y rechazar solicitudes.
-   Hooks personalizados mínimos:
    -   `useDriverLocation`
    -   `useTripRequests`
    -   `useEarnings`
-   `AsyncStorage`: únicamente preferencias y sesión, por ejemplo idioma
    y último estado de disponibilidad. Nunca almacenar datos sensibles.

## 6. Pasarela de pagos

### 6.1 Proveedor recomendado

Se recomienda **Mercado Pago Checkout Pro** como pasarela principal, con
cuentas de prueba de vendedor y comprador y tarjetas de prueba.
**Stripe** también se acepta únicamente en modo de prueba.

  --------------------------------------------------------------------------------
  Criterio                Mercado Pago             Stripe
  ----------------------- ------------------------ -------------------------------
  Entorno de pruebas      Cuentas de prueba y      Modo de prueba con claves
                          tarjetas de prueba       `sk_test` / `pk_test`

  Integración sugerida    Checkout Pro abierto en  `@stripe/stripe-react-native`
                          `react-native-webview` o con PaymentSheet
                          navegador                

  Medios locales          Tarjetas, PSE y efectivo Principalmente tarjetas
  indicados en el         según el país            
  documento                                        
  --------------------------------------------------------------------------------

### 6.2 Flujo obligatorio de pago

1.  Al finalizar el viaje, calcular la tarifa final con la misma función
    utilizada para estimar el viaje.
2.  Enviar al backend (Node.js/Express o Firebase Cloud Functions)
    `tripId` y monto.
3.  El backend crea la preferencia de pago de Mercado Pago o el
    `PaymentIntent` de Stripe usando la llave secreta.
4.  La aplicación abre el checkout y se completa el pago con una tarjeta
    de prueba.
5.  La pasarela notifica el resultado mediante URL de retorno o webhook.
    El backend actualiza `paymentStatus`, `paymentId` y `status: paid`
    cuando corresponda.
6.  La aplicación del conductor escucha el cambio en tiempo real y
    muestra el resumen del cobro.

### 6.3 Seguridad de pagos

-   El `access_token` de Mercado Pago y la secret key de Stripe nunca
    deben incluirse en el código móvil.
-   Las claves secretas solo se usan en el backend y se almacenan en un
    archivo `.env` excluido de Git.
-   Incluir `.env.example` con nombres de variables, sin valores
    secretos.
-   Usar únicamente credenciales de prueba durante el proyecto.
-   No guardar números de cuentas bancarias ni tarjetas en la app ni en
    AsyncStorage.

### 6.4 Pago en efectivo y liquidación

-   El conductor marca el cobro como recibido.
-   Como la plataforma no recibe el efectivo, la comisión se descuenta
    del saldo del conductor; el saldo puede quedar negativo.
-   La liquidación al conductor se simula mediante un saldo dentro de la
    app.
-   Los pagos divididos reales entre plataforma y conductor
    (`split payments`) son una bonificación opcional, no un requisito
    obligatorio.

## 7. Cálculo de tarifa, comisión y ganancias

La plataforma cobra una comisión del **20 %** sobre la tarifa del viaje.
Las propinas corresponden íntegramente al conductor. Los parámetros
deben centralizarse en `src/config/pricing.js`, y los importes se
manejan como pesos colombianos enteros para evitar errores de decimales.

### 7.1 Parámetros de referencia

Estos valores son didácticos y no tarifas reales.

  Parámetro                         Valor
  --------------------------- -----------
  Tarifa base                   3.500 COP
  Valor por kilómetro           1.200 COP
  Valor por minuto                250 COP
  Tarifa mínima                 6.000 COP
  Multiplicador Económico             1,0
  Multiplicador XL                    1,4
  Multiplicador Premium               1,8
  Comisión de la plataforma          20 %

### 7.2 Fórmula funcional

La distancia y la duración provienen de Google Distance Matrix API.

1.  Calcular el subtotal: tarifa base + (distancia en km × valor por
    km) + (duración en minutos × valor por minuto).
2.  Aplicar el multiplicador de la categoría.
3.  Respetar la tarifa mínima.
4.  Redondear la tarifa al múltiplo de 100 COP más cercano antes de
    calcular la comisión.
5.  Calcular la comisión del 20 % sobre la tarifa.
6.  Calcular la ganancia neta del conductor, sumando la propina completa
    al importe que le corresponda después de la comisión.

> El PDF contiene la indicación de fórmulas, pero la expresión
> matemática visual no aparece legible en el texto extraído. La
> secuencia anterior resume los parámetros y reglas que sí se
> especifican; confirmar la fórmula exacta con el ejemplo de referencia
> antes de darla por cerrada.

### 7.3 Función única requerida

Implementar una función pura:

``` js
calculateFare({ distanceKm, durationMin, category, tip })
```

Debe devolver:

``` js
{ fare, commission, driverEarnings }
```

-   Usar la misma función para la estimación del pasajero y para el
    cierre del viaje del conductor.
-   Guardar en cada viaje `commissionRate`, de modo que un cambio futuro
    de porcentaje no altere el historial.
-   Mostrar ganancias para hoy, semana y mes usando el historial y
    `useMemo`.
-   Mostrar saldo del conductor: ganancias de viajes pagados por
    pasarela menos comisiones de viajes pagados en efectivo.

### 7.4 Ejemplo del documento

Viaje de **8,5 km**, **22 minutos**, sin propina:

  Concepto                         Económico           XL
  ----------------------------- ------------ ------------
  Base + distancia + tiempo       19.200 COP   19.200 COP
  Multiplicador                        × 1,0        × 1,4
  Tarifa redondeada               19.200 COP   26.900 COP
  Comisión del 20 %                3.840 COP    5.380 COP
  Ganancia neta del conductor     15.360 COP   21.520 COP

El ejemplo debe utilizarse como caso de prueba de aceptación de la
función de tarifas.

## 8. Historial y modelo de datos

El documento sugiere una colección `trips` en Firestore o MongoDB. Los
nombres de campos están en inglés.

  --------------------------------------------------------------------------
  Campo                   Tipo                    Descripción
  ----------------------- ----------------------- --------------------------
  `driverId`              string                  Referencia al conductor.

  `passengerId`           string                  Referencia al pasajero.

  `origin`                object                  `{ lat, lng, address }`.

  `destination`           object                  `{ lat, lng, address }`.

  `distanceKm`            number                  Distancia calculada por
                                                  Distance Matrix.

  `durationMin`           number                  Duración calculada por
                                                  Distance Matrix.

  `category`              string                  `economy`, `xl`,
                                                  `premium`.

  `fare`                  number                  Tarifa en pesos enteros.

  `commission`            number                  Comisión en pesos enteros.

  `tip`                   number                  Propina en pesos enteros.

  `driverEarnings`        number                  Ganancia del conductor en
                                                  pesos enteros.

  `commissionRate`        number                  Porcentaje aplicado en ese
                                                  viaje; referencia `0.20`.

  `paymentMethod`         string                  `mercadopago`, `stripe`,
                                                  `cash`.

  `paymentStatus`         string                  Estado devuelto por la
                                                  pasarela o registro de
                                                  efectivo.

  `paymentId`             string                  Identificador de pago de
                                                  la pasarela, si aplica.

  `status`                string                  Estado del viaje.

  `rating`                number                  Calificación de 1 a 5.

  `createdAt`             timestamp               Fecha de creación del
                                                  viaje.

  `completedAt`           timestamp               Fecha de finalización del
                                                  viaje.
  --------------------------------------------------------------------------

La consulta de historial debe filtrar por conductor, rango de fechas y
método de pago, ordenar de forma descendente y paginar o limitar
resultados.

## 9. APIs y servicios adicionales

El documento solicita tres servicios gratuitos como obligatorios y
enumera otros como opcionales.

  -----------------------------------------------------------------------------------------
  Servicio/API                              Uso                     Decisión indicada
  ----------------------------------------- ----------------------- -----------------------
  Firebase Cloud Messaging                  Notificar nuevas        Obligatorio
  (`@react-native-firebase/messaging`)      solicitudes con la app  
                                            en segundo plano.       

  Firestore en tiempo real (`onSnapshot`) o Sincronizar ubicación   Obligatorio
  MongoDB Change Streams                    del conductor y estado  
                                            del viaje.              

  Geolocalización                           Ubicación continua del  Obligatorio
  (`@react-native-community/geolocation`,   conductor.              
  `watchPosition`)                                                  

  Maps SDK Android/iOS                      Mapa del conductor.     Ya incluida
  (`react-native-maps`)                                             

  Cloudinary                                Fotos de perfil,        Recomendada
                                            vehículo y documentos.  

  Nominatim (OpenStreetMap)                 Convertir coordenadas   Opcional
                                            en dirección; máximo    
                                            indicado de 1 petición  
                                            por segundo.            

  OSRM u OpenRouteService                   Ruta alternativa para   Opcional
                                            ahorrar cuota de        
                                            Directions.             
  -----------------------------------------------------------------------------------------

### 9.1 Recomendaciones para controlar consumo

-   Llamar a Distance Matrix una vez al crear la solicitud y una vez al
    aceptarla; no en cada actualización de ubicación.
-   Restringir la API key de Google por aplicación y configurar alertas
    de presupuesto en Google Cloud.
-   No usar Static Maps para cada elemento del historial. Dibujar rutas
    guardadas con `Polyline` en `react-native-maps`.
-   Firebase Storage puede exigir el plan Blaze en proyectos nuevos; el
    documento sugiere Cloudinary para imágenes.

> Las cuotas y condiciones comerciales de servicios externos pueden
> cambiar. Las referencias anteriores reproducen las indicaciones del
> documento fuente; comprobar la documentación vigente al configurar el
> proyecto.

## 10. Navegación de la aplicación

Organizar la navegación combinando:

-   **Stack:** flujo del viaje (solicitud, recogida, viaje en curso,
    cobro y resumen).
-   **Tabs:** pestañas del registro del conductor (Datos personales,
    Vehículo, Documentos y pagos).
-   **Drawer:** perfil, historial, ganancias y configuración.

La navegación debe reflejar el estado de aprobación del conductor y el
estado persistido del viaje, evitando que una pantalla quede
desincronizada con el backend.

## 11. Variables de entorno y configuración

-   Centralizar precios y comisión en `src/config/pricing.js`.
-   Crear `.env.example` con los nombres de variables necesarios, sin
    valores reales.
-   Mantener `.env` fuera del control de versiones.
-   Las claves secretas de las pasarelas deben residir exclusivamente en
    backend.
-   Restringir las claves de Google y activar alertas de presupuesto.
-   No incluir credenciales, tokens ni datos personales reales en
    prompts de IA, repositorios o documentación pública.

## 12. Bitácora de uso de inteligencia artificial

Cada equipo debe documentar todo uso de herramientas de IA (Claude,
ChatGPT, Copilot, Gemini u otras). El uso de IA está permitido, pero no
declararlo se considera falta de honestidad académica. Si no se utilizó
IA, se entrega igualmente la bitácora con esa declaración.

### 12.1 Ubicación y entrega

-   Archivo: `docs/AI_LOG.md`, en la rama `main`.
-   Cada integrante registra sus entradas en su propia rama y las sube a
    `main` mediante Pull Request.
-   El `README.md` debe tener una sección **Uso de IA** con enlace a la
    bitácora.
-   Adjuntar la bitácora exportada a PDF en la entrega.

### 12.2 Procedimiento por cada uso

1.  Registrar la entrada al momento de usar la herramienta, no al final
    del proyecto.
2.  Copiar el prompt exactamente como se escribió, sin resumirlo.
3.  Resumir la respuesta en 2 o 3 líneas y añadir el enlace a la
    conversación, si está disponible.
4.  Indicar qué se usó tal cual, qué se modificó y qué se descartó.
5.  Anotar archivos afectados y hash del commit que contiene el cambio.
6.  Describir cómo se verificó: emulador, caso de prueba o revisión de
    documentación.
7.  Marcar bloques asistidos por IA con un comentario en inglés que
    remita a la entrada, por ejemplo:

``` js
// AI-assisted: see docs/AI_LOG.md #7.
```

### 12.3 Plantilla obligatoria de entrada

``` md
### Entrada #7
- Fecha: YYYY-MM-DD
- Integrante: Nombre Apellido
- Herramienta: Nombre de la herramienta
- Objetivo: Objetivo del uso
- Prompt: "Texto completo del prompt"
- Resumen de la respuesta: Resumen en 2 o 3 líneas
- Qué se usó / modificó / descartó: Detalle
- Archivos y commit: ruta/archivo — hash
- Verificación: Pruebas realizadas
- Aprendizaje: Qué entendí y qué haría distinto
```

### 12.4 Reglas de seguridad y sustentación

-   Nunca incluir llaves de API, `access_token` ni datos personales
    reales en un prompt.
-   En la sustentación, cualquier integrante puede ser llamado a
    explicar un bloque marcado como asistido por IA.

## 13. Entregables

1.  Enlace al repositorio con ramas por integrante, Pull Requests
    revisados y merge en `main`.
2.  `README.md` con instrucciones de instalación, variables de entorno
    (`.env.example`) y sección **Uso de IA**.
3.  `docs/AI_LOG.md` y su versión en PDF.
4.  Video de máximo **5 minutos** que muestre el flujo completo:
    -   Registro del conductor.
    -   Recepción y atención de una solicitud.
    -   Viaje.
    -   Pago de prueba.
    -   Historial.

## 14. Criterios de aceptación derivados de los requisitos

Esta lista transforma los requisitos del documento en comprobaciones
prácticas; no reemplaza la rúbrica original.

### Registro

-   [ ] El botón Enviar registro permanece deshabilitado hasta completar
    y validar las tres pestañas.
-   [ ] Cada campo inválido muestra el error debajo del campo, no en un
    `Alert`.
-   [ ] Un conductor menor de 18 años no puede completar el registro.
-   [ ] La placa se normaliza a mayúsculas antes de validarse.
-   [ ] La categoría XL exige capacidad mínima de 6 pasajeros.
-   [ ] Los documentos con vencimiento pasado se rechazan cuando la
    fecha es obligatoria.
-   [ ] La cuenta recién enviada queda Pendiente de aprobación y no
    puede ponerse Disponible.

### Disponibilidad y solicitudes

-   [ ] Un conductor aprobado puede ponerse Disponible y compartir su
    ubicación periódicamente.
-   [ ] Al desactivarse o salir de la pantalla se limpian las
    suscripciones de ubicación.
-   [ ] La solicitud muestra todos los datos de estimación solicitados.
-   [ ] El temporizador es de 15 segundos y la solicitud se rechaza
    automáticamente al vencer.
-   [ ] Aceptar y rechazar actualizan el estado del viaje y la interfaz.

### Viaje y navegación

-   [ ] Antes de recoger al pasajero se muestra la ruta al origen.
-   [ ] Al marcar Pasajero a bordo se muestra la ruta al destino.
-   [ ] Al finalizar, se calcula la tarifa con la misma función usada
    para la estimación.
-   [ ] Los estados del viaje se persisten y la interfaz reacciona a los
    cambios en tiempo real.

### Pago

-   [ ] Solo se utilizan credenciales de prueba.
-   [ ] Las claves secretas permanecen en backend.
-   [ ] El backend actualiza `paymentStatus`, `paymentId` y el estado
    `paid` cuando el pago se confirma.
-   [ ] El pago en efectivo puede marcarse como recibido y la comisión
    afecta el saldo del conductor.
-   [ ] No se guardan datos bancarios ni de tarjeta en almacenamiento
    local.

### Tarifas y ganancias

-   [ ] Los parámetros de precio están centralizados en
    `src/config/pricing.js`.
-   [ ] `calculateFare` es una función pura compartida por estimación y
    cierre del viaje.
-   [ ] La tarifa se redondea al múltiplo de 100 COP más cercano antes
    de calcular la comisión.
-   [ ] Cada viaje conserva su `commissionRate`.
-   [ ] Ganancias y promedios se calculan para hoy, semana y mes.
-   [ ] La propina se atribuye completamente al conductor.
-   [ ] El saldo refleja ganancias de pagos por pasarela menos
    comisiones de pagos en efectivo.

### Historial

-   [ ] Se usa `FlatList`, orden descendente y filtros de fecha y método
    de pago.
-   [ ] El detalle muestra mapa/ruta, duración, distancia, comisión,
    propina y calificación.
-   [ ] Los filtros sin resultados muestran un mensaje vacío.
-   [ ] Los resultados se cargan de forma paginada o con un límite, por
    ejemplo 20 por carga.

### Calidad y entrega

-   [ ] Se utilizan los hooks obligatorios y se limpian temporizadores y
    suscripciones.
-   [ ] AsyncStorage contiene solo preferencias y datos permitidos de
    sesión.
-   [ ] El repositorio incluye `.env.example`, `README.md` y bitácora de
    IA.
-   [ ] Los cambios colaborativos pasan por Pull Requests revisados y se
    integran en `main`.
-   [ ] Se entrega la bitácora en Markdown y PDF y el video de máximo 5
    minutos.

## 15. Fuentes mencionadas en el PDF

-   Mercado Pago Colombia --- Cuentas de prueba de Checkout Pro.
-   Platzi --- Disponibilidad de Stripe en Colombia.
-   Google Maps Platform --- Preguntas frecuentes de facturación.
-   StoreRocket --- Precios de Google Maps API.

------------------------------------------------------------------------

**Nota de fidelidad:** este archivo consolida los requisitos que
aparecen en el PDF. Cuando el documento no define por completo un
detalle (por ejemplo, la expresión matemática renderizada de la fórmula
de tarifa o la transición exacta de `rejected`), se señala expresamente
para evitar presentar una inferencia como requisito literal.
