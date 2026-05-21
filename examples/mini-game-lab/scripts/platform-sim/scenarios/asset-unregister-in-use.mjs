import {
  assert,
} from '../lib/assertions.mjs';
import {
  assertImportedAssetScene,
  enterEditMode,
  exportScene,
  registerAndImportAsset,
  waitForProjectReady,
} from './helpers.mjs';

export async function run(ctx) {
  const requestId = `sim-unregister-in-use-${Date.now()}`;
  await waitForProjectReady(ctx);
  await enterEditMode(ctx, `${requestId}-edit`);

  const { registered, importResult } = await registerAndImportAsset(ctx, {
    requestId,
    assetName: 'sim-unregister-in-use-asset.glb',
    position: { x: 1, y: 0, z: 4 },
  });

  const importedScene = await exportScene(ctx, `${requestId}-export-imported`);
  assertImportedAssetScene(importedScene, { registered, nodeId: importResult.nodeId });

  await ctx.bridge.command('asset.unregistration.plan', {
    requestId,
    sourceId: registered.sourceId,
  });
  const failed = await ctx.bridge.waitForEvent('asset.unregistration.failed', { requestId, timeoutMs: 15000 });
  assert(failed.ok === false, 'unregister-in-use should fail', failed);
  assert(failed.code === 'asset_still_referenced', 'unexpected unregister-in-use error code', failed);

  return {
    ok: true,
    sourceId: registered.sourceId,
    assetId: registered.assetId,
    nodeId: importResult.nodeId,
    rejectedCode: failed.code,
  };
}
