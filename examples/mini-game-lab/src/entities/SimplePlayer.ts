/**
 * SimplePlayer (Scaffold)
 *
 * 这是一个“脚手架示例实体”：
 * - 不依赖任何具体 GLB 模型资源
 * - 用 Babylon 基元 Mesh (sphere) 作为可视化
 * - 演示实体的 init / update / dispose 生命周期
 * - 演示如何消费通用移动输入接口
 *
 * 你可以在实际项目中：
 * - 替换为继承 BaseEntity 的角色实体（使用 ModelPool + 动画）
 * - 或按项目需要实现更多组件化结构
 */

import { Camera } from '@babylonjs/core/Cameras/camera';
import { Scene } from '@babylonjs/core/scene';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';

import type { MovementInputSource } from '../services';
import { configService } from '../config';
import { getModelPathAndFileAsync } from '../assets';
import playerGlbUrl from '../assets/主角 (1).glb?url';
import truckLv2GlbUrl from '../assets/二级伐木车.glb?url';
import cashBillGlbUrl from '../assets/美钞.glb?url';
import plankGlbUrl from '../assets/木板.glb?url';

interface PlayerAnimationTuning {
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
}

const DEFAULT_PLAYER_ANIMATION_TUNING: PlayerAnimationTuning = {
  pickupArcHeight: 0.55,
  pickupScale: 1,
  pickupScaleCycles: 0,
  pickupSpinTurns: 0.83,
  deliveryArcHeight: 1.2,
  deliveryScale: 1,
  deliveryScaleCycles: 0,
  deliverySpinTurns: 1.08,
  deliveryDuration: 0.22,
  machineAnimationSpeedRatio: 1,
  machineTransferArcHeight: 0.6,
  machineTransferScale: 1,
  machineTransferScaleCycles: 0,
  machineTransferSpinTurns: 0,
  machineTransferDuration: 0.16,
};

function clampFinite(value: unknown, fallback: number, min: number, max: number = Number.MAX_VALUE): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export interface SimplePlayerConfig {
  /** 初始位置 */
  position: Vector3;
  /** 移动速度（单位/秒） */
  speed: number;
  /** 半径（视觉尺寸） */
  radius?: number;
}

interface TreeRuntime {
  id: string;
  level: 1 | 2;
  root: TransformNode;
  trunk: AbstractMesh;
  crown: AbstractMesh | null;
  basePos: Vector3;
  hits: number;
  felled: boolean;
  respawnAt: number;
}

interface DropRuntime {
  mesh: Mesh;
  kind: 'wood' | 'cash';
  processed: boolean;
  refined: boolean;
  state: 'ground' | 'flying' | 'carried' | 'queuedToTruck' | 'queuedToPayment' | 'toTruck' | 'toPayment' | 'toGroundCash' | 'paymentShrink' | 'deliveredToTruck';
  flightDelay: number;
  flightT: number;
  flightStart: Vector3;
  carrySlot: number;
  flightTarget: Vector3;
  flightArcHeight: number;
  flightOriginNode: TransformNode | null;
  flightOriginOffset: Vector3;
  outboundQueueIndex: number;
  truckDeliveryScale: number;
  truckDeliveryYaw: number;
  truckDeliveryParent: TransformNode | null;
  flightBaseScaling: Vector3;
}

interface CarryAnchorLayout {
  bucket: CarryBucket;
  prefixCount: number;
  layer: number;
  bucketCenterZ: number;
  baseY: number;
}

interface ChipParticle {
  mesh: Mesh;
  velocity: Vector3;
  life: number;
}

interface ObstacleRuntime {
  mesh: AbstractMesh;
}

type CarryBucket = 'raw' | 'debarked' | 'plank' | 'cash';

export class SimplePlayer {
  private static readonly LV2_TRUCK_RESPAWN_POSITION = new Vector3(-0.58, 0, -0.76);
  private scene: Scene;
  private movementInput: MovementInputSource | null;
  private root: TransformNode | null = null;
  private visualRoot: TransformNode | null = null;
  private visualMeshes: AbstractMesh[] = [];
  private animationGroups: AnimationGroup[] = [];
  private actionGroup: AnimationGroup | null = null;
  private currentMotion: 'idle' | 'run' | 'none' = 'none';
  private disposed = false;

  private _position: Vector3;
  private baseSpeed: number;
  private playerRadius: number;
  private speedMultiplier: number = 1;
  private idleTime: number = 0;
  private trees: TreeRuntime[] = [];
  private drops: DropRuntime[] = [];
  private carriedDrops: DropRuntime[] = [];
  private lastChopAt = 0;
  private chopKick = 0;
  private treeScanDelay = 0;
  private woodRawMat: StandardMaterial | null = null;
  private woodDebarkedMat: StandardMaterial | null = null;
  private woodFinalMat: StandardMaterial | null = null;
  private chipMat: StandardMaterial | null = null;
  private chips: ChipParticle[] = [];
  private obstacles: ObstacleRuntime[] = [];
  private obstacleScanDelay = 0;
  private collisionEnabled = true;

  private readonly treeCollisionRadius = 0.5;
  private readonly chopRange = 1.1;
  private readonly chopInterval = 0.35;
  private readonly maxTreesPerChopOnFoot = 1;
  private readonly truckTreeCollisionPadding = 0.18;
  private readonly treeHp = 1;
  private readonly treeRespawnDelay = 4;
  private readonly treeRespawnSafeDistance = 1.2;
  private readonly pickupRadius = 1.45;
  private readonly pickupFlightSpeed = 4.2;
  private playerAnimationTuning: PlayerAnimationTuning;
  private cashVisualScale = 1;
  private deliveredToTruckPending = 0;
  private deliveredToPaymentPending = 0;
  private collectedCashPending = 0;
  private cashTemplateMesh: Mesh | null = null;
  private cashTemplateInitPromise: Promise<void> | null = null;
  private rawWoodTemplateMesh: Mesh | null = null;
  private plankTemplateMesh: Mesh | null = null;
  private readonly rawWoodVisualScale = 0.16;
  private readonly rawWoodTargetCashLengthMultiplier = 2;
  private readonly rawWoodThicknessScale = 1.356;
  private truckLv2Mode = false;

  constructor(scene: Scene, movementInput: MovementInputSource | null, config: SimplePlayerConfig) {
    this.scene = scene;
    this.movementInput = movementInput;
    this._position = config.position.clone();
    this.baseSpeed = config.speed;
    this.playerRadius = config.radius ?? 0.35;
    this.playerAnimationTuning = this.loadPlayerAnimationTuning();

    const root = new TransformNode('player_root', this.scene);
    root.position.copyFrom(this._position);

    this.root = root;
    this.loadModel();
    this.cashTemplateInitPromise = this.initCashTemplateFromSceneInstance();
    this.initRawWoodTemplateFromSceneInstance();
    this.preloadPlankTemplateModel();
  }

  get position(): Vector3 {
    return this._position;
  }

  getAnimationTuning(): PlayerAnimationTuning {
    return { ...this.playerAnimationTuning };
  }

  setAnimationTuning(partial: Partial<PlayerAnimationTuning>): void {
    this.playerAnimationTuning = this.sanitizePlayerAnimationTuning({
      ...this.playerAnimationTuning,
      ...partial,
    });
  }

  setPosition(position: Vector3): void {
    this._position.copyFrom(position);
    this.root?.position.copyFrom(this._position);
    this.updateCarriedDropAnchors();
  }

  setSpeedMultiplier(multiplier: number): void {
    this.speedMultiplier = Math.max(0, multiplier);
  }

  async prepareRuntimeTemplates(): Promise<void> {
    await this.ensureCashTemplateReady();
  }

  setCollisionEnabled(enabled: boolean): void {
    this.collisionEnabled = enabled;
  }

  isCollisionEnabled(): boolean {
    return this.collisionEnabled;
  }

  isLv2TruckMode(): boolean {
    return this.truckLv2Mode;
  }

  upgradeToLv2Truck(): void {
    if (this.truckLv2Mode) return;
    this.truckLv2Mode = true;
    this.setPosition(SimplePlayer.LV2_TRUCK_RESPAWN_POSITION);
    void this.loadLv2TruckModel();
  }

  getCarryCount(): number {
    return this.carriedDrops.filter((drop) => drop.kind === 'wood').length;
  }

  getRawWoodCarryCount(): number {
    return this.carriedDrops.filter((drop) => drop.kind === 'wood' && !drop.processed).length;
  }

  getProcessedWoodCarryCount(): number {
    return this.carriedDrops.filter((drop) => drop.kind === 'wood' && drop.processed && !drop.refined).length;
  }

  getFinalWoodCarryCount(): number {
    return this.carriedDrops.filter((drop) => drop.kind === 'wood' && drop.processed && drop.refined).length;
  }

  getCashCarryCount(): number {
    return this.carriedDrops.filter((drop) => drop.kind === 'cash' && drop.state === 'carried').length;
  }

  consumeDeliveredToTruck(): number {
    const value = this.deliveredToTruckPending;
    this.deliveredToTruckPending = 0;
    return value;
  }

  clearDeliveredTruckBoards(): void {
    for (const drop of this.drops) {
      if (drop.state === 'deliveredToTruck') {
        drop.mesh.dispose();
      }
    }
    this.drops = this.drops.filter((drop) => !drop.mesh.isDisposed());
  }

  clearDeliveredTruckBoardsForParent(parent: TransformNode): void {
    for (const drop of this.drops) {
      if (drop.state === 'deliveredToTruck' && drop.truckDeliveryParent === parent) {
        drop.mesh.dispose();
      }
    }
    this.drops = this.drops.filter((drop) => !drop.mesh.isDisposed());
  }

  consumeCollectedCash(): number {
    const value = this.collectedCashPending;
    this.collectedCashPending = 0;
    return value;
  }

  consumeDeliveredToPayment(): number {
    const value = this.deliveredToPaymentPending;
    this.deliveredToPaymentPending = 0;
    return value;
  }

  requestPickupBoards(origin: Vector3, count: number): number {
    const canTake = Math.max(0, count);
    let picked = 0;
    for (let i = 0; i < canTake; i += 1) {
      const drop = this.spawnDrop(origin, 'wood', true, true, true);
      if (!drop) continue;
      drop.state = 'flying';
      drop.flightDelay = picked * 0.12;
      drop.flightT = 0;
      drop.flightStart.copyFrom(drop.mesh.position);
      drop.carrySlot = this.carriedDrops.length;
      drop.flightTarget.copyFrom(this.getCarryAnchorWorld(drop.carrySlot, drop.kind, drop.processed, drop.refined));
      this.syncDropRuntimeShadowState(drop, false);
      this.carriedDrops.push(drop);
      picked += 1;
    }
    return picked;
  }

  requestPickupDebarkedBoards(origin: Vector3, count: number): number {
    const canTake = Math.max(0, count);
    let picked = 0;
    for (let i = 0; i < canTake; i += 1) {
      const drop = this.spawnDrop(origin, 'wood', true, true, false);
      if (!drop) continue;
      drop.state = 'flying';
      drop.flightDelay = picked * 0.12;
      drop.flightT = 0;
      drop.flightStart.copyFrom(drop.mesh.position);
      drop.carrySlot = this.carriedDrops.length;
      drop.flightTarget.copyFrom(this.getCarryAnchorWorld(drop.carrySlot, drop.kind, drop.processed, drop.refined));
      this.syncDropRuntimeShadowState(drop, false);
      this.carriedDrops.push(drop);
      picked += 1;
    }
    return picked;
  }

  requestPickupCash(origin: Vector3, count: number): number {
    const canTake = Math.max(0, count);
    let picked = 0;
    for (let i = 0; i < canTake; i += 1) {
      const drop = this.spawnDrop(origin, 'cash', true);
      if (!drop) continue;
      drop.state = 'flying';
      drop.flightDelay = i * 0.12;
      drop.flightT = 0;
      drop.flightStart.copyFrom(drop.mesh.position);
      drop.carrySlot = this.carriedDrops.length;
      drop.flightTarget.copyFrom(this.getCarryAnchorWorld(drop.carrySlot, drop.kind, drop.processed, drop.refined));
      this.carriedDrops.push(drop);
      picked += 1;
    }
    return picked;
  }

  spawnGroundCash(origin: Vector3, count: number): number {
    const canSpawn = Math.max(0, count);
    if (!this.cashTemplateMesh) {
      const queuedOrigin = origin.clone();
      void this.spawnGroundCashAsync(queuedOrigin, canSpawn);
      return 0;
    }
    let spawned = 0;
    for (let i = 0; i < canSpawn; i += 1) {
      const drop = this.spawnDrop(origin, 'cash', true);
      if (!drop) continue;
      spawned += 1;
    }
    return spawned;
  }

  spawnGroundCashAtTargets(targets: Vector3[]): number {
    if (!this.cashTemplateMesh) {
      const queuedTargets = targets.map((target) => target.clone());
      void this.spawnGroundCashAtTargetsAsync(queuedTargets);
      return 0;
    }
    let spawned = 0;
    for (const target of targets) {
      const drop = this.spawnDrop(target, 'cash', true);
      if (!drop) continue;
      drop.mesh.position.copyFrom(target);
      drop.mesh.rotationQuaternion = null;
      drop.mesh.rotation.set(0, 0, 0);
      spawned += 1;
    }
    return spawned;
  }

  spawnGroundCashFromOriginToTargets(origin: Vector3, targets: Vector3[], originNode: TransformNode | null = null): number {
    if (!this.cashTemplateMesh) {
      const queuedOrigin = origin.clone();
      const queuedTargets = targets.map((target) => target.clone());
      void this.spawnGroundCashFromOriginToTargetsAsync(queuedOrigin, queuedTargets, originNode);
      return 0;
    }
    let spawned = 0;
    for (let i = 0; i < targets.length; i += 1) {
      const target = targets[i];
      if (!target) continue;
      const drop = this.spawnDrop(origin, 'cash', true);
      if (!drop) continue;
      drop.mesh.position.copyFrom(origin);
      drop.state = 'toGroundCash';
      drop.flightDelay = i * 0.08;
      drop.flightT = 0;
      drop.flightStart.copyFrom(origin);
      drop.flightTarget.copyFrom(target);
      drop.flightOriginNode = originNode;
      drop.flightOriginOffset = originNode
        ? origin.subtract(originNode.getAbsolutePosition())
        : Vector3.Zero();
      const dist = Vector3.Distance(origin, target);
      drop.flightArcHeight = Math.min(1.1, Math.max(0.35, dist * 0.18));
      this.syncDropRuntimeShadowState(drop, true);
      spawned += 1;
    }
    return spawned;
  }

  getGroundCashPositions(): Vector3[] {
    return this.drops
      .filter((drop) => drop.kind === 'cash' && drop.state === 'ground' && !drop.mesh.isDisposed())
      .map((drop) => drop.mesh.getAbsolutePosition().clone());
  }

  getCashVisualDimensions(): { width: number; height: number; depth: number } {
    if (!this.cashTemplateMesh) {
      return { width: 0.16, height: 0.16, depth: 0.16 };
    }

    const bboxMesh = this.cashTemplateMesh.getChildMeshes(false)
      .find((mesh) => mesh.getTotalVertices() > 0) ?? this.cashTemplateMesh;
    const bbox = bboxMesh.getBoundingInfo().boundingBox;
    const width = (bbox.maximumWorld.x - bbox.minimumWorld.x) * this.cashVisualScale;
    const height = (bbox.maximumWorld.y - bbox.minimumWorld.y) * this.cashVisualScale;
    const depth = (bbox.maximumWorld.z - bbox.minimumWorld.z) * this.cashVisualScale;
    return { width, height, depth };
  }

  getCashReferenceLength(): number {
    const { width, height, depth } = this.getCashVisualDimensions();
    return Math.max(0.001, width, height, depth);
  }

  private getPlankVisualDimensions(): { width: number; height: number; depth: number } {
    if (!this.plankTemplateMesh) {
      return { width: 0.35, height: 0.06, depth: 0.12 };
    }

    const bboxMesh = this.plankTemplateMesh.getChildMeshes(false)
      .find((mesh) => mesh.getTotalVertices() > 0) ?? this.plankTemplateMesh;
    const bbox = bboxMesh.getBoundingInfo().boundingBox;
    const carryScale = 0.62;
    return {
      width: (bbox.maximumWorld.x - bbox.minimumWorld.x) * carryScale,
      height: (bbox.maximumWorld.y - bbox.minimumWorld.y) * carryScale,
      depth: (bbox.maximumWorld.z - bbox.minimumWorld.z) * carryScale,
    };
  }

  requestPickupBoardsFromMeshes(sourceMeshes: Mesh[]): number {
    let picked = 0;
    const orderedSources = sourceMeshes
      .map((source, index) => ({ source, index, y: source.getAbsolutePosition().y }))
      .sort((a, b) => {
        if (Math.abs(b.y - a.y) > 0.0001) return b.y - a.y;
        return a.index - b.index;
      })
      .map(({ source }) => source);

    for (const source of orderedSources) {
      if (!source || source.isDisposed() || !source.isEnabled()) continue;
      const origin = new Vector3();
      const worldScale = new Vector3();
      const worldRotation = Quaternion.Identity();
      source.computeWorldMatrix(true).decompose(worldScale, worldRotation, origin);
      const clone = source.clone(`wood_drop_${this.drops.length}`);
      if (!clone) continue;

      clone.parent = null;
      clone.setEnabled(true);
      clone.isVisible = true;
      clone.position.copyFrom(origin);
      clone.rotation.setAll(0);
      clone.rotationQuaternion = worldRotation.clone();
      clone.scaling.setAll(0.62);

      const drop: DropRuntime = {
        mesh: clone,
        kind: 'wood',
        processed: true,
        refined: true,
        state: 'flying',
        flightDelay: picked * 0.12,
        flightT: 0,
        flightStart: clone.position.clone(),
        carrySlot: this.carriedDrops.length,
        flightTarget: this.getCarryAnchorWorld(this.carriedDrops.length, 'wood', true, true),
        flightArcHeight: 0,
        flightOriginNode: null,
        flightOriginOffset: Vector3.Zero(),
        outboundQueueIndex: -1,
        truckDeliveryScale: 1,
        truckDeliveryYaw: Math.PI,
        truckDeliveryParent: null,
        flightBaseScaling: clone.scaling.clone(),
      };
      this.syncDropRuntimeShadowState(drop, false);
      this.drops.push(drop);
      this.carriedDrops.push(drop);
      picked += 1;
    }
    return picked;
  }

  requestPickupDebarkedLogsFromMeshes(sourceMeshes: Mesh[], maxCount = 1): number {
    let picked = 0;
    const orderedSources = sourceMeshes
      .map((source, index) => ({ source, index, y: source.getAbsolutePosition().y, x: source.getAbsolutePosition().x }))
      .sort((a, b) => {
        if (Math.abs(b.y - a.y) > 0.0001) return b.y - a.y;
        if (Math.abs(a.x - b.x) > 0.0001) return a.x - b.x;
        return a.index - b.index;
      })
      .map(({ source }) => source);

    for (const source of orderedSources) {
      if (picked >= maxCount) break;
      if (!source || source.isDisposed() || !source.isEnabled()) continue;

      const origin = new Vector3();
      const worldScale = new Vector3();
      const worldRotation = Quaternion.Identity();
      source.computeWorldMatrix(true).decompose(worldScale, worldRotation, origin);
      const clone = source.clone(`debarked_log_drop_${this.drops.length}`);
      if (!clone) continue;

      clone.parent = null;
      clone.setEnabled(true);
      clone.isVisible = true;
      clone.position.copyFrom(origin);
      clone.rotation.setAll(0);
      clone.rotationQuaternion = worldRotation.clone();
      clone.scaling.copyFrom(worldScale);

      const drop: DropRuntime = {
        mesh: clone,
        kind: 'wood',
        processed: true,
        refined: false,
        state: 'flying',
        flightDelay: picked * 0.12,
        flightT: 0,
        flightStart: clone.position.clone(),
        carrySlot: this.carriedDrops.length,
        flightTarget: this.getCarryAnchorWorld(this.carriedDrops.length, 'wood', true, false),
        flightArcHeight: 0,
        flightOriginNode: null,
        flightOriginOffset: Vector3.Zero(),
        outboundQueueIndex: -1,
        truckDeliveryScale: 1,
        truckDeliveryYaw: Math.PI,
        truckDeliveryParent: null,
        flightBaseScaling: clone.scaling.clone(),
      };
      this.syncDropRuntimeShadowState(drop, false);
      this.drops.push(drop);
      this.carriedDrops.push(drop);
      picked += 1;
    }

    return picked;
  }

  releaseCarriedToTruck(target: Vector3, maxCount: number, targetScale = 1, targetYaw = Math.PI, targetParent: TransformNode | null = null): number {
    const wood = this.carriedDrops
      .filter((drop) => drop.kind === 'wood' && drop.processed && drop.refined && drop.state === 'carried')
      .sort((a, b) => b.carrySlot - a.carrySlot);
    const releasing = Math.min(maxCount, wood.length);
    for (let i = 0; i < releasing; i += 1) {
      const drop = wood[i];
      if (!drop) continue;

      drop.state = 'queuedToTruck';
      drop.outboundQueueIndex = i;
      drop.flightDelay = i * 0.035;
      drop.flightT = 0;
      drop.flightTarget.copyFrom(target);
      drop.truckDeliveryScale = targetScale;
      drop.truckDeliveryYaw = targetYaw;
      drop.truckDeliveryParent = targetParent;
      const dist = Vector3.Distance(drop.mesh.getAbsolutePosition(), target);
      drop.flightArcHeight = Math.min(1.2, Math.max(0.42, dist * 0.26));
      this.syncDropRuntimeShadowState(drop, false);
    }
    this.updateCarriedDropAnchors();
    return releasing;
  }

  releaseCarriedCashToTargets(targets: Vector3[]): number {
    const cashDrops = this.carriedDrops
      .filter((drop) => drop.kind === 'cash' && drop.state === 'carried')
      .sort((a, b) => b.carrySlot - a.carrySlot);
    const releasing = Math.min(targets.length, cashDrops.length);
    for (let i = 0; i < releasing; i += 1) {
      const drop = cashDrops[i];
      const target = targets[i];
      if (!drop || !target) continue;

      drop.state = 'queuedToPayment';
      drop.outboundQueueIndex = i;
      drop.flightDelay = i * 0.085;
      drop.flightT = 0;
      drop.flightTarget.copyFrom(target);
      const dist = Vector3.Distance(drop.mesh.getAbsolutePosition(), target);
      drop.flightArcHeight = Math.min(1.25, Math.max(0.45, dist * 0.24));
      this.syncDropRuntimeShadowState(drop, false);
    }
    this.updateCarriedDropAnchors();
    return releasing;
  }

  clearCashCarry(): void {
    for (const drop of this.drops) {
      if (drop.kind !== 'cash') continue;
      drop.mesh.dispose();
    }
    this.drops = this.drops.filter((drop) => drop.kind !== 'cash');
    this.carriedDrops = this.carriedDrops.filter((drop) => drop.kind !== 'cash');
  }

  popRawWoodForMachine(): Vector3 | null {
    const rawDrop = this.getTopmostCarriedDrop((drop) => drop.kind === 'wood' && !drop.processed);
    if (!rawDrop) return null;

    const idx = this.carriedDrops.indexOf(rawDrop);
    if (idx >= 0) {
      this.carriedDrops.splice(idx, 1);
    }

    const origin = this.getOutboundLaunchWorld(rawDrop);
    rawDrop.mesh.dispose();
    this.drops = this.drops.filter((drop) => !drop.mesh.isDisposed());
    this.updateCarriedDropAnchors();
    return origin;
  }

  popDebarkedWoodForMachine(): Vector3 | null {
    const debarkedDrop = this.getTopmostCarriedDrop((drop) => drop.kind === 'wood' && drop.processed && !drop.refined);
    if (!debarkedDrop) return null;

    const idx = this.carriedDrops.indexOf(debarkedDrop);
    if (idx >= 0) {
      this.carriedDrops.splice(idx, 1);
    }

    const origin = this.getOutboundLaunchWorld(debarkedDrop);
    debarkedDrop.mesh.dispose();
    this.drops = this.drops.filter((drop) => !drop.mesh.isDisposed());
    this.updateCarriedDropAnchors();
    return origin;
  }

  extractRawWoodForMachine(maxCount = Number.MAX_SAFE_INTEGER): number {
    let extracted = 0;
    while (extracted < maxCount) {
      const origin = this.popRawWoodForMachine();
      if (!origin) break;
      extracted += 1;
    }
    return extracted;
  }

  processRawWoodAtDebarker(maxCount = Number.MAX_SAFE_INTEGER): number {
    let converted = 0;
    for (const drop of this.carriedDrops) {
      if (drop.kind !== 'wood' || drop.processed || drop.state !== 'carried') continue;
      drop.processed = true;
      drop.refined = false;
      if (this.woodDebarkedMat) {
        drop.mesh.material = this.woodDebarkedMat;
      }
      this.syncDropRuntimeShadowState(drop, false);
      converted += 1;
      if (converted >= maxCount) break;
    }
    return converted;
  }

  processDebarkedWoodAtSawmill(maxCount = Number.MAX_SAFE_INTEGER): number {
    let converted = 0;
    for (const drop of this.carriedDrops) {
      if (drop.kind !== 'wood' || !drop.processed || drop.refined || drop.state !== 'carried') continue;
      drop.refined = true;
      if (this.woodFinalMat) {
        drop.mesh.material = this.woodFinalMat;
      }
      this.syncDropRuntimeShadowState(drop, false);
      converted += 1;
      if (converted >= maxCount) break;
    }
    return converted;
  }

  update(deltaTime: number): void {
    if (!this.root) return;
    this.idleTime += deltaTime;
    this.treeScanDelay -= deltaTime;
    this.obstacleScanDelay -= deltaTime;

    if (this.treeScanDelay <= 0) {
      this.scanTrees();
      this.treeScanDelay = 0.5;
    }
    if (this.obstacleScanDelay <= 0) {
      this.scanObstacles();
      this.obstacleScanDelay = 0.8;
    }

    const input = this.movementInput?.getInput();

    // 输入向量：x 对应世界 X，y 对应世界 Z
    const dx = input?.x ?? 0;
    const dz = input?.y ?? 0;

    // 先用世界坐标构造，再尝试转换为“相机朝向”坐标
    let move = new Vector3(dx, 0, dz);
    const camera = this.scene.activeCamera as Camera | null;
    if (camera) {
      // 投影相机朝向到地面，计算前/右方向
      const target = (camera as { target?: Vector3 }).target;
      const forward = target
        ? target.subtract(camera.position)
        : camera.getDirection(new Vector3(0, 0, this.scene.useRightHandedSystem ? -1 : 1));
      forward.y = 0;
      if (forward.lengthSquared() > 0.0001) {
        forward.normalize();
        const right = Vector3.Cross(forward, Vector3.Up()).normalize();
        move = forward.scale(dz).add(right.scale(dx));
      }
    }

    // 归一化移动（magnitude 已在摇杆中做了 deadzone & remap）
    const magnitude = Math.sqrt(move.x * move.x + move.z * move.z);
    this.updateTreesAndDrops(deltaTime);

    if (magnitude > 0.0001) {
      move.x /= magnitude;
      move.z /= magnitude;

      const speed = this.baseSpeed * (input?.magnitude ?? 1) * this.speedMultiplier;
      const desired = this._position.add(new Vector3(move.x * speed * deltaTime, 0, move.z * speed * deltaTime));
      const resolved = this.resolveMoveWithCollision(this._position, desired);
      this._position.x = resolved.x;
      this._position.z = resolved.z;

      // 约束在世界边界内（如无配置，使用默认边界）
      const bounds = configService.getWorldBounds();
      this._position.x = Math.max(bounds.minX, Math.min(bounds.maxX, this._position.x));
      this._position.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, this._position.z));

      this.root.rotation.y = Math.atan2(move.x, move.z);
      this.root.position.copyFrom(this._position);
      this.playMotion('run');
    } else {
      this.root.position.copyFrom(this._position);
      this.root.position.y = this._position.y + Math.sin(this.idleTime * 3) * 0.015;
      this.playMotion('idle');
    }

    if (this.visualRoot) {
      this.chopKick = Math.max(0, this.chopKick - deltaTime * 6);
      this.visualRoot.rotation.x = -this.chopKick * 0.22;
    }

    if (this.truckLv2Mode) {
      this.tryDriveThroughTrees();
    } else {
      this.tryChopNearestTree();
    }

    this.updateCarriedDropAnchors();
  }

  dispose(): void {
    this.disposed = true;

    this.animationGroups.forEach((group) => group.stop());
    this.animationGroups = [];
    this.actionGroup = null;
    this.visualMeshes.forEach((mesh) => mesh.dispose());
    this.visualMeshes = [];
    this.drops.forEach((drop) => drop.mesh.dispose());
    this.drops = [];
    this.carriedDrops = [];
    this.trees = [];
    this.woodRawMat?.dispose();
    this.woodRawMat = null;
    this.woodDebarkedMat?.dispose();
    this.woodDebarkedMat = null;
    this.woodFinalMat?.dispose();
    this.woodFinalMat = null;
    this.chipMat?.dispose();
    this.chipMat = null;
    this.chips.forEach((chip) => chip.mesh.dispose());
    this.chips = [];
    this.obstacles = [];
    this.cashTemplateMesh?.dispose();
    this.cashTemplateMesh = null;
    this.rawWoodTemplateMesh?.dispose();
    this.rawWoodTemplateMesh = null;
    this.plankTemplateMesh?.dispose();
    this.plankTemplateMesh = null;
    this.visualRoot?.dispose();
    this.visualRoot = null;
    this.root?.dispose();
    this.root = null;
  }

  private async loadModel(): Promise<void> {
    if (!this.root) return;

    try {
      const modelInfo = await getModelPathAndFileAsync(playerGlbUrl);
      const imported = await SceneLoader.ImportMeshAsync(
        '',
        modelInfo.path,
        modelInfo.filename,
        this.scene,
        undefined,
        modelInfo.isDataUrl || modelInfo.isCompressed ? '.glb' : undefined,
      );
      if (this.disposed || !this.root) {
        imported.meshes.forEach((mesh) => mesh.dispose());
        imported.animationGroups.forEach((group) => group.dispose());
        return;
      }

      const visualRoot = new TransformNode('player_visual_root', this.scene);
      visualRoot.parent = this.root;
      visualRoot.position.y = 0;
      visualRoot.scaling.setAll(0.95);

      const meshSet = new Set(imported.meshes);
      for (const mesh of imported.meshes) {
        if (mesh.parent && meshSet.has(mesh.parent as AbstractMesh)) continue;
        mesh.parent = visualRoot;
      }

      this.visualRoot = visualRoot;
      this.visualMeshes = imported.meshes;
      this.animationGroups = imported.animationGroups;
      this.actionGroup = this.findActionGroup(imported.animationGroups);

      this.boostPlayerVisualBrightness();
      this.playMotion('idle');
    } catch (error) {
      console.warn('[SimplePlayer] Failed to load player glb, keeping empty root.', error);
    }
  }

  private async loadLv2TruckModel(): Promise<void> {
    if (!this.root) return;

    try {
      const modelInfo = await getModelPathAndFileAsync(truckLv2GlbUrl);
      const imported = await SceneLoader.ImportMeshAsync(
        '',
        modelInfo.path,
        modelInfo.filename,
        this.scene,
        undefined,
        modelInfo.isDataUrl || modelInfo.isCompressed ? '.glb' : undefined,
      );
      if (this.disposed || !this.root) {
        imported.meshes.forEach((mesh) => mesh.dispose());
        imported.animationGroups.forEach((group) => group.dispose());
        return;
      }

      this.animationGroups.forEach((group) => group.stop());
      this.animationGroups = [];
      this.actionGroup = null;
      this.visualMeshes.forEach((mesh) => mesh.dispose());
      this.visualMeshes = [];
      this.visualRoot?.dispose();
      this.visualRoot = null;

      const visualRoot = new TransformNode('player_truck_lv2_root', this.scene);
      visualRoot.parent = this.root;
      visualRoot.position.y = -0.05;
      visualRoot.scaling.setAll(0.44);

      const meshSet = new Set(imported.meshes);
      for (const mesh of imported.meshes) {
        if (mesh.parent && meshSet.has(mesh.parent as AbstractMesh)) continue;
        mesh.parent = visualRoot;
      }

      this.visualRoot = visualRoot;
      this.visualMeshes = imported.meshes;
      this.animationGroups = imported.animationGroups;
      this.boostPlayerVisualBrightness();
      this.currentMotion = 'none';
    } catch (error) {
      console.warn('[SimplePlayer] Failed to load lv2 truck glb, keeping current visual.', error);
    }
  }

  getSilhouetteMeshes(): AbstractMesh[] {
    const deduped = new Map<number, AbstractMesh>();
    const addIfRenderable = (mesh: AbstractMesh | null | undefined): void => {
      if (!this.isOutlineRenderable(mesh)) return;
      deduped.set(mesh.uniqueId, mesh);
    };

    for (const mesh of this.visualMeshes) {
      addIfRenderable(mesh);
    }

    return [...deduped.values()];
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

  private async initCashTemplateFromSceneInstance(): Promise<void> {
    const sceneTemplateNode = this.scene.getTransformNodeById('placed_cash_bill_1')
      ?? this.scene.getTransformNodeByName('placed_cash_bill_1');
    const sceneTemplateRoot = sceneTemplateNode?.getChildMeshes(false)
      .find((mesh): mesh is Mesh => mesh instanceof Mesh && mesh.parent === sceneTemplateNode);
    if (!sceneTemplateRoot) {
      try {
        const modelInfo = await getModelPathAndFileAsync(cashBillGlbUrl);
        const imported = await SceneLoader.ImportMeshAsync(
          '',
          modelInfo.path,
          modelInfo.filename,
          this.scene,
          undefined,
          modelInfo.isDataUrl || modelInfo.isCompressed ? '.glb' : undefined,
        );
        if (this.disposed) {
          imported.meshes.forEach((mesh) => mesh.dispose());
          imported.animationGroups.forEach((group) => group.dispose());
          return;
        }

        const template = imported.meshes.find((m) => m instanceof Mesh && m.getTotalVertices() > 0) as Mesh | undefined;
        if (!template) {
          imported.meshes.forEach((mesh) => mesh.dispose());
          imported.animationGroups.forEach((group) => group.dispose());
          this.cashTemplateMesh = null;
          return;
        }

        template.setEnabled(false);
        template.isVisible = false;
        template.position.set(0, -999, 0);
        this.cashTemplateMesh = template;

        for (const mesh of imported.meshes) {
          if (mesh === template) continue;
          mesh.dispose();
        }
        imported.animationGroups.forEach((group) => group.dispose());
      } catch {
        this.cashTemplateMesh = null;
      }
      return;
    }

    const template = sceneTemplateRoot.clone('cash_template_root', null);
    if (!template) {
      this.cashTemplateMesh = null;
      return;
    }

    const absoluteScale = new Vector3();
    const absoluteRotation = Quaternion.Identity();
    const absolutePosition = new Vector3();
    sceneTemplateRoot.computeWorldMatrix(true).decompose(absoluteScale, absoluteRotation, absolutePosition);

    template.parent = null;
    template.rotationQuaternion = absoluteRotation.clone();
    template.rotation.setAll(0);
    template.scaling.copyFrom(absoluteScale);
    template.position.set(0, -999, 0);
    template.setEnabled(false);
    template.isVisible = false;
    for (const mesh of template.getChildMeshes(false)) {
      mesh.setEnabled(false);
      mesh.isVisible = false;
    }

    this.cashTemplateMesh = template;
  }

  private async ensureCashTemplateReady(): Promise<boolean> {
    if (this.cashTemplateMesh) return true;
    this.cashTemplateInitPromise ??= this.initCashTemplateFromSceneInstance();
    try {
      await this.cashTemplateInitPromise;
    } catch {
      return false;
    }
    return !!this.cashTemplateMesh;
  }

  private async spawnGroundCashAsync(origin: Vector3, count: number): Promise<number> {
    const ready = await this.ensureCashTemplateReady();
    if (!ready) return 0;
    return this.spawnGroundCash(origin, count);
  }

  private async spawnGroundCashAtTargetsAsync(targets: Vector3[]): Promise<number> {
    const ready = await this.ensureCashTemplateReady();
    if (!ready) return 0;
    return this.spawnGroundCashAtTargets(targets);
  }

  private async spawnGroundCashFromOriginToTargetsAsync(
    origin: Vector3,
    targets: Vector3[],
    originNode: TransformNode | null,
  ): Promise<number> {
    const ready = await this.ensureCashTemplateReady();
    if (!ready) return 0;
    return this.spawnGroundCashFromOriginToTargets(origin, targets, originNode);
  }

  private boostPlayerVisualBrightness(): void {
    for (const mesh of this.visualMeshes) {
      const material = mesh.material as { albedoColor?: Color3; emissiveColor?: Color3 } | null;
      if (!material) continue;

      if (!material.albedoColor) continue;

      if (mesh.name === 'Actor_kuanggong') {
        material.albedoColor = new Color3(0.97, 0.8245, 0.8245);
        if (material.emissiveColor) {
          material.emissiveColor = new Color3(0.09, 0.03897000000000011, 0.01709999999999999);
        }
        continue;
      }

      const c = material.albedoColor;
      material.albedoColor = new Color3(
        Math.min(1.12, c.r * 1.1),
        Math.min(1.0, c.g * 0.96),
        Math.min(0.98, c.b * 0.9),
      );
    }
  }

  private initRawWoodTemplateFromSceneInstance(): void {
    const sceneTemplateNode = this.scene.transformNodes.find((node) => {
      const candidateIds = [node.id, node.name, node.metadata?.sceneNodeId, node.metadata?.nodeId];
      return candidateIds.some((value) => typeof value === 'string' && /^giant_log_lv3_\d+$/.test(value));
    }) ?? null;
    const sceneTemplateRoot = sceneTemplateNode?.getChildMeshes(false)
      .find((mesh): mesh is Mesh => mesh instanceof Mesh && mesh.parent === sceneTemplateNode)
      ?? sceneTemplateNode?.getChildMeshes(false)
        .find((mesh): mesh is Mesh => mesh instanceof Mesh && mesh.getTotalVertices() > 0);
    if (!sceneTemplateRoot) {
      this.rawWoodTemplateMesh = null;
      return;
    }

    const template = sceneTemplateRoot.clone('raw_wood_template_root', null);
    if (!template) {
      this.rawWoodTemplateMesh = null;
      return;
    }

    const absoluteScale = new Vector3();
    const absoluteRotation = Quaternion.Identity();
    const absolutePosition = new Vector3();
    sceneTemplateRoot.computeWorldMatrix(true).decompose(absoluteScale, absoluteRotation, absolutePosition);

    template.parent = null;
    template.rotationQuaternion = absoluteRotation.clone();
    template.rotation.setAll(0);
    template.scaling.copyFrom(absoluteScale).scaleInPlace(this.rawWoodVisualScale);
    this.applyCashRelativeWoodScale(template, this.getCashReferenceLength());
    template.position.set(0, -999, 0);
    template.setEnabled(false);
    template.isVisible = false;
    this.markRawWoodRuntimeTemplate(template);
    for (const mesh of template.getChildMeshes(false)) {
      mesh.setEnabled(false);
      mesh.isVisible = false;
    }
    this.rawWoodTemplateMesh = template;
  }

  private async preloadPlankTemplateModel(): Promise<void> {
    try {
      const modelInfo = await getModelPathAndFileAsync(plankGlbUrl);
      const imported = await SceneLoader.ImportMeshAsync(
        '',
        modelInfo.path,
        modelInfo.filename,
        this.scene,
        undefined,
        modelInfo.isDataUrl || modelInfo.isCompressed ? '.glb' : undefined,
      );
      if (this.disposed) {
        imported.meshes.forEach((mesh) => mesh.dispose());
        imported.animationGroups.forEach((group) => group.dispose());
        return;
      }

      const template = imported.meshes.find((m) => m instanceof Mesh && m.getTotalVertices() > 0) as Mesh | undefined;
      if (!template) {
        imported.meshes.forEach((mesh) => mesh.dispose());
        imported.animationGroups.forEach((group) => group.dispose());
        return;
      }

      template.setEnabled(false);
      template.isVisible = false;
      template.position.set(0, -999, 0);
      this.plankTemplateMesh = template;

      for (const mesh of imported.meshes) {
        if (mesh === template) continue;
        mesh.dispose();
      }
      imported.animationGroups.forEach((group) => group.dispose());
    } catch {
      this.plankTemplateMesh = null;
    }
  }

  private playMotion(next: 'idle' | 'run'): void {
    if (this.currentMotion === next) return;
    this.currentMotion = next;
    if (this.animationGroups.length === 0) return;

    const wanted = next === 'run' ? ['run', 'walk', 'move'] : ['idle', 'stand'];
    const target = this.animationGroups.find((group) => {
      const name = group.name.toLowerCase();
      return wanted.some((key) => name.includes(key));
    });

    if (!target) return;
    for (const group of this.animationGroups) {
      if (group === this.actionGroup) continue;
      if (group === target) {
        if (!group.isPlaying) group.start(true);
      } else {
        group.stop();
      }
    }
  }

  private scanTrees(): void {
    const existingTrees = new Map(this.trees.map((tree) => [tree.id, tree]));
    const treeMap = new Map<string, TreeRuntime>();
    const treeRoots = this.scene.transformNodes.filter((node) => this.isForestTreeRoot(node));
    if (treeRoots.length === 0) {
      this.trees = [];
      return;
    }

    for (const root of treeRoots) {
      const id = root.id || root.name;
      const childMeshes = root.getChildMeshes(false);
      const trunk = childMeshes.find((mesh) => mesh.name.toLowerCase().includes('trunk'))
        ?? childMeshes.find((mesh) => mesh.getTotalVertices() > 0);
      if (!trunk) continue;
      const crown = childMeshes.find((mesh) => mesh.name.toLowerCase().includes('crown')) ?? null;
      const existing = existingTrees.get(id);
      const level = this.resolveTreeLevel(root);
      if (!level) continue;
      treeMap.set(id, {
        id,
        level,
        root,
        trunk,
        crown,
        basePos: root.getAbsolutePosition().clone(),
        hits: existing?.hits ?? 0,
        felled: existing?.felled ?? !root.isEnabled(),
        respawnAt: existing?.respawnAt ?? 0,
      });
    }
    this.trees = Array.from(treeMap.values());
  }

  private isForestTreeRoot(node: TransformNode): boolean {
    return this.resolveTreeLevel(node) !== null;
  }

  private resolveTreeLevel(node: TransformNode): 1 | 2 | null {
    const candidates = [node.id, node.name];
    const metadataNodeId = typeof node.metadata?.sceneNodeId === 'string'
      ? node.metadata.sceneNodeId
      : typeof node.metadata?.nodeId === 'string'
        ? node.metadata.nodeId
        : '';
    if (metadataNodeId) {
      candidates.push(metadataNodeId);
    }
    if (candidates.some((value) => /^forest_lv1_\d+$/.test(value))) return 1;
    if (candidates.some((value) => /^forest_lv2_\d+$/.test(value))) return 2;
    return null;
  }

  private scanObstacles(): void {
    const playerMeshes = new Set(this.visualMeshes);
    const meshes = this.scene.meshes.filter((mesh) => {
      if (mesh.isDisposed()) return false;
      if (!mesh.isEnabled()) return false;
      if (playerMeshes.has(mesh)) return false;
      if (this.isPlayerOwnedRuntimeMesh(mesh)) return false;
      if (mesh.name.startsWith('wood_drop_') || mesh.name.startsWith('cash_drop_')) return false;
      if (mesh.name.startsWith('wood_chip_') || mesh.name.startsWith('guide_truck_board_')) return false;
      if (this.isWalkableSceneMesh(mesh)) return false;

      const info = mesh.getBoundingInfo();
      const min = info.boundingBox.minimumWorld;
      const max = info.boundingBox.maximumWorld;
      if (!this.hasUsableObstacleBounds(min, max)) return false;
      const height = max.y - min.y;
      const width = max.x - min.x;
      const depth = max.z - min.z;

      // Ignore flat ground/decal planes; keep solid scene models.
      if (height <= 0.12) return false;
      if (width <= 0.05 || depth <= 0.05) return false;
      return true;
    });
    this.obstacles = meshes.map((mesh) => ({ mesh }));
  }

  private isPlayerOwnedRuntimeMesh(mesh: AbstractMesh): boolean {
    let current: { parent?: unknown } | null = mesh;
    while (current) {
      if (current === this.root || current === this.visualRoot) return true;
      if (this.drops.some((drop) => drop.mesh === current)) return true;
      current = (current.parent as { parent?: unknown } | null) ?? null;
    }
    return false;
  }

  private isWalkableSceneMesh(mesh: AbstractMesh): boolean {
    const walkablePrefixes = ['ground_', 'sm_diban', 'overlay_'];
    let node: { name?: string; metadata?: Record<string, unknown>; parent?: unknown } | null = mesh;
    while (node) {
      const name = (node.name ?? '').toLowerCase();
      if (walkablePrefixes.some((prefix) => name.startsWith(prefix))) return true;

      const sceneNodeId = typeof node.metadata?.sceneNodeId === 'string'
        ? node.metadata.sceneNodeId.toLowerCase()
        : '';
      if (walkablePrefixes.some((prefix) => sceneNodeId.startsWith(prefix))) return true;

      node = (node.parent as { name?: string; metadata?: Record<string, unknown>; parent?: unknown } | null) ?? null;
    }
    return false;
  }

  private hasUsableObstacleBounds(min: Vector3, max: Vector3): boolean {
    const values = [min.x, min.y, min.z, max.x, max.y, max.z];
    if (values.some((value) => !Number.isFinite(value))) return false;

    const maxExtent = 200;
    if (values.some((value) => Math.abs(value) > maxExtent)) return false;

    return max.x >= min.x && max.y >= min.y && max.z >= min.z;
  }

  private resolveMoveWithCollision(from: Vector3, desired: Vector3): Vector3 {
    const attempt = desired.clone();
    if (!this.isBlocked(attempt)) return attempt;

    const slideX = new Vector3(desired.x, from.y, from.z);
    if (!this.isBlocked(slideX)) return slideX;

    const slideZ = new Vector3(from.x, from.y, desired.z);
    if (!this.isBlocked(slideZ)) return slideZ;

    return from.clone();
  }

  private isBlocked(pos: Vector3): boolean {
    if (!this.collisionEnabled) return false;
    return this.isBlockedByTree(pos) || this.isBlockedByObstacle(pos);
  }

  private isBlockedByTree(_pos: Vector3): boolean {
    return false;
  }

  private isBlockedByObstacle(pos: Vector3): boolean {
    for (const obstacle of this.obstacles) {
      if (!obstacle.mesh.isEnabled()) continue;
      const info = obstacle.mesh.getBoundingInfo();
      const min = info.boundingBox.minimumWorld;
      const max = info.boundingBox.maximumWorld;
      const inflate = this.playerRadius * 0.8;
      const insideX = pos.x >= min.x - inflate && pos.x <= max.x + inflate;
      const insideZ = pos.z >= min.z - inflate && pos.z <= max.z + inflate;
      if (insideX && insideZ) return true;
    }
    return false;
  }

  private tryChopNearestTree(): void {
    const now = performance.now() * 0.001;
    if (now - this.lastChopAt < this.chopInterval) return;

    const chopRange = this.chopRange;
    const nearestDistSqLimit = chopRange * chopRange;
    const candidates: Array<{ tree: TreeRuntime; distSq: number }> = [];
    for (const tree of this.trees) {
      if (tree.felled || !tree.root.isEnabled()) continue;
      if (tree.level > 1) continue;
      const dx = tree.basePos.x - this._position.x;
      const dz = tree.basePos.z - this._position.z;
      const distSq = dx * dx + dz * dz;
      if (distSq > nearestDistSqLimit) continue;
      candidates.push({ tree, distSq });
    }

    if (candidates.length === 0) return;

    candidates.sort((a, b) => a.distSq - b.distSq);
    const maxTreesPerChop = this.maxTreesPerChopOnFoot;

    this.lastChopAt = now;
    for (let i = 0; i < Math.min(maxTreesPerChop, candidates.length); i += 1) {
      this.hitTree(candidates[i].tree);
    }
  }

  private tryDriveThroughTrees(): void {
    if (!this.truckLv2Mode) return;

    const radius = this.playerRadius + this.treeCollisionRadius + this.truckTreeCollisionPadding;
    const radiusSq = radius * radius;
    let choppedAny = false;

    for (const tree of this.trees) {
      if (tree.felled || !tree.root.isEnabled()) continue;
      if (tree.level > 2) continue;
      const dx = tree.basePos.x - this._position.x;
      const dz = tree.basePos.z - this._position.z;
      if (dx * dx + dz * dz > radiusSq) continue;
      this.hitTree(tree);
      choppedAny = true;
    }

    if (choppedAny) {
      this.lastChopAt = performance.now() * 0.001;
    }
  }

  private hitTree(tree: TreeRuntime): void {
    tree.hits += 1;
    this.spawnChips(tree.basePos);
    if (this.root) {
      this.root.rotation.y = Math.atan2(tree.basePos.x - this._position.x, tree.basePos.z - this._position.z);
    }
    this.playChopAction();

    if (tree.hits < this.treeHp) return;

    const rawWoodCount = tree.level === 2 ? 2 : 1;
    for (let i = 0; i < rawWoodCount; i += 1) {
      this.spawnDrop(tree.basePos, 'wood', true);
    }
    tree.felled = true;
    tree.respawnAt = performance.now() * 0.001 + this.treeRespawnDelay;
    tree.root.setEnabled(false);
    tree.trunk.setEnabled(false);
    tree.crown?.setEnabled(false);
  }

  private playChopAction(): void {
    this.chopKick = 1;
    if (!this.actionGroup) return;
    this.actionGroup.stop();
    this.actionGroup.start(false, 1.15);
  }

  private findActionGroup(groups: AnimationGroup[]): AnimationGroup | null {
    const directAction = groups.find((group) => group.name.includes('操作'));
    if (directAction) return directAction;

    const actionKeywords = ['chop', 'attack', 'hit', 'cut', 'swing'];
    return groups.find((group) => {
      const name = group.name.toLowerCase();
      return actionKeywords.some((keyword) => name.includes(keyword));
    }) ?? null;
  }

  private updateTreesAndDrops(deltaTime: number): void {
    const now = performance.now() * 0.001;
    let carrySlotsDirty = false;

    this.refreshCarrySlots();
    this.beginGroundCashPickupSequence();

    for (const tree of this.trees) {
      if (!tree.felled || now < tree.respawnAt) continue;
      const dx = tree.basePos.x - this._position.x;
      const dz = tree.basePos.z - this._position.z;
      if (dx * dx + dz * dz < this.treeRespawnSafeDistance * this.treeRespawnSafeDistance) continue;

      tree.felled = false;
      tree.hits = 0;
      tree.root.setEnabled(true);
      tree.trunk.setEnabled(true);
      tree.crown?.setEnabled(true);
    }

    for (const drop of this.drops) {
      if (drop.state === 'ground') {
        const dx = drop.mesh.position.x - this._position.x;
        const dz = drop.mesh.position.z - this._position.z;
        if (dx * dx + dz * dz <= this.pickupRadius * this.pickupRadius) {
          const pickupDelay = this.getPickupFlightDelay(drop.kind);
          drop.state = 'flying';
          drop.flightDelay = pickupDelay;
          drop.flightT = 0;
          drop.flightStart.copyFrom(drop.mesh.position);
          drop.flightBaseScaling.copyFrom(drop.mesh.scaling);
          drop.carrySlot = this.carriedDrops.length;
          this.syncDropRuntimeShadowState(drop, false);
          this.carriedDrops.push(drop);
        }
      } else if (drop.state === 'flying') {
        if (drop.flightDelay > 0) {
          if (drop.kind === 'cash') {
            const dx = drop.mesh.position.x - this._position.x;
            const dz = drop.mesh.position.z - this._position.z;
            if (dx * dx + dz * dz > this.pickupRadius * this.pickupRadius) {
              const idx = this.carriedDrops.indexOf(drop);
              if (idx >= 0) {
                this.carriedDrops.splice(idx, 1);
                carrySlotsDirty = true;
              }
              drop.state = 'ground';
              drop.flightDelay = 0;
              drop.flightT = 0;
              drop.carrySlot = -1;
              continue;
            }
          }
          drop.flightDelay = Math.max(0, drop.flightDelay - deltaTime);
          continue;
        }
        drop.flightT = Math.min(1, drop.flightT + deltaTime * this.pickupFlightSpeed);
          drop.flightTarget.copyFrom(this.getCarryAnchorWorld(drop.carrySlot, drop.kind, drop.processed, drop.refined));
        const target = drop.flightTarget;
        const t = drop.flightT;
        const eased = t * t * (3 - 2 * t);
        drop.mesh.position.copyFrom(Vector3.Lerp(drop.flightStart, target, eased));
        drop.mesh.position.y += (1 - Math.pow(2 * t - 1, 2)) * this.playerAnimationTuning.pickupArcHeight;
        this.applyFlightDropPose(drop, t, false);
        if (drop.flightT >= 1) {
          drop.state = 'carried';
          this.syncDropRuntimeShadowState(drop, false);
          if (this.root) {
            drop.mesh.parent = this.root;
          }
          this.applyCarryDropPose(drop);
          if (drop.kind === 'cash') {
            this.collectedCashPending += 1;
          }
        }
      } else if (drop.state === 'queuedToTruck' || drop.state === 'queuedToPayment') {
        if (drop.flightDelay > 0) {
          drop.flightDelay = Math.max(0, drop.flightDelay - deltaTime);
          continue;
        }

        const idx = this.carriedDrops.indexOf(drop);
        if (idx >= 0) {
          this.carriedDrops.splice(idx, 1);
          carrySlotsDirty = true;
        }

        const worldPos = drop.mesh.getAbsolutePosition().clone();
        drop.mesh.parent = null;
        drop.mesh.position.copyFrom(worldPos);
        drop.state = drop.state === 'queuedToTruck' ? 'toTruck' : 'toPayment';
        if (drop.state === 'toTruck') {
          drop.mesh.scaling.setAll(drop.truckDeliveryScale);
          this.syncDropRuntimeShadowState(drop, true);
        } else {
          this.syncDropRuntimeShadowState(drop, false);
        }
        drop.flightT = 0;
        drop.flightStart.copyFrom(worldPos);
        drop.flightBaseScaling.copyFrom(drop.mesh.scaling);
      } else if (drop.state === 'toTruck' || drop.state === 'toPayment' || drop.state === 'toGroundCash') {
        if (drop.flightDelay > 0) {
          if (drop.state === 'toGroundCash' && drop.flightOriginNode && !drop.flightOriginNode.isDisposed()) {
            const dynamicOrigin = drop.flightOriginNode.getAbsolutePosition().add(drop.flightOriginOffset);
            drop.mesh.position.copyFrom(dynamicOrigin);
            drop.flightStart.copyFrom(dynamicOrigin);
          }
          drop.flightDelay = Math.max(0, drop.flightDelay - deltaTime);
          continue;
        }
        const duration = this.playerAnimationTuning.deliveryDuration;
        drop.flightT = Math.min(1, drop.flightT + (deltaTime / duration));
        const target = drop.flightTarget;
        const t = drop.flightT;
        const eased = t * t * t * (t * (t * 6 - 15) + 10);
        drop.mesh.position.copyFrom(Vector3.Lerp(drop.flightStart, target, eased));
        drop.mesh.position.y += (1 - Math.pow(2 * t - 1, 2)) * drop.flightArcHeight;
        this.applyFlightDropPose(drop, t, true);
        if (drop.flightT >= 1) {
          if (drop.state === 'toGroundCash') {
            drop.state = 'ground';
            drop.mesh.position.copyFrom(drop.flightTarget);
            drop.mesh.rotationQuaternion = null;
            drop.mesh.rotation.set(0, 0, 0);
            this.syncDropRuntimeShadowState(drop, true);
            continue;
          }
          if (drop.state === 'toTruck') {
            drop.state = 'deliveredToTruck';
            this.syncDropRuntimeShadowState(drop, true);
            const parent = drop.truckDeliveryParent;
            if (parent && !parent.isDisposed()) {
              drop.mesh.parent = parent;
              drop.mesh.setAbsolutePosition(drop.flightTarget);
            } else {
              drop.mesh.position.copyFrom(drop.flightTarget);
            }
            drop.mesh.rotationQuaternion = null;
            const parentYaw = parent && !parent.isDisposed()
              ? (parent.rotationQuaternion?.toEulerAngles().y ?? parent.rotation.y)
              : 0;
            drop.mesh.rotation.set(0, drop.truckDeliveryYaw - parentYaw, 0);
            drop.mesh.scaling.setAll(drop.truckDeliveryScale);
            this.deliveredToTruckPending += 1;
          } else {
            drop.state = 'paymentShrink';
            drop.flightT = 0;
            drop.mesh.position.copyFrom(drop.flightTarget);
            drop.truckDeliveryScale = Math.max(drop.mesh.scaling.x, drop.mesh.scaling.y, drop.mesh.scaling.z, 0.001);
            this.syncDropRuntimeShadowState(drop, false);
          }
        }
      } else if (drop.state === 'paymentShrink') {
        const duration = this.playerAnimationTuning.deliveryDuration;
        drop.flightT = Math.min(1, drop.flightT + (deltaTime / duration));
        drop.mesh.scaling.setAll(Math.max(0.001, drop.truckDeliveryScale * (1 - drop.flightT)));
        if (drop.flightT >= 1) {
          drop.mesh.dispose();
          this.deliveredToPaymentPending += 1;
        }
      }

    }

    this.updateCarriedDropAnchors(carrySlotsDirty);
    this.drops = this.drops.filter((drop) => !drop.mesh.isDisposed());
    this.updateChips(deltaTime);
  }

  private beginGroundCashPickupSequence(): void {
    const pickupRadiusSq = this.pickupRadius * this.pickupRadius;
    const candidates = this.drops
      .filter((drop) => {
        if (drop.kind !== 'cash' || drop.state !== 'ground' || drop.mesh.isDisposed()) return false;
        const pos = drop.mesh.getAbsolutePosition();
        const dx = pos.x - this._position.x;
        const dz = pos.z - this._position.z;
        return dx * dx + dz * dz <= pickupRadiusSq;
      })
      .sort((a, b) => {
        const aPos = a.mesh.getAbsolutePosition();
        const bPos = b.mesh.getAbsolutePosition();
        if (Math.abs(bPos.y - aPos.y) > 0.0001) return bPos.y - aPos.y;
        if (Math.abs(aPos.x - bPos.x) > 0.0001) return aPos.x - bPos.x;
        if (Math.abs(aPos.z - bPos.z) > 0.0001) return aPos.z - bPos.z;
        return 0;
      });

    for (const drop of candidates) {
      if (drop.state !== 'ground') continue;
      const pickupDelay = this.getPickupFlightDelay(drop.kind);
      drop.state = 'flying';
      drop.flightDelay = pickupDelay;
      drop.flightT = 0;
      drop.flightStart.copyFrom(drop.mesh.position);
      drop.flightBaseScaling.copyFrom(drop.mesh.scaling);
      drop.carrySlot = this.carriedDrops.length;
      this.syncDropRuntimeShadowState(drop, false);
      this.carriedDrops.push(drop);
    }
  }

  private getPickupFlightDelay(kind: 'wood' | 'cash'): number {
    const queued = this.drops.filter((drop) => drop.kind === kind && drop.state === 'flying').length;
    return queued * (kind === 'cash' ? 0.09 : 0.06);
  }

  private spawnDrop(origin: Vector3, kind: 'wood' | 'cash', stableOrigin = false, processed = false, refined = false): DropRuntime | null {
    if (!this.woodRawMat) {
      this.woodRawMat = new StandardMaterial('wood_raw_drop_mat', this.scene);
      this.woodRawMat.diffuseColor = new Color3(0.07, 0.07, 0.07);
      this.woodRawMat.specularColor = new Color3(0.02, 0.02, 0.02);
    }
    if (!this.woodDebarkedMat) {
      this.woodDebarkedMat = new StandardMaterial('wood_debarked_drop_mat', this.scene);
      this.woodDebarkedMat.diffuseColor = new Color3(0.49, 0.3, 0.14);
      this.woodDebarkedMat.specularColor = new Color3(0.02, 0.02, 0.02);
    }
    if (!this.woodFinalMat) {
      this.woodFinalMat = new StandardMaterial('wood_final_drop_mat', this.scene);
      this.woodFinalMat.diffuseColor = new Color3(0.92, 0.9, 0.84);
      this.woodFinalMat.specularColor = new Color3(0.02, 0.02, 0.02);
    }
    let drop: Mesh;
    if (kind === 'cash') {
      if (!this.cashTemplateMesh) return null;
      const cloned = this.cashTemplateMesh.clone(`${kind}_drop_${this.drops.length}`);
      if (!cloned) return null;
      drop = cloned;
      drop.parent = null;
      drop.setEnabled(true);
      drop.isVisible = true;
      drop.rotationQuaternion = this.cashTemplateMesh.rotationQuaternion?.clone() ?? null;
      for (const mesh of drop.getChildMeshes(false)) {
        mesh.setEnabled(true);
        mesh.isVisible = true;
      }
    } else if (kind === 'wood' && !processed && this.rawWoodTemplateMesh) {
      const cloned = this.rawWoodTemplateMesh.clone(`${kind}_drop_${this.drops.length}`);
      drop = cloned ?? MeshBuilder.CreateCylinder(
        `${kind}_drop_${this.drops.length}`,
        { height: 0.62, diameter: 0.18, tessellation: 10 },
        this.scene,
      );
      drop.parent = null;
      this.clearStaticSceneIdentity(drop);
      drop.setEnabled(true);
      drop.isVisible = true;
      if (!cloned) {
        this.applyCashRelativeWoodScale(drop, this.getCashReferenceLength());
      }
      for (const mesh of drop.getChildMeshes(false)) {
        this.clearStaticSceneIdentity(mesh);
        mesh.setEnabled(true);
        mesh.isVisible = true;
      }
    } else if (kind === 'wood' && refined && this.plankTemplateMesh) {
      const cloned = this.plankTemplateMesh.clone(`${kind}_drop_${this.drops.length}`);
      drop = cloned ?? MeshBuilder.CreateBox(`${kind}_drop_${this.drops.length}`, { width: 0.56, height: 0.08, depth: 0.18 }, this.scene);
      drop.setEnabled(true);
      drop.isVisible = true;
      drop.scaling.setAll(0.62);
    } else {
      drop = MeshBuilder.CreateBox(
        `${kind}_drop_${this.drops.length}`,
        { width: 0.56, height: 0.08, depth: 0.18 },
        this.scene,
      );
    }
    drop.position.set(
      origin.x + (stableOrigin ? 0 : (Math.random() - 0.5) * 0.22),
      Math.max(0.1, origin.y),
      origin.z + (stableOrigin ? 0 : (Math.random() - 0.5) * 0.22),
    );
    const usingRawWoodTemplate = kind === 'wood' && !processed && !!this.rawWoodTemplateMesh;
    const usingPlankTemplate = kind === 'wood' && refined && !!this.plankTemplateMesh;
    if (!usingRawWoodTemplate && !usingPlankTemplate && kind !== 'cash') {
      drop.material = refined
        ? this.woodFinalMat
        : processed
          ? this.woodDebarkedMat
          : this.woodRawMat;
    }
    if (kind === 'cash') {
      drop.rotation.y = 0;
    } else if (usingRawWoodTemplate) {
      drop.rotationQuaternion = null;
      drop.rotation.set(0, Math.random() * Math.PI, 0);
    } else {
      drop.rotation.y = Math.random() * Math.PI;
    }

    const runtime: DropRuntime = {
      mesh: drop,
      kind,
      processed,
      refined,
      state: 'ground',
      flightDelay: 0,
      flightT: 0,
      flightStart: drop.position.clone(),
      carrySlot: -1,
      flightTarget: drop.position.clone(),
      flightArcHeight: 0,
      flightOriginNode: null,
      flightOriginOffset: Vector3.Zero(),
      outboundQueueIndex: -1,
      truckDeliveryScale: 1,
      truckDeliveryYaw: Math.PI,
      truckDeliveryParent: null,
      flightBaseScaling: drop.scaling.clone(),
    };
    this.syncDropRuntimeShadowState(runtime, true);
    this.drops.push(runtime);
    return runtime;
  }

  private syncDropRuntimeShadowState(drop: DropRuntime, enabled: boolean): void {
    this.syncDropRuntimeMetadata(drop);
    const shouldEnable = this.isRawWoodDrop(drop) ? false : enabled;
    this.setDropPlanarShadowEnabled(drop, shouldEnable);
  }

  private syncDropRuntimeMetadata(drop: DropRuntime): void {
    this.writeRuntimeDropMetadata(drop.mesh, drop, true);
    for (const node of drop.mesh.getChildTransformNodes(false)) {
      this.writeRuntimeDropMetadata(node, drop, false);
    }
    for (const mesh of drop.mesh.getChildMeshes(false)) {
      this.writeRuntimeDropMetadata(mesh, drop, false);
    }
  }

  private writeRuntimeDropMetadata(node: TransformNode | AbstractMesh, drop: DropRuntime, shadowRoot: boolean): void {
    const metadata = this.clearStaticSceneIdentity(node);
    metadata.runtimeDropKind = drop.kind;
    metadata.runtimeDropState = drop.state;
    metadata.runtimeDropProcessed = drop.processed;
    metadata.runtimeDropRefined = drop.refined;
    metadata.runtimeDropShadowRoot = shadowRoot && this.isRawWoodDrop(drop);
    node.metadata = metadata;
  }

  private markRawWoodRuntimeTemplate(mesh: Mesh): void {
    this.writeRawWoodRuntimeTemplateMetadata(mesh);
    for (const node of mesh.getChildTransformNodes(false)) {
      this.writeRawWoodRuntimeTemplateMetadata(node);
    }
    for (const child of mesh.getChildMeshes(false)) {
      this.writeRawWoodRuntimeTemplateMetadata(child);
    }
  }

  private writeRawWoodRuntimeTemplateMetadata(node: TransformNode | AbstractMesh): void {
    const metadata = this.clearStaticSceneIdentity(node);
    metadata.runtimeDropKind = 'wood';
    metadata.runtimeDropState = 'template';
    metadata.runtimeDropProcessed = false;
    metadata.runtimeDropRefined = false;
    metadata.runtimeDropShadowRoot = false;
    metadata.disablePlanarProjectionShadow = true;
    metadata.disableRuntimeShadowCaster = true;
    node.metadata = metadata;
  }

  private applyCashRelativeWoodScale(mesh: Mesh, cashReferenceLength: number): void {
    const bboxMesh = mesh.getTotalVertices() > 0
      ? mesh
      : mesh.getChildMeshes(false).find((child) => child.getTotalVertices() > 0);
    if (!bboxMesh) return;

    const bbox = bboxMesh.getBoundingInfo().boundingBox;
    const localSize = new Vector3(
      Math.max(0.001, bbox.maximum.x - bbox.minimum.x),
      Math.max(0.001, bbox.maximum.y - bbox.minimum.y),
      Math.max(0.001, bbox.maximum.z - bbox.minimum.z),
    );
    const currentSize = new Vector3(
      localSize.x * Math.abs(mesh.scaling.x),
      localSize.y * Math.abs(mesh.scaling.y),
      localSize.z * Math.abs(mesh.scaling.z),
    );
    const lengthAxis = currentSize.x >= currentSize.y && currentSize.x >= currentSize.z
      ? 'x'
      : currentSize.y >= currentSize.z
        ? 'y'
        : 'z';
    const currentLength = Math.max(0.001, currentSize[lengthAxis]);
    const lengthScale = (cashReferenceLength * this.rawWoodTargetCashLengthMultiplier) / currentLength;
    mesh.scaling.set(
      mesh.scaling.x * lengthScale * (lengthAxis === 'x' ? 1 : this.rawWoodThicknessScale),
      mesh.scaling.y * lengthScale * (lengthAxis === 'y' ? 1 : this.rawWoodThicknessScale),
      mesh.scaling.z * lengthScale * (lengthAxis === 'z' ? 1 : this.rawWoodThicknessScale),
    );
  }

  private clearStaticSceneIdentity(node: TransformNode | AbstractMesh): Record<string, unknown> {
    const metadata = {
      ...((node.metadata && typeof node.metadata === 'object') ? node.metadata : {}),
    } as Record<string, unknown>;
    delete metadata.sceneNodeId;
    delete metadata.nodeId;
    return metadata;
  }

  private isRawWoodDrop(drop: DropRuntime): boolean {
    return drop.kind === 'wood' && !drop.processed;
  }

  private setDropPlanarShadowEnabled(drop: DropRuntime, enabled: boolean): void {
    this.setPlanarShadowEnabled(drop.mesh, enabled);
  }

  private setPlanarShadowEnabled(mesh: Mesh, enabled: boolean): void {
    this.setVisualShadowEffectsEnabled(mesh, enabled);
    for (const node of mesh.getChildTransformNodes(false)) {
      this.setVisualShadowEffectsEnabled(node, enabled);
    }
    for (const child of mesh.getChildMeshes(false)) {
      this.setVisualShadowEffectsEnabled(child as Mesh, enabled);
    }
  }

  private setVisualShadowEffectsEnabled(node: TransformNode | Mesh, enabled: boolean): void {
    const metadata = {
      ...(node.metadata ?? {}),
      disablePlanarProjectionShadow: !enabled,
      disableRuntimeShadowCaster: !enabled,
    } as any;

    if (!enabled) {
      if (metadata.runtimePreviousRenderOutline === undefined) {
        metadata.runtimePreviousRenderOutline = (node as any).renderOutline;
      }
      (node as any).renderOutline = false;
    } else {
      if (typeof metadata.runtimePreviousRenderOutline === 'boolean') {
        (node as any).renderOutline = metadata.runtimePreviousRenderOutline;
      }
      delete metadata.runtimePreviousRenderOutline;
    }

    node.metadata = metadata;
    if (node instanceof Mesh) {
      this.applyRuntimeShadowCasterEnabled(node, enabled);
      if (!enabled) this.hidePlanarProjectionShadowsForSource(node);
    }
  }

  private applyRuntimeShadowCasterEnabled(mesh: Mesh, enabled: boolean): void {
    for (const light of this.scene.lights) {
      const shadowGenerator = (light as any).getShadowGenerator?.();
      if (!shadowGenerator) continue;

      if (enabled) {
        shadowGenerator.addShadowCaster?.(mesh, true);
      } else {
        shadowGenerator.removeShadowCaster?.(mesh, true);
      }
    }
  }

  private hidePlanarProjectionShadowsForSource(mesh: Mesh): void {
    for (const sceneMesh of this.scene.meshes) {
      const metadata = sceneMesh.metadata as any;
      if (metadata?.isPlanarProjectionShadow !== true) continue;
      if (metadata.sourceUniqueId !== mesh.uniqueId) continue;
      sceneMesh.setEnabled(false);
    }
  }

  private spawnChips(origin: Vector3): void {
    if (!this.chipMat) {
      this.chipMat = new StandardMaterial('wood_chip_mat', this.scene);
      this.chipMat.diffuseColor = new Color3(0.6, 0.4, 0.18);
      this.chipMat.specularColor = new Color3(0.02, 0.02, 0.02);
    }

    const count = 6 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i += 1) {
      const chip = MeshBuilder.CreateBox(`wood_chip_${Date.now()}_${i}`, { width: 0.06, height: 0.02, depth: 0.03 }, this.scene);
      chip.position.set(
        origin.x + (Math.random() - 0.5) * 0.25,
        0.18 + Math.random() * 0.12,
        origin.z + (Math.random() - 0.5) * 0.25,
      );
      chip.material = this.chipMat;
      chip.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

      const velocity = new Vector3(
        (Math.random() - 0.5) * 2.2,
        1.2 + Math.random() * 0.8,
        (Math.random() - 0.5) * 2.2,
      );
      this.chips.push({ mesh: chip, velocity, life: 0.6 + Math.random() * 0.4 });
    }
  }

  private updateChips(deltaTime: number): void {
    if (this.chips.length === 0) return;

    const gravity = -4.6;
    for (const chip of this.chips) {
      chip.life -= deltaTime;
      chip.velocity.y += gravity * deltaTime;
      chip.mesh.position.addInPlace(chip.velocity.scale(deltaTime));
      chip.mesh.rotation.x += deltaTime * 6;
      chip.mesh.rotation.y += deltaTime * 5;
      chip.mesh.position.y = Math.max(0.02, chip.mesh.position.y);
      if (chip.life <= 0) {
        chip.mesh.dispose();
      }
    }

    this.chips = this.chips.filter((chip) => !chip.mesh.isDisposed());
  }

  private refreshCarrySlots(): void {
    const ordered = this.carriedDrops.map((drop, index) => ({ drop, index }));
    ordered.sort((a, b) => {
      const aPriority = this.getCarrySortPriority(a.drop);
      const bPriority = this.getCarrySortPriority(b.drop);
      if (aPriority !== bPriority) return aPriority - bPriority;
      return a.index - b.index;
    });

    for (let i = 0; i < ordered.length; i += 1) {
      ordered[i].drop.carrySlot = i;
    }
  }

  private updateCarriedDropAnchors(refreshSlots = true): void {
    if (refreshSlots) {
      this.refreshCarrySlots();
    }
    for (const drop of this.carriedDrops) {
      if (drop.state !== 'carried' && drop.state !== 'queuedToTruck' && drop.state !== 'queuedToPayment') continue;
      if (drop.mesh.parent !== this.root && this.root) {
        drop.mesh.parent = this.root;
      }
      this.applyCarryDropPose(drop);
    }
  }

  private applyCarryDropPose(drop: DropRuntime): void {
    const localPosition = drop.state === 'queuedToTruck' || drop.state === 'queuedToPayment'
      ? this.getOutboundLaunchLocal(drop)
      : this.getCarryAnchorLocal(drop.carrySlot, drop.kind, drop.processed, drop.refined);
    drop.mesh.position.copyFrom(localPosition);
    drop.mesh.scaling.copyFrom(drop.flightBaseScaling);
    drop.mesh.rotationQuaternion = null;
    if (drop.kind === 'wood' && !drop.processed) {
      drop.mesh.rotation.set(0, Math.PI * 0.5, 0);
      return;
    }
    drop.mesh.rotation.set(0, 0, 0);
  }

  private applyFlightDropPose(drop: DropRuntime, t: number, outbound: boolean): void {
    drop.mesh.rotationQuaternion = null;

    const spinTurns = outbound ? this.playerAnimationTuning.deliverySpinTurns : this.playerAnimationTuning.pickupSpinTurns;
    const spinAngle = spinTurns * Math.PI * 2 * t;
    const scaleCycles = outbound ? this.playerAnimationTuning.deliveryScaleCycles : this.playerAnimationTuning.pickupScaleCycles;
    const scaleTarget = outbound ? this.playerAnimationTuning.deliveryScale : this.playerAnimationTuning.pickupScale;
    const scaleWave = scaleCycles <= 0 ? 0 : (1 - Math.cos(t * Math.PI * 2 * scaleCycles)) * 0.5;
    const scaleMultiplier = 1 + (scaleTarget - 1) * scaleWave;
    drop.mesh.scaling.copyFrom(drop.flightBaseScaling).scaleInPlace(scaleMultiplier);

    const phase = t * Math.PI * 2 * Math.max(1, spinTurns);

    if (drop.kind === 'cash') {
      drop.mesh.rotation.set(
        0.1 * Math.sin(phase * 1.4),
        spinAngle,
        0.14 * Math.cos(phase),
      );
      return;
    }

    if (drop.refined) {
      drop.mesh.rotation.set(
        0.08 * Math.sin(phase),
        spinAngle,
        0.2 * Math.sin(phase * 0.8),
      );
      return;
    }

    if (!drop.processed) {
      drop.mesh.rotation.set(
        0.16 * Math.sin(phase * 0.85),
        Math.PI * 0.5 + spinAngle,
        0.24 * Math.cos(phase),
      );
      return;
    }

    drop.mesh.rotation.set(
      0.12 * Math.sin(phase),
      Math.PI * 0.35 + spinAngle,
      0.18 * Math.cos(phase * 0.9),
    );
  }

  private loadPlayerAnimationTuning(): PlayerAnimationTuning {
    const gameplay = configService.getGameplayConfig() as { playerAnimation?: Partial<PlayerAnimationTuning> };
    return this.sanitizePlayerAnimationTuning(gameplay.playerAnimation ?? {});
  }

  private sanitizePlayerAnimationTuning(value: Partial<PlayerAnimationTuning>): PlayerAnimationTuning {
    return {
      pickupArcHeight: clampFinite(value.pickupArcHeight, DEFAULT_PLAYER_ANIMATION_TUNING.pickupArcHeight, 0.1),
      pickupScale: clampFinite(value.pickupScale, DEFAULT_PLAYER_ANIMATION_TUNING.pickupScale, 0.2),
      pickupScaleCycles: clampFinite(value.pickupScaleCycles, DEFAULT_PLAYER_ANIMATION_TUNING.pickupScaleCycles, 0),
      pickupSpinTurns: clampFinite(value.pickupSpinTurns, DEFAULT_PLAYER_ANIMATION_TUNING.pickupSpinTurns, 0),
      deliveryArcHeight: clampFinite(value.deliveryArcHeight, DEFAULT_PLAYER_ANIMATION_TUNING.deliveryArcHeight, 0.1),
      deliveryScale: clampFinite(value.deliveryScale, DEFAULT_PLAYER_ANIMATION_TUNING.deliveryScale, 0.2),
      deliveryScaleCycles: clampFinite(value.deliveryScaleCycles, DEFAULT_PLAYER_ANIMATION_TUNING.deliveryScaleCycles, 0),
      deliverySpinTurns: clampFinite(value.deliverySpinTurns, DEFAULT_PLAYER_ANIMATION_TUNING.deliverySpinTurns, 0),
      deliveryDuration: clampFinite(value.deliveryDuration, DEFAULT_PLAYER_ANIMATION_TUNING.deliveryDuration, 0.05),
      machineAnimationSpeedRatio: clampFinite(value.machineAnimationSpeedRatio, DEFAULT_PLAYER_ANIMATION_TUNING.machineAnimationSpeedRatio, 0.1),
      machineTransferArcHeight: clampFinite(value.machineTransferArcHeight, DEFAULT_PLAYER_ANIMATION_TUNING.machineTransferArcHeight, 0),
      machineTransferScale: clampFinite(value.machineTransferScale, DEFAULT_PLAYER_ANIMATION_TUNING.machineTransferScale, 0.1),
      machineTransferScaleCycles: clampFinite(value.machineTransferScaleCycles, DEFAULT_PLAYER_ANIMATION_TUNING.machineTransferScaleCycles, 0),
      machineTransferSpinTurns: clampFinite(value.machineTransferSpinTurns, DEFAULT_PLAYER_ANIMATION_TUNING.machineTransferSpinTurns, 0),
      machineTransferDuration: clampFinite(value.machineTransferDuration, DEFAULT_PLAYER_ANIMATION_TUNING.machineTransferDuration, 0.05),
    };
  }

  private getCarryAnchorLocal(slot: number, kind: 'wood' | 'cash', processed: boolean, refined: boolean): Vector3 {
    const layout = this.getCarryAnchorLayout(slot, kind, processed, refined);
    const up = layout.baseY + layout.layer * this.getCarryBucketLayerStep(layout.bucket);
    const localX = this.truckLv2Mode ? 0 : 0;
    return new Vector3(localX, up, layout.bucketCenterZ);
  }

  private getCarryAnchorLayout(slot: number, kind: 'wood' | 'cash', processed: boolean, refined: boolean): CarryAnchorLayout {
    const bucket = this.getCarryBucket(kind, processed, refined);
    const orderedBuckets: CarryBucket[] = ['plank', 'debarked', 'raw', 'cash'];
    const bucketCounts: Record<CarryBucket, number> = {
      raw: 0,
      debarked: 0,
      plank: 0,
      cash: 0,
    };

    for (const drop of this.carriedDrops) {
      const currentBucket = this.getCarryBucket(drop.kind, drop.processed, drop.refined);
      bucketCounts[currentBucket] += 1;
    }

    const nearEdgeZ = this.truckLv2Mode ? -1.33 : -0.24;
    let prefixCount = 0;
    let prevDepth = 0;
    let bucketCenterZ = nearEdgeZ - this.getCarryBucketDepth(bucket) * 0.5;
    let hasPlacedAny = false;

    for (const current of orderedBuckets) {
      const count = bucketCounts[current];
      if (count <= 0) continue;

      const depth = this.getCarryBucketDepth(current);
      if (!hasPlacedAny) {
        bucketCenterZ = nearEdgeZ - depth * 0.5;
        hasPlacedAny = true;
      } else {
        bucketCenterZ -= prevDepth * 0.5 + depth * 0.5;
      }

      if (current === bucket) {
        break;
      }

      prefixCount += count;
      prevDepth = depth;
    }

    return {
      bucket,
      prefixCount,
      layer: Math.max(0, slot - prefixCount),
      bucketCenterZ,
      baseY: this.getCarryBucketBaseY(bucket),
    };
  }

  private getOutboundLaunchLocal(drop: DropRuntime): Vector3 {
    const layout = this.getCarryAnchorLayout(drop.carrySlot, drop.kind, drop.processed, drop.refined);
    const step = Math.max(0, drop.outboundQueueIndex);
    const dims = this.getCarryBucketDimensions(layout.bucket);
    const radius = Math.min(0.18, Math.max(0.08, Math.min(dims.width, dims.depth) * 0.45));
    const angle = step * 1.15 + (layout.bucket === 'cash' ? Math.PI * 0.25 : 0);
    const y = layout.baseY + layout.layer * this.getCarryBucketLayerStep(layout.bucket);
    return new Vector3(
      Math.cos(angle) * radius,
      y,
      layout.bucketCenterZ + Math.sin(angle) * radius * 0.55,
    );
  }

  private getOutboundLaunchWorld(drop: DropRuntime): Vector3 {
    const local = this.getOutboundLaunchLocal(drop);
    if (!this.root) return this._position.add(local);
    return Vector3.TransformCoordinates(local, this.root.getWorldMatrix());
  }

  private getTopmostCarriedDrop(predicate: (drop: DropRuntime) => boolean): DropRuntime | null {
    const candidates = this.carriedDrops
      .filter((drop) => drop.state === 'carried' && predicate(drop))
      .sort((a, b) => b.carrySlot - a.carrySlot);
    return candidates[0] ?? null;
  }

  private getCarryBucket(kind: 'wood' | 'cash', processed: boolean, refined: boolean): CarryBucket {
    if (kind === 'cash') return 'cash';
    if (!processed) return 'raw';
    if (!refined) return 'debarked';
    return 'plank';
  }

  private getCarryBucketDepth(bucket: CarryBucket): number {
    return this.getCarryBucketDimensions(bucket).depth + this.getCarryBucketDepthPadding(bucket);
  }

  private getCarryBucketLayerStep(bucket: CarryBucket): number {
    return this.getCarryBucketDimensions(bucket).height + this.getCarryBucketLayerPadding(bucket);
  }

  private getCarryBucketDepthPadding(bucket: CarryBucket): number {
    if (bucket === 'cash' || bucket === 'raw') return 0.002;
    if (bucket === 'plank' || bucket === 'debarked') return 0.004;
    return 0.01;
  }

  private getCarryBucketLayerPadding(bucket: CarryBucket): number {
    if (bucket === 'cash') return 0.002;
    if (bucket === 'raw') return 0;
    if (bucket === 'plank' || bucket === 'debarked') return 0.004;
    return 0.012;
  }

  private getCarryBucketDimensions(bucket: CarryBucket): { width: number; height: number; depth: number } {
    if (bucket === 'cash') {
      return this.getCashVisualDimensions();
    }
    if (bucket === 'raw') {
      return this.getRawWoodCarryDimensions();
    }
    if (bucket === 'debarked') {
      return { width: 0.69, height: 0.218, depth: 0.218 };
    }
    if (bucket === 'plank') {
      return this.getPlankVisualDimensions();
    }
    return { width: 0.56, height: 0.09, depth: 0.19 };
  }

  private getRawWoodCarryDimensions(): { width: number; height: number; depth: number } {
    const mesh = this.rawWoodTemplateMesh;
    if (!mesh || mesh.isDisposed()) {
      return { width: 1.32, height: 0.34, depth: 0.34 };
    }

    const bboxMesh = mesh.getTotalVertices() > 0
      ? mesh
      : mesh.getChildMeshes(false).find((child) => child.getTotalVertices() > 0);
    if (!bboxMesh) {
      return { width: 1.32, height: 0.34, depth: 0.34 };
    }

    const bbox = bboxMesh.getBoundingInfo().boundingBox;
    const size = new Vector3(
      Math.max(0.001, (bbox.maximum.x - bbox.minimum.x) * Math.abs(mesh.scaling.x)),
      Math.max(0.001, (bbox.maximum.y - bbox.minimum.y) * Math.abs(mesh.scaling.y)),
      Math.max(0.001, (bbox.maximum.z - bbox.minimum.z) * Math.abs(mesh.scaling.z)),
    );

    // Carried raw wood is rotated 90 degrees around Y, so local X becomes carry-depth.
    return { width: size.z, height: size.y, depth: size.x };
  }

  private getCarryBucketBaseY(bucket: CarryBucket): number {
    if (this.truckLv2Mode) {
      if (bucket === 'cash') return 0.44;
      return 0.46;
    }
    if (bucket === 'cash') return 0.32;
    return 0.34;
  }

  private getCarryAnchorWorld(slot: number, kind: 'wood' | 'cash', processed: boolean, refined: boolean): Vector3 {
    const local = this.getCarryAnchorLocal(slot, kind, processed, refined);
    if (!this.root) return this._position.add(local);
    return Vector3.TransformCoordinates(local, this.root.getWorldMatrix());
  }

  private getCarrySortPriority(drop: DropRuntime): number {
    if (drop.kind === 'wood' && drop.processed && drop.refined) return 0;
    if (drop.kind === 'wood' && drop.processed && !drop.refined) return 1;
    if (drop.kind === 'wood' && !drop.processed) return 2;
    return 3;
  }
}
