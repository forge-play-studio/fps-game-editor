import type { SceneAssetDefaults, SceneAssetMaterialMode } from '../config';
import type { AuthoringSourceRef } from '@fps-games/editor-core';

export interface EditorSceneVec3 {
  x: number;
  y: number;
  z: number;
}

export interface EditorSceneAsset {
  id: string;
  type: 'glb';
  sourceId: string;
  displayName?: string;
  category?: string;
  materialMode?: SceneAssetMaterialMode;
  defaults?: SceneAssetDefaults;
  metadata?: Record<string, unknown>;
}

export interface EditorSceneAssetLibraryItem {
  assetId: string;
  type: 'glb';
  sourceId: string;
  displayName: string;
  category?: string;
  materialMode?: SceneAssetMaterialMode;
  defaults?: SceneAssetDefaults;
  metadata?: Record<string, unknown>;
  placeable: boolean;
}

export interface EditorSceneTransformComponent {
  type: 'Transform';
  position: EditorSceneVec3;
  rotation: EditorSceneVec3;
  scale?: EditorSceneVec3;
}

export interface EditorSceneModelRendererComponent {
  type: 'ModelRenderer';
  assetId: string;
}

export type EditorSceneComponent =
  | EditorSceneTransformComponent
  | EditorSceneModelRendererComponent;

export interface EditorSceneGameObject {
  id: string;
  name?: string;
  parentId?: string;
  active?: boolean;
  components: EditorSceneComponent[];
}

export interface EditorSceneDocument {
  schemaVersion: 1;
  meta?: {
    name?: string;
    authoringSource?: AuthoringSourceRef;
    [key: string]: unknown;
  };
  assets: EditorSceneAsset[];
  scene: {
    gameObjects: EditorSceneGameObject[];
  };
}

export interface EditorSceneTransformPatch {
  position?: EditorSceneVec3;
  rotation?: EditorSceneVec3;
  scale?: EditorSceneVec3;
}

export function cloneEditorSceneDocument(document: EditorSceneDocument): EditorSceneDocument {
  return structuredClone(document);
}

export function findEditorSceneTransform(
  gameObject: EditorSceneGameObject,
): EditorSceneTransformComponent | null {
  return gameObject.components.find(
    (component): component is EditorSceneTransformComponent => component.type === 'Transform',
  ) ?? null;
}

export function findEditorSceneModelRenderer(
  gameObject: EditorSceneGameObject,
): EditorSceneModelRendererComponent | null {
  return gameObject.components.find(
    (component): component is EditorSceneModelRendererComponent => component.type === 'ModelRenderer',
  ) ?? null;
}

export function patchEditorSceneGameObjectTransform(
  document: EditorSceneDocument,
  gameObjectId: string,
  patch: EditorSceneTransformPatch,
): EditorSceneDocument {
  return {
    ...document,
    scene: {
      ...document.scene,
      gameObjects: document.scene.gameObjects.map((gameObject) => {
        if (gameObject.id !== gameObjectId) return gameObject;
        return {
          ...gameObject,
          components: gameObject.components.map((component) => {
            if (component.type !== 'Transform') return component;
            return {
              ...component,
              position: patch.position ?? component.position,
              rotation: patch.rotation ?? component.rotation,
              scale: patch.scale ?? component.scale,
            };
          }),
        };
      }),
    },
  };
}
