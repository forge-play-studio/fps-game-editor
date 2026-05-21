import type { DebugPanelRuntimeController } from '../framework';

type Vec3Tuple = [number, number, number];

interface MockPlatformAssetState {
  assetPath: string;
  assetName: string;
  sourceId: string;
  assetId: string;
  displayName: string;
  category: string;
  nodeId: string;
  position: Vec3Tuple;
  rotationDeg: Vec3Tuple;
  scale: Vec3Tuple;
  albedoColor: Vec3Tuple;
  emissiveColor: Vec3Tuple;
  materialAlpha: number;
  logText: string;
  lastStatus: string;
}

type BridgeEventPayload = Record<string, unknown> & { requestId?: string };

type ProjectEditorRuntimeLike = {
  handleCommand?: (name: string, params: Record<string, unknown>) => Promise<void> | void;
};

const TRACE_PREFIX = '[MockPlatformAssets][Trace]';

const DEFAULT_STATE: MockPlatformAssetState = {
  assetPath: '',
  assetName: '',
  sourceId: '',
  assetId: '',
  displayName: '',
  category: 'mock-platform',
  nodeId: '',
  position: [0, 0, 0],
  rotationDeg: [0, 0, 0],
  scale: [1, 1, 1],
  albedoColor: [1, 1, 1],
  emissiveColor: [0, 0, 0],
  materialAlpha: 1,
  logText: '',
  lastStatus: 'ready',
};

export function createMockPlatformAssetsController(): DebugPanelRuntimeController {
  const state: MockPlatformAssetState = cloneState(DEFAULT_STATE);
  const bridge = createLocalCommandBridge((message, details) => {
    state.lastStatus = details ? `${message}: ${JSON.stringify(details)}` : message;
    appendLog(state, message, details);
    console.log(`[MockPlatformAssets] ${message}`, details ?? '');
  });
  exposeManualTraceHelpers(state);
  trace('controller.ready', {
    state: summarizeState(state),
    runtimeRegistered: Boolean(getProjectRuntime()?.handleCommand),
  });

  return {
    getLiveConfig: () => cloneState(state),
    applyLivePatch: (patch) => mergeState(state, patch),
    updateConfig: (patch) => mergeState(state, patch),
    invokeAction: (request) => {
      void runAction(String(request.action ?? ''), request.args as Record<string, unknown> | undefined, state, bridge);
    },
  };
}

async function runAction(
  action: string,
  args: Record<string, unknown> | undefined,
  state: MockPlatformAssetState,
  bridge: ReturnType<typeof createLocalCommandBridge>,
): Promise<void> {
  const startedAt = performance.now();
  mergeState(state, args ?? {});
  trace('action.start', {
    action,
    args: summarizeRecord(args ?? {}),
    state: summarizeState(state),
  });
  try {
    if (action === 'registerAndImport') {
      await registerAndImport(state, bridge);
      return;
    }
    if (action === 'applyTransform') {
      await applyTransform(state, bridge);
      return;
    }
    if (action === 'applyMaterial') {
      await applyMaterial(state, bridge);
      return;
    }
    if (action === 'removeNode') {
      await removeNode(state, bridge);
      return;
    }
    if (action === 'unregisterAsset') {
      await unregisterAsset(state, bridge);
      return;
    }
    if (action === 'undo') {
      await bridge.command('history.undo', {});
      return;
    }
    if (action === 'redo') {
      await bridge.command('history.redo', {});
      return;
    }
    if (action === 'commit') {
      throw new Error(
        'legacy mock platform commit is disabled; save through fps-game-editor ProjectAuthoringHost.commitSource() instead',
      );
      return;
    }
    if (action === 'export') {
      await bridge.command('document.export', {}, 'document.exported');
      return;
    }
    bridge.log('unknown action', { action });
  } catch (error) {
    traceError('action.failed', error, {
      action,
      elapsedMs: Math.round(performance.now() - startedAt),
      state: summarizeState(state),
    });
    bridge.log('action failed', {
      action,
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }
  trace('action.end', {
    action,
    elapsedMs: Math.round(performance.now() - startedAt),
    state: summarizeState(state),
  });
}

async function registerAndImport(
  state: MockPlatformAssetState,
  bridge: ReturnType<typeof createLocalCommandBridge>,
): Promise<void> {
  trace('registerAndImport.begin', { state: summarizeState(state) });
  await bridge.command('mode.change', { mode: 'edit' }, 'mode.ready');

  const plan = await bridge.command('asset.registration.plan', compact({
    assetPath: state.assetPath,
    assetName: state.assetName,
    sourceId: state.sourceId,
    assetId: state.assetId,
    displayName: state.displayName,
    category: state.category,
  }), 'asset.registration.planned');
  trace('registerAndImport.plan', {
    plan: summarizeRecord(plan),
  });

  const registered = await executeAssetTransportPlan(plan);
  trace('registerAndImport.registered', {
    registered: summarizeRecord(registered),
  });

  state.sourceId = String(registered.sourceId ?? plan.sourceId ?? state.sourceId);
  state.assetId = String(registered.assetId ?? plan.assetId ?? state.assetId);

  const imported = await bridge.command('asset.import', compact({
    sourceId: state.sourceId,
    assetId: state.assetId,
    assetUrl: registered.assetUrl,
    assetName: state.assetName,
    displayName: state.displayName,
    category: state.category,
    position: toVec3Object(state.position),
    instanceScale: toVec3Object(state.scale),
  }), 'asset.import.result');
  trace('registerAndImport.imported', {
    imported: summarizeRecord(imported),
    runtimeScene: summarizeRuntimeScene(String(imported.nodeId ?? state.nodeId)),
  });

  if (imported.ok !== true) {
    throw new Error(`asset.import failed: ${JSON.stringify(imported)}`);
  }
  state.nodeId = String(imported.nodeId ?? state.nodeId);
  trace('registerAndImport.end', {
    state: summarizeState(state),
    runtimeScene: summarizeRuntimeScene(state.nodeId),
  });
  bridge.log('register and import completed', {
    sourceId: state.sourceId,
    assetId: state.assetId,
    nodeId: state.nodeId,
  });
}

async function applyTransform(
  state: MockPlatformAssetState,
  bridge: ReturnType<typeof createLocalCommandBridge>,
): Promise<void> {
  if (!state.nodeId.trim()) throw new Error('nodeId is required');
  const result = await bridge.command('scene.node.patch', {
    nodeId: state.nodeId,
    patches: [
      { path: 'transform.position', value: toVec3Object(state.position) },
      { path: 'transform.rotationDeg', value: toVec3Object(state.rotationDeg) },
      { path: 'transform.scale', value: toVec3Object(state.scale) },
    ],
  }, 'scene.node.patch.result');
  if (result.ok !== true) throw new Error(`scene.node.patch failed: ${JSON.stringify(result)}`);
  bridge.log('transform applied', { nodeId: state.nodeId });
}

async function applyMaterial(
  state: MockPlatformAssetState,
  bridge: ReturnType<typeof createLocalCommandBridge>,
): Promise<void> {
  if (!state.nodeId.trim()) throw new Error('nodeId is required');
  const result = await bridge.command('scene.node.patch', {
    nodeId: state.nodeId,
    patches: [
      { path: 'overrides.material.albedoColor', value: toRgbObject(state.albedoColor) },
      { path: 'overrides.material.emissiveColor', value: toRgbObject(state.emissiveColor) },
      { path: 'overrides.material.alpha', value: clampNumber(state.materialAlpha, 0, 1) },
    ],
  }, 'scene.node.patch.result');
  if (result.ok !== true) throw new Error(`material patch failed: ${JSON.stringify(result)}`);
  bridge.log('material override applied', { nodeId: state.nodeId });
}

async function removeNode(
  state: MockPlatformAssetState,
  bridge: ReturnType<typeof createLocalCommandBridge>,
): Promise<void> {
  if (!state.nodeId.trim()) throw new Error('nodeId is required');
  const result = await bridge.command('asset.remove', { nodeId: state.nodeId }, 'asset.remove.result');
  if (result.ok !== true) throw new Error(`asset.remove failed: ${JSON.stringify(result)}`);
  bridge.log('node removed', { nodeId: state.nodeId });
  state.nodeId = '';
}

async function unregisterAsset(
  state: MockPlatformAssetState,
  bridge: ReturnType<typeof createLocalCommandBridge>,
): Promise<void> {
  if (!state.sourceId.trim()) throw new Error('sourceId is required');
  const plan = await bridge.command('asset.unregistration.plan', {
    sourceId: state.sourceId,
  }, 'asset.unregistration.planned');
  const result = await executeAssetTransportPlan(plan);
  bridge.log('asset unregistered', result);
  state.sourceId = '';
  state.assetId = '';
}

async function executeAssetTransportPlan(
  plan: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const transportPlan = readRecord(plan.transportPlan);
  const writes = Array.isArray(transportPlan.writes) ? transportPlan.writes : [];
  const commands = Array.isArray(transportPlan.commands) ? transportPlan.commands : [];

  if (!writes.length && !commands.length) {
    throw new Error('transportPlan must include writes or commands');
  }

  trace('transport.begin', {
    writeCount: writes.length,
    commandCount: commands.length,
  });

  for (const write of writes) {
    const writeRecord = readRecord(write);
    const response = await postJson('/__mock_platform_assets/file', writeRecord);
    trace('transport.write', {
      write: summarizeRecord(writeRecord),
      response: summarizeRecord(response),
    });
  }

  let lastResult: Record<string, unknown> = { ok: true };
  for (const command of commands) {
    const commandRecord = readRecord(command);
    const response = await postJson('/__mock_platform_assets/exec', commandRecord);
    trace('transport.command', {
      command: summarizeRecord(commandRecord),
      response: summarizeRecord(response),
    });
    const responseResult = readRecord(response.result);
    lastResult = Object.keys(responseResult).length > 0 ? responseResult : response;
  }

  trace('transport.end', {
    result: summarizeRecord(lastResult),
  });
  return lastResult;
}

function createLocalCommandBridge(log: (message: string, details?: Record<string, unknown>) => void) {
  const pending: Array<{
    name: string;
    requestId: string;
    resolve: (payload: BridgeEventPayload) => void;
    reject: (error: Error) => void;
    timeoutId: number;
  }> = [];

  const emit = (name: string, payload: BridgeEventPayload = {}) => {
    log(`event ${name}`, payload);
    for (const item of [...pending]) {
      if (item.name !== name || item.requestId !== payload.requestId) continue;
      window.clearTimeout(item.timeoutId);
      pending.splice(pending.indexOf(item), 1);
      item.resolve(payload);
    }
  };

  installBridgeEventTap(emit);

  return {
    log,
    async command(name: string, params: Record<string, unknown>, expectedEvent?: string): Promise<BridgeEventPayload> {
      installBridgeEventTap(emit);
      const runtime = getProjectRuntime();
      if (!runtime?.handleCommand) throw new Error('project editor runtime is not registered');
      const requestId = String(params.requestId ?? `mock-assets-${Date.now()}-${Math.floor(Math.random() * 100000)}`);
      log(`command ${name}`, { requestId, ...params });
      trace('bridge.command.start', {
        name,
        requestId,
        expectedEvent: expectedEvent ?? null,
        params: summarizeRecord(params),
      });
      const wait = expectedEvent ? waitForEvent(expectedEvent, requestId, emit, pending) : null;
      await runtime.handleCommand(name, { ...params, requestId });
      const result = wait ? await wait : { requestId, ok: true };
      trace('bridge.command.end', {
        name,
        requestId,
        result: summarizeRecord(result),
      });
      return result;
    },
  };
}

function installBridgeEventTap(emit: (name: string, payload?: BridgeEventPayload) => void): void {
  const w = window as any;
  if (!w.__bridge) {
    w.__bridge = {
      ws: false,
      scene: Boolean(w.gameInstance?.scene),
      messenger: {},
    };
  }
  if (typeof w.__bridge.registerEditorRuntime !== 'function') {
    w.__bridge.registerEditorRuntime = (runtime: ProjectEditorRuntimeLike) => {
      w.__bridgeProjectRuntime = runtime;
      w.__pendingEditorRuntime = runtime;
    };
  }
  if (typeof w.__bridge.registerEditorPlugin !== 'function') {
    w.__bridge.registerEditorPlugin = (plugin: unknown) => {
      w.__bridgeProjectPlugin = plugin;
      w.__pendingEditorPlugin = plugin;
    };
  }
  w.__bridge.messenger = w.__bridge.messenger ?? {};
  const messenger = w.__bridge.messenger;
  if (messenger.__mockPlatformAssetsEventTap) return;
  const originalEvent = typeof messenger.event === 'function' ? messenger.event.bind(messenger) : null;
  messenger.event = (name: string, payload: BridgeEventPayload = {}) => {
    originalEvent?.(name, payload);
    trace('bridge.event', {
      name,
      payload: summarizeRecord(payload),
    });
    emit(name, payload);
  };
  messenger.__mockPlatformAssetsEventTap = true;

  if (!w.__bridgeProjectRuntime && w.__pendingEditorRuntime) {
    w.__bridgeProjectRuntime = w.__pendingEditorRuntime;
  }
  if (!w.__bridgeProjectPlugin && w.__pendingEditorPlugin) {
    w.__bridgeProjectPlugin = w.__pendingEditorPlugin;
  }
}

function waitForEvent(
  name: string,
  requestId: string,
  _emit: (name: string, payload?: BridgeEventPayload) => void,
  pending: Array<{
    name: string;
    requestId: string;
    resolve: (payload: BridgeEventPayload) => void;
    reject: (error: Error) => void;
    timeoutId: number;
  }>,
  timeoutMs = 20000,
): Promise<BridgeEventPayload> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      const index = pending.findIndex((item) => item.name === name && item.requestId === requestId);
      if (index >= 0) pending.splice(index, 1);
      reject(new Error(`wait_for_event_timeout:${name}:${requestId}`));
    }, timeoutMs);
    pending.push({ name, requestId, resolve, reject, timeoutId });
  });
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function getProjectRuntime(): ProjectEditorRuntimeLike | null {
  const w = window as any;
  return w.__bridgeProjectRuntime ?? w.__pendingEditorRuntime ?? null;
}

async function postJson(url: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  trace('http.post.start', {
    url,
    body: summarizeRecord(body),
  });
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  trace('http.post.end', {
    url,
    ok: response.ok,
    status: response.status,
    response: summarizeRecord(json as Record<string, unknown>),
  });
  if (!response.ok || json?.ok === false) {
    throw new Error(`${url} failed: ${JSON.stringify(json)}`);
  }
  return json as Record<string, unknown>;
}

function mergeState(state: MockPlatformAssetState, patch: Record<string, unknown>): void {
  assignString(patch, 'assetPath', (value) => { state.assetPath = value; });
  assignString(patch, 'assetName', (value) => { state.assetName = value; });
  assignString(patch, 'sourceId', (value) => { state.sourceId = value; }, false);
  assignString(patch, 'assetId', (value) => { state.assetId = value; }, false);
  assignString(patch, 'displayName', (value) => { state.displayName = value; });
  assignString(patch, 'category', (value) => { state.category = value; });
  assignString(patch, 'nodeId', (value) => { state.nodeId = value; }, false);
  state.position = readVec3(patch.position, state.position);
  state.rotationDeg = readVec3(patch.rotationDeg, state.rotationDeg);
  state.scale = readVec3(patch.scale, state.scale);
  state.albedoColor = readVec3(patch.albedoColor, state.albedoColor);
  state.emissiveColor = readVec3(patch.emissiveColor, state.emissiveColor);
  if (typeof patch.logText === 'string') state.logText = patch.logText;
  if (typeof patch.materialAlpha === 'number' && Number.isFinite(patch.materialAlpha)) {
    state.materialAlpha = clampNumber(patch.materialAlpha, 0, 1);
  }
}

function assignString(
  patch: Record<string, unknown>,
  key: string,
  assign: (value: string) => void,
  allowEmpty = true,
): void {
  const value = patch[key];
  if (typeof value !== 'string') return;
  const trimmed = value.trim();
  if (!allowEmpty && !trimmed) return;
  assign(trimmed);
}

function cloneState(value: MockPlatformAssetState): MockPlatformAssetState {
  return {
    ...value,
    position: [...value.position],
    rotationDeg: [...value.rotationDeg],
    scale: [...value.scale],
    albedoColor: [...value.albedoColor],
    emissiveColor: [...value.emissiveColor],
  };
}

function appendLog(
  state: MockPlatformAssetState,
  message: string,
  details?: Record<string, unknown>,
): void {
  const timestamp = new Date().toLocaleTimeString();
  const suffix = details && Object.keys(details).length > 0
    ? ` ${JSON.stringify(details)}`
    : '';
  const nextLine = `[${timestamp}] ${message}${suffix}`;
  const lines = `${state.logText ? `${state.logText}\n` : ''}${nextLine}`.split('\n');
  state.logText = lines.slice(-160).join('\n');
  window.dispatchEvent(new CustomEvent('debug-panel:set-param', {
    detail: {
      panelId: 'mock-platform-assets',
      key: 'logText',
      value: state.logText,
      scrollToEnd: true,
    },
  }));
}

function readVec3(value: unknown, fallback: Vec3Tuple): Vec3Tuple {
  if (Array.isArray(value) && value.length >= 3) {
    return [
      readFinite(value[0], fallback[0]),
      readFinite(value[1], fallback[1]),
      readFinite(value[2], fallback[2]),
    ];
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return [
      readFinite(record.x, fallback[0]),
      readFinite(record.y, fallback[1]),
      readFinite(record.z, fallback[2]),
    ];
  }
  return fallback;
}

function readFinite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toVec3Object(value: Vec3Tuple): { x: number; y: number; z: number } {
  return { x: value[0], y: value[1], z: value[2] };
}

function toRgbObject(value: Vec3Tuple): { r: number; g: number; b: number } {
  return { r: value[0], g: value[1], b: value[2] };
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function compact(input: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' && !value.trim()) continue;
    if (value == null) continue;
    output[key] = value;
  }
  return output;
}

function trace(step: string, details?: Record<string, unknown> | null): void {
  console.log(`${TRACE_PREFIX} ${step}`, details ?? {});
}

function traceError(
  step: string,
  error: unknown,
  details?: Record<string, unknown>,
): void {
  console.error(`${TRACE_PREFIX} ${step}`, {
    ...(details ?? {}),
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
}

function exposeManualTraceHelpers(state: MockPlatformAssetState): void {
  const w = window as any;
  w.__mockPlatformAssetsTrace = {
    getState: () => cloneState(state),
    dump: () => {
      const snapshot = {
        state: summarizeState(state),
        runtimeRegistered: Boolean(getProjectRuntime()?.handleCommand),
        runtimeScene: summarizeRuntimeScene(state.nodeId),
      };
      trace('manual.dump', snapshot);
      return snapshot;
    },
    exportDocumentSummary: () => {
      const runtime = getProjectRuntime() as any;
      const exported = runtime?.Editor?.exportDocument?.();
      const summary = typeof exported?.sceneJsonText === 'string'
        ? summarizeSceneJsonText(exported.sceneJsonText)
        : { ok: false, reason: 'document_export_unavailable' };
      trace('manual.exportDocumentSummary', summary);
      return summary;
    },
  };
}

function summarizeState(state: MockPlatformAssetState): Record<string, unknown> {
  return {
    assetPath: state.assetPath,
    assetName: state.assetName,
    sourceId: state.sourceId,
    assetId: state.assetId,
    displayName: state.displayName,
    category: state.category,
    nodeId: state.nodeId,
    position: toVec3Object(state.position),
    rotationDeg: toVec3Object(state.rotationDeg),
    scale: toVec3Object(state.scale),
    logLines: state.logText ? state.logText.split('\n').length : 0,
    lastStatus: state.lastStatus,
  };
}

function summarizeRecord(value: unknown, depth = 0): unknown {
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.length > 260
      ? { type: 'string', length: value.length, preview: value.slice(0, 120) }
      : value;
  }
  if (Array.isArray(value)) {
    if (depth >= 2) return { type: 'array', length: value.length };
    return value.slice(0, 8).map((item) => summarizeRecord(item, depth + 1));
  }
  if (typeof value !== 'object') return String(value);
  if (depth >= 3) return { type: 'object', keys: Object.keys(value as Record<string, unknown>).slice(0, 12) };

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (key === 'sceneJsonText' && typeof item === 'string') {
      output[key] = summarizeSceneJsonText(item);
      continue;
    }
    if (key === 'rootNode') {
      output[key] = summarizeRuntimeNode(item);
      continue;
    }
    output[key] = summarizeRecord(item, depth + 1);
  }
  return output;
}

function summarizeRuntimeScene(nodeId: string): Record<string, unknown> {
  const scene = (window as any).game?.scene ?? (window as any).gameInstance?.scene ?? null;
  const meshes = Array.isArray(scene?.meshes) ? scene.meshes : [];
  const transformNodes = Array.isArray(scene?.transformNodes) ? scene.transformNodes : [];
  const allNodes = [...meshes, ...transformNodes];
  const query = nodeId.trim().toLowerCase();
  const matches = allNodes
    .filter((node) => {
      const name = String(node?.name ?? '').toLowerCase();
      const id = String(node?.id ?? '').toLowerCase();
      return (query && (name.includes(query) || id.includes(query)))
        || name.includes('bear')
        || id.includes('bear')
        || name.includes('mock_platform')
        || id.includes('mock_platform');
    })
    .slice(0, 24)
    .map(summarizeRuntimeNode);
  return {
    meshCount: meshes.length,
    transformNodeCount: transformNodes.length,
    queryNodeId: nodeId || null,
    matchCount: matches.length,
    matches,
  };
}

function summarizeRuntimeNode(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== 'object') return null;
  const record = node as any;
  return {
    name: record.name ?? null,
    id: record.id ?? null,
    uniqueId: record.uniqueId ?? null,
    className: record.getClassName?.() ?? record.constructor?.name ?? null,
    parent: record.parent ? {
      name: record.parent.name ?? null,
      id: record.parent.id ?? null,
      uniqueId: record.parent.uniqueId ?? null,
    } : null,
    metadata: summarizeRecord(record.metadata ?? null, 2),
  };
}

function summarizeSceneJsonText(sceneJsonText: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(sceneJsonText) as any;
    const scene = parsed?.scene;
    const assets = Array.isArray(scene?.assets) ? scene.assets : [];
    const nodes = Array.isArray(scene?.nodes) ? scene.nodes : [];
    const interestingAssets = assets
      .filter((asset: any) => {
        const text = `${asset?.id ?? ''} ${asset?.sourceId ?? ''} ${asset?.name ?? ''}`.toLowerCase();
        return text.includes('bear') || text.includes('mock');
      })
      .slice(0, 16)
      .map((asset: any) => ({
        id: asset?.id ?? null,
        sourceId: asset?.sourceId ?? null,
        name: asset?.name ?? null,
      }));
    const interestingNodes = nodes
      .filter((node: any) => {
        const text = `${node?.id ?? ''} ${node?.name ?? ''} ${node?.instance?.assetId ?? ''}`.toLowerCase();
        return text.includes('bear') || text.includes('mock');
      })
      .slice(0, 16)
      .map((node: any) => ({
        id: node?.id ?? null,
        name: node?.name ?? null,
        kind: node?.kind ?? null,
        assetId: node?.instance?.assetId ?? null,
        position: node?.transform?.position ?? null,
        scale: node?.transform?.scale ?? null,
      }));
    return {
      ok: true,
      textLength: sceneJsonText.length,
      version: parsed?.version ?? null,
      updatedAt: parsed?.updatedAt ?? null,
      assetCount: assets.length,
      nodeCount: nodes.length,
      interestingAssets,
      interestingNodes,
    };
  } catch (error) {
    return {
      ok: false,
      textLength: sceneJsonText.length,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
