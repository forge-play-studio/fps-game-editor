import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Material } from '@babylonjs/core/Materials/material';
import { MultiMaterial } from '@babylonjs/core/Materials/multiMaterial';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { Scene } from '@babylonjs/core/scene';
import { ColorCurves } from '@babylonjs/core/Materials/colorCurves';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import type { MaterialOverrideConfig, SceneSharedMaterialConfig } from '../config';
import { configService } from '../config';
import { applyMaterialDebugAdjustments } from '../utils/materialDebugAdjust';
import {
  getProjectEditorWorkingDocument,
  loadProjectEditorDocument,
} from '../fps-game-editor-adapter';

declare const dat: any;

const DAT_GUI_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/dat-gui/0.6.2/dat.gui.min.js';
const SCENE_JSON_PATH = '/home/user/code/src/config/scene.json';
const LOCAL_SCENE_JSON_CACHE_KEY = 'live_panel_scene_json_cache_v1';

type PlayerTuning = {
  pickupArcHeight: number;
  pickupScale: number;
  pickupScaleCycles: number;
  pickupSpinTurns: number;
  deliveryArcHeight: number;
  deliveryScale: number;
  deliveryScaleCycles: number;
  deliverySpinTurns: number;
  deliveryDuration: number;
  machineAnimationSpeedRatio: number;
  machineTransferArcHeight: number;
  machineTransferScale: number;
  machineTransferScaleCycles: number;
  machineTransferSpinTurns: number;
  machineTransferDuration: number;
};

type PlayerLike = {
  getAnimationTuning?: () => PlayerTuning;
  setAnimationTuning?: (partial: Partial<PlayerTuning>) => void;
  position?: { x: number; y: number; z: number };
};

type GameLike = {
  getPlayer?: () => PlayerLike | null;
  getRenderingService?: () => {
    getPipeline?: () => {
      imageProcessing: {
        exposure: number;
        contrast: number;
        colorCurvesEnabled: boolean;
        colorCurves: ColorCurves | null;
        vignetteEnabled: boolean;
        vignetteWeight: number;
        vignetteColor: Color4;
      };
    } | null;
  } | null;
};

let panelToastEl: HTMLDivElement | null = null;
let panelToastTimer: number | null = null;
let livePanelKeyupDispose: (() => void) | null = null;

export interface LivePanelSession {
  dispose(): void;
}

interface Param {
  configPath: string;
  label: string;
  min: number;
  defaultMax: number;
  step: number;
  get: () => number;
  set: (v: number) => void;
}

interface ModelTarget {
  key: string;
  label: string;
  root: TransformNode | AbstractMesh;
  sceneNodeId: string | null;
  persistMode: 'scene' | 'local';
}

interface MaterialPanelState {
  selectedModelKey: string;
  info: string;
  contrast: number;
  brightness: number;
  saturation: number;
  hue: number;
  colorDensity: number;
  metallic: number;
  roughness: number;
  alpha: number;
  alphaCutOff: number;
  transparencyMode: string;
}

interface GlobalColorPanelState {
  contrast: number;
  brightness: number;
  saturation: number;
  hue: number;
  colorDensity: number;
  red: number;
  green: number;
  blue: number;
}

const MATERIAL_PANEL_LOCAL_STORAGE_KEY = 'live_material_panel_values_v2';
const LEGACY_MATERIAL_PANEL_LOCAL_STORAGE_KEYS = ['live_material_panel_values_v1'];
const GLOBAL_COLOR_PANEL_LOCAL_STORAGE_KEY = 'live_global_color_panel_v1';

function getPlayer(): PlayerLike | null {
  const game = (window as typeof window & { gameInstance?: GameLike | null }).gameInstance;
  return game?.getPlayer?.() ?? null;
}

function getGuiRootStyle(gui: any): CSSStyleDeclaration {
  return gui.domElement.style as CSSStyleDeclaration;
}

function disposeLivePanelDom(): void {
  livePanelKeyupDispose?.();
  livePanelKeyupDispose = null;
  removeLivePanelElement('liveTweakGUI');
  removeLivePanelElement('liveMaterialGUI');
  removeLivePanelElement('liveGlobalColorGUI');
  if (panelToastTimer !== null) {
    window.clearTimeout(panelToastTimer);
    panelToastTimer = null;
  }
  panelToastEl?.remove();
  panelToastEl = null;
}

function removeLivePanelElement(id: string): void {
  const element = document.getElementById(id);
  if (!element) return;
  const posTimer = (element as any).__posTimer;
  const layoutTimer = (element as any).__layoutTimer;
  if (typeof posTimer === 'number') window.clearInterval(posTimer);
  if (typeof layoutTimer === 'number') window.clearInterval(layoutTimer);
  element.remove();
}

export async function mountLivePanel(sceneInput: unknown, opts: { sandboxId?: string } = {}): Promise<LivePanelSession> {
  await loadDatGui();
  clearLegacyMaterialDrafts();
  const resolvedSandboxId = resolveSandboxId(opts.sandboxId);
  const scene = isScene(sceneInput) ? sceneInput : null;

  const params: Param[] = [
    { configPath: 'gameplay.playerAnimation.pickupArcHeight', label: '收集抛物线高度', min: 0.1, defaultMax: 5, step: 0.01, get: () => getPlayer()?.getAnimationTuning?.().pickupArcHeight ?? 0.55, set: (v) => getPlayer()?.setAnimationTuning?.({ pickupArcHeight: v }) },
    { configPath: 'gameplay.playerAnimation.pickupScale', label: '收集缩放大小', min: 0.2, defaultMax: 2, step: 0.01, get: () => getPlayer()?.getAnimationTuning?.().pickupScale ?? 1, set: (v) => getPlayer()?.setAnimationTuning?.({ pickupScale: v }) },
    { configPath: 'gameplay.playerAnimation.pickupScaleCycles', label: '收集缩放次数', min: 0, defaultMax: 6, step: 0.1, get: () => getPlayer()?.getAnimationTuning?.().pickupScaleCycles ?? 0, set: (v) => getPlayer()?.setAnimationTuning?.({ pickupScaleCycles: v }) },
    { configPath: 'gameplay.playerAnimation.pickupSpinTurns', label: '收集旋转圈数', min: 0, defaultMax: 6, step: 0.05, get: () => getPlayer()?.getAnimationTuning?.().pickupSpinTurns ?? 0.83, set: (v) => getPlayer()?.setAnimationTuning?.({ pickupSpinTurns: v }) },
    { configPath: 'gameplay.playerAnimation.deliveryArcHeight', label: '投放抛物线高度', min: 0.1, defaultMax: 2, step: 0.01, get: () => getPlayer()?.getAnimationTuning?.().deliveryArcHeight ?? 1.2, set: (v) => getPlayer()?.setAnimationTuning?.({ deliveryArcHeight: v }) },
    { configPath: 'gameplay.playerAnimation.deliveryScale', label: '投放缩放大小', min: 0.2, defaultMax: 2, step: 0.01, get: () => getPlayer()?.getAnimationTuning?.().deliveryScale ?? 1, set: (v) => getPlayer()?.setAnimationTuning?.({ deliveryScale: v }) },
    { configPath: 'gameplay.playerAnimation.deliveryScaleCycles', label: '投放缩放次数', min: 0, defaultMax: 6, step: 0.1, get: () => getPlayer()?.getAnimationTuning?.().deliveryScaleCycles ?? 0, set: (v) => getPlayer()?.setAnimationTuning?.({ deliveryScaleCycles: v }) },
    { configPath: 'gameplay.playerAnimation.deliverySpinTurns', label: '投放旋转圈数', min: 0, defaultMax: 8, step: 0.05, get: () => getPlayer()?.getAnimationTuning?.().deliverySpinTurns ?? 1.08, set: (v) => getPlayer()?.setAnimationTuning?.({ deliverySpinTurns: v }) },
    { configPath: 'gameplay.playerAnimation.deliveryDuration', label: '投放动画时长', min: 0.05, defaultMax: 1.5, step: 0.01, get: () => getPlayer()?.getAnimationTuning?.().deliveryDuration ?? 0.22, set: (v) => getPlayer()?.setAnimationTuning?.({ deliveryDuration: v }) },
    { configPath: 'gameplay.playerAnimation.machineAnimationSpeedRatio', label: '切割机动画播放频率', min: 0.1, defaultMax: 5, step: 0.05, get: () => getPlayer()?.getAnimationTuning?.().machineAnimationSpeedRatio ?? 1, set: (v) => getPlayer()?.setAnimationTuning?.({ machineAnimationSpeedRatio: v }) },
    { configPath: 'gameplay.playerAnimation.machineTransferArcHeight', label: '传递抛物线高度', min: 0, defaultMax: 2, step: 0.05, get: () => getPlayer()?.getAnimationTuning?.().machineTransferArcHeight ?? 0.6, set: (v) => getPlayer()?.setAnimationTuning?.({ machineTransferArcHeight: v }) },
    { configPath: 'gameplay.playerAnimation.machineTransferScale', label: '传递缩放大小', min: 0.2, defaultMax: 3, step: 0.05, get: () => getPlayer()?.getAnimationTuning?.().machineTransferScale ?? 1, set: (v) => getPlayer()?.setAnimationTuning?.({ machineTransferScale: v }) },
    { configPath: 'gameplay.playerAnimation.machineTransferScaleCycles', label: '传递缩放次数', min: 0, defaultMax: 5, step: 0.5, get: () => getPlayer()?.getAnimationTuning?.().machineTransferScaleCycles ?? 0, set: (v) => getPlayer()?.setAnimationTuning?.({ machineTransferScaleCycles: v }) },
    { configPath: 'gameplay.playerAnimation.machineTransferSpinTurns', label: '传递旋转圈数', min: 0, defaultMax: 10, step: 0.1, get: () => getPlayer()?.getAnimationTuning?.().machineTransferSpinTurns ?? 0, set: (v) => getPlayer()?.setAnimationTuning?.({ machineTransferSpinTurns: v }) },
    { configPath: 'gameplay.playerAnimation.machineTransferDuration', label: '传递动画时长', min: 0.05, defaultMax: 1.5, step: 0.05, get: () => getPlayer()?.getAnimationTuning?.().machineTransferDuration ?? 0.16, set: (v) => getPlayer()?.setAnimationTuning?.({ machineTransferDuration: v }) },

  ];

  const initial = await loadSceneJson(resolvedSandboxId);
  const local: Record<string, number> = {};
  for (const p of params) {
    const fromFile = getNested(initial, p.configPath);
    const value = typeof fromFile === 'number' ? fromFile : p.get();
    local[p.configPath] = value;
    p.set(value);
  }

  const STORAGE_KEY = 'live_panel_slider_maxes';
  let savedMaxes: Record<string, number> = {};
  try {
    savedMaxes = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {}

  const sliderMax: Record<string, number> = {};
  for (const p of params) {
    sliderMax[p.configPath] = savedMaxes[p.configPath] ?? p.defaultMax;
  }

  disposeLivePanelDom();

  const gui = new dat.GUI();
  gui.domElement.id = 'liveTweakGUI';
  gui.domElement.dataset.inputLayer = 'ui';
  const guiStyle = getGuiRootStyle(gui);
  guiStyle.position = 'fixed';
  guiStyle.left = '20px';
  guiStyle.right = 'auto';
  guiStyle.top = '20px';
  guiStyle.zIndex = '20';



  // Allow dragging the panel from the main title area (which is empty in a raw dat.GUI, but we can grab the topmost element)
  // dat.GUI creates an outer .dg.main, and the drag handle is usually the top area or the close button.
  // Since we hide the close button, we'll make the very first empty LI (or the .dg.main itself) draggable.
  // Note: gui.domElement itself is the .dg.main element, so we use it directly
  const mainGuiElement = gui.domElement;
  if (mainGuiElement) {
    // Add a custom drag handle at the top
    const dragHandle = document.createElement('div');
    dragHandle.dataset.inputLayer = 'ui';
    dragHandle.style.height = '20px';
    dragHandle.style.backgroundColor = '#1a1a1a';
    dragHandle.style.cursor = 'move';
    dragHandle.style.userSelect = 'none';
    dragHandle.style.borderBottom = '1px solid #222';
    dragHandle.style.display = 'flex';
    dragHandle.style.alignItems = 'center';
    dragHandle.style.justifyContent = 'center';
    dragHandle.innerText = ':::: Drag to move ::::';
    dragHandle.style.color = '#555';
    dragHandle.style.fontSize = '10px';
    dragHandle.style.fontWeight = 'bold';
    // 增加 zIndex 确保不在其它元素下方
    dragHandle.style.position = 'relative';
    dragHandle.style.zIndex = '999';
    // 确保能触发指针事件
    dragHandle.style.pointerEvents = 'auto';

    gui.domElement.insertBefore(dragHandle, gui.domElement.firstChild);

    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

    // Load saved position
    try {
      const savedPos = JSON.parse(localStorage.getItem('live_panel_position') || 'null');
      if (savedPos && typeof savedPos.left === 'number' && typeof savedPos.top === 'number') {
        guiStyle.left = `${savedPos.left}px`;
        guiStyle.top = `${savedPos.top}px`;
        guiStyle.right = 'auto';
        guiStyle.bottom = 'auto';
      }
    } catch {}

    dragHandle.addEventListener('pointerdown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = gui.domElement.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      dragHandle.setPointerCapture(e.pointerId);
      e.stopPropagation();
      e.preventDefault();
    });

    dragHandle.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newLeft = initialLeft + dx;
      const newTop = initialTop + dy;
      guiStyle.left = `${newLeft}px`;
      guiStyle.top = `${newTop}px`;
      guiStyle.right = 'auto';
      guiStyle.bottom = 'auto';
      e.stopPropagation();
      e.preventDefault();
    });

    dragHandle.addEventListener('pointerup', (e) => {
      if (!isDragging) return;
      isDragging = false;
      dragHandle.releasePointerCapture(e.pointerId);
      e.stopPropagation();
      e.preventDefault();

      // Save position
      const rect = gui.domElement.getBoundingClientRect();
      localStorage.setItem('live_panel_position', JSON.stringify({ left: rect.left, top: rect.top }));
    });

    dragHandle.addEventListener('pointercancel', (e) => {
      if (!isDragging) return;
      isDragging = false;
      dragHandle.releasePointerCapture(e.pointerId);
      e.stopPropagation();
      e.preventDefault();
    });
  }


  // Disable the built-in dat.GUI close button to prevent the "cannot reopen" bug
  const closeButton = gui.domElement.querySelector('.close-button');
  if (closeButton) {
    (closeButton as HTMLElement).style.display = 'none';
  }

  const folder = gui.addFolder('gameplay.playerAnimation');
  const controllers: Record<string, any> = {};
  for (const p of params) {
    controllers[p.configPath] = folder.add(local, p.configPath, p.min, sliderMax[p.configPath], p.step).name(p.label).onChange((v: number) => p.set(v));
  }
  folder.open();

  const maxFolder = gui.addFolder('滑条上限设置 (本地缓存)');
  for (const p of params) {
    maxFolder.add(sliderMax, p.configPath, p.defaultMax, p.defaultMax * 10, p.step).name(p.label + ' 上限').onChange((newMax: number) => {
      controllers[p.configPath].max(newMax);
      controllers[p.configPath].updateDisplay();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sliderMax));
    });
  }

  gui.add({ save: () => saveSceneJson(resolvedSandboxId, local, params) }, 'save').name('Save to scene.json');
  const uiState = { currentPos: '' };
  gui.add(uiState, 'currentPos').name('当前坐标').listen();
  gui.add({ saveCoord: () => saveCurrentCoordinates() }, 'saveCoord').name('复制并保存坐标');

  const posUpdateTimer = window.setInterval(() => {
    const p = getPlayer()?.position;
    if (p) {
      uiState.currentPos = `X ${p.x.toFixed(2)} / Y ${p.y.toFixed(2)} / Z ${p.z.toFixed(2)}`;
    }
  }, 100);

  // Attach interval to gui dom so we can clear it if remounted
  (gui.domElement as any).__posTimer = posUpdateTimer;

  const materialGui = scene ? createMaterialGui(scene, gui) : null;
  const globalColorGui = createGlobalColorGui(gui, materialGui);
  if (materialGui) {
    syncGuiBesideAnchor(gui.domElement, materialGui.domElement);
    const layoutTimer = window.setInterval(() => {
      syncGuiBesideAnchor(gui.domElement, materialGui.domElement);
      if (globalColorGui) {
        syncGlobalColorGuiPosition(gui.domElement, materialGui.domElement, globalColorGui.domElement);
      }
    }, 120);
    (gui.domElement as any).__layoutTimer = layoutTimer;
  } else if (globalColorGui) {
    syncGuiBesideAnchor(gui.domElement, globalColorGui.domElement);
  }

  bindUiLayerRecursive(gui.domElement);
  if (materialGui) {
    bindUiLayerRecursive(materialGui.domElement);
  }
  if (globalColorGui) {
    bindUiLayerRecursive(globalColorGui.domElement);
  }

  const togglePanels = (e: KeyboardEvent) => {
    if (e.key === 'F8') {
      const nextDisplay = gui.domElement.style.display === 'none' ? '' : 'none';
      gui.domElement.style.display = nextDisplay;
      if (materialGui) {
        materialGui.domElement.style.display = nextDisplay;
      }
      if (globalColorGui) {
        globalColorGui.domElement.style.display = nextDisplay;
      }
    }
  };
  window.addEventListener('keyup', togglePanels);
  livePanelKeyupDispose = () => window.removeEventListener('keyup', togglePanels);

  return {
    dispose(): void {
      disposeLivePanelDom();
    },
  };
}

function createMaterialGui(scene: Scene, anchorGui: any): any {
  const materialGui = new dat.GUI();
  materialGui.domElement.id = 'liveMaterialGUI';
  materialGui.domElement.dataset.inputLayer = 'ui';
  const guiStyle = getGuiRootStyle(materialGui);
  guiStyle.position = 'fixed';
  guiStyle.left = '360px';
  guiStyle.top = '20px';
  guiStyle.right = 'auto';
  guiStyle.zIndex = '20';

  const closeButton = materialGui.domElement.querySelector('.close-button');
  if (closeButton) {
    (closeButton as HTMLElement).style.display = 'none';
  }

  const targets = collectModelTargets(scene);
  const targetMap = new Map(targets.map((target) => [target.key, target]));
  const selectOptions = buildModelSelectOptions(targets);
  const detachedTargets = new Set<string>();
  const localDrafts = loadLocalMaterialDrafts();
  const state: MaterialPanelState = {
    selectedModelKey: targets[0]?.key ?? '',
    info: targets.length > 0 ? '' : '未找到可调材质模型',
    contrast: 1,
    brightness: 1,
    saturation: 0,
    hue: 30,
    colorDensity: 0,
    metallic: 0,
    roughness: 1,
    alpha: 1,
    alphaCutOff: 0.4,
    transparencyMode: '0',
  };

  const folder = materialGui.addFolder('模型材质调节');
  if (targets.length === 0) {
    folder.add(state, 'info').name('状态').listen();
    folder.open();
    return materialGui;
  }

  folder.add(state, 'selectedModelKey', selectOptions).name('选择模型').onChange(() => {
    const selectedTarget = targetMap.get(state.selectedModelKey);
    const selectedDraft = selectedTarget ? localDrafts[selectedTarget.key] : null;
    if (selectedTarget && selectedDraft) {
      applyMaterialOverrideToTarget(scene, selectedTarget, selectedDraft, detachedTargets);
    }
    syncMaterialStateFromSelection(scene, state, targetMap, localDrafts);
    for (const controller of materialControllers) {
      controller.updateDisplay();
    }
  });
  folder.add(state, 'info').name('状态').listen();

  const transparencyOptions = {
    不透明: '0',
    AlphaTest: '1',
    AlphaBlend: '2',
    AlphaTestAndBlend: '3',
  };
  const materialControllers = [
    folder.add(state, 'contrast', 0, 4, 0.01).name('对比度').onChange(() => applyMaterialPanelState(scene, state, targetMap, detachedTargets, localDrafts)),
    folder.add(state, 'brightness', 0, 4, 0.01).name('亮度').onChange(() => applyMaterialPanelState(scene, state, targetMap, detachedTargets, localDrafts)),
    folder.add(state, 'saturation', -100, 100, 1).name('饱和度').onChange(() => applyMaterialPanelState(scene, state, targetMap, detachedTargets, localDrafts)),
    folder.add(state, 'hue', 0, 360, 1).name('色相').onChange(() => applyMaterialPanelState(scene, state, targetMap, detachedTargets, localDrafts)),
    folder.add(state, 'colorDensity', -100, 100, 1).name('色彩密度').onChange(() => applyMaterialPanelState(scene, state, targetMap, detachedTargets, localDrafts)),
    folder.add(state, 'metallic', 0, 1, 0.01).name('金属度').onChange(() => applyMaterialPanelState(scene, state, targetMap, detachedTargets, localDrafts)),
    folder.add(state, 'roughness', 0, 1, 0.01).name('粗糙度').onChange(() => applyMaterialPanelState(scene, state, targetMap, detachedTargets, localDrafts)),
    folder.add(state, 'alpha', 0, 1, 0.01).name('透明度').onChange(() => applyMaterialPanelState(scene, state, targetMap, detachedTargets, localDrafts)),
    folder.add(state, 'alphaCutOff', 0, 1, 0.01).name('Alpha Cutoff').onChange(() => applyMaterialPanelState(scene, state, targetMap, detachedTargets, localDrafts)),
    folder.add(state, 'transparencyMode', transparencyOptions).name('透明模式').onChange(() => applyMaterialPanelState(scene, state, targetMap, detachedTargets, localDrafts)),
  ];

  folder.add({ saveMaterial: () => void saveMaterialPanelState(scene, state, targetMap, localDrafts) }, 'saveMaterial').name('保存材质到 scene.json');
  (window as typeof window & { __liveMaterialPanelDebug?: unknown }).__liveMaterialPanelDebug = {
    saveMaterial: () => saveMaterialPanelState(scene, state, targetMap, localDrafts),
    state,
    targets,
  };

  applyLocalMaterialDrafts(scene, targets, detachedTargets, localDrafts);
  scheduleLocalDraftReplay(scene, targets, detachedTargets, localDrafts);
  syncMaterialStateFromSelection(scene, state, targetMap, localDrafts);
  for (const controller of materialControllers) {
    controller.updateDisplay();
  }
  folder.open();

  syncGuiBesideAnchor(anchorGui.domElement, materialGui.domElement);
  return materialGui;
}

function createGlobalColorGui(anchorGui: any, materialGui: any | null): any {
  const renderingService = ((window as typeof window & { gameInstance?: GameLike | null }).gameInstance?.getRenderingService?.() ?? null);
  const pipeline = renderingService?.getPipeline?.() ?? null;
  if (!pipeline?.imageProcessing) {
    return null;
  }

  const globalGui = new dat.GUI();
  globalGui.domElement.id = 'liveGlobalColorGUI';
  globalGui.domElement.dataset.inputLayer = 'ui';
  const guiStyle = getGuiRootStyle(globalGui);
  guiStyle.position = 'fixed';
  guiStyle.left = '700px';
  guiStyle.top = '20px';
  guiStyle.right = 'auto';
  guiStyle.zIndex = '20';

  const closeButton = globalGui.domElement.querySelector('.close-button');
  if (closeButton) {
    (closeButton as HTMLElement).style.display = 'none';
  }

  const state = loadGlobalColorPanelState(pipeline);
  const folder = globalGui.addFolder('全局调色');
  const apply = () => applyGlobalColorPanelState(state, pipeline);

  folder.add(state, 'contrast', 0, 4, 0.01).name('对比度').onChange(apply);
  folder.add(state, 'brightness', 0, 4, 0.01).name('亮度').onChange(apply);
  folder.add(state, 'saturation', -100, 100, 1).name('饱和度').onChange(apply);
  folder.add(state, 'hue', 0, 360, 1).name('色相').onChange(apply);
  folder.add(state, 'colorDensity', -100, 100, 1).name('色彩密度').onChange(apply);
  folder.add(state, 'red', 0, 2, 0.01).name('R 通道').onChange(apply);
  folder.add(state, 'green', 0, 2, 0.01).name('G 通道').onChange(apply);
  folder.add(state, 'blue', 0, 2, 0.01).name('B 通道').onChange(apply);
  folder.open();

  applyGlobalColorPanelState(state, pipeline);
  if (materialGui) {
    syncGlobalColorGuiPosition(anchorGui.domElement, materialGui.domElement, globalGui.domElement);
  } else {
    syncGuiBesideAnchor(anchorGui.domElement, globalGui.domElement);
  }
  return globalGui;
}

function isScene(value: unknown): value is Scene {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Scene>;
  return Array.isArray(candidate.meshes) && Array.isArray(candidate.transformNodes);
}

function syncGuiBesideAnchor(anchor: HTMLElement, target: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  target.style.left = `${rect.right + 16}px`;
  target.style.top = `${rect.top}px`;
  target.style.right = 'auto';
  target.style.bottom = 'auto';
}

function syncGlobalColorGuiPosition(anchor: HTMLElement, materialGui: HTMLElement, globalGui: HTMLElement): void {
  const materialRect = materialGui.getBoundingClientRect();
  const anchorRect = anchor.getBoundingClientRect();
  globalGui.style.left = `${materialRect.right + 16}px`;
  globalGui.style.top = `${anchorRect.top}px`;
  globalGui.style.right = 'auto';
  globalGui.style.bottom = 'auto';
}

function collectModelTargets(scene: Scene): ModelTarget[] {
  const roots = collectTargetRoots(scene);

  const targets = roots
    .map((root) => ({
      key: buildModelTargetKey(root),
      label: buildModelTargetLabel(root),
      root,
      sceneNodeId: resolveSceneNodeId(root),
      persistMode: resolveSceneNodeId(root) ? 'scene' as const : 'local' as const,
      meshCount: getMeshesUnderRoot(scene, root).filter((mesh) => !!mesh.material).length,
      score: getModelTargetScore(root),
    }))
    .filter((entry) => entry.meshCount > 0 && entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.label.localeCompare(b.label, 'zh-CN');
    });

  return targets.map(({ key, label, root, sceneNodeId, persistMode }) => ({ key, label, root, sceneNodeId, persistMode }));
}

function collectTargetRoots(scene: Scene): Array<TransformNode | AbstractMesh> {
  const roots: Array<TransformNode | AbstractMesh> = [];
  const sceneNodeIds = new Set(configService.getSceneNodes().map((node) => node.id));

  for (const nodeId of sceneNodeIds) {
    const runtimeNode = scene.transformNodes.find((node) => node.metadata?.sceneNodeId === nodeId) ?? null;
    if (runtimeNode) {
      roots.push(runtimeNode);
    }
  }

  for (const node of scene.transformNodes) {
    if (node.parent) continue;
    if (roots.includes(node)) continue;
    roots.push(node);
  }
  for (const mesh of scene.meshes) {
    if (mesh.parent) continue;
    if (roots.includes(mesh)) continue;
    roots.push(mesh);
  }

  return roots;
}

function getModelTargetScore(root: TransformNode | AbstractMesh): number {
  const sceneNodeId = resolveSceneNodeId(root);
  const name = `${root.name || ''} ${root.id || ''}`.toLowerCase();
  if (!name.trim()) return 1;
  if (sceneNodeId === 'collect_table_sell_decal_group') return -20;
  if (name.includes('guide_arrow')) return -20;
  if (name.includes('tree_blob_shadow')) return -10;
  if (name.includes('shadow')) return -5;
  if (name.includes('overlay')) return -3;
  if (name.includes('template_root')) return 8;
  if (name.includes('player_root')) return 8;
  if (name.includes('group')) return 6;
  if (name.includes('decal')) return 4;
  if (name === 'root' || name.endsWith(' root')) return 2;
  return 3;
}

function buildModelSelectOptions(targets: ModelTarget[]): Record<string, string> {
  const options: Record<string, string> = {};
  for (const target of targets) {
    options[target.label] = target.key;
  }
  return options;
}

function buildModelTargetKey(root: TransformNode | AbstractMesh): string {
  const sceneNodeId = resolveSceneNodeId(root);
  if (sceneNodeId) return `scene:${sceneNodeId}`;
  const base = root.name || root.id || root.getClassName() || 'unnamed';
  return `runtime:${base}`;
}

function buildModelTargetLabel(root: TransformNode | AbstractMesh): string {
  const base = root.name || root.id || 'unnamed';
  const sceneNodeId = resolveSceneNodeId(root);
  return sceneNodeId ? `${base} [${sceneNodeId}]` : `${base} (#${root.uniqueId})`;
}

function resolveSceneNodeId(root: TransformNode | AbstractMesh): string | null {
  const candidate = root.metadata?.sceneNodeId ?? root.metadata?.nodeId;
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
}

function getMeshesUnderRoot(scene: Scene, root: TransformNode | AbstractMesh): AbstractMesh[] {
  return scene.meshes.filter((mesh) => isNodeUnderRoot(mesh, root));
}

function isNodeUnderRoot(node: AbstractMesh, root: TransformNode | AbstractMesh): boolean {
  let current: any = node;
  while (current) {
    if (current === root) return true;
    current = current.parent ?? null;
  }
  return false;
}

function collectMaterialsForTarget(scene: Scene, target: ModelTarget): Material[] {
  const materials: Material[] = [];
  const seen = new Set<number>();

  for (const mesh of getMeshesUnderRoot(scene, target.root)) {
    const material = mesh.material;
    if (!material) continue;
    if (material instanceof MultiMaterial) {
      for (const subMaterial of material.subMaterials) {
        if (!subMaterial || seen.has(subMaterial.uniqueId)) continue;
        seen.add(subMaterial.uniqueId);
        materials.push(subMaterial);
      }
      continue;
    }
    if (seen.has(material.uniqueId)) continue;
    seen.add(material.uniqueId);
    materials.push(material);
  }

  return materials;
}

function syncMaterialStateFromSelection(
  scene: Scene,
  state: MaterialPanelState,
  targetMap: Map<string, ModelTarget>,
  localDrafts?: Record<string, MaterialOverrideConfig>,
): void {
  const target = targetMap.get(state.selectedModelKey);
  if (!target) {
    state.info = '未选中模型';
    return;
  }

  const materials = collectMaterialsForTarget(scene, target);
  const pbrMaterial = materials.find((material) => material instanceof PBRMaterial) as PBRMaterial | undefined;
  const alphaCutOffMaterial = materials.find((material) => hasAlphaCutOff(material));
  const firstMaterial = materials[0] ?? null;

  const draft = localDrafts?.[target.key] ?? null;
  state.info = `${target.root.name || target.root.id} / ${getMeshesUnderRoot(scene, target.root).filter((mesh) => !!mesh.material).length} mesh / ${materials.length} mat / ${target.persistMode === 'scene' ? 'scene' : 'local'}`;
  state.contrast = 1;
  state.brightness = 1;
  state.saturation = 0;
  state.hue = 0;
  state.colorDensity = 0;
  state.metallic = pbrMaterial?.metallic ?? 0;
  state.roughness = pbrMaterial?.roughness ?? 1;
  state.alpha = firstMaterial?.alpha ?? 1;
  state.alphaCutOff = alphaCutOffMaterial?.alphaCutOff ?? 0.4;
  state.transparencyMode = String(firstMaterial?.transparencyMode ?? Material.MATERIAL_OPAQUE);

  if (draft) {
    applyMaterialOverrideToState(state, draft);
  }
}

function applyMaterialPanelState(
  scene: Scene,
  state: MaterialPanelState,
  targetMap: Map<string, ModelTarget>,
  detachedTargets: Set<string>,
  localDrafts: Record<string, MaterialOverrideConfig>,
): void {
  const target = targetMap.get(state.selectedModelKey);
  if (!target) return;

  detachMaterialsForTarget(scene, target, detachedTargets);
  const materials = collectMaterialsForTarget(scene, target);
  const transparencyMode = Number(state.transparencyMode);
  const override = buildMaterialOverrideFromState(state);

  for (const material of materials) {
    applyMaterialDebugAdjustments(material, { ...override, transparencyMode });
  }

  localDrafts[target.key] = { ...override, transparencyMode };
  saveLocalMaterialDrafts(localDrafts);

  syncMaterialStateFromSelection(scene, state, targetMap, localDrafts);
}

async function saveMaterialPanelState(
  scene: Scene,
  state: MaterialPanelState,
  targetMap: Map<string, ModelTarget>,
  localDrafts: Record<string, MaterialOverrideConfig>,
): Promise<void> {
  const target = targetMap.get(state.selectedModelKey);
  if (!target) {
    showPanelToast('未选中模型', '#e65b5b');
    return;
  }

  if (!target.sceneNodeId) {
    localDrafts[target.key] = buildMaterialOverrideFromState(state);
    saveLocalMaterialDrafts(localDrafts);
    showPanelToast('该对象非 authored 节点，已保存到本地草稿', '#ff9f43');
    return;
  }

  const runtimeRoot = target.root;
  const nextDocument = cloneJson(getProjectEditorWorkingDocument());
  const sceneSection = ensureSceneSection(nextDocument);
  const materials = sceneSection.materials;
  const overrides = collectSceneNodeMaterialOverrides(scene, runtimeRoot, target.sceneNodeId, state);
  upsertSceneNodeMaterials(materials, target.sceneNodeId, overrides);

  loadProjectEditorDocument(nextDocument);
  configService.replaceSceneConfig(cloneJson(nextDocument));
  localDrafts[target.key] = buildMaterialOverrideFromState(state);
  saveLocalMaterialDrafts(localDrafts);

  const persistedToFile = await persistWorkingDocument();
  if (persistedToFile) {
    delete localDrafts[target.key];
    saveLocalMaterialDrafts(localDrafts);
    showPanelToast('材质已保存到 scene.json', '#3bc56f');
    return;
  }

  showPanelToast('旧调试面板写盘已禁用，请使用编辑器保存', '#ff9f43');
}

function applyLocalMaterialDrafts(
  scene: Scene,
  targets: ModelTarget[],
  detachedTargets: Set<string>,
  localDrafts: Record<string, MaterialOverrideConfig>,
): void {
  const targetMap = new Map(targets.map((target) => [target.key, target]));
  for (const [targetKey, draft] of Object.entries(localDrafts)) {
    const target = targetMap.get(targetKey);
    if (!target) continue;
    applyMaterialOverrideToTarget(scene, target, draft, detachedTargets);
  }
}

function scheduleLocalDraftReplay(
  scene: Scene,
  targets: ModelTarget[],
  detachedTargets: Set<string>,
  localDrafts: Record<string, MaterialOverrideConfig>,
): void {
  const delays = [0, 80, 240, 600];
  for (const delay of delays) {
    window.setTimeout(() => {
      applyLocalMaterialDrafts(scene, targets, detachedTargets, localDrafts);
    }, delay);
  }
}

function applyMaterialOverrideToTarget(
  scene: Scene,
  target: ModelTarget,
  override: MaterialOverrideConfig,
  detachedTargets: Set<string>,
): void {
  detachMaterialsForTarget(scene, target, detachedTargets);
  const materials = collectMaterialsForTarget(scene, target);
  for (const material of materials) {
    applyMaterialDebugAdjustments(material, override);
  }
}

function collectSceneNodeMaterialOverrides(
  scene: Scene,
  root: TransformNode | AbstractMesh,
  sceneNodeId: string,
  state: MaterialPanelState,
): SceneSharedMaterialConfig[] {
  const entries: SceneSharedMaterialConfig[] = [];
  const meshes = getMeshesUnderRoot(scene, root).filter((mesh) => !!mesh.material);
  for (const mesh of meshes) {
    const material = mesh.material;
    if (!material || material instanceof MultiMaterial) continue;
    const ownerNodePath = buildOwnerNodePathWithinRoot(mesh, root);
    entries.push({
      id: buildNodeMaterialId(sceneNodeId, material.name || '(unnamed-material)', ownerNodePath),
      scope: 'nodeMaterial',
      nodeId: sceneNodeId,
      ownerNodePath,
      materialName: material.name || '(unnamed-material)',
      type: typeof material.getClassName === 'function' ? material.getClassName() : undefined,
      properties: buildMaterialOverrideFromState(state),
    });
  }
  return dedupeMaterialEntries(entries);
}

function dedupeMaterialEntries(entries: SceneSharedMaterialConfig[]): SceneSharedMaterialConfig[] {
  const next = new Map<string, SceneSharedMaterialConfig>();
  for (const entry of entries) {
    next.set(`${entry.nodeId}|${entry.materialName}|${entry.ownerNodePath ?? ''}`, entry);
  }
  return [...next.values()];
}

function upsertSceneNodeMaterials(
  materials: SceneSharedMaterialConfig[],
  sceneNodeId: string,
  nextEntries: SceneSharedMaterialConfig[],
): void {
  for (let index = materials.length - 1; index >= 0; index -= 1) {
    const entry = materials[index];
    if ((entry.scope ?? 'nodeMaterial') !== 'nodeMaterial') continue;
    if (entry.nodeId !== sceneNodeId) continue;
    materials.splice(index, 1);
  }
  materials.push(...nextEntries);
}

function buildOwnerNodePathWithinRoot(node: AbstractMesh, root: TransformNode | AbstractMesh): string {
  if (node === root) return '';
  const segments: string[] = [];
  let current: any = node;
  while (current && current !== root) {
    const segment = stableNodeSegment(current);
    if (!segment) break;
    segments.push(segment);
    current = current.parent ?? null;
  }
  return segments.reverse().join('/');
}

function stableNodeSegment(node: any): string | null {
  const candidates = [node?.name, node?.id];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function buildNodeMaterialId(nodeId: string, materialName: string, ownerNodePath: string): string {
  const ownerPart = ownerNodePath ? `_${sanitizeSharedMaterialIdPart(ownerNodePath.replace(/\//g, '_'))}` : '';
  return `nodemat_${sanitizeSharedMaterialIdPart(nodeId)}_${sanitizeSharedMaterialIdPart(materialName)}${ownerPart}`;
}

function sanitizeSharedMaterialIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'value';
}

function buildMaterialOverrideFromState(state: MaterialPanelState): MaterialOverrideConfig {
  return {
    contrast: state.contrast,
    brightness: state.brightness,
    saturation: state.saturation,
    hue: state.hue,
    colorDensity: state.colorDensity,
    metallic: state.metallic,
    roughness: state.roughness,
    alpha: state.alpha,
    alphaCutOff: state.alphaCutOff,
    transparencyMode: Number(state.transparencyMode),
  };
}

function loadGlobalColorPanelState(pipeline: {
  imageProcessing: {
    exposure: number;
    contrast: number;
    colorCurvesEnabled: boolean;
    colorCurves: ColorCurves | null;
    vignetteEnabled: boolean;
    vignetteWeight: number;
    vignetteColor: Color4;
  };
}): GlobalColorPanelState {
  const curves = pipeline.imageProcessing.colorCurves;
  const defaults: GlobalColorPanelState = {
    contrast: pipeline.imageProcessing.contrast ?? 1,
    brightness: pipeline.imageProcessing.exposure ?? 1,
    saturation: curves?.globalSaturation ?? 0,
    hue: curves?.globalHue ?? 0,
    colorDensity: curves?.globalDensity ?? 0,
    red: pipeline.imageProcessing.vignetteEnabled ? pipeline.imageProcessing.vignetteColor.r : 1,
    green: pipeline.imageProcessing.vignetteEnabled ? pipeline.imageProcessing.vignetteColor.g : 1,
    blue: pipeline.imageProcessing.vignetteEnabled ? pipeline.imageProcessing.vignetteColor.b : 1,
  };

  try {
    const raw = localStorage.getItem(GLOBAL_COLOR_PANEL_LOCAL_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<GlobalColorPanelState>;
    return {
      contrast: typeof parsed.contrast === 'number' ? parsed.contrast : defaults.contrast,
      brightness: typeof parsed.brightness === 'number' ? parsed.brightness : defaults.brightness,
      saturation: typeof parsed.saturation === 'number' ? parsed.saturation : defaults.saturation,
      hue: typeof parsed.hue === 'number' ? parsed.hue : defaults.hue,
      colorDensity: typeof parsed.colorDensity === 'number' ? parsed.colorDensity : defaults.colorDensity,
      red: typeof parsed.red === 'number' ? parsed.red : defaults.red,
      green: typeof parsed.green === 'number' ? parsed.green : defaults.green,
      blue: typeof parsed.blue === 'number' ? parsed.blue : defaults.blue,
    };
  } catch {
    return defaults;
  }
}

function applyGlobalColorPanelState(
  state: GlobalColorPanelState,
  pipeline: {
    imageProcessing: {
      exposure: number;
      contrast: number;
      colorCurvesEnabled: boolean;
      colorCurves: ColorCurves | null;
      vignetteEnabled: boolean;
      vignetteWeight: number;
      vignetteColor: Color4;
    };
  },
): void {
  const imageProcessing = pipeline.imageProcessing;
  imageProcessing.contrast = state.contrast;
  imageProcessing.exposure = state.brightness;
  imageProcessing.colorCurvesEnabled = true;
  if (!imageProcessing.colorCurves) {
    imageProcessing.colorCurves = new ColorCurves();
  }
  imageProcessing.colorCurves.globalHue = state.hue;
  imageProcessing.colorCurves.globalDensity = state.colorDensity;
  imageProcessing.colorCurves.globalSaturation = state.saturation;

  imageProcessing.vignetteEnabled = true;
  imageProcessing.vignetteWeight = 1;
  imageProcessing.vignetteColor = new Color4(state.red, state.green, state.blue, 1);

  localStorage.setItem(GLOBAL_COLOR_PANEL_LOCAL_STORAGE_KEY, JSON.stringify(state));
}

function applyMaterialOverrideToState(state: MaterialPanelState, override: MaterialOverrideConfig): void {
  if (typeof override.contrast === 'number') state.contrast = override.contrast;
  if (typeof override.brightness === 'number') state.brightness = override.brightness;
  if (typeof override.saturation === 'number') state.saturation = override.saturation;
  if (typeof override.hue === 'number') state.hue = override.hue;
  if (typeof override.colorDensity === 'number') state.colorDensity = override.colorDensity;
  if (typeof override.metallic === 'number') state.metallic = override.metallic;
  if (typeof override.roughness === 'number') state.roughness = override.roughness;
  if (typeof override.alpha === 'number') state.alpha = override.alpha;
  if (typeof override.alphaCutOff === 'number') state.alphaCutOff = override.alphaCutOff;
  if (typeof override.transparencyMode === 'number') state.transparencyMode = String(override.transparencyMode);
}

function loadLocalMaterialDrafts(): Record<string, MaterialOverrideConfig> {
  try {
    const raw = localStorage.getItem(MATERIAL_PANEL_LOCAL_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, MaterialOverrideConfig> : {};
  } catch {
    return {};
  }
}

function clearLegacyMaterialDrafts(): void {
  for (const key of LEGACY_MATERIAL_PANEL_LOCAL_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
}

function saveLocalMaterialDrafts(value: Record<string, MaterialOverrideConfig>): void {
  localStorage.setItem(MATERIAL_PANEL_LOCAL_STORAGE_KEY, JSON.stringify(value));
}

function ensureSceneSection(document: any): { materials: SceneSharedMaterialConfig[] } {
  if (!document.scene || typeof document.scene !== 'object' || Array.isArray(document.scene)) {
    document.scene = { materials: [] };
  }
  if (!Array.isArray(document.scene.materials)) {
    document.scene.materials = [];
  }
  return document.scene as { materials: SceneSharedMaterialConfig[] };
}

async function persistWorkingDocument(): Promise<boolean> {
  clearLegacySceneJsonCache();
  console.warn(
    '[live-panel] legacy direct scene.json save is disabled; save through fps-game-editor ProjectAuthoringHost.commitSource() instead',
  );
  return false;
}

function detachMaterialsForTarget(scene: Scene, target: ModelTarget, detachedTargets: Set<string>): void {
  if (detachedTargets.has(target.key)) return;

  const materialClones = new Map<number, Material>();
  const multiMaterialClones = new Map<number, MultiMaterial>();
  const cloneSuffix = sanitizeCloneSuffix(target.key);

  for (const mesh of getMeshesUnderRoot(scene, target.root)) {
    const material = mesh.material;
    if (!material) continue;

    if (material instanceof MultiMaterial) {
      let multiClone = multiMaterialClones.get(material.uniqueId);
      if (!multiClone) {
        const clonedMulti = material.clone(`${material.name || 'multi_material'}_${cloneSuffix}`) as MultiMaterial | null;
        if (!clonedMulti) continue;
        multiClone = clonedMulti;
        multiClone.subMaterials = material.subMaterials.map((subMaterial, index) => {
          if (!subMaterial) return subMaterial;
          let subClone = materialClones.get(subMaterial.uniqueId);
          if (!subClone) {
            subClone = subMaterial.clone(`${subMaterial.name || `sub_${index}`}_${cloneSuffix}`) ?? subMaterial;
            materialClones.set(subMaterial.uniqueId, subClone);
          }
          return subClone;
        });
        multiMaterialClones.set(material.uniqueId, multiClone);
      }
      mesh.material = multiClone;
      continue;
    }

    let clone = materialClones.get(material.uniqueId);
    if (!clone) {
      clone = material.clone(`${material.name || 'material'}_${cloneSuffix}`) ?? material;
      materialClones.set(material.uniqueId, clone);
    }
    mesh.material = clone;
  }

  detachedTargets.add(target.key);
}

function sanitizeCloneSuffix(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '_');
}

function hasAlphaCutOff(material: Material): material is Material & { alphaCutOff: number } {
  return 'alphaCutOff' in material;
}

function loadDatGui(): Promise<void> {
  if ((window as typeof window & { dat?: unknown }).dat) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = DAT_GUI_CDN;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function resolveSandboxId(input?: string): string {
  if (input) return input;
  const fromQuery = new URLSearchParams(window.location.search).get('sandboxId');
  if (fromQuery) return fromQuery;
  const editorUrl = (window as typeof window & { BRIDGE_EDITOR_URL?: string }).BRIDGE_EDITOR_URL;
  if (editorUrl) {
    try {
      const host = new URL(editorUrl).host;
      const match = host.match(/^\d+-([a-z0-9]+)\.e2b\.(app|dev)$/i);
      if (match?.[1]) return match[1];
    } catch {
      // ignore
    }
  }
  return '';
}

async function loadSceneJson(_sandboxId: string): Promise<unknown> {
  const cached = loadCachedSceneJson();
  if (cached) {
    return cached;
  }
  const localDocument = getProjectEditorWorkingDocument();
  if (localDocument && typeof localDocument === 'object') {
    return localDocument;
  }
  const res = await fetch(`/api/live-panel/scene-json?path=${encodeURIComponent(SCENE_JSON_PATH)}`);
  if (!res.ok) return configService.getSceneConfig();
  return JSON.parse(await res.text()) as unknown;
}

async function saveSceneJson(_sandboxId: string, local: Record<string, number>, params: Param[]) {
  const nextDocument = cloneJson(getProjectEditorWorkingDocument());
  for (const p of params) {
    setNested(nextDocument, p.configPath, local[p.configPath]);
  }

  loadProjectEditorDocument(nextDocument);
  configService.replaceSceneConfig(cloneJson(nextDocument));

  const persistedToFile = await persistWorkingDocument();
  if (persistedToFile) {
    console.log('[live-panel] saved');
    showPanelToast('已保存到 scene.json', '#3bc56f');
    return;
  }
  showPanelToast('旧调试面板写盘已禁用，请使用编辑器保存', '#ff9f43');
}

function loadCachedSceneJson(): unknown | null {
  clearLegacySceneJsonCache();
  return null;
}

function clearLegacySceneJsonCache(): void {
  localStorage.removeItem(LOCAL_SCENE_JSON_CACHE_KEY);
}

function getNested(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== 'object' || Array.isArray(acc)) return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

function setNested(obj: unknown, path: string, value: unknown): void {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
  const keys = path.split('.');
  let current = obj as Record<string, unknown>;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    const next = current[key];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function bindUiLayerRecursive(root: HTMLElement): void {
  root.dataset.inputLayer = 'ui';
  for (const el of root.querySelectorAll<HTMLElement>('*')) {
    el.dataset.inputLayer = 'ui';
  }
}

async function saveCurrentCoordinates(): Promise<void> {
  const player = getPlayer();
  const tuning = player?.getAnimationTuning?.();
  const game = (window as typeof window & { gameInstance?: { getPlayer?: () => { position?: { x: number; y: number; z: number } } | null } | null }).gameInstance;
  const position = game?.getPlayer?.()?.position;
  if (!position) {
    console.warn('[live-panel] player position unavailable');
    showPanelToast('坐标不可用', '#e65b5b');
    return;
  }

  const text = `Pos: X ${position.x.toFixed(2)} / Y ${position.y.toFixed(2)} / Z ${position.z.toFixed(2)}`;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const input = document.createElement('textarea');
      input.value = text;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    console.log('[live-panel] 坐标已复制', text, tuning ?? '');
    showPanelToast('坐标已复制', '#3bc56f');
  } catch (error) {
    console.warn('[live-panel] 坐标复制失败', error);
    showPanelToast('坐标复制失败', '#e65b5b');
  }
}

function showPanelToast(message: string, background = '#3bc56f'): void {
  if (!panelToastEl) {
    panelToastEl = document.createElement('div');
    panelToastEl.dataset.inputLayer = 'ui';
    panelToastEl.style.position = 'fixed';
    panelToastEl.style.left = '20px';
    panelToastEl.style.bottom = '20px';
    panelToastEl.style.zIndex = '30';
    panelToastEl.style.padding = '10px 14px';
    panelToastEl.style.borderRadius = '8px';
    panelToastEl.style.fontSize = '13px';
    panelToastEl.style.fontWeight = '700';
    panelToastEl.style.color = '#ffffff';
    panelToastEl.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
    panelToastEl.style.pointerEvents = 'none';
    panelToastEl.style.opacity = '0';
    panelToastEl.style.transition = 'opacity 0.18s ease';
    document.body.appendChild(panelToastEl);
  }

  panelToastEl.textContent = message;
  panelToastEl.style.background = background;
  panelToastEl.style.opacity = '1';

  if (panelToastTimer !== null) {
    window.clearTimeout(panelToastTimer);
  }
  panelToastTimer = window.setTimeout(() => {
    if (panelToastEl) {
      panelToastEl.style.opacity = '0';
    }
    panelToastTimer = null;
  }, 1400);
}
