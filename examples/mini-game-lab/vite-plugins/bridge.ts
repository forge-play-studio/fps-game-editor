// @ts-nocheck
import { readFile } from 'fs/promises';
import type { Plugin } from 'vite';

export interface BridgePluginOptions {
  port?: number;
  enabled?: boolean;
  delay?: number;
}

export function bridgePlugin(opts: BridgePluginOptions = {}): Plugin {
  const port = opts.port ?? 8080;
  const enabled = opts.enabled ?? true;
  const delay = opts.delay ?? 2000;

  return {
    name: 'vite-plugin-game-bridge',
    apply: 'serve',

    configureServer(server) {
      server.middlewares.use('/api/live-panel/scene-json', async (req: any, res: any) => {
        const url = req.url ? new URL(req.url, 'http://localhost') : null;
        const scenePath = url?.searchParams.get('path') ?? '';

        if (scenePath !== '/home/user/code/src/config/scene.json') {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'unsupported_scene_path' }));
          return;
        }

        if (req.method === 'GET') {
          try {
            const text = await readFile(scenePath, 'utf8');
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(text);
          } catch (error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
          }
          return;
        }

        if (req.method === 'POST') {
          res.statusCode = 410;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({
            ok: false,
            error: 'legacy_live_panel_scene_write_disabled',
            message: 'Save through fps-game-editor ProjectAuthoringHost.commitSource() instead of directly writing scene.json.',
          }));
          return;
        }

        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'method_not_allowed' }));
      });
    },

    transformIndexHtml(html) {
      if (!enabled) return html;

      const script = `
<script>
(function() {
  setTimeout(function() {
    var e2b = location.href.match(/https?:\\/\\/\\d+-([a-z0-9]+)\\.e2b\\.(app|dev)/);
    var url = e2b
      ? 'https://${port}-' + e2b[1] + '.e2b.app/script/bridge.js'
      : 'http://localhost:${port}/script/bridge.js';
    var s = document.createElement('script');
    s.src = url; s.async = true;
    s.onerror = function() { console.log('[GameBridge] MCP Server not available'); };
    document.head.appendChild(s);
  }, ${delay});
})();
</script>`;
      return html.replace('</head>', `${script}\n</head>`);
    },
  };
}
