import { config } from 'dotenv';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { LocalPostgres } from './postgres.mjs';
import { ROOT, run, launch, waitFor } from './process.mjs';
const envPath = resolve(ROOT, '.env');
try { await access(envPath); } catch {
  const databasePassword = randomBytes(24).toString('hex');
  await writeFile(envPath, `# Local development only. Do not commit.\nLOCAL_DATABASE=true\nDATABASE_URL=postgresql://erams:${databasePassword}@127.0.0.1:55432/erams\nDATABASE_PASSWORD=${databasePassword}\nJWT_SECRET=${randomBytes(48).toString('hex')}\nBIOMETRIC_KEY=${randomBytes(32).toString('hex')}\nAI_SERVICE_KEY=${randomBytes(32).toString('hex')}\nAI_URL=http://127.0.0.1:8000\nWEB_ORIGIN=http://127.0.0.1:5173\nPORT=3000\nADMIN_EMAIL=admin@erams.local\nADMIN_PASSWORD=${randomBytes(18).toString('base64url')}\n`, { flag: 'wx' });
  console.log('Created .env with random development credentials. Open .env for the administrator email and password.');
}
config({ path: envPath });
let pg; const children = []; let stopping = false;
async function stop() {
  if (stopping) return; stopping = true;
  children.forEach(child => child.kill());
  if (pg) await pg.stop();
}
process.on('SIGINT', () => stop().then(() => process.exit(0)));
process.on('SIGTERM', () => stop().then(() => process.exit(0)));
try {
  if (process.env.LOCAL_DATABASE === 'true') {
    const url = new URL(process.env.DATABASE_URL);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('Embedded database requires a loopback DATABASE_URL');
    const databaseDir = resolve(ROOT, 'data/postgres');
    await mkdir(resolve(ROOT, 'data'), { recursive: true });
    pg = new LocalPostgres({ databaseDir, user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), port: Number(url.port), persistent: true, initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-c', 'listen_addresses=127.0.0.1'], onLog: () => {}, onError: message => console.error(String(message)) });
    try { await access(resolve(databaseDir, 'PG_VERSION')); } catch { await pg.initialise(); }
    await pg.start();
    const client = pg.getPgClient(); await client.connect();
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname=$1', [url.pathname.slice(1)]); await client.end();
    if (!exists.rows.length) await pg.createDatabase(url.pathname.slice(1));
  }
  await run('scripts/database.mjs', ['generate']);
  await run('scripts/database.mjs', ['deploy']);
  await run('scripts/database.mjs', ['seed']);
  await run('node_modules/typescript/bin/tsc', ['-p', 'apps/api/tsconfig.json']);
  const api = launch('apps/api/dist/src/main.js'); children.push(api);
  await waitFor(`http://127.0.0.1:${process.env.PORT ?? 3000}/api/health`, api);
  const web = launch('node_modules/vite/bin/vite.js', ['--host', '127.0.0.1', '--port', '5173', '--strictPort'], { cwd: resolve(ROOT, 'apps/web') }); children.push(web);
  await waitFor('http://127.0.0.1:5173', web);
  console.log('\ne-RAMS is ready at http://127.0.0.1:5173\nSign-in credentials are in .env. Press Ctrl+C to stop.\n');
  await Promise.race(children.map(child => new Promise(done => child.once('exit', done))));
} finally { await stop(); }
