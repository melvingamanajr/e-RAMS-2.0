import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function launch(script, args = [], options = {}) {
  return spawn(process.execPath, [resolve(ROOT, script), ...args], { cwd: ROOT, env: process.env, stdio: 'inherit', windowsHide: true, ...options });
}
export function run(script, args = [], options = {}) {
  return new Promise((done, reject) => { const child = launch(script, args, options); child.once('error', reject); child.once('exit', code => code === 0 ? done() : reject(new Error(`${script} exited with code ${code}`))); });
}
export async function waitFor(url, child, seconds = 40) {
  for (let i = 0; i < seconds * 4; i++) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) throw new Error('Service exited before becoming ready');
    try { const response = await fetch(url, { signal: AbortSignal.timeout(1000) }); if (response.ok) return; } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`Service not ready at ${url}`);
}
