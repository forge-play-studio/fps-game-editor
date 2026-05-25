import type {
  EditorCapabilities,
  EditorDocumentCommitArgs,
  EditorDocumentExport,
  EditorRuntimeChange,
  EditorTool,
} from '@fps-games/editor-protocol';
import { EDITOR_COMMAND_NAME } from '@fps-games/editor-protocol';

export * from './editor-session';
export * from './authoring-source';
export * from './host-services';
export * from './scene-view-input';
export * from './scene-graph';
export * from './selection-strategy';
export * from './serialized-object';
export * from './inspector';
export * from './transform-gizmo';
export * from './transform-math';
export * from './transform-operations';
export * from './viewport-tools';

export type MaybePromise<T> = T | Promise<T>;

export interface DocumentStatus {
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

export interface DocumentAdapter {
  ensureLoaded(): MaybePromise<void>;
  isDirty(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  exportDocument(): MaybePromise<EditorDocumentExport | null>;
  commitSavedDocument(args: EditorDocumentCommitArgs): MaybePromise<boolean>;
  undo(): MaybePromise<EditorRuntimeChange | null>;
  redo(): MaybePromise<EditorRuntimeChange | null>;
  flush?(): MaybePromise<void>;
  getStatus?(): DocumentStatus;
}

export interface LifecycleAdapter {
  enter(): MaybePromise<void>;
  exit(save?: boolean): MaybePromise<void>;
  isActive(): boolean;
  focusSelected?(): void;
  isViewportNavigationActive?(): boolean;
  setTool?(tool: EditorTool): MaybePromise<void>;
  showInspector?(): MaybePromise<void>;
  hideInspector?(): MaybePromise<void>;
  duplicateSelected?(): MaybePromise<boolean>;
}

export interface RuntimeSelectionAdapter {
  getSelectedEntity?(): unknown | null;
  selectEntity?(entity: unknown | null, syncInspector?: boolean): void;
}

export interface RuntimeEventSink {
  modeReady?(payload: { requestId?: string; mode: 'edit' | 'play'; active: boolean }): void;
  documentStatusChanged?(status: DocumentStatus): void;
  documentExported?(payload: EditorDocumentExport & { requestId?: string }): void;
  inspectorFlushed?(): void;
  commandHandled?(name: string, params: Record<string, unknown>): void;
  commandFailed?(name: string, error: unknown, params: Record<string, unknown>): void;
}

export interface RuntimeCommandHandler {
  name: string;
  handle(params: Record<string, unknown>, runtime: EditorRuntimeShell): MaybePromise<void>;
}

export interface EditorRuntimeShellOptions {
  document: DocumentAdapter;
  lifecycle: LifecycleAdapter;
  selection?: RuntimeSelectionAdapter;
  capabilities?: EditorCapabilities;
  eventSink?: RuntimeEventSink;
  commandHandlers?: RuntimeCommandHandler[];
}

function toDocumentStatus(document: DocumentAdapter): DocumentStatus {
  return document.getStatus?.() ?? {
    dirty: document.isDirty(),
    canUndo: document.canUndo(),
    canRedo: document.canRedo(),
  };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function readSaveFlag(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

export class CommandDispatcher {
  private readonly handlers = new Map<string, RuntimeCommandHandler>();

  constructor(handlers: RuntimeCommandHandler[] = []) {
    for (const handler of handlers) this.register(handler);
  }

  register(handler: RuntimeCommandHandler): void {
    this.handlers.set(handler.name, handler);
  }

  has(name: string): boolean {
    return this.handlers.has(name);
  }

  async dispatch(name: string, params: Record<string, unknown>, runtime: EditorRuntimeShell): Promise<boolean> {
    const handler = this.handlers.get(name);
    if (!handler) return false;
    await handler.handle(params, runtime);
    return true;
  }
}

export class CapabilityRegistry {
  private capabilities: EditorCapabilities;

  constructor(capabilities: EditorCapabilities = {}) {
    this.capabilities = { ...capabilities };
  }

  getAll(): EditorCapabilities {
    return { ...this.capabilities };
  }

  has(name: keyof EditorCapabilities & string): boolean {
    return this.capabilities[name] === true;
  }

  set(name: keyof EditorCapabilities & string, enabled: boolean): void {
    this.capabilities = { ...this.capabilities, [name]: enabled };
  }

  merge(capabilities: EditorCapabilities): void {
    this.capabilities = { ...this.capabilities, ...capabilities };
  }
}

export class EditorRuntimeShell {
  readonly document: DocumentAdapter;
  readonly lifecycle: LifecycleAdapter;
  readonly selection: RuntimeSelectionAdapter;
  readonly capabilities: CapabilityRegistry;
  readonly dispatcher: CommandDispatcher;
  readonly eventSink: RuntimeEventSink;

  constructor(options: EditorRuntimeShellOptions) {
    this.document = options.document;
    this.lifecycle = options.lifecycle;
    this.selection = options.selection ?? {};
    this.capabilities = new CapabilityRegistry(options.capabilities);
    this.eventSink = options.eventSink ?? {};
    this.dispatcher = new CommandDispatcher(defaultCommandHandlers());
    for (const handler of options.commandHandlers ?? []) this.dispatcher.register(handler);
  }

  get active(): boolean {
    return this.lifecycle.isActive();
  }

  getDocumentStatus(): DocumentStatus {
    return toDocumentStatus(this.document);
  }

  publishDocumentStatus(): void {
    this.eventSink.documentStatusChanged?.(this.getDocumentStatus());
  }

  async flushDocument(): Promise<void> {
    await this.document.flush?.();
  }

  async enterEditMode(requestId?: string): Promise<void> {
    await this.lifecycle.enter();
    await this.document.ensureLoaded();
    this.eventSink.modeReady?.({ requestId, mode: 'edit', active: this.lifecycle.isActive() });
    await this.lifecycle.showInspector?.();
    this.publishDocumentStatus();
  }

  async enterPlayMode(requestId?: string, save?: boolean): Promise<void> {
    this.lifecycle.hideInspector?.();
    await this.lifecycle.exit(save ?? true);
    this.eventSink.modeReady?.({ requestId, mode: 'play', active: this.lifecycle.isActive() });
    this.publishDocumentStatus();
  }

  async undo(): Promise<boolean> {
    if (!this.active) return false;
    await this.flushDocument();
    await this.document.ensureLoaded();
    const change = await this.document.undo();
    if (!change) return false;
    this.publishDocumentStatus();
    return true;
  }

  async redo(): Promise<boolean> {
    if (!this.active) return false;
    await this.flushDocument();
    await this.document.ensureLoaded();
    const change = await this.document.redo();
    if (!change) return false;
    this.publishDocumentStatus();
    return true;
  }

  async exportDocument(): Promise<EditorDocumentExport | null> {
    await this.flushDocument();
    await this.document.ensureLoaded();
    return this.document.exportDocument();
  }

  async commitSavedDocument(args: EditorDocumentCommitArgs): Promise<boolean> {
    await this.flushDocument();
    await this.document.ensureLoaded();
    const committed = await this.document.commitSavedDocument(args);
    if (committed) this.publishDocumentStatus();
    return committed;
  }

  async duplicateSelected(): Promise<boolean> {
    if (!this.active) return false;
    const duplicated = await this.lifecycle.duplicateSelected?.();
    if (duplicated) this.publishDocumentStatus();
    return duplicated === true;
  }

  async handleCommand(name: string, params: Record<string, unknown> = {}): Promise<boolean> {
    try {
      const handled = await this.dispatcher.dispatch(name, params, this);
      if (handled) this.eventSink.commandHandled?.(name, params);
      return handled;
    } catch (error) {
      this.eventSink.commandFailed?.(name, error, params);
      throw error;
    }
  }
}

export function defaultCommandHandlers(): RuntimeCommandHandler[] {
  return [
    {
      name: EDITOR_COMMAND_NAME.MODE_CHANGE,
      async handle(params, runtime) {
        const mode = typeof params.mode === 'string' ? params.mode : '';
        const requestId = optionalString(params.requestId);
        if (mode === 'edit') {
          await runtime.enterEditMode(requestId);
          return;
        }
        if (mode === 'play') {
          await runtime.enterPlayMode(requestId, readSaveFlag(params.save));
        }
      },
    },
    {
      name: EDITOR_COMMAND_NAME.UNDO,
      async handle(_params, runtime) {
        await runtime.undo();
      },
    },
    {
      name: EDITOR_COMMAND_NAME.REDO,
      async handle(_params, runtime) {
        await runtime.redo();
      },
    },
    {
      name: EDITOR_COMMAND_NAME.DOCUMENT_EXPORT,
      async handle(params, runtime) {
        const exported = await runtime.exportDocument();
        if (exported) runtime.eventSink.documentExported?.({ ...exported, requestId: optionalString(params.requestId) });
      },
    },
    {
      name: EDITOR_COMMAND_NAME.DOCUMENT_COMMIT,
      async handle(params, runtime) {
        await runtime.commitSavedDocument({
          version: typeof params.version === 'number' ? params.version : undefined,
          updatedAt: typeof params.updatedAt === 'string' ? params.updatedAt : undefined,
          sceneJsonText: typeof params.sceneJsonText === 'string' ? params.sceneJsonText : undefined,
          scenePath: typeof params.scenePath === 'string' ? params.scenePath : undefined,
        });
      },
    },
    {
      name: EDITOR_COMMAND_NAME.INSPECTOR_FLUSH,
      async handle(_params, runtime) {
        await runtime.flushDocument();
        runtime.publishDocumentStatus();
        runtime.eventSink.inspectorFlushed?.();
      },
    },
    {
      name: EDITOR_COMMAND_NAME.SELECTION_DUPLICATE,
      async handle(_params, runtime) {
        await runtime.duplicateSelected();
      },
    },
  ];
}

export function createEditorRuntimeShell(options: EditorRuntimeShellOptions): EditorRuntimeShell {
  return new EditorRuntimeShell(options);
}
