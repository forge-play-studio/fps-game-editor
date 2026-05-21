import path from 'node:path';
import {
  assert,
  assertImportedSceneNodeUsesV2,
  assertSceneContainsAsset,
  assertSceneContainsNode,
} from '../lib/assertions.mjs';
import { runAssetRegister } from '../lib/asset-register.mjs';
import { assertSceneJsonV2 } from '../lib/scene-json-v2-schema.mjs';

export async function waitForProjectReady(ctx) {
  const state = await ctx.bridge.state().catch(() => null);
  const ready = state?.ready ?? {};
  if (!ready.bridgeInstalled) await ctx.bridge.waitForEvent('mock.bridge.installed', { timeoutMs: 20000 });
  if (!ready.runtimeRegistered) await ctx.bridge.waitForEvent('mock.runtime.registered', { timeoutMs: 90000 });
  if (!ready.sceneReady) await ctx.bridge.waitForEvent('mock.scene.ready', { timeoutMs: 90000 });
  if (!ready.runtimeInitialized) await ctx.bridge.waitForEvent('mock.runtime.initialized', { timeoutMs: 10000 });
}

export async function waitForRuntimeInitializedAfter(ctx, previousCount, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await ctx.bridge.state().catch(() => null);
    const count = state?.ready?.runtimeInitializedCount ?? 0;
    if (count > previousCount) return count;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const trace = await ctx.bridge.trace().catch(() => null);
  throw new Error(`runtime_initialized_after_timeout:${previousCount}\n${JSON.stringify(trace, null, 2)}`);
}

export async function reloadProject(ctx, timeoutMs = 90000) {
  const stateBeforeReload = await ctx.bridge.state().catch(() => null);
  const initializedCountBeforeReload = stateBeforeReload?.ready?.runtimeInitializedCount ?? 0;
  await ctx.bridge.cdp.evaluate(`(() => {
    const frame = document.getElementById('game-frame');
    if (!frame) throw new Error('game_frame_not_found');
    frame.src = frame.src;
    return true;
  })()`);
  return waitForRuntimeInitializedAfter(ctx, initializedCountBeforeReload, timeoutMs);
}

export async function enterEditMode(ctx, requestId) {
  let lastError = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await waitForProjectReady(ctx);
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 500));
    await ctx.bridge.command('mode.change', { requestId, mode: 'edit' });
    try {
      await ctx.bridge.waitForEvent('mode.ready', { requestId, timeoutMs: 20000 });
      return;
    } catch (error) {
      lastError = error;
      if (!String(error?.message ?? error).startsWith('wait_for_event_timeout:mode.ready:')) throw error;
    }
  }
  throw lastError ?? new Error(`mode_ready_timeout:${requestId}`);
}

export async function registerAndImportAsset(ctx, {
  requestId,
  assetName,
  sourceFile = 'asset.glb',
  position = { x: 0, y: 0, z: 0 },
}) {
  const sourcePath = path.join(ctx.workspaceRoot, 'src/assets/models', sourceFile);
  await ctx.bridge.command('asset.registration.plan', {
    requestId,
    assetPath: sourcePath,
    assetName,
  });
  const plan = await ctx.bridge.waitForEvent('asset.registration.planned', { requestId, timeoutMs: 60000 });
  assertTransportPlan(plan, 'invalid asset registration plan');

  const registered = await runAssetRegister({
    workspaceRoot: ctx.workspaceRoot,
    plan,
    sourcePath,
  });
  assert(registered.sourceId && registered.assetId && registered.assetUrl, 'invalid asset register result', registered);

  await reloadProject(ctx, 90000);
  await new Promise((resolve) => setTimeout(resolve, 500));
  await enterEditMode(ctx, `${requestId}-edit-after-register`);

  await ctx.bridge.command('asset.import', {
    requestId,
    sourceId: registered.sourceId,
    assetId: registered.assetId,
    assetUrl: registered.assetUrl,
    assetName,
    position,
  });
  const importResult = await ctx.bridge.waitForEvent('asset.import.result', { requestId, timeoutMs: 60000 });
  assert(importResult.ok === true, 'asset import failed', importResult);
  assert(importResult.nodeId, 'asset import result missing nodeId', importResult);

  return {
    registered,
    importResult,
  };
}

export function assertTransportPlan(plan, message = 'invalid transport plan') {
  assert(plan?.sourceId && plan?.assetId, message, plan);
  assert(Array.isArray(plan.transportPlan?.writes) && plan.transportPlan.writes.length > 0, message, plan);
  assert(Array.isArray(plan.transportPlan?.commands) && plan.transportPlan.commands.length > 0, message, plan);
}

export async function exportScene(ctx, requestId) {
  await ctx.bridge.command('document.export', { requestId });
  const exported = await ctx.bridge.waitForEvent('document.exported', { requestId });
  assert(typeof exported.sceneJsonText === 'string' && exported.sceneJsonText.trim(), 'missing sceneJsonText', exported);
  return JSON.parse(exported.sceneJsonText);
}

export function assertImportedAssetScene(sceneConfig, { registered, nodeId }) {
  assertSceneContainsAsset(sceneConfig, registered);
  assertSceneContainsNode(sceneConfig, { nodeId, assetId: registered.assetId });
  assertImportedSceneNodeUsesV2(sceneConfig, { nodeId, assetId: registered.assetId });
  assertSceneJsonV2(sceneConfig, {
    strictAssetIds: [registered.assetId],
    strictNodeIds: [nodeId],
  });
}

export function assertSceneMissingNode(sceneConfig, nodeId) {
  const nodes = Array.isArray(sceneConfig.scene?.nodes) ? sceneConfig.scene.nodes : [];
  assert(!nodes.some((node) => node.id === nodeId), 'scene still contains removed node', { nodeId });
}

export function assertSceneMissingAsset(sceneConfig, assetId) {
  const assets = Array.isArray(sceneConfig.scene?.assets) ? sceneConfig.scene.assets : [];
  assert(!assets.some((asset) => asset.id === assetId), 'scene still contains removed asset', { assetId });
}
