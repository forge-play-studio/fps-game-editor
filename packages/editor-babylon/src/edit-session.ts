import { createBrowserHost, type BrowserHost } from '@fps-games/editor-browser';
import type { EditorTool } from '@fps-games/editor-protocol';
import {
  attachEditorViewportMovement,
  createEditorViewportCamera,
  disposeEditorViewportCamera,
  focusEditorViewportSelection,
  type EditorViewportCameraCtx,
} from './camera-controller';
import { createEditorEventGuard, type EditorEventGuard } from './event-guard';
import { createEditorInputController } from './input-controller';
import { createEditorToolController, type EditorToolController } from './tool-controller';
import type {
  BabylonRuntimeGlobal,
  EditorGameLike,
  EditorInputControllerApi,
  RuntimeCamera,
  RuntimeNode,
  RuntimeScene,
} from './types';

export interface EditorEditSessionOptions {
  host?: BrowserHost;
  babylon?: BabylonRuntimeGlobal | null;
  getScene: () => RuntimeScene | null;
  getGame: () => EditorGameLike | null;
  getSelectedEntity?: () => RuntimeNode | null;
  emitModeChange: (mode: 'edit' | 'play') => void;
  onSetTool?: (tool: EditorTool) => void;
  onEnablePicking?: () => void;
  onFocusSelected?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onDuplicateSelected?: () => void | Promise<void>;
  syncExternalToolState?: (tool: EditorTool) => boolean;
  eventGuardInteractiveRootSelector?: string;
}

export interface EditorEditSession {
  readonly active: boolean;
  enter(): Promise<void>;
  exit(save?: boolean): Promise<void>;
  isViewportNavigationActive(): boolean;
  focusSelected(node: RuntimeNode | null): boolean;
  syncSelection(node: RuntimeNode | null): void;
  currentTool(): EditorTool;
}

type EditorEditState = {
  active: boolean;
  editorCamera: RuntimeCamera | null;
  savedCam: RuntimeCamera | null;
  savedActiveCams: RuntimeCamera[];
  detachedCams: RuntimeCamera[];
  resizeObs: unknown;
  viewportCtx: EditorViewportCameraCtx | null;
  wasPausedBeforeEnter: boolean;
  savedPointerCam: unknown;
  savedAnimEnabled: boolean;
  pausedAnimGroups: Array<{ pause?: () => void; play?: () => void }>;
  frozenBeforeObs: unknown[] | null;
  frozenKeyboardObs: unknown[] | null;
  tools: EditorToolController | null;
  input: EditorInputControllerApi;
  eventGuard: EditorEventGuard | null;
};

function setSceneActiveCamera(scene: RuntimeScene, camera: RuntimeCamera | null): void {
  if (!scene || !camera) return;
  scene.activeCamera = camera;
  scene.activeCameras = [camera];
}

function getRenderCanvas(scene: RuntimeScene): HTMLCanvasElement | null {
  return scene?.getEngine?.()?.getRenderingCanvas?.() ?? null;
}

function resetStateAfterExit(state: EditorEditState): void {
  state.active = false;
  state.viewportCtx = null;
  state.editorCamera = null;
  state.savedCam = null;
  state.savedActiveCams = [];
  state.detachedCams = [];
  state.resizeObs = null;
  state.savedPointerCam = null;
  state.savedAnimEnabled = true;
  state.pausedAnimGroups = [];
  state.frozenBeforeObs = null;
  state.frozenKeyboardObs = null;
  state.wasPausedBeforeEnter = false;
}

export function createEditorEditSession(options: EditorEditSessionOptions): EditorEditSession {
  const host = options.host ?? createBrowserHost();
  const state: EditorEditState = {
    active: false,
    editorCamera: null,
    savedCam: null,
    savedActiveCams: [],
    detachedCams: [],
    resizeObs: null,
    viewportCtx: null,
    wasPausedBeforeEnter: false,
    savedPointerCam: null,
    savedAnimEnabled: true,
    pausedAnimGroups: [],
    frozenBeforeObs: null,
    frozenKeyboardObs: null,
    tools: null,
    input: createEditorInputController(),
    eventGuard: null,
  };

  function disposeTools(): void {
    state.tools?.dispose();
    state.tools = null;
  }

  function deactivateControllers(): void {
    state.input.dispose();
    state.input.resetViewportNavigation();
    disposeTools();
    state.eventGuard?.deactivate();
  }

  function movePostProcessPipelines(
    scene: RuntimeScene,
    fromCamera: RuntimeCamera | null,
    toCamera: RuntimeCamera | null,
  ): void {
    if (!scene || !fromCamera || !toCamera || fromCamera === toCamera) return;
    const ppm = scene.postProcessRenderPipelineManager;
    const pipelines = ppm?.supportedPipelines || [];
    for (const pipeline of pipelines) {
      const name = pipeline?._name || pipeline?.name;
      if (!name) continue;
      try {
        ppm.detachCamerasFromRenderPipeline(name, fromCamera);
        ppm.attachCamerasToRenderPipeline(name, toCamera);
      } catch {}
    }
  }

  async function enter(): Promise<void> {
    if (state.active) {
      options.emitModeChange('edit');
      return;
    }

    const game = options.getGame();
    const scene = options.getScene() ?? game?.scene ?? null;
    if (!scene) {
      options.emitModeChange('play');
      return;
    }

    state.wasPausedBeforeEnter = !!game?.isPausedState?.();

    if (game && typeof game.enterPreview === 'function') {
      try {
        await game.enterPreview();
        state.active = true;
        options.emitModeChange('edit');
        return;
      } catch {}
    }

    game?.pause?.();
    state.savedCam = scene.activeCamera ?? null;
    state.savedActiveCams = scene.activeCameras ? [...scene.activeCameras] : [];
    state.detachedCams = [];

    const kbObs = scene.onKeyboardObservable;
    if (kbObs?._observers?.length) {
      state.frozenKeyboardObs = kbObs._observers.splice(0);
    }

    const canvas = getRenderCanvas(scene);
    for (const cam of scene.cameras || []) {
      if (cam?.detachControl) {
        cam.detachControl();
        state.detachedCams.push(cam);
      }
    }

    state.viewportCtx = await createEditorViewportCamera(scene, state.savedCam, {
      babylon: options.babylon,
      input: state.input,
    });
    state.editorCamera = state.viewportCtx?.camera ?? null;
    if (state.editorCamera) {
      setSceneActiveCamera(scene, state.editorCamera);
      movePostProcessPipelines(scene, state.savedCam, state.editorCamera);
    }

    if (canvas && scene.getEngine) {
      const engine = scene.getEngine();
      state.resizeObs = scene.onAfterRenderObservable?.add?.(() => {
        if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
          engine.resize();
        }
      }) ?? null;
      state.eventGuard = state.eventGuard ?? createEditorEventGuard({
        host,
        interactiveRootSelector: options.eventGuardInteractiveRootSelector,
      });
      state.eventGuard.activate(canvas);
    }

    state.savedAnimEnabled = scene.animationsEnabled !== false;
    scene.animationsEnabled = false;

    state.pausedAnimGroups = (scene.animationGroups || []).filter((ag: any) => ag?.isPlaying);
    for (const ag of state.pausedAnimGroups) {
      try { ag?.pause?.(); } catch {}
    }

    state.savedPointerCam = scene.cameraToUseForPointers ?? null;
    if (state.editorCamera) scene.cameraToUseForPointers = state.editorCamera;

    const beforeObs = scene.onBeforeRenderObservable;
    if (beforeObs?._observers?.length) {
      const keep: unknown[] = [];
      const freeze: unknown[] = [];
      for (const obs of beforeObs._observers) {
        const candidate = obs as any;
        const cbStr = candidate.callback?.toString?.() || '';
        const ctx = candidate.scope ?? candidate.callback?.__this;
        const ctxName = ctx?.constructor?.name || '';
        const isRendering = /ShadowGenerator|GlowLayer|HighlightLayer|ReflectionProbe|RenderTargetTexture|EffectLayer/i.test(ctxName)
          || /shadowMap|renderTarget|glowLayer|highlightLayer|reflectionProbe/i.test(cbStr);
        (isRendering ? keep : freeze).push(obs);
      }
      beforeObs._observers = keep;
      state.frozenBeforeObs = freeze;
    }

    state.active = true;
    state.tools = createEditorToolController({
      getScene: () => scene,
      getSelectedEntity: () => options.getSelectedEntity?.() ?? null,
      enablePicking: () => options.onEnablePicking?.(),
      babylon: options.babylon,
      syncExternalToolState: options.syncExternalToolState,
    });

    state.input.init({
      host,
      getCanvas: () => getRenderCanvas(scene),
      isEditActive: () => state.active,
      onSetTool: (tool) => {
        const handled = state.tools?.setTool(tool) ?? false;
        if (!handled) options.onSetTool?.(tool);
      },
      onFocusSelected: () => options.onFocusSelected?.(),
      onUndo: () => options.onUndo?.(),
      onRedo: () => options.onRedo?.(),
      onDuplicateSelected: () => options.onDuplicateSelected?.(),
    });

    if (state.viewportCtx && !state.viewportCtx.renderObs) {
      attachEditorViewportMovement(scene, state.viewportCtx, {
        babylon: options.babylon,
        input: state.input,
      });
    }

    if (game?.onEditEnter) {
      try { await game.onEditEnter(); } catch {}
    }

    options.emitModeChange('edit');
  }

  async function exit(save = true): Promise<void> {
    if (!state.active) {
      options.emitModeChange('play');
      return;
    }

    deactivateControllers();

    const game = options.getGame();
    const scene = options.getScene() ?? game?.scene ?? null;
    if (game && typeof game.exitPreview === 'function') {
      try { await game.exitPreview(save); } catch {}
      resetStateAfterExit(state);
      options.emitModeChange('play');
      return;
    }
    if (!scene) {
      resetStateAfterExit(state);
      options.emitModeChange('play');
      return;
    }

    if (state.resizeObs) {
      scene.onAfterRenderObservable?.remove?.(state.resizeObs);
      state.resizeObs = null;
    }

    disposeEditorViewportCamera(scene, state.viewportCtx);
    state.viewportCtx = null;
    const editorCamera = state.editorCamera;
    state.editorCamera = null;
    if (state.savedCam) {
      movePostProcessPipelines(scene, editorCamera, state.savedCam);
      scene.activeCamera = state.savedCam;
      scene.activeCameras = state.savedActiveCams;
    }
    state.savedCam = null;
    state.savedActiveCams = [];

    const canvas = getRenderCanvas(scene);
    if (canvas) {
      for (const cam of state.detachedCams) {
        if (cam?.attachControl) cam.attachControl(canvas, true);
      }
    }
    state.detachedCams = [];

    const beforeObs = scene.onBeforeRenderObservable;
    if (state.frozenBeforeObs && beforeObs?._observers) {
      beforeObs._observers.unshift(...state.frozenBeforeObs);
      state.frozenBeforeObs = null;
    }

    const kbObs = scene.onKeyboardObservable;
    if (state.frozenKeyboardObs && kbObs?._observers) {
      kbObs._observers.unshift(...state.frozenKeyboardObs);
      state.frozenKeyboardObs = null;
    }

    scene.cameraToUseForPointers = state.savedPointerCam;
    state.savedPointerCam = null;

    if (state.savedAnimEnabled) scene.animationsEnabled = true;
    state.savedAnimEnabled = true;
    for (const ag of state.pausedAnimGroups) {
      try { ag?.play?.(); } catch {}
    }
    state.pausedAnimGroups = [];
    disposeTools();

    if (game?.onEditExit) {
      try { await game.onEditExit(); } catch {}
    }

    if (!state.wasPausedBeforeEnter) game?.resume?.();
    resetStateAfterExit(state);
    options.emitModeChange('play');
  }

  return {
    get active(): boolean {
      return state.active;
    },
    enter,
    exit,
    isViewportNavigationActive(): boolean {
      return state.input.isViewportNavigationActive();
    },
    focusSelected(node: RuntimeNode | null): boolean {
      return focusEditorViewportSelection(state.editorCamera, node, { babylon: options.babylon });
    },
    syncSelection(node: RuntimeNode | null): void {
      state.tools?.syncSelection(node ?? null);
    },
    currentTool(): EditorTool {
      return state.tools?.currentTool?.() ?? 'pick';
    },
  };
}
