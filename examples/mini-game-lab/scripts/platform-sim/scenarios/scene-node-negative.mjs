import { assert } from '../lib/assertions.mjs';
import { assertSceneJsonV2 } from '../lib/scene-json-v2-schema.mjs';
import {
  enterEditMode,
  exportScene,
  waitForProjectReady,
} from './helpers.mjs';

async function expectSceneNodeResult(ctx, eventName, requestId, code) {
  const result = await ctx.bridge.waitForEvent(eventName, { requestId, timeoutMs: 15000 });
  assert(result.ok === false, `${eventName} should fail`, result);
  assert(result.code === code, `${eventName} returned unexpected error code`, { expected: code, result });
  return result;
}

async function createNode(ctx, requestId, payload) {
  await ctx.bridge.command('scene.node.create', { requestId, ...payload });
  const result = await ctx.bridge.waitForEvent('scene.node.create.result', { requestId, timeoutMs: 15000 });
  assert(result.ok === true && result.nodeId, 'scene node create should succeed', { requestId, result });
  return result;
}

export async function run(ctx) {
  const requestId = `sim-scene-node-negative-${Date.now()}`;
  await waitForProjectReady(ctx);
  await enterEditMode(ctx, `${requestId}-edit`);

  await ctx.bridge.command('scene.node.create', {
    requestId: `${requestId}-invalid-kind`,
    kind: 'unknownNodeKind',
    id: 'bad_kind_node',
  });
  await expectSceneNodeResult(
    ctx,
    'scene.node.create.result',
    `${requestId}-invalid-kind`,
    'invalid_scene_node_kind',
  );

  const groupA = await createNode(ctx, `${requestId}-group-a`, {
    kind: 'group',
    id: 'sim_negative_group_a',
  });
  const groupB = await createNode(ctx, `${requestId}-group-b`, {
    kind: 'group',
    id: 'sim_negative_group_b',
    parentId: groupA.nodeId,
  });
  const decal = await createNode(ctx, `${requestId}-decal`, {
    kind: 'transform',
    id: 'sim_negative_decal',
    parentId: groupA.nodeId,
    transformType: 'groundDecal',
    groundDecal: {
      size: { width: 2, depth: 2 },
      color: { r: 1, g: 1, b: 1 },
    },
  });

  const transformChild = await createNode(ctx, `${requestId}-transform-child`, {
    kind: 'group',
    id: 'sim_negative_transform_child',
    parentId: decal.nodeId,
  });
  assert(transformChild.nodeId, 'transform child should be allowed by scene hierarchy policy', transformChild);

  await ctx.bridge.command('scene.node.create', {
    requestId: `${requestId}-missing-parent`,
    kind: 'group',
    id: 'bad_missing_parent_group',
    parentId: 'missing_parent_node',
  });
  await expectSceneNodeResult(
    ctx,
    'scene.node.create.result',
    `${requestId}-missing-parent`,
    'invalid_scene_node_parent',
  );

  await ctx.bridge.command('scene.node.create', {
    requestId: `${requestId}-missing-asset`,
    kind: 'instance',
    id: 'bad_missing_asset',
    instance: { assetId: 'asset_missing_from_scene' },
  });
  await expectSceneNodeResult(
    ctx,
    'scene.node.create.result',
    `${requestId}-missing-asset`,
    'invalid_scene_node_field_value',
  );

  await ctx.bridge.command('scene.node.patch', {
    requestId: `${requestId}-cycle`,
    nodeId: groupA.nodeId,
    path: 'parentId',
    value: groupB.nodeId,
  });
  await expectSceneNodeResult(
    ctx,
    'scene.node.patch.result',
    `${requestId}-cycle`,
    'scene_node_parent_cycle',
  );

  await ctx.bridge.command('scene.node.patch', {
    requestId: `${requestId}-unsupported-path`,
    nodeId: decal.nodeId,
    path: 'groundDecal.unknownField',
    value: 1,
  });
  await expectSceneNodeResult(
    ctx,
    'scene.node.patch.result',
    `${requestId}-unsupported-path`,
    'unsupported_scene_node_field',
  );

  await ctx.bridge.command('scene.node.patch', {
    requestId: `${requestId}-invalid-delete`,
    nodeId: decal.nodeId,
    path: 'groundDecal.size.width',
    value: null,
  });
  await expectSceneNodeResult(
    ctx,
    'scene.node.patch.result',
    `${requestId}-invalid-delete`,
    'invalid_scene_node_field_delete',
  );

  await ctx.bridge.command('scene.node.patch', {
    requestId: `${requestId}-empty-patch`,
    nodeId: decal.nodeId,
    patches: [],
  });
  await expectSceneNodeResult(
    ctx,
    'scene.node.patch.result',
    `${requestId}-empty-patch`,
    'scene_node_patch_empty',
  );

  await ctx.bridge.command('scene.node.patch', {
    requestId: `${requestId}-missing-node-patch`,
    nodeId: 'missing_scene_node',
    path: 'enabled',
    value: true,
  });
  await expectSceneNodeResult(
    ctx,
    'scene.node.patch.result',
    `${requestId}-missing-node-patch`,
    'node_not_found',
  );

  await ctx.bridge.command('scene.node.remove', {
    requestId: `${requestId}-missing-node-remove`,
    nodeId: 'missing_scene_node',
  });
  await expectSceneNodeResult(
    ctx,
    'scene.node.remove.result',
    `${requestId}-missing-node-remove`,
    'node_not_found',
  );

  const sceneConfig = await exportScene(ctx, `${requestId}-export`);
  assertSceneJsonV2(sceneConfig, {
    strictNodeIds: [groupA.nodeId, groupB.nodeId, decal.nodeId],
  });

  return {
    ok: true,
    groupANodeId: groupA.nodeId,
    groupBNodeId: groupB.nodeId,
    decalNodeId: decal.nodeId,
  };
}
