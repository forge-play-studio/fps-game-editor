import {
  createBabylonForgePlayEditor,
  type BabylonForgePlayEditor,
  type EditorAdapterContext,
  type EditorDocumentAdapter,
  type SceneAdapter,
} from '@fps-games/editor';
import type { BabylonRuntimeGlobal } from '@fps-games/editor-babylon';
import type { EditorRuntime, PersistentBinding } from '@fps-games/editor-protocol';

import { lumberOrderEditorPlugin } from './plugin';
import {
  applyProjectDocumentChange,
  applyProjectMaterialDocumentChange,
  applyProjectOutlineDocumentChange,
  beginProjectEditorTransformBatch,
  canRedoProjectEditorDocumentChange,
  canUndoProjectEditorDocumentChange,
  commitProjectEditorDocumentSave,
  endProjectEditorTransformBatch,
  ensureProjectEditorDocumentLoaded,
  exportProjectEditorDocument,
  isProjectEditorDocumentDirty,
  redoProjectEditorDocumentChange,
  undoProjectEditorDocumentChange,
} from './document';
import { createLumberOrderFpsGameEditorAssetAdapter } from './asset-adapter';
import type {
  ProjectEditorPluginContext,
  ProjectPersistentBinding,
} from './types';

// Legacy Forge Play bridge entry for runtime-scene editing. The new local
// EditorWorld path is driven by @fps-games/editor createLocalEditorHarness().
export interface LumberOrderFpsGameEditorRuntimeOptions {
  autoRegister?: boolean;
  scene?: unknown | (() => unknown | null) | null;
  game?: unknown | (() => unknown | null) | null;
  canvas?: HTMLCanvasElement | string | null;
  babylon?: BabylonRuntimeGlobal | null;
}

function resolveOptionValue<T>(value: T | (() => T)): T {
  return typeof value === 'function' ? (value as () => T)() : value;
}

function resolveWindowGame(): unknown | null {
  return (window as any).gameInstance ?? null;
}

function resolveGame(options: LumberOrderFpsGameEditorRuntimeOptions): unknown | null {
  if (options.game !== undefined) return resolveOptionValue(options.game) ?? null;
  return resolveWindowGame();
}

function resolveScene(options: LumberOrderFpsGameEditorRuntimeOptions): unknown | null {
  if (options.scene !== undefined) return resolveOptionValue(options.scene) ?? null;
  const game = resolveGame(options) as any;
  return game?.scene ?? null;
}

function resolveBabylonRuntime(options: LumberOrderFpsGameEditorRuntimeOptions): BabylonRuntimeGlobal | null {
  if (options.babylon !== undefined) return options.babylon;
  return (window as any).BABYLON ?? null;
}

function resolveProjectPluginContext(
  options: LumberOrderFpsGameEditorRuntimeOptions,
  context?: EditorAdapterContext,
): ProjectEditorPluginContext {
  const game = context?.game ?? resolveGame(options);
  const scene = context?.scene ?? resolveScene(options);
  return { scene, game };
}

function castBinding(binding: PersistentBinding | null): ProjectPersistentBinding | null {
  return binding as ProjectPersistentBinding | null;
}

function registerLumberOrderEditorPlugin(): void {
  ensureProjectEditorDocumentLoaded();
  window.__pendingEditorPlugin = lumberOrderEditorPlugin;
  window.__bridge?.registerEditorPlugin?.(lumberOrderEditorPlugin);
}

function createDocumentAdapter(options: LumberOrderFpsGameEditorRuntimeOptions): EditorDocumentAdapter {
  return {
    ensureLoaded(): void {
      ensureProjectEditorDocumentLoaded();
    },
    isDirty(): boolean {
      return isProjectEditorDocumentDirty();
    },
    canUndo(): boolean {
      return canUndoProjectEditorDocumentChange();
    },
    canRedo(): boolean {
      return canRedoProjectEditorDocumentChange();
    },
    getStatus() {
      return {
        dirty: isProjectEditorDocumentDirty(),
        canUndo: canUndoProjectEditorDocumentChange(),
        canRedo: canRedoProjectEditorDocumentChange(),
      };
    },
    exportDocument() {
      return exportProjectEditorDocument();
    },
    commitSavedDocument(args) {
      return commitProjectEditorDocumentSave(args, resolveProjectPluginContext(options));
    },
    undo() {
      return undoProjectEditorDocumentChange(resolveProjectPluginContext(options)) as any;
    },
    redo() {
      return redoProjectEditorDocumentChange(resolveProjectPluginContext(options)) as any;
    },
    applyTransformChange(change) {
      const binding = castBinding(change.binding);
      if (!binding || !change.runtimeNode) return false;
      return applyProjectDocumentChange(
        binding,
        change.runtimeNode,
        change.prop,
        change.before,
        change.after,
      );
    },
    applyMaterialChange(change) {
      return applyProjectMaterialDocumentChange(change as any);
    },
    applyOutlineChange(change) {
      return applyProjectOutlineDocumentChange(change as any);
    },
    beginTransformBatch(): void {
      beginProjectEditorTransformBatch();
    },
    endTransformBatch(): void {
      endProjectEditorTransformBatch();
    },
  };
}

function createSceneAdapter(options: LumberOrderFpsGameEditorRuntimeOptions): SceneAdapter {
  return {
    normalizeSelection({ source, rawEntity, context }) {
      return (lumberOrderEditorPlugin.normalizeSelection?.({
        source,
        rawEntity,
        context: resolveProjectPluginContext(options, context),
      }) ?? rawEntity) as any;
    },
    duplicateSelected({ selected, binding, context }) {
      const projectBinding = castBinding(binding);
      if (!projectBinding || !selected) return null;
      return lumberOrderEditorPlugin.duplicateSelection?.({
        binding: projectBinding,
        node: selected,
        context: resolveProjectPluginContext(options, context),
      }) ?? null;
    },
  };
}

export function createLumberOrderFpsGameEditorRuntimeBridge(
  options: LumberOrderFpsGameEditorRuntimeOptions = {},
): BabylonForgePlayEditor {
  registerLumberOrderEditorPlugin();

  let runtime: EditorRuntime | null = null;
  const editor = createBabylonForgePlayEditor({
    autoRegister: false,
    registerLegacyProxy: false,
    installLegacyBypass: false,
    scene: () => resolveScene(options),
    game: () => resolveGame(options) as any,
    canvas: options.canvas ?? 'renderCanvas',
    babylon: resolveBabylonRuntime(options),
    documentAdapter: createDocumentAdapter(options),
    persistentBindingAdapter: {
      resolveBinding(node, context) {
        return lumberOrderEditorPlugin.resolvePersistentBinding?.(
          node,
          resolveProjectPluginContext(options, context),
        ) as PersistentBinding | null ?? null;
      },
    },
    sceneAdapter: createSceneAdapter(options),
    assetAdapter: createLumberOrderFpsGameEditorAssetAdapter({
      selectRuntimeNode(node) {
        runtime?.Editor.selectEntity?.(node, true);
      },
    }),
    capabilities: {
      assetImport: true,
      assetRegistryWrite: true,
      documentCommit: true,
      documentExport: true,
      inspector: true,
      materialEditing: true,
      outlineEditing: true,
      sceneTree: true,
      transformGizmo: true,
      undoRedo: true,
    },
  });

  runtime = editor.runtime;
  if (options.autoRegister !== false) editor.register();
  return editor;
}

export function registerLumberOrderFpsGameEditorRuntimeBridge(): BabylonForgePlayEditor {
  return createLumberOrderFpsGameEditorRuntimeBridge();
}
