#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const checks = [
  {
    label: 'asset-manager-facade',
    dir: path.join(root, 'src/services'),
    include: (filePath) => filePath.endsWith('/AssetManager.ts'),
    banned: [
      '@babylonjs',
      'BabylonRuntimeAssetAdapter',
      'ProjectEditorPluginContext',
      'ProjectSceneDocumentAdapter',
      'SceneAssetUsage',
      'createAssetInstance',
      'createInstanceNode',
      'removeAssetInstance',
      'removeImportedAssetNode',
      'rootNode',
    ],
  },
  {
    label: 'asset-manager-core',
    dir: path.join(root, 'src/services/assets/core'),
    banned: [
      '@babylonjs',
      'fps-game-editor-adapter',
      'SceneNodeConfig',
      'Position3D',
      'window',
      'gameInstance',
      'src/assets',
      'src/config',
      'scene.json',
      'model-registry',
      'lumber_order',
    ],
  },
  {
    label: 'asset-registry-core',
    dir: path.join(root, 'scripts/asset-registry'),
    include: (filePath) => filePath.endsWith('/core.mjs'),
    banned: [
      'src/assets',
      'src/config',
      'scene-json-v2-rules',
      'model-registry',
      'lumber_order',
      'lumber-order',
    ],
  },
];

const failures = [];

for (const check of checks) {
  for (const filePath of await listFiles(check.dir)) {
    if (check.include && !check.include(filePath)) continue;
    const text = await fs.readFile(filePath, 'utf8');
    for (const token of check.banned) {
      if (!text.includes(token)) continue;
      failures.push({
        check: check.label,
        file: path.relative(root, filePath),
        token,
      });
    }
  }
}

if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: checks.map((check) => check.label) }));

async function listFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(filePath));
    } else if (entry.isFile()) {
      files.push(filePath);
    }
  }
  return files;
}
