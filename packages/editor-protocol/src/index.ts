/**
 * Shared protocol surface for fps-game-editor packages and project adapters.
 *
 * This package intentionally contains no project schema, Babylon import, or
 * Forge Play implementation dependency. Runtime packages may depend on these
 * contracts; game projects provide adapters for project-specific semantics.
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject { [key: string]: JsonValue | undefined }

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type Position3D = Vec3;
export type Scale3D = Vec3;
export type Rotation3D = Vec3;

export interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

export type PersistentBinding = {
  kind: 'sceneNode';
  nodeId: string;
  rootNode: unknown;
};

export type PersistentBindingSnapshot = {
  kind: 'sceneNode';
  nodeId: string;
};

export type RuntimeProp = 'position' | 'rotation' | 'scaling';

export type MaterialRuntimeKind = 'pbr' | 'standard' | 'unknown';

export interface ArtistMaterialTextureRef {
  url?: string;
  textureAssetId?: string;
}

export interface ArtistBaseColorProfile {
  color?: ColorRGB;
  texture?: ArtistMaterialTextureRef;
  brightness?: number;
  saturation?: number;
  contrast?: number;
  hue?: number;
}

export interface ArtistEmissionProfile {
  color?: ColorRGB;
  intensity?: number;
  maskTexture?: ArtistMaterialTextureRef;
}

export interface ArtistMaterialProfile {
  baseColor?: ArtistBaseColorProfile;
  metallic?: number;
  roughness?: number;
  emission?: ArtistEmissionProfile;
}

export type SceneMaterialAssetKind = 'pbr' | 'standard';
export type SceneMaterialAssetSystemPreset = 'default-pbr' | 'default-standard';

export interface SceneMaterialAssetSystemConfig {
  readonly?: boolean;
  preset?: SceneMaterialAssetSystemPreset;
}

export interface SceneMaterialAssetConfig {
  id: string;
  name: string;
  profile: ArtistMaterialProfile;
  materialKind?: SceneMaterialAssetKind;
  system?: SceneMaterialAssetSystemConfig;
}

export interface SceneNodeMaterialBindingConfig {
  materialAssetId?: string;
  override?: ArtistMaterialProfile;
}

export type ArtistMaterialProp =
  | 'material.baseColor.color'
  | 'material.baseColor.texture.url'
  | 'material.baseColor.brightness'
  | 'material.baseColor.saturation'
  | 'material.baseColor.contrast'
  | 'material.baseColor.hue'
  | 'material.emission.color'
  | 'material.emission.intensity'
  | 'material.emission.maskTexture.url';

export type MaterialProp =
  | 'material.albedoColor'
  | 'material.emissiveColor'
  | 'material.metallic'
  | 'material.roughness'
  | 'material.alpha'
  | 'material.backFaceCulling'
  | 'material.albedoTexture.url'
  | 'material.normalTexture.url'
  | 'material.metallicTexture.url'
  | 'material.pbr.albedoColor'
  | 'material.pbr.baseWeight'
  | 'material.pbr.reflectivityColor'
  | 'material.pbr.microSurface'
  | 'material.pbr.emissiveColor'
  | 'material.pbr.ambientColor'
  | 'material.pbr.lightFalloff'
  | 'material.standard.diffuseColor'
  | 'material.standard.specularColor'
  | 'material.standard.specularPower'
  | 'material.standard.emissiveColor'
  | 'material.standard.ambientColor'
  | 'material.standard.useSpecularOverAlpha';

export type MaterialValue = ColorRGB | number | boolean | string | null;

export interface ResolveArtistMaterialProfileInput {
  originalProfile?: ArtistMaterialProfile | null;
  materialAssets?: readonly SceneMaterialAssetConfig[] | null;
  binding?: SceneNodeMaterialBindingConfig | null;
  legacyProfile?: ArtistMaterialProfile | null;
}

export interface ResolveArtistMaterialProfileResult {
  profile: ArtistMaterialProfile;
  materialAsset: SceneMaterialAssetConfig | null;
  missingMaterialAssetId?: string;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeColorRGB(value: ColorRGB | undefined): ColorRGB | undefined {
  if (!value || !isFiniteNumber(value.r) || !isFiniteNumber(value.g) || !isFiniteNumber(value.b)) return undefined;
  return { r: value.r, g: value.g, b: value.b };
}

function normalizeMaterialTextureRef(value: ArtistMaterialTextureRef | undefined): ArtistMaterialTextureRef | undefined {
  if (!value) return undefined;
  const url = typeof value.url === 'string' ? value.url.trim() : '';
  const textureAssetId = typeof value.textureAssetId === 'string' ? value.textureAssetId.trim() : '';
  if (!url && !textureAssetId) return undefined;
  return {
    ...(url ? { url } : {}),
    ...(textureAssetId ? { textureAssetId } : {}),
  };
}

export function normalizeSceneMaterialAssetKind(value: unknown): SceneMaterialAssetKind | undefined {
  return value === 'pbr' || value === 'standard' ? value : undefined;
}

export function resolveSceneMaterialAssetKind(
  materialAsset: Pick<SceneMaterialAssetConfig, 'materialKind' | 'system'> | null | undefined,
): SceneMaterialAssetKind {
  return normalizeSceneMaterialAssetKind(materialAsset?.materialKind)
    ?? inferSceneMaterialAssetKindFromSystemPreset(materialAsset?.system?.preset)
    ?? 'pbr';
}

export function normalizeSceneMaterialAssetSystemConfig(
  value: SceneMaterialAssetSystemConfig | null | undefined,
): SceneMaterialAssetSystemConfig | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const preset = value.preset === 'default-pbr' || value.preset === 'default-standard'
    ? value.preset
    : undefined;
  const readonly = value.readonly === true;
  if (!preset && !readonly) return undefined;
  return {
    ...(readonly ? { readonly } : {}),
    ...(preset ? { preset } : {}),
  };
}

export function isReadonlySceneMaterialAsset(
  materialAsset: Pick<SceneMaterialAssetConfig, 'system'> | null | undefined,
): boolean {
  return materialAsset?.system?.readonly === true;
}

function inferSceneMaterialAssetKindFromSystemPreset(
  preset: unknown,
): SceneMaterialAssetKind | undefined {
  if (preset === 'default-pbr') return 'pbr';
  if (preset === 'default-standard') return 'standard';
  return undefined;
}

export function normalizeArtistMaterialProfile(profile: ArtistMaterialProfile | null | undefined): ArtistMaterialProfile | undefined {
  if (!profile || typeof profile !== 'object') return undefined;

  const normalized: ArtistMaterialProfile = {};
  const baseColor: ArtistBaseColorProfile = {};
  const color = normalizeColorRGB(profile.baseColor?.color);
  if (color) baseColor.color = color;
  const texture = normalizeMaterialTextureRef(profile.baseColor?.texture);
  if (texture) baseColor.texture = texture;
  if (isFiniteNumber(profile.baseColor?.brightness)) baseColor.brightness = profile.baseColor.brightness;
  if (isFiniteNumber(profile.baseColor?.saturation)) baseColor.saturation = profile.baseColor.saturation;
  if (isFiniteNumber(profile.baseColor?.contrast)) baseColor.contrast = profile.baseColor.contrast;
  if (isFiniteNumber(profile.baseColor?.hue)) baseColor.hue = profile.baseColor.hue;
  if (Object.keys(baseColor).length > 0) normalized.baseColor = baseColor;

  if (isFiniteNumber(profile.metallic)) normalized.metallic = profile.metallic;
  if (isFiniteNumber(profile.roughness)) normalized.roughness = profile.roughness;

  const emission: ArtistEmissionProfile = {};
  const emissionColor = normalizeColorRGB(profile.emission?.color);
  if (emissionColor) emission.color = emissionColor;
  if (isFiniteNumber(profile.emission?.intensity)) emission.intensity = profile.emission.intensity;
  const maskTexture = normalizeMaterialTextureRef(profile.emission?.maskTexture);
  if (maskTexture) emission.maskTexture = maskTexture;
  if (Object.keys(emission).length > 0) normalized.emission = emission;

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function normalizeSceneMaterialAssetConfig(
  materialAsset: SceneMaterialAssetConfig | null | undefined,
): SceneMaterialAssetConfig | undefined {
  if (!materialAsset || typeof materialAsset !== 'object') return undefined;
  const id = typeof materialAsset.id === 'string' ? materialAsset.id.trim() : '';
  const name = typeof materialAsset.name === 'string' ? materialAsset.name.trim() : '';
  const profile = normalizeArtistMaterialProfile(materialAsset.profile);
  if (!id || !name || !profile) return undefined;
  const system = normalizeSceneMaterialAssetSystemConfig(materialAsset.system);
  const materialKind = normalizeSceneMaterialAssetKind(materialAsset.materialKind);
  const presetKind = inferSceneMaterialAssetKindFromSystemPreset(system?.preset);
  if (materialKind && presetKind && materialKind !== presetKind) return undefined;
  return {
    id,
    name,
    profile,
    ...(materialKind ?? presetKind ? { materialKind: materialKind ?? presetKind } : {}),
    ...(system ? { system } : {}),
  };
}

export function mergeArtistMaterialProfiles(
  ...profiles: Array<ArtistMaterialProfile | null | undefined>
): ArtistMaterialProfile {
  const merged: ArtistMaterialProfile = {};
  for (const profile of profiles) {
    const normalized = normalizeArtistMaterialProfile(profile);
    if (!normalized) continue;
    if (normalized.baseColor) {
      merged.baseColor = {
        ...(merged.baseColor ?? {}),
        ...normalized.baseColor,
      };
    }
    if (normalized.metallic !== undefined) merged.metallic = normalized.metallic;
    if (normalized.roughness !== undefined) merged.roughness = normalized.roughness;
    if (normalized.emission) {
      merged.emission = {
        ...(merged.emission ?? {}),
        ...normalized.emission,
      };
    }
  }
  return normalizedOrEmpty(merged);
}

export function findSceneMaterialAsset(
  materialAssets: readonly SceneMaterialAssetConfig[] | null | undefined,
  materialAssetId: string | null | undefined,
): SceneMaterialAssetConfig | null {
  const id = typeof materialAssetId === 'string' ? materialAssetId.trim() : '';
  if (!id || !materialAssets) return null;
  return materialAssets.find(asset => asset.id === id) ?? null;
}

export function resolveArtistMaterialProfile(
  input: ResolveArtistMaterialProfileInput,
): ResolveArtistMaterialProfileResult {
  const materialAssetId = typeof input.binding?.materialAssetId === 'string'
    ? input.binding.materialAssetId.trim()
    : '';
  const materialAsset = findSceneMaterialAsset(input.materialAssets, materialAssetId);
  const profile = mergeArtistMaterialProfiles(
    input.originalProfile,
    materialAsset?.profile,
    input.binding?.override,
    input.legacyProfile,
  );
  return {
    profile,
    materialAsset,
    ...(materialAssetId && !materialAsset ? { missingMaterialAssetId: materialAssetId } : {}),
  };
}

function normalizedOrEmpty(profile: ArtistMaterialProfile): ArtistMaterialProfile {
  return normalizeArtistMaterialProfile(profile) ?? {};
}

export type OutlineProp =
  | 'outline.renderOutline'
  | 'outline.outlineWidth'
  | 'outline.outlineColor';

export type OutlineValue = ColorRGB | number | boolean | null;

export interface EditorDocumentExport {
  sceneJsonText: string;
  expectedVersion?: number;
  version?: number;
}

export interface EditorDocumentCommitArgs {
  version?: number;
  updatedAt?: string;
  sceneJsonText?: string;
  scenePath?: string;
}

export interface EditorDuplicateResult {
  rootNode?: unknown;
}

export type EditorTool = 'pick' | 'move' | 'rotate' | 'scale';
export type EditorMode = 'edit' | 'play';
export type RuntimeOwner = 'project' | 'legacy' | 'unknown';
export type SelectionSource = 'viewport' | 'tree' | 'programmatic' | 'unknown';

export interface EditorRuntimeApi {
  active?: boolean;
  init(scene: unknown): void;
  showInspector(): Promise<void> | void;
  hideInspector(): void;
  setTool?(tool: EditorTool): void;
  getSelectedEntity?(): unknown | null;
  selectEntity?(entity: unknown | null, syncInspector?: boolean): void;
  duplicateSelected?(): Promise<boolean> | boolean;
  undo(): boolean;
  redo(): boolean;
  exportDocument(): EditorDocumentExport | null;
  commitSavedDocument(args: EditorDocumentCommitArgs): boolean;
}

export interface EditRuntimeApi {
  active?: boolean;
  enter(): Promise<void>;
  exit(save?: boolean): Promise<void>;
  _focusSelected(): void;
  isViewportNavigationActive(): boolean;
}

export interface EditorRuntime {
  owner?: RuntimeOwner;
  Editor: EditorRuntimeApi;
  Edit: EditRuntimeApi;
  handleCommand(name: string, params: Record<string, unknown>): Promise<void> | void;
}

export interface SelectionController {
  createV2SelectionBridge?(v2: unknown): unknown;
  bindSelectionSourceTracking?(): void;
  unbindSelectionSourceTracking?(): void;
  enablePicking?(): void;
  reset?(): void;
  getSelectedEntity?(): unknown | null;
  getSelectedEntities?(): unknown[];
  selectEntity?(
    entity: unknown | null,
    syncInspector?: boolean,
    options?: { additive?: boolean; toggle?: boolean },
  ): void;
}

export type EditorRuntimeChange =
  | {
      kind: 'transform';
      binding: PersistentBindingSnapshot;
      prop: RuntimeProp;
      value: Position3D | Scale3D | Rotation3D;
      rootNode?: unknown;
      selectedRootNode?: unknown | null;
    }
  | {
      kind: 'material';
      binding: PersistentBindingSnapshot;
      prop: MaterialProp;
      value: MaterialValue;
      ownerNodePath: string;
      rootNode?: unknown;
      selectedRootNode?: unknown | null;
    }
  | {
      kind: 'outline';
      binding: PersistentBindingSnapshot;
      prop: OutlineProp;
      value: OutlineValue;
      ownerNodePath: string;
      rootNode?: unknown;
      selectedRootNode?: unknown | null;
    }
  | {
      kind: 'selection';
      selectedRootNode?: unknown | null;
    };

export interface EditorPluginContext {
  scene: unknown | null;
  game: unknown | null;
}

export interface EditorPlugin {
  id: string;
  normalizeSelection?(args: {
    source: SelectionSource;
    rawEntity: unknown;
    context: EditorPluginContext;
  }): unknown | null;
  resolvePersistentBinding?(node: unknown, context: EditorPluginContext): PersistentBinding | null;
  applyDocumentChange?(args: {
    binding: PersistentBinding;
    node: unknown;
    prop: string;
    context: EditorPluginContext;
    oldValue?: unknown;
    newValue?: unknown;
  }): boolean;
  duplicateSelection?(args: {
    binding: PersistentBinding;
    node: unknown;
    context: EditorPluginContext;
  }): EditorDuplicateResult | Promise<EditorDuplicateResult | null> | null;
  isDirty?(): boolean;
  canUndo?(): boolean;
  canRedo?(): boolean;
  undoDocumentChange?(context: EditorPluginContext): EditorRuntimeChange | null;
  redoDocumentChange?(context: EditorPluginContext): EditorRuntimeChange | null;
  exportDocument?(): EditorDocumentExport | null;
  commitSavedDocument?(args: EditorDocumentCommitArgs, context: EditorPluginContext): boolean;
}

export interface EditorMessenger {
  event?(eventName: string, payload: Record<string, unknown>): void;
  send?(type: string, payload: Record<string, unknown>): void;
}

export interface EditorBridgeLike {
  registerEditorPlugin?: (plugin: EditorPlugin) => void;
  registerEditorRuntime?: (runtime: EditorRuntime) => void;
  messenger?: EditorMessenger;
  editor?: unknown;
}

export const EDITOR_COMMAND_NAME = {
  MODE_CHANGE: 'mode.change',
  UNDO: 'history.undo',
  REDO: 'history.redo',
  DOCUMENT_EXPORT: 'document.export',
  DOCUMENT_COMMIT: 'document.commit',
  INSPECTOR_FLUSH: 'inspector.flush',
  ASSET_REGISTRATION_PLAN: 'asset.registration.plan',
  ASSET_UNREGISTRATION_PLAN: 'asset.unregistration.plan',
  ASSET_LIBRARY_REFRESH: 'asset.library.refresh',
  ASSET_IMPORT: 'asset.import',
  EDITOR_ASSET_PLACE: 'editor.asset.place',
  ASSET_REMOVE: 'asset.remove',
  SCENE_NODE_CREATE: 'scene.node.create',
  SCENE_NODE_PATCH: 'scene.node.patch',
  SCENE_NODE_REMOVE: 'scene.node.remove',
  SELECTION_DUPLICATE: 'selection.duplicate',
} as const;

export type EditorCommandName = typeof EDITOR_COMMAND_NAME[keyof typeof EDITOR_COMMAND_NAME];

export const EDITOR_EVENT_NAME = {
  DOCUMENT_EXPORTED: 'document.exported',
  INSPECTOR_FLUSHED: 'inspector.flushed',
  ASSET_REGISTRATION_PLANNED: 'asset.registration.planned',
  ASSET_REGISTRATION_FAILED: 'asset.registration.failed',
  ASSET_UNREGISTRATION_PLANNED: 'asset.unregistration.planned',
  ASSET_UNREGISTRATION_FAILED: 'asset.unregistration.failed',
  ASSET_LIBRARY_REFRESHED: 'asset.library.refreshed',
  ASSET_IMPORT_RESULT: 'asset.import.result',
  EDITOR_ASSET_PLACE_RESULT: 'editor.asset.place.result',
  ASSET_REMOVE_RESULT: 'asset.remove.result',
  SCENE_NODE_CREATE_RESULT: 'scene.node.create.result',
  SCENE_NODE_PATCH_RESULT: 'scene.node.patch.result',
  SCENE_NODE_REMOVE_RESULT: 'scene.node.remove.result',
  MODE_READY: 'mode.ready',
  SELECTION_DUPLICATE_RESULT: 'selection.duplicate.result',
} as const;

export type EditorEventName = typeof EDITOR_EVENT_NAME[keyof typeof EDITOR_EVENT_NAME];

export const EDITOR_POST_MESSAGE = {
  CONTEXT_CHANGE: 'context:change',
} as const;

export type EditorPostMessageType = typeof EDITOR_POST_MESSAGE[keyof typeof EDITOR_POST_MESSAGE];

export const EDITOR_CAPABILITY = {
  SCENE_TREE: 'sceneTree',
  ASSET_IMPORT: 'assetImport',
  ASSET_REGISTRY_WRITE: 'assetRegistryWrite',
  TRANSFORM_GIZMO: 'transformGizmo',
  MATERIAL_EDITING: 'materialEditing',
  OUTLINE_EDITING: 'outlineEditing',
  DOCUMENT_EXPORT: 'documentExport',
  DOCUMENT_COMMIT: 'documentCommit',
  UNDO_REDO: 'undoRedo',
  INSPECTOR: 'inspector',
} as const;

export type EditorCapabilityName = typeof EDITOR_CAPABILITY[keyof typeof EDITOR_CAPABILITY];
export type EditorCapabilities = Partial<Record<EditorCapabilityName, boolean>>;

// Migration aliases matching the current project-side editor-package type names.
export type ProjectPersistentBinding = PersistentBinding;
export type ProjectPersistentBindingSnapshot = PersistentBindingSnapshot;
export type ProjectRuntimeProp = RuntimeProp;
export type ProjectMaterialRuntimeKind = MaterialRuntimeKind;
export type ProjectMaterialProp = MaterialProp;
export type ProjectMaterialValue = MaterialValue;
export type ProjectOutlineProp = OutlineProp;
export type ProjectOutlineValue = OutlineValue;
export type ProjectRotation3D = Rotation3D;
export type ProjectEditorDocumentExport = EditorDocumentExport;
export type ProjectEditorDocumentCommitArgs = EditorDocumentCommitArgs;
export type ProjectEditorDuplicateResult = EditorDuplicateResult;
export type ProjectEditorRuntimeApi = EditorRuntimeApi;
export type ProjectEditRuntimeApi = EditRuntimeApi;
export type ProjectEditorRuntime = EditorRuntime;
export type ProjectSelectionController = SelectionController;
export type ProjectEditorRuntimeChange = EditorRuntimeChange;
export type ProjectEditorPluginContext = EditorPluginContext;
export type ProjectEditorPlugin = EditorPlugin;
