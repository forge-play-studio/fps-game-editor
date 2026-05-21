import {
  assertImportedAssetScene,
  assertSceneMissingNode,
  enterEditMode,
  exportScene,
  registerAndImportAsset,
  waitForProjectReady,
} from './helpers.mjs';

export async function run(ctx) {
  const requestId = `sim-undo-redo-${Date.now()}`;
  await waitForProjectReady(ctx);
  await enterEditMode(ctx, `${requestId}-edit`);

  const { registered, importResult } = await registerAndImportAsset(ctx, {
    requestId,
    assetName: 'sim-undo-redo-asset.glb',
    position: { x: 4, y: 0, z: 2 },
  });

  const importedScene = await exportScene(ctx, `${requestId}-export-imported`);
  assertImportedAssetScene(importedScene, { registered, nodeId: importResult.nodeId });

  await ctx.bridge.command('history.undo', { requestId: `${requestId}-undo` });
  await ctx.bridge.expectCommandCompleted('history.undo', `${requestId}-undo`, 15000);
  const undoScene = await exportScene(ctx, `${requestId}-export-undo`);
  assertSceneMissingNode(undoScene, importResult.nodeId);

  await ctx.bridge.command('history.redo', { requestId: `${requestId}-redo` });
  await ctx.bridge.expectCommandCompleted('history.redo', `${requestId}-redo`, 15000);
  const redoScene = await exportScene(ctx, `${requestId}-export-redo`);
  assertImportedAssetScene(redoScene, { registered, nodeId: importResult.nodeId });

  return {
    ok: true,
    sourceId: registered.sourceId,
    assetId: registered.assetId,
    nodeId: importResult.nodeId,
  };
}
