# ⚡ Electravelin — Planificador de Viajes para Vehículos Eléctricos en Chile

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **MVP (Producto Mínimo Viable)** de una aplicación web responsiva diseñada para eliminar la "ansiedad de autonomía" (*range anxiety*) en viajes interurbanos por la **Ruta 5 de Chile**, calculando de manera determinista paradas óptimas de recarga, consumos de energía, tiempos de espera y costos estimados en pesos chilenos (CLP).

---

## 📌 Contexto y Motivación

Chile se encuentra en plena transición hacia la movilidad sostenible, con metas gubernamentales como la Estrategia Nacional de Electromovilidad (100% de ventas de vehículos livianos cero emisiones al 2035). No obstante, los conductores de vehículos eléctricos (VE) se enfrentan a un desafío crítico al planificar viajes interurbanos:

1. **Autonomía limitada y variables geográficas:** La geografía de Chile presenta distancias considerables entre centros urbanos a lo largo de la Ruta Panamericana (Ruta 5).
2. **Diversidad de infraestructura de carga:** Coexisten múltiples operadores privados (Copec Voltex, ENEX e-drive, Shell Recharge, Enel X Way) con diversas potencias (50 kW a 150+ kW), estándares de conectores incompatibles entre sí (CCS2 europeo/americano vs. CHAdeMO japonés) y esquemas tarifarios dispares.
3. **Falta de herramientas locales deterministas:** Muchas soluciones internacionales (como ABRP) no reflejan fielmente las tarifas en CLP, la red específica de la Ruta 5 ni las restricciones de compatibilidad local.

**Electravelin** nace para resolver este problema: un planificador inteligente de extremo a extremo que modela con precisión la batería utilizable de cada VE, su consumo nominal y la curva de recarga recomendada para garantizar que el conductor llegue a destino sin riesgo de descarga profunda.

---

## 🏛️ Arquitectura del Sistema

El proyecto sigue una arquitectura desacoplada **Cliente-Servidor (SPA + REST API)** optimizada para escalabilidad y mantenibilidad:

```
electravelin/
├── .gitignore                       # Filtro de exclusión para Git (node_modules, envs, datos locales)
├── README.md                        # Documentación técnica integral
├── AGENTS.md                        # Guía de colaboración y flujo de trabajo
├── render.yaml                      # Despliegue del API y del cliente estático en Render
│
├── supabase/                        # Esquema productivo de datos y cuentas
│   ├── migrations/
│   │   └── 20261002000001_init.sql  # Tablas, triggers y políticas RLS
│   └── seed.sql                     # Catálogo inicial idempotente
│
├── server/                          # Backend API REST (Node.js + Express)
│   ├── package.json
│   ├── .env.example                 # Variables de entorno requeridas
│   ├── data/                        # Datos locales de desarrollo (ignorado por Git)
│   ├── test/                        # Pruebas unitarias y de API (node:test)
│   └── src/
│       ├── index.js                 # createApp: middlewares, rutas y arranque
│       ├── config/
│       │   └── loadEnvironment.js   # Carga .env sin pisar variables del host
│       ├── middleware/
│       │   ├── auth.js              # requireAuth, requireAdmin, optionalAuth
│       │   └── requestContext.js    # Request ID y logging de cada solicitud
│       ├── controllers/
│       │   ├── routeController.js   # Cálculo de ruta v1 y v2 (RF01-RF15)
│       │   ├── accountController.js # Registro, login, perfil, historial, favoritos
│       │   ├── catalogController.js # Catálogo público y CRUD administrativo
│       │   └── cityController.js    # Ciudades del grafo Ruta 5
│       ├── routes/
│       │   ├── routeRoutes.js       # /api/vehiculos, /api/estaciones, /api/routes/plan
│       │   ├── authRoutes.js        # /api/auth/*
│       │   ├── accountRoutes.js     # /api/perfil, /api/viajes, /api/favoritos
│       │   └── adminRoutes.js       # /api/admin/*
│       ├── services/
│       │   ├── batteryService.js    # Motor determinista de batería (RN01-RN06)
│       │   ├── routePlanningService.js # Planificador geográfico y selección de paradas
│       │   ├── routingProviders.js  # Nominatim + OpenRouteService
│       │   ├── authService.js       # JWT HS256 y hash scrypt de contraseñas
│       │   ├── accountService.js    # Historial de viajes y favoritos
│       │   ├── catalogService.js    # Filtros y CRUD del catálogo
│       │   ├── auditService.js      # Registro de auditoría administrativa
│       │   ├── dataStore.js         # Persistencia local (JSON) inyectable
│       │   └── logger.js            # Logging JSON con redacción de secretos
│       └── data/                    # Catálogo semilla en formato JSON
│           ├── vehicles.json        # 19 VE representativos en Chile
│           ├── stations.json        # 17 electrolineras verificadas centro-sur
│           └── mockRoutes.json      # Grafo lineal de tramos y ciudades
│
└── client/                          # Frontend SPA (React 18 + Vite)
    ├── package.json
    ├── vite.config.js               # Proxy hacia API backend (:3001)
    ├── vercel.json                  # Rewrites para desplegar la SPA en Vercel
    ├── index.html                   # HTML semántico, fuentes y Leaflet
    └── src/
        ├── main.jsx                 # Bootstrap de React en el DOM
        ├── App.jsx                  # Navegación por pestañas y coordinación de estado
        ├── index.css                # Sistema de diseño (dark futurista, glassmorphism)
        ├── context/
        │   └── AuthContext.jsx      # Sesión, login, registro y perfil
        ├── components/
        │   ├── Header.jsx           # Identidad, usuario y navegación
        │   ├── PlanningForm.jsx     # Formulario de planificación (RF01-RF05, RF20)
        │   ├── RouteResults.jsx     # Resultados, guardar viaje y errores (RF15-RF18)
        │   ├── RouteMap.jsx         # Mapa Leaflet con trazado y marcadores (RF16)
        │   ├── StopCard.jsx         # Detalle de cada parada de recarga (RF17)
        │   ├── CatalogPanel.jsx     # Catálogo con filtros y favoritos
        │   ├── ProfilePanel.jsx     # Perfil, historial y favoritos
        │   ├── AdminPanel.jsx       # CRUD de catálogo y auditoría (admin)
        │   └── AuthPanel.jsx        # Modal de login y registro
        └── utils/
            └── api.js               # Cliente HTTP con token y manejo de errores
```

---

## ⚙️ Reglas de Negocio Matemáticas (RN01 – RN06)

El núcleo del cálculo reside en [`batteryService.js`](./server/src/services/batteryService.js). Todos los cálculos son deterministas y siguen las siguientes especificaciones:

| Regla | Nombre | Fórmula / Criterio |
| :--- | :--- | :--- |
| **RN01** | **Consumo por Tramo** | $\text{Energía Consumida (kWh)} = \text{Distancia (km)} \times \left(\frac{\text{Consumo Ref (kWh/100km)}}{100}\right)$<br>$\text{SoC Llegada (\%)} = \text{SoC Salida (\%)} - \left(\frac{\text{Energía Consumida (kWh)}}{\text{Capacidad Batería (kWh)}} \times 100\right)$ |
| **RN02** | **Reserva de Seguridad** | El Estado de Carga proyectado ($\text{SoC}$) **nunca debe caer por debajo del 15%** al llegar a una parada intermedia o al destino. Si se proyecta $\text{SoC} < 15\%$, el algoritmo inserta obligatoriamente una parada de carga en la estación previa disponible. |
| **RN03** | **Compatibilidad de Conectores** | La estación debe contar con al menos un estándar compatible con el vehículo ($\text{CCS2}$ o $\text{CHAdeMO}$). En caso de incompatibilidad, se descarta o alerta ruta no factible. |
| **RN04** | **Objetivo de Recarga** | Se prioriza recargar hasta el **80% de SoC** (zona óptima de carga rápida DC). Si el tramo posterior requiere más energía para no violar la reserva del 15%, el objetivo escala dinámicamente hasta el porcentaje necesario (máximo 100%). |
| **RN05** | **Tiempo de Carga** | $\text{Energía a Cargar (kWh)} = \text{Capacidad} \times \left(\frac{\text{SoC Salida} - \text{SoC Llegada}}{100}\right)$<br>$\text{Potencia Efectiva (kW)} = \min(\text{Potencia Cargador}, \text{Potencia Máx VE})$<br>$\text{Tiempo (min)} = \left(\frac{\text{Energía a Cargar}}{\text{Potencia Efectiva}}\right) \times 60$ |
| **RN06** | **Tarificación** | $\text{Costo Parada (CLP)} = \text{Energía a Cargar (kWh)} \times \text{Tarifa Estación (CLP/kWh)}$ |

---

## 🚗 Catálogo Inicial

### 1. Vehículos Eléctricos (RF06)
19 modelos reales comercializados en el mercado chileno, entre ellos:

1. **Tesla Model 3 / Model Y Long Range**: 75 kWh útiles, 14.5 / 15.7 kWh/100km, 250 kW máx, CCS2.
2. **BYD Dolphin / Seal / Atto 3**: 44.9 / 82.5 / 60.5 kWh útiles, 13.0 / 15.2 / 15.6 kWh/100km, CCS2.
3. **Hyundai Kona Electric / Ioniq 5**: 64 / 72.6 kWh útiles, 14.7 / 16.8 kWh/100km, CCS2.
4. **Kia EV6**: 77.4 kWh útiles, 16.5 kWh/100km, 240 kW máx, CCS2.
5. **Nissan Leaf e+**: 59 kWh útiles, 17.1 kWh/100km, 50 kW máx, CHAdeMO.
6. **MG ZS EV / MG4**, **Renault Mégane E-Tech**, **Peugeot e-208**, **Citroën ë-C4**, **Volvo EX30**, **BMW iX1**, **Chevrolet Bolt EUV**, **Ford Mustang Mach-E** y **Audi Q4 e-tron**.

El catálogo es editable por administradores y se filtra por marca, conector,
batería mínima y potencia mínima desde `GET /api/vehiculos`.

### 2. Red de Electrolineras en Ruta 5 (RF07)
17 estaciones verificadas entre Santiago y Puerto Montt:
- **Santiago** (Copec Voltex 150 kW, Enel X Way 50 kW)
- **Rancagua** (ENEX e-drive 50 kW), **San Fernando** (Copec Voltex 100 kW)
- **Curicó** (Shell Recharge 100 kW), **Talca** (Shell Recharge 150 kW)
- **Linares** (ENEX e-drive 60 kW), **Chillán** (Copec Voltex 100 kW)
- **Concepción** (Copec Voltex 150 kW), **Los Ángeles** (ENEX e-drive 60 kW)
- **Temuco** (Copec Voltex 150 kW, Shell Recharge 100 kW), **Villarrica** (ENEX e-drive 60 kW)
- **Valdivia** (Shell Recharge 100 kW), **Osorno** (Copec Voltex 100 kW)
- **Puerto Montt** (Copec Voltex 100 kW, Enel X Way 50 kW)

Se filtran por ciudad, región, operador, conector y potencia desde
`GET /api/estaciones`.

---

## 🔌 API RESTful y Ejemplos de Uso

### Endpoints Disponibles

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `POST` | `/api/routes/plan` | Planificador geográfico: geometría, paradas, batería, costos y advertencias |
| `POST` | `/api/calcular-ruta` | Endpoint v1 de cálculo determinista sobre el grafo mock (compatibilidad) |
| `GET` | `/api/vehiculos` | Catálogo de VE con filtros `marca`, `conector`, `bateriaMin`, `potenciaMin` |
| `GET` | `/api/estaciones` | Estaciones con filtros `ciudad`, `region`, `operador`, `conector`, `potenciaMin` |
| `GET` | `/api/estaciones/fuente` | Metadatos y fecha de actualización de la fuente SEC EcoCarga (RF10) |
| `GET` | `/api/ciudades` | Ciudades disponibles en la red Ruta 5 |
| `GET` | `/api/health` | Health check con versión, uptime y request ID |
| `GET` | `/api/ready` | Readiness: estado del almacén y configuración de ruteo |
| `POST` | `/api/auth/register` | Crea una cuenta (`nombre`, `email`, `password`) y entrega JWT |
| `POST` | `/api/auth/login` | Inicia sesión y entrega JWT |
| `GET` | `/api/auth/me` | Devuelve el perfil de la sesión (Bearer) |
| `PUT` | `/api/perfil` | Actualiza nombre y vehículo habitual (Bearer) |
| `GET`/`POST` | `/api/viajes` | Historial de viajes guardados del usuario (Bearer) |
| `GET`/`DELETE` | `/api/viajes/:id` | Consulta o elimina un viaje propio (Bearer) |
| `GET`/`POST` | `/api/favoritos` | Lista o agrega vehículos/estaciones favoritas (Bearer) |
| `DELETE` | `/api/favoritos/:id` | Elimina un favorito propio (Bearer) |
| `GET`/`POST` | `/api/admin/vehiculos` | Lista (incluye inactivos) y crea vehículos (admin) |
| `PUT`/`DELETE` | `/api/admin/vehiculos/:id` | Edita o desactiva un vehículo (admin) |
| `GET`/`POST` | `/api/admin/estaciones` | Lista (incluye no disponibles) y crea estaciones (admin) |
| `PUT`/`DELETE` | `/api/admin/estaciones/:id` | Edita o desactiva una estación (admin) |
| `POST` | `/api/admin/estaciones/sync-sec` | Ingesta, validación y deduplicación atómica SEC EcoCarga (admin) |
| `GET` | `/api/admin/auditoria` | Registro de acciones administrativas (admin) |

El modo invitado está permitido en planificación y catálogo; guardar viajes y
favoritos requiere sesión. Las bajas de catálogo son lógicas (`activo=false`,
`disponible=false`) y cada mutación queda auditada.

### Ejemplo: Cálculo de Ruta Santiago → Temuco

**Petición (`POST /api/calcular-ruta`):**
```json
{
  "origenId": "santiago",
  "destinoId": "temuco",
  "vehiculoId": "tesla_model3_lr",
  "socInicial": 90
}
```

**Respuesta (`200 OK`):**
```json
{
  "exito": true,
  "vehiculo": {
    "id": "tesla_model3_lr",
    "modelo": "Tesla Model 3 Long Range",
    "bateriaUtilizable_kWh": 75
  },
  "origen": { "id": "santiago", "nombre": "Santiago" },
  "destino": { "id": "temuco", "nombre": "Temuco" },
  "resumen": {
    "distanciaTotal_km": 669,
    "tiempoConduccionTotal_min": 442,
    "tiempoCargaTotal_min": 48,
    "tiempoTotalViaje_min": 490,
    "costoTotal_CLP": 19090,
    "socFinal": 51.58,
    "cantidadParadas": 2,
    "vehiculoUsado": "Tesla Model 3 Long Range"
  },
  "paradas": [
    {
      "orden": 1,
      "estacionId": "sta_talca_shell",
      "estacionNombre": "Shell Recharge Talca",
      "ciudad": "Talca",
      "operador": "Shell Recharge",
      "conectorUsado": "CCS2",
      "potenciaEfectiva_kW": 150,
      "socLlegada": 34.32,
      "socSalida": 80,
      "energiaCargada_kWh": 34.26,
      "tiempoCarga_min": 14,
      "costo_CLP": 9250
    },
    {
      "orden": 2,
      "estacionId": "sta_losangeles_enex",
      "estacionNombre": "ENEX e-drive Los Ángeles",
      "ciudad": "Los Ángeles",
      "operador": "ENEX e-drive",
      "conectorUsado": "CCS2",
      "potenciaEfectiva_kW": 60,
      "socLlegada": 34.76,
      "socSalida": 80,
      "energiaCargada_kWh": 33.93,
      "tiempoCarga_min": 34,
      "costo_CLP": 9840
    }
  ]
}
```

---

## 🚀 Instalación y Puesta en Marcha

### Prerrequisitos
- [Node.js](https://nodejs.org/) v18.0.0 o superior
- [npm](https://www.npmjs.com/) v9.0.0 o superior

### 1. Clonar el repositorio
```bash
git clone https://github.com/Matias449/electravelin.git
cd electravelin
```

### 2. Configurar y Ejecutar el Backend
```bash
cd server
npm install
cp .env.example .env
npm run dev
```
El servidor backend se iniciará en `http://localhost:3001`. En `.env` define al
menos `JWT_SECRET`; si quieres un administrador inicial, agrega `ADMIN_EMAIL` y
`ADMIN_PASSWORD` (se crea con rol admin al arrancar si no existe). Para probar
el ruteo real agrega `ORS_API_KEY`.

### 3. Configurar y Ejecutar el Frontend
En otra ventana de terminal:
```bash
cd client
npm install
npm run dev
```
La aplicación web estará disponible en `http://localhost:5173` (o `http://localhost:5174` si el puerto 5173 estuviera ocupado).

### 4. Pruebas
```bash
cd server
npm test        # 30 pruebas de servicios y API con node:test
```

---

## 💾 Datos, Cuentas y Persistencia

En desarrollo el backend usa un almacén JSON local (`server/data/electravelin.json`,
ignorado por Git) sembrado desde `server/src/data/`. Guarda usuarios, viajes,
favoritos, auditoría y las ediciones del catálogo; es suficiente para trabajar
sin servicios externos.

Para producción el esquema relacional está en `supabase/migrations/`:

```bash
supabase db push                 # aplica migraciones (profiles, catálogo, viajes, favoritos, auditoría + RLS)
supabase db execute -f supabase/seed.sql   # carga el catálogo inicial
```

Las políticas RLS garantizan que cada usuario solo acceda a sus viajes y
favoritos, el catálogo público solo muestre registros activos y las escrituras
administrativas queden restringidas al rol admin. El backend firma JWT HS256
compatibles con `JWT_SECRET` (en Supabase, usa el JWT secret del proyecto).

---

## ☁️ Despliegue

`render.yaml` describe el despliegue recomendado: el API Node en Render (con
health check en `/api/ready`) y el cliente estático con rewrite `/api/*` hacia el
API. En Vercel puedes publicar solo el cliente con `client/vercel.json`,
reemplazando la URL de destino por la de tu API.

Variables de entorno del backend documentadas en `server/.env.example`:

| Variable | Uso |
| :--- | :--- |
| `PORT` | Puerto del API (por defecto 3001) |
| `JWT_SECRET` | Firma de tokens; obligatorio en producción |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Bootstrap opcional del administrador |
| `DATA_FILE` | Ruta del almacén JSON local |
| `LOG_LEVEL` | `debug`, `info`, `warn` o `error` |
| `ORS_API_KEY` | Clave privada de OpenRouteService (solo backend) |
| `ORS_BASE_URL` / `NOMINATIM_BASE_URL` / `NOMINATIM_USER_AGENT` | Overrides de proveedores |

Los logs son JSON estructurado con request ID y redacción de campos sensibles
(`password`, `token`, `authorization`, `api_key`); nunca registran cuerpos ni
claves.

---

## 🔮 Lo que falta por implementar (Roadmap & Próximos Pasos)

Esta versión corresponde al **MVP v2**. Para llevar la aplicación a un nivel de producción comercial (*ready-for-market*), se contemplan las siguientes fases de desarrollo:

### 1. 🗺️ Cartografía y Georreferenciación Real
- [x] **Mapa Leaflet con polilínea, marcadores y zoom automático** (`RouteMap.jsx`).
- [x] **Geocodificación con Nominatim** desde el backend (sin exponer claves al cliente).
- [x] **Ruteo dinámico con OpenRouteService** para distancia y duración reales.
- [ ] **Geocodificación de direcciones exactas** (Google Places / Mapbox) más allá de localidades.
- [ ] **Ruteo con tráfico** en tiempo real.

### 2. ⚡ Red de Carga en Tiempo Real
- [ ] **Integración con Open Charge Map y APIs de Operadores:** Consulta en tiempo real de disponibilidad de conectores libres/ocupados de Copec Voltex, Shell Recharge y Enel X Way.
- [ ] **Registro de Tarifas Dinámicas:** Actualización automática de tarifas en hora punta / valle según la estación.
- [ ] **Reportes Comunitarios:** Permitir a los usuarios reportar cargadores fuera de servicio, filas de espera o fallas de comunicación.

### 3. 📉 Modelo Físico y Ambiental de Consumo Avanzado
- [ ] **Impacto Topográfico (Elevación y Pendientes):** Modelar el gasto extra al subir cuestas pronunciadas (ej. Cuesta Las Chilcas o subida a túneles) y la **regeneración de energía por frenado cinético** en descensos.
- [ ] **Meteorología y Temperatura Ambiente:** Ajustar la degradación de autonomía por temperaturas extremas (frío en el sur de Chile o calor en el norte) y el impacto del uso de climatización (A/C o calefacción).
- [ ] **Curva de Carga no Lineal (BMS Real):** En la vida real, los VE cargan a máxima potencia entre 10% y 50%, disminuyendo drásticamente a partir del 70-80%. Implementar curvas de carga polinómicas por modelo de vehículo para mayor precisión de tiempos.

### 4. 💾 Persistencia y Base de Datos
- [x] **Esquema, migraciones y seed para Supabase** con RLS, perfiles, historial y favoritos (`supabase/`).
- [x] **Autenticación JWT, roles y modo invitado** en el backend local.
- [ ] **Migración a PostgreSQL + PostGIS:** Consultas por radio (`ST_DWithin`) sobre el trazado real de la ruta.
- [ ] **Conectar el frontend directamente a Supabase Auth** (hoy usa la API propia).

### 5. 📱 Experiencia Móvil y Modos Offline
- [ ] **PWA (Progressive Web App):** Instalación como app en iOS/Android con caché offline para tramos de la Ruta 5 con mala señal de telefonía celular.
- [ ] **Alertas y Notificaciones Push:** Recordatorios para desenchufar al llegar al 80% y evitar cobros por minuto de ocupación indebida.

---

## 🛠️ Tecnologías Empleadas

- **Frontend:** React 18, Vite, Leaflet 1.9, CSS con variables personalizadas (design system dark futurista y glassmorphism), contexto de autenticación y cliente HTTP con token.
- **Backend:** Node.js 18+, Express, CORS, arquitectura por capas (controladores, servicios, rutas, middleware), JWT HS256 y hash scrypt sin dependencias externas, logging JSON estructurado con request IDs.
- **Datos:** almacén JSON local inyectable para desarrollo; migraciones y seed de Supabase (PostgreSQL + RLS) para producción.
- **Algoritmos:** Cálculo de consumo energético determinista, reserva crítica de batería, proyección de estaciones sobre el trazado y priorización de potencia efectiva.
- **Pruebas:** `node:test` para servicios y contrato HTTP (30 casos).

---

## 📄 Licencia

Este proyecto está bajo la Licencia [MIT](https://opensource.org/licenses/MIT).

## Ejecucion local actualizada

El flujo recomendado para levantar el sistema es:

```powershell
cd server
npm install
Copy-Item .env.example .env
npm test
$env:PORT = "3001"
node src/index.js
```

En otra terminal:

```powershell
cd client
npm install
npm run dev -- --host 127.0.0.1
```

Abre `http://127.0.0.1:5173`. El proxy de Vite envia `/api` al backend en el
puerto 3001. Si ese puerto esta ocupado, inicia el backend con otro `PORT` y
ejecuta el cliente con `API_PROXY_TARGET=http://127.0.0.1:<puerto> npm run dev`.

### Proveedores de mapa y ruteo

- OSRM se usa automaticamente cuando no existe `ORS_API_KEY`; no requiere clave
  para desarrollo local ligero.
- OpenRouteService se usa cuando existe `ORS_API_KEY`, o se fuerza con
  `ROUTING_PROVIDER=openrouteservice`.
- Nominatim resuelve nombres de ciudades desde el backend.
- Leaflet dibuja la geometria GeoJSON, marcadores y ajuste automatico del mapa.

Variables relevantes: `ROUTING_PROVIDER`, `OSRM_BASE_URL`, `ORS_API_KEY`,
`ORS_BASE_URL`, `NOMINATIM_BASE_URL` y `NOMINATIM_USER_AGENT`. Las claves solo
deben existir en el backend y nunca en el cliente.

Validacion minima antes de integrar:

```powershell
cd server; npm test
cd ..\client; npm run build
```
