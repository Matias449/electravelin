const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestApp, withServer, request, registerUser } = require('../test-utils/helpers');

test('registro y login entregan token y usuario sin exponer el hash', async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const registro = await registerUser(baseUrl, { nombre: 'Patricio Test' });
    assert.equal(registro.status, 201);
    assert.equal(registro.body.exito, true);
    assert.ok(registro.body.token);
    assert.equal(registro.body.usuario.rol, 'usuario');
    assert.equal(registro.body.usuario.passwordHash, undefined);

    const login = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: registro.payload.email, password: registro.payload.password },
    });
    assert.equal(login.status, 200);
    assert.ok(login.body.token);

    const me = await request(baseUrl, '/api/auth/me', { token: login.body.token });
    assert.equal(me.status, 200);
    assert.equal(me.body.usuario.email, registro.payload.email);
  });
});

test('rechaza registro con correo duplicado, contraseña corta y correo inválido', async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const first = await registerUser(baseUrl);
    assert.equal(first.status, 201);

    const duplicate = await request(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { nombre: 'Otro', email: first.payload.email, password: 'clave-segura-123' },
    });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.code, 'EMAIL_TAKEN');

    const short = await request(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { nombre: 'Otro', email: 'corta@test.cl', password: '123' },
    });
    assert.equal(short.status, 400);

    const invalid = await request(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { nombre: 'Otro', email: 'no-es-correo', password: 'clave-segura-123' },
    });
    assert.equal(invalid.status, 400);
  });
});

test('login con credenciales incorrectas responde 401 sin filtrar datos', async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const registro = await registerUser(baseUrl);
    const login = await request(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: registro.payload.email, password: 'incorrecta-999' },
    });
    assert.equal(login.status, 401);
    assert.equal(login.body.code, 'INVALID_CREDENTIALS');
    assert.doesNotMatch(JSON.stringify(login.body), /clave-segura-123/);
  });
});

test('rutas de cuenta exigen token y responden 401 sin sesión', async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    for (const path of ['/api/auth/me', '/api/viajes', '/api/favoritos', '/api/admin/vehiculos']) {
      const response = await request(baseUrl, path);
      assert.equal(response.status, 401, `esperaba 401 en ${path}`);
    }
  });
});

test('un usuario común recibe 403 en endpoints administrativos', async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const registro = await registerUser(baseUrl);
    const response = await request(baseUrl, '/api/admin/vehiculos', { token: registro.body.token });
    assert.equal(response.status, 403);
    assert.equal(response.body.code, 'ADMIN_REQUIRED');
  });
});

test('perfil: actualiza nombre y rechaza vehículo inexistente', async () => {
  const { app } = createTestApp();
  await withServer(app, async (baseUrl) => {
    const registro = await registerUser(baseUrl);
    const token = registro.body.token;

    const ok = await request(baseUrl, '/api/perfil', {
      method: 'PUT',
      token,
      body: { nombre: 'Nombre Nuevo', vehiculoFavoritoId: 'tesla_model3_lr' },
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.usuario.nombre, 'Nombre Nuevo');
    assert.equal(ok.body.usuario.vehiculoFavoritoId, 'tesla_model3_lr');

    const bad = await request(baseUrl, '/api/perfil', {
      method: 'PUT',
      token,
      body: { vehiculoFavoritoId: 'no_existe' },
    });
    assert.equal(bad.status, 400);
  });
});
