import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const out = resolve(process.env.VERCEL_OUTPUT_ROOT || root, '.vercel/output');
const fn = join(out, 'functions/api.func');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const run = (cwd, args) => execFileSync(npm, args, { cwd, stdio: 'inherit', ...(process.platform === 'win32' ? { shell: true } : {}) });
run(join(root, 'server'), ['ci', '--omit=dev', '--no-audit', '--no-fund']);
run(join(root, 'client'), ['ci', '--no-audit', '--no-fund']);
run(join(root, 'client'), ['run', 'build']);
mkdirSync(fn, { recursive: true });
cpSync(join(root, 'client/dist'), join(out, 'static'), { recursive: true });
cpSync(join(root, 'server/src'), join(fn, 'src'), { recursive: true });
cpSync(join(root, 'server/node_modules'), join(fn, 'node_modules'), { recursive: true });
writeFileSync(join(fn, 'index.cjs'), `const { createApp } = require('./src/index');\nconst app = createApp();\nmodule.exports = (req, res) => {\n  const url = new URL(req.url, 'http://localhost');\n  const route = url.searchParams.get('__electravelin_route');\n  if (route !== null) {\n    url.searchParams.delete('__electravelin_route');\n    req.url = '/api/' + route + (url.search ? url.search : '');\n  }\n  return app(req, res);\n};\n`);
writeFileSync(join(fn, '.vc-config.json'), JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.cjs', launcherType: 'Nodejs', shouldAddHelpers: true }, null, 2));
writeFileSync(join(out, 'config.json'), JSON.stringify({ version: 3, routes: [
  { src: '^/api/(.*)$', dest: '/api?__electravelin_route=$1' },
  { handle: 'filesystem' },
  { src: '^/(.*)$', dest: '/index.html' },
] }, null, 2));