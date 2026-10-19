import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const python = process.env.PYTHON || 'python';
const api = spawn(python, ['api_server.py'], { cwd: root, stdio: 'inherit' });
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0'], {
  cwd: root,
  stdio: 'inherit',
});

let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  api.kill();
  vite.kill();
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
api.on('error', error => console.error(`Could not start Databricks API server (${python}):`, error.message));
api.on('exit', code => {
  if (!stopping && code !== 0) {
    console.error(`Databricks API server exited with code ${code}.`);
  }
});
vite.on('exit', code => {
  if (!stopping) stop();
  process.exitCode = code ?? 0;
});
