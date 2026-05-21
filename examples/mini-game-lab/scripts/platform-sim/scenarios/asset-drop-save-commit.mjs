import { writeSceneJsonCommit } from '../lib/scene-commit.mjs';
import {
  assertImportedAssetScene,
  enterEditMode,
  exportScene,
  reloadProject,
  registerAndImportAsset,
  waitForProjectReady,
} from './helpers.mjs';

export async function run(ctx) {
  const requestId = `sim-asset-${Date.now()}`;
  const exportRequestId = `sim-export-${Date.now()}`;
  const secondModeRequestId = `${requestId}-mode-2`;
  const commitRequestId = `${requestId}-commit`;

  await waitForProjectReady(ctx);
  await enterEditMode(ctx, secondModeRequestId);
  const { registered, importResult } = await registerAndImportAsset(ctx, {
    requestId,
    assetName: 'sim-sample-asset.glb',
    position: { x: 1, y: 0, z: 2 },
  });

  const sceneConfig = await exportScene(ctx, exportRequestId);
  assertImportedAssetScene(sceneConfig, { registered, nodeId: importResult.nodeId });

  const commit = await writeSceneJsonCommit({
    workspaceRoot: ctx.workspaceRoot,
    sceneJsonText: JSON.stringify(sceneConfig, null, 2),
  });

  await ctx.bridge.command('document.commit', {
    requestId: commitRequestId,
    version: commit.version,
    updatedAt: commit.updatedAt,
    sceneJsonText: commit.sceneJsonText,
    scenePath: commit.scenePath,
  });
  await ctx.bridge.expectCommandCompleted('document.commit', commitRequestId, 15000);
  await ctx.bridge.waitForMessage(
    'context:change',
    '(payload) => payload && payload.documentStatus && payload.documentStatus.dirty === false',
    { timeoutMs: 15000 },
  );
  await reloadProject(ctx, 60000);

  return {
    ok: true,
    sourceId: registered.sourceId,
    assetId: registered.assetId,
    nodeId: importResult.nodeId,
    scenePath: commit.scenePath,
  };
}
