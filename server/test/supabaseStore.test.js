const test = require('node:test');
const assert = require('node:assert/strict');
const { createSupabaseStore } = require('../src/services/supabaseStore');
const { createApp } = require('../src/index');
const { createLogger } = require('../src/services/logger');
const seedVehicles = require('../src/data/vehicles.json');
const seedStations = require('../src/data/stations.json');
const { silentLogger, withServer, request, registerUser } = require('../test-utils/helpers');

const URL_PRUEBA = 'https://proyecto-prueba.supabase.co';
const CLAVE_PRUEBA = 'clave-service-role-de-prueba';

function porId(a, b) {
  return a.id.localeCompare(b.id);
}

function valorFiltro(valor) {
  if (valor === null) return null;
  if (!valor.startsWith('eq.')) throw new Error(`Filtro no soportado: ${valor}`);
  return valor.slice(3);
}

/**
 * PostgREST simulado en memoria: GET paginado (order/limit/offset), POST upsert
 * con on_conflict y Prefer, y DELETE con filtros eq. Responde 401 sin claves y
 * 400 ante un DELETE sin filtro, como el servicio real.
 */
function createFakePostgrest({ filas = [], retardoEscrituraMs = 0 } = {}) {
  const tabla = new Map();
  const reglasFallo = [];
  const registro = [];
  for (const fila of filas) tabla.set(`${fila.collection}\u0000${fila.id}`, { ...fila });

  async function esperarEscritura() {
    if (retardoEscrituraMs) await new Promise((resolve) => setTimeout(resolve, retardoEscrituraMs));
  }

  async function fetchImpl(input, init = {}) {
    const url = new URL(input);
    const metodo = (init.method || 'GET').toUpperCase();
    const headers = new Headers(init.headers || {});
    if (headers.get('apikey') !== CLAVE_PRUEBA || headers.get('authorization') !== `Bearer ${CLAVE_PRUEBA}`) {
      return new Response('{"message":"JWT inválido"}', { status: 401 });
    }
    const indice = reglasFallo.findIndex((regla) => regla.metodo === metodo);
    if (indice !== -1) {
      const [regla] = reglasFallo.splice(indice, 1);
      return new Response(regla.texto, { status: regla.status });
    }

    if (metodo === 'GET') {
      const limite = Number(url.searchParams.get('limit'));
      const desplazamiento = Number(url.searchParams.get('offset') || 0);
      if (!limite || url.searchParams.get('order') !== 'collection.asc,id.asc') {
        return new Response('orden o límite faltante', { status: 400 });
      }
      const pagina = [...tabla.values()]
        .sort((a, b) => a.collection.localeCompare(b.collection) || a.id.localeCompare(b.id))
        .slice(desplazamiento, desplazamiento + limite)
        .map(({ collection, id, data }) => ({ collection, id, data: structuredClone(data) }));
      return Response.json(pagina);
    }

    if (metodo === 'POST') {
      if (url.searchParams.get('on_conflict') !== 'collection,id' || !String(headers.get('prefer')).includes('resolution=merge-duplicates')) {
        return new Response('upsert mal formado', { status: 400 });
      }
      const body = JSON.parse(init.body);
      await esperarEscritura();
      for (const fila of body) {
        tabla.set(`${fila.collection}\u0000${fila.id}`, { collection: fila.collection, id: fila.id, data: structuredClone(fila.data) });
      }
      registro.push({ metodo, colecciones: [...new Set(body.map((fila) => fila.collection))] });
      return new Response(null, { status: 201 });
    }

    if (metodo === 'DELETE') {
      const coleccion = valorFiltro(url.searchParams.get('collection'));
      const id = valorFiltro(url.searchParams.get('id'));
      if (!coleccion) return new Response('DELETE sin filtro', { status: 400 });
      await esperarEscritura();
      for (const [clave, fila] of tabla) {
        if (fila.collection === coleccion && (id === null || fila.id === id)) tabla.delete(clave);
      }
      registro.push({ metodo, colecciones: [coleccion] });
      return new Response(null, { status: 204 });
    }

    return new Response('método no soportado', { status: 405 });
  }

  return {
    fetchImpl,
    registro,
    fallarUna(metodo, status, texto) {
      reglasFallo.push({ metodo, status, texto });
    },
    filas(coleccion) {
      return [...tabla.values()]
        .filter((fila) => fila.collection === coleccion)
        .map((fila) => structuredClone(fila.data))
        .sort(porId);
    },
    cantidadEscrituras(metodo, coleccion) {
      return registro.filter((e) => e.metodo === metodo && e.colecciones.includes(coleccion)).length;
    },
  };
}

function crearAlmacen(fake, { seed = {}, logger = silentLogger() } = {}) {
  return createSupabaseStore({
    url: `${URL_PRUEBA}/`,
    serviceRoleKey: CLAVE_PRUEBA,
    seed,
    fetchImpl: fake.fetchImpl,
    logger,
  });
}

function capturarLogs() {
  const registros = [];
  const logger = createLogger({ level: 'error', stream: { write: (linea) => registros.push(JSON.parse(linea)) } });
  return { logger, registros };
}

test('carga las filas existentes y siembra solo las colecciones vacías', async () => {
  const fake = createFakePostgrest({
    filas: [
      { collection: 'users', id: 'u1', data: { id: 'u1', nombre: 'Ana', email: 'ana@ev.cl' } },
      { collection: 'users', id: 'u2', data: { nombre: 'Beto', email: 'beto@ev.cl' } },
      { collection: 'trips', id: 't1', data: { id: 't1', origen: 'Santiago' } },
    ],
  });
  const store = crearAlmacen(fake, { seed: { vehicles: seedVehicles, stations: seedStations } });

  await store.ready();

  assert.deepEqual(store.all('users').map((u) => u.id), ['u1', 'u2']);
  assert.equal(store.findById('users', 'u2').id, 'u2');
  assert.equal(store.findById('trips', 't1').origen, 'Santiago');
  assert.equal(store.all('vehicles').length, seedVehicles.length);
  assert.equal(store.all('favorites').length, 0);
  assert.deepEqual(fake.filas('vehicles').map((v) => v.id).sort(), seedVehicles.map((v) => v.id).sort());
  assert.equal(fake.filas('trips').length, 1);
});

test('no vuelve a sembrar una colección que ya tiene filas remotas', async () => {
  const fake = createFakePostgrest();
  const seed = { vehicles: seedVehicles };

  await crearAlmacen(fake, { seed }).ready();
  assert.equal(fake.cantidadEscrituras('POST', 'vehicles'), 1);

  const segunda = crearAlmacen(fake, { seed });
  await segunda.ready();
  assert.equal(fake.cantidadEscrituras('POST', 'vehicles'), 1);
  assert.equal(segunda.all('vehicles').length, seedVehicles.length);
});

test('pagina la carga cuando hay más filas que una página', async () => {
  const filas = Array.from({ length: 2150 }, (_, i) => ({
    collection: 'audit',
    id: `a${String(i).padStart(5, '0')}`,
    data: { id: `a${String(i).padStart(5, '0')}`, accion: 'x' },
  }));
  const fake = createFakePostgrest({ filas });
  const store = crearAlmacen(fake);

  await store.ready();

  assert.equal(store.all('audit').length, 2150);
});

test('insert, update, remove y replace llegan en orden tras flush', async () => {
  const fake = createFakePostgrest({
    filas: [
      { collection: 'users', id: 'u1', data: { id: 'u1', nombre: 'Ana' } },
      { collection: 'favorites', id: 'f0', data: { id: 'f0', userId: 'u1' } },
    ],
  });
  const store = crearAlmacen(fake);
  await store.ready();

  store.insert('trips', { id: 't1', origen: 'Santiago', destino: 'Temuco' });
  store.update('trips', 't1', { destino: 'Valdivia' });
  store.insert('trips', { id: 't2', origen: 'Talca' });
  store.remove('trips', 't2');
  store.replace('favorites', [{ id: 'f1', userId: 'u1' }, { id: 'f2', userId: 'u2' }]);
  await store.flush();

  assert.deepEqual(fake.filas('trips'), store.all('trips').sort(porId));
  assert.deepEqual(fake.filas('trips').map((t) => t.id), ['t1']);
  assert.equal(fake.filas('trips')[0].destino, 'Valdivia');
  assert.deepEqual(fake.filas('favorites').map((f) => f.id), ['f1', 'f2']);
});

test('flush rechaza tras una escritura fallida y las siguientes siguen llegando', async () => {
  const fake = createFakePostgrest();
  const { logger, registros } = capturarLogs();
  const store = crearAlmacen(fake, { logger });
  await store.ready();

  fake.fallarUna('POST', 500, 'error simulado');
  store.insert('trips', { id: 'a', origen: 'Fallida' });
  store.insert('trips', { id: 'b', origen: 'Ok' });

  await assert.rejects(store.flush(), /Supabase respondió 500 en POST app_documents: error simulado/);
  assert.ok(registros.some((r) => r.msg === 'supabase_write_failed' && r.id === 'a'));

  store.insert('trips', { id: 'c', origen: 'Ok 2' });
  await store.flush();

  assert.deepEqual(fake.filas('trips').map((t) => t.id), ['b', 'c']);
  // La falla se reporta una sola vez: tras el rechazo el estado queda limpio.
  await store.flush();
});

test('ready reintenta tras una carga fallida', async () => {
  const fake = createFakePostgrest({
    filas: [{ collection: 'users', id: 'u1', data: { id: 'u1', nombre: 'Ana' } }],
  });
  fake.fallarUna('GET', 503, 'no disponible');
  const store = crearAlmacen(fake);

  await assert.rejects(store.ready(), /No se pudo cargar el almacén desde Supabase/);
  await store.ready();

  assert.equal(store.findById('users', 'u1').nombre, 'Ana');
});

test('las escrituras antes de ready se rechazan para no perder datos al cargar', async () => {
  const fake = createFakePostgrest();
  const store = crearAlmacen(fake);

  assert.throws(() => store.insert('users', { id: 'u9' }), /aún no está cargado/);
  await store.ready();
  assert.equal(store.findById('users', 'u9'), null);
});

test('las lecturas y los objetos devueltos son copias', async () => {
  const fake = createFakePostgrest({
    filas: [{ collection: 'users', id: 'u1', data: { id: 'u1', nombre: 'Ana' } }],
  });
  const store = crearAlmacen(fake);
  await store.ready();

  const usuario = store.findById('users', 'u1');
  usuario.nombre = 'Cambiado';
  store.all('users').push({ id: 'fantasma' });
  store.filter('users', () => true)[0].nombre = 'Otro';

  assert.equal(store.findById('users', 'u1').nombre, 'Ana');
  assert.equal(store.all('users').length, 1);

  const creado = store.insert('trips', { id: 't9', x: 1 });
  creado.x = 2;
  await store.flush();
  assert.equal(fake.filas('trips')[0].x, 1);
});

test('API: el registro llega a Supabase antes de responder y el admin inicial se crea tras la carga', async () => {
  const fake = createFakePostgrest({ retardoEscrituraMs: 30 });
  const store = crearAlmacen(fake, { seed: { vehicles: seedVehicles, stations: seedStations } });
  const previoEmail = process.env.ADMIN_EMAIL;
  const previoPassword = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_EMAIL = 'admin-supabase@ev.cl';
  process.env.ADMIN_PASSWORD = 'admin-segura-123';
  try {
    const app = createApp({ store, jwtSecret: 'x'.repeat(64), logger: silentLogger() });
    await withServer(app, async (baseUrl) => {
      const ready = await request(baseUrl, '/api/ready');
      assert.equal(ready.status, 200);
      assert.equal(ready.body.checks.persistencia, 'supabase');
      assert.equal(ready.body.checks.almacen, 'ok');

      // /api/ready no espera escrituras; el admin se persiste en segundo plano.
      await store.flush();
      const admin = fake.filas('users').find((u) => u.email === 'admin-supabase@ev.cl');
      assert.equal(admin.rol, 'admin');

      const registro = await registerUser(baseUrl, { email: 'persistida@ev.cl', password: 'clave-segura-123' });
      assert.equal(registro.status, 201);
      assert.ok(fake.filas('users').some((u) => u.email === 'persistida@ev.cl'));
    });
  } finally {
    if (previoEmail === undefined) delete process.env.ADMIN_EMAIL; else process.env.ADMIN_EMAIL = previoEmail;
    if (previoPassword === undefined) delete process.env.ADMIN_PASSWORD; else process.env.ADMIN_PASSWORD = previoPassword;
  }
});

test('API: si la escritura falla, la respuesta se envía igual y el fallo queda registrado', async () => {
  const fake = createFakePostgrest();
  const { logger, registros } = capturarLogs();
  const store = crearAlmacen(fake, { logger });
  const app = createApp({ store, jwtSecret: 'x'.repeat(64), logger });
  await withServer(app, async (baseUrl) => {
    await store.ready();
    fake.fallarUna('POST', 500, 'fallo simulado');

    const registro = await registerUser(baseUrl, { email: 'sin-persistir@ev.cl', password: 'clave-segura-123' });

    assert.equal(registro.status, 201);
    assert.ok(registros.some((r) => r.msg === 'store_flush_failed'));
  });
});
