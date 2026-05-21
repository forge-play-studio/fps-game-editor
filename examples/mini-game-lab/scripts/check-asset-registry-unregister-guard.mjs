import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  AssetRegistryError,
  unregisterAsset,
} from './asset-registry/core.mjs';

const errorCodes = {
  assetStillReferenced: 'asset_still_referenced',
};

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lumber-order-asset-registry-'));

try {
  const config = await createConfig(root);
  await seedRegistry(config);
  await writeScene(config, {
    assets: [{ id: 'asset_foo', type: 'glb', sourceId: 'foo', displayName: 'Foo' }],
    nodes: [],
  });

  const removed = await unregisterAsset(config, { sourceId: 'foo' }, errorCodes);
  assert.equal(removed.ok, true);
  assert.equal(removed.sourceId, 'foo');

  await seedRegistry(config);
  await writeScene(config, {
    assets: [{ id: 'asset_foo', type: 'glb', sourceId: 'foo', displayName: 'Foo' }],
    nodes: [{ id: 'foo_1', kind: 'instance', instance: { assetId: 'asset_foo' } }],
  });

  await assert.rejects(
    unregisterAsset(config, { sourceId: 'foo' }, errorCodes),
    (error) => {
      assert.ok(error instanceof AssetRegistryError);
      assert.equal(error.message, errorCodes.assetStillReferenced);
      assert.deepEqual(error.details.nodeIds, ['foo_1']);
      return true;
    },
  );

  console.log('asset registry unregister guard checks passed');
} finally {
  await fs.rm(root, { recursive: true, force: true });
}

async function createConfig(baseDir) {
  const importedDir = path.join(baseDir, 'src/assets/imported');
  const generatedDir = path.join(baseDir, 'src/assets/generated');
  await fs.mkdir(importedDir, { recursive: true });
  await fs.mkdir(generatedDir, { recursive: true });
  return {
    cwd: baseDir,
    importedDir,
    generatedDir,
    manifestPath: path.join(generatedDir, 'model-registry.manifest.json'),
    registryPath: path.join(generatedDir, 'model-registry.generated.ts'),
    scenePath: path.join(baseDir, 'src/config/scene.json'),
    supportedExtension: '.glb',
    commands: {
      register: 'npm run asset:register',
      unregister: 'npm run asset:unregister',
    },
    loadRules: async () => ({ errorCodes }),
    relativeImportedPath: (fileName) => `../imported/${fileName}`,
    toImportName: (sourceId) => sourceId,
    publicUrlForImportedAsset: (fileName) => `/src/assets/imported/${fileName}`,
    generateRegistry: () => 'export const generatedModelRegistry = {};\n',
  };
}

async function seedRegistry(config) {
  await fs.mkdir(config.importedDir, { recursive: true });
  await fs.mkdir(config.generatedDir, { recursive: true });
  await fs.writeFile(path.join(config.importedDir, 'foo.glb'), 'fake glb');
  await fs.writeFile(config.manifestPath, `${JSON.stringify([
    {
      sourceId: 'foo',
      relativePath: '../imported/foo.glb',
      importName: 'foo',
    },
  ], null, 2)}\n`);
}

async function writeScene(config, scene) {
  await fs.mkdir(path.dirname(config.scenePath), { recursive: true });
  await fs.writeFile(config.scenePath, `${JSON.stringify({ schemaVersion: 2, scene }, null, 2)}\n`);
}
