import type {
  Scale3D,
  SceneAssetConfig,
  SceneAssetMaterialMode,
} from '../../../config';

export interface AssetManagerMetadataRule {
  key: string;
  value: unknown;
}

export interface AssetManagerErrorCodes {
  assetIdConflict: string;
  sourceIdConflict: string;
  assetStillReferenced: string;
  missingSourceId: string;
  nodeNotFound: string;
  [key: string]: string;
}

export interface AssetManagerCoreRules {
  metadata: AssetManagerMetadataRule;
  errorCodes: AssetManagerErrorCodes;
}

export interface AssetIdentityInput {
  sourceId: string;
  assetId?: string;
}

export interface AssetBuildInput extends AssetIdentityInput {
  assetName?: string;
  displayName?: string;
  category?: string;
  materialMode?: SceneAssetMaterialMode;
  scale?: number | Scale3D;
  defaultScale?: number | Scale3D;
  metadata?: Record<string, unknown>;
}

export interface AssetBuildResult {
  sourceId: string;
  assetId: string;
  displayName: string;
  category?: string;
  materialMode?: SceneAssetMaterialMode;
  scale?: number | Scale3D;
  metadata?: Record<string, unknown>;
}

export interface AssetRegistrationPlanInput extends Omit<AssetBuildInput, 'sourceId'> {
  requestId?: string;
  assetPath?: string;
  assetUrl?: string;
  sourceId?: string;
  payloadPath?: string;
  registerCommand?: string;
}

export interface AssetRegistrationPayload {
  sourcePath?: string;
  assetPath?: string;
  assetUrl?: string;
  sourceId: string;
  assetId: string;
  assetName: string;
  displayName: string;
  category?: string;
  materialMode?: SceneAssetMaterialMode;
  scale?: number | Scale3D;
  metadata?: Record<string, unknown>;
}

export interface AssetTransportWrite {
  path: string;
  contentType: 'application/json' | 'text/plain';
  content: unknown;
}

export interface AssetTransportCommand {
  cmd: string;
  cwd?: string;
  timeoutMs?: number;
}

export interface AssetTransportPlan {
  writes: AssetTransportWrite[];
  commands: AssetTransportCommand[];
}

export interface AssetRegistrationPlanCore {
  requestId?: string;
  sourceId: string;
  assetId: string;
  displayName: string;
  transportPlan: AssetTransportPlan;
  sceneAsset: SceneAssetConfig;
}

export interface AssetUnregistrationPlanInput {
  requestId?: string;
  sourceId?: string;
  payloadPath?: string;
  deleteFile?: boolean;
  unregisterCommand?: string;
}

export interface AssetUnregistrationPlanCore {
  requestId?: string;
  sourceId: string;
  transportPlan: AssetTransportPlan;
}

export interface AssetCatalogSnapshot {
  assets: SceneAssetConfig[];
}

export class AssetManagerError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AssetManagerError';
  }
}

export function sanitizeSourceId(value: unknown): string {
  const raw = String(value ?? '').replace(/\.glb$/i, '').trim().toLowerCase();
  const sanitized = raw
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');
  return sanitized || `asset_${Date.now().toString(36)}`;
}

/** Compare sourceIds ignoring hyphen/underscore difference */
function matchSourceId(a: string, b: string): boolean {
  if (a === b) return true;
  return a.replace(/[-_]/g, '') === b.replace(/[-_]/g, '');
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function readScale(value: unknown): number | Scale3D | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const x = readNumber(record.x);
  const y = readNumber(record.y);
  const z = readNumber(record.z);
  if (x == null || y == null || z == null || x <= 0 || y <= 0 || z <= 0) return undefined;
  return { x, y, z };
}

export function resolveAssetIdentity(
  snapshot: AssetCatalogSnapshot,
  params: AssetIdentityInput,
  rules: AssetManagerCoreRules,
): { sourceId: string; assetId: string } {
  const requestedSourceId = sanitizeSourceId(params.sourceId);
  const requestedAssetId = params.assetId?.trim();
  // Match existing assets with hyphen/underscore normalization
  const existingBySource = snapshot.assets.find((asset) => matchSourceId(asset.sourceId, requestedSourceId));

  if (requestedAssetId) {
    const existingByAsset = snapshot.assets.find((asset) => asset.id === requestedAssetId);
    if (existingByAsset && existingByAsset.sourceId !== requestedSourceId) {
      throw new AssetManagerError(
        rules.errorCodes.assetIdConflict,
        `Asset id "${requestedAssetId}" already points to source "${existingByAsset.sourceId}"`,
      );
    }
    if (existingBySource && existingBySource.id !== requestedAssetId) {
      throw new AssetManagerError(
        rules.errorCodes.sourceIdConflict,
        `Source id "${requestedSourceId}" already uses asset id "${existingBySource.id}"`,
      );
    }
    return { sourceId: requestedSourceId, assetId: requestedAssetId };
  }

  if (existingBySource) {
    return { sourceId: existingBySource.sourceId, assetId: existingBySource.id };
  }

  let sourceId = requestedSourceId;
  let assetId = `asset_${sourceId}`;
  let suffix = 2;
  while (snapshot.assets.some((asset) => asset.id === assetId && asset.sourceId !== sourceId)) {
    sourceId = `${requestedSourceId}_${suffix}`;
    assetId = `asset_${sourceId}`;
    suffix += 1;
  }
  return { sourceId, assetId };
}

export function buildAssetArgs(
  snapshot: AssetCatalogSnapshot,
  params: AssetBuildInput,
  rules: AssetManagerCoreRules,
): AssetBuildResult {
  const identity = resolveAssetIdentity(snapshot, { sourceId: params.sourceId, assetId: params.assetId }, rules);
  const displayName = params.displayName?.trim()
    || params.assetName?.replace(/\.glb$/i, '').trim()
    || toTitle(identity.sourceId);
  const category = params.category?.trim();
  const materialMode = readMaterialMode(params.materialMode);
  const scale = readScale(params.defaultScale ?? params.scale);
  const metadata = readMetadata(params.metadata);
  return {
    ...identity,
    displayName,
    ...(category ? { category } : {}),
    ...(materialMode ? { materialMode } : {}),
    ...(scale ? { scale } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

export function createSceneAsset(args: AssetBuildResult, rules: AssetManagerCoreRules): SceneAssetConfig {
  return {
    id: args.assetId,
    type: 'glb',
    sourceId: args.sourceId,
    displayName: args.displayName,
    ...(args.category ? { category: args.category } : {}),
    ...(args.materialMode ? { materialMode: args.materialMode } : {}),
    ...(args.scale ? { defaults: { transform: { scale: args.scale } } } : {}),
    metadata: {
      ...(args.metadata ?? {}),
      [rules.metadata.key]: rules.metadata.value,
    },
  };
}

export function planAssetRegistrationCore(
  snapshot: AssetCatalogSnapshot,
  params: AssetRegistrationPlanInput,
  rules: AssetManagerCoreRules,
): AssetRegistrationPlanCore {
  const assetName = params.assetName || params.assetPath?.split('/').pop() || params.sourceId || 'imported_asset.glb';
  const assetArgs = buildAssetArgs(
    snapshot,
    {
      sourceId: sanitizeSourceId(params.sourceId ?? assetName),
      assetId: params.assetId,
      assetName,
      displayName: params.displayName,
      category: params.category,
      materialMode: params.materialMode,
      scale: params.scale,
      defaultScale: params.defaultScale,
      metadata: params.metadata,
    },
    rules,
  );
  const requestId = params.requestId;
  const payloadPath = params.payloadPath ?? `/tmp/forge-play-asset-${requestId ?? assetArgs.sourceId}.json`;
  const sceneAsset = createSceneAsset(assetArgs, rules);
  const registerCommand = params.registerCommand ?? 'npm run asset:register';
  const payload: AssetRegistrationPayload = {
    ...(params.assetPath ? { sourcePath: params.assetPath, assetPath: params.assetPath } : {}),
    ...(params.assetUrl ? { assetUrl: params.assetUrl } : {}),
    sourceId: assetArgs.sourceId,
    assetId: assetArgs.assetId,
    assetName,
    displayName: assetArgs.displayName,
    ...(assetArgs.category ? { category: assetArgs.category } : {}),
    ...(assetArgs.materialMode ? { materialMode: assetArgs.materialMode } : {}),
    ...(assetArgs.scale ? { scale: assetArgs.scale } : {}),
    ...(assetArgs.metadata ? { metadata: assetArgs.metadata } : {}),
  };
  const script = `${registerCommand} -- --payload ${payloadPath}`;

  return {
    ...(requestId ? { requestId } : {}),
    sourceId: assetArgs.sourceId,
    assetId: assetArgs.assetId,
    displayName: assetArgs.displayName,
    transportPlan: {
      writes: [
        {
          path: payloadPath,
          contentType: 'application/json',
          content: payload,
        },
      ],
      commands: [
        {
          cmd: script,
          cwd: '.',
          timeoutMs: 60000,
        },
      ],
    },
    sceneAsset,
  };
}

export function planAssetUnregistrationCore(
  params: AssetUnregistrationPlanInput,
  rules: AssetManagerCoreRules,
): AssetUnregistrationPlanCore {
  if (typeof params.sourceId !== 'string' || !params.sourceId.trim()) {
    throw new AssetManagerError(rules.errorCodes.missingSourceId, 'Missing sourceId for asset unregistration');
  }
  const sourceId = sanitizeSourceId(params.sourceId);
  const requestId = params.requestId;
  const payloadPath = params.payloadPath ?? `/tmp/forge-play-asset-unregister-${requestId ?? sourceId}.json`;
  const deleteFile = params.deleteFile !== false;
  const unregisterCommand = params.unregisterCommand ?? 'npm run asset:unregister';
  const payload = {
    sourceId,
    deleteFile,
  };
  const script = `${unregisterCommand} -- --payload ${payloadPath}`;
  return {
    ...(requestId ? { requestId } : {}),
    sourceId,
    transportPlan: {
      writes: [
        {
          path: payloadPath,
          contentType: 'application/json',
          content: payload,
        },
      ],
      commands: [
        {
          cmd: script,
          cwd: '.',
          timeoutMs: 60000,
        },
      ],
    },
  };
}

function toTitle(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((item) => `${item.charAt(0).toUpperCase()}${item.slice(1)}`)
    .join(' ');
}

function readMaterialMode(value: unknown): SceneAssetMaterialMode | undefined {
  return value === 'shared' || value === 'instance' ? value : undefined;
}

function readMetadata(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}
