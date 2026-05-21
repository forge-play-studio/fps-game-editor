import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { findFreePort } from './ports.mjs';
import { waitForHttp } from './servers.mjs';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export async function launchChrome({ url, headed = false }) {
  const port = await findFreePort(9300);
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lumber-order-platform-sim-chrome-'));
  const args = [
    headed ? null : '--headless=new',
    '--disable-gpu',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    url,
  ].filter(Boolean);

  const child = spawn(CHROME_PATH, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout.on('data', (chunk) => { output += String(chunk); });
  child.stderr.on('data', (chunk) => { output += String(chunk); });

  await waitForHttp(`http://127.0.0.1:${port}/json/version`, 15000);
  const targets = await httpJson(`http://127.0.0.1:${port}/json`);
  const pageTarget = targets.find((target) => target.type === 'page') || targets[0];
  if (!pageTarget?.webSocketDebuggerUrl) {
    throw new Error(`chrome_page_target_not_found:${output}`);
  }
  const cdp = await CdpClient.connect(pageTarget.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  return {
    cdp,
    output: () => output,
    async close() {
      try {
        await cdp.close();
      } catch {}
      if (child.exitCode == null) {
        child.kill('SIGTERM');
        await new Promise((resolve) => {
          const timeout = setTimeout(resolve, 3000);
          child.once('exit', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      }
      await fs.rm(userDataDir, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 200,
      });
    },
  };
}

function httpJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += String(chunk); });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = Buffer.alloc(0);
    this.events = [];
    socket.on('data', (chunk) => this.onData(chunk));
    socket.on('close', () => {
      for (const [, pending] of this.pending) {
        pending.reject(new Error('cdp_socket_closed'));
      }
      this.pending.clear();
    });
  }

  static connect(wsUrl) {
    return new Promise((resolve, reject) => {
      const url = new URL(wsUrl);
      const key = crypto.randomBytes(16).toString('base64');
      const socket = net.connect(Number(url.port), url.hostname);
      let handshake = Buffer.alloc(0);

      socket.once('error', reject);
      socket.on('connect', () => {
        socket.write([
          `GET ${url.pathname}${url.search} HTTP/1.1`,
          `Host: ${url.host}`,
          'Upgrade: websocket',
          'Connection: Upgrade',
          `Sec-WebSocket-Key: ${key}`,
          'Sec-WebSocket-Version: 13',
          '',
          '',
        ].join('\r\n'));
      });

      const onHandshake = (chunk) => {
        handshake = Buffer.concat([handshake, chunk]);
        const marker = handshake.indexOf('\r\n\r\n');
        if (marker < 0) return;
        const header = handshake.slice(0, marker).toString('utf8');
        if (!header.includes('101')) {
          reject(new Error(`websocket_handshake_failed:${header}`));
          socket.destroy();
          return;
        }
        socket.off('data', onHandshake);
        const client = new CdpClient(socket);
        const rest = handshake.slice(marker + 4);
        if (rest.length) client.onData(rest);
        resolve(client);
      };
      socket.on('data', onHandshake);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    this.socket.write(encodeClientFrame(Buffer.from(payload)));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  async evaluate(expression, awaitPromise = true) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || 'runtime_evaluate_failed');
    }
    return result.result?.value;
  }

  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      const decoded = decodeServerFrame(this.buffer);
      if (!decoded) return;
      this.buffer = this.buffer.slice(decoded.bytes);
      if (decoded.opcode === 8) return;
      if (decoded.opcode !== 1) continue;
      const msg = JSON.parse(decoded.payload.toString('utf8'));
      if (!msg.id) {
        this.events.push(msg);
        if (this.events.length > 200) this.events.splice(0, this.events.length - 200);
        continue;
      }
      const pending = this.pending.get(msg.id);
      if (!pending) continue;
      this.pending.delete(msg.id);
      if (msg.error) pending.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      else pending.resolve(msg.result);
    }
  }

  close() {
    this.socket.end();
  }

  recentEvents() {
    return this.events.slice(-80);
  }
}

function encodeClientFrame(payload) {
  const length = payload.length;
  let header;
  if (length < 126) {
    header = Buffer.alloc(6);
    header[0] = 0x81;
    header[1] = 0x80 | length;
    crypto.randomBytes(4).copy(header, 2);
    mask(payload, header.slice(2, 6));
    return Buffer.concat([header, payload]);
  }
  if (length <= 0xffff) {
    header = Buffer.alloc(8);
    header[0] = 0x81;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(length, 2);
    crypto.randomBytes(4).copy(header, 4);
    mask(payload, header.slice(4, 8));
    return Buffer.concat([header, payload]);
  }
  if (length > Number.MAX_SAFE_INTEGER) {
    throw new Error(`websocket_payload_too_large:${length}`);
  }
  header = Buffer.alloc(14);
  header[0] = 0x81;
  header[1] = 0x80 | 127;
  header.writeUInt32BE(Math.floor(length / 2 ** 32), 2);
  header.writeUInt32BE(length >>> 0, 6);
  crypto.randomBytes(4).copy(header, 10);
  mask(payload, header.slice(10, 14));
  return Buffer.concat([header, payload]);
}

function mask(payload, key) {
  for (let index = 0; index < payload.length; index += 1) {
    payload[index] ^= key[index % 4];
  }
}

function decodeServerFrame(buffer) {
  if (buffer.length < 2) return null;
  const first = buffer[0];
  const second = buffer[1];
  const opcode = first & 0x0f;
  const masked = (second & 0x80) !== 0;
  let length = second & 0x7f;
  let offset = 2;
  if (length === 126) {
    if (buffer.length < offset + 2) return null;
    length = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (length === 127) {
    if (buffer.length < offset + 8) return null;
    const high = buffer.readUInt32BE(offset);
    const low = buffer.readUInt32BE(offset + 4);
    length = high * 2 ** 32 + low;
    offset += 8;
  }
  let key = null;
  if (masked) {
    if (buffer.length < offset + 4) return null;
    key = buffer.slice(offset, offset + 4);
    offset += 4;
  }
  if (buffer.length < offset + length) return null;
  const payload = Buffer.from(buffer.slice(offset, offset + length));
  if (key) mask(payload, key);
  return { opcode, payload, bytes: offset + length };
}
