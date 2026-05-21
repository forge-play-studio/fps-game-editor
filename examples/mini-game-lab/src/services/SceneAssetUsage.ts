import sceneJsonV2Rules from '../config/scene-json-v2-rules.json';
import { getProjectEditorWorkingDocument } from '../fps-game-editor-adapter/document';
import {
  AssetManagerError,
  sanitizeSourceId,
} from './assets/core/AssetManagerCore';

export interface SceneAssetUsage {
  sourceId: string;
  assetIds: string[];
  nodeIds: string[];
}

export function findSceneAssetUsageBySourceId(sourceId: string): SceneAssetUsage {
  const normalizedSourceId = sanitizeSourceId(sourceId);
  const workingCopy = getProjectEditorWorkingDocument();
  const assets = Array.isArray(workingCopy.scene?.assets) ? workingCopy.scene.assets : [];
  const nodes = Array.isArray(workingCopy.scene?.nodes) ? workingCopy.scene.nodes : [];
  const assetIds = assets
    .filter((asset) => asset.sourceId === normalizedSourceId)
    .map((asset) => asset.id);
  const assetIdSet = new Set(assetIds);
  const nodeIds = nodes
    .filter((node) => node.kind === 'instance' && assetIdSet.has(node.instance?.assetId ?? ''))
    .map((node) => node.id);
  return {
    sourceId: normalizedSourceId,
    assetIds,
    nodeIds,
  };
}

export function assertSceneAssetSourceUnused(sourceId: string): void {
  const usage = findSceneAssetUsageBySourceId(sourceId);
  if (usage.nodeIds.length === 0) return;
  throw new AssetManagerError(
    sceneJsonV2Rules.errorCodes.assetStillReferenced,
    `Source id "${usage.sourceId}" is still referenced by scene nodes`,
  );
}
