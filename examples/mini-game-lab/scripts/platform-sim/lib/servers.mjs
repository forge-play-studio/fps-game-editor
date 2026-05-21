import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

export function createStaticServer(routes) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const route = routes[url.pathname];
    if (!route) {
      res.statusCode = 404;
      res.end('not found');
      return;
    }

    try {
      const filePath = typeof route.path === 'function' ? route.path(url) : route.path;
      const body = await fs.readFile(filePath);
      res.statusCode = 200;
      res.setHeader('Content-Type', route.contentType || contentType(filePath));
      res.end(body);
    } catch (error) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(error instanceof Error ? error.message : String(error));
    }
  });

  return {
    listen(port, host = '127.0.0.1') {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => resolve(server));
      });
    },
    close() {
      return new Promise((resolve) => server.close(resolve));
    },
  };
}

function contentType(filePath) {
  const ext = path.extname(filePath);
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

export async function waitForHttp(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`wait_for_http_timeout:${url}:${lastError?.message || 'unknown'}`);
}
