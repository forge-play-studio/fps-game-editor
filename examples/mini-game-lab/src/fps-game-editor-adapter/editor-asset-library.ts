import type { SceneAssetDefaults, SceneAssetMaterialMode } from '../config';
import type {
  EditorSceneAsset,
  EditorSceneAssetLibraryItem,
  EditorSceneDocument,
} from './editor-scene-document';

interface ProjectEditorAssetMetadata {
  assetId?: string;
  displayName?: string;
  category?: string;
  materialMode?: SceneAssetMaterialMode;
  defaults?: SceneAssetDefaults;
  metadata?: Record<string, unknown>;
}

const DEFAULT_OUTLINE = {
  renderOutline: true,
  outlineWidth: 0.04,
  outlineColor: { r: 0.03, g: 0.03, b: 0.03 },
} as const;

const PROJECT_EDITOR_ASSET_METADATA: Record<string, ProjectEditorAssetMetadata> = {
  peeler: {
    assetId: 'asset_peeler',
    displayName: '削皮器',
    category: 'Building',
    defaults: {
      transform: { scale: 0.5 },
      childOutlines: {
        '__root__/model/Build_Xuepiqi01': DEFAULT_OUTLINE,
      },
    },
  },
  fence: {
    assetId: 'asset_fence',
    displayName: '围栏',
    category: 'Building',
    defaults: {
      transform: { scale: 0.5 },
      outline: DEFAULT_OUTLINE,
    },
  },
  board_compressor_lv1: {
    assetId: 'asset_compressor',
    displayName: '木板压缩机',
    category: 'Building',
    defaults: {
      transform: { scale: 0.5 },
    },
  },
  tree_lv1: {
    assetId: 'asset_tree_lv1',
    displayName: '一级树',
    category: 'Nature',
    defaults: {
      transform: { scale: 0.5 },
    },
  },
  tree_lv2: {
    assetId: 'asset_tree_lv2',
    displayName: '二级树',
    category: 'Nature',
    defaults: {
      transform: { scale: 0.5 },
    },
  },
  tree_lv3_songshu: {
    assetId: 'asset_tree_lv3_songshu',
    displayName: '树三级',
    category: 'Nature',
    defaults: {
      transform: { scale: 1 },
    },
  },
  door_leaf: {
    assetId: 'asset_door',
    displayName: '门',
    category: 'Building',
    defaults: {
      outline: DEFAULT_OUTLINE,
    },
  },
  curb_straight: {
    assetId: 'asset_curb_straight',
    displayName: '路牙_直',
    category: 'Ground',
    defaults: {
      transform: { scale: 0.5 },
    },
  },
  plank: {
    assetId: 'asset_plank',
    displayName: '木板',
    category: 'Building',
    defaults: {
      transform: { scale: 0.62 },
      childOutlines: {
        '__root__/node0': DEFAULT_OUTLINE,
      },
    },
  },
  axe: {
    assetId: 'asset_axe',
    displayName: '斧子',
    category: 'Tool',
    defaults: {
      transform: { scale: 0.72 },
    },
  },
  curb_inner: {
    assetId: 'asset_curb_inner',
    displayName: '路牙_内',
    category: 'Ground',
    defaults: {
      transform: { scale: 0.5 },
    },
  },
  cash_bill: {
    assetId: 'asset_cash_bill',
    displayName: '美钞',
    category: 'Economy',
    defaults: {
      transform: { scale: 1.5 },
    },
  },
  curb_outer: {
    assetId: 'asset_curb_outer',
    displayName: '路牙_外',
    category: 'Ground',
    defaults: {
      transform: { scale: 0.5 },
    },
  },
};

export function createProjectEditorAssetLibrary(sourceIds: string[]): EditorSceneAssetLibraryItem[] {
  return [...new Set(sourceIds)]
    .filter((sourceId): sourceId is string => typeof sourceId === 'string' && !!sourceId.trim())
    .sort((a, b) => a.localeCompare(b))
    .map((sourceId) => createProjectEditorAssetLibraryItem(sourceId));
}

export function enrichEditorSceneDocumentAssets(
  editorScene: EditorSceneDocument,
  assetLibrary: EditorSceneAssetLibraryItem[],
): EditorSceneDocument {
  const libraryBySourceId = new Map(assetLibrary.map((asset) => [asset.sourceId, asset]));
  return {
    ...editorScene,
    assets: editorScene.assets.map((asset) => {
      const libraryItem = libraryBySourceId.get(asset.sourceId);
      return libraryItem ? mergeEditorSceneAssetWithLibraryItem(asset, libraryItem) : asset;
    }),
  };
}

export function mergeEditorSceneAssetWithLibraryItem(
  asset: EditorSceneAsset,
  libraryItem: EditorSceneAssetLibraryItem,
): EditorSceneAsset {
  return {
    ...asset,
    displayName: libraryItem.displayName || asset.displayName,
    category: libraryItem.category ?? asset.category,
    materialMode: libraryItem.materialMode ?? asset.materialMode,
    defaults: cloneOptional(libraryItem.defaults ?? asset.defaults),
    metadata: cloneOptional(libraryItem.metadata ?? asset.metadata),
  };
}

function createProjectEditorAssetLibraryItem(sourceId: string): EditorSceneAssetLibraryItem {
  const metadata = PROJECT_EDITOR_ASSET_METADATA[sourceId];
  return {
    assetId: metadata?.assetId ?? `asset_${sanitizeEditorAssetId(sourceId)}`,
    type: 'glb',
    sourceId,
    displayName: metadata?.displayName ?? toEditorAssetDisplayName(sourceId),
    category: metadata?.category ?? inferEditorAssetCategory(sourceId),
    materialMode: metadata?.materialMode,
    defaults: cloneOptional(metadata?.defaults),
    metadata: cloneOptional(metadata?.metadata),
    placeable: true,
  };
}

function sanitizeEditorAssetId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    || 'asset';
}

function toEditorAssetDisplayName(sourceId: string): string {
  return sourceId
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function inferEditorAssetCategory(sourceId: string): string {
  if (sourceId.includes('tree') || sourceId.includes('log') || sourceId.includes('wood')) return 'Nature';
  if (sourceId.includes('truck') || sourceId.includes('car')) return 'Vehicle';
  if (sourceId.includes('ground') || sourceId.includes('plane') || sourceId.includes('curb') || sourceId.includes('diban')) return 'Ground';
  if (sourceId.includes('door') || sourceId.includes('fence') || sourceId.includes('mill') || sourceId.includes('table') || sourceId.includes('platform')) return 'Building';
  if (sourceId.includes('bear') || sourceId.includes('character')) return 'Character';
  return 'Model';
}

function cloneOptional<T>(value: T | undefined): T | undefined {
  return value == null ? undefined : structuredClone(value);
}
