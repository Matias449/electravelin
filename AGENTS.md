# Electravelin — guía de colaboración


## /Run: ejecucion local

Cuando una tarjeta indique `/Run`, ejecutar la validacion integral local:

```powershell
cd server
npm test
$env:PORT = "3001"
node src/index.js
```

En otra terminal:

```powershell
cd client
npm run build
npm run dev -- --host 127.0.0.1
```

Verificar `GET /api/ready` y una peticion `POST /api/routes/plan`. Sin
`ORS_API_KEY`, el backend selecciona OSRM automaticamente. Si el puerto 3001
esta ocupado, usar otro `PORT` y definir `API_PROXY_TARGET` para Vite.
Nunca agregar claves, tokens, logs locales ni archivos `.env` al commit.
## Flujo de trabajo

- `main` se reserva para integración. Cada tarjeta se desarrolla en una rama con
  prefijo `feat/`, `fix/` o `chore/` y, cuando corresponda, en su worktree.
- Antes de integrar, ejecutar las pruebas pertinentes, el build y dejar un
  resumen de validación.
- Dependencias compartidas, lockfiles, configuración de despliegue y migraciones
  consolidadas se integran únicamente desde `main`.
- Orden de integración: `data-auth` → `routing-map` → `frontend-planner` →
  `catalog-admin` → `observability-deploy`.

## Seguridad y datos

- Nunca versionar secretos ni exponer claves de proveedores en el cliente.
- Las integraciones externas se llaman desde el backend mediante variables de
  entorno; documentar cada variable en `server/.env.example`.
- Mantener los contratos de API compatibles o documentar una migración.

## Producto y calidad

- RF08–RF10 y RF19 están formalizados según el Documento de Requerimientos
  (Entrega 2) e implementados: validación geográfica Chile y conectores (RF08),
  deduplicación y normalización (RF09), procedencia SEC/EcoCarga atómica (RF10)
  y manejo seguro ante fallas de proveedores externos (RF19).
- RF16 exige mapa real, trazado, marcadores y zoom automático (Leaflet).
- Toda funcionalidad nueva debe incluir casos de éxito, error y comportamiento
  ante cobertura insuficiente cuando aplique.
