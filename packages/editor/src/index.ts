import {
  createEditorRuntimeShell,
  type DocumentAdapter,
  type DocumentStatus,
  type LifecycleAdapter,
  type RuntimeEventSink,
} from '@fps-games/editor-core';
import {
  createBrowserHost,
  type BrowserHost,
  type BrowserHostOptions,
} from '@fps-games/editor-browser';
import {
  type BabylonRuntimeGlobal,
  type CanonicalMaterialChange,
  type CanonicalOutlineChange,
  type CanonicalTransformChange,
  type EditorGameLike,
  type EditorRuntimeMonitorChange,
  type RuntimeNode,
  type RuntimeScene,
} from '@fps-games/editor-babylon';
import {
  createEditorEditSession,
  createEditorInspectorHost,
  createEditorRuntimeMonitor,
  createEditorSelectionController,
  setInspectorPickingState,
} from '@fps-games/editor-babylon/legacy-runtime';
import {
  emitForgePlayBridgeEvent,
  installForgePlayBridgeInspectorLoaderPatch,
  installLegacyCommandBypass,
  registerLegacyRuntimeProxy,
  registerForgePlayEditorRuntime,
  sendForgePlayBridgeMessage,
  type ForgePlayBridgeHostOptions,
  type RegisterEditorRuntimeResult,
} from '@fps-games/editor-forge-play';
import {
  EDITOR_COMMAND_NAME,
  EDITOR_EVENT_NAME,
  EDITOR_POST_MESSAGE,
  type EditorCapabilities,
  type EditorDocumentCommitArgs,
  type EditorDocumentExport,
  type EditorRuntime,
  type EditorRuntimeChange,
  type EditorTool,
  type PersistentBinding,
  type SelectionSource,
} from '@fps-games/editor-protocol';

export * from './local-editor-harness';
export * from './authoring-apply';

export type MaybePromise<T> = T | Promise<T>;

export interface EditorAdapterContext {
  browserHost: BrowserHost;
  engine?: unknown;
  scene: RuntimeScene | null;
  game: EditorGameLike | null;
}

export interface PersistentBindingAdapter {
  resolveBinding(node: RuntimeNode, context: EditorAdapterContext): PersistentBinding | null;
}

export interface SceneAdapter {
  normalizeSelection?(args: {
    source: SelectionSource;
    rawEntity: unknown;
    context: EditorAdapterContext;
  }): RuntimeNode | null;
  getSelectedEntities?(): RuntimeNode[];
  shouldHandleViewportSelection?(): boolean;
  duplicateSelected?(args: {
    selected: RuntimeNode;
    binding: PersistentBinding | null;
    context: EditorAdapterContext;
  }): MaybePromise<{ rootNode?: RuntimeNode | null; nodeId?: string | null } | boolean | null>;
  onSelectionCommitted?(entity: RuntimeNode | null, context: EditorAdapterContext): void;
}

export interface AssetAdapter {
  handleCommand?(name: string, params: Record<string, unknown>, context: EditorAdapterContext): MaybePromise<boolean>;
}

export interface EditorDocumentAdapter extends DocumentAdapter {
  applyTransformChange?(change: CanonicalTransformChange, context: EditorAdapterContext): boolean;
  applyMaterialChange?(change: CanonicalMaterialChange, context: EditorAdapterContext): boolean;
  applyOutlineChange?(change: CanonicalOutlineChange, context: EditorAdapterContext): boolean;
  beginTransformBatch?(): void;
  endTransformBatch?(): void;
}

export interface EditorLifecycleAdapter {
  getGame?(): EditorGameLike | null;
  onModeChanged?(mode: 'edit' | 'play', context: EditorAdapterContext): void;
  onSetTool?(tool: EditorTool, context: EditorAdapterContext): void;
  onFocusSelected?(selected: RuntimeNode | null, context: EditorAdapterContext): void;
  onDuplicateSelected?(selected: RuntimeNode | null, context: EditorAdapterContext): MaybePromise<boolean | void>;
  showInspector?(): MaybePromise<void>;
  hideInspector?(): MaybePromise<void>;
}

export interface BabylonForgePlayEditorOptions {
  platformBridge?: ForgePlayBridgeHostOptions;
  browserHost?: BrowserHost;
  browserHostOptions?: BrowserHostOptions;
  engine?: unknown;
  scene?: RuntimeScene | (() => RuntimeScene | null) | null;
  canvas?: HTMLCanvasElement | string | null;
  game?: EditorGameLike | (() => EditorGameLike | null) | null;
  babylon?: BabylonRuntimeGlobal | null;
  capabilities?: EditorCapabilities;
  documentAdapter: EditorDocumentAdapter;
  assetAdapter?: AssetAdapter;
  sceneAdapter: SceneAdapter;
  lifecycleAdapter?: EditorLifecycleAdapter;
  persistentBindingAdapter: PersistentBindingAdapter;
  autoRegister?: boolean;
  registerLegacyProxy?: boolean;
  installLegacyBypass?: boolean;
  inspectorUrl?: string;
  loadGizmoModules?: () => Promise<unknown[]>;
}

export interface BabylonForgePlayEditor {
  runtime: EditorRuntime;
  browserHost: BrowserHost;
  register(): RegisterEditorRuntimeResult;
  dispose(): void;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function isPromiseLike<T>(value: unknown): value is Promise<T> {
  return !!value && typeof value === 'object' && typeof (value as Promise<T>).then === 'function';
}

function createContext(
  options: BabylonForgePlayEditorOptions,
  browserHost: BrowserHost,
  scene: RuntimeScene | null,
): EditorAdapterContext {
  const game = typeof options.game === 'function'
    ? options.game()
    : options.game ?? options.lifecycleAdapter?.getGame?.() ?? null;
  return {
    browserHost,
    engine: options.engine,
    scene,
    game,
  };
}

function serializeEntity(node: RuntimeNode | null, binding: PersistentBinding | null): Record<string, unknown> | null {
  const runtimeNode = node as any;
  if (!runtimeNode) return null;
  const parent = runtimeNode.parent ?? null;
  return {
    name: runtimeNode.name ?? runtimeNode.id ?? '?',
    id: runtimeNode.id ?? null,
    uniqueId: runtimeNode.uniqueId ?? null,
    type: runtimeNode.getClassName?.() || runtimeNode.constructor?.name || 'Unknown',
    metadata: runtimeNode.metadata ?? null,
    persistentBinding: binding?.kind === 'sceneNode' ? { kind: 'sceneNode', nodeId: binding.nodeId } : null,
    parent: parent
      ? {
          name: parent.name ?? parent.id ?? '?',
          id: parent.uniqueId ?? parent.id ?? null,
          type: parent.getClassName?.() || parent.constructor?.name || 'Unknown',
        }
      : null,
  };
}

function buildContextChanges(changes: EditorRuntimeMonitorChange[]): Record<string, unknown>[] {
  return changes.map(change => ({
    entity: serializeEntity(change.obj, change.binding),
    property: {
      path: change.prop,
      name: change.prop.split('.').pop() ?? change.prop,
    },
    change: {
      from: change.old,
      to: change.new,
    },
    timestamp: change.time,
  }));
}

function toDocumentStatus(document: DocumentAdapter): DocumentStatus {
  return document.getStatus?.() ?? {
    dirty: document.isDirty(),
    canUndo: document.canUndo(),
    canRedo: document.canRedo(),
  };
}

function createRuntimeEventSink(
  options: BabylonForgePlayEditorOptions,
  document: DocumentAdapter,
): RuntimeEventSink {
  return {
    modeReady(payload) {
      emitForgePlayBridgeEvent(EDITOR_EVENT_NAME.MODE_READY, payload, options.platformBridge);
    },
    documentStatusChanged(status) {
      sendForgePlayBridgeMessage(EDITOR_POST_MESSAGE.CONTEXT_CHANGE, {
        changes: [],
        documentStatus: status,
      }, options.platformBridge);
    },
    documentExported(payload) {
      emitForgePlayBridgeEvent(EDITOR_EVENT_NAME.DOCUMENT_EXPORTED, { ...payload }, options.platformBridge);
    },
    inspectorFlushed() {
      emitForgePlayBridgeEvent(EDITOR_EVENT_NAME.INSPECTOR_FLUSHED, {
        documentStatus: toDocumentStatus(document),
      }, options.platformBridge);
    },
    commandFailed(name, error, params) {
      emitForgePlayBridgeEvent(`${name}.failed`, {
        requestId: optionalString(params.requestId),
        error: error instanceof Error ? error.message : String(error),
      }, options.platformBridge);
    },
  };
}

export function createBabylonForgePlayEditor(options: BabylonForgePlayEditorOptions): BabylonForgePlayEditor {
  const browserHost = options.browserHost ?? createBrowserHost({
    ...options.browserHostOptions,
    canvas: options.canvas ?? options.browserHostOptions?.canvas ?? null,
  });

  let currentScene: RuntimeScene | null = typeof options.scene === 'function'
    ? null
    : options.scene ?? null;
  let selectedEntity: RuntimeNode | null = null;

  function getScene(): RuntimeScene | null {
    if (typeof options.scene === 'function') return options.scene() ?? currentScene;
    return currentScene;
  }

  function getContext(): EditorAdapterContext {
    return createContext(options, browserHost, getScene());
  }

  function resolveBinding(node: RuntimeNode): PersistentBinding | null {
    return options.persistentBindingAdapter.resolveBinding(node, getContext());
  }

  let monitor: ReturnType<typeof createEditorRuntimeMonitor>;
  let inspectorHost: ReturnType<typeof createEditorInspectorHost>;
  let editSession: ReturnType<typeof createEditorEditSession>;

  const selectionController = createEditorSelectionController({
    host: browserHost,
    getScene,
    getMonitor: () => monitor,
    shouldHandleViewportSelection: () => options.sceneAdapter.shouldHandleViewportSelection?.() ?? true,
    externalSelectionRootSelector: '#inspector-host, #babylon-inspector-container',
    externalSelectionInteractiveSelector: [
      '#inspector-host button',
      '#babylon-inspector-container button',
      '#inspector-host input',
      '#babylon-inspector-container input',
      '#inspector-host textarea',
      '#babylon-inspector-container textarea',
      '#inspector-host select',
      '#babylon-inspector-container select',
      '#inspector-host a',
      '#babylon-inspector-container a',
      '#inspector-host [role]',
      '#babylon-inspector-container [role]',
      '#inspector-host [contenteditable="true"]',
      '#babylon-inspector-container [contenteditable="true"]',
    ].join(', '),
    setExternalPickingState: enabled => setInspectorPickingState(enabled, browserHost),
    normalizeSelection: ({ source, rawEntity }) => {
      const normalized = options.sceneAdapter.normalizeSelection?.({
        source,
        rawEntity,
        context: getContext(),
      }) ?? rawEntity;
      const normalizedEntity = (normalized ?? null) as RuntimeNode | null;
      const binding = normalizedEntity ? resolveBinding(normalizedEntity) : null;
      return {
        normalizedEntity,
        hasPersistentBinding: !!binding,
      };
    },
    onSelectionCommitted: entity => {
      selectedEntity = (entity ?? null) as RuntimeNode | null;
      options.sceneAdapter.onSelectionCommitted?.(selectedEntity, getContext());
      monitor?.rebase(selectedEntity);
      editSession?.syncSelection(selectedEntity);
    },
  });

  inspectorHost = createEditorInspectorHost({
    host: browserHost,
    babylon: options.babylon,
    inspectorUrl: options.inspectorUrl,
    loadGizmoModules: options.loadGizmoModules,
    getScene,
    getSelectionController: () => selectionController,
    getSelectedEntity: () => selectionController.getSelectedEntity?.() ?? selectedEntity,
    getCurrentTool: () => editSession?.currentTool?.() ?? 'pick',
    resolveBinding: node => resolveBinding(node as RuntimeNode),
    onMaterialPropertyChanged: change => monitor?.recordCanonicalMaterialChange?.(change),
    onContextSelection: payload => {
      sendForgePlayBridgeMessage('context:selection', payload as Record<string, unknown>, options.platformBridge);
    },
  });

  editSession = createEditorEditSession({
    host: browserHost,
    babylon: options.babylon,
    getScene,
    getGame: () => getContext().game,
    getSelectedEntity: () => selectionController.getSelectedEntity?.() as RuntimeNode | null ?? selectedEntity,
    emitModeChange: mode => {
      options.lifecycleAdapter?.onModeChanged?.(mode, getContext());
      emitForgePlayBridgeEvent(EDITOR_COMMAND_NAME.MODE_CHANGE, { mode }, options.platformBridge);
    },
    syncExternalToolState: tool => {
      inspectorHost.syncTool(tool);
      return true;
    },
    onSetTool: tool => options.lifecycleAdapter?.onSetTool?.(tool, getContext()),
    onEnablePicking: () => selectionController.enablePicking?.(),
    onFocusSelected: () => {
      const selected = selectionController.getSelectedEntity?.() as RuntimeNode | null ?? selectedEntity;
      options.lifecycleAdapter?.onFocusSelected?.(selected, getContext());
      if (selected) editSession.focusSelected(selected);
    },
    onUndo: () => directUndo(),
    onRedo: () => directRedo(),
    onDuplicateSelected: () => { void performDuplicateSelected(); },
  });

  monitor = createEditorRuntimeMonitor({
    host: browserHost,
    getScene,
    getSelectedEntity: () => selectionController.getSelectedEntity?.() as RuntimeNode | null ?? selectedEntity,
    getSelectedEntities: () => options.sceneAdapter.getSelectedEntities?.() ?? selectionController.getSelectedEntities?.() as RuntimeNode[] ?? [],
    resolveBinding,
    onSelectionChanged: node => {
      selectedEntity = node;
      options.sceneAdapter.onSelectionCommitted?.(node, getContext());
    },
    onChangesFlushed: changes => {
      sendForgePlayBridgeMessage(EDITOR_POST_MESSAGE.CONTEXT_CHANGE, {
        changes: buildContextChanges(changes),
        documentStatus: toDocumentStatus(options.documentAdapter),
      }, options.platformBridge);
    },
    onTransformBatchBegin: () => options.documentAdapter.beginTransformBatch?.(),
    onTransformBatchEnd: () => options.documentAdapter.endTransformBatch?.(),
    onTransformChange: change => options.documentAdapter.applyTransformChange?.(change, getContext()) === true,
    onMaterialChange: change => options.documentAdapter.applyMaterialChange?.(change, getContext()) === true,
    onOutlineChange: change => options.documentAdapter.applyOutlineChange?.(change, getContext()) === true,
    onDocumentChanged: () => {
      sendForgePlayBridgeMessage(EDITOR_POST_MESSAGE.CONTEXT_CHANGE, {
        changes: [],
        documentStatus: toDocumentStatus(options.documentAdapter),
      }, options.platformBridge);
    },
  });

  function flushRuntimeAndDocument(): MaybePromise<void> {
    monitor.flush();
    return options.documentAdapter.flush?.();
  }

  const runtimeDocumentAdapter: DocumentAdapter = {
    ensureLoaded: () => options.documentAdapter.ensureLoaded(),
    isDirty: () => options.documentAdapter.isDirty(),
    canUndo: () => options.documentAdapter.canUndo(),
    canRedo: () => options.documentAdapter.canRedo(),
    exportDocument: () => options.documentAdapter.exportDocument(),
    commitSavedDocument: args => options.documentAdapter.commitSavedDocument(args),
    undo: () => options.documentAdapter.undo(),
    redo: () => options.documentAdapter.redo(),
    flush: flushRuntimeAndDocument,
    getStatus: () => options.documentAdapter.getStatus?.() ?? toDocumentStatus(options.documentAdapter),
  };

  async function performDuplicateSelected(): Promise<{ ok: boolean; nodeId?: string | null }> {
    const selected = selectionController.getSelectedEntity?.() as RuntimeNode | null ?? selectedEntity;
    if (!selected) return { ok: false };
    const customHandled = await options.lifecycleAdapter?.onDuplicateSelected?.(selected, getContext());
    if (customHandled === true) {
      const nodeId = resolveBinding(selected)?.nodeId ?? null;
      return { ok: true, nodeId };
    }
    const result = await options.sceneAdapter.duplicateSelected?.({
      selected,
      binding: resolveBinding(selected),
      context: getContext(),
    });
    if (!result) return { ok: false };
    if (result === true) {
      const nodeId = resolveBinding(selected)?.nodeId ?? null;
      return { ok: true, nodeId };
    }
    const rootNode = result.rootNode ?? null;
    if (rootNode) selectionController.selectEntity?.(rootNode, true);
    const nodeId = result.nodeId ?? (rootNode ? resolveBinding(rootNode)?.nodeId : null) ?? null;
    return { ok: true, nodeId };
  }

  const lifecycle: LifecycleAdapter = {
    enter: async () => {
      await editSession.enter();
      monitor.start();
    },
    exit: async save => {
      monitor.flush();
      monitor.stop();
      await editSession.exit(save);
    },
    isActive: () => editSession.active,
    focusSelected: () => {
      const selected = selectionController.getSelectedEntity?.() as RuntimeNode | null ?? selectedEntity;
      if (selected) editSession.focusSelected(selected);
    },
    isViewportNavigationActive: () => editSession.isViewportNavigationActive(),
    setTool: tool => {
      inspectorHost.syncTool(tool);
      editSession.syncSelection(selectionController.getSelectedEntity?.() as RuntimeNode | null ?? selectedEntity);
      options.lifecycleAdapter?.onSetTool?.(tool, getContext());
    },
    showInspector: () => options.lifecycleAdapter?.showInspector?.() ?? inspectorHost.show(),
    hideInspector: () => {
      const hidden = options.lifecycleAdapter?.hideInspector?.();
      if (hidden) return hidden;
      inspectorHost.hide();
      return undefined;
    },
    duplicateSelected: async () => (await performDuplicateSelected()).ok,
  };

  const shell = createEditorRuntimeShell({
    document: runtimeDocumentAdapter,
    lifecycle,
    selection: {
      getSelectedEntity: () => selectionController.getSelectedEntity?.() ?? selectedEntity,
      selectEntity: (entity, syncInspector = true) => {
        selectionController.selectEntity?.(entity as RuntimeNode | null, syncInspector);
        selectedEntity = (entity ?? null) as RuntimeNode | null;
      },
    },
    capabilities: options.capabilities,
    eventSink: createRuntimeEventSink(options, runtimeDocumentAdapter),
  });

  function publishStatus(): void {
    sendForgePlayBridgeMessage(EDITOR_POST_MESSAGE.CONTEXT_CHANGE, {
      changes: [],
      documentStatus: toDocumentStatus(options.documentAdapter),
    }, options.platformBridge);
  }

  function syncSelectionAfterDocumentChange(change: EditorRuntimeChange | null): boolean {
    if (!change) return false;

    let nextSelection: RuntimeNode | null | undefined;
    if (change.kind === 'selection') {
      nextSelection = (change.selectedRootNode ?? null) as RuntimeNode | null;
    } else if (change.rootNode) {
      nextSelection = change.rootNode as RuntimeNode;
    } else if ('selectedRootNode' in change) {
      nextSelection = (change.selectedRootNode ?? null) as RuntimeNode | null;
    }

    if (nextSelection !== undefined) {
      selectedEntity = nextSelection;
      selectionController.selectEntity?.(nextSelection, true);
      editSession.syncSelection(nextSelection);
      monitor.rebase(nextSelection);
      return true;
    }

    const currentSelection = selectionController.getSelectedEntity?.() as RuntimeNode | null ?? selectedEntity;
    monitor.rebase(currentSelection);
    return true;
  }

  function applyDocumentChangeResult(change: EditorRuntimeChange | null): boolean {
    if (!syncSelectionAfterDocumentChange(change)) return false;
    publishStatus();
    return true;
  }

  async function undoWithSelectionSync(): Promise<boolean> {
    if (!editSession.active) return false;
    monitor.flush();
    await options.documentAdapter.flush?.();
    await options.documentAdapter.ensureLoaded();
    const change = await options.documentAdapter.undo();
    return applyDocumentChangeResult(change);
  }

  async function redoWithSelectionSync(): Promise<boolean> {
    if (!editSession.active) return false;
    monitor.flush();
    await options.documentAdapter.flush?.();
    await options.documentAdapter.ensureLoaded();
    const change = await options.documentAdapter.redo();
    return applyDocumentChangeResult(change);
  }

  function directUndo(): boolean {
    if (!editSession.active) return false;
    monitor.flush();
    options.documentAdapter.flush?.();
    const result = options.documentAdapter.undo();
    if (isPromiseLike<EditorRuntimeChange | null>(result)) {
      void result.then(change => applyDocumentChangeResult(change));
      return false;
    }
    return applyDocumentChangeResult(result);
  }

  function directRedo(): boolean {
    if (!editSession.active) return false;
    monitor.flush();
    options.documentAdapter.flush?.();
    const result = options.documentAdapter.redo();
    if (isPromiseLike<EditorRuntimeChange | null>(result)) {
      void result.then(change => applyDocumentChangeResult(change));
      return false;
    }
    return applyDocumentChangeResult(result);
  }

  function directExportDocument(): EditorDocumentExport | null {
    monitor.flush();
    options.documentAdapter.flush?.();
    options.documentAdapter.ensureLoaded();
    const exported = options.documentAdapter.exportDocument();
    if (isPromiseLike<EditorDocumentExport | null>(exported)) {
      void exported.then(payload => {
        if (payload) emitForgePlayBridgeEvent(EDITOR_EVENT_NAME.DOCUMENT_EXPORTED, { ...payload }, options.platformBridge);
      });
      return null;
    }
    return exported;
  }

  function directCommitSavedDocument(args: EditorDocumentCommitArgs): boolean {
    monitor.flush();
    options.documentAdapter.flush?.();
    const committed = options.documentAdapter.commitSavedDocument(args);
    if (isPromiseLike<boolean>(committed)) {
      void committed.then(ok => {
        if (ok) publishStatus();
      });
      return true;
    }
    if (committed) publishStatus();
    return committed;
  }

  const runtime: EditorRuntime = {
    owner: 'project',
    Editor: {
      get active() {
        return editSession.active;
      },
      init(scene: unknown): void {
        currentScene = scene as RuntimeScene | null;
        monitor.reset();
        selectionController.reset?.();
        selectedEntity = null;
        void options.documentAdapter.ensureLoaded();
        inspectorHost.init(currentScene);
        shell.publishDocumentStatus();
      },
      showInspector: () => inspectorHost.show(),
      hideInspector: () => inspectorHost.hide(),
      setTool: tool => {
        inspectorHost.syncTool(tool);
        void lifecycle.setTool?.(tool);
      },
      getSelectedEntity: () => selectionController.getSelectedEntity?.() ?? selectedEntity,
      selectEntity(entity: unknown | null, syncInspector = true): void {
        selectedEntity = entity as RuntimeNode | null;
        selectionController.selectEntity?.(selectedEntity, syncInspector);
      },
      duplicateSelected: async () => (await performDuplicateSelected()).ok,
      undo: directUndo,
      redo: directRedo,
      exportDocument: directExportDocument,
      commitSavedDocument: directCommitSavedDocument,
    },
    Edit: {
      get active() {
        return editSession.active;
      },
      enter: () => shell.enterEditMode(),
      exit: save => shell.enterPlayMode(undefined, save),
      _focusSelected(): void {
        lifecycle.focusSelected?.();
      },
      isViewportNavigationActive: () => editSession.isViewportNavigationActive(),
    },
    async handleCommand(name: string, params: Record<string, unknown>): Promise<void> {
      if (options.assetAdapter?.handleCommand) {
        monitor.flush();
        await options.documentAdapter.flush?.();
      }
      const handledByAsset = await options.assetAdapter?.handleCommand?.(name, params, getContext());
      if (handledByAsset) return;
      if (name === EDITOR_COMMAND_NAME.DOCUMENT_EXPORT) {
        const exported = await shell.exportDocument();
        if (exported) {
          emitForgePlayBridgeEvent(EDITOR_EVENT_NAME.DOCUMENT_EXPORTED, {
            ...exported,
            requestId: optionalString(params.requestId),
          }, options.platformBridge);
          return;
        }
        emitForgePlayBridgeEvent(EDITOR_EVENT_NAME.DOCUMENT_EXPORTED, {
          requestId: optionalString(params.requestId),
          ok: false,
          code: 'document_export_unavailable',
          error: 'Document export unavailable',
        }, options.platformBridge);
        return;
      }
      if (name === EDITOR_COMMAND_NAME.SELECTION_DUPLICATE) {
        const result = await performDuplicateSelected();
        emitForgePlayBridgeEvent(EDITOR_EVENT_NAME.SELECTION_DUPLICATE_RESULT, {
          requestId: optionalString(params.requestId),
          ok: result.ok,
          ...(result.nodeId ? { nodeId: result.nodeId } : {}),
        }, options.platformBridge);
        if (result.ok) publishStatus();
        return;
      }
      if (name === EDITOR_COMMAND_NAME.UNDO) {
        await undoWithSelectionSync();
        return;
      }
      if (name === EDITOR_COMMAND_NAME.REDO) {
        await redoWithSelectionSync();
        return;
      }
      await shell.handleCommand(name, params);
    },
  };

  function register(): RegisterEditorRuntimeResult {
    installForgePlayBridgeInspectorLoaderPatch(options.platformBridge);
    const result = registerForgePlayEditorRuntime(runtime, options.platformBridge);
    if (options.installLegacyBypass !== false) {
      installLegacyCommandBypass(runtime, options.platformBridge);
    }
    if (options.registerLegacyProxy !== false) {
      registerLegacyRuntimeProxy(runtime, options.platformBridge);
    }
    return result;
  }

  if (options.autoRegister !== false) register();

  return {
    runtime,
    browserHost,
    register,
    dispose(): void {
      monitor.reset();
      inspectorHost.hide();
      selectionController.reset?.();
    },
  };
}

export type {
  DocumentAdapter,
  EditorRuntime,
  EditorRuntimeChange,
};

export {
  EDITOR_COMMAND_NAME,
  EDITOR_EVENT_NAME,
  EDITOR_POST_MESSAGE,
};
