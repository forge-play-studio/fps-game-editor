/**
 * Game - 游戏主类 (Scaffold)
 *
 * 职责：
 * - 初始化 Babylon Engine/Scene
 * - 初始化服务层（AssetLoader / ModelPool / RenderingService 等）
 * - 初始化系统/实体/UI
 * - 驱动游戏循环（update + render）
 *
 * 说明：
 * - 这是“通用脚手架”版本，已剔除强绑定业务的 gameplay 模块
 * - 当前基座仅保留 service/system/ui/entity 的最小闭环
 */

import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';

// Polyfill: 修复 BabylonJS 8.x 中 _debugPushGroup 不存在的问题
if (!(Engine.prototype as any)._debugPushGroup) {
  (Engine.prototype as any)._debugPushGroup = function () { };
}
if (!(Engine.prototype as any)._debugPopGroup) {
  (Engine.prototype as any)._debugPopGroup = function () { };
}
if (!(Engine.prototype as any)._debugInsertMarker) {
  (Engine.prototype as any)._debugInsertMarker = function () { };
}

import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';

// 副作用导入 - glTF 加载器
import '@babylonjs/loaders/glTF';
// 副作用导入 - 动画系统
import '@babylonjs/core/Animations/animatable';
// 副作用导入 - 材质系统
import '@babylonjs/core/Materials/standardMaterial';
import '@babylonjs/core/Materials/PBR/pbrMaterial';
// 副作用导入 - 纹理系统
import '@babylonjs/core/Materials/Textures/texture';
// 服务
import {
  AssetLoader,
  ModelPool,
  AnimationService,
  AudioService,
  InputService,
  SceneBuilder,
  MaterialConfigService,
  RenderingService,
  ShadowService,
  SceneVfxService,
  configValidator,
} from '../services';

// 系统 / 实体 / UI（脚手架）
import { EconomySystem } from '../systems';
import { NewbieGuideSystem } from '../systems';
import { SimplePlayer } from '../entities';
import { HudLayer, GameUI, FloatingUIManager, InputRouter, VirtualJoystick } from '../ui';

import { configService } from '../config';
import type { SceneConfig } from '../config';
import type { DebugPanelRuntimeController } from '../debug/framework';
import { createMockPlatformAssetsController } from '../debug/controllers/mock-platform-assets';
import { getAllModelIds } from '../assets';

export interface GameOptions {
  canvasId: string;
  debug?: boolean;
  enableAudio?: boolean;
}

interface RuntimeProbeDebugConfig {
  enabled: boolean;
  intensity: number;
  tint: [number, number, number];
  mode: 'soft' | 'sharp' | 'pulse';
  note: string;
}

export class Game {
  private readonly characterOnlyPreview = false;
  private canvas: HTMLCanvasElement;
  private engine: Engine;
  private scene: Scene;

  // Camera
  private camera: ArcRotateCamera | null = null;
  private spectatorCamera: UniversalCamera | null = null;
  private spectatorMode = false;
  private readonly spectatorKeys = new Set<string>();

  // Services
  private assetLoader: AssetLoader | null = null;
  private modelPool: ModelPool | null = null;
  private animationService: AnimationService | null = null;
  private audioService: AudioService | null = null;
  private sceneBuilder: SceneBuilder | null = null;
  private renderingService: RenderingService | null = null;
  private materialConfigService: MaterialConfigService | null = null;
  private shadowService: ShadowService | null = null;
  private sceneVfxService: SceneVfxService | null = null;

  // Systems
  private economySystem: EconomySystem | null = null;
  private newbieGuideSystem: NewbieGuideSystem | null = null;
  private hudLayer: HudLayer | null = null;
  private gameUI: GameUI | null = null;
  private floatingUIManager: FloatingUIManager | null = null;
  private inputRouter: InputRouter | null = null;
  private joystick: VirtualJoystick | null = null;

  // Input
  private inputService: InputService | null = null;

  // Entities
  private player: SimplePlayer | null = null;
  private dynamicSilhouetteMeshes: AbstractMesh[] = [];
  private dynamicSilhouetteUpdateCooldown = 0;
  private readonly dynamicSilhouetteUpdateInterval = 0.1;
  private runtimeProbeDebugConfig: RuntimeProbeDebugConfig = {
    enabled: false,
    intensity: 1,
    tint: [0.35, 0.72, 1],
    mode: 'soft',
    note: 'lumber_order debug panel probe',
  };

  // Loop state
  private isRunning = false;
  private isPaused = false;
  private lastTime = 0;
  private enableAudio: boolean;

  private readonly onSpectatorKeyDown = (event: KeyboardEvent) => {
    if (!this.spectatorMode) return;
    const key = event.key.toLowerCase();
    if (!['w', 'a', 's', 'd', 'q', 'e', 'shift'].includes(key)) return;
    this.spectatorKeys.add(key);
    event.preventDefault();
  };

  private readonly onSpectatorKeyUp = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    this.spectatorKeys.delete(key);
  };

  private readonly onWindowResize = () => {
    this.handleDevicePixelRatio();
    this.engine.resize();
    this.syncOrthographicBounds();
    if (this.sceneBuilder && this.camera) {
      this.sceneBuilder.updateCameraProjection(this.camera);
    }
  };

  constructor(options: GameOptions) {
    const el = document.getElementById(options.canvasId);
    if (!el || !(el instanceof HTMLCanvasElement)) {
      throw new Error(`Canvas with id "${options.canvasId}" not found`);
    }
    this.canvas = el;

    this.enableAudio = options.enableAudio ?? false;

    this.engine = new Engine(this.canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true,
    });

    this.scene = new Scene(this.engine);
    // 强制使用右手坐标系：项目默认接入 glb/glTF 模型，不要改成左手系。
    this.scene.useRightHandedSystem = true;
    this.scene.clearColor = new Color4(0.06, 0.06, 0.08, 1);

    this.setupResizeHandler();
    this.handleDevicePixelRatio();
    window.addEventListener('keydown', this.onSpectatorKeyDown, { passive: false });
    window.addEventListener('keyup', this.onSpectatorKeyUp);

  }

  // ============================================================
  // Init
  // ============================================================

  async init(): Promise<void> {
    // 1) AssetLoader
    this.assetLoader = new AssetLoader(this.scene);

    // 2) SceneBuilder (camera/lights/pipeline)
    this.sceneBuilder = new SceneBuilder(this.scene, this.assetLoader);
    const env = this.sceneBuilder.buildSceneEnvironment();
    this.camera = env.camera;
    this.renderingService = env.renderingService;
    this.shadowService = env.shadowService;

    // 3) Other services
    this.animationService = new AnimationService();
    this.modelPool = new ModelPool(this.scene, this.assetLoader);
    this.sceneBuilder.setModelPool(this.modelPool);

    // 4) Preload models declared in scene.assets (可选)
    await this.preloadModelsFromConfig();

    // 5) Load scene document (可选)
    if (!this.characterOnlyPreview) {
      await this.sceneBuilder.loadSceneFromDocument();
      this.refreshStaticSilhouetteTargets();
    }

    // 6) Apply materials config (可选)
    this.materialConfigService = new MaterialConfigService(this.scene);
    this.materialConfigService.applyAllConfigs();
    this.materialConfigService.logMissingMaterials();
    this.modelPool.setMaterialConfigService(this.materialConfigService);

    // 7) Refresh shadows after scene loaded
    this.shadowService.refreshShadowMeshes();

    // 8) Systems
    this.initSystems();

    // 9) Input
    this.initInput();

    // 10) Entities
    this.createPlayer();
    await this.player?.prepareRuntimeTemplates();

    // 10.5) Newbie guide loop
    if (!this.characterOnlyPreview) {
      this.initNewbieGuide();
    }

    // 11) Scene VFX (optional)
    this.sceneVfxService = new SceneVfxService(this.scene);
    this.sceneVfxService.initFromConfig();

    // 12) Config validation (DEV)
    if (import.meta.env.DEV) {
      configValidator.validate();
    }

    // 13) Audio (optional)
    if (this.enableAudio) {
      this.audioService = new AudioService(this.scene);
      await this.audioService.preload();
      this.audioService.setupUnlockListener();
    }

    if (import.meta.env.DEV) {
      this.registerDebugPanelControllers();
    }

  }

  private async preloadModelsFromConfig(): Promise<void> {
    if (!this.assetLoader) return;

    const modelIds = getAllModelIds();
    if (modelIds.length === 0) return;

    // AssetLoader 需要先创建灯光（已在 buildSceneEnvironment 完成）
    await this.assetLoader.preload(modelIds);

    // NOTE:
    // 原项目可能会做对象池预热（warmupCount）。
    // 该行为在不同团队/项目中实现差异较大，因此脚手架默认不强制执行。
  }

  private initSystems(): void {
    const initialCash = configService.getEconomyConfig().initialCash ?? 0;
    this.economySystem = new EconomySystem(initialCash);
  }

  private initInput(): void {
    this.inputService = new InputService(null);
    this.inputRouter = new InputRouter();
    this.joystick = new VirtualJoystick(document.body);
    this.inputRouter.setGameHandler(this.joystick);
    this.inputService.setMovementSource(this.joystick);
  }

  private createPlayer(): void {
    const startPos = new Vector3(3.9, 0, -6.2);
    this.player = new SimplePlayer(this.scene, this.inputService, {
      position: startPos,
      speed: 4.2,
      radius: 0.35,
    });

    // 摄像机跟随（ArcRotateCamera：target 跟随）
    if (this.camera) {
      this.camera.target = this.player.position;
    }
  }

  private initNewbieGuide(): void {
    if (!this.player || !this.economySystem) return;
    this.newbieGuideSystem = new NewbieGuideSystem(this.scene, this.player, this.economySystem);

    this.hudLayer = new HudLayer();
    this.hudLayer.attach(this);

    // 游戏 UI（背包 / Idle Guide / Toast / 波纹）
    this.gameUI = new GameUI(this);

    // 3D 跟随浮动 UI（漂浮数值）
    this.floatingUIManager = new FloatingUIManager(this);
  }

  // ============================================================
  // Loop
  // ============================================================

  start(): void {
    if (this.isRunning) return;

    (window as any).game = this;
    this.isRunning = true;
    this.lastTime = performance.now();

    this.engine.runRenderLoop(() => {
      this.gameLoop();
    });
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
    this.lastTime = performance.now();
  }

  isPausedState(): boolean {
    return this.isPaused;
  }

  stop(): void {
    this.isRunning = false;
    this.engine.stopRenderLoop();
  }

  private gameLoop(): void {
    if (!this.isRunning) return;

    const now = performance.now();
    const deltaTime = (now - this.lastTime) / 1000;
    this.lastTime = now;

    if (!this.isPaused) {
      this.update(deltaTime);
    }

    this.scene.render();
  }

  private update(deltaTime: number): void {
    this.updateSpectatorMovement(deltaTime);

    if (!this.spectatorMode && this.camera && this.player) {
      this.camera.target.copyFrom(this.player.position);
    }

    // Entities
    this.player?.update(deltaTime);
    this.dynamicSilhouetteUpdateCooldown -= deltaTime;
    if (this.dynamicSilhouetteUpdateCooldown <= 0) {
      this.refreshDynamicSilhouetteTargets();
      this.renderingService?.setSilhouetteTargets(this.dynamicSilhouetteMeshes);
      this.dynamicSilhouetteUpdateCooldown = this.dynamicSilhouetteUpdateInterval;
    }
    this.newbieGuideSystem?.update(deltaTime);
    this.hudLayer?.update();
    this.gameUI?.update(deltaTime);
    this.floatingUIManager?.update(deltaTime);
  }

  onEditEnter(): void {
    this.inputRouter?.setEnabled(false);
    this.joystick?.setEnabled(false);
    this.hudLayer?.setVisible(false);
    this.gameUI?.setVisible(false);
    this.floatingUIManager?.setVisible(false);
  }

  onEditExit(): void {
    this.inputRouter?.setEnabled(true);
    this.joystick?.setEnabled(true);
    this.hudLayer?.setVisible(true);
    this.gameUI?.setVisible(true);
    this.floatingUIManager?.setVisible(true);
  }

  // ============================================================
  // Utilities
  // ============================================================

  private handleDevicePixelRatio(): void {
    const ratio = window.devicePixelRatio || 1;
    this.engine.setHardwareScalingLevel(1 / ratio);
  }

  private syncOrthographicBounds(): void {
    const camera = this.camera;
    if (!camera || camera.mode !== Camera.ORTHOGRAPHIC_CAMERA) return;

    const orthoSize = this.sceneBuilder?.getSelectedCameraOrthoSize() ?? 10;
    const width = Math.max(1, this.engine.getRenderWidth());
    const height = Math.max(1, this.engine.getRenderHeight());
    const halfH = orthoSize;
    const halfW = orthoSize * (width / height);

    camera.orthoLeft = -halfW;
    camera.orthoRight = halfW;
    camera.orthoBottom = -halfH;
    camera.orthoTop = halfH;
  }

  private setupResizeHandler(): void {
    window.addEventListener('resize', this.onWindowResize);
  }

  // ============================================================
  // Public accessors
  // ============================================================

  getScene(): Scene {
    return this.scene;
  }

  getEngine(): Engine {
    return this.engine;
  }

  getCamera(): ArcRotateCamera | null {
    return this.camera;
  }

  getRenderingService(): RenderingService | null {
    return this.renderingService;
  }

  isSpectatorMode(): boolean {
    return this.spectatorMode;
  }

  toggleSpectatorMode(): void {
    if (this.spectatorMode) {
      this.exitSpectatorMode();
      return;
    }
    this.enterSpectatorMode();
  }

  private enterSpectatorMode(): void {
    if (!this.camera) return;

    if (!this.spectatorCamera) {
      const startPosition = this.camera.position.clone();
      const camera = new UniversalCamera('spectatorCamera', startPosition, this.scene);
      camera.minZ = 0.1;
      camera.speed = 0.6;
      camera.inertia = 0;
      camera.angularSensibility = 1200;
      camera.keysUp = [];
      camera.keysDown = [];
      camera.keysLeft = [];
      camera.keysRight = [];
      camera.keysUpward = [];
      camera.keysDownward = [];
      camera.setTarget(this.camera.target.clone());
      this.spectatorCamera = camera;
    } else {
      this.spectatorCamera.position.copyFrom(this.scene.activeCamera?.position ?? this.camera.position);
      this.spectatorCamera.setTarget(this.camera.target.clone());
    }

    this.spectatorCamera.attachControl(this.canvas, true);
    this.canvas.focus();
    this.scene.activeCamera = this.spectatorCamera;
    this.scene.activeCameras = [this.spectatorCamera];
    (this.scene as any).cameraToUseForPointers = this.spectatorCamera;
    this.spectatorKeys.clear();
    this.spectatorMode = true;
  }

  private exitSpectatorMode(): void {
    if (!this.camera) return;

    this.spectatorCamera?.detachControl();
    this.camera.target.copyFrom(this.player?.position ?? this.camera.target);
    this.scene.activeCamera = this.camera;
    this.scene.activeCameras = [this.camera];
    (this.scene as any).cameraToUseForPointers = this.camera;
    this.spectatorKeys.clear();
    this.spectatorMode = false;
  }

  private updateSpectatorMovement(deltaTime: number): void {
    if (!this.spectatorMode || !this.spectatorCamera) return;

    const move = Vector3.Zero();
    const forward = this.spectatorCamera.getDirection(new Vector3(0, 0, this.scene.useRightHandedSystem ? -1 : 1));
    const right = this.spectatorCamera.getDirection(new Vector3(1, 0, 0));
    forward.y = 0;
    right.y = 0;
    if (forward.lengthSquared() > 0.0001) forward.normalize();
    if (right.lengthSquared() > 0.0001) right.normalize();

    if (this.spectatorKeys.has('w')) move.addInPlace(forward);
    if (this.spectatorKeys.has('s')) move.subtractInPlace(forward);
    if (this.spectatorKeys.has('d')) move.addInPlace(right);
    if (this.spectatorKeys.has('a')) move.subtractInPlace(right);
    if (this.spectatorKeys.has('e')) move.y += 1;
    if (this.spectatorKeys.has('q')) move.y -= 1;

    if (move.lengthSquared() <= 0.0001) return;
    move.normalize();
    const speed = this.spectatorKeys.has('shift') ? 12 : 6;
    this.spectatorCamera.position.addInPlace(move.scale(speed * deltaTime));
  }

  getPlayer(): SimplePlayer | null {
    return this.player;
  }

  getSceneBuilder(): SceneBuilder | null {
    return this.sceneBuilder;
  }

  private registerDebugPanelControllers(): void {
    const metadata = this.scene.metadata && typeof this.scene.metadata === 'object'
      ? this.scene.metadata as Record<string, unknown>
      : {};
    const debugControllers = metadata.debugControllers && typeof metadata.debugControllers === 'object'
      ? metadata.debugControllers as Record<string, DebugPanelRuntimeController>
      : {};

    debugControllers.runtimeProbe = {
      getLiveConfig: () => structuredClone(this.runtimeProbeDebugConfig),
      applyLivePatch: (patch: Record<string, unknown>) => this.applyRuntimeProbeDebugPatch(patch),
      updateConfig: (patch: Record<string, unknown>) => this.applyRuntimeProbeDebugPatch(patch),
      invokeAction: (request: Record<string, unknown>) => {
        if (request.action !== 'flash') return;
        metadata.runtimeProbeLastAction = {
          action: request.action,
          args: request.args,
          at: Date.now(),
        };
        console.log('[DebugPanel][runtimeProbe] action', metadata.runtimeProbeLastAction);
      },
    };
    debugControllers.mockPlatformAssets = createMockPlatformAssetsController();

    metadata.debugControllers = debugControllers;
    this.scene.metadata = metadata;
  }

  private applyRuntimeProbeDebugPatch(patch: Record<string, unknown>): void {
    if (typeof patch.enabled === 'boolean') this.runtimeProbeDebugConfig.enabled = patch.enabled;
    if (typeof patch.intensity === 'number' && Number.isFinite(patch.intensity)) {
      this.runtimeProbeDebugConfig.intensity = Math.max(0, Math.min(5, patch.intensity));
    }
    if (Array.isArray(patch.tint) && patch.tint.length >= 3) {
      this.runtimeProbeDebugConfig.tint = [
        this.readNormalizedDebugColorChannel(patch.tint[0], this.runtimeProbeDebugConfig.tint[0]),
        this.readNormalizedDebugColorChannel(patch.tint[1], this.runtimeProbeDebugConfig.tint[1]),
        this.readNormalizedDebugColorChannel(patch.tint[2], this.runtimeProbeDebugConfig.tint[2]),
      ];
    }
    if (patch.mode === 'soft' || patch.mode === 'sharp' || patch.mode === 'pulse') {
      this.runtimeProbeDebugConfig.mode = patch.mode;
    }
    if (typeof patch.note === 'string') this.runtimeProbeDebugConfig.note = patch.note;

    const metadata = this.scene.metadata && typeof this.scene.metadata === 'object'
      ? this.scene.metadata as Record<string, unknown>
      : {};
    metadata.runtimeProbe = structuredClone(this.runtimeProbeDebugConfig);
    this.scene.metadata = metadata;
  }

  private readNormalizedDebugColorChannel(value: unknown, fallback: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
    return Math.max(0, Math.min(1, value));
  }

  private refreshStaticSilhouetteTargets(): void {
    if (!this.sceneBuilder) {
      this.dynamicSilhouetteMeshes = [];
      this.renderingService?.setSilhouetteStaticTargets([]);
      this.renderingService?.setSilhouetteTargets([]);
      return;
    }

    const targetAssetIds = new Set(['asset_truck', 'asset_tree_lv1']);
    const staticMeshes: AbstractMesh[] = [];
    const seenStaticMeshIds = new Set<number>();

    for (const node of configService.getSceneNodes()) {
      if (node.kind !== 'instance' || !targetAssetIds.has(node.instance.assetId)) continue;

      const runtime = this.sceneBuilder.getSceneNodeRuntime(node.id);
      if (!runtime) continue;

      for (const mesh of runtime.getChildMeshes(false)) {
        if (!this.isOutlineRenderable(mesh)) continue;
        if (seenStaticMeshIds.has(mesh.uniqueId)) continue;
        seenStaticMeshIds.add(mesh.uniqueId);
        staticMeshes.push(mesh);
      }
    }

    this.renderingService?.setSilhouetteStaticTargets(staticMeshes);
  }

  private refreshDynamicSilhouetteTargets(): void {
    const meshes: AbstractMesh[] = [];
    const seenMeshIds = new Set<number>();
    const addIfRenderable = (mesh: AbstractMesh | null | undefined): void => {
      if (!this.isOutlineRenderable(mesh)) return;
      if (seenMeshIds.has(mesh.uniqueId)) return;
      seenMeshIds.add(mesh.uniqueId);
      meshes.push(mesh);
    };

    for (const mesh of this.player?.getSilhouetteMeshes() ?? []) {
      addIfRenderable(mesh);
    }

    this.dynamicSilhouetteMeshes = meshes;
  }

  private isOutlineRenderable(mesh: AbstractMesh | null | undefined): mesh is AbstractMesh {
    if (!mesh || mesh.isDisposed()) return false;
    if (!mesh.isEnabled()) return false;
    if (typeof mesh.getTotalVertices === 'function' && mesh.getTotalVertices() > 0) return true;

    const boundingInfo = mesh.getBoundingInfo();
    const min = boundingInfo.boundingBox.minimumWorld;
    const max = boundingInfo.boundingBox.maximumWorld;
    const sizeX = max.x - min.x;
    const sizeY = max.y - min.y;
    const sizeZ = max.z - min.z;
    return sizeX > 0.0001 || sizeY > 0.0001 || sizeZ > 0.0001;
  }

  getInputService(): InputService | null {
    return this.inputService;
  }

  getEconomySystem(): EconomySystem | null {
    return this.economySystem;
  }

  getNewbieGuideSystem(): NewbieGuideSystem | null {
    return this.newbieGuideSystem;
  }

  spawnRewardCashStack(count = 50): void {
    this.newbieGuideSystem?.spawnRewardCashStack(count);
  }

  isSawmillPaused(): boolean {
    return this.newbieGuideSystem?.isSawmillPaused() ?? false;
  }

  isConveyorGroundDecalsVisible(): boolean {
    return this.newbieGuideSystem?.isConveyorGroundDecalsVisible() ?? true;
  }

  toggleSawmillPaused(): void {
    this.newbieGuideSystem?.toggleSawmillPaused();
  }

  toggleConveyorGroundDecals(): void {
    const visible = !this.isConveyorGroundDecalsVisible();
    this.newbieGuideSystem?.setConveyorGroundDecalsVisible(visible);
  }

  isConveyorArrowMovementPaused(): boolean {
    return this.newbieGuideSystem?.isConveyorArrowMovementPaused() ?? false;
  }

  toggleConveyorArrowMovementPaused(): boolean {
    return this.newbieGuideSystem?.toggleConveyorArrowMovementPaused() ?? false;
  }

  advanceToUnlockedConveyorStage(): void {
    this.newbieGuideSystem?.advanceToUnlockedConveyorStage();
  }

  getPlanarShadowSettings(groupId = 'forest'): { enabled: boolean; groundHeight: number; depthBias: number; alpha: number; footprintScale: number } {
    return this.shadowService?.getPlanarProjectionShadowSettings(groupId) ?? {
      enabled: false,
      groundHeight: 0,
      depthBias: 0.02,
      alpha: 0.32,
      footprintScale: 1,
    };
  }

  updatePlanarShadowSettings(settings: Partial<{ enabled: boolean; groundHeight: number; depthBias: number; alpha: number; footprintScale: number }>, groupId = 'forest'): void {
    this.shadowService?.updatePlanarProjectionShadowSettings(settings, groupId);
  }

  toggleCurrentSceneVehicles(): boolean {
    const visible = !this.areCurrentSceneVehiclesVisible();
    this.setMatchedVisibility(this.isCurrentSceneVehicleName, visible);
    return visible;
  }

  areCurrentSceneVehiclesVisible(): boolean {
    return this.hasVisibleMatched(this.isCurrentSceneVehicleName);
  }

  toggleLv3LoggingTruck(): boolean {
    const visible = !this.isLv3LoggingTruckVisible();
    this.setMatchedVisibility(this.isLv3LoggingTruckName, visible);
    return visible;
  }

  isLv3LoggingTruckVisible(): boolean {
    return this.hasVisibleMatched(this.isLv3LoggingTruckName);
  }

  toggleUnlockDoorDecalBase2(): boolean {
    const visible = !this.isUnlockDoorDecalBase2Visible();
    this.setMatchedVisibility(this.isUnlockDoorDecalBase2Name, visible);
    return visible;
  }

  isUnlockDoorDecalBase2Visible(): boolean {
    return this.hasVisibleMatched(this.isUnlockDoorDecalBase2Name);
  }

  revealAllObjects(): void {
    const shouldRevealName = (name: string | null | undefined): boolean => {
      const value = (name ?? '').trim().toLowerCase();
      if (!value) return false;
      if (value.includes('template')) return false;
      return true;
    };

    for (const node of this.scene.transformNodes) {
      if (!shouldRevealName(node.id) && !shouldRevealName(node.name)) continue;
      node.setEnabled(true);
    }

    for (const mesh of this.scene.meshes) {
      if (!shouldRevealName(mesh.id) && !shouldRevealName(mesh.name)) continue;
      mesh.setEnabled(true);
      mesh.isVisible = true;
      mesh.visibility = 1;
    }
  }

  getSceneNodeRuntime(id: string): any | null {
    return this.sceneBuilder?.getSceneNodeRuntime(id) ?? null;
  }

  private isCurrentSceneVehicleName = (name: string | null | undefined): boolean => {
    const value = (name ?? '').trim().toLowerCase();
    if (!value) return false;
    if (value.includes('template')) return false;
    if (value.includes('二级伐木车') || value.includes('三级伐木车')) return false;
    if (value.includes('truck_lv2') || value.includes('truck_lv3')) return false;
    if (value.includes('地贴') || value.includes('decal') || value.includes('path') || value.includes('anchor')) return false;
    return value.includes('truck') || value.includes('卡车') || value.includes('伐木车') || value.includes('升级车');
  };

  private isLv3LoggingTruckName = (name: string | null | undefined): boolean => {
    const value = (name ?? '').trim().toLowerCase();
    return value === 'truck_lv3_upgrade_side' || value === '三级伐木车';
  };

  private isUnlockDoorDecalBase2Name = (name: string | null | undefined): boolean => {
    const value = (name ?? '').trim().toLowerCase();
    return value === 'collect_table_expand_decal_base_2' || value === '解锁门地贴_灰底2';
  };

  private hasVisibleMatched(matches: (name: string | null | undefined) => boolean): boolean {
    return this.scene.transformNodes.some((node) => (matches(node.id) || matches(node.name)) && node.isEnabled())
      || this.scene.meshes.some((mesh) => (matches(mesh.id) || matches(mesh.name)) && mesh.isEnabled() && mesh.isVisible && mesh.visibility > 0);
  }

  private setMatchedVisibility(matches: (name: string | null | undefined) => boolean, visible: boolean): void {
    for (const node of this.scene.transformNodes) {
      if (!matches(node.id) && !matches(node.name)) continue;
      node.setEnabled(visible);
    }

    for (const mesh of this.scene.meshes) {
      if (!matches(mesh.id) && !matches(mesh.name)) continue;
      mesh.setEnabled(visible);
      mesh.isVisible = visible;
      mesh.visibility = visible ? 1 : 0;
    }
  }

  /**
   * AnimationService 访问入口（脚手架保留：具体项目可在 entity/system 中使用）
   */
  getAnimationService(): AnimationService | null {
    return this.animationService;
  }

  onEditorDocumentCommitted(sceneConfig: SceneConfig): void {
    configService.replaceSceneConfig(sceneConfig);
    this.refreshStaticSilhouetteTargets();
    this.refreshDynamicSilhouetteTargets();
  }

  // ============================================================
  // Dispose
  // ============================================================

  dispose(): void {
    this.stop();

    this.player?.dispose();
    this.player = null;

    this.inputService?.dispose();
    this.inputService = null;

    this.economySystem?.dispose();
    this.economySystem = null;

    this.newbieGuideSystem?.dispose();
    this.newbieGuideSystem = null;

    this.hudLayer?.dispose();
    this.hudLayer = null;

    this.gameUI?.dispose();
    this.gameUI = null;

    this.floatingUIManager?.dispose();
    this.floatingUIManager = null;

    this.inputRouter?.dispose();
    this.inputRouter = null;

    this.joystick?.dispose();
    this.joystick = null;

    this.audioService?.dispose();
    this.audioService = null;

    this.sceneVfxService?.dispose();
    this.sceneVfxService = null;

    this.renderingService?.dispose();
    this.renderingService = null;

    this.materialConfigService?.dispose();
    this.materialConfigService = null;

    this.shadowService?.dispose();
    this.shadowService = null;

    this.modelPool?.dispose();
    this.modelPool = null;

    this.sceneBuilder?.dispose();
    this.sceneBuilder = null;

    this.assetLoader = null;
    this.animationService = null;

    this.scene.dispose();
    this.spectatorCamera?.dispose();
    this.spectatorCamera = null;
    window.removeEventListener('resize', this.onWindowResize);
    window.removeEventListener('keydown', this.onSpectatorKeyDown);
    window.removeEventListener('keyup', this.onSpectatorKeyUp);
    this.engine.dispose();
  }
}
