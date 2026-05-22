import type {
  EditorBridgeLike,
  EditorMessenger,
  EditorPlugin,
  EditorRuntime,
} from '@fps-games/editor-protocol';

export interface ForgePlayRuntimeRegistryState {
  legacyRuntime?: EditorRuntime | null;
  projectRuntime?: EditorRuntime | null;
}

export interface ForgePlayEditorWindow extends Window {
  __bridge?: EditorBridgeLike;
  __pendingEditorPlugin?: EditorPlugin;
  __pendingEditorRuntime?: EditorRuntime;
  __bridgeLegacyEditorRuntime?: EditorRuntime;
  __BRIDGE_EDITOR_RUNTIME_STATE?: ForgePlayRuntimeRegistryState;
}

export interface ForgePlayBridgeHostOptions {
  window?: ForgePlayEditorWindow;
}

export interface RegisterEditorPluginResult {
  bridge: EditorBridgeLike | null;
  registered: boolean;
  pending: boolean;
}

export interface RegisterEditorRuntimeResult {
  bridge: EditorBridgeLike | null;
  registered: boolean;
  pending: boolean;
}

export interface LegacyCommandBypassOptions extends ForgePlayBridgeHostOptions {
  projectOwnedCommands?: Iterable<string>;
  legacySafeCommands?: Iterable<string>;
}

export interface BridgeInspectorLoaderPatchOptions extends ForgePlayBridgeHostOptions {
  maxAttempts?: number;
  intervalMs?: number;
}

export const DEFAULT_PROJECT_OWNED_COMMANDS = ['asset.import'] as const;

export const DEFAULT_LEGACY_SAFE_COMMANDS = [
  'asset.drag.preview',
  'asset.drag.clear',
  'asset.drop.anchor.arm',
  'asset.drop.anchor.cancel',
  'asset.drop.anchor.set',
  'asset.drop.anchor.set_by_coords',
  'asset.drop.anchor.clear',
] as const;

function getDefaultWindow(): ForgePlayEditorWindow | null {
  if (typeof window === 'undefined') return null;
  return window as ForgePlayEditorWindow;
}

export function getForgePlayWindow(options: ForgePlayBridgeHostOptions = {}): ForgePlayEditorWindow | null {
  return options.window ?? getDefaultWindow();
}

export function getForgePlayBridge(options: ForgePlayBridgeHostOptions = {}): EditorBridgeLike | null {
  return getForgePlayWindow(options)?.__bridge ?? null;
}

export function getForgePlayMessenger(options: ForgePlayBridgeHostOptions = {}): EditorMessenger | null {
  return getForgePlayBridge(options)?.messenger ?? null;
}

export function registerForgePlayEditorPlugin(
  plugin: EditorPlugin,
  options: ForgePlayBridgeHostOptions = {},
): RegisterEditorPluginResult {
  const win = getForgePlayWindow(options);
  if (win) win.__pendingEditorPlugin = plugin;

  const bridge = win?.__bridge ?? null;
  const register = bridge?.registerEditorPlugin;
  if (register) {
    register(plugin);
    return { bridge, registered: true, pending: true };
  }
  return { bridge, registered: false, pending: Boolean(win) };
}

export function registerForgePlayEditorRuntime(
  runtime: EditorRuntime,
  options: ForgePlayBridgeHostOptions = {},
): RegisterEditorRuntimeResult {
  const win = getForgePlayWindow(options);
  if (win) win.__pendingEditorRuntime = runtime;

  const bridge = win?.__bridge ?? null;
  const register = bridge?.registerEditorRuntime;
  if (register) {
    register(runtime);
    return { bridge, registered: true, pending: true };
  }
  return { bridge, registered: false, pending: Boolean(win) };
}

export function emitForgePlayBridgeEvent(
  eventName: string,
  payload: Record<string, unknown>,
  options: ForgePlayBridgeHostOptions = {},
): boolean {
  const event = getForgePlayMessenger(options)?.event;
  if (!event) return false;
  event(eventName, payload);
  return true;
}

export function sendForgePlayBridgeMessage(
  type: string,
  payload: Record<string, unknown>,
  options: ForgePlayBridgeHostOptions = {},
): boolean {
  const send = getForgePlayMessenger(options)?.send;
  if (!send) return false;
  send(type, payload);
  return true;
}

export function installForgePlayBridgeInspectorLoaderPatch(
  options: BridgeInspectorLoaderPatchOptions = {},
): boolean {
  const win = getForgePlayWindow(options);
  if (!win) return false;

  const maxAttempts = options.maxAttempts ?? 120;
  const intervalMs = options.intervalMs ?? 250;
  let attempts = 0;

  const tryPatch = (): boolean => {
    const editor = (win.__bridge as any)?.editor;
    if (!editor) {
      if (attempts < maxAttempts) {
        attempts += 1;
        win.setTimeout?.(tryPatch, intervalMs);
      }
      return false;
    }

    if (editor.__fpsGameEditorLocalInspectorLoadPatched) return true;

    const ensureLocalInspector = async () => {
      const ensureInspectorReady = (win as any).ensureInspectorReady;
      const localInspector = typeof ensureInspectorReady === 'function'
        ? await ensureInspectorReady()
        : null;
      if (localInspector?.ShowInspector) {
        (win as any).INSPECTOR = localInspector;
      }
      return localInspector;
    };

    if (typeof editor.showInspector === 'function') {
      const originalShowInspector = editor.showInspector.bind(editor);
      editor.showInspector = async (...args: unknown[]) => {
        await ensureLocalInspector();
        return originalShowInspector(...args);
      };
    }

    if (typeof editor.loadV2 === 'function') {
      const originalLoadV2 = editor.loadV2.bind(editor);
      editor.loadV2 = async (...args: unknown[]) => {
        const localInspector = await ensureLocalInspector();
        if (localInspector?.ShowInspector) return localInspector;
        return originalLoadV2(...args);
      };
    }

    editor.__fpsGameEditorLocalInspectorLoadPatched = true;
    return true;
  };

  return tryPatch();
}

export function registerLegacyRuntimeProxy(
  projectRuntime: EditorRuntime,
  options: ForgePlayBridgeHostOptions = {},
): RegisterEditorRuntimeResult {
  const bridge = getForgePlayBridge(options);
  const proxy: EditorRuntime = {
    owner: 'legacy',
    Editor: projectRuntime.Editor,
    Edit: projectRuntime.Edit,
    handleCommand: projectRuntime.handleCommand.bind(projectRuntime),
  };
  const register = bridge?.registerEditorRuntime;
  if (register) {
    register(proxy);
    return { bridge, registered: true, pending: false };
  }
  return { bridge, registered: false, pending: false };
}

export function installLegacyCommandBypass(
  runtime: EditorRuntime,
  options: LegacyCommandBypassOptions = {},
): EditorRuntime | null {
  const win = getForgePlayWindow(options);
  if (!win) return null;

  const projectOwned = new Set(options.projectOwnedCommands ?? DEFAULT_PROJECT_OWNED_COMMANDS);
  const legacySafe = new Set(options.legacySafeCommands ?? DEFAULT_LEGACY_SAFE_COMMANDS);
  const registryState = win.__BRIDGE_EDITOR_RUNTIME_STATE;
  const previousLegacy = registryState?.legacyRuntime ?? win.__bridgeLegacyEditorRuntime ?? null;
  const previousWithMarker = previousLegacy as (EditorRuntime & { __fpsGameEditorOriginalLegacyRuntime?: EditorRuntime | null }) | null;
  const originalLegacy = previousWithMarker?.__fpsGameEditorOriginalLegacyRuntime ?? previousLegacy;

  const proxy: EditorRuntime & {
    __fpsGameEditorLegacyCommandBypass?: boolean;
    __fpsGameEditorOriginalLegacyRuntime?: EditorRuntime | null;
  } = {
    owner: 'legacy',
    Editor: runtime.Editor,
    Edit: runtime.Edit,
    async handleCommand(name: string, params: Record<string, unknown>) {
      if (projectOwned.has(name)) return runtime.handleCommand(name, params);
      if (legacySafe.has(name)) return originalLegacy?.handleCommand?.(name, params);
      return originalLegacy?.handleCommand?.(name, params);
    },
  };

  proxy.__fpsGameEditorLegacyCommandBypass = true;
  proxy.__fpsGameEditorOriginalLegacyRuntime = originalLegacy;

  if (registryState) registryState.legacyRuntime = proxy;
  win.__bridgeLegacyEditorRuntime = proxy;
  return proxy;
}
