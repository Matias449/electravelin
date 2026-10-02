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
├── .gitignore                       # Filtro de exclusión para Git (node_modules, envs, etc.)
├── README.md                        # Documentación técnica integral
│
├── server/                          # Backend API REST (Node.js + Express)
│   ├── package.json
│   ├── .env.example                 # Variables de entorno requeridas
│   └── src/
│       ├── index.js                 # Servidor Express, middlewares (CORS, JSON) y logging
│       ├── controllers/
│       │   └── routeController.js   # Orquestador del cálculo de ruta y validaciones (RF01-RF05)
│       ├── routes/
│       │   └── routeRoutes.js       # Definición de endpoints REST (/api/...)
│       ├── services/
│       │   └── batteryService.js    # Motor determinista de cálculo de batería (RN01-RN06)
│       └── data/                    # Base de datos Mock en formato JSON (Fase Inicial)
│           ├── vehicles.json        # Catálogo de 5 VE representativos en Chile (RF06)
│           ├── stations.json        # 9 estaciones de carga en la Ruta 5 (RF07)
│           └── mockRoutes.json      # Grafo lineal de tramos y ciudades (Santiago ↔ Puerto Montt)
│
└── client/                          # Frontend SPA (React 18 + Vite)
    ├── package.json
    ├── vite.config.js               # Configuración Vite con proxy hacia API backend (:3001)
    ├── index.html                   # HTML semántico, fuentes Google (Outfit + Inter) y meta SEO
    └── src/
        ├── main.jsx                 # Bootstrap de React en el DOM
        ├── App.jsx                  # Layout principal y coordinación de estado
        ├── index.css                # Sistema de diseño (Dark futurista, Glassmorphism, CSS Tokens)
        ├── components/
        │   ├── Header.jsx           # Identidad visual y encabezado
        │   ├── PlanningForm.jsx     # Formulario reactivo con validaciones inline y anti-doble clic
        │   ├── RouteResults.jsx     # Dashboard de resultados (resumen global, timeline y errores)
        │   ├── StopCard.jsx         # Tarjeta detallada de cada parada de recarga recomendada
        │   └── MapPlaceholder.jsx   # Contenedor estilizado para mapas (preparado para Leaflet/Maps)
        └── utils/
            └── api.js               # Cliente HTTP fetch para consumir la API REST
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

## 🚗 Catálogo Mock Inicial

### 1. Vehículos Eléctricos (RF06)
Modelos reales comercializados actualmente en el mercado chileno:
1. **Tesla Model 3 Long Range**: 75 kWh batería útil, 14.5 kWh/100km, 250 kW máx, conector CCS2.
2. **BYD Dolphin**: 44.9 kWh batería útil, 13.0 kWh/100km, 60 kW máx, conector CCS2.
3. **Hyundai Kona Electric**: 64.0 kWh batería útil, 14.7 kWh/100km, 77 kW máx, conector CCS2.
4. **Nissan Leaf e+**: 59.0 kWh batería útil, 17.1 kWh/100km, 50 kW máx, conector CHAdeMO.
5. **MG ZS EV Long Range**: 50.3 kWh batería útil, 17.0 kWh/100km, 76 kW máx, conector CCS2.

### 2. Red de Electrolineras en Ruta 5 (RF07)
Estaciones estratégicas ubicadas en:
- **Santiago** (Copec Voltex, 150 kW, CCS2/CHAdeMO)
- **Rancagua** (ENEX e-drive, 50 kW, CCS2)
- **San Fernando** (Copec Voltex, 100 kW, CCS2)
- **Talca** (Shell Recharge, 150 kW, CCS2/CHAdeMO)
- **Chillán** (Copec Voltex, 100 kW, CCS2)
- **Los Ángeles** (ENEX e-drive, 60 kW, CCS2/CHAdeMO)
- **Temuco** (Copec Voltex, 150 kW, CCS2)
- **Valdivia** (Shell Recharge, 100 kW, CCS2/CHAdeMO)
- **Puerto Montt** (Copec Voltex, 100 kW, CCS2)

---

## 🔌 API RESTful y Ejemplos de Uso

### Endpoints Disponibles

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `POST` | `/api/calcular-ruta` | Endpoint principal de cálculo de ruta y simulación energética |
| `GET` | `/api/vehiculos` | Obtiene el catálogo completo de VE |
| `GET` | `/api/ciudades` | Obtiene el listado de ciudades disponibles en la red |
| `GET` | `/api/estaciones` | Lista todas las estaciones de carga y sus especificaciones |
| `GET` | `/api/health` | Health check del estado del servidor |

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
npm run dev
```
El servidor backend se iniciará en `http://localhost:3001`.

### 3. Configurar y Ejecutar el Frontend
En otra ventana de terminal:
```bash
cd client
npm install
npm run dev
```
La aplicación web estará disponible en `http://localhost:5173` (o `http://localhost:5174` si el puerto 5173 estuviera ocupado).

---

## 🔮 Lo que falta por implementar (Roadmap & Próximos Pasos)

Esta versión corresponde al **MVP determinista**. Para llevar la aplicación a un nivel de producción comercial (*ready-for-market*), se contemplan las siguientes fases de desarrollo:

### 1. 🗺️ Cartografía y Georreferenciación Real
- [ ] **Sustitución del MapPlaceholder por Leaflet / Mapbox GL:** Renderizado de la Ruta 5 con polilíneas interactivas, marcadores personalizados para electrolineras y cálculo de zoom automático.
- [ ] **Geocodificación y Direcciones Arbitrarias:** Integrar APIs como Google Places o Mapbox Geocoding para permitir que el usuario ingrese direcciones exactas (ej. "Av. Providencia 123, Santiago") y no solo nombres de ciudades fijas.
- [ ] **Ruteo dinámico con OSRM / Google Directions:** Cálculo de distancia real basada en el tráfico y condiciones de vía.

### 2. ⚡ Red de Carga en Tiempo Real
- [ ] **Integración con Open Charge Map y APIs de Operadores:** Consulta en tiempo real de disponibilidad de conectores libres/ocupados de Copec Voltex, Shell Recharge y Enel X Way.
- [ ] **Registro de Tarifas Dinámicas:** Actualización automática de tarifas en hora punta / valle según la estación.
- [ ] **Reportes Comunitarios:** Permitir a los usuarios reportar cargadores fuera de servicio, filas de espera o fallas de comunicación.

### 3. 📉 Modelo Físico y Ambiental de Consumo Avanzado
- [ ] **Impacto Topográfico (Elevación y Pendientes):** Modelar el gasto extra al subir cuestas pronunciadas (ej. Cuesta Las Chilcas o subida a túneles) y la **regeneración de energía por frenado cinético** en descensos.
- [ ] **Meteorología y Temperatura Ambiente:** Ajustar la degradación de autonomía por temperaturas extremas (frío en el sur de Chile o calor en el norte) y el impacto del uso de climatización (A/C o calefacción).
- [ ] **Curva de Carga no Lineal (BMS Real):** En la vida real, los VE cargan a máxima potencia entre 10% y 50%, disminuyendo drásticamente a partir del 70-80%. Implementar curvas de carga polinómicas por modelo de vehículo para mayor precisión de tiempos.

### 4. 💾 Persistencia y Base de Datos
- [ ] **Migración a PostgreSQL + PostGIS:** Reemplazar los archivos JSON mock por una base de datos relacional y geoespacial que permita consultas por radio (`ST_DWithin`) a lo largo del trazado de la ruta.
- [ ] **Autenticación de Usuarios (JWT / Auth0 / Supabase):** Cuentas de usuario para almacenar vehículos favoritos, SoC habitual y bitácora histórica de viajes realizados.

### 5. 📱 Experiencia Móvil y Modos Offline
- [ ] **PWA (Progressive Web App):** Instalación como app en iOS/Android con caché offline para tramos de la Ruta 5 con mala señal de telefonía celular.
- [ ] **Alertas y Notificaciones Push:** Recordatorios para desenchufar al llegar al 80% y evitar cobros por minuto de ocupación indebida.

---

## 🛠️ Tecnologías Empleadas

- **Frontend:** React 18, Vite, CSS Modules / Vanilla CSS con variables personalizadas (Design System exclusivo con estética dark futurista y glassmorphism).
- **Backend:** Node.js, Express, CORS, arquitectura por capas (Controladores, Servicios, Rutas).
- **Algoritmos:** Cálculo de consumo energético determinista, gestión de reserva crítica y priorización de potencia efectiva.

---

## 📄 Licencia

Este proyecto está bajo la Licencia [MIT](https://opensource.org/licenses/MIT).
