export function assert(condition, message, details) {
  if (condition) return;
  const suffix = details ? `\n${JSON.stringify(details, null, 2)}` : '';
  throw new Error(`assertion_failed:${message}${suffix}`);
}

export function assertSceneContainsAsset(sceneConfig, { sourceId, assetId }) {
  const assets = Array.isArray(sceneConfig.scene?.assets) ? sceneConfig.scene.assets : [];
  assert(
    assets.some((asset) => asset.id === assetId && asset.sourceId === sourceId),
    'scene.assets missing imported asset',
    { sourceId, assetId, assets },
  );
}

export function assertSceneContainsNode(sceneConfig, { nodeId, assetId }) {
  const nodes = Array.isArray(sceneConfig.scene?.nodes) ? sceneConfig.scene.nodes : [];
  assert(
    nodes.some((node) => node.id === nodeId && node.kind === 'instance' && node.instance?.assetId === assetId),
    'scene.nodes missing imported node',
    { nodeId, assetId, nodes: nodes.slice(-10) },
  );
}

export function assertImportedSceneNodeUsesV2(sceneConfig, { nodeId, assetId }) {
  const nodes = Array.isArray(sceneConfig.scene?.nodes) ? sceneConfig.scene.nodes : [];
  const node = nodes.find((item) => item.id === nodeId);
  assert(node, 'imported scene node not found for V2 assertion', { nodeId });
  assert(node.kind === 'instance', 'imported scene node is not an instance', { node });
  assert(node.instance?.assetId === assetId, 'imported scene node points to unexpected assetId', { node, assetId });
  const serialized = JSON.stringify(node);
  const forbidden = ['/@fs', 'assetUrl', 'sourceAssetUrl', 'sourceAssetPath'];
  const found = forbidden.filter((token) => serialized.includes(token));
  assert(found.length === 0, 'imported V2 scene node contains runtime-only asset URL fields', { found, node });
}
