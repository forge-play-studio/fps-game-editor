import net from 'node:net';

export function findFreePort(start = 5200, host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        findFreePort(start + 1, host).then(resolve, reject);
        return;
      }
      reject(error);
    });
    server.once('listening', () => {
      const address = server.address();
      server.close(() => resolve(typeof address === 'object' && address ? address.port : start));
    });
    server.listen(start, host);
  });
}

export function assertPortAvailable(port, host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', (error) => {
      reject(new Error(`port_unavailable:${host}:${port}:${error.message}`));
    });
    server.once('listening', () => {
      server.close(resolve);
    });
    server.listen(port, host);
  });
}
