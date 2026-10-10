# Bitácora individual — Patricio Acevedo

**Nombre integrante 3:** Patricio Acevedo  
**Objetivo trabajado:** Líder de Datos — Catálogo VE y Electrolineras; apoyo a Presupuesto (2.3) y Plan de Pruebas (2.4).

## Compromisos y seguimiento

| Objetivo a cargo | Descripción del compromiso | Fecha de término comprometida | Observación |
| --- | --- | --- | --- |
| Catálogo de Datos (Tareas 73 y 75) | 10 modelos VE y 25+ electrolineras Ruta 5 normalizadas. | Próxima reunión | Avance parcial: catálogo enriquecido y servicio SEC/EcoCarga integrado; falta validar cobertura y datos operativos. |
| Normalización BD y validación SEC (77 y 107) | Carga de BD persistente y contraste de muestra con datos oficiales SEC. | Próxima reunión | En progreso: normalización, caché y pruebas de integración disponibles; falta contraste manual de la muestra y cierre de disponibilidad. |

## ¿Qué hizo la semana pasada?

- Investigó y conectó el catálogo público SEC / EcoCarga para incluir dirección, comuna, región, coordenadas, equipos, conectores, potencia y estado declarado.
- Implementó la compatibilidad entre conectores de la electrolinera y los del vehículo seleccionado.
- Mejoró el catálogo local con mayor precisión de dirección y procedencia verificable, preservando un respaldo de los datos anteriores.
- Apoyó la preparación del Plan de Pruebas (2.4) con pruebas de normalización, deduplicación, importación atómica, API y build de frontend.
- Identificó componentes a estimar para Presupuesto (2.3): operación backend, consulta/caché de datos, hosting frontend y mantenimiento del catálogo.

## ¿Qué problemas enfrentó?

- Las electrolineras inicialmente contenían principalmente comuna, sin dirección ni ficha técnica suficiente.
- Las fuentes abiertas entregan conectores, estados y potencia con formatos heterogéneos, registros repetidos y datos incompletos.
- La disponibilidad de cada equipo requiere contraste antes de declararla apta para una recomendación definitiva.
- Algunos modelos 3D genéricos no representaban fielmente a los vehículos.

## ¿Cómo resolvió el problema?

- Incorporó un servicio de normalización SEC/EcoCarga, con caché de dos minutos y fuente explícita, sin rellenar datos ausentes.
- Normalizó conectores, consolidó registros equivalentes y preservó el último conjunto válido si falla una importación.
- Ajustó la UI para presentar dirección, equipos, potencia, conectores, estado y compatibilidad.
- Aplicó `tieneModelo3D` para exhibir un visor sólo cuando existe un modelo validado.

## ¿Qué va a hacer la próxima semana?

- Contrastar una muestra de estaciones con la fuente oficial SEC y operadores, y completar la cobertura de direcciones.
- Completar la estimación de Presupuesto (2.3) por infraestructura, fuentes de datos, operación y contingencia.
- Ampliar el Plan de Pruebas (2.4) con compatibilidad, indisponibilidad, respuestas incompletas SEC y navegación por URL.
- Cerrar la validación de la red de carga antes de moverla a *In Review* en el Kanban.
