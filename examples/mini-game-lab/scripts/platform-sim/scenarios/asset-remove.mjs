import {
  assertImportedAssetScene,
  assertSceneMissingNode,
  enterEditMode,
  exportScene,
  registerAndImportAsset,
  waitForProjectReady,
} from './helpers.mjs';

export async function run(ctx) {
  const requestId = `sim-remove-${Date.now()}`;
  await waitForProjectReady(ctx);
  await enterEditMode(ctx, `${requestId}-edit`);

  const { registered, importResult } = await registerAndImportAsset(ctx, {
    requestId,
    assetName: 'sim-remove-asset.glb',
    position: { x: 3, y: 0, z: 2 },
  });

  const importedScene = await exportScene(ctx, `${requestId}-export-imported`);
  assertImportedAssetScene(importedScene, { registered, nodeId: importResult.nodeId });

  await ctx.bridge.command('asset.remove', {
    requestId,
    nodeId: importResult.nodeId,
  });
  const removeResult = await ctx.bridge.waitForEvent('asset.remove.result', { requestId, timeoutMs: 15000 });
  if (!removeResult.ok) {
    throw new Error(`asset_remove_failed:${JSON.stringify(removeResult)}`);
  }

  const sceneConfig = await exportScene(ctx, `${requestId}-export-removed`);
  assertSceneMissingNode(sceneConfig, importResult.nodeId);

  return {
    ok: true,
    sourceId: registered.sourceId,
    assetId: registered.assetId,
    removedNodeId: importResult.nodeId,
  };
}
