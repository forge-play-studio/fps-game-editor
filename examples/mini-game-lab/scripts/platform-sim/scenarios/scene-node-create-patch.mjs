import {
  assert,
} from '../lib/assertions.mjs';
import { assertSceneJsonV2 } from '../lib/scene-json-v2-schema.mjs';
import {
  enterEditMode,
  exportScene,
  waitForProjectReady,
} from './helpers.mjs';

export async function run(ctx) {
  const requestId = `sim-scene-node-${Date.now()}`;
  await waitForProjectReady(ctx);
  await enterEditMode(ctx, `${requestId}-edit`);

  await ctx.bridge.command('scene.node.create', {
    requestId: `${requestId}-group`,
    kind: 'group',
    id: 'sim_layout_group',
    name: 'Sim Layout Group',
  });
  const groupResult = await ctx.bridge.waitForEvent('scene.node.create.result', {
    requestId: `${requestId}-group`,
    timeoutMs: 15000,
  });
  assert(groupResult.ok === true && groupResult.nodeId, 'group create failed', groupResult);

  await ctx.bridge.command('scene.node.create', {
    requestId: `${requestId}-decal`,
    kind: 'transform',
    id: 'sim_ground_decal',
    name: 'Sim Ground Decal',
    parentId: groupResult.nodeId,
    transformType: 'groundDecal',
    transform: {
      position: { x: 2, y: 0.01, z: -2 },
      rotationDeg: { x: 0, y: 45, z: 0 },
    },
    groundDecal: {
      size: { width: 2, depth: 3 },
      color: { r: 0.2, g: 0.7, b: 1 },
      alphaIndex: 2,
    },
  });
  const decalResult = await ctx.bridge.waitForEvent('scene.node.create.result', {
    requestId: `${requestId}-decal`,
    timeoutMs: 15000,
  });
  assert(decalResult.ok === true && decalResult.nodeId, 'groundDecal create failed', decalResult);

  await ctx.bridge.command('scene.node.create', {
    requestId: `${requestId}-light`,
    kind: 'transform',
    id: 'sim_light_marker',
    name: 'Sim Light Marker',
    parentId: groupResult.nodeId,
    transformType: 'light',
    transform: {
      position: { x: -2, y: 4, z: 1 },
    },
  });
  const lightResult = await ctx.bridge.waitForEvent('scene.node.create.result', {
    requestId: `${requestId}-light`,
    timeoutMs: 15000,
  });
  assert(lightResult.ok === true && lightResult.nodeId, 'light marker create failed', lightResult);

  await ctx.bridge.command('scene.node.create', {
    requestId: `${requestId}-nested-group`,
    kind: 'group',
    id: 'sim_decal_child_group',
    name: 'Sim Decal Child Group',
    parentId: decalResult.nodeId,
  });
  const nestedGroupResult = await ctx.bridge.waitForEvent('scene.node.create.result', {
    requestId: `${requestId}-nested-group`,
    timeoutMs: 15000,
  });
  assert(nestedGroupResult.ok === true && nestedGroupResult.nodeId, 'nested group under transform create failed', nestedGroupResult);

  await ctx.bridge.command('scene.node.create', {
    requestId: `${requestId}-instance-parent`,
    kind: 'instance',
    id: 'sim_instance_parent',
    name: 'Sim Instance Parent',
    parentId: groupResult.nodeId,
    instance: { assetId: 'asset_fence' },
  });
  const instanceParentResult = await ctx.bridge.waitForEvent('scene.node.create.result', {
    requestId: `${requestId}-instance-parent`,
    timeoutMs: 15000,
  });
  assert(instanceParentResult.ok === true && instanceParentResult.nodeId, 'instance parent create failed', instanceParentResult);

  await ctx.bridge.command('scene.node.create', {
    requestId: `${requestId}-instance-child`,
    kind: 'transform',
    id: 'sim_instance_child_transform',
    name: 'Sim Instance Child Transform',
    parentId: instanceParentResult.nodeId,
    transformType: 'plain',
    transform: {
      position: { x: 0.5, y: 0, z: 0.5 },
    },
  });
  const instanceChildResult = await ctx.bridge.waitForEvent('scene.node.create.result', {
    requestId: `${requestId}-instance-child`,
    timeoutMs: 15000,
  });
  assert(instanceChildResult.ok === true && instanceChildResult.nodeId, 'child transform under instance create failed', instanceChildResult);

  await ctx.bridge.command('scene.node.patch', {
    requestId: `${requestId}-patch`,
    nodeId: decalResult.nodeId,
    patches: [
      { path: 'groundDecal.size.width', value: 4 },
      { path: 'groundDecal.color', value: { r: 1, g: 0.5, b: 0.15 } },
      { path: 'transform.position.x', value: 5 },
      { path: 'enabled', value: true },
    ],
  });
  const patchResult = await ctx.bridge.waitForEvent('scene.node.patch.result', {
    requestId: `${requestId}-patch`,
    timeoutMs: 15000,
  });
  assert(patchResult.ok === true && patchResult.nodeId === decalResult.nodeId, 'scene node patch failed', patchResult);

  const sceneConfig = await exportScene(ctx, `${requestId}-export`);
  assertSceneJsonV2(sceneConfig, {
    strictNodeIds: [
      groupResult.nodeId,
      decalResult.nodeId,
      lightResult.nodeId,
      nestedGroupResult.nodeId,
      instanceParentResult.nodeId,
      instanceChildResult.nodeId,
    ],
  });
  const nodes = sceneConfig.scene.nodes;
  const group = nodes.find((node) => node.id === groupResult.nodeId);
  const decal = nodes.find((node) => node.id === decalResult.nodeId);
  const light = nodes.find((node) => node.id === lightResult.nodeId);
  const nestedGroup = nodes.find((node) => node.id === nestedGroupResult.nodeId);
  const instanceParent = nodes.find((node) => node.id === instanceParentResult.nodeId);
  const instanceChild = nodes.find((node) => node.id === instanceChildResult.nodeId);
  assert(group?.kind === 'group', 'created group missing from scene', { group });
  assert(decal?.kind === 'transform' && decal.transformType === 'groundDecal', 'created groundDecal missing from scene', { decal });
  assert(light?.kind === 'transform' && light.transformType === 'light', 'created light marker missing from scene', { light });
  assert(nestedGroup?.kind === 'group', 'nested group missing from scene', { nestedGroup });
  assert(instanceParent?.kind === 'instance', 'instance parent missing from scene', { instanceParent });
  assert(instanceChild?.kind === 'transform', 'instance child transform missing from scene', { instanceChild });
  assert(decal.parentId === group.id && light.parentId === group.id, 'parentId not persisted', { decal, light, group });
  assert(nestedGroup.parentId === decal.id, 'transform parentId did not persist authored child', { nestedGroup, decal });
  assert(instanceParent.parentId === group.id, 'instance parent did not persist group parent', { instanceParent, group });
  assert(instanceChild.parentId === instanceParent.id, 'instance parent did not persist authored child', { instanceChild, instanceParent });
  assert(decal.groundDecal.size.width === 4, 'groundDecal size patch not persisted', { decal });
  assert(decal.groundDecal.color.r === 1 && decal.transform.position.x === 5, 'field patch not persisted', { decal });

  await ctx.bridge.command('scene.node.remove', {
    requestId: `${requestId}-remove-group`,
    nodeId: groupResult.nodeId,
  });
  const removeResult = await ctx.bridge.waitForEvent('scene.node.remove.result', {
    requestId: `${requestId}-remove-group`,
    timeoutMs: 15000,
  });
  assert(removeResult.ok === true, 'scene node group remove failed', removeResult);
  const removedScene = await exportScene(ctx, `${requestId}-export-removed`);
  const removedNodes = removedScene.scene.nodes;
  assert(!removedNodes.some((node) => node.id === groupResult.nodeId), 'group was not removed', removedScene);
  assert(!removedNodes.some((node) => node.id === decalResult.nodeId), 'group child decal was not removed', removedScene);
  assert(!removedNodes.some((node) => node.id === lightResult.nodeId), 'group child light was not removed', removedScene);
  assert(!removedNodes.some((node) => node.id === nestedGroupResult.nodeId), 'transform child group was not removed', removedScene);
  assert(!removedNodes.some((node) => node.id === instanceParentResult.nodeId), 'instance parent was not removed', removedScene);
  assert(!removedNodes.some((node) => node.id === instanceChildResult.nodeId), 'instance child transform was not removed', removedScene);
  assertSceneJsonV2(removedScene);

  await ctx.bridge.command('history.undo', { requestId: `${requestId}-undo-remove` });
  await ctx.bridge.expectCommandCompleted('history.undo', `${requestId}-undo-remove`, 15000);
  const undoScene = await exportScene(ctx, `${requestId}-export-undo-remove`);
  assertSceneJsonV2(undoScene, {
    strictNodeIds: [
      groupResult.nodeId,
      decalResult.nodeId,
      lightResult.nodeId,
      nestedGroupResult.nodeId,
      instanceParentResult.nodeId,
      instanceChildResult.nodeId,
    ],
  });
  assert(undoScene.scene.nodes.some((node) => node.id === decalResult.nodeId), 'undo did not restore child decal', undoScene);
  assert(undoScene.scene.nodes.some((node) => node.id === nestedGroupResult.nodeId), 'undo did not restore transform child group', undoScene);
  assert(undoScene.scene.nodes.some((node) => node.id === instanceChildResult.nodeId), 'undo did not restore instance child transform', undoScene);

  return {
    ok: true,
    groupNodeId: groupResult.nodeId,
    decalNodeId: decalResult.nodeId,
    lightNodeId: lightResult.nodeId,
    nestedGroupNodeId: nestedGroupResult.nodeId,
    instanceParentNodeId: instanceParentResult.nodeId,
    instanceChildNodeId: instanceChildResult.nodeId,
  };
}
