import { spawn } from 'node:child_process';
import { waitForHttp } from './servers.mjs';

export async function startViteDevServer({ cwd, port, env = {} }) {
  const child = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd,
    env: { ...process.env, ...env, BROWSER: 'none', VITE_CACHE_DIR: '.vite-platform-sim-cache' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout.on('data', (chunk) => {
    output += String(chunk);
  });
  child.stderr.on('data', (chunk) => {
    output += String(chunk);
  });

  child.once('exit', (code) => {
    if (code !== null && code !== 0) {
      output += `\n[vite exited with ${code}]`;
    }
  });

  await waitForHttp(`http://127.0.0.1:${port}/`, 30000).catch((error) => {
    child.kill('SIGTERM');
    throw new Error(`${error.message}\n${output}`);
  });

  return {
    url: `http://127.0.0.1:${port}/`,
    output: () => output,
    async stop() {
      if (child.exitCode != null) return;
      child.kill('SIGTERM');
      await new Promise((resolve) => {
        const timeout = setTimeout(resolve, 2000);
        child.once('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    },
  };
}
