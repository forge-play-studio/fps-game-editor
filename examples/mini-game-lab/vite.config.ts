import { defineConfig } from 'vite';
import { resolve } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { bridgePlugin } from './vite-plugins/bridge';

const liteBuild = process.env.LITE_BUILD === 'true';
const isProduction = process.env.NODE_ENV === 'production';
const bridgeEnabled = process.env.BRIDGE_ENABLED === 'true';
const debugPanelConfigRoot = resolve(__dirname, 'src/config');
const repositoryEditorRoot = resolve(__dirname, '../..');
const editorLocalRoot = process.env.FPS_GAME_EDITOR_ROOT
  ? resolve(__dirname, process.env.FPS_GAME_EDITOR_ROOT)
  : repositoryEditorRoot;

function createEditorLocalAliases(): Record<string, string> {
  if (!editorLocalRoot) return {};

  const aliases = {
    '@fps-games/editor-babylon/legacy-runtime': resolve(editorLocalRoot, 'packages/editor-babylon/src/legacy-runtime.ts'),
    '@fps-games/editor': resolve(editorLocalRoot, 'packages/editor/src/index.ts'),
    '@fps-games/editor-babylon': resolve(editorLocalRoot, 'packages/editor-babylon/src/index.ts'),
    '@fps-games/editor-browser': resolve(editorLocalRoot, 'packages/editor-browser/src/index.ts'),
    '@fps-games/editor-core': resolve(editorLocalRoot, 'packages/editor-core/src/index.ts'),
    '@fps-games/editor-forge-play': resolve(editorLocalRoot, 'packages/editor-forge-play/src/index.ts'),
    '@fps-games/editor-protocol': resolve(editorLocalRoot, 'packages/editor-protocol/src/index.ts'),
  };

  const missing = Object.entries(aliases).filter(([, file]) => !existsSync(file));
  if (missing.length > 0) {
    throw new Error(
      [
        `fps-game-editor local source is set to ${editorLocalRoot}, but editor package source files are missing.`,
        ...missing.map(([pkg, file]) => `- ${pkg}: ${file}`),
      ].join('\n'),
    );
  }

  return aliases;
}

const editorLocalAliases = createEditorLocalAliases();
const editorLocalPackages = Object.keys(editorLocalAliases);
const usingEditorLocalSource = editorLocalPackages.length > 0;

function resolveDebugPanelConfigFile(file: string | null): string | null {
  if (!file || file.includes('/') || file.includes('\\') || file.includes('..') || !file.endsWith('.json')) {
    return null;
  }
  return resolve(debugPanelConfigRoot, file);
}

function setNestedValue(target: Record<string, any>, path: string, value: unknown): void {
  const parts = path.split('.').filter(Boolean);
  if (parts.length === 0) return;
  let cursor = target;
  for (const part of parts.slice(0, -1)) {
    const next = cursor[part];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      cursor[part] = {};
    }
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]!] = value;
}

function debugPanelConfigApiPlugin() {
  return {
    name: 'debug-panel-config-api',
    apply: 'serve' as const,
    configureServer(server: any) {
      server.middlewares.use('/__debug_panel_config', async (req: any, res: any) => {
        const requestUrl = new URL(req.url ?? '', 'http://localhost');
        const configPath = resolveDebugPanelConfigFile(requestUrl.searchParams.get('file'));
        if (!configPath) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Unsupported debug panel config file' }));
          return;
        }

        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(existsSync(configPath) ? readFileSync(configPath, 'utf8') : '{}');
          return;
        }

        if (req.method === 'POST') {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(Buffer.from(chunk));
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as { changes?: Record<string, unknown> };
          const current = existsSync(configPath)
            ? JSON.parse(readFileSync(configPath, 'utf8') || '{}') as Record<string, any>
            : {};
          for (const [path, value] of Object.entries(body.changes ?? {})) {
            setNestedValue(current, path, value);
          }
          mkdirSync(debugPanelConfigRoot, { recursive: true });
          writeFileSync(configPath, `${JSON.stringify(current, null, 2)}\n`, 'utf8');
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        res.statusCode = 405;
        res.end('Method Not Allowed');
      });
    },
  };
}

function projectAuthoringApiPlugin() {
  return {
    name: 'fps-editor-project-authoring-api',
    apply: 'serve' as const,
    configureServer(server: any) {
      void import('./scripts/asset-registry/lumber-order-config.mjs')
        .then(({ lumberOrderAssetRegistryConfig }) => {
          const paths = [
            lumberOrderAssetRegistryConfig.scenePath,
            lumberOrderAssetRegistryConfig.manifestPath,
            lumberOrderAssetRegistryConfig.registryPath,
            lumberOrderAssetRegistryConfig.importedDir,
          ];
          server.watcher.unwatch(paths);
          console.log('[ProjectAuthoring][Vite] HMR disabled for authoring-written files', paths);
        })
        .catch((error) => {
          console.warn('[ProjectAuthoring][Vite] failed to disable HMR for authoring files', error);
        });

      server.middlewares.use(async (req: any, res: any, next: any) => {
        const requestUrl = new URL(req.url ?? '', 'http://localhost');
        const pathname = requestUrl.pathname;
        const isProjectAuthoringRoute = pathname.startsWith('/__fps_editor_authoring');
        const isLegacyMockRoute = pathname.startsWith('/__mock_platform_assets');
        if (!isProjectAuthoringRoute && !isLegacyMockRoute) {
          next();
          return;
        }
        const route = pathname
          .replace(/^\/__fps_editor_authoring/, '')
          .replace(/^\/__mock_platform_assets/, '') || '/';
        if (
          !route.startsWith('/manifest')
          && !route.startsWith('/commit')
          && !route.startsWith('/editor-scene')
          && !route.startsWith('/editor-asset-library')
          && !route.startsWith('/save-editor-scene')
          && !route.startsWith('/file')
          && !route.startsWith('/exec')
        ) {
          next();
          return;
        }

        setProjectAuthoringCorsHeaders(res);
        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        try {
          const { lumberOrderAssetRegistryConfig } = await import('./scripts/asset-registry/lumber-order-config.mjs');
          const registryCore = await import('./scripts/asset-registry/core.mjs');
          const rules = await lumberOrderAssetRegistryConfig.loadRules();
          const errorCodes = rules.errorCodes ?? {};

          if (req.method === 'GET' && route.startsWith('/manifest')) {
            const manifest = existsSync(lumberOrderAssetRegistryConfig.manifestPath)
              ? JSON.parse(readFileSync(lumberOrderAssetRegistryConfig.manifestPath, 'utf8'))
              : [];
            sendJson(res, 200, { ok: true, manifest });
            return;
          }

          if (req.method === 'GET' && route.startsWith('/editor-asset-library')) {
            const assets = await listEditorAssetLibrary(server);
            sendJson(res, 200, {
              ok: true,
              assets,
              summary: {
                assets: assets.length,
              },
            });
            return;
          }

          if (req.method === 'GET' && route.startsWith('/editor-scene')) {
            const editorScenePath = resolve(__dirname, 'src/config/editor-scene.json');
            const scenePath = resolve(__dirname, 'src/config/scene.json');
            const editorScene = existsSync(editorScenePath)
              ? JSON.parse(readFileSync(editorScenePath, 'utf8') || '{}')
              : null;
            const runtimeScene = existsSync(scenePath)
              ? JSON.parse(readFileSync(scenePath, 'utf8') || '{}')
              : null;
            const { ensureEditorSceneAuthoringSource, detectEditorSceneRuntimeInputDrift } = await server.ssrLoadModule('/src/fps-game-editor-adapter/editor-authoring-source.ts');
            const normalizedEditorScene = editorScene ? ensureEditorSceneAuthoringSource(editorScene) : editorScene;
            sendJson(res, 200, {
              ok: true,
              editorScenePath,
              scenePath,
              editorScene: normalizedEditorScene,
              drift: normalizedEditorScene ? detectEditorSceneRuntimeInputDrift(normalizedEditorScene, runtimeScene) : null,
              summary: summarizeEditorScene(normalizedEditorScene),
            });
            return;
          }

          if (req.method !== 'POST') {
            sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
            return;
          }

          const body = await readJsonBody(req);
          if (route.startsWith('/file')) {
            const targetPath = normalizeTransportPath(String(body.path ?? ''));
            if (!targetPath) {
              sendJson(res, 400, { ok: false, error: 'missing_file_path' });
              return;
            }
            const content = body.content;
            const text = typeof content === 'string'
              ? content
              : `${JSON.stringify(content ?? {}, null, 2)}\n`;
            await mkdir(path.dirname(targetPath), { recursive: true });
            await writeFile(targetPath, text, 'utf8');
            sendJson(res, 200, { ok: true, path: targetPath });
            return;
          }

          if (route.startsWith('/exec')) {
            const cmd = String(body.cmd ?? '');
            const payloadPath = readPayloadPathFromCommand(cmd);
            if (!payloadPath) {
              sendJson(res, 400, { ok: false, error: 'missing_payload_arg', cmd });
              return;
            }
            const normalizedPayloadPath = normalizeTransportPath(payloadPath);
            const result = cmd.includes('asset:unregister')
              ? await registryCore.unregisterAsset(lumberOrderAssetRegistryConfig, { payload: normalizedPayloadPath }, errorCodes)
              : await registryCore.registerAsset(lumberOrderAssetRegistryConfig, { payload: normalizedPayloadPath }, errorCodes);
            sendJson(res, 200, { ok: true, cmd, result });
            return;
          }

          if (route.startsWith('/save-editor-scene')) {
            const rawEditorScene = body.editorScene;
            const editorScenePath = resolve(__dirname, 'src/config/editor-scene.json');
            const scenePath = resolve(__dirname, 'src/config/scene.json');
            const previousSceneConfig = existsSync(scenePath)
              ? JSON.parse(readFileSync(scenePath, 'utf8') || '{}')
              : {};
            const { compileEditorSceneDocumentToSceneConfig } = await server.ssrLoadModule('/src/fps-game-editor-adapter/editor-scene-compiler.ts');
            const { enrichEditorSceneDocumentAssets } = await server.ssrLoadModule('/src/fps-game-editor-adapter/editor-asset-library.ts');
            const { bumpEditorSceneAuthoringSourceRevision, ensureEditorSceneAuthoringSource } = await server.ssrLoadModule('/src/fps-game-editor-adapter/editor-authoring-source.ts');
            const { assertSceneJsonV2 } = await import('./scripts/platform-sim/lib/scene-json-v2-schema.mjs');
            assertEditorSceneDocument(rawEditorScene);
            const editorScene = bumpEditorSceneAuthoringSourceRevision(
              enrichEditorSceneDocumentAssets(ensureEditorSceneAuthoringSource(rawEditorScene), await listEditorAssetLibrary(server)),
            );
            const compiled = compileEditorSceneDocumentToSceneConfig(editorScene, previousSceneConfig);
            assertSceneJsonV2(compiled.sceneConfig);

            const version = typeof previousSceneConfig.version === 'number' ? previousSceneConfig.version + 1 : 1;
            const updatedAt = new Date().toISOString();
            const savedEditorSceneText = `${JSON.stringify(editorScene, null, 2)}\n`;
            const savedSceneJsonText = `${JSON.stringify({
              ...compiled.sceneConfig,
              version,
              updatedAt,
            }, null, 2)}\n`;

            await writeFile(editorScenePath, savedEditorSceneText, 'utf8');
            await writeFile(scenePath, savedSceneJsonText, 'utf8');
            invalidateViteFileModules(server, [editorScenePath, scenePath]);

            sendJson(res, 200, {
              ok: true,
              editorScenePath,
              scenePath,
              version,
              updatedAt,
              editorScene,
              sceneJsonText: savedSceneJsonText,
              summary: {
                editorScene: summarizeEditorScene(editorScene),
                compiled: compiled.summary,
              },
            });
            return;
          }

          if (route.startsWith('/commit')) {
            sendJson(res, 410, {
              ok: false,
              error: 'legacy_mock_platform_commit_disabled',
              message: 'Save through /__fps_editor_authoring/save-editor-scene so scene.main remains the authoring source of truth.',
            });
            return;
          }

          sendJson(res, 404, { ok: false, error: 'not_found' });
        } catch (error) {
          sendJson(res, 500, {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
            details: (error as any)?.details,
          });
        }
      });
    },
  };
}

async function readJsonBody(req: any): Promise<Record<string, any>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as Record<string, any>;
}

function normalizePayloadPath(value: string): string {
  if (value.startsWith('/tmp/') || path.isAbsolute(value)) return value;
  return resolve(__dirname, '.platform-sim', value);
}

function normalizeTransportPath(value: string): string {
  if (!value.trim()) return '';
  return normalizePayloadPath(value);
}

function readPayloadPathFromCommand(cmd: string): string {
  const match = cmd.match(/(?:^|\s)--payload(?:=|\s+)("[^"]+"|'[^']+'|\S+)/);
  const value = match?.[1] ?? '';
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function sendJson(res: any, statusCode: number, body: Record<string, unknown>): void {
  res.statusCode = statusCode;
  setProjectAuthoringCorsHeaders(res);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function setProjectAuthoringCorsHeaders(res: any): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
}

function assertEditorSceneDocument(value: any): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('editor_scene_must_be_object');
  }
  if (value.schemaVersion !== 1) {
    throw new Error('editor_scene_schema_version_must_be_1');
  }
  if (!Array.isArray(value.assets)) {
    throw new Error('editor_scene_assets_must_be_array');
  }
  const gameObjects = value.scene?.gameObjects;
  if (!Array.isArray(gameObjects)) {
    throw new Error('editor_scene_game_objects_must_be_array');
  }
}

function summarizeEditorScene(value: any): Record<string, unknown> {
  return {
    schemaVersion: value?.schemaVersion ?? null,
    sourceId: value?.meta?.authoringSource?.sourceId ?? null,
    sourceType: value?.meta?.authoringSource?.sourceType ?? null,
    revision: value?.meta?.authoringSource?.revision ?? null,
    assets: Array.isArray(value?.assets) ? value.assets.length : 0,
    gameObjects: Array.isArray(value?.scene?.gameObjects) ? value.scene.gameObjects.length : 0,
  };
}

async function listEditorAssetLibrary(server: any): Promise<Array<Record<string, unknown>>> {
  const assetsModule = await server.ssrLoadModule('/src/assets/index.ts');
  const editorAssetLibraryModule = await server.ssrLoadModule('/src/fps-game-editor-adapter/editor-asset-library.ts');
  const modelIds = typeof assetsModule.getAllModelIds === 'function'
    ? assetsModule.getAllModelIds()
    : Object.keys(assetsModule.MODEL_URL_MAP ?? {});
  return editorAssetLibraryModule.createProjectEditorAssetLibrary(modelIds);
}

function invalidateViteFileModules(server: any, files: string[]): void {
  for (const file of files) {
    const modules = server.moduleGraph?.getModulesByFile?.(file);
    if (!modules) continue;
    for (const moduleNode of modules) {
      server.moduleGraph.invalidateModule(moduleNode);
    }
  }
}

export default defineConfig({
  root: __dirname,
  cacheDir: process.env.VITE_CACHE_DIR || 'node_modules/.vite',
  define: {
    __LITE_BUILD__: JSON.stringify(liteBuild),
    // 在生产构建时完全移除开发功能
    __PROD_BUILD__: JSON.stringify(isProduction),
  },
  plugins: [
    // 平台 bridge 自动注入（仅开发模式）
    bridgePlugin({
      port: 8080,
      delay: 2000,
      enabled: bridgeEnabled,
    }),
    // 新版 fps-game-editor 不注入 Babylon Inspector UI。
    // inspectorPlugin(),
    debugPanelConfigApiPlugin(),
    projectAuthoringApiPlugin(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      ...editorLocalAliases,
    },
    dedupe: [
      '@babylonjs/core',
      '@babylonjs/loaders',
      '@babylonjs/inspector',
    ],
  },
  optimizeDeps: {
    exclude: editorLocalPackages,
    include: [
      '@babylonjs/core',
      '@babylonjs/core/Layers/effectLayerSceneComponent',
      '@babylonjs/core/Rendering/depthRendererSceneComponent',
      '@babylonjs/core/Gizmos/gizmoManager',
    ],
  },
  assetsInclude: ['**/*.env'],
  server: {
    port: 5184,
    strictPort: false,
    cors: true,
    allowedHosts: ['.e2b.app'],
    ...(usingEditorLocalSource
      ? {
          fs: {
            allow: [__dirname, editorLocalRoot!],
          },
        }
      : {}),
    headers: {
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    }
  },
});
