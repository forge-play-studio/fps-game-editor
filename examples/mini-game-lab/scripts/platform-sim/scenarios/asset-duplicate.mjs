import {
  assertImportedAssetScene,
  enterEditMode,
  exportScene,
  registerAndImportAsset,
  waitForProjectReady,
} from './helpers.mjs';
import { assertSceneContainsNode } from '../lib/assertions.mjs';

export async function run(ctx) {
  const requestId = `sim-duplicate-${Date.now()}`;
  await waitForProjectReady(ctx);
  await enterEditMode(ctx, `${requestId}-edit`);

  const { registered, importResult } = await registerAndImportAsset(ctx, {
    requestId,
    assetName: 'sim-duplicate-asset.glb',
    position: { x: 2, y: 0, z: 2 },
  });

  await ctx.bridge.command('selection.duplicate', { requestId });
  const duplicate = await ctx.bridge.waitForEvent('selection.duplicate.result', { requestId, timeoutMs: 20000 });
  if (!duplicate.ok || !duplicate.nodeId) {
    throw new Error(`duplicate_failed:${JSON.stringify(duplicate)}`);
  }

  const sceneConfig = await exportScene(ctx, `${requestId}-export`);
  assertImportedAssetScene(sceneConfig, { registered, nodeId: importResult.nodeId });
  assertSceneContainsNode(sceneConfig, { nodeId: duplicate.nodeId, assetId: registered.assetId });

  return {
    ok: true,
    sourceId: registered.sourceId,
    assetId: registered.assetId,
    originalNodeId: importResult.nodeId,
    duplicateNodeId: duplicate.nodeId,
  };
}
