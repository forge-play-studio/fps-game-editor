import type {
  Scale3D,
  SceneAssetConfig,
  SceneAssetMaterialMode,
} from '../config';
import sceneJsonV2Rules from '../config/scene-json-v2-rules.json';
import { projectAssetCatalogAdapter } from './assets/adapters/ProjectAssetCatalogAdapter';
import {
  buildAssetArgs,
  createSceneAsset,
  planAssetRegistrationCore,
  planAssetUnregistrationCore,
  type AssetManagerCoreRules,
  type AssetRegistrationPlanCore,
  type AssetTransportCommand,
  type AssetTransportPlan,
  type AssetTransportWrite,
  type AssetUnregistrationPlanCore,
} from './assets/core/AssetManagerCore';

export interface AssetRegistrationPlanParams {
  requestId?: string;
  assetName?: string;
  assetPath?: string;
  assetUrl?: string;
  sourceId?: string;
  assetId?: string;
  displayName?: string;
  category?: string;
  materialMode?: SceneAssetMaterialMode;
  scale?: number | Scale3D;
  defaultScale?: number | Scale3D;
  metadata?: Record<string, unknown>;
  payloadPath?: string;
}

export type AssetRegistrationPlan = AssetRegistrationPlanCore;

export interface AssetUnregistrationPlanParams {
  requestId?: string;
  sourceId?: string;
  payloadPath?: string;
  deleteFile?: boolean;
}

export type AssetUnregistrationPlan = AssetUnregistrationPlanCore;

export interface AssetReferenceParams {
  sourceId: string;
  assetId?: string;
  assetName?: string;
  displayName?: string;
  category?: string;
  materialMode?: SceneAssetMaterialMode;
  scale?: number | Scale3D;
  defaultScale?: number | Scale3D;
  metadata?: Record<string, unknown>;
}

export interface AssetReference {
  sourceId: string;
  assetId: string;
  displayName: string;
  asset: SceneAssetConfig;
}

const ASSET_MANAGER_RULES: AssetManagerCoreRules = {
  metadata: sceneJsonV2Rules.assetManagerMetadata,
  errorCodes: sceneJsonV2Rules.errorCodes,
};

export const ASSET_MANAGER_ERROR_CODES = ASSET_MANAGER_RULES.errorCodes;
export type AssetManagerErrorCode = typeof ASSET_MANAGER_ERROR_CODES[keyof typeof ASSET_MANAGER_ERROR_CODES];
export type {
  AssetTransportCommand,
  AssetTransportPlan,
  AssetTransportWrite,
};

function getAssetCatalogSnapshot() {
  return {
    assets: projectAssetCatalogAdapter.getAssets(),
  };
}

export function planAssetRegistration(params: AssetRegistrationPlanParams): AssetRegistrationPlan {
  return planAssetRegistrationCore(getAssetCatalogSnapshot(), params, ASSET_MANAGER_RULES);
}

export function planAssetUnregistration(params: AssetUnregistrationPlanParams): AssetUnregistrationPlan {
  return planAssetUnregistrationCore(params, ASSET_MANAGER_RULES);
}

export function resolveAssetReference(params: AssetReferenceParams): AssetReference {
  const assetArgs = buildAssetArgs(getAssetCatalogSnapshot(), params, ASSET_MANAGER_RULES);
  const asset = createSceneAsset(assetArgs, ASSET_MANAGER_RULES);
  return {
    sourceId: assetArgs.sourceId,
    assetId: assetArgs.assetId,
    displayName: assetArgs.displayName,
    asset,
  };
}
