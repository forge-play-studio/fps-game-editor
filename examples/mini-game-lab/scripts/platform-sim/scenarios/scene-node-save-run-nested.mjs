import { writeSceneJsonCommit } from '../lib/scene-commit.mjs';
import { assert } from '../lib/assertions.mjs';
import { assertSceneJsonV2 } from '../lib/scene-json-v2-schema.mjs';
import {
  enterEditMode,
  exportScene,
  waitForProjectReady,
} from './helpers.mjs';

async function createNode(ctx, requestId, payload) {
  await ctx.bridge.command('scene.node.create', { requestId, ...payload });
  const result = await ctx.bridge.waitForEvent('scene.node.create.result', { requestId, timeoutMs: 15000 });
  assert(result.ok === true && result.nodeId, 'scene node create should succeed', { requestId, result });
  return result;
}

export async function run(ctx) {
  const requestId = `sim-save-run-nested-${Date.now()}`;
  await waitForProjectReady(ctx);
  await enterEditMode(ctx, `${requestId}-edit`);

  const group = await createNode(ctx, `${requestId}-group`, {
    kind: 'group',
    id: 'sim_save_run_group',
    name: 'Sim Save Run Group',
  });
  const fence = await createNode(ctx, `${requestId}-fence`, {
    kind: 'instance',
    id: 'sim_save_run_fence',
    name: 'Sim Save Run Fence',
    parentId: group.nodeId,
    instance: { assetId: 'asset_fence' },
  });
  const compressor = await createNode(ctx, `${requestId}-compressor`, {
    kind: 'instance',
    id: 'sim_save_run_compressor',
    name: 'Sim Save Run Compressor',
    parentId: fence.nodeId,
    instance: { assetId: 'asset_compressor' },
  });
  const peeler = await createNode(ctx, `${requestId}-peeler`, {
    kind: 'instance',
    id: 'sim_save_run_peeler',
    name: 'Sim Save Run Peeler',
    parentId: compressor.nodeId,
    instance: { assetId: 'asset_peeler' },
  });
  const childFence = await createNode(ctx, `${requestId}-child-fence`, {
    kind: 'instance',
    id: 'sim_save_run_child_fence',
    name: 'Sim Save Run Child Fence',
    parentId: peeler.nodeId,
    instance: { assetId: 'asset_fence' },
  });

  const sceneConfig = await exportScene(ctx, `${requestId}-export`);
  assertSceneJsonV2(sceneConfig, {
    strictNodeIds: [group.nodeId, fence.nodeId, compressor.nodeId, peeler.nodeId, childFence.nodeId],
  });

  const nodes = sceneConfig.scene.nodes;
  const fenceNode = nodes.find((node) => node.id === fence.nodeId);
  const compressorNode = nodes.find((node) => node.id === compressor.nodeId);
  const peelerNode = nodes.find((node) => node.id === peeler.nodeId);
  const childFenceNode = nodes.find((node) => node.id === childFence.nodeId);
  assert(fenceNode?.parentId === group.nodeId, 'fence parentId not persisted before save', { fenceNode, group });
  assert(compressorNode?.parentId === fence.nodeId, 'compressor parentId not persisted before save', { compressorNode, fence });
  assert(peelerNode?.parentId === compressor.nodeId, 'peeler parentId not persisted before save', { peelerNode, compressor });
  assert(childFenceNode?.parentId === peeler.nodeId, 'child fence parentId not persisted before save', { childFenceNode, peeler });

  const commit = await writeSceneJsonCommit({
    workspaceRoot: ctx.workspaceRoot,
    sceneJsonText: JSON.stringify(sceneConfig, null, 2),
  });
  await ctx.bridge.command('document.commit', {
    requestId: `${requestId}-commit`,
    version: commit.version,
    updatedAt: commit.updatedAt,
    sceneJsonText: commit.sceneJsonText,
    scenePath: commit.scenePath,
  });
  await ctx.bridge.expectCommandCompleted('document.commit', `${requestId}-commit`, 15000);
  await ctx.bridge.waitForMessage(
    'context:change',
    '(payload) => payload && payload.documentStatus && payload.documentStatus.dirty === false',
    { timeoutMs: 15000 },
  );

  await ctx.bridge.command('mode.change', {
    requestId: `${requestId}-save-run`,
    mode: 'play',
    save: true,
  });
  const modeReady = await ctx.bridge.waitForEvent('mode.ready', {
    requestId: `${requestId}-save-run`,
    timeoutMs: 30000,
  });
  assert(modeReady.mode === 'play', 'save-and-run did not return to play mode', { modeReady });

  const savedScene = JSON.parse(commit.sceneJsonText);
  assertSceneJsonV2(savedScene, {
    strictNodeIds: [group.nodeId, fence.nodeId, compressor.nodeId, peeler.nodeId, childFence.nodeId],
  });
  const savedNodes = savedScene.scene.nodes;
  assert(savedNodes.find((node) => node.id === childFence.nodeId)?.parentId === peeler.nodeId, 'saved scene lost nested parentId', savedScene);

  return {
    ok: true,
    mode: modeReady.mode,
    groupNodeId: group.nodeId,
    fenceNodeId: fence.nodeId,
    compressorNodeId: compressor.nodeId,
    peelerNodeId: peeler.nodeId,
    childFenceNodeId: childFence.nodeId,
  };
}
