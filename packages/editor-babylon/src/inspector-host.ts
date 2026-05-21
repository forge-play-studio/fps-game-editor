import { createBrowserHost, type BrowserHost } from '@fps-games/editor-browser';
import type { EditorTool, SelectionController } from '@fps-games/editor-protocol';
import { getBabylonRuntime } from './runtime-globals';
import { getInspectorContainer, setInspectorPicking, syncInspectorToolState } from './inspector-adapter';
import { adaptMaterialPropertyChange } from './material-property-adapter';
import { applyOutlinePropertyChange, isOutlinePropertyKey } from './outline-adapter';
import type { BabylonRuntimeGlobal, CanonicalMaterialChange, RuntimeScene } from './types';

const INSPECTOR_V2_URL = 'https://preview.babylonjs.com/inspector/babylon.inspector-v2.bundle.js';
const INSPECTOR_HIGHLIGHT_SETTING_KEY = 'Babylon/Inspector/HighlightSelectedEntity';

type InspectorToken = { dispose(): void; isDisposed?: boolean } | null;

export type InspectorV2 = {
  ShowInspector?: (scene: RuntimeScene, options?: Record<string, unknown>) => InspectorToken;
  ConvertOptions?: (options: Record<string, unknown>) => Record<string, unknown>;
  SelectionServiceIdentity?: unknown;
  Inspector?: {
    OnPropertyChangedObservable?: { add?: (handler: (event: unknown) => void) => unknown; remove?: (observer: unknown) => void };
  };
};

export interface EditorInspectorHostOptions {
  host?: BrowserHost;
  babylon?: BabylonRuntimeGlobal | null;
  inspectorUrl?: string;
  getScene: () => RuntimeScene | null;
  getSelectionController: () => SelectionController | null;
  getSelectedEntity: () => unknown | null;
  getCurrentTool?: () => EditorTool;
  resolveBinding?: (node: unknown) => any | null;
  onMaterialPropertyChanged?: (change: CanonicalMaterialChange) => void;
  onContextSelection?: (payload: unknown) => void;
  loadGizmoModules?: () => Promise<unknown[]>;
}

export interface EditorInspectorHost {
  init(nextScene: RuntimeScene | null): void;
  show(): Promise<void>;
  hide(): void;
  isVisible(): boolean;
  syncTool(tool: EditorTool): void;
  tuneOutlineLayer(): void;
}

function patchSelection(host: BrowserHost): void {
  const SelectionCtor = (host.window as Window & typeof globalThis).Selection;
  const RangeCtor = (host.window as Window & typeof globalThis).Range;
  const NodeCtor = (host.window as Window & typeof globalThis).Node;
  if (!SelectionCtor || !RangeCtor || !NodeCtor) return;
  const proto = SelectionCtor.prototype as Selection & { __fpsEditorPatched?: boolean };
  if (proto.__fpsEditorPatched) return;
  const original = proto.addRange;
  proto.addRange = function patchedAddRange(range: Range) {
    original.call(this, range);
    if (this.toString()) return;

    let node: Node = range.startContainer;
    if (node.nodeType === NodeCtor.ELEMENT_NODE && range.startOffset < node.childNodes.length) {
      node = node.childNodes[range.startOffset]!;
    }
    const element = (node.nodeType === NodeCtor.ELEMENT_NODE ? node : node.parentElement) as HTMLElement | null;
    if (!element) return;
    element.style.setProperty('user-select', 'text', 'important');
    original.call(this, range);
  };
  proto.__fpsEditorPatched = true;
}

function patchGizmoManagerPrototype(GizmoManager: any, marker: string): void {
  const proto = GizmoManager?.prototype;
  if (!proto || proto[marker]) return;

  const applyRotationOverride = (manager: any) => {
    if (manager?.gizmos?.rotationGizmo) manager.gizmos.rotationGizmo.updateGizmoRotationToMatchAttachedMesh = false;
  };

  const rotationDesc = Object.getOwnPropertyDescriptor(proto, 'rotationGizmoEnabled');
  if (rotationDesc?.get && rotationDesc.set) {
    const setRotationGizmoEnabled = rotationDesc.set;
    Object.defineProperty(proto, 'rotationGizmoEnabled', {
      configurable: true,
      enumerable: rotationDesc.enumerable ?? false,
      get: rotationDesc.get,
      set(this: any, value: boolean) {
        setRotationGizmoEnabled.call(this, value);
        if (value) applyRotationOverride(this);
      },
    });
  }

  const coordinatesDesc = Object.getOwnPropertyDescriptor(proto, 'coordinatesMode');
  if (coordinatesDesc?.get && coordinatesDesc.set) {
    const setCoordinatesMode = coordinatesDesc.set;
    Object.defineProperty(proto, 'coordinatesMode', {
      configurable: true,
      enumerable: coordinatesDesc.enumerable ?? false,
      get: coordinatesDesc.get,
      set(this: any, value: number) {
        setCoordinatesMode.call(this, value);
        applyRotationOverride(this);
      },
    });
  }

  Object.defineProperty(proto, marker, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });
}

function patchRotationGizmoPrototype(RotationGizmo: any, marker: string): void {
  const proto = RotationGizmo?.prototype;
  if (!proto || proto[marker]) return;

  const applyRotationOverride = (gizmo: any) => {
    if (!gizmo) return;
    if (gizmo.xGizmo) gizmo.xGizmo.updateGizmoRotationToMatchAttachedMesh = false;
    if (gizmo.yGizmo) gizmo.yGizmo.updateGizmoRotationToMatchAttachedMesh = false;
    if (gizmo.zGizmo) gizmo.zGizmo.updateGizmoRotationToMatchAttachedMesh = false;
  };

  const updateDesc = Object.getOwnPropertyDescriptor(proto, 'updateGizmoRotationToMatchAttachedMesh');
  if (updateDesc?.get && updateDesc.set) {
    const setUpdateGizmoRotation = updateDesc.set;
    Object.defineProperty(proto, 'updateGizmoRotationToMatchAttachedMesh', {
      configurable: true,
      enumerable: updateDesc.enumerable ?? false,
      get: updateDesc.get,
      set(this: any, _value: boolean) {
        setUpdateGizmoRotation.call(this, false);
        applyRotationOverride(this);
      },
    });
  }

  const coordinatesDesc = Object.getOwnPropertyDescriptor(proto, 'coordinatesMode');
  if (coordinatesDesc?.set) {
    const setCoordinatesMode = coordinatesDesc.set;
    Object.defineProperty(proto, 'coordinatesMode', {
      configurable: true,
      enumerable: coordinatesDesc.enumerable ?? false,
      get: coordinatesDesc.get,
      set(this: any, value: number) {
        setCoordinatesMode.call(this, value);
        applyRotationOverride(this);
      },
    });
  }

  Object.defineProperty(proto, marker, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });
}

function patchPlaneRotationGizmoPrototype(PlaneRotationGizmo: any, marker: string): void {
  const proto = PlaneRotationGizmo?.prototype;
  if (!proto || proto[marker]) return;

  const forceDisabled = function forceDisabled(this: any) {
    this._updateGizmoRotationToMatchAttachedMesh = false;
  };

  const baseProto = Object.getPrototypeOf(proto);
  const updateDesc = baseProto ? Object.getOwnPropertyDescriptor(baseProto, 'updateGizmoRotationToMatchAttachedMesh') : null;
  if (updateDesc?.get && updateDesc.set) {
    const getUpdateGizmoRotation = updateDesc.get;
    const setUpdateGizmoRotation = updateDesc.set;
    Object.defineProperty(proto, 'updateGizmoRotationToMatchAttachedMesh', {
      configurable: true,
      enumerable: updateDesc.enumerable ?? false,
      get(this: any) {
        return getUpdateGizmoRotation.call(this);
      },
      set(this: any, _value: boolean) {
        setUpdateGizmoRotation.call(this, false);
        forceDisabled.call(this);
      },
    });
  }

  const coordinatesDesc = baseProto ? Object.getOwnPropertyDescriptor(baseProto, 'coordinatesMode') : null;
  if (coordinatesDesc?.get && coordinatesDesc.set) {
    const getCoordinatesMode = coordinatesDesc.get;
    const setCoordinatesMode = coordinatesDesc.set;
    Object.defineProperty(proto, 'coordinatesMode', {
      configurable: true,
      enumerable: coordinatesDesc.enumerable ?? false,
      get(this: any) {
        return getCoordinatesMode.call(this);
      },
      set(this: any, value: number) {
        setCoordinatesMode.call(this, value);
        forceDisabled.call(this);
      },
    });
  }

  Object.defineProperty(proto, marker, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });
}

function patchBabylonGizmoClasses(source: any, markerPrefix: string): void {
  if (!source) return;
  patchGizmoManagerPrototype(source.GizmoManager, `${markerPrefix}Manager`);
  patchRotationGizmoPrototype(source.RotationGizmo, `${markerPrefix}Rotation`);
  patchPlaneRotationGizmoPrototype(source.PlaneRotationGizmo, `${markerPrefix}Plane`);
}

function patchInstancedMeshOutlineProperties(source: any, marker: string): void {
  const proto = source?.InstancedMesh?.prototype;
  if (!proto || proto[marker]) return;

  const defineForwardedProperty = (property: 'renderOutline' | 'outlineColor' | 'outlineWidth') => {
    Object.defineProperty(proto, property, {
      configurable: true,
      enumerable: true,
      get(this: any) {
        return this?.sourceMesh?.[property];
      },
      set(this: any, value: unknown) {
        if (this?.sourceMesh) {
          this.sourceMesh[property] = value;
          return;
        }
        Object.defineProperty(this, property, { value, writable: true, configurable: true, enumerable: true });
      },
    });
  };

  defineForwardedProperty('renderOutline');
  defineForwardedProperty('outlineColor');
  defineForwardedProperty('outlineWidth');
  Object.defineProperty(proto, marker, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });
}

function patchInspectorDefaults(host: BrowserHost, babylon?: BabylonRuntimeGlobal | null): void {
  try { host.window.localStorage.setItem(INSPECTOR_HIGHLIGHT_SETTING_KEY, 'false'); } catch {}
  patchInstancedMeshOutlineProperties(getBabylonRuntime(babylon), '__fpsEditorInstancedOutlinePatched');
}

async function patchRotationGizmoDefaults(host: BrowserHost, options: EditorInspectorHostOptions): Promise<void> {
  try {
    patchInspectorDefaults(host, options.babylon);
    patchBabylonGizmoClasses(getBabylonRuntime(options.babylon), '__fpsEditorRuntime');
    const modules = await options.loadGizmoModules?.();
    if (modules?.length) {
      patchBabylonGizmoClasses(Object.assign({}, ...modules), '__fpsEditorModule');
    }
  } catch {}
}

function injectInspectorStyle(host: BrowserHost): void {
  if (host.document.getElementById('fps-editor-inspector-style')) return;
  const style = host.document.createElement('style');
  style.id = 'fps-editor-inspector-style';
  style.textContent = [
    '#inspector-host, #babylon-inspector-container { z-index: 99999 !important; }',
    '#inspector-host button.bridge-tool-inactive, #babylon-inspector-container button.bridge-tool-inactive {',
    '  background: transparent !important;',
    '  box-shadow: none !important;',
    '}',
    '#inspector-host button.bridge-tool-active, #babylon-inspector-container button.bridge-tool-active {',
    '  background: rgba(120, 120, 120, 0.22) !important;',
    '  box-shadow: inset 0 0 0 1px rgba(120, 120, 120, 0.55) !important;',
    '}',
  ].join('\n');
  host.document.head.appendChild(style);
}

function tuneOutlineLayer(scene: RuntimeScene | null): void {
  const engine = scene?.getEngine?.() as any;
  if (!engine?._virtualScenes) return;
  for (const virtualScene of engine._virtualScenes) {
    for (const layer of virtualScene.effectLayers || []) {
      if (layer.name !== 'InspectorSelectionOutline') continue;
      layer.clearSelection?.();
      layer.outlineThickness = 0;
      layer.occlusionStrength = 0;
      layer.isEnabled = false;
    }
  }
}

function serializeNode(node: any | null) {
  if (!node) return null;
  const parent = node.parent ?? null;
  return {
    name: node.name ?? null,
    id: node.id ?? null,
    uniqueId: node.uniqueId ?? null,
    type: node.getClassName?.() || node.constructor?.name || 'Unknown',
    metadata: node.metadata ?? null,
    parent: parent ? {
      name: parent.name ?? null,
      id: parent.uniqueId ?? parent.id ?? null,
      type: parent.getClassName?.() || parent.constructor?.name || 'Unknown',
    } : null,
    transform: {
      position: node.position ? { x: node.position.x, y: node.position.y, z: node.position.z } : null,
      rotation: node.rotation ? { x: node.rotation.x, y: node.rotation.y, z: node.rotation.z } : null,
      scaling: node.scaling ? { x: node.scaling.x, y: node.scaling.y, z: node.scaling.z } : null,
      rotationQuaternion: node.rotationQuaternion
        ? { x: node.rotationQuaternion.x, y: node.rotationQuaternion.y, z: node.rotationQuaternion.z, w: node.rotationQuaternion.w }
        : null,
    },
    material: node.material ? {
      name: node.material.name ?? null,
      type: node.material.getClassName?.() || node.material.constructor?.name || 'Unknown',
    } : null,
  };
}

async function ensureEditorInspector(host: BrowserHost, options: EditorInspectorHostOptions): Promise<InspectorV2 | null> {
  const ensureInspectorReady = (host.window as any).ensureInspectorReady;
  if (typeof ensureInspectorReady === 'function') {
    try {
      const localInspector = await ensureInspectorReady();
      if (localInspector?.ShowInspector) return localInspector as InspectorV2;
    } catch {}
  }

  const existing = (host.window as any).INSPECTOR as InspectorV2 | undefined;
  if (existing?.ShowInspector) return existing;

  const url = (host.window as any).BRIDGE_INSPECTOR_URL || options.inspectorUrl || INSPECTOR_V2_URL;
  try {
    await new Promise<void>((resolve, reject) => {
      const script = host.document.createElement('script');
      script.src = url;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load: ${url}`));
      host.document.head.appendChild(script);
    });
    const loaded = (host.window as any).INSPECTOR as InspectorV2 | undefined;
    return loaded?.ShowInspector ? loaded : null;
  } catch {
    return null;
  }
}

function isHostHTMLElement(target: EventTarget | null, host: BrowserHost): target is HTMLElement {
  const ElementCtor = (host.window as Window & typeof globalThis).HTMLElement ?? HTMLElement;
  return typeof ElementCtor === 'function' && target instanceof ElementCtor;
}

export function createEditorInspectorHost(options: EditorInspectorHostOptions): EditorInspectorHost {
  const host = options.host ?? createBrowserHost();
  let scene: RuntimeScene | null = null;
  let inspectorVisible = false;
  let inspectorToken: InspectorToken = null;
  let dblclickHandler: ((event: MouseEvent) => void) | null = null;
  let propertyChangedObservable: any = null;
  let propertyChangedObserver: any = null;

  function emitContextSelection(node: unknown | null): void {
    options.onContextSelection?.(serializeNode(node));
  }

  function unbindDblclick(): void {
    if (!dblclickHandler) return;
    host.document.removeEventListener('dblclick', dblclickHandler);
    dblclickHandler = null;
  }

  function unbindPropertyChanged(): void {
    if (propertyChangedObservable && propertyChangedObserver) {
      try { propertyChangedObservable.remove?.(propertyChangedObserver); } catch {}
    }
    propertyChangedObservable = null;
    propertyChangedObserver = null;
  }

  function bindPropertyChanged(v2?: InspectorV2 | null): void {
    unbindPropertyChanged();
    const observable = v2?.Inspector?.OnPropertyChangedObservable
      ?? getBabylonRuntime(options.babylon)?.Inspector?.OnPropertyChangedObservable
      ?? scene?.debugLayer?.onPropertyChangedObservable
      ?? null;
    if (!observable?.add) return;

    propertyChangedObservable = observable;
    propertyChangedObserver = observable.add((event: any) => {
      const property = typeof event?.property === 'string' ? event.property : '';
      const entity = event?.object ?? null;
      if (!entity) return;

      if (isOutlinePropertyKey(property)) {
        applyOutlinePropertyChange({
          entity,
          property,
          value: event?.value,
          initialValue: event?.initialValue,
        });
        return;
      }

      const materialChange = adaptMaterialPropertyChange({
        scene,
        selectedEntity: options.getSelectedEntity() as any,
        entity,
        propertyKey: property,
        oldValue: event?.initialValue,
        newValue: event?.value,
        resolveBinding: node => options.resolveBinding?.(node) ?? null,
      });
      if (materialChange) options.onMaterialPropertyChanged?.(materialChange);
    });
  }

  function bindDblclick(): void {
    unbindDblclick();
    dblclickHandler = (event: MouseEvent) => {
      const selected = options.getSelectedEntity();
      if (!selected) return;
      const rawTarget = event.target as EventTarget | null;
      const target = isHostHTMLElement(rawTarget, host) ? rawTarget : null;
      if (!target) return;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;

      const canvas = scene?.getEngine?.()?.getRenderingCanvas?.() ?? null;
      if (rawTarget === canvas || target.closest?.('#inspector-host, #babylon-inspector-container')) {
        emitContextSelection(selected);
      }
    };
    host.document.addEventListener('dblclick', dblclickHandler);
  }

  function applyCurrentSelectionAndTool(): void {
    const selectionController = options.getSelectionController();
    const selectedEntity = options.getSelectedEntity();
    if (selectedEntity) selectionController?.selectEntity?.(selectedEntity, true);
    const tool = options.getCurrentTool?.();
    if (tool) syncInspectorToolState(tool, getInspectorContainer(host), host);
  }

  return {
    init(nextScene: RuntimeScene | null): void {
      scene = nextScene;
      patchInspectorDefaults(host, options.babylon);
      patchSelection(host);
      void patchRotationGizmoDefaults(host, options);
    },

    async show(): Promise<void> {
      if (!scene) return;
      await patchRotationGizmoDefaults(host, options);
      const selectionController = options.getSelectionController();
      const v2 = await ensureEditorInspector(host, options);

      if (v2?.ShowInspector) {
        const selectionBridge = selectionController?.createV2SelectionBridge?.(v2);
        const serviceDefinitions = [selectionBridge].filter(Boolean);
        const inspectorOptions = {
          ...(typeof v2.ConvertOptions === 'function' ? v2.ConvertOptions({ embedMode: true }) : { layoutMode: 'overlay' }),
          serviceDefinitions: serviceDefinitions.length ? serviceDefinitions : undefined,
        };
        inspectorToken = v2.ShowInspector(scene, inspectorOptions);
        inspectorVisible = true;
        injectInspectorStyle(host);
        bindPropertyChanged(v2);
        selectionController?.bindSelectionSourceTracking?.();
        selectionController?.enablePicking?.();
        bindDblclick();
        host.setTimeout(() => tuneOutlineLayer(scene), 200);
        applyCurrentSelectionAndTool();
        return;
      }

      if (scene.debugLayer?.show) {
        await scene.debugLayer.show({
          embedMode: true,
          initialTab: getBabylonRuntime(options.babylon)?.DebugLayerTab?.Properties ?? 0,
        });
        inspectorVisible = true;
        injectInspectorStyle(host);
        bindPropertyChanged();
        selectionController?.bindSelectionSourceTracking?.();
        selectionController?.enablePicking?.();
        bindDblclick();
        applyCurrentSelectionAndTool();
        return;
      }

      const Inspector = getBabylonRuntime(options.babylon)?.Inspector;
      if (Inspector?.Show) {
        Inspector.Show(scene, {
          embedMode: true,
          initialTab: getBabylonRuntime(options.babylon)?.DebugLayerTab?.Properties ?? 0,
        });
        inspectorVisible = true;
        injectInspectorStyle(host);
        bindPropertyChanged();
        selectionController?.bindSelectionSourceTracking?.();
        selectionController?.enablePicking?.();
        bindDblclick();
        applyCurrentSelectionAndTool();
      }
    },

    hide(): void {
      if (!inspectorVisible) return;
      unbindDblclick();
      unbindPropertyChanged();
      options.getSelectionController()?.reset?.();
      try {
        if (inspectorToken) {
          if (!inspectorToken.isDisposed) inspectorToken.dispose();
          inspectorToken = null;
        } else if (scene?.debugLayer) {
          scene.debugLayer.hide();
        } else {
          const Inspector = getBabylonRuntime(options.babylon)?.Inspector;
          if (Inspector?.Hide) Inspector.Hide();
        }
      } catch {}
      inspectorVisible = false;
    },

    isVisible(): boolean {
      return inspectorVisible;
    },

    syncTool(tool: EditorTool): void {
      syncInspectorToolState(tool, getInspectorContainer(host), host);
    },

    tuneOutlineLayer(): void {
      tuneOutlineLayer(scene);
    },
  };
}

export function setInspectorPickingState(enabled: boolean, host?: BrowserHost): boolean {
  return setInspectorPicking(enabled, getInspectorContainer(host));
}
