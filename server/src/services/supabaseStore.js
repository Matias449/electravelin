/**
 * =============================================================================
 * supabaseStore.js — Almacén de documentos respaldado por Supabase (PostgREST)
 * =============================================================================
 *
 * Expone la misma interfaz síncrona que dataStore.createStore. Las lecturas y
 * escrituras operan sobre una caché en memoria (un createStore sin archivo), de
 * modo que los servicios no cambian. Cada escritura se refleja en la tabla
 * app_documents mediante una cola serial, para conservar el orden.
 *
 * Ciclo de vida:
 *   - ready(): carga todos los documentos desde Supabase en la caché. Si una
 *     colección no tiene filas remotas, siembra sus items semilla en la tabla.
 *     Es memoizado; si la carga falla, se rechaza y una llamada posterior
 *     reintenta.
 *   - flush(): resuelve cuando las escrituras encoladas hasta ese momento
 *     terminaron. Si alguna falló desde el último flush, rechaza con ese error.
 *
 * Las escrituras antes de ready() se rechazan: si no, la carga posterior
 * reemplazaría la colección y perdería el cambio sin aviso.
 * =============================================================================
 */

const { createStore, COLLECTIONS } = require('./dataStore');

const PAGE_SIZE = 1000;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createSupabaseStore({
  url,
  serviceRoleKey,
  seed = {},
  fetchImpl = fetch,
  logger,
  table = 'app_documents',
} = {}) {
  if (!url) throw new Error('createSupabaseStore requiere url.');
  if (!serviceRoleKey) throw new Error('createSupabaseStore requiere serviceRoleKey.');

  const restUrl = `${String(url).replace(/\/+$/, '')}/rest/v1/${table}`;
  const authHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  const memory = createStore({ filePath: null, seed });

  let loaded = false;
  let readyPromise = null;
  let queue = Promise.resolve();
  let pendingError = null;

  async function request(query, { method = 'GET', headers = {}, body } = {}) {
    const response = await fetchImpl(`${restUrl}${query}`, {
      method,
      headers: { ...authHeaders, ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      const texto = await response.text().catch(() => '');
      throw new Error(`Supabase respondió ${response.status} en ${method} ${table}: ${texto}`);
    }
    return response;
  }

  // Snapshot inmediato: la fila no debe cambiar si el llamador muta el objeto devuelto.
  function toRow(collection, document) {
    return { collection, id: document.id, data: clone(document) };
  }

  function upsertRows(rows) {
    if (rows.length === 0) return Promise.resolve();
    return request('?on_conflict=collection,id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: rows,
    });
  }

  async function fetchAllRows() {
    const rows = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const response = await request(
        `?select=collection,id,data&order=collection.asc,id.asc&limit=${PAGE_SIZE}&offset=${offset}`
      );
      const page = await response.json();
      if (!Array.isArray(page)) throw new Error('Respuesta inesperada de Supabase al leer documentos.');
      rows.push(...page);
      if (page.length < PAGE_SIZE) return rows;
    }
  }

  async function load() {
    const rows = await fetchAllRows();
    const porColeccion = new Map();
    for (const row of rows) {
      if (!COLLECTIONS.includes(row.collection)) {
        logger?.warn('supabase_coleccion_desconocida', { coleccion: row.collection });
        continue;
      }
      if (!porColeccion.has(row.collection)) porColeccion.set(row.collection, []);
      porColeccion.get(row.collection).push({ ...row.data, id: row.id });
    }

    for (const collection of COLLECTIONS) {
      if (porColeccion.has(collection)) {
        memory.replace(collection, porColeccion.get(collection));
        continue;
      }
      // Sin filas remotas: la semilla ya está en memoria; se persiste para la primera vez.
      const semilla = memory.all(collection);
      await upsertRows(semilla.map((document) => toRow(collection, document)));
    }
  }

  function ready() {
    if (!readyPromise) {
      readyPromise = load()
        .then(() => {
          loaded = true;
        })
        .catch((error) => {
          readyPromise = null;
          throw new Error(`No se pudo cargar el almacén desde Supabase: ${error.message}`);
        });
    }
    return readyPromise;
  }

  function assertLoaded() {
    if (!loaded) throw new Error('El almacén de Supabase aún no está cargado; espera ready() antes de escribir.');
  }

  function enqueue(operation, detalles) {
    queue = queue
      .then(() => operation())
      .catch((error) => {
        pendingError = pendingError || error;
        logger?.error('supabase_write_failed', { ...detalles, message: error.message });
      });
  }

  function insert(collection, document) {
    assertLoaded();
    const record = memory.insert(collection, document);
    const row = toRow(collection, record);
    enqueue(() => upsertRows([row]), { operacion: 'insert', coleccion: collection, id: record.id });
    return record;
  }

  function update(collection, id, patch) {
    assertLoaded();
    const record = memory.update(collection, id, patch);
    if (record) {
      const row = toRow(collection, record);
      enqueue(() => upsertRows([row]), { operacion: 'update', coleccion: collection, id });
    }
    return record;
  }

  function remove(collection, id) {
    assertLoaded();
    const removed = memory.remove(collection, id);
    if (removed) {
      enqueue(
        () => request(`?collection=eq.${collection}&id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' }),
        { operacion: 'remove', coleccion: collection, id }
      );
    }
    return removed;
  }

  function replace(collection, items) {
    assertLoaded();
    if (!Array.isArray(items)) throw new Error('items debe ser un arreglo.');
    if (items.some((item) => !item || typeof item.id !== 'string' || !item.id)) {
      throw new Error('Cada documento debe tener un id de texto para persistirse.');
    }
    const result = memory.replace(collection, items);
    const rows = result.map((document) => toRow(collection, document));
    enqueue(
      async () => {
        await request(`?collection=eq.${collection}`, { method: 'DELETE' });
        await upsertRows(rows);
      },
      { operacion: 'replace', coleccion: collection }
    );
    return result;
  }

  function flush() {
    return queue.then(() => {
      const error = pendingError;
      pendingError = null;
      if (error) throw error;
    });
  }

  return {
    all: memory.all,
    find: memory.find,
    findById: memory.findById,
    filter: memory.filter,
    insert,
    update,
    remove,
    replace,
    ready,
    flush,
    persistencia: 'supabase',
  };
}

module.exports = { createSupabaseStore };
