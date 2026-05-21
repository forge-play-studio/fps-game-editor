import fs from 'node:fs/promises';
import path from 'node:path';
import {
  assert,
} from '../lib/assertions.mjs';
import { runAssetUnregister } from '../lib/asset-register.mjs';
import {
  assertImportedAssetScene,
  assertSceneMissingAsset,
  assertSceneMissingNode,
  enterEditMode,
  exportScene,
  registerAndImportAsset,
  waitForRuntimeInitializedAfter,
  waitForProjectReady,
} from './helpers.mjs';

export async function run(ctx) {
  const requestId = `sim-unregister-${Date.now()}`;
  await waitForProjectReady(ctx);
  await enterEditMode(ctx, `${requestId}-edit`);

  const { registered, importResult } = await registerAndImportAsset(ctx, {
    requestId,
    assetName: 'sim-unregister-asset.glb',
    position: { x: -3, y: 0, z: -2 },
  });

  const importedScene = await exportScene(ctx, `${requestId}-export-imported`);
  assertImportedAssetScene(importedScene, { registered, nodeId: importResult.nodeId });

  await ctx.bridge.command('asset.remove', {
    requestId,
    nodeId: importResult.nodeId,
  });
  const removeResult = await ctx.bridge.waitForEvent('asset.remove.result', { requestId, timeoutMs: 15000 });
  assert(removeResult.ok === true, 'asset remove failed before unregister', removeResult);

  const removedScene = await exportScene(ctx, `${requestId}-export-removed`);
  assertSceneMissingNode(removedScene, importResult.nodeId);
  assertSceneMissingAsset(removedScene, registered.assetId);

  await ctx.bridge.command('asset.unregistration.plan', {
    requestId,
    sourceId: registered.sourceId,
  });
  const plan = await ctx.bridge.waitForEvent('asset.unregistration.planned', { requestId, timeoutMs: 15000 });
  assert(
    plan.sourceId === registered.sourceId
      && Array.isArray(plan.transportPlan?.writes)
      && plan.transportPlan.writes.length > 0
      && Array.isArray(plan.transportPlan?.commands)
      && plan.transportPlan.commands.length > 0,
    'invalid asset unregister plan',
    plan,
  );

  const beforeUnregisterState = await ctx.bridge.state().catch(() => null);
  const beforeRuntimeInitializedCount = beforeUnregisterState?.ready?.runtimeInitializedCount ?? 0;
  const unregistered = await runAssetUnregister({
    workspaceRoot: ctx.workspaceRoot,
    plan,
  });
  assert(unregistered.ok === true && unregistered.removed === true, 'asset unregister failed', unregistered);
  await waitForRuntimeInitializedAfter(ctx, beforeRuntimeInitializedCount);

  const manifestPath = path.join(ctx.workspaceRoot, 'src/assets/generated/model-registry.manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  assert(
    !manifest.some((entry) => entry.sourceId === registered.sourceId),
    'manifest still contains unregistered sourceId',
    { sourceId: registered.sourceId, manifest },
  );

  return {
    ok: true,
    sourceId: registered.sourceId,
    assetId: registered.assetId,
    removedNodeId: importResult.nodeId,
    unregistered: true,
  };
}
