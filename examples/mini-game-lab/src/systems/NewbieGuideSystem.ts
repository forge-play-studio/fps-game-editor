import { Scene } from '@babylonjs/core/scene';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Material } from '@babylonjs/core/Materials/material';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';

import type { BaseSystem } from './BaseSystem';
import { EconomySystem } from './EconomySystem';
import { configService } from '../config';
import { getModelPathAndFileAsync, TextureAssets } from '../assets';
import { SimplePlayer } from '../entities';
import { playDebarkerChipsVFX, disposeDebarkerChipsVFXCache } from '../vfx/playDebarkerChipsVFX';
import { playDebarkerSmokeVFX, disposeDebarkerSmokeVFXCache } from '../vfx/playDebarkerSmokeVFX';
import { playDoorUnlockVFX, disposeDoorUnlockVFXCache } from '../vfx/playDoorUnlockVFX';
import truckLv3GlbUrl from '../assets/三级伐木车_v2.glb?url';

type GuideStep = 'collect_boards' | 'sell' | 'unlock_forest';

interface MachineFeedFlight {
  mesh: Mesh;
  start: Vector3;
  target: Vector3;
  t: number;
  duration: number;
  arcHeight: number;
}

interface MachineLinearItem {
  mesh: Mesh;
  start: Vector3;
  target: Vector3;
  progress: number;
  speed: number;
  phase: 'move' | 'shrink';
  baseScaling: Vector3;
  shrinkProgress: number;
}

interface MachineSpawnItem {
  mesh: Mesh;
  baseScaling: Vector3;
  basePosition: Vector3;
  progress: number;
}

interface SawmillProcessItem {
  mesh: Mesh;
  stage: 'toMachine' | 'rawHold' | 'boardMove' | 'boardArc';
  start: Vector3;
  target: Vector3;
  progress: number;
  duration: number;
  arcHeight: number;
  animationEndObserver?: { remove: () => void };
}

interface ConveyorTransferItem {
  mesh: Mesh;
  stage?: 'arcToPickup' | 'slideToEntry' | 'arcToStack' | 'sellBelt' | 'sellArcToStack';
  start?: Vector3;
  target?: Vector3;
  progress: number;
  speed: number;
  duration?: number;
  arcHeight?: number;
  startYaw?: number;
  targetYaw?: number;
}

interface ConveyorArrowRuntime {
  mesh: Mesh;
  points: Vector3[];
  progress: number;
  speed: number;
}

interface BoardTruckFlight {
  mesh: Mesh;
  start: Vector3;
  target: Vector3;
  targetParent: TransformNode;
  targetScale: number;
  progress: number;
  duration: number;
  arcHeight: number;
  startYaw: number;
  targetYaw: number;
}

interface GroundDecalRuntime {
  mesh: Mesh;
  sceneNodeId: string;
  parentId?: string;
  baseDiffuse: Color3;
  baseEmissive: Color3;
  baseAlpha: number;
  activation: number;
}

type SawmillInputSource = 'player' | 'conveyor';

type TruckState = 'waiting' | 'advancing' | 'loading' | 'departing' | 'recycling';

interface TruckRuntime {
  root: TransformNode;
  state: TruckState;
  load: number;
  route: Vector3[];
  routeIndex: number;
  moveT: number;
  nextState: TruckState;
}

export class NewbieGuideSystem implements BaseSystem {
  private readonly sawmillCompressionYOffset = -0.3;
  // private readonly sawmillAnimationSpeedRatio = 1;
  private readonly sawmillProcessInSpeed = 3.8;
  private readonly sawmillCompressionHoldDuration = 0.1;
  private readonly sawmillBoardMoveSpeed = 3.9;
  private readonly sawmillBoardArcSpeed = 3.2;
  private conveyorGroundDecalsVisible: boolean;
  private readonly scene: Scene;
  private readonly player: SimplePlayer;
  private readonly economy: EconomySystem;

  private step: GuideStep = 'collect_boards';
  private soldBoards = 0;
  private truckQueued = 0;
  private readonly sellZone: Vector3;
  private readonly starterBoardZone: Vector3;
  private readonly rewardCashStackBase: Vector3;
  private readonly truckLoadSlot: Vector3;
  private readonly truckLoadSquare: Vector3;
  private readonly truckQueueSlots: Vector3[] = [];
  private readonly truckQueueTurnPoint: Vector3;
  private readonly truckQueueApproachPoint: Vector3;
  private readonly truckRemoteTurnPoint: Vector3;
  private readonly truckRemoteRecyclePoint: Vector3;
  private readonly debarkerFinishedGoodsPickupCenter: Vector3;
  private readonly debarkerTriggerCenter: Vector3;
  private readonly debarkerOutputStart: Vector3;
  private readonly debarkerOutputStop: Vector3;
  private readonly debarkerOutputLogStackCenter: Vector3;
  private readonly sawmillTriggerCenter: Vector3;
  private readonly sawmillMachineLogPoint: Vector3;
  private readonly sawmillMachineBoardExitPoint: Vector3;
  private readonly sawmillInputLogStackCenter: Vector3;
  private readonly sawmillOutputBoardStackAnchor: Vector3;
  private readonly sawmillOutputPickupCenter: Vector3;
  private readonly conveyorUnlockZone: Vector3;
  private readonly conveyorPickupPoint: Vector3;
  private readonly conveyorSlideEndPoint: Vector3;
  private readonly sellConveyorUnlockZone: Vector3;
  private readonly toolUpgradeZone: Vector3;

  private readonly sellZoneRadius = 1.65;
  private readonly sellTarget = 300;
  private readonly forestUnlockCost = 300;
  private readonly expansionUnlockCost = 20;
  private readonly debarkerTriggerHalfWidth = 1.05;
  private readonly debarkerTriggerHalfDepth = 0.95;
  private readonly debarkerFinishedGoodsPickupHalfWidth = 1.35;
  private readonly debarkerFinishedGoodsPickupHalfDepth = 1.2;
  private readonly sawmillTriggerHalfWidth = 1.15;
  private readonly sawmillTriggerHalfDepth = 1.0;
  private readonly sawmillRadius = 1.2;
  private readonly toolUpgradeRadius = 0.72;
  private readonly starterBoardPickupRadius = 1.45;
  private readonly machineStackPerLayer = 4;
  private readonly starterRewardCount = 24;
  private readonly debarkerProcessInterval = 0.45;
  private readonly debarkerFeedInterval = 0.11;
  private readonly debarkerFeedFlightSpeed = 5.2;
  private readonly debarkerPickupInterval = 0.12;
  private readonly sawmillFeedInterval = 0.11;
  // private readonly sawmillFeedFlightSpeed = 5.2;
  private readonly sawmillPickupInterval = 0.12;
  private readonly conveyorUnlockCost = 100;
  private readonly conveyorTransferInterval = 0.11;
  private readonly conveyorFlightSpeed = 5.4;
  private readonly sellConveyorUnlockCost = 200;
  private readonly sellConveyorTransferInterval = 0.11;
  private readonly sellConveyorFlightSpeed = 5.6;
  private readonly toolUpgradeCost = 400;
  private readonly truckAdvancingSpeed = 11;
  private readonly truckDepartingSpeed = 7.8;
  private readonly truckRespawningSpeed = 8.6;
  private readonly truckWaitEmojiDelay = 6;
  private readonly sellReleaseInterval = 0.12;
  private readonly rewardBillsPerTruck = 5;
  private readonly rewardCashPerBill = 15;

  private readonly sellQueueBoardMeshes: Mesh[] = [];
  private readonly collectTableTruckFlights: BoardTruckFlight[] = [];
  private collectTableTruckFlightCooldown = 0;
  private debarkerInputQueued = 0;
  private debarkerOutputQueued = 0;
  private debarkerProcessTimer = 0;
  private debarkerFeedCooldown = 0;
  private debarkerPickupCooldown = 0;
  private readonly debarkerFeedFlights: MachineFeedFlight[] = [];
  private readonly debarkerOutputFlights: MachineLinearItem[] = [];
  private readonly debarkerOutputLogs: Mesh[] = [];
  private readonly debarkerOutputSpawnItems: MachineSpawnItem[] = [];
  private rawWoodTemplateMesh: Mesh | null = null;
  private debarkerFinishedGoodsTemplateMesh: Mesh | null = null;
  private readonly debarkerRawWoodMachineScale = 0.1;
  private readonly debarkerFinishedGoodsScale = 0.34;
  private readonly debarkerFinishedGoodsVisualMultiplier = 1;
  private readonly debarkerFinishedGoodsTargetCashLengthMultiplier = 2;
  private readonly debarkerFinishedGoodsThicknessScale = 0.68;
  private sawmillFeedCooldown = 0;
  private sawmillPickupCooldown = 0;
  private readonly sawmillFeedFlights: MachineFeedFlight[] = [];
  private readonly sawmillInputLogs: Mesh[] = [];
  private readonly sawmillInputSourceById = new Map<string, SawmillInputSource>();
  private readonly sawmillOutputBoards: Mesh[] = [];
  private sawmillOutputBoardTemplateMesh: Mesh | null = null;
  private readonly sawmillAnimationGroups: AnimationGroup[] = [];
  private sawmillActiveProcess: SawmillProcessItem | null = null;
  private sawmillPaused = false;
  private readonly sawmillInputLogVisualScale = 0.8;
  private conveyorUnlocked = false;
  private conveyorPaidAmount = 0;
  private conveyorReadyToComplete = false;
  private conveyorPaymentCooldown = 0;
  private conveyorPaymentPendingBills = 0;
  private conveyorTransferCooldown = 0;
  private readonly conveyorItems: ConveyorTransferItem[] = [];
  private readonly conveyorArrowRuntimes: ConveyorArrowRuntime[] = [];
  private conveyorArrowMovementPaused = false;
  private conveyorUnlockDecalMesh: Mesh | null = null;
  private conveyorUnlockDecalRoot: TransformNode | null = null;
  private conveyorUnlockDecalBaseScaling = new Vector3(1, 1, 1);
  private conveyorUnlockDecalBasePosition = new Vector3(0, 0, 0);
  private conveyorUnlockDecalBaseDepth = 1;
  private conveyorUnlockDecalPulsePhase = 0;
  private conveyorUnlockDecalBurstTime = 0;
  private conveyorUnlockDecalHideTime = 0;
  private sellConveyorUnlocked = false;
  private sellConveyorPaidAmount = 0;
  private sellConveyorReadyToComplete = false;
  private sellConveyorPaymentCooldown = 0;
  private sellConveyorPaymentPendingBills = 0;
  private readonly sellConveyorBeltSegments: Mesh[] = [];
  private sellConveyorTransferCooldown = 0;
  private readonly sellConveyorItems: ConveyorTransferItem[] = [];
  private readonly sellConveyorArrowRuntimes: ConveyorArrowRuntime[] = [];
  private sellConveyorBoardMat: StandardMaterial | null = null;
  private sellConveyorBaseMat: StandardMaterial | null = null;
  private sellConveyorRailMat: StandardMaterial | null = null;
  private sellConveyorRollerMat: StandardMaterial | null = null;
  private sellConveyorReadyToTruck = 0;
  private sellReleaseCooldown = 0;
  private sellConveyorUnlockDecalMesh: Mesh | null = null;
  private sellConveyorUnlockDecalRoot: TransformNode | null = null;
  private sellConveyorUnlockDecalBaseScaling = new Vector3(1, 1, 1);
  private sellConveyorUnlockDecalBasePosition = new Vector3(0, 0, 0);
  private sellConveyorUnlockDecalBaseDepth = 1;
  private sellConveyorUnlockDecalPulsePhase = 0;
  private sellConveyorUnlockDecalBurstTime = 0;
  private sellConveyorUnlockDecalHideTime = 0;
  private toolUpgradePaidAmount = 0;
  private toolUpgradeUnlocked = false;
  private toolUpgradeReadyToComplete = false;
  private toolUpgradePaymentCooldown = 0;
  private toolUpgradePaymentPendingBills = 0;
  private starterBoardsAvailable = true;
  private readonly starterBoardNodeIds: string[];
  private readonly truckRuntimes: TruckRuntime[] = [];
  private readonly waitingTrucks: TruckRuntime[] = [];
  private loadingTruck: TruckRuntime | null = null;
  private truckIdleT = 0;
  private truckEmojiPlane: Mesh | null = null;
  private truckEmojiTexture: DynamicTexture | null = null;
  private readonly truckBindingRefreshTimers: number[] = [];
  private arrowRoot: TransformNode | null = null;
  private guideArrowMainMesh: Mesh | null = null;
  private readonly guideArrowTrailMeshes: Mesh[] = [];
  private arrowPulse = 0;
  private lockMesh: Mesh | null = null;
  private gateUnlocked = false;
  private gateUnlockAnimActive = false;
  private gateUnlockAnimTime = 0;
  private readonly gateNodes: TransformNode[] = [];
  private readonly gateLockNodes: TransformNode[] = [];
  private readonly gateClosedYawById = new Map<string, number>();
  private readonly gateOpenYawById = new Map<string, number>();
  private readonly gateClosedPositionById = new Map<string, Vector3>();
  private readonly gateLockBaseScalingById = new Map<string, Vector3>();
  private readonly gateLockBasePositionById = new Map<string, Vector3>();
  private gateUnlockPaidAmount = 0;
  private gateUnlockReadyToComplete = false;
  private gateUnlockPaymentCooldown = 0;
  private gatePaymentPendingBills = 0;
  private gateUnlockDecalMesh: Mesh | null = null;
  private gateUnlockDecalBaseScaling = new Vector3(1, 1, 1);
  private gateUnlockDecalBasePosition = new Vector3(0, 0, 0);
  private gateUnlockDecalBaseDepth = 1;
  private gateUnlockDecalHideTime = 0;
  private expansionUnlocked = false;
  private expansionPaidAmount = 0;
  private expansionReadyToComplete = false;
  private expansionPaymentCooldown = 0;
  private expansionPaymentPendingBills = 0;
  private expansionDoorUnlockAnimActive = false;
  private expansionDoorUnlockAnimTime = 0;
  private readonly expansionDoorNodes: TransformNode[] = [];
  private readonly expansionDoorClosedYawById = new Map<string, number>();
  private readonly expansionDoorOpenYawById = new Map<string, number>();
  private readonly expansionDoorClosedPositionById = new Map<string, Vector3>();
  private expansionDecalMesh: Mesh | null = null;
  private expansionDecalBaseScaling = new Vector3(1, 1, 1);
  private expansionDecalBasePosition = new Vector3(0, 0, 0);
  private expansionDecalBaseDepth = 1;
  private expansionDecalHideTime = 0;
  private toolUpgradeDecalMesh: Mesh | null = null;
  private toolUpgradeDecalBaseScaling = new Vector3(1, 1, 1);
  private toolUpgradeDecalBasePosition = new Vector3(0, 0, 0);
  private toolUpgradeDecalBaseDepth = 1;
  private toolUpgradeDecalPulsePhase = 0;
  private toolUpgradeDecalBurstTime = 0;
  private toolUpgradeDecalHideTime = 0;
  private forestShowcaseTruckLv3Root: TransformNode | null = null;
  private forestShowcaseTruckLv3LoadStarted = false;
  private readonly gateBlockMinX: number;
  private readonly gateBlockMaxX: number;
  private readonly gateBlockZ: number;
  private readonly conveyorUnlockZoneHalfWidth: number;
  private readonly conveyorUnlockZoneHalfDepth: number;
  private readonly conveyorUnlockPaymentTarget: Vector3;
  private readonly sellConveyorUnlockZoneHalfWidth: number;
  private readonly sellConveyorUnlockZoneHalfDepth: number;
  private readonly sellConveyorUnlockPaymentTarget: Vector3;
  private readonly gateUnlockZoneCenter: Vector3;
  private readonly gateUnlockZoneHalfWidth: number;
  private readonly gateUnlockZoneHalfDepth: number;
  private readonly gateUnlockPaymentTarget: Vector3;
  private readonly expansionUnlockZoneCenter: Vector3;
  private readonly expansionUnlockZoneHalfWidth: number;
  private readonly expansionUnlockZoneHalfDepth: number;
  private readonly expansionUnlockPaymentTarget: Vector3;
  private readonly gateUnlockPaymentInterval = 0.12;
  private readonly toolUpgradePaymentTarget: Vector3;
  private readonly gateUnlockFillDiffuse = new Color3(0.02, 0.36, 0.04);
  private readonly gateUnlockFillEmissive = new Color3(0, 0, 0);
  private readonly groundDecals: GroundDecalRuntime[] = [];
  private readonly guideArrowTrailCount = 5;
  private readonly guideArrowTrailLift = 0.16;

  constructor(scene: Scene, player: SimplePlayer, economy: EconomySystem) {
    this.scene = scene;
    this.player = player;
    this.economy = economy;
    this.conveyorGroundDecalsVisible = false;

    const truckLane1 = this.resolveSceneAnchor('truck_queue_slot_1', new Vector3(9.19, 0, -0.38), 0);
    const truckLane2 = this.resolveSceneAnchor('truck_queue_slot_2', new Vector3(9.19, 0, -5.02), 0);
    const truckLane3 = this.resolveSceneAnchor('truck_queue_slot_3', new Vector3(9.19, 0, -9.91), 0);
    const truckTurnPoint = this.resolveSceneAnchor('truck_queue_turn_1', new Vector3(8.56, 0, -12.85), 0);
    const truckApproachPoint = this.resolveSceneAnchor('truck_queue_slot_4', new Vector3(4.57, 0, -12.85), 0);
    const truckLoadSlot = this.resolveSceneAnchor('truck_load_slot', new Vector3(0.72, 0, -12.85), 0);
    const truckLoadSquare = this.resolveGroundOverlayCenter('overlay_truck_rear_red_square', truckLoadSlot, 0);
    const truckRemoteTurnPoint = this.resolveSceneAnchor('truck_queue_turn_2', new Vector3(-4.64, 0, -13.42), 0);
    const truckRemoteRecyclePoint = this.resolveSceneAnchor('truck_remote_recycle_1', new Vector3(-4.64, 0, -21.86), 0);
    const rewardCashStackBase = this.resolveSceneAnchor('reward_cash_stack_base', new Vector3(-2.18, 0.0, -9.91), 0.0);
    const starterBoardAnchors = [
      this.resolveSceneAnchor('starter_board_area_near_right', new Vector3(5.77, 0.5, -10.13), 0.08),
      this.resolveSceneAnchor('starter_board_area_near_left', new Vector3(4.97, 0.5, -10.13), 0.08),
      this.resolveSceneAnchor('starter_board_area_far_left', new Vector3(4.97, 0.5, -9.13), 0.08),
      this.resolveSceneAnchor('starter_board_area_far_right', new Vector3(5.77, 0.5, -9.02), 0.08),
    ];
    const starterBoardXs = starterBoardAnchors.map((anchor) => anchor.x);
    const starterBoardZs = starterBoardAnchors.map((anchor) => anchor.z);

    this.sellZone = new Vector3(0.67, 0.08, -7.96);
    this.starterBoardZone = new Vector3(
      (Math.min(...starterBoardXs) + Math.max(...starterBoardXs)) * 0.5,
      0.08,
      (Math.min(...starterBoardZs) + Math.max(...starterBoardZs)) * 0.5,
    );
    this.rewardCashStackBase = rewardCashStackBase;
    this.starterBoardNodeIds = Array.from({ length: this.starterRewardCount }, (_, i) => `starter_plank_yellow_${i + 1}`);
    this.truckLoadSlot = truckLoadSlot;
    this.truckLoadSquare = truckLoadSquare;
    this.truckQueueTurnPoint = truckTurnPoint;
    this.truckQueueApproachPoint = truckApproachPoint;
    this.truckRemoteTurnPoint = truckRemoteTurnPoint;
    this.truckQueueSlots.length = 0;
    // Queue slots are ordered from front-most to back-most.
    this.truckQueueSlots.push(truckLane3, truckLane2, truckLane1);
    this.truckRemoteRecyclePoint = truckRemoteRecyclePoint;
    this.debarkerTriggerCenter = new Vector3(4.13, 0.08, -1.45);
    this.debarkerFinishedGoodsPickupCenter = new Vector3(5.46, 0.08, -4.44);
    this.debarkerOutputStart = new Vector3(5.23, 0.48, -0.72);
    this.debarkerOutputStop = new Vector3(5.25, 0.48, -2.27);
    this.debarkerOutputLogStackCenter = this.resolveSceneAnchor('debarker_output_log_stack_anchor', new Vector3(5.379, 0.5, -3.265), 0.5);
    this.conveyorPickupPoint = new Vector3(5.42, 0.5, -3.72);
    this.conveyorSlideEndPoint = new Vector3(5.42, 0.5, -5.91);
    this.sawmillTriggerCenter = new Vector3(4.31, 0.08, -6.76);
    this.sawmillMachineLogPoint = this.resolveSceneAnchor('sawmill_machine_log_point_anchor', new Vector3(5.68, 0.5, -7.38), 0.5);
    this.sawmillMachineBoardExitPoint = this.resolveSceneAnchor('sawmill_machine_board_exit_point_anchor', new Vector3(5.68, 0.5, -9.40), 0.5);
    this.sawmillInputLogStackCenter = this.resolveSceneAnchor('sawmill_input_log_stack_anchor', new Vector3(4.885, 0.5, -7.1725), 0.5);
    this.sawmillOutputBoardStackAnchor = this.resolveSceneAnchor('sawmill_output_board_stack_anchor', new Vector3(5.62, 0.5, -9.9), 0.5);
    this.sawmillOutputPickupCenter = this.starterBoardZone.clone();
    this.conveyorUnlockZone = new Vector3(5.55, 0, -4.88);
    this.conveyorUnlockZoneHalfWidth = 0.75;
    this.conveyorUnlockZoneHalfDepth = 0.75;
    this.conveyorUnlockPaymentTarget = this.conveyorUnlockZone.clone();
    this.sellConveyorUnlockZone = new Vector3(3.50, 0, -9.54);
    this.sellConveyorUnlockZoneHalfWidth = 0.75;
    this.sellConveyorUnlockZoneHalfDepth = 0.75;
    this.sellConveyorUnlockPaymentTarget = this.sellConveyorUnlockZone.clone();
    const toolUpgradeArea = this.resolveRectAreaFromMesh(
      'player_truck_upgrade_decal_base',
      new Vector3(8.4, 0.08, -6.9),
      0.8,
      0.65,
    );
    this.toolUpgradeZone = toolUpgradeArea.center;
    const gateLeft = this.resolveSceneAnchor('door_left', new Vector3(-1.27, 0.08, -3.71), 0.08);
    const gateRight = this.resolveSceneAnchor('door_right', new Vector3(0.92, 0.08, -3.72), 0.08);
    const gateUnlockArea = this.resolveRectAreaFromMesh(
      'collect_table_expand_decal_mesh',
      new Vector3(-0.16, 0.08, -4.19),
      0.8,
      0.65,
    );
    const expansionUnlockArea = this.resolveRectAreaFromMesh(
      'player_expand_decal_base',
      new Vector3(-4.32, 0.08, -7.14),
      0.85,
      0.75,
    );
    this.gateBlockMinX = Math.min(gateLeft.x, gateRight.x) - 0.75;
    this.gateBlockMaxX = Math.max(gateLeft.x, gateRight.x) + 0.75;
    this.gateBlockZ = Math.max(gateLeft.z, gateRight.z) + 0.2;
    this.gateUnlockZoneCenter = gateUnlockArea.center;
    this.gateUnlockZoneHalfWidth = gateUnlockArea.halfWidth;
    this.gateUnlockZoneHalfDepth = gateUnlockArea.halfDepth;
    this.gateUnlockPaymentTarget = new Vector3(
      gateUnlockArea.center.x,
      Math.max(0.18, gateUnlockArea.center.y) + 0.28,
      gateUnlockArea.center.z,
    );
    this.expansionUnlockZoneCenter = expansionUnlockArea.center;
    this.expansionUnlockZoneHalfWidth = expansionUnlockArea.halfWidth;
    this.expansionUnlockZoneHalfDepth = expansionUnlockArea.halfDepth;
    this.expansionUnlockPaymentTarget = new Vector3(
      expansionUnlockArea.center.x,
      Math.max(0.18, expansionUnlockArea.center.y) + 0.28,
      expansionUnlockArea.center.z,
    );
    this.toolUpgradePaymentTarget = new Vector3(
      toolUpgradeArea.center.x,
      Math.max(0.18, toolUpgradeArea.center.y) + 0.28,
      toolUpgradeArea.center.z,
    );

    this.buildVisualHints();
    this.collectGroundDecals();
    this.initRawWoodTemplateFromSceneInstance();
    this.initDebarkerFinishedGoodsTemplateFromSceneInstance();
    this.initSawmillOutputBoardTemplateFromSceneInstance();
    this.bindSawmillAnimationGroups();
    this.setSawmillAnimationActive(false);
    this.hideInitialConveyors();
    this.hideTruckLoadSquareOverlay();
    this.bindGateVisual();
    this.bindExpansionDoorVisual();
    this.scheduleTruckVisualBindingRefresh();
    this.createArrow();
  }

  getSoldBoards(): number {
    return this.soldBoards;
  }

  getSellTarget(): number {
    return this.sellTarget;
  }

  getGuideStep(): string {
    return this.step;
  }

  isPlayerInBlockingInteractionZone(): boolean {
    return this.inRadius(this.player.position, this.sellZone, this.sellZoneRadius)
      || this.isPlayerInGateUnlockZone()
      || this.isPlayerInExpansionUnlockZone()
      || this.isPlayerInConveyorUnlockZone()
      || this.isPlayerInSellConveyorUnlockZone()
      || this.inRadius(this.player.position, this.toolUpgradeZone, this.toolUpgradeRadius)
      || this.inRadius(this.player.position, this.starterBoardZone, this.starterBoardPickupRadius)
      || this.inRect(this.player.position, this.debarkerTriggerCenter, this.debarkerTriggerHalfWidth, this.debarkerTriggerHalfDepth)
      || this.inRect(this.player.position, this.debarkerFinishedGoodsPickupCenter, this.debarkerFinishedGoodsPickupHalfWidth, this.debarkerFinishedGoodsPickupHalfDepth)
      || this.inRect(this.player.position, this.sawmillTriggerCenter, this.sawmillTriggerHalfWidth, this.sawmillTriggerHalfDepth)
      || this.inRadius(this.player.position, this.sawmillOutputPickupCenter, this.starterBoardPickupRadius);
  }


  private getMachineAnimationTuning() {
    const defaultTuning = {
      machineAnimationSpeedRatio: 1,
      machineTransferArcHeight: 0.6,
      machineTransferScale: 1,
      machineTransferScaleCycles: 0,
      machineTransferSpinTurns: 0,
      machineTransferDuration: 0.16,
    };
    const gameplay = configService.getGameplayConfig() as any;
    const p = gameplay.playerAnimation || {};
    return {
      speedRatio: p.machineAnimationSpeedRatio ?? defaultTuning.machineAnimationSpeedRatio,
      arcHeight: p.machineTransferArcHeight ?? defaultTuning.machineTransferArcHeight,
      scale: p.machineTransferScale ?? defaultTuning.machineTransferScale,
      scaleCycles: p.machineTransferScaleCycles ?? defaultTuning.machineTransferScaleCycles,
      spinTurns: p.machineTransferSpinTurns ?? defaultTuning.machineTransferSpinTurns,
      duration: p.machineTransferDuration ?? defaultTuning.machineTransferDuration,
    };
  }

  isSawmillPaused(): boolean {
    return this.sawmillPaused;
  }

  toggleSawmillPaused(): void {
    this.sawmillPaused = !this.sawmillPaused;
    if (this.sawmillPaused) {
      this.setSawmillAnimationActive(false);
    }
  }

  spawnRewardCashStack(count = 50): void {
    const safeCount = Math.max(0, Math.floor(count));
    if (safeCount <= 0) return;

    const targets: Vector3[] = [];
    for (let i = 0; i < safeCount; i += 1) {
      const slotIndex = this.reserveNextRewardCashSlot(targets);
      targets.push(this.getRewardCashSlotTarget(slotIndex));
    }
    this.player.spawnGroundCashAtTargets(targets);
  }

  private applyTruckDelivered(delivered: number): void {
    if (delivered <= 0) return;
    const loadingTruck = this.loadingTruck;
    if (!loadingTruck || loadingTruck.state !== 'loading') {
      this.sellConveyorReadyToTruck += delivered;
      return;
    }

    const accepted = Math.min(delivered, Math.max(0, 4 - loadingTruck.load));
    for (let i = 0; i < accepted; i += 1) {
      loadingTruck.load += 1;
      this.truckIdleT = 0;
    }

    if (loadingTruck.load >= 4 && loadingTruck.state === 'loading') {
      this.spawnRewardCashBurst(this.rewardBillsPerTruck);
      this.soldBoards = Math.min(this.sellTarget, this.soldBoards + 4);
      this.beginTruckReplacement();
    }
  }

  update(deltaTime: number): void {
    this.arrowPulse += deltaTime;
    this.updateTruck(deltaTime);
    this.sellReleaseCooldown = Math.max(0, this.sellReleaseCooldown - deltaTime);

    const arrivedFromPlayer = this.player.consumeDeliveredToTruck();
    if (arrivedFromPlayer > 0) {
      this.truckQueued = Math.max(0, this.truckQueued - arrivedFromPlayer);
      this.applyTruckDelivered(arrivedFromPlayer);
    }

    const collectedCash = this.player.consumeCollectedCash();
    if (collectedCash > 0) {
      this.economy.addCash(collectedCash * this.rewardCashPerBill);
    }

    const deliveredPayment = this.player.consumeDeliveredToPayment();
    if (deliveredPayment > 0) {
      let remainingDeliveredPayment = deliveredPayment;

      if (remainingDeliveredPayment > 0 && this.gatePaymentPendingBills > 0) {
        const gateDelivered = Math.min(this.gatePaymentPendingBills, remainingDeliveredPayment);
        this.gatePaymentPendingBills = Math.max(0, this.gatePaymentPendingBills - gateDelivered);
        remainingDeliveredPayment -= gateDelivered;
        if (this.gatePaymentPendingBills === 0 && this.gateUnlockReadyToComplete) {
          this.completeForestUnlock();
        }
      }

      if (remainingDeliveredPayment > 0 && this.expansionPaymentPendingBills > 0) {
        const expansionDelivered = Math.min(this.expansionPaymentPendingBills, remainingDeliveredPayment);
        this.expansionPaymentPendingBills = Math.max(0, this.expansionPaymentPendingBills - expansionDelivered);
        remainingDeliveredPayment -= expansionDelivered;
        if (this.expansionPaymentPendingBills === 0 && this.expansionReadyToComplete) {
          this.completeExpansionUnlock();
        }
      }

      if (remainingDeliveredPayment > 0 && this.conveyorPaymentPendingBills > 0) {
        const conveyorDelivered = Math.min(this.conveyorPaymentPendingBills, remainingDeliveredPayment);
        this.conveyorPaymentPendingBills = Math.max(0, this.conveyorPaymentPendingBills - conveyorDelivered);
        remainingDeliveredPayment -= conveyorDelivered;
        if (this.conveyorPaymentPendingBills === 0 && this.conveyorReadyToComplete) {
          this.completeConveyorUnlock();
        }
      }

      if (remainingDeliveredPayment > 0 && this.sellConveyorPaymentPendingBills > 0) {
        const sellConveyorDelivered = Math.min(this.sellConveyorPaymentPendingBills, remainingDeliveredPayment);
        this.sellConveyorPaymentPendingBills = Math.max(0, this.sellConveyorPaymentPendingBills - sellConveyorDelivered);
        remainingDeliveredPayment -= sellConveyorDelivered;
        if (this.sellConveyorPaymentPendingBills === 0 && this.sellConveyorReadyToComplete) {
          this.completeSellConveyorUnlock();
        }
      }

      if (remainingDeliveredPayment > 0 && this.toolUpgradePaymentPendingBills > 0) {
        const toolDelivered = Math.min(this.toolUpgradePaymentPendingBills, remainingDeliveredPayment);
        this.toolUpgradePaymentPendingBills = Math.max(0, this.toolUpgradePaymentPendingBills - toolDelivered);
        if (this.toolUpgradePaymentPendingBills === 0 && this.toolUpgradeReadyToComplete) {
          this.completeToolUpgrade();
        }
      }
    }

    if (this.soldBoards >= this.sellTarget) {
      this.step = 'unlock_forest';
    }

    this.updateStepLogic();
    this.updateConveyorUnlock(deltaTime);
    this.updateSellConveyorUnlock(deltaTime);
    this.updateToolUpgradeUnlock(deltaTime);
    this.updateDebarkerLogic(deltaTime);
    this.updateConveyorTransfer(deltaTime);
    this.updateConveyorArrowAnimations(deltaTime);
    this.updateSawmillLogic(deltaTime);
    this.updateSellConveyorTransfer(deltaTime);
    this.updateCollectTableTruckFlights(deltaTime);
    this.updateCollectTableAutoTruckLoading(deltaTime);
    this.updateSellQueueStackVisual();
    this.updateGateUnlockPayment(deltaTime);
    this.updateExpansionUnlockPayment(deltaTime);
    this.enforceForestGate();
    this.updateGateUnlockAnimation(deltaTime);
    this.updateExpansionDoorUnlockAnimation(deltaTime);
    this.updateConveyorUnlockDecalAnimation(deltaTime);
    this.updateSellConveyorUnlockDecalAnimation(deltaTime);
    this.updateGateUnlockDecalAnimation(deltaTime);
    this.updateExpansionUnlockDecalAnimation(deltaTime);
    this.updateToolUpgradeDecalAnimation(deltaTime);
    this.updateGroundDecalInteractions(deltaTime);
    this.updateArrow();
  }

  dispose(): void {
    disposeDebarkerChipsVFXCache();
    disposeDebarkerSmokeVFXCache();
    disposeDoorUnlockVFXCache();
    this.clearMachineBoardStack(this.sellQueueBoardMeshes);
    this.collectTableTruckFlights.forEach((flight) => flight.mesh.dispose());
    this.collectTableTruckFlights.length = 0;
    this.debarkerFeedFlights.forEach((flight) => flight.mesh.dispose());
    this.debarkerFeedFlights.length = 0;
    this.debarkerOutputFlights.forEach((flight) => flight.mesh.dispose());
    this.debarkerOutputFlights.length = 0;
    this.debarkerOutputLogs.forEach((mesh) => mesh.dispose());
    this.debarkerOutputLogs.length = 0;
    this.debarkerOutputSpawnItems.forEach((item) => item.mesh.dispose());
    this.debarkerOutputSpawnItems.length = 0;
    this.rawWoodTemplateMesh?.dispose();
    this.rawWoodTemplateMesh = null;
    this.debarkerFinishedGoodsTemplateMesh?.dispose();
    this.debarkerFinishedGoodsTemplateMesh = null;
    this.sawmillOutputBoardTemplateMesh?.dispose();
    this.sawmillOutputBoardTemplateMesh = null;
    this.sawmillFeedFlights.forEach((flight) => flight.mesh.dispose());
    this.sawmillFeedFlights.length = 0;
    this.sawmillInputLogs.forEach((mesh) => mesh.dispose());
    this.sawmillInputLogs.length = 0;
    this.sawmillInputSourceById.clear();
    this.sawmillOutputBoards.forEach((mesh) => mesh.dispose());
    this.sawmillOutputBoards.length = 0;
    this.sawmillActiveProcess?.mesh.dispose();
    this.sawmillActiveProcess = null;
    this.setSawmillAnimationActive(false);
    this.conveyorItems.forEach((item) => item.mesh.dispose());
    this.conveyorItems.length = 0;
    this.conveyorArrowRuntimes.length = 0;
    this.conveyorUnlockDecalMesh = null;
    this.conveyorUnlockDecalRoot = null;
    this.sellConveyorUnlockDecalMesh = null;
    this.sellConveyorUnlockDecalRoot = null;
    this.sellConveyorItems.forEach((item) => item.mesh.dispose());
    this.sellConveyorItems.length = 0;
    this.sellConveyorArrowRuntimes.length = 0;
    this.sellConveyorBoardMat?.dispose();
    this.sellConveyorBoardMat = null;
    this.sellConveyorBaseMat?.dispose();
    this.sellConveyorBaseMat = null;
    this.sellConveyorRailMat?.dispose();
    this.sellConveyorRailMat = null;
    this.sellConveyorRollerMat?.dispose();
    this.sellConveyorRollerMat = null;
    this.sellConveyorBeltSegments.forEach((mesh) => mesh.dispose());
    this.sellConveyorBeltSegments.length = 0;
    this.truckRuntimes.forEach((truck) => this.clearTruckCargoAndEmoji(truck.root));
    this.player.clearDeliveredTruckBoards();
    this.truckRuntimes.length = 0;
    this.truckEmojiTexture?.dispose();
    this.truckEmojiTexture = null;
    this.truckEmojiPlane?.dispose();
    this.truckEmojiPlane = null;
    this.waitingTrucks.length = 0;
    this.loadingTruck = null;
    this.truckBindingRefreshTimers.forEach((timerId) => window.clearTimeout(timerId));
    this.truckBindingRefreshTimers.length = 0;
    this.lockMesh = null;
    this.gateUnlockDecalMesh = null;
    this.expansionDecalMesh = null;
    this.toolUpgradeDecalMesh = null;
    this.forestShowcaseTruckLv3Root?.dispose();
    this.forestShowcaseTruckLv3Root = null;
    this.gatePaymentPendingBills = 0;
    this.expansionPaymentPendingBills = 0;
    this.conveyorPaymentPendingBills = 0;
    this.sellConveyorPaymentPendingBills = 0;
    this.toolUpgradePaymentPendingBills = 0;
    this.gateNodes.length = 0;
    this.expansionDoorNodes.length = 0;
    this.arrowRoot?.dispose();
    this.arrowRoot = null;
  }

  private updateStepLogic(): void {
    const playerPos = this.player.position;
    const loadingTruck = this.loadingTruck;
    const pickedStarterBoards = this.player.getCarryCount() === 0 && this.tryCollectStarterBoards();
    const canSellNow = this.inRadius(playerPos, this.sellZone, this.sellZoneRadius)
      && this.player.getFinalWoodCarryCount() > 0
      && !!loadingTruck
      && loadingTruck.state === 'loading';

    if (canSellNow && loadingTruck) {
      const canLoad = Math.max(0, 4 - loadingTruck.load - this.truckQueued - this.collectTableTruckFlights.length);
      if (canLoad > 0 && this.sellReleaseCooldown <= 0) {
        const placement = this.getTruckRedSquareBoardPlacement(loadingTruck.load + this.truckQueued + 1);
        const released = this.player.releaseCarriedToTruck(
          placement.position,
          1,
          placement.scale,
          placement.yaw,
          loadingTruck.root,
        );
        this.truckQueued += released;
        if (released > 0) {
          this.sellReleaseCooldown = this.sellReleaseInterval;
        }
        this.step = 'sell';
      }
    }

    if (this.step === 'collect_boards') {
      if (this.player.getCarryCount() > 0) {
        this.step = 'sell';
      } else if (pickedStarterBoards) {
        this.step = 'sell';
      }
      return;
    }

    if (this.step === 'sell') {
      if (canSellNow) {
        // handled by global sell check above
      }
      if (this.player.getCarryCount() === 0 && this.soldBoards < this.sellTarget) {
        this.step = 'collect_boards';
      }
      return;
    }
  }

  private updateDebarkerLogic(deltaTime: number): void {
    this.updateDebarkerFeedFlights(deltaTime);
    this.updateDebarkerOutputFlights(deltaTime);
    this.updateDebarkerOutputSpawnItems(deltaTime);
    this.debarkerFeedCooldown = Math.max(0, this.debarkerFeedCooldown - deltaTime);
    this.debarkerPickupCooldown = Math.max(0, this.debarkerPickupCooldown - deltaTime);

    const playerPos = this.player.position;
    if (this.inRect(playerPos, this.debarkerTriggerCenter, this.debarkerTriggerHalfWidth, this.debarkerTriggerHalfDepth) && this.debarkerFeedCooldown <= 0) {
      const rawOrigin = this.player.popRawWoodForMachine();
      if (rawOrigin) {
        this.spawnDebarkerFeedFlight(rawOrigin);
        this.debarkerFeedCooldown = this.debarkerFeedInterval;
      }
    }

    this.debarkerProcessTimer += deltaTime;
    if (this.debarkerInputQueued > 0 && this.debarkerProcessTimer >= this.debarkerProcessInterval) {
      this.debarkerProcessTimer = 0;
      this.debarkerInputQueued -= 1;
      this.spawnDebarkerOutputFlight();
    }

    if (
      !this.isConveyorActive()
      &&
      this.inRect(
        playerPos,
        this.debarkerFinishedGoodsPickupCenter,
        this.debarkerFinishedGoodsPickupHalfWidth,
        this.debarkerFinishedGoodsPickupHalfDepth,
      )
      && this.debarkerOutputLogs.length > 0
      && this.debarkerPickupCooldown <= 0
    ) {
      const log = this.getDebarkerFinishedGoodsPickupCandidate();
      if (log && this.player.requestPickupDebarkedLogsFromMeshes([log], 1) > 0) {
        const logIdx = this.debarkerOutputLogs.indexOf(log);
        if (logIdx >= 0) {
          this.debarkerOutputLogs.splice(logIdx, 1);
        }
        const spawnIdx = this.debarkerOutputSpawnItems.findIndex((item) => item.mesh === log);
        if (spawnIdx >= 0) this.debarkerOutputSpawnItems.splice(spawnIdx, 1);
        log.dispose();
        this.debarkerOutputQueued = Math.max(0, this.debarkerOutputLogs.length);
        this.debarkerPickupCooldown = this.debarkerPickupInterval;
      }
    }

  }

  private getDebarkerFinishedGoodsPickupCandidate(): Mesh | null {
    const spawningMeshes = new Set(this.debarkerOutputSpawnItems.map((item) => item.mesh));
    const candidates = this.debarkerOutputLogs.filter((mesh) => !mesh.isDisposed() && mesh.isEnabled() && !spawningMeshes.has(mesh));
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => {
      const aPos = a.getAbsolutePosition();
      const bPos = b.getAbsolutePosition();
      if (Math.abs(bPos.y - aPos.y) > 0.0001) return bPos.y - aPos.y;
      if (Math.abs(aPos.x - bPos.x) > 0.0001) return aPos.x - bPos.x;
      return aPos.z - bPos.z;
    });
    return candidates[0] ?? null;
  }

  private updateDebarkerFeedFlights(deltaTime: number): void {
    for (let i = this.debarkerFeedFlights.length - 1; i >= 0; i -= 1) {
      const flight = this.debarkerFeedFlights[i];
      flight.t = Math.min(1, flight.t + deltaTime / flight.duration);
      const eased = flight.t * flight.t * (3 - 2 * flight.t);
      flight.mesh.position.copyFrom(Vector3.Lerp(flight.start, flight.target, eased));

      const tuning = this.getMachineAnimationTuning();
      flight.mesh.position.y += (1 - Math.pow(2 * flight.t - 1, 2)) * tuning.arcHeight;

      const spinAngle = tuning.spinTurns * Math.PI * 2 * flight.t;
      const scaleWave = tuning.scaleCycles <= 0 ? 0 : (1 - Math.cos(flight.t * Math.PI * 2 * tuning.scaleCycles)) * 0.5;
      const scaleMultiplier = 1 + (tuning.scale - 1) * scaleWave;

      // Assume base scaling is sawmillInputLogVisualScale
      flight.mesh.scaling.setAll(this.sawmillInputLogVisualScale * scaleMultiplier);
      flight.mesh.rotationQuaternion = null;
      flight.mesh.rotation.set(0, spinAngle, 0);

      if (flight.t < 1) continue;
      flight.mesh.scaling.setAll(this.sawmillInputLogVisualScale);
      flight.mesh.rotation.set(0, 0, 0);

      flight.mesh.dispose();
      this.debarkerFeedFlights.splice(i, 1);
      this.debarkerInputQueued += 1;

      // 播放削皮机工作动画
      const peelerWorkAnim = this.scene.getAnimationGroupByName('peeler_inst_0:work');
      if (peelerWorkAnim) {
        peelerWorkAnim.stop();
        peelerWorkAnim.play(false);
      }
    }
  }

  private updateDebarkerOutputFlights(deltaTime: number): void {
    const pathLen = Math.max(0.001, Vector3.Distance(this.debarkerOutputStart, this.debarkerOutputStop));

    for (let i = this.debarkerOutputFlights.length - 1; i >= 0; i -= 1) {
      const flight = this.debarkerOutputFlights[i];
      if (flight.phase === 'move') {
        flight.progress = Math.min(1, flight.progress + deltaTime * (flight.speed / pathLen));
        flight.mesh.position.copyFrom(Vector3.Lerp(flight.start, flight.target, flight.progress));
        if (flight.progress < 1) continue;

        flight.phase = 'shrink';
        flight.shrinkProgress = 0;
        flight.mesh.position.copyFrom(flight.target);
        continue;
      }

      flight.shrinkProgress = Math.min(1, flight.shrinkProgress + deltaTime / 0.12);
      const scale = 1 - flight.shrinkProgress;
      flight.mesh.scaling.copyFrom(flight.baseScaling.scale(scale));
      if (flight.shrinkProgress < 1) continue;

      flight.mesh.dispose();
      this.spawnDebarkerOutputLog();
      this.debarkerOutputFlights.splice(i, 1);
    }
  }

  private updateDebarkerOutputSpawnItems(deltaTime: number): void {
    for (let i = this.debarkerOutputSpawnItems.length - 1; i >= 0; i -= 1) {
      const item = this.debarkerOutputSpawnItems[i];
      item.progress = Math.min(1, item.progress + deltaTime / 0.14);
      const eased = 1 - Math.pow(1 - item.progress, 3);
      item.mesh.scaling.copyFrom(item.baseScaling.scale(eased));
      item.mesh.position.copyFrom(item.basePosition);
      item.mesh.position.y += Math.sin(item.progress * Math.PI) * 0.02;
      if (item.progress < 1) continue;

      item.mesh.scaling.copyFrom(item.baseScaling);
      item.mesh.position.copyFrom(item.basePosition);
      this.debarkerOutputSpawnItems.splice(i, 1);
    }
  }

  private spawnDebarkerFeedFlight(origin: Vector3): void {
    const mesh = this.createRawWoodMachineMesh(`debarker_feed_flight_${Date.now()}_${this.debarkerFeedFlights.length}`);

    const start = new Vector3(origin.x, Math.max(0.12, origin.y), origin.z);
    const target = this.debarkerOutputStart.clone();
    const distance = Vector3.Distance(start, target);
    const duration = Math.max(0.16, distance / this.debarkerFeedFlightSpeed);
    const arcHeight = Math.min(0.6, Math.max(0.24, distance * 0.24));
    mesh.position.copyFrom(start);

    this.debarkerFeedFlights.push({
      mesh,
      start,
      target,
      t: 0,
      duration,
      arcHeight,
    });
  }

  private spawnDebarkerOutputFlight(): void {
    const mesh = this.createRawWoodMachineMesh(`debarker_output_flight_${Date.now()}_${this.debarkerOutputFlights.length}`);
    mesh.position.copyFrom(this.debarkerOutputStart);

    playDebarkerChipsVFX(this.scene, new Vector3(this.debarkerOutputStart.x, this.debarkerOutputStart.y + 0.1, -1.51));
    playDebarkerSmokeVFX(this.scene, new Vector3(this.debarkerOutputStart.x, this.debarkerOutputStart.y + 0.1, -1.51));

    this.debarkerOutputFlights.push({
      mesh,
      start: this.debarkerOutputStart.clone(),
      target: this.debarkerOutputStop.clone(),
      progress: 0,
      speed: 2.7,
      phase: 'move',
      baseScaling: mesh.scaling.clone(),
      shrinkProgress: 0,
    });
  }

  private spawnDebarkerOutputLog(): void {
    const mesh = this.createDebarkerFinishedGoodsMesh(`debarker_output_log_${Date.now()}_${this.debarkerOutputLogs.length}`);
    const targetPos = this.getDebarkerOutputLogPosition(this.debarkerOutputLogs.length);
    const baseScaling = mesh.scaling.clone();
    mesh.position.copyFrom(targetPos);
    mesh.scaling.setAll(0.001);
    this.debarkerOutputLogs.push(mesh);
    this.debarkerOutputQueued = this.debarkerOutputLogs.length;
    this.debarkerOutputSpawnItems.push({
      mesh,
      baseScaling,
      basePosition: targetPos,
      progress: 0,
    });
  }

  private createDebarkerFinishedGoodsMesh(name: string): Mesh {
    if (!this.debarkerFinishedGoodsTemplateMesh) {
      this.initDebarkerFinishedGoodsTemplateFromSceneInstance();
    }

    const cloned = this.debarkerFinishedGoodsTemplateMesh?.clone(name);
    if (!cloned) {
      throw new Error('Missing raw_log template for debarker finished goods');
    }

    cloned.parent = null;
    cloned.setEnabled(true);
    cloned.isVisible = true;
    cloned.rotationQuaternion = null;
    cloned.rotation.set(0, Math.PI * 1.5, 0);
    cloned.scaling.scaleInPlace(this.debarkerFinishedGoodsVisualMultiplier);
    this.setPlanarShadowEnabled(cloned, false);
    for (const mesh of cloned.getChildMeshes(false)) {
      mesh.setEnabled(true);
      mesh.isVisible = true;
      this.setPlanarShadowEnabled(mesh as Mesh, false);
    }
    return cloned;
  }

  private initSawmillOutputBoardTemplateFromSceneInstance(): void {
    const sceneTemplateNode = this.scene.getTransformNodeById('starter_plank_yellow_1')
      ?? this.scene.getTransformNodeByName('starter_plank_yellow_1');
    const sceneTemplateRoot = sceneTemplateNode?.getChildMeshes(false)
      .find((mesh): mesh is Mesh => mesh instanceof Mesh && mesh.parent === sceneTemplateNode)
      ?? sceneTemplateNode?.getChildMeshes(false)
        .find((mesh): mesh is Mesh => mesh instanceof Mesh && mesh.getTotalVertices() > 0);
    if (!sceneTemplateRoot) {
      this.sawmillOutputBoardTemplateMesh = null;
      return;
    }

    const template = sceneTemplateRoot.clone('sawmill_output_board_template_root', null);
    if (!template) {
      this.sawmillOutputBoardTemplateMesh = null;
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
    this.sawmillOutputBoardTemplateMesh = template;
  }

  private createSawmillOutputBoardMesh(name: string): Mesh {
    if (!this.sawmillOutputBoardTemplateMesh) {
      this.initSawmillOutputBoardTemplateFromSceneInstance();
    }

    const cloned = this.sawmillOutputBoardTemplateMesh?.clone(name);
    if (!cloned) {
      throw new Error('Missing starter plank template for sawmill output');
    }

    cloned.parent = null;
    cloned.setEnabled(true);
    cloned.isVisible = true;
    for (const mesh of cloned.getChildMeshes(false)) {
      mesh.setEnabled(true);
      mesh.isVisible = true;
    }
    return cloned;
  }

  private createSawmillInputLogMesh(name: string): Mesh {
    const cloned = this.createDebarkerFinishedGoodsMesh(name);
    cloned.scaling.scaleInPlace(this.sawmillInputLogVisualScale);
    return cloned;
  }

  private relayoutSawmillInputLogs(): void {
    let playerIndex = 0;
    let conveyorIndex = 0;
    for (let i = 0; i < this.sawmillInputLogs.length; i += 1) {
      const mesh = this.sawmillInputLogs[i];
      if (!mesh || mesh.isDisposed()) continue;
      const source = this.sawmillInputSourceById.get(mesh.id) ?? 'player';
      if (source === 'conveyor') {
        mesh.position.copyFrom(this.getConveyorSawmillInputLogPosition(conveyorIndex));
        conveyorIndex += 1;
      } else {
        mesh.position.copyFrom(this.getSawmillInputLogPosition(playerIndex));
        playerIndex += 1;
      }
    }
  }

  private relayoutSawmillOutputBoards(): void {
    for (let i = 0; i < this.sawmillOutputBoards.length; i += 1) {
      const mesh = this.sawmillOutputBoards[i];
      if (!mesh || mesh.isDisposed()) continue;
      mesh.position.copyFrom(this.getSawmillOutputBoardPosition(i));
    }
  }

  private bindSawmillAnimationGroups(): void {
    this.sawmillAnimationGroups.length = 0;
    const machine = this.scene.getTransformNodeById('machine_2') ?? this.scene.getTransformNodeByName('machine_2');
    if (!machine) return;
    for (const group of this.scene.animationGroups) {
      const matchesMachine = group.targetedAnimations.some((targeted) => {
        let node: { parent?: unknown } | null = targeted.target as { parent?: unknown } | null;
        while (node) {
          if (node === machine) return true;
          node = (node.parent as { parent?: unknown } | null) ?? null;
        }
        return false;
      });
      if (matchesMachine) {
        group.stop();
        this.sawmillAnimationGroups.push(group);
      }
    }
  }

  private setSawmillAnimationActive(active: boolean, _process?: SawmillProcessItem): void {
    if (!active) {
      this.clearSawmillProcessAnimationObserver();
    }
    for (const group of this.sawmillAnimationGroups) {
      if (active) {
        group.speedRatio = this.getMachineAnimationTuning().speedRatio;
        group.stop();
        group.start(false);
      } else {
        group.stop();
      }
    }
  }

  private updateConveyorUnlock(deltaTime: number): void {
    if (this.conveyorUnlocked) return;
    if (!this.isConveyorInteractionUnlocked()) return;

    const remain = Math.max(0, this.conveyorUnlockCost - this.conveyorPaidAmount);
    if (remain <= 0) {
      this.conveyorReadyToComplete = true;
      if (this.conveyorPaymentPendingBills === 0) {
        this.completeConveyorUnlock();
      }
      return;
    }

    if (!this.isPlayerInConveyorUnlockZone()) return;

    this.conveyorPaymentCooldown = Math.max(0, this.conveyorPaymentCooldown - deltaTime);
    if (this.conveyorPaymentCooldown > 0) return;
    this.conveyorPaymentCooldown = this.gateUnlockPaymentInterval;

    const deposit = Math.min(this.rewardCashPerBill, remain);
    if (deposit <= 0) return;
    if (!this.economy.canAfford(deposit)) return;
    if (this.player.getCashCarryCount() <= 0) return;
    if (!this.economy.spendCash(deposit)) return;

    this.conveyorPaidAmount = Math.min(this.conveyorUnlockCost, this.conveyorPaidAmount + deposit);
    this.conveyorReadyToComplete = this.conveyorPaidAmount >= this.conveyorUnlockCost;
    this.beginConveyorCashDelivery(1);
    this.conveyorUnlockDecalBurstTime = 0.22;

    if (this.conveyorReadyToComplete && this.conveyorPaymentPendingBills === 0) {
      this.completeConveyorUnlock();
    }
  }

  private updateConveyorTransfer(deltaTime: number): void {
    this.updateConveyorItems(deltaTime);
    this.conveyorTransferCooldown = Math.max(0, this.conveyorTransferCooldown - deltaTime);
    if (!this.isConveyorActive()) return;
    if (this.debarkerOutputQueued <= 0) return;
    if (this.conveyorTransferCooldown > 0) return;

    const log = this.getDebarkerFinishedGoodsPickupCandidate();
    if (!log) return;

    const logIdx = this.debarkerOutputLogs.indexOf(log);
    if (logIdx >= 0) {
      this.debarkerOutputLogs.splice(logIdx, 1);
    }
    const spawnIdx = this.debarkerOutputSpawnItems.findIndex((item) => item.mesh === log);
    if (spawnIdx >= 0) this.debarkerOutputSpawnItems.splice(spawnIdx, 1);
    this.debarkerOutputQueued = Math.max(0, this.debarkerOutputLogs.length);

    this.spawnConveyorItem(log);
    this.conveyorTransferCooldown = this.conveyorTransferInterval;
  }

  private updateConveyorArrowAnimations(deltaTime: number): void {
    if (this.conveyorArrowMovementPaused) return;
    this.updateConveyorArrowRuntime(this.conveyorArrowRuntimes, deltaTime);
    this.updateConveyorArrowRuntime(this.sellConveyorArrowRuntimes, deltaTime);
  }

  private updateConveyorArrowRuntime(runtimes: ConveyorArrowRuntime[], deltaTime: number): void {
    for (const runtime of runtimes) {
      const pathLen = this.getConveyorPathLength(runtime.points);
      runtime.progress += deltaTime * (runtime.speed / pathLen);
      if (runtime.progress >= 1) {
        runtime.progress %= 1;
        runtime.mesh.setEnabled(false);
      }
      this.applyConveyorArrowPose(runtime);
      runtime.mesh.setEnabled(true);
    }
  }

  private updateSellConveyorUnlock(deltaTime: number): void {
    if (this.sellConveyorUnlocked) return;
    if (!this.isConveyorInteractionUnlocked()) return;

    const remain = Math.max(0, this.sellConveyorUnlockCost - this.sellConveyorPaidAmount);
    if (remain <= 0) {
      this.sellConveyorReadyToComplete = true;
      if (this.sellConveyorPaymentPendingBills === 0) {
        this.completeSellConveyorUnlock();
      }
      return;
    }

    if (!this.isPlayerInSellConveyorUnlockZone()) return;

    this.sellConveyorPaymentCooldown = Math.max(0, this.sellConveyorPaymentCooldown - deltaTime);
    if (this.sellConveyorPaymentCooldown > 0) return;
    this.sellConveyorPaymentCooldown = this.gateUnlockPaymentInterval;

    const deposit = Math.min(this.rewardCashPerBill, remain);
    if (deposit <= 0) return;
    if (!this.economy.canAfford(deposit)) return;
    if (this.player.getCashCarryCount() <= 0) return;
    if (!this.economy.spendCash(deposit)) return;

    this.sellConveyorPaidAmount = Math.min(this.sellConveyorUnlockCost, this.sellConveyorPaidAmount + deposit);
    this.sellConveyorReadyToComplete = this.sellConveyorPaidAmount >= this.sellConveyorUnlockCost;
    this.beginSellConveyorCashDelivery(1);
    this.sellConveyorUnlockDecalBurstTime = 0.22;

    if (this.sellConveyorReadyToComplete && this.sellConveyorPaymentPendingBills === 0) {
      this.completeSellConveyorUnlock();
    }
  }

  private updateToolUpgradeUnlock(deltaTime: number): void {
    if (this.toolUpgradeUnlocked) return;

    const remain = Math.max(0, this.toolUpgradeCost - this.toolUpgradePaidAmount);
    if (remain <= 0) {
      this.toolUpgradeReadyToComplete = true;
      if (this.toolUpgradePaymentPendingBills === 0) {
        this.completeToolUpgrade();
      }
      return;
    }

    if (!this.inRadius(this.player.position, this.toolUpgradeZone, this.toolUpgradeRadius)) return;

    this.toolUpgradePaymentCooldown = Math.max(0, this.toolUpgradePaymentCooldown - deltaTime);
    if (this.toolUpgradePaymentCooldown > 0) return;
    this.toolUpgradePaymentCooldown = this.gateUnlockPaymentInterval;

    const deposit = Math.min(this.rewardCashPerBill, remain);
    if (deposit <= 0) return;
    if (!this.economy.canAfford(deposit)) return;
    if (this.player.getCashCarryCount() <= 0) return;
    if (!this.economy.spendCash(deposit)) return;

    this.toolUpgradePaidAmount += deposit;
    this.toolUpgradePaidAmount = Math.min(this.toolUpgradeCost, this.toolUpgradePaidAmount);
    this.toolUpgradeReadyToComplete = this.toolUpgradePaidAmount >= this.toolUpgradeCost;
    this.beginToolUpgradeCashDelivery(1);
    this.toolUpgradeDecalBurstTime = 0.22;

    if (this.toolUpgradeReadyToComplete && this.toolUpgradePaymentPendingBills === 0) {
      this.completeToolUpgrade();
    }
  }

  private updateSellConveyorTransfer(deltaTime: number): void {
    this.updateSellConveyorItems(deltaTime);
    this.sellConveyorTransferCooldown = Math.max(0, this.sellConveyorTransferCooldown - deltaTime);
    if (!this.isSellConveyorActive()) return;
    if (this.sawmillOutputBoards.length <= 0) return;
    if (this.sellConveyorTransferCooldown > 0) return;

    const board = this.getSawmillOutputPickupCandidate();
    if (!board) return;

    const idx = this.sawmillOutputBoards.indexOf(board);
    if (idx >= 0) this.sawmillOutputBoards.splice(idx, 1);
    this.relayoutSawmillOutputBoards();
    this.spawnSellConveyorItem(board);
    this.sellConveyorTransferCooldown = this.sellConveyorTransferInterval;
  }

  private updateSellQueueStackVisual(): void {
    this.syncMachineBoardStack(
      this.sellQueueBoardMeshes,
      this.sellConveyorReadyToTruck,
      this.getCollectTableBoardStackCenter(),
      'sell_queue_stack_board',
      false,
      3,
      0.04,
    );
  }

  private updateCollectTableAutoTruckLoading(deltaTime: number): void {
    this.collectTableTruckFlightCooldown = Math.max(0, this.collectTableTruckFlightCooldown - deltaTime);
    const loadingTruck = this.loadingTruck;
    if (!loadingTruck || loadingTruck.state !== 'loading') return;
    if (this.sellConveyorReadyToTruck <= 0) return;
    if (this.collectTableTruckFlightCooldown > 0) return;

    const reserved = this.truckQueued + this.collectTableTruckFlights.length;
    const canLoad = Math.max(0, 4 - loadingTruck.load - reserved);
    if (canLoad <= 0) return;

    const stackIndex = Math.max(0, this.sellConveyorReadyToTruck - 1);
    const start = this.getSellQueueBoardStackPosition(stackIndex);
    this.sellConveyorReadyToTruck -= 1;
    this.spawnCollectTableTruckFlight(start, loadingTruck, loadingTruck.load + reserved + 1);
    this.collectTableTruckFlightCooldown = this.sellReleaseInterval;
  }

  private updateCollectTableTruckFlights(deltaTime: number): void {
    for (let i = this.collectTableTruckFlights.length - 1; i >= 0; i -= 1) {
      const flight = this.collectTableTruckFlights[i];
      flight.progress = Math.min(1, flight.progress + deltaTime / flight.duration);
      const eased = flight.progress * flight.progress * (3 - 2 * flight.progress);
      flight.mesh.position.copyFrom(Vector3.Lerp(flight.start, flight.target, eased));
      flight.mesh.position.y += (1 - Math.pow(2 * flight.progress - 1, 2)) * flight.arcHeight;
      flight.mesh.rotation.y = flight.startYaw + (flight.targetYaw - flight.startYaw) * eased;

      if (flight.progress < 1) continue;

      if (!flight.targetParent.isDisposed()) {
        flight.mesh.parent = flight.targetParent;
        flight.mesh.setAbsolutePosition(flight.target);
        const parentYaw = flight.targetParent.rotationQuaternion?.toEulerAngles().y ?? flight.targetParent.rotation.y;
        flight.mesh.rotationQuaternion = null;
        flight.mesh.rotation.set(0, flight.targetYaw - parentYaw, 0);
      } else {
        flight.mesh.position.copyFrom(flight.target);
        flight.mesh.rotationQuaternion = null;
        flight.mesh.rotation.set(0, flight.targetYaw, 0);
      }
      flight.mesh.scaling.setAll(flight.targetScale);
      this.collectTableTruckFlights.splice(i, 1);
      this.applyTruckDelivered(1);
    }
  }

  private spawnCollectTableTruckFlight(start: Vector3, loadingTruck: TruckRuntime, loadIndex: number): void {
    const placement = this.getTruckRedSquareBoardPlacement(loadIndex);
    const mesh = this.createSawmillOutputBoardMesh(`collect_table_truck_board_${Date.now()}_${this.collectTableTruckFlights.length}`);
    mesh.position.copyFrom(start);
    mesh.rotationQuaternion = null;
    mesh.rotation.y = Math.PI;

    const target = placement.position.clone();
    const distance = Vector3.Distance(start, target);
    this.collectTableTruckFlights.push({
      mesh,
      start: start.clone(),
      target,
      targetParent: loadingTruck.root,
      targetScale: placement.scale,
      progress: 0,
      duration: Math.max(0.18, distance / 6.2),
      arcHeight: Math.min(0.85, Math.max(0.28, distance * 0.22)),
      startYaw: Math.PI,
      targetYaw: placement.yaw,
    });
  }

  private updateSellConveyorItems(deltaTime: number): void {
    const points = this.getSellConveyorPathPoints();
    const pathLen = this.getConveyorPathLength(points);

    for (let i = this.sellConveyorItems.length - 1; i >= 0; i -= 1) {
      const item = this.sellConveyorItems[i];
      if (item.stage === 'sellArcToStack') {
        if (!item.start || !item.target || item.duration == null || item.arcHeight == null) continue;
        item.progress = Math.min(1, item.progress + deltaTime / item.duration);
        const eased = item.progress * item.progress * (3 - 2 * item.progress);
        item.mesh.position.copyFrom(Vector3.Lerp(item.start, item.target, eased));
        item.mesh.position.y += (1 - Math.pow(2 * item.progress - 1, 2)) * item.arcHeight;
        const startYaw = item.startYaw ?? item.mesh.rotation.y;
        const targetYaw = item.targetYaw ?? Math.PI;
        item.mesh.rotation.y = startYaw + ((targetYaw + Math.PI * 2) - startYaw) * eased;

        if (item.progress < 1) continue;

        item.mesh.dispose();
        this.sellConveyorItems.splice(i, 1);
        this.sellConveyorReadyToTruck += 1;
        continue;
      }

      item.progress = Math.min(1, item.progress + deltaTime * (item.speed / pathLen));
      const pose = this.sampleConveyorPath(points, item.progress);
      item.mesh.position.copyFrom(pose.position);
      item.mesh.rotation.y = Math.atan2(pose.direction.x, pose.direction.z);

      if (item.progress < 1) continue;

      const target = this.getSellQueueBoardStackPosition(this.sellConveyorReadyToTruck);
      item.stage = 'sellArcToStack';
      item.start = item.mesh.position.clone();
      item.target = target;
      item.progress = 0;
      item.duration = Math.max(0.2, Vector3.Distance(item.start, target) / (item.speed * 1.15));
      item.arcHeight = Math.min(0.65, Math.max(0.24, Vector3.Distance(item.start, target) * 0.22));
      item.startYaw = item.mesh.rotation.y;
      item.targetYaw = Math.PI;
    }
  }

  private spawnSellConveyorItem(mesh: Mesh): void {
    const points = this.getSellConveyorPathPoints();
    const nearestArrow = this.getNearestSellConveyorArrowRuntime(mesh.position);
    const progress = this.getConveyorPathProgressAtPosition(nearestArrow?.mesh.position ?? mesh.position, points);
    const pose = this.sampleConveyorPath(points, progress);
    mesh.parent = null;
    mesh.setEnabled(true);
    mesh.isVisible = true;
    mesh.position.copyFrom(nearestArrow?.mesh.position ?? pose.position);
    mesh.rotationQuaternion = null;
    mesh.rotation.y = Math.atan2(pose.direction.x, pose.direction.z);

    this.sellConveyorItems.push({
      mesh,
      stage: 'sellBelt',
      progress,
      speed: this.sellConveyorFlightSpeed,
    });
  }

  private getSellConveyorPathPoints(): Vector3[] {
    const arrowPath = this.getSellConveyorArrowPath();
    return [
      arrowPath[0].clone(),
      arrowPath[1].clone(),
    ];
  }

  private updateConveyorItems(deltaTime: number): void {
    for (let i = this.conveyorItems.length - 1; i >= 0; i -= 1) {
      const item = this.conveyorItems[i];
      if (!item.stage || !item.start || !item.target || item.duration == null || item.arcHeight == null) continue;
      item.progress = Math.min(1, item.progress + deltaTime / item.duration);

      if (item.stage === 'slideToEntry') {
        item.mesh.position.copyFrom(Vector3.Lerp(item.start, item.target, item.progress));
      } else {
        const eased = item.progress * item.progress * (3 - 2 * item.progress);
        item.mesh.position.copyFrom(Vector3.Lerp(item.start, item.target, eased));
        item.mesh.position.y += (1 - Math.pow(2 * item.progress - 1, 2)) * item.arcHeight;
      }

      const direction = item.target.subtract(item.start);
      direction.y = 0;
      if (direction.lengthSquared() > 0.0001) {
        item.mesh.rotation.y = Math.atan2(direction.x, direction.z);
      }

      if (item.progress < 1) continue;

      if (item.stage === 'arcToPickup') {
        item.stage = 'slideToEntry';
        item.start = this.conveyorPickupPoint.clone();
        item.target = this.conveyorSlideEndPoint.clone();
        item.progress = 0;
        item.duration = Math.max(0.12, Vector3.Distance(item.start, item.target) / (item.speed * 1.2));
        item.arcHeight = 0;
        item.mesh.position.copyFrom(item.start);
        continue;
      }

      if (item.stage === 'slideToEntry') {
        item.stage = 'arcToStack';
        item.start = this.conveyorSlideEndPoint.clone();
        item.mesh.scaling.scaleInPlace(this.sawmillInputLogVisualScale);
        item.mesh.rotationQuaternion = null;
        item.mesh.rotation.set(0, Math.PI * 1.5, 0);
        item.target = this.getPendingSawmillInputLogPosition('conveyor', item);
        item.progress = 0;
        const distance = Vector3.Distance(item.start, item.target);
        item.duration = Math.max(0.14, distance / (item.speed * 1.15));
        item.arcHeight = Math.min(0.55, Math.max(0.22, distance * 0.2));
        item.mesh.position.copyFrom(item.start);
        continue;
      }

      this.sawmillInputSourceById.set(item.mesh.id, 'conveyor');
      item.mesh.rotationQuaternion = null;
      item.mesh.rotation.set(0, Math.PI * 1.5, 0);
      this.sawmillInputLogs.push(item.mesh);
      this.relayoutSawmillInputLogs();
      this.conveyorItems.splice(i, 1);
    }
  }

  private spawnConveyorItem(mesh: Mesh): void {
    const start = mesh.getAbsolutePosition().clone();
    const target = this.conveyorPickupPoint.clone();
    const distance = Vector3.Distance(start, target);
    this.conveyorItems.push({
      mesh,
      stage: 'arcToPickup',
      start,
      target,
      progress: 0,
      speed: this.conveyorFlightSpeed,
      duration: Math.max(0.14, distance / this.conveyorFlightSpeed),
      arcHeight: Math.min(0.6, Math.max(0.22, distance * 0.22)),
    });
  }

  private getConveyorPathLength(points: Vector3[]): number {
    let len = 0;
    for (let i = 0; i < points.length - 1; i += 1) {
      len += Vector3.Distance(points[i], points[i + 1]);
    }
    return Math.max(0.001, len);
  }

  private sampleConveyorPath(points: Vector3[], t: number): { position: Vector3; direction: Vector3 } {
    const total = this.getConveyorPathLength(points);
    const targetDist = Math.max(0, Math.min(1, t)) * total;
    let walked = 0;

    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      const seg = b.subtract(a);
      const segLen = seg.length();
      if (segLen <= 0.0001) continue;
      if (walked + segLen >= targetDist || i === points.length - 2) {
        const localT = Math.max(0, Math.min(1, (targetDist - walked) / segLen));
        return {
          position: Vector3.Lerp(a, b, localT),
          direction: seg.normalize(),
        };
      }
      walked += segLen;
    }

    const last = points[points.length - 1].clone();
    const fallbackDir = points[points.length - 1].subtract(points[points.length - 2]).normalize();
    return { position: last, direction: fallbackDir };
  }

  private isConveyorActive(): boolean {
    return this.conveyorUnlocked && (this.conveyorPaidAmount ?? 0) >= this.conveyorUnlockCost;
  }

  private isConveyorInteractionUnlocked(): boolean {
    return this.toolUpgradeUnlocked || this.player.isLv2TruckMode();
  }

  private isConveyorGroundDecalEnabled(): boolean {
    return this.conveyorGroundDecalsVisible;
  }

  private isSellConveyorActive(): boolean {
    return this.sellConveyorUnlocked && (this.sellConveyorPaidAmount ?? 0) >= this.sellConveyorUnlockCost;
  }

  private updateSawmillLogic(deltaTime: number): void {
    this.updateSawmillFeedFlights(deltaTime);
    if (this.sawmillPaused) {
      this.setSawmillAnimationActive(false);
    } else {
      this.updateSawmillProcess(deltaTime);
    }
    this.sawmillFeedCooldown = Math.max(0, this.sawmillFeedCooldown - deltaTime);
    this.sawmillPickupCooldown = Math.max(0, this.sawmillPickupCooldown - deltaTime);

    const playerPos = this.player.position;
    if (this.inRect(playerPos, this.sawmillTriggerCenter, this.sawmillTriggerHalfWidth, this.sawmillTriggerHalfDepth) && this.sawmillFeedCooldown <= 0) {
      const debarkedOrigin = this.player.popDebarkedWoodForMachine();
      if (debarkedOrigin) {
        this.spawnSawmillFeedFlight(debarkedOrigin);
        this.sawmillFeedCooldown = this.sawmillFeedInterval;
      }
    }

    if (
      !this.isSellConveyorActive()
      &&
      this.inRadius(playerPos, this.sawmillOutputPickupCenter, this.sawmillRadius)
      && this.sawmillOutputBoards.length > 0
      && this.sawmillPickupCooldown <= 0
    ) {
      const board = this.getSawmillOutputPickupCandidate();
      if (board && this.player.requestPickupBoardsFromMeshes([board]) > 0) {
        const idx = this.sawmillOutputBoards.indexOf(board);
        if (idx >= 0) this.sawmillOutputBoards.splice(idx, 1);
        board.dispose();
        this.relayoutSawmillOutputBoards();
        this.sawmillPickupCooldown = this.sawmillPickupInterval;
      }
    }

  }

  private updateSawmillFeedFlights(deltaTime: number): void {
    for (let i = this.sawmillFeedFlights.length - 1; i >= 0; i -= 1) {
      const flight = this.sawmillFeedFlights[i];
      flight.t = Math.min(1, flight.t + deltaTime / flight.duration);
      const eased = flight.t * flight.t * (3 - 2 * flight.t);
      flight.mesh.position.copyFrom(Vector3.Lerp(flight.start, flight.target, eased));
      flight.mesh.position.y += (1 - Math.pow(2 * flight.t - 1, 2)) * flight.arcHeight;

      if (flight.t < 1) continue;

      this.sawmillInputSourceById.set(flight.mesh.id, 'player');
      this.sawmillInputLogs.push(flight.mesh);
      this.relayoutSawmillInputLogs();
      this.sawmillFeedFlights.splice(i, 1);
    }
  }

  private updateSawmillProcess(deltaTime: number): void {
    if (!this.sawmillActiveProcess && this.sawmillInputLogs.length > 0) {
      this.beginNextSawmillProcess();
    }

    const process = this.sawmillActiveProcess;
    if (!process) {
      if (this.sawmillInputLogs.length === 0 && this.sawmillFeedFlights.length === 0) {
        this.setSawmillAnimationActive(false);
      }
      return;
    }

    if (process.stage === 'rawHold') {
      process.progress = Math.min(1, process.progress + deltaTime / process.duration);
      if (process.progress < 1) return;
      this.replaceSawmillProcessLogWithBoard();
      return;
    }

    process.progress = Math.min(1, process.progress + deltaTime / process.duration);
    const eased = process.progress * process.progress * (3 - 2 * process.progress);
    process.mesh.position.copyFrom(Vector3.Lerp(process.start, process.target, eased));
    if (process.stage === 'boardArc') {
      process.mesh.position.y += (1 - Math.pow(2 * process.progress - 1, 2)) * process.arcHeight;
    }

    if (process.progress < 1) return;

    if (process.stage === 'toMachine') {
      process.mesh.position.copyFrom(this.sawmillMachineLogPoint);
      process.mesh.position.y += this.sawmillCompressionYOffset;
      process.mesh.rotationQuaternion = null;
      process.mesh.rotation.set(0, Math.PI * 0.5, 0);
      this.setSawmillAnimationActive(true, process);
      process.stage = 'rawHold';
      process.start = this.sawmillMachineLogPoint.clone();
      process.start.y += this.sawmillCompressionYOffset;
      process.target = this.sawmillMachineLogPoint.clone();
      process.target.y += this.sawmillCompressionYOffset;
      process.progress = 0;
      process.duration = this.sawmillCompressionHoldDuration;
      process.arcHeight = 0;
      return;
    }

    if (process.stage === 'boardMove') {
      process.stage = 'boardArc';
      process.start = this.sawmillMachineBoardExitPoint.clone();
      process.target = this.getSawmillOutputBoardPosition(this.sawmillOutputBoards.length);
      process.progress = 0;
      const distance = Vector3.Distance(process.start, process.target);
      process.duration = Math.max(0.3, distance / this.sawmillBoardArcSpeed);
      process.arcHeight = Math.min(0.65, Math.max(0.26, distance * 0.24));
      return;
    }

    if (process.stage === 'boardArc') {
      this.finishSawmillBoardArc();
    }
  }

  private beginNextSawmillProcess(): void {
    this.clearSawmillProcessAnimationObserver();
    const inputLog = this.getSawmillInputProcessCandidate();
    if (!inputLog) return;

    const idx = this.sawmillInputLogs.indexOf(inputLog);
    if (idx >= 0) this.sawmillInputLogs.splice(idx, 1);
    this.sawmillInputSourceById.delete(inputLog.id);
    this.relayoutSawmillInputLogs();

    const start = inputLog.getAbsolutePosition().clone();
    inputLog.parent = null;
    inputLog.rotationQuaternion = null;
    inputLog.rotation.set(0, Math.PI, 0);
    this.sawmillActiveProcess = {
      mesh: inputLog,
      stage: 'toMachine',
      start,
      target: this.sawmillMachineLogPoint.add(new Vector3(0, this.sawmillCompressionYOffset, 0)),
      progress: 0,
      duration: Math.max(0.22, Vector3.Distance(start, this.sawmillMachineLogPoint) / this.sawmillProcessInSpeed),
      arcHeight: 0,
    };
  }

  private replaceSawmillProcessLogWithBoard(): void {
    const process = this.sawmillActiveProcess;
    if (!process) return;

    this.clearSawmillProcessAnimationObserver();
    const log = process.mesh;
    const pos = log.getAbsolutePosition().clone();
    log.dispose();

    const board = this.createSawmillOutputBoardMesh(`sawmill_process_board_${Date.now()}`);
    board.position.copyFrom(pos);
    board.rotationQuaternion = null;
    // Keep the board longitudinal while it travels through the compressor.
    board.rotation.set(0, Math.PI * 0.5, 0);

    process.mesh = board;
    process.stage = 'boardMove';
    process.start = pos;
    process.target = this.sawmillMachineBoardExitPoint.clone();
    process.progress = 0;
    process.duration = Math.max(0.24, Vector3.Distance(process.start, process.target) / this.sawmillBoardMoveSpeed);
    process.arcHeight = 0;
  }

  private finishSawmillBoardArc(): void {
    const process = this.sawmillActiveProcess;
    if (!process) return;

    this.clearSawmillProcessAnimationObserver();
    process.mesh.dispose();
    const stackedBoard = this.createSawmillOutputBoardMesh(`sawmill_output_board_${Date.now()}_${this.sawmillOutputBoards.length}`);
    this.sawmillOutputBoards.push(stackedBoard);
    this.relayoutSawmillOutputBoards();
    this.sawmillActiveProcess = null;

    if (this.sawmillInputLogs.length === 0) {
      this.setSawmillAnimationActive(false);
    }
  }

  private clearSawmillProcessAnimationObserver(): void {
    const process = this.sawmillActiveProcess;
    process?.animationEndObserver?.remove();
    if (process) process.animationEndObserver = undefined;
  }

  private getSawmillInputProcessCandidate(): Mesh | null {
    const candidates = this.sawmillInputLogs.filter((mesh) => !mesh.isDisposed() && mesh.isEnabled());
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => {
      const aPos = a.getAbsolutePosition();
      const bPos = b.getAbsolutePosition();
      if (Math.abs(bPos.y - aPos.y) > 0.0001) return bPos.y - aPos.y;
      return Vector3.DistanceSquared(aPos, this.sawmillMachineLogPoint) - Vector3.DistanceSquared(bPos, this.sawmillMachineLogPoint);
    });
    return candidates[0] ?? null;
  }

  private getSawmillOutputPickupCandidate(): Mesh | null {
    const candidates = this.sawmillOutputBoards.filter((mesh) => !mesh.isDisposed() && mesh.isEnabled());
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => {
      const aPos = a.getAbsolutePosition();
      const bPos = b.getAbsolutePosition();
      if (Math.abs(bPos.y - aPos.y) > 0.0001) return bPos.y - aPos.y;
      if (Math.abs(aPos.z - bPos.z) > 0.0001) return aPos.z - bPos.z;
      return aPos.x - bPos.x;
    });
    return candidates[0] ?? null;
  }

  private spawnSawmillFeedFlight(origin: Vector3): void {
    const mesh = this.createSawmillInputLogMesh(`sawmill_feed_flight_${Date.now()}_${this.sawmillFeedFlights.length}`);

    const start = new Vector3(origin.x, Math.max(0.12, origin.y), origin.z);
    const target = this.getPendingSawmillInputLogPosition('player');
    const distance = Vector3.Distance(start, target);
    const duration = this.getMachineAnimationTuning().duration;
    const arcHeight = Math.min(0.6, Math.max(0.24, distance * 0.24));
    mesh.position.copyFrom(start);

    this.sawmillFeedFlights.push({
      mesh,
      start,
      target,
      t: 0,
      duration,
      arcHeight,
    });
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

    const template = sceneTemplateRoot.clone('debarker_raw_wood_template_root', null);
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
    template.scaling.copyFrom(absoluteScale).scaleInPlace(this.debarkerRawWoodMachineScale);
    template.position.set(0, -999, 0);
    template.setEnabled(false);
    template.isVisible = false;
    for (const mesh of template.getChildMeshes(false)) {
      mesh.setEnabled(false);
      mesh.isVisible = false;
    }

    this.rawWoodTemplateMesh = template;
  }

  private initDebarkerFinishedGoodsTemplateFromSceneInstance(): void {
    const sceneTemplateNode = this.scene.getTransformNodeById('raw_log_template')
      ?? this.scene.getTransformNodeByName('raw_log_template');
    const sceneTemplateRoot = sceneTemplateNode?.getChildMeshes(false)
      .find((mesh): mesh is Mesh => mesh instanceof Mesh && mesh.parent === sceneTemplateNode)
      ?? sceneTemplateNode?.getChildMeshes(false)
        .find((mesh): mesh is Mesh => mesh instanceof Mesh && mesh.getTotalVertices() > 0);
    if (!sceneTemplateRoot) {
      this.debarkerFinishedGoodsTemplateMesh = null;
      return;
    }

    const template = sceneTemplateRoot.clone('debarker_finished_goods_template_root', null);
    if (!template) {
      this.debarkerFinishedGoodsTemplateMesh = null;
      return;
    }

    const absoluteScale = new Vector3();
    const absoluteRotation = Quaternion.Identity();
    const absolutePosition = new Vector3();
    sceneTemplateRoot.computeWorldMatrix(true).decompose(absoluteScale, absoluteRotation, absolutePosition);

    template.parent = null;
    template.rotationQuaternion = absoluteRotation.clone();
    template.rotation.setAll(0);
    template.scaling.copyFrom(absoluteScale).scaleInPlace(this.debarkerFinishedGoodsScale);
    this.applyCashRelativeDebarkerFinishedGoodsScale(template);
    template.position.set(0, -999, 0);
    template.setEnabled(false);
    template.isVisible = false;
    for (const mesh of template.getChildMeshes(false)) {
      mesh.setEnabled(false);
      mesh.isVisible = false;
    }

    this.debarkerFinishedGoodsTemplateMesh = template;
  }

  private createRawWoodMachineMesh(name: string): Mesh {
    if (!this.rawWoodTemplateMesh) {
      this.initRawWoodTemplateFromSceneInstance();
    }

    const cloned = this.rawWoodTemplateMesh?.clone(name);
    if (!cloned) {
      const fallback = MeshBuilder.CreateCylinder(name, {
        height: 0.62,
        diameter: 0.18,
        tessellation: 10,
      }, this.scene);
      fallback.rotation.set(0, Math.PI, 0);
      this.setPlanarShadowEnabled(fallback, false);
      return fallback;
    }

    cloned.parent = null;
    cloned.setEnabled(true);
    cloned.isVisible = true;
    cloned.rotationQuaternion = null;
    cloned.rotation.set(0, Math.PI, 0);
    this.setPlanarShadowEnabled(cloned, false);
    for (const mesh of cloned.getChildMeshes(false)) {
      mesh.setEnabled(true);
      mesh.isVisible = true;
      this.setPlanarShadowEnabled(mesh as Mesh, false);
    }
    return cloned;
  }

  private setPlanarShadowEnabled(mesh: Mesh, enabled: boolean): void {
    const metadata = {
      ...(mesh.metadata ?? {}),
      disablePlanarProjectionShadow: !enabled,
      disableRuntimeShadowCaster: !enabled,
    } as any;

    if (!enabled) {
      if (metadata.runtimePreviousRenderOutline === undefined) {
        metadata.runtimePreviousRenderOutline = (mesh as any).renderOutline;
      }
      (mesh as any).renderOutline = false;
    } else {
      if (typeof metadata.runtimePreviousRenderOutline === 'boolean') {
        (mesh as any).renderOutline = metadata.runtimePreviousRenderOutline;
      }
      delete metadata.runtimePreviousRenderOutline;
    }

    mesh.metadata = metadata;
    this.applyRuntimeShadowCasterEnabled(mesh, enabled);
    if (!enabled) this.hidePlanarProjectionShadowsForSource(mesh);
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

  private getDebarkerOutputLogPosition(index: number): Vector3 {
    const perLayer = 4;
    const slot = index % perLayer;
    const layer = Math.floor(index / perLayer);
    const dims = this.getDebarkerFinishedGoodsLogDimensions();
    const gap = 0.002;
    const rowWidth = perLayer * dims.width + (perLayer - 1) * gap;
    const x = this.debarkerOutputLogStackCenter.x - rowWidth * 0.5 + dims.width * 0.5 + slot * (dims.width + gap);
    const y = 0.5 + layer * (dims.height + 0.004);
    const z = this.debarkerOutputLogStackCenter.z;
    return new Vector3(x, y, z);
  }

  private getDebarkerFinishedGoodsLogDimensions(): { width: number; height: number; depth: number } {
    return { width: 0.218, height: 0.218, depth: 0.69 };
  }

  private getSawmillInputLogPosition(index: number): Vector3 {
    const perLayer = 5;
    const slot = index % perLayer;
    const layer = Math.floor(index / perLayer);
    const dims = this.getSawmillInputLogDimensions();
    const gap = 0.002;
    const squareCenterX = this.sawmillInputLogStackCenter.x;
    const squareCenterZ = this.sawmillInputLogStackCenter.z;
    const rowWidth = perLayer * dims.width + (perLayer - 1) * gap;
    const x = squareCenterX - rowWidth * 0.5 + dims.width * 0.5 + slot * (dims.width + gap);
    const y = 0.5 + layer * (dims.height + 0.004);
    const z = squareCenterZ;
    return new Vector3(x, y, z);
  }

  private getConveyorSawmillInputLogPosition(index: number): Vector3 {
    const perLayer = 5;
    const slot = index % perLayer;
    const layer = Math.floor(index / perLayer);
    const dims = this.getSawmillInputLogDimensions();
    const gap = 0.002;
    const squareCenterX = this.sawmillInputLogStackCenter.x;
    const squareCenterZ = this.sawmillInputLogStackCenter.z;
    const rowWidth = perLayer * dims.width + (perLayer - 1) * gap;
    const x = squareCenterX - rowWidth * 0.5 + dims.width * 0.5 + slot * (dims.width + gap);
    const y = 0.5 + layer * (dims.height + 0.004);
    const z = squareCenterZ;
    return new Vector3(x, y, z);
  }

  private getPendingSawmillInputLogPosition(source: SawmillInputSource, excludeItem?: ConveyorTransferItem): Vector3 {
    let existingCount = 0;
    for (const mesh of this.sawmillInputLogs) {
      if (!mesh || mesh.isDisposed()) continue;
      if ((this.sawmillInputSourceById.get(mesh.id) ?? 'player') === source) {
        existingCount += 1;
      }
    }

    const pendingPlayerFlights = source === 'player' ? this.sawmillFeedFlights.length : 0;
    const pendingConveyorItems = source === 'conveyor'
      ? this.conveyorItems.filter(
        (item) => item !== excludeItem && (item.stage === 'slideToEntry' || item.stage === 'arcToStack'),
      ).length
      : 0;
    const index = existingCount + pendingPlayerFlights + pendingConveyorItems;
    return source === 'conveyor'
      ? this.getConveyorSawmillInputLogPosition(index)
      : this.getSawmillInputLogPosition(index);
  }

  private getSawmillInputLogDimensions(): { width: number; height: number; depth: number } {
    const base = this.getDebarkerFinishedGoodsLogDimensions();
    return {
      width: base.width * this.sawmillInputLogVisualScale,
      height: base.height * this.sawmillInputLogVisualScale,
      depth: base.depth * this.sawmillInputLogVisualScale,
    };
  }

  private getSawmillOutputBoardPosition(index: number): Vector3 {
    const boardsPerLayer = 3;
    const layer = Math.floor(index / boardsPerLayer);
    const inLayer = index % boardsPerLayer;
    const zSpacing = 0.3;
    const ySpacing = 0.1;
    return new Vector3(
      this.sawmillOutputBoardStackAnchor.x,
      this.sawmillOutputBoardStackAnchor.y + layer * ySpacing,
      this.sawmillOutputBoardStackAnchor.z + inLayer * zSpacing,
    );
  }

  private createArrow(): void {
    this.arrowRoot?.dispose();
    this.arrowRoot = null;
    this.guideArrowMainMesh = null;
    this.guideArrowTrailMeshes.length = 0;

    const root = new TransformNode('guide_arrow_root', this.scene);
    root.setEnabled(false);

    const texture = this.createGuideArrowTexture();

    const material = new StandardMaterial('guide_arrow_mat', this.scene);
    material.diffuseTexture = texture;
    material.opacityTexture = texture;
    material.emissiveTexture = texture;
    material.useAlphaFromDiffuseTexture = true;
    material.diffuseColor = new Color3(0.18, 0.92, 1);
    material.emissiveColor = new Color3(0.18, 0.92, 1);
    material.disableLighting = true;
    material.backFaceCulling = false;
    material.transparencyMode = Material.MATERIAL_ALPHABLEND;

    const mainArrow = MeshBuilder.CreatePlane('guide_arrow_main', { width: 1.2, height: 1.2 }, this.scene);
    mainArrow.parent = root;
    mainArrow.material = material;
    mainArrow.billboardMode = Mesh.BILLBOARDMODE_ALL;
    mainArrow.isPickable = false;
    mainArrow.renderingGroupId = 2;
    mainArrow.position.set(0, 1.9, -0.12);
    this.guideArrowMainMesh = mainArrow;

    for (let i = 0; i < this.guideArrowTrailCount; i += 1) {
      const trail = MeshBuilder.CreatePlane(`guide_arrow_trail_${i}`, { width: 0.52, height: 0.52 }, this.scene);
      trail.parent = root;
      trail.material = material;
      trail.billboardMode = Mesh.BILLBOARDMODE_ALL;
      trail.isPickable = false;
      trail.renderingGroupId = 2;
      trail.position.set(0, this.guideArrowTrailLift, -0.04);
      this.guideArrowTrailMeshes.push(trail);
    }

    this.arrowRoot = root;
  }

  private createGuideArrowTexture(): DynamicTexture {
    const texture = new DynamicTexture('guide_arrow_dynamic_tex', { width: 256, height: 256 }, this.scene, true);
    const ctx = texture.getContext();
    ctx.clearRect(0, 0, 256, 256);
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, 256, 256);

    ctx.save();
    ctx.translate(128, 128);
    ctx.beginPath();
    ctx.moveTo(0, 110);
    ctx.lineTo(78, 24);
    ctx.lineTo(34, 24);
    ctx.lineTo(34, -92);
    ctx.lineTo(-34, -92);
    ctx.lineTo(-34, 24);
    ctx.lineTo(-78, 24);
    ctx.closePath();
    ctx.fillStyle = '#26d9ff';
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#0a82c7';
    ctx.stroke();
    ctx.restore();

    texture.hasAlpha = true;
    texture.update();
    return texture;
  }

  private updateArrow(): void {
    if (!this.arrowRoot) {
      this.createArrow();
    }
    if (!this.arrowRoot || !this.guideArrowMainMesh) return;

    const target = this.resolveCurrentGuideTarget();
    if (!target) {
      this.arrowRoot.setEnabled(false);
      return;
    }

    this.arrowRoot.setEnabled(true);

    const bob = Math.sin(this.arrowPulse * 4.5) * 0.08;
    const mainScale = 1 + Math.sin(this.arrowPulse * 5.2) * 0.06;
    this.guideArrowMainMesh.position.set(target.x, 1.9 + bob, target.z - 0.12);
    this.guideArrowMainMesh.scaling.setAll(mainScale);

    const from = this.player.position.clone();
    const to = target.clone();
    const direction = to.subtract(from);
    direction.y = 0;
    const distance = direction.length();
    if (distance < 0.001) {
      this.guideArrowTrailMeshes.forEach((mesh) => mesh.setEnabled(false));
      return;
    }

    direction.scaleInPlace(1 / distance);
    const start = from.add(direction.scale(0.65));
    const end = to.subtract(direction.scale(0.5));

    for (let i = 0; i < this.guideArrowTrailMeshes.length; i += 1) {
      const mesh = this.guideArrowTrailMeshes[i]!;
      const baseT = (i + 1) / (this.guideArrowTrailMeshes.length + 1);
      const flow = (this.arrowPulse * 0.38 + i * 0.12) % 1;
      const t = Math.min(0.96, Math.max(0.04, baseT + flow * 0.08 - 0.04));
      const pos = Vector3.Lerp(start, end, t);
      const lift = this.guideArrowTrailLift + Math.sin(this.arrowPulse * 5 + i * 0.75) * 0.03;
      mesh.position.set(pos.x, lift, pos.z);
      const scale = 0.86 - i * 0.07;
      mesh.scaling.setAll(Math.max(0.28, scale));
      mesh.visibility = 0.9 - i * 0.12;
      mesh.setEnabled(true);
    }
  }

  private resolveCurrentGuideTarget(): Vector3 | null {
    if (this.step === 'unlock_forest' && !this.gateUnlocked) {
      return this.isPlayerInGateUnlockZone() ? null : this.gateUnlockZoneCenter.clone();
    }

    if (this.player.getFinalWoodCarryCount() > 0) {
      return this.inRadius(this.player.position, this.sellZone, this.sellZoneRadius) ? null : this.sellZone.clone();
    }

    if (this.player.getProcessedWoodCarryCount() > 0) {
      return this.inRect(
        this.player.position,
        this.sawmillTriggerCenter,
        this.sawmillTriggerHalfWidth,
        this.sawmillTriggerHalfDepth,
      ) ? null : this.sawmillTriggerCenter.clone();
    }

    if (this.player.getRawWoodCarryCount() > 0) {
      return this.inRect(
        this.player.position,
        this.debarkerTriggerCenter,
        this.debarkerTriggerHalfWidth,
        this.debarkerTriggerHalfDepth,
      ) ? null : this.debarkerTriggerCenter.clone();
    }

    if (!this.isSellConveyorActive() && this.sawmillOutputBoards.length > 0) {
      return this.inRadius(this.player.position, this.sawmillOutputPickupCenter, this.sawmillRadius)
        ? null
        : this.sawmillOutputPickupCenter.clone();
    }

    if (!this.isConveyorActive() && this.debarkerOutputLogs.length > 0) {
      return this.inRect(
        this.player.position,
        this.debarkerFinishedGoodsPickupCenter,
        this.debarkerFinishedGoodsPickupHalfWidth,
        this.debarkerFinishedGoodsPickupHalfDepth,
      ) ? null : this.debarkerFinishedGoodsPickupCenter.clone();
    }

    if (this.starterBoardsAvailable && this.step === 'collect_boards') {
      return this.inRadius(this.player.position, this.starterBoardZone, this.starterBoardPickupRadius)
        ? null
        : this.starterBoardZone.clone();
    }

    return null;
  }

  private resolveSceneAnchor(nodeId: string, fallback: Vector3, y = fallback.y): Vector3 {
    const node = this.scene.getTransformNodeById(nodeId) ?? this.scene.getTransformNodeByName(nodeId);
    const pos = node?.getAbsolutePosition();
    if (!pos) return fallback;
    return new Vector3(pos.x, y, pos.z);
  }

  private resolveGroundOverlayCenter(meshId: string, fallback: Vector3, y = fallback.y): Vector3 {
    const mesh = this.scene.getMeshById(meshId) ?? this.scene.getMeshByName(meshId);
    const pos = mesh?.getAbsolutePosition();
    if (pos) return new Vector3(pos.x, y, pos.z);

    const overlay = configService.getGroundOverlayPlanes().find((plane) => plane.id === meshId);
    if (!overlay) return fallback;
    return new Vector3(overlay.position.x, y, overlay.position.z);
  }

  private resolveRectAreaFromMesh(
    meshId: string,
    fallbackCenter: Vector3,
    fallbackHalfWidth: number,
    fallbackHalfDepth: number,
  ): { center: Vector3; halfWidth: number; halfDepth: number } {
    const mesh = this.scene.getMeshById(meshId) ?? this.scene.getMeshByName(meshId);
    if (!mesh) {
      return {
        center: fallbackCenter,
        halfWidth: fallbackHalfWidth,
        halfDepth: fallbackHalfDepth,
      };
    }

    const pos = mesh.getAbsolutePosition();
    const bbox = mesh.getBoundingInfo().boundingBox;
    return {
      center: new Vector3(pos.x, fallbackCenter.y, pos.z),
      halfWidth: Math.max(fallbackHalfWidth, (bbox.maximumWorld.x - bbox.minimumWorld.x) * 0.5),
      halfDepth: Math.max(fallbackHalfDepth, (bbox.maximumWorld.z - bbox.minimumWorld.z) * 0.5),
    };
  }

  private isPlayerInGateUnlockZone(): boolean {
    return this.inRect(
      this.player.position,
      this.gateUnlockZoneCenter,
      this.gateUnlockZoneHalfWidth,
      this.gateUnlockZoneHalfDepth,
    );
  }

  private isPlayerInExpansionUnlockZone(): boolean {
    return this.inRect(
      this.player.position,
      this.expansionUnlockZoneCenter,
      this.expansionUnlockZoneHalfWidth,
      this.expansionUnlockZoneHalfDepth,
    );
  }

  private isPlayerInConveyorUnlockZone(): boolean {
    return this.inRect(
      this.player.position,
      this.conveyorUnlockZone,
      this.conveyorUnlockZoneHalfWidth,
      this.conveyorUnlockZoneHalfDepth,
    );
  }

  private isPlayerInSellConveyorUnlockZone(): boolean {
    return this.inRect(
      this.player.position,
      this.sellConveyorUnlockZone,
      this.sellConveyorUnlockZoneHalfWidth,
      this.sellConveyorUnlockZoneHalfDepth,
    );
  }

  private inRadius(a: Vector3, b: Vector3, radius: number): boolean {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return dx * dx + dz * dz <= radius * radius;
  }

  private inRect(position: Vector3, center: Vector3, halfWidth: number, halfDepth: number): boolean {
    return Math.abs(position.x - center.x) <= halfWidth && Math.abs(position.z - center.z) <= halfDepth;
  }

  private buildVisualHints(): void {
    this.bindTruckVisual();
    this.bindConveyorUnlockDecalMesh();
    this.bindSellConveyorUnlockDecalMesh();
    this.bindPlayerConveyorDecalRoot();
    this.bindGateUnlockDecalMesh();
    this.bindExpansionUnlockDecalMesh();
    this.bindToolUpgradeDecalMesh();
  }

  private collectGroundDecals(): void {
    this.groundDecals.length = 0;
    const seen = new Set<number>();

    for (const node of configService.getSceneNodes()) {
      if (node.kind !== 'transform' || node.transformType !== 'groundDecal') continue;
      const mesh = (this.scene.getMeshById(node.id)
        ?? this.scene.getMeshByName(node.name ?? node.id)) as Mesh | null;
      if (!mesh || seen.has(mesh.uniqueId)) continue;

      mesh.alphaIndex = this.getForcedGroundDecalAlphaIndex(node.id) ?? 1;
      const material = mesh.material instanceof StandardMaterial ? mesh.material : null;
      this.groundDecals.push({
        mesh,
        sceneNodeId: node.id,
        parentId: node.parentId,
        baseDiffuse: material?.diffuseColor.clone() ?? new Color3(1, 1, 1),
        baseEmissive: material?.emissiveColor.clone() ?? new Color3(0, 0, 0),
        baseAlpha: material?.alpha ?? 1,
        activation: 0,
      });
      if (material?.diffuseTexture && !material.emissiveTexture) {
        material.emissiveTexture = material.diffuseTexture;
      }
      seen.add(mesh.uniqueId);
    }
  }

  private updateGroundDecalInteractions(deltaTime: number): void {
    if (this.groundDecals.length === 0) return;
    const playerPos = this.player.position;
    const speed = 4.8;

    for (const decal of this.groundDecals) {
      const { mesh } = decal;
      if (!mesh || mesh.isDisposed()) continue;

      const target = this.getGroundDecalInteractionTarget(decal, playerPos);
      decal.activation = this.moveTowards(decal.activation, target, deltaTime * speed);
      const isInteractiveGreenFrame = this.isInteractiveGreenFrame(decal.sceneNodeId);
      const pairedGreenFrameId = this.getPairedInteractiveGreenFrameId(decal.sceneNodeId);
      const isInteractiveDirectFrame = this.isInteractiveDirectFrame(decal.sceneNodeId);
      const isInteractiveGroupDecal = this.isInteractiveBorderGroup(decal.parentId);
      const forcedAlphaIndex = this.getForcedGroundDecalAlphaIndex(decal.sceneNodeId);
      mesh.alphaIndex = forcedAlphaIndex ?? (isInteractiveDirectFrame
        ? 3
        : isInteractiveGreenFrame || pairedGreenFrameId || isInteractiveDirectFrame || isInteractiveGroupDecal
          ? 1
          : 1 + decal.activation);

      const material = mesh.material instanceof StandardMaterial ? mesh.material : null;
      if (!material) continue;
      if (isInteractiveGreenFrame) {
        material.alpha = decal.activation;
        material.diffuseColor.copyFrom(Color3.Lerp(new Color3(1, 1, 1), new Color3(0, 0.45, 0.08), decal.activation));
        material.emissiveColor.copyFrom(Color3.Lerp(new Color3(0, 0, 0), new Color3(0, 0.28, 0.04), decal.activation));
      } else if (pairedGreenFrameId) {
        material.alpha = decal.baseAlpha * (1 - this.getGroundDecalActivation(pairedGreenFrameId));
        material.diffuseColor.copyFrom(decal.baseDiffuse);
        material.emissiveColor.copyFrom(decal.baseEmissive);
      } else if (isInteractiveDirectFrame) {
        this.applyDirectFrameTexture(material, decal.activation > 0.01);
        material.alpha = decal.baseAlpha;
        material.diffuseColor.copyFrom(Color3.Lerp(new Color3(1, 1, 1), new Color3(0, 0.45, 0.08), decal.activation));
        material.emissiveColor.copyFrom(Color3.Lerp(new Color3(0, 0, 0), new Color3(0, 0.28, 0.04), decal.activation));
      } else if (decal.sceneNodeId === 'collect_table_expand_decal_progress'
        || decal.sceneNodeId === 'player_expand_decal_progress'
        || decal.sceneNodeId === 'player_truck_upgrade_decal_progress'
        || decal.sceneNodeId === 'conveyor_decal_progress'
        || decal.sceneNodeId === 'conveyor_decal_left_progress') {
        material.alpha = decal.baseAlpha;
        material.diffuseColor.copyFrom(this.gateUnlockFillDiffuse);
        material.emissiveColor.copyFrom(this.gateUnlockFillEmissive);
      } else if (isInteractiveGroupDecal) {
        material.alpha = decal.baseAlpha;
        material.diffuseColor.copyFrom(decal.baseDiffuse);
        material.emissiveColor.copyFrom(decal.baseEmissive);
      } else {
        material.alpha = decal.baseAlpha;
        material.diffuseColor.copyFrom(Color3.Lerp(decal.baseDiffuse, new Color3(0.45, 1.25, 0.35), decal.activation));
        material.emissiveColor.copyFrom(Color3.Lerp(decal.baseEmissive, new Color3(0.06, 0.55, 0.05), decal.activation));
      }
    }
  }

  private getGroundDecalActivation(sceneNodeId: string): number {
    return this.groundDecals.find((decal) => decal.sceneNodeId === sceneNodeId)?.activation ?? 0;
  }

  private getForcedGroundDecalAlphaIndex(sceneNodeId: string): number | null {
    if (sceneNodeId === 'collect_table_expand_decal_base' || sceneNodeId === 'collect_table_expand_decal_base_2') return 1;
    if (sceneNodeId === 'collect_table_expand_decal_progress') return 2;
    if (sceneNodeId === 'collect_table_expand_decal_frame') return 3;
    if (sceneNodeId === 'collect_table_expand_decal_price') return 10;
    if (sceneNodeId === 'player_expand_decal_base') return 1;
    if (sceneNodeId === 'player_expand_decal_progress') return 2;
    if (sceneNodeId === 'player_expand_decal_dash') return 3;
    if (sceneNodeId === 'player_expand_decal_expand_icon') return 4;
    if (sceneNodeId === 'player_expand_decal_money' || sceneNodeId === 'player_expand_decal_20') return 10;
    if (sceneNodeId === 'player_truck_upgrade_decal_base') return 1;
    if (sceneNodeId === 'player_truck_upgrade_decal_progress') return 2;
    if (sceneNodeId === 'player_truck_upgrade_decal_dash') return 3;
    if (sceneNodeId === 'player_truck_upgrade_decal_lock') return 4;
    if (sceneNodeId === 'player_truck_upgrade_decal_price') return 10;
    if (sceneNodeId === 'conveyor_decal_base') return 1;
    if (sceneNodeId === 'conveyor_decal_progress') return 2;
    if (sceneNodeId === 'conveyor_decal_dash') return 3;
    if (sceneNodeId === 'conveyor_decal_icon') return 4;
    if (sceneNodeId === 'conveyor_decal_20_label' || sceneNodeId === 'conveyor_decal_20_restore') return 10;
    if (sceneNodeId === 'conveyor_decal_left_base') return 1;
    if (sceneNodeId === 'conveyor_decal_left_progress') return 2;
    if (sceneNodeId === 'conveyor_decal_left_dash') return 3;
    if (sceneNodeId === 'conveyor_decal_left_icon') return 4;
    if (sceneNodeId === 'conveyor_decal_left_20' || sceneNodeId === 'conveyor_decal_left_20_restore') return 10;
    return null;
  }

  private getGroundDecalInteractionTarget(decal: GroundDecalRuntime, playerPos: Vector3): number {
    const { mesh } = decal;
    if (!mesh.isEnabled() || !mesh.isVisible || mesh.visibility <= 0) return 0;
    if (decal.sceneNodeId === 'collect_table_expand_decal_frame') {
      return this.isPlayerInGateUnlockZone() ? 1 : 0;
    }
    return this.isPositionInsideMeshXZ(playerPos, mesh) ? 1 : 0;
  }

  private applyDirectFrameTexture(material: StandardMaterial, active: boolean): void {
    const textureId = this.getInteractiveDirectFrameTextureId(active);
    const metadata = { ...(material.metadata ?? {}) } as any;
    if (metadata.interactiveFrameTextureId === textureId) return;

    const url = TextureAssets.ground?.[textureId];
    if (!url) return;

    const previousDiffuse = material.diffuseTexture;
    const previousEmissive = material.emissiveTexture;
    const texture = new Texture(url, this.scene);
    texture.hasAlpha = true;
    texture.uScale = -1;
    texture.uOffset = 1;
    texture.level = active ? 1.35 : 1;

    material.diffuseTexture = texture;
    material.emissiveTexture = texture;
    material.useAlphaFromDiffuseTexture = true;
    material.disableLighting = active;
    metadata.interactiveFrameTextureId = textureId;
    material.metadata = metadata;

    if (previousDiffuse && previousDiffuse !== texture) {
      previousDiffuse.dispose();
    }
    if (previousEmissive && previousEmissive !== previousDiffuse && previousEmissive !== texture) {
      previousEmissive.dispose();
    }
  }

  private getInteractiveDirectFrameTextureId(active: boolean): string {
    return active ? 'sell_decal_green_frame' : 'sell_decal_frame';
  }

  private isInteractiveGreenFrame(sceneNodeId: string): boolean {
    return sceneNodeId === 'machine_cutter_operation_decal_green_frame'
      || sceneNodeId === 'collect_table_sell_decal_green_frame'
      || sceneNodeId === 'machine_peeler_operation_decal_green_frame';
  }

  private getPairedInteractiveGreenFrameId(sceneNodeId: string): string | null {
    if (sceneNodeId === 'machine_cutter_operation_decal_frame') return 'machine_cutter_operation_decal_green_frame';
    if (sceneNodeId === 'collect_table_sell_decal_frame') return 'collect_table_sell_decal_green_frame';
    if (sceneNodeId === 'machine_peeler_operation_decal_frame') return 'machine_peeler_operation_decal_green_frame';
    return null;
  }

  private isInteractiveDirectFrame(sceneNodeId: string): boolean {
    return sceneNodeId === 'player_conveyor_decal_icon';
  }

  private isInteractiveBorderGroup(parentId: string | undefined): boolean {
    return parentId === 'machine_cutter_operation_decal_group'
      || parentId === 'collect_table_sell_decal_group'
      || parentId === 'machine_peeler_operation_decal_group'
      || parentId === 'collect_table_expand_decal'
      || parentId === 'player_expand_decal'
      || parentId === 'player_conveyor_decal_group'
      || parentId === 'player_truck_upgrade_decal_group';
  }

  private isPositionInsideMeshXZ(position: Vector3, mesh: Mesh): boolean {
    const bbox = mesh.getBoundingInfo().boundingBox;
    return position.x >= bbox.minimumWorld.x
      && position.x <= bbox.maximumWorld.x
      && position.z >= bbox.minimumWorld.z
      && position.z <= bbox.maximumWorld.z;
  }

  private moveTowards(current: number, target: number, maxDelta: number): number {
    if (current < target) return Math.min(target, current + maxDelta);
    if (current > target) return Math.max(target, current - maxDelta);
    return current;
  }

  private applyCashRelativeDebarkerFinishedGoodsScale(mesh: Mesh): void {
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
    const lengthScale = (this.player.getCashReferenceLength() * this.debarkerFinishedGoodsTargetCashLengthMultiplier) / currentLength;
    mesh.scaling.set(
      mesh.scaling.x * lengthScale * (lengthAxis === 'x' ? 1 : this.debarkerFinishedGoodsThicknessScale),
      mesh.scaling.y * lengthScale * (lengthAxis === 'y' ? 1 : this.debarkerFinishedGoodsThicknessScale),
      mesh.scaling.z * lengthScale * (lengthAxis === 'z' ? 1 : this.debarkerFinishedGoodsThicknessScale),
    );
  }

  private normalizeGroundDecalMaterialName(mesh: Mesh, materialName: string): void {
    const currentMaterial = mesh.material;
    if (currentMaterial instanceof StandardMaterial) {
      currentMaterial.name = materialName;
    }
  }

  private hideTruckLoadSquareOverlay(): void {
    const redSquare = this.scene.getMeshByName('overlay_truck_rear_red_square');
    if (!redSquare) return;
    redSquare.visibility = 0;
    redSquare.isPickable = false;
  }

  private bindConveyorUnlockDecalMesh(): void {
    const root = this.scene.getTransformNodeById('conveyor_decal_group') ?? this.scene.getTransformNodeByName('传送带地贴组');
    const mesh = (this.scene.getMeshById('conveyor_decal_progress') ?? this.scene.getMeshByName('传送带地贴_绿色进度')) as Mesh | null;
    if (!root || !mesh) return;

    this.normalizeGroundDecalMaterialName(mesh, 'conveyor_unlock_decal_mat');
    this.applyGateUnlockFillMaterial(mesh);

    this.conveyorUnlockDecalRoot = root;
    this.conveyorUnlockDecalMesh = mesh;
    this.syncConveyorGroundDecalVisibility();
    this.conveyorUnlockDecalBaseScaling = mesh.scaling.clone();
    this.conveyorUnlockDecalBasePosition = mesh.position.clone();
    mesh.computeWorldMatrix(true);
    const bbox = mesh.getBoundingInfo().boundingBox;
    this.conveyorUnlockDecalBaseDepth = Math.max(0.001, bbox.maximumWorld.z - bbox.minimumWorld.z);
    this.conveyorUnlockDecalPulsePhase = 0;
    this.conveyorUnlockDecalBurstTime = 0;
    this.conveyorUnlockDecalHideTime = this.conveyorUnlocked ? 0.32 : 0;
    mesh.visibility = this.conveyorUnlocked ? 0 : 1;
    mesh.setEnabled(!this.conveyorUnlocked);
    mesh.isPickable = false;
  }

  private bindSellConveyorUnlockDecalMesh(): void {
    const root = this.scene.getTransformNodeById('conveyor_decal_left') ?? this.scene.getTransformNodeByName('传送带地贴_左');
    const mesh = (this.scene.getMeshById('conveyor_decal_left_progress') ?? this.scene.getMeshByName('传送带地贴_左_绿色进度')) as Mesh | null;
    if (!root || !mesh) return;

    this.normalizeGroundDecalMaterialName(mesh, 'sell_conveyor_unlock_decal_mat');
    this.applyGateUnlockFillMaterial(mesh);

    this.sellConveyorUnlockDecalRoot = root;
    this.sellConveyorUnlockDecalMesh = mesh;
    this.syncConveyorGroundDecalVisibility();
    this.sellConveyorUnlockDecalBaseScaling = mesh.scaling.clone();
    this.sellConveyorUnlockDecalBasePosition = mesh.position.clone();
    mesh.computeWorldMatrix(true);
    const bbox = mesh.getBoundingInfo().boundingBox;
    this.sellConveyorUnlockDecalBaseDepth = Math.max(0.001, bbox.maximumWorld.z - bbox.minimumWorld.z);
    this.sellConveyorUnlockDecalPulsePhase = 0;
    this.sellConveyorUnlockDecalBurstTime = 0;
    this.sellConveyorUnlockDecalHideTime = this.sellConveyorUnlocked ? 0.32 : 0;
    mesh.visibility = this.sellConveyorUnlocked ? 0 : 1;
    mesh.setEnabled(!this.sellConveyorUnlocked);
    mesh.isPickable = false;
  }

  private bindPlayerConveyorDecalRoot(): void {
    const root = this.scene.getTransformNodeById('player_conveyor_decal_group') ?? this.scene.getTransformNodeByName('传送带图标组');
    if (!root) return;

    this.applyConveyorGroundDecalVisibility(root, true);
  }

  private applyConveyorGroundDecalVisibility(node: TransformNode | Mesh, visible: boolean): void {
    node.setEnabled(visible);
    if (node instanceof Mesh) {
      node.isVisible = visible;
      node.visibility = visible ? 1 : 0;
      node.isPickable = false;
      return;
    }

    for (const child of node.getChildMeshes()) {
      child.isVisible = visible;
      child.visibility = visible ? 1 : 0;
      child.isPickable = false;
    }
  }

  setConveyorGroundDecalsVisible(visible: boolean): void {
    this.conveyorGroundDecalsVisible = visible;
    this.syncConveyorGroundDecalVisibility();
  }

  private syncConveyorGroundDecalVisibility(): void {
    const visible = this.isConveyorGroundDecalEnabled();
    if (this.conveyorUnlockDecalRoot && !this.conveyorUnlockDecalRoot.isDisposed()) {
      this.applyConveyorGroundDecalVisibility(this.conveyorUnlockDecalRoot, visible);
    }
    if (this.sellConveyorUnlockDecalRoot && !this.sellConveyorUnlockDecalRoot.isDisposed()) {
      this.applyConveyorGroundDecalVisibility(this.sellConveyorUnlockDecalRoot, visible);
    }
  }

  isConveyorGroundDecalsVisible(): boolean {
    return this.isConveyorGroundDecalEnabled();
  }

  isConveyorArrowMovementPaused(): boolean {
    return this.conveyorArrowMovementPaused;
  }

  toggleConveyorArrowMovementPaused(): boolean {
    this.conveyorArrowMovementPaused = !this.conveyorArrowMovementPaused;
    return this.conveyorArrowMovementPaused;
  }

  advanceToUnlockedConveyorStage(): void {
    this.completeForestUnlock();
    this.completeToolUpgrade();
    this.completeConveyorUnlock();
    this.completeSellConveyorUnlock();
  }

  private bindGateUnlockDecalMesh(): void {
    const gateUnlockDecalConfig = configService.getSceneNodeById('collect_table_expand_decal');
    const authoredEnabled = gateUnlockDecalConfig?.enabled !== false;
    const mesh = (this.scene.getMeshById('collect_table_expand_decal_progress')
      ?? this.scene.getMeshByName('解锁门地贴_绿色进度')) as Mesh | null;
    if (!mesh) return;

    this.normalizeGroundDecalMaterialName(mesh, 'gate_unlock_decal_mat');
    this.applyGateUnlockFillMaterial(mesh);

    this.gateUnlockDecalMesh = mesh;
    this.gateUnlockDecalBaseScaling = mesh.scaling.clone();
    this.gateUnlockDecalBasePosition = mesh.position.clone();
    mesh.computeWorldMatrix(true);
    const bbox = mesh.getBoundingInfo().boundingBox;
    this.gateUnlockDecalBaseDepth = Math.max(0.001, bbox.maximumWorld.z - bbox.minimumWorld.z);
    this.gateUnlockDecalHideTime = this.gateUnlocked ? 0.32 : 0;
    mesh.visibility = authoredEnabled && !this.gateUnlocked ? 1 : 0;
    mesh.setEnabled(authoredEnabled && !this.gateUnlocked);
    mesh.isPickable = false;
  }

  private bindExpansionUnlockDecalMesh(): void {
    const root = this.scene.getTransformNodeById('player_expand_decal') ?? this.scene.getTransformNodeByName('扩建地贴');
    const mesh = (this.scene.getMeshById('player_expand_decal_progress')
      ?? this.scene.getMeshByName('扩建地贴_绿色进度')) as Mesh | null;
    if (!root || !mesh) return;

    this.normalizeGroundDecalMaterialName(mesh, 'player_expand_decal_mat');
    this.applyGateUnlockFillMaterial(mesh);

    this.expansionDecalMesh = mesh;
    this.expansionDecalBaseScaling = mesh.scaling.clone();
    this.expansionDecalBasePosition = mesh.position.clone();
    mesh.computeWorldMatrix(true);
    const bbox = mesh.getBoundingInfo().boundingBox;
    this.expansionDecalBaseDepth = Math.max(0.001, bbox.maximumWorld.z - bbox.minimumWorld.z);
    this.expansionDecalHideTime = this.expansionUnlocked ? 0.32 : 0;
    const visible = this.sellConveyorUnlocked && !this.expansionUnlocked;
    root.setEnabled(this.sellConveyorUnlocked);
    for (const child of root.getChildMeshes(false)) {
      child.setEnabled(this.sellConveyorUnlocked);
      child.isVisible = this.sellConveyorUnlocked;
      child.visibility = this.sellConveyorUnlocked ? 1 : 0;
      child.isPickable = false;
    }
    mesh.visibility = visible ? 1 : 0;
    mesh.setEnabled(visible);
    mesh.isPickable = false;
  }

  private applyGateUnlockFillMaterial(mesh: Mesh): void {
    const material = mesh.material instanceof StandardMaterial ? mesh.material : null;
    if (!material) return;

    if (material.diffuseTexture) {
      material.opacityTexture = material.diffuseTexture;
      material.diffuseTexture = null;
      material.useAlphaFromDiffuseTexture = false;
    }
    if (material.opacityTexture) {
      material.opacityTexture.level = 1.7;
    }
    material.diffuseColor.copyFrom(this.gateUnlockFillDiffuse);
    material.emissiveColor.copyFrom(this.gateUnlockFillEmissive);
    material.specularColor.set(0, 0, 0);
    material.specularPower = 0;
  }

  private bindToolUpgradeDecalMesh(): void {
    const mesh = (this.scene.getMeshById('player_truck_upgrade_decal_progress')
      ?? this.scene.getMeshByName('升级车地贴_绿色进度')) as Mesh | null;
    if (!mesh) return;

    this.normalizeGroundDecalMaterialName(mesh, 'tool_upgrade_decal_mat');
    this.applyGateUnlockFillMaterial(mesh);

    this.toolUpgradeDecalMesh = mesh;
    this.toolUpgradeDecalBaseScaling = mesh.scaling.clone();
    this.toolUpgradeDecalBasePosition = mesh.position.clone();
    mesh.computeWorldMatrix(true);
    const bbox = mesh.getBoundingInfo().boundingBox;
    this.toolUpgradeDecalBaseDepth = Math.max(0.001, bbox.maximumWorld.z - bbox.minimumWorld.z);
    this.toolUpgradeDecalPulsePhase = 0;
    this.toolUpgradeDecalBurstTime = 0;
    this.toolUpgradeDecalHideTime = this.toolUpgradeUnlocked ? 0.32 : 0;
    mesh.visibility = this.toolUpgradeUnlocked ? 0 : 1;
    mesh.setEnabled(!this.toolUpgradeUnlocked);
    mesh.isPickable = false;
  }

  private bindGateVisual(): void {
    this.gateNodes.length = 0;
    for (const id of ['door_left', 'door_right']) {
      const node = this.scene.getTransformNodeById(id) ?? this.scene.getTransformNodeByName(id);
      if (!node) continue;
      node.rotationQuaternion = null;
      node.setEnabled(true);
      const closedPosition = this.gateClosedPositionById.get(id)?.clone() ?? node.position.clone();
      const closedYaw = node.rotation.y;
      node.position.copyFrom(closedPosition);
      const openYaw = id === 'door_left'
        ? closedYaw - Math.PI * 0.5
        : closedYaw + Math.PI * 0.5;
      this.gateClosedPositionById.set(id, closedPosition);
      this.gateClosedYawById.set(id, closedYaw);
      this.gateOpenYawById.set(id, openYaw);
      node.rotation.y = this.gateUnlocked ? openYaw : closedYaw;
      node.position.copyFrom(closedPosition);
      for (const mesh of node.getChildMeshes(false)) {
        mesh.setEnabled(true);
        mesh.isVisible = true;
        mesh.visibility = 1;
      }
      this.gateNodes.push(node);
    }
    this.bindGateLockVisuals();
  }

  private bindGateLockVisuals(): void {
    this.gateLockNodes.length = 0;
    for (const id of ['door_lock_left', 'door_lock_right']) {
      const node = this.scene.getTransformNodeById(id) ?? this.scene.getTransformNodeByName(id);
      if (!node) continue;
      const sceneNodeConfig = configService.getSceneNodeById(id);
      const authoredEnabled = sceneNodeConfig?.enabled !== false;

      const baseScaling = this.gateLockBaseScalingById.get(id)?.clone() ?? node.scaling.clone();
      const basePosition = this.gateLockBasePositionById.get(id)?.clone() ?? node.position.clone();
      this.gateLockBaseScalingById.set(id, baseScaling);
      this.gateLockBasePositionById.set(id, basePosition);

      node.scaling.copyFrom(baseScaling);
      node.position.copyFrom(basePosition);
      node.setEnabled(authoredEnabled && !this.gateUnlocked);
      for (const mesh of node.getChildMeshes(false)) {
        mesh.setEnabled(authoredEnabled && !this.gateUnlocked);
        mesh.isVisible = authoredEnabled && !this.gateUnlocked;
        mesh.visibility = authoredEnabled && !this.gateUnlocked ? 1 : 0;
      }
      if (!authoredEnabled) continue;
      this.gateLockNodes.push(node);
    }
  }

  private bindExpansionDoorVisual(): void {
    this.expansionDoorNodes.length = 0;
    for (const id of ['door_e_22', 'door_e_23']) {
      const node = this.scene.getTransformNodeById(id) ?? this.scene.getTransformNodeByName(id);
      if (!node) continue;

      node.rotationQuaternion = null;
      node.setEnabled(true);
      const closedPosition = this.expansionDoorClosedPositionById.get(id)?.clone() ?? node.position.clone();
      const closedYaw = node.rotation.y;
      const openYaw = id === 'door_e_22'
        ? closedYaw + Math.PI * 0.5
        : closedYaw - Math.PI * 0.5;

      this.expansionDoorClosedPositionById.set(id, closedPosition);
      this.expansionDoorClosedYawById.set(id, closedYaw);
      this.expansionDoorOpenYawById.set(id, openYaw);
      node.rotation.y = this.expansionUnlocked ? openYaw : closedYaw;
      node.position.copyFrom(closedPosition);
      for (const mesh of node.getChildMeshes(false)) {
        mesh.setEnabled(true);
        mesh.isVisible = true;
        mesh.visibility = 1;
      }
      this.expansionDoorNodes.push(node);
    }
  }

  private scheduleTruckVisualBindingRefresh(): void {
    if (typeof window === 'undefined') return;
    const refreshDelays = [0, 180, 420];
    for (const delay of refreshDelays) {
      const timerId = window.setTimeout(() => {
        if (this.scene.isDisposed) return;
        this.bindTruckVisual();
      }, delay);
      this.truckBindingRefreshTimers.push(timerId);
    }
  }

  private tryCollectStarterBoards(): boolean {
    if (!this.starterBoardsAvailable) return false;
    if (!this.inRadius(this.player.position, this.starterBoardZone, this.starterBoardPickupRadius)) return false;

    const sourceMeshes: Mesh[] = [];
    for (const id of this.starterBoardNodeIds) {
      const node = this.scene.getTransformNodeById(id) ?? this.scene.getTransformNodeByName(id);
      if (!node || !node.isEnabled()) continue;
      const mesh = node.getChildMeshes(false).find((m) => m.name !== '__root__') as Mesh | undefined;
      if (mesh) sourceMeshes.push(mesh);
    }

    const picked = sourceMeshes.length > 0
      ? this.player.requestPickupBoardsFromMeshes(sourceMeshes)
      : this.player.requestPickupBoards(this.starterBoardZone, this.starterRewardCount);
    if (picked <= 0) return false;

    this.starterBoardsAvailable = false;
    for (const id of this.starterBoardNodeIds) {
      const node = this.scene.getTransformNodeById(id) ?? this.scene.getTransformNodeByName(id);
      node?.setEnabled(false);
    }
    return true;
  }

  private updateGateUnlockPayment(deltaTime: number): void {
    if (this.gateUnlocked) return;

    const remain = Math.max(0, this.forestUnlockCost - this.gateUnlockPaidAmount);
    if (remain <= 0) {
      this.gateUnlockReadyToComplete = true;
      if (this.gatePaymentPendingBills === 0) {
        this.completeForestUnlock();
      }
      return;
    }

    if (!this.isPlayerInGateUnlockZone()) return;

    this.gateUnlockPaymentCooldown = Math.max(0, this.gateUnlockPaymentCooldown - deltaTime);
    if (this.gateUnlockPaymentCooldown > 0) return;
    this.gateUnlockPaymentCooldown = this.gateUnlockPaymentInterval;

    const deposit = Math.min(this.rewardCashPerBill, remain);
    if (deposit <= 0) return;
    if (!this.economy.canAfford(deposit)) return;
    if (this.player.getCashCarryCount() <= 0) return;
    if (!this.economy.spendCash(deposit)) return;

    this.gateUnlockPaidAmount = Math.min(this.forestUnlockCost, this.gateUnlockPaidAmount + deposit);
    this.gateUnlockReadyToComplete = this.gateUnlockPaidAmount >= this.forestUnlockCost;
    this.beginGateCashDelivery(1);

    if (this.gateUnlockReadyToComplete && this.gatePaymentPendingBills === 0) {
      this.completeForestUnlock();
    }
  }

  private updateExpansionUnlockPayment(deltaTime: number): void {
    if (this.expansionUnlocked) return;

    const remain = Math.max(0, this.expansionUnlockCost - this.expansionPaidAmount);
    if (remain <= 0) {
      this.expansionReadyToComplete = true;
      if (this.expansionPaymentPendingBills === 0) {
        this.completeExpansionUnlock();
      }
      return;
    }

    if (!this.isPlayerInExpansionUnlockZone()) return;

    this.expansionPaymentCooldown = Math.max(0, this.expansionPaymentCooldown - deltaTime);
    if (this.expansionPaymentCooldown > 0) return;
    this.expansionPaymentCooldown = this.gateUnlockPaymentInterval;

    const deposit = Math.min(this.rewardCashPerBill, remain);
    if (deposit <= 0) return;
    if (!this.economy.canAfford(deposit)) return;
    if (this.player.getCashCarryCount() <= 0) return;
    if (!this.economy.spendCash(deposit)) return;

    this.expansionPaidAmount = Math.min(this.expansionUnlockCost, this.expansionPaidAmount + deposit);
    this.expansionReadyToComplete = this.expansionPaidAmount >= this.expansionUnlockCost;
    this.beginExpansionCashDelivery(1);

    if (this.expansionReadyToComplete && this.expansionPaymentPendingBills === 0) {
      this.completeExpansionUnlock();
    }
  }

  private enforceForestGate(): void {
    if (this.gateUnlocked) return;
    if (this.player.isLv2TruckMode()) return;

    const p = this.player.position;
    const blockedByGate = p.x >= this.gateBlockMinX
      && p.x <= this.gateBlockMaxX
      && p.z >= this.gateBlockZ - 0.02;
    if (blockedByGate) {
      p.z = this.gateBlockZ - 0.02;
    }
  }

  private updateGateUnlockDecalAnimation(deltaTime: number): void {
    const mesh = this.gateUnlockDecalMesh;
    if (!mesh || mesh.isDisposed()) return;

    const progress = this.forestUnlockCost > 0 ? Math.min(1, this.gateUnlockPaidAmount / this.forestUnlockCost) : 1;

    if (this.gateUnlockDecalHideTime > 0) {
      this.gateUnlockDecalHideTime = Math.max(0, this.gateUnlockDecalHideTime - deltaTime);
    }

    const progressScale = Math.max(0.001, progress);
    const hideProgress = this.gateUnlocked ? 1 - Math.min(1, this.gateUnlockDecalHideTime / 0.32) : 0;
    const hideScale = 1 - hideProgress;
    const xScale = Math.max(0.001, hideScale);
    const zScale = Math.max(0.001, progressScale * hideScale);

    mesh.scaling.set(
      this.gateUnlockDecalBaseScaling.x * xScale,
      this.gateUnlockDecalBaseScaling.y,
      this.gateUnlockDecalBaseScaling.z * zScale,
    );
    mesh.position.set(
      this.gateUnlockDecalBasePosition.x,
      this.gateUnlockDecalBasePosition.y,
      this.gateUnlockDecalBasePosition.z - this.gateUnlockDecalBaseDepth * (1 - progressScale) * 0.5,
    );
    mesh.visibility = this.gateUnlocked ? 1 - hideProgress : 1;

    if (this.gateUnlocked && hideProgress >= 1) {
      mesh.setEnabled(false);
      const decalGroup = this.scene.getTransformNodeById('collect_table_expand_decal');
      if (decalGroup) {
        decalGroup.setEnabled(false);
        decalGroup.getChildMeshes(false).forEach((m) => { m.isVisible = false; });
      }
    }
  }

  private updateExpansionUnlockDecalAnimation(deltaTime: number): void {
    const mesh = this.expansionDecalMesh;
    if (!mesh || mesh.isDisposed()) return;

    const progress = this.expansionUnlockCost > 0 ? Math.min(1, this.expansionPaidAmount / this.expansionUnlockCost) : 1;

    if (this.expansionDecalHideTime > 0) {
      this.expansionDecalHideTime = Math.max(0, this.expansionDecalHideTime - deltaTime);
    }

    const progressScale = Math.max(0.001, progress);
    const hideProgress = this.expansionUnlocked ? 1 - Math.min(1, this.expansionDecalHideTime / 0.32) : 0;
    const hideScale = 1 - hideProgress;
    const xScale = Math.max(0.001, hideScale);
    const zScale = Math.max(0.001, progressScale * hideScale);

    mesh.scaling.set(
      this.expansionDecalBaseScaling.x * xScale,
      this.expansionDecalBaseScaling.y,
      this.expansionDecalBaseScaling.z * zScale,
    );
    mesh.position.set(
      this.expansionDecalBasePosition.x,
      this.expansionDecalBasePosition.y,
      this.expansionDecalBasePosition.z - this.expansionDecalBaseDepth * (1 - progressScale) * 0.5,
    );
    mesh.visibility = this.expansionUnlocked ? 1 - hideProgress : 1;

    if (this.expansionUnlocked && hideProgress >= 1) {
      mesh.setEnabled(false);
    }
  }

  private updateConveyorUnlockDecalAnimation(deltaTime: number): void {
    if (!this.isConveyorGroundDecalEnabled()) return;
    const mesh = this.conveyorUnlockDecalMesh;
    if (!mesh || mesh.isDisposed()) return;

    const progress = this.conveyorUnlockCost > 0 ? Math.min(1, this.conveyorPaidAmount / this.conveyorUnlockCost) : 1;
    const inside = this.isPlayerInConveyorUnlockZone();

    if (this.conveyorUnlockDecalBurstTime > 0) {
      this.conveyorUnlockDecalBurstTime = Math.max(0, this.conveyorUnlockDecalBurstTime - deltaTime);
    }
    if (this.conveyorUnlockDecalHideTime > 0) {
      this.conveyorUnlockDecalHideTime = Math.max(0, this.conveyorUnlockDecalHideTime - deltaTime);
    }

    this.conveyorUnlockDecalPulsePhase += deltaTime * (inside && !this.conveyorUnlocked ? (1.2 + progress * 1.6) : 0.35);
    const ambientPulse = !this.conveyorUnlocked && inside
      ? Math.sin(this.conveyorUnlockDecalPulsePhase * Math.PI * 2) * (0.004 + progress * 0.004)
      : 0;
    const burstProgress = 1 - Math.min(1, this.conveyorUnlockDecalBurstTime / 0.22);
    const burstPulse = this.conveyorUnlockDecalBurstTime > 0
      ? Math.sin(burstProgress * Math.PI) * 0.08
      : 0;
    const hideProgress = this.conveyorUnlocked ? 1 - Math.min(1, this.conveyorUnlockDecalHideTime / 0.32) : 0;
    const hideScale = 1 - hideProgress;
    const progressScale = Math.max(0.001, progress);
    const xScale = Math.max(0.001, (1 + ambientPulse + burstPulse) * hideScale);
    const zScale = Math.max(0.001, progressScale * hideScale);

    mesh.scaling.set(
      this.conveyorUnlockDecalBaseScaling.x * xScale,
      this.conveyorUnlockDecalBaseScaling.y,
      this.conveyorUnlockDecalBaseScaling.z * zScale,
    );
    mesh.position.set(
      this.conveyorUnlockDecalBasePosition.x,
      this.conveyorUnlockDecalBasePosition.y,
      this.conveyorUnlockDecalBasePosition.z - this.conveyorUnlockDecalBaseDepth * (1 - progressScale) * 0.5,
    );
    mesh.visibility = this.conveyorUnlocked ? 1 - hideProgress : 1;

    if (this.conveyorUnlocked && hideProgress >= 1) {
      mesh.setEnabled(false);
    }
  }

  private updateSellConveyorUnlockDecalAnimation(deltaTime: number): void {
    if (!this.isConveyorGroundDecalEnabled()) return;
    const mesh = this.sellConveyorUnlockDecalMesh;
    if (!mesh || mesh.isDisposed()) return;

    const progress = this.sellConveyorUnlockCost > 0 ? Math.min(1, this.sellConveyorPaidAmount / this.sellConveyorUnlockCost) : 1;
    const inside = this.isPlayerInSellConveyorUnlockZone();

    if (this.sellConveyorUnlockDecalBurstTime > 0) {
      this.sellConveyorUnlockDecalBurstTime = Math.max(0, this.sellConveyorUnlockDecalBurstTime - deltaTime);
    }
    if (this.sellConveyorUnlockDecalHideTime > 0) {
      this.sellConveyorUnlockDecalHideTime = Math.max(0, this.sellConveyorUnlockDecalHideTime - deltaTime);
    }

    this.sellConveyorUnlockDecalPulsePhase += deltaTime * (inside && !this.sellConveyorUnlocked ? (1.2 + progress * 1.6) : 0.35);
    const ambientPulse = !this.sellConveyorUnlocked && inside
      ? Math.sin(this.sellConveyorUnlockDecalPulsePhase * Math.PI * 2) * (0.004 + progress * 0.004)
      : 0;
    const burstProgress = 1 - Math.min(1, this.sellConveyorUnlockDecalBurstTime / 0.22);
    const burstPulse = this.sellConveyorUnlockDecalBurstTime > 0
      ? Math.sin(burstProgress * Math.PI) * 0.08
      : 0;
    const hideProgress = this.sellConveyorUnlocked ? 1 - Math.min(1, this.sellConveyorUnlockDecalHideTime / 0.32) : 0;
    const hideScale = 1 - hideProgress;
    const progressScale = Math.max(0.001, progress);
    const xScale = Math.max(0.001, (1 + ambientPulse + burstPulse) * hideScale);
    const zScale = Math.max(0.001, progressScale * hideScale);

    mesh.scaling.set(
      this.sellConveyorUnlockDecalBaseScaling.x * xScale,
      this.sellConveyorUnlockDecalBaseScaling.y,
      this.sellConveyorUnlockDecalBaseScaling.z * zScale,
    );
    mesh.position.set(
      this.sellConveyorUnlockDecalBasePosition.x,
      this.sellConveyorUnlockDecalBasePosition.y,
      this.sellConveyorUnlockDecalBasePosition.z - this.sellConveyorUnlockDecalBaseDepth * (1 - progressScale) * 0.5,
    );
    mesh.visibility = this.sellConveyorUnlocked ? 1 - hideProgress : 1;

    if (this.sellConveyorUnlocked && hideProgress >= 1) {
      mesh.setEnabled(false);
    }
  }

  private updateToolUpgradeDecalAnimation(deltaTime: number): void {
    const mesh = this.toolUpgradeDecalMesh;
    if (!mesh || mesh.isDisposed()) return;

    const progress = this.toolUpgradeCost > 0 ? Math.min(1, this.toolUpgradePaidAmount / this.toolUpgradeCost) : 1;
    const inside = this.inRadius(this.player.position, this.toolUpgradeZone, this.toolUpgradeRadius);

    if (this.toolUpgradeDecalBurstTime > 0) {
      this.toolUpgradeDecalBurstTime = Math.max(0, this.toolUpgradeDecalBurstTime - deltaTime);
    }
    if (this.toolUpgradeDecalHideTime > 0) {
      this.toolUpgradeDecalHideTime = Math.max(0, this.toolUpgradeDecalHideTime - deltaTime);
    }

    this.toolUpgradeDecalPulsePhase += deltaTime * (inside && !this.toolUpgradeUnlocked ? (1.2 + progress * 1.6) : 0.35);
    const ambientPulse = !this.toolUpgradeUnlocked && inside
      ? Math.sin(this.toolUpgradeDecalPulsePhase * Math.PI * 2) * (0.004 + progress * 0.004)
      : 0;
    const burstProgress = 1 - Math.min(1, this.toolUpgradeDecalBurstTime / 0.22);
    const burstPulse = this.toolUpgradeDecalBurstTime > 0
      ? Math.sin(burstProgress * Math.PI) * 0.08
      : 0;
    const hideProgress = this.toolUpgradeUnlocked ? 1 - Math.min(1, this.toolUpgradeDecalHideTime / 0.32) : 0;
    const hideScale = 1 - hideProgress;
    const progressScale = Math.max(0.001, progress);
    const xScale = Math.max(0.001, (1 + ambientPulse + burstPulse) * hideScale);
    const zScale = Math.max(0.001, progressScale * hideScale);

    mesh.scaling.set(
      this.toolUpgradeDecalBaseScaling.x * xScale,
      this.toolUpgradeDecalBaseScaling.y,
      this.toolUpgradeDecalBaseScaling.z * zScale,
    );
    mesh.position.set(
      this.toolUpgradeDecalBasePosition.x,
      this.toolUpgradeDecalBasePosition.y,
      this.toolUpgradeDecalBasePosition.z - this.toolUpgradeDecalBaseDepth * (1 - progressScale) * 0.5,
    );
    mesh.visibility = this.toolUpgradeUnlocked ? 1 - hideProgress : 1;

    if (this.toolUpgradeUnlocked && hideProgress >= 1) {
      mesh.setEnabled(false);
    }
  }

  private bindTruckVisual(): void {
    const root1 = this.scene.getTransformNodeById('truck_bottom_1') ?? this.scene.getTransformNodeByName('truck_bottom_1');
    const lane1 = this.scene.getTransformNodeById('truck_lane_1') ?? this.scene.getTransformNodeByName('truck_lane_1');
    const lane2 = this.scene.getTransformNodeById('truck_lane_2') ?? this.scene.getTransformNodeByName('truck_lane_2');
    const lane3 = this.scene.getTransformNodeById('truck_lane_3') ?? this.scene.getTransformNodeByName('truck_lane_3');
    if (!root1) return;

    this.truckRuntimes.length = 0;
    this.waitingTrucks.length = 0;
    this.loadingTruck = null;

    const addTruck = (root: TransformNode, state: TruckState, slot: Vector3): TruckRuntime => {
      this.clearTruckCargoAndEmoji(root);
      root.setEnabled(true);
      root.setAbsolutePosition(slot);
      const runtime: TruckRuntime = {
        root,
        state,
        load: 0,
        route: [],
        routeIndex: 0,
        moveT: 0,
        nextState: state,
      };
      this.truckRuntimes.push(runtime);
      return runtime;
    };

    const loadingTruck = addTruck(root1, 'loading', this.truckLoadSlot);
    this.loadingTruck = loadingTruck;
    this.alignLoadingTruckFacing(loadingTruck);

    if (lane3) this.waitingTrucks.push(addTruck(lane3, 'waiting', this.truckQueueSlots[0] ?? lane3.position));
    if (lane2) this.waitingTrucks.push(addTruck(lane2, 'waiting', this.truckQueueSlots[1] ?? lane2.position));
    if (lane1) this.waitingTrucks.push(addTruck(lane1, 'waiting', this.truckQueueSlots[2] ?? lane1.position));
    this.waitingTrucks.forEach((truck, index) => this.alignWaitingTruckFacing(truck, index));

    const { plane: emoji, texture: emojiTex } = this.attachTruckEmoji(loadingTruck.root);
    this.truckEmojiPlane = emoji;
    this.truckEmojiTexture = emojiTex;
    this.truckIdleT = 0;
  }

  private attachTruckEmoji(root: TransformNode): { plane: Mesh; texture: DynamicTexture } {
    root.getChildMeshes(false)
      .filter((mesh) => mesh.name.startsWith('guide_truck_emoji_'))
      .forEach((mesh) => mesh.dispose());

    const emoji = MeshBuilder.CreatePlane(`guide_truck_emoji_${Date.now()}`, { width: 0.44, height: 0.3 }, this.scene);
    emoji.parent = root;
    emoji.position.set(0, 0.8, -0.25);
    emoji.isVisible = false;
    const emojiMat = new StandardMaterial(`guide_truck_emoji_mat_${Date.now()}`, this.scene);
    const emojiTex = new DynamicTexture(`guide_truck_emoji_tex_${Date.now()}`, { width: 256, height: 192 }, this.scene, false);
    emojiMat.diffuseTexture = emojiTex;
    emojiMat.emissiveColor = new Color3(1, 1, 1);
    emojiMat.backFaceCulling = false;
    emoji.material = emojiMat;
    return { plane: emoji, texture: emojiTex };
  }

  private beginTruckReplacement(): void {
    this.ensureTruckFlow();
    const departingTruck = this.loadingTruck;
    if (!departingTruck) return;

    this.clearTruckEmoji(departingTruck.root);
    this.assignTruckRoute(
      departingTruck,
      [departingTruck.root.getAbsolutePosition().clone(), this.truckRemoteTurnPoint, this.truckRemoteRecyclePoint],
      'departing',
      'recycling',
    );

    this.loadingTruck = null;
    this.truckEmojiPlane = null;
    this.truckEmojiTexture = null;
    this.truckQueued = 0;

    const nextTruck = this.waitingTrucks.shift() ?? null;
    if (nextTruck) {
      this.assignTruckRoute(
        nextTruck,
        [
          ...this.buildQueueRouteToSlot(nextTruck.root.getAbsolutePosition().clone(), 0),
          this.truckQueueApproachPoint,
          this.truckLoadSlot,
        ],
        'advancing',
        'loading',
      );
    }

    for (let i = 0; i < this.waitingTrucks.length; i += 1) {
      const waitingTruck = this.waitingTrucks[i];
      const targetSlot = this.truckQueueSlots[i] ?? this.truckQueueSlots[this.truckQueueSlots.length - 1];
      if (!targetSlot) continue;
      this.assignTruckRoute(
        waitingTruck,
        this.buildQueueRouteToSlot(waitingTruck.root.getAbsolutePosition().clone(), i),
        'advancing',
        'waiting',
      );
    }
  }

  private updateTruck(deltaTime: number): void {
    for (const truck of this.truckRuntimes) {
      this.updateTruckRouteMove(truck, deltaTime);
    }

    this.ensureTruckFlow();

    if (!this.loadingTruck || this.loadingTruck.state !== 'loading') {
      this.updateTruckEmoji(false);
      return;
    }

    this.truckIdleT += deltaTime;
    this.updateTruckEmoji(this.truckIdleT >= this.truckWaitEmojiDelay && this.loadingTruck.load === 0);
  }

  private updateTruckRouteMove(truck: TruckRuntime, deltaTime: number): void {
    if (truck.route.length < 2 || truck.routeIndex >= truck.route.length - 1) return;

    const start = truck.route[truck.routeIndex];
    const target = truck.route[truck.routeIndex + 1];
    const segmentLength = Math.max(0.001, Vector3.Distance(start, target));
    const speed = truck.state === 'departing'
      ? this.truckDepartingSpeed
      : truck.state === 'recycling'
        ? this.truckRespawningSpeed
        : this.truckAdvancingSpeed;

    this.faceTruckAlongSegment(truck.root, start, target);
    truck.moveT = Math.min(1, truck.moveT + (deltaTime * speed) / segmentLength);
    truck.root.setAbsolutePosition(Vector3.Lerp(start, target, truck.moveT));
    if (truck.moveT < 1) return;

    truck.routeIndex += 1;
    truck.moveT = 0;
    if (truck.routeIndex < truck.route.length - 1) return;

    this.finishTruckRoute(truck);
  }

  private finishTruckRoute(truck: TruckRuntime): void {
    const nextState = truck.nextState;
    truck.route = [];
    truck.routeIndex = 0;
    truck.moveT = 0;

    if (truck.state === 'departing' && nextState === 'recycling') {
      this.recycleTruckToQueueTail(truck);
      return;
    }

    truck.state = nextState;

    if (nextState === 'loading') {
      this.loadingTruck = truck;
      this.alignLoadingTruckFacing(truck);
      const { plane, texture } = this.attachTruckEmoji(truck.root);
      this.truckEmojiPlane = plane;
      this.truckEmojiTexture = texture;
      this.truckIdleT = 0;
      return;
    }

    if (nextState === 'waiting') {
      if (!this.waitingTrucks.includes(truck)) {
        this.waitingTrucks.push(truck);
      }
      const queueIndex = this.getNearestTruckQueueSlotIndex(truck.root.getAbsolutePosition());
      if (queueIndex >= 0) {
        this.alignWaitingTruckFacing(truck, queueIndex);
      }
    }
  }

  private assignTruckRoute(truck: TruckRuntime, points: Array<Vector3 | undefined>, state: TruckState, nextState: TruckState): void {
    const route: Vector3[] = [];
    for (const point of points) {
      if (!point) continue;
      const clone = point.clone();
      if (route.length > 0 && Vector3.DistanceSquared(route[route.length - 1], clone) <= 0.0001) continue;
      route.push(clone);
    }
    if (route.length < 2) {
      truck.state = nextState;
      truck.nextState = nextState;
      if (nextState === 'loading') {
        this.alignLoadingTruckFacing(truck);
      } else if (nextState === 'waiting') {
        const queueIndex = this.getNearestTruckQueueSlotIndex(truck.root.getAbsolutePosition());
        if (queueIndex >= 0) {
          this.alignWaitingTruckFacing(truck, queueIndex);
        }
      }
      return;
    }
    truck.state = state;
    truck.nextState = nextState;
    truck.route = route;
    truck.routeIndex = 0;
    truck.moveT = 0;
  }

  private recycleTruckToQueueTail(truck: TruckRuntime): void {
    this.clearTruckCargoAndEmoji(truck.root);
    this.player.clearDeliveredTruckBoardsForParent(truck.root);
    truck.load = 0;
    truck.root.setEnabled(false);

    const tailSlot = this.truckQueueSlots[this.truckQueueSlots.length - 1] ?? this.truckLoadSlot;
    truck.root.setAbsolutePosition(tailSlot);
    truck.root.setEnabled(true);
    truck.state = 'waiting';
    truck.nextState = 'waiting';
    truck.route = [];
    truck.routeIndex = 0;
    truck.moveT = 0;

    if (!this.waitingTrucks.includes(truck)) {
      this.waitingTrucks.push(truck);
    }

    this.ensureTruckFlow();
  }

  private ensureTruckFlow(): void {
    if (this.loadingTruck && this.loadingTruck.state === 'loading') return;
    if (this.truckRuntimes.some((truck) => truck.route.length >= 2)) return;
    if (this.truckRuntimes.length === 0) return;

    const runtimeOrder = new Map(this.truckRuntimes.map((truck, index) => [truck, index]));
    const orderedTrucks = [...this.truckRuntimes].sort((a, b) => {
      const aDist = Vector3.DistanceSquared(a.root.getAbsolutePosition(), this.truckLoadSlot);
      const bDist = Vector3.DistanceSquared(b.root.getAbsolutePosition(), this.truckLoadSlot);
      if (Math.abs(aDist - bDist) > 0.0001) return aDist - bDist;
      return (runtimeOrder.get(a) ?? 0) - (runtimeOrder.get(b) ?? 0);
    });
    const nextLoadingTruck = orderedTrucks.shift();
    if (!nextLoadingTruck) return;

    this.waitingTrucks.length = 0;
    this.loadingTruck = null;
    this.resetTruckRuntime(nextLoadingTruck, 'loading', this.truckLoadSlot);
    this.loadingTruck = nextLoadingTruck;

    for (let i = 0; i < orderedTrucks.length; i += 1) {
      const truck = orderedTrucks[i];
      const slot = this.truckQueueSlots[i] ?? this.truckQueueSlots[this.truckQueueSlots.length - 1] ?? this.truckLoadSlot;
      this.resetTruckRuntime(truck, 'waiting', slot);
      this.alignWaitingTruckFacing(truck, i);
      this.waitingTrucks.push(truck);
    }

    this.truckEmojiPlane?.dispose();
    this.truckEmojiTexture?.dispose();
    const { plane, texture } = this.attachTruckEmoji(nextLoadingTruck.root);
    this.truckEmojiPlane = plane;
    this.truckEmojiTexture = texture;
    this.truckIdleT = 0;
  }

  private resetTruckRuntime(truck: TruckRuntime, state: TruckState, position: Vector3): void {
    truck.state = state;
    truck.nextState = state;
    truck.route = [];
    truck.routeIndex = 0;
    truck.moveT = 0;
    truck.load = 0;
    truck.root.setEnabled(true);
    truck.root.setAbsolutePosition(position);
    this.clearTruckCargoAndEmoji(truck.root);
  }

  private alignWaitingTruckFacing(truck: TruckRuntime, queueIndex: number): void {
    const alignedYaw = queueIndex === 0
      ? -Math.PI * 0.5
      : queueIndex === 1 || queueIndex === 2
        ? Math.PI
        : null;
    if (alignedYaw != null) {
      truck.root.rotation.y = alignedYaw;
      return;
    }

    const start = truck.root.getAbsolutePosition();
    const target = this.truckQueueSlots[queueIndex - 1] ?? this.truckQueueTurnPoint;
    this.faceTruckAlongSegment(truck.root, start, target);
  }

  private alignLoadingTruckFacing(truck: TruckRuntime): void {
    truck.root.rotation.y = -Math.PI * 0.5;
  }

  private buildQueueRouteToSlot(start: Vector3, targetSlotIndex: number): Vector3[] {
    const targetSlot = this.truckQueueSlots[targetSlotIndex];
    if (!targetSlot) return [start.clone()];

    const route = [start.clone()];
    const currentSlotIndex = this.getNearestTruckQueueSlotIndex(start);
    if (currentSlotIndex < 0) {
      route.push(targetSlot);
      return route;
    }

    if (currentSlotIndex === targetSlotIndex) return route;

    const step = currentSlotIndex < targetSlotIndex ? 1 : -1;
    for (let index = currentSlotIndex + step; step > 0 ? index <= targetSlotIndex : index >= targetSlotIndex; index += step) {
      const slot = this.truckQueueSlots[index];
      if (index === 0 && step < 0) route.push(this.truckQueueTurnPoint);
      if (slot) route.push(slot);
    }
    return route;
  }

  private getNearestTruckQueueSlotIndex(position: Vector3): number {
    let nearestIndex = -1;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < this.truckQueueSlots.length; i += 1) {
      const slot = this.truckQueueSlots[i];
      const distance = Vector3.DistanceSquared(position, slot);
      if (distance >= nearestDistance) continue;
      nearestDistance = distance;
      nearestIndex = i;
    }
    return nearestIndex;
  }

  private faceTruckAlongSegment(root: TransformNode, start: Vector3, target: Vector3): void {
    const direction = target.subtract(start);
    direction.y = 0;
    if (direction.lengthSquared() <= 0.0001) return;
    root.rotation.y = Math.atan2(direction.x, direction.z);
  }

  private clearTruckCargoAndEmoji(root: TransformNode): void {
    root.getChildMeshes(false)
      .filter((mesh) => mesh.name.startsWith('guide_truck_emoji_'))
      .forEach((mesh) => this.disposeTruckVisualMesh(mesh));
    root.getChildMeshes(false)
      .filter((mesh) => mesh.name.startsWith('collect_table_truck_board_'))
      .forEach((mesh) => mesh.dispose());
  }

  private clearTruckEmoji(root: TransformNode): void {
    root.getChildMeshes(false)
      .filter((mesh) => mesh.name.startsWith('guide_truck_emoji_'))
      .forEach((mesh) => this.disposeTruckVisualMesh(mesh));
  }

  private disposeTruckVisualMesh(mesh: AbstractMesh): void {
    const material = mesh.material;
    if (material) {
      const standardMaterial = material as StandardMaterial;
      standardMaterial.diffuseTexture?.dispose();
      standardMaterial.opacityTexture?.dispose();
      standardMaterial.emissiveTexture?.dispose();
      material.dispose();
    }
    mesh.dispose();
  }

  private getTruckRedSquareBoardPlacement(loadCount: number): { position: Vector3; scale: number; yaw: number } {
    const plankSize = this.getStarterRewardBoardWorldSize();
    const redSquare = this.scene.getMeshByName('overlay_truck_rear_red_square');
    if (redSquare) {
      const bbox = redSquare.getBoundingInfo().boundingBox;
      const min = bbox.minimumWorld;
      const max = bbox.maximumWorld;
      const centerX = (min.x + max.x) * 0.5;
      const depth = max.z - min.z;
      const index = Math.max(0, loadCount - 1);
      const slotDepth = depth / 4;
      const scale = plankSize
        ? Math.min(1.08, Math.max(0.72, slotDepth / Math.max(0.001, plankSize.z)))
        : 0.95;
      return {
        position: new Vector3(
          centerX,
          max.y + (plankSize ? plankSize.y * scale * 0.5 : 0.03) + 0.006,
          min.z + slotDepth * (Math.min(index, 3) + 0.5),
        ),
        scale,
        yaw: Math.PI,
      };
    }

    const index = Math.max(0, loadCount - 1);
    return {
      position: this.truckLoadSquare.add(new Vector3(0, 0.12, -0.36 + Math.min(index, 3) * 0.24)),
      scale: 0.95,
      yaw: Math.PI,
    };
  }

  private getStarterRewardBoardWorldSize(): Vector3 | null {
    const node = this.scene.getTransformNodeById('starter_plank_yellow_1') ?? this.scene.getTransformNodeByName('starter_plank_yellow_1');
    const mesh = node?.getChildMeshes(false).find((child) => child.getTotalVertices() > 0);
    if (!mesh) return null;

    const bbox = mesh.getBoundingInfo().boundingBox;
    return new Vector3(
      bbox.maximumWorld.x - bbox.minimumWorld.x,
      bbox.maximumWorld.y - bbox.minimumWorld.y,
      bbox.maximumWorld.z - bbox.minimumWorld.z,
    );
  }

  private spawnRewardCashBurst(count: number): void {
    if (!this.loadingTruck || count <= 0) return;

    const targets: Vector3[] = [];
    for (let i = 0; i < count; i += 1) {
      const slotIndex = this.reserveNextRewardCashSlot(targets);
      targets.push(this.getRewardCashSlotTarget(slotIndex));
    }

    const origin = this.loadingTruck.root.getAbsolutePosition().clone();
    origin.y = Math.max(origin.y + 0.75, 0.75);
    this.player.spawnGroundCashFromOriginToTargets(origin, targets, this.loadingTruck.root);
  }

  private reserveNextRewardCashSlot(pendingTargets: Vector3[] = []): number {
    const occupied = this.player.getGroundCashPositions().filter((position) => this.isInsideRewardCashStackArea(position));
    occupied.push(...pendingTargets.map((target) => target.clone()));

    for (let slotIndex = 0; slotIndex < 256; slotIndex += 1) {
      const target = this.getRewardCashSlotTarget(slotIndex);
      const isOccupied = occupied.some((position) => Vector3.DistanceSquared(position, target) <= 0.0004);
      if (!isOccupied) return slotIndex;
    }
    return occupied.length;
  }

  private getRewardCashSlotTarget(slotIndex: number): Vector3 {
    const { width, height, depth } = this.player.getCashVisualDimensions();
    const cols = 2;
    const rows = 2;
    const perLayer = cols * rows;
    const layer = Math.floor(slotIndex / perLayer);
    const inLayer = slotIndex % perLayer;
    const col = inLayer % cols;
    const row = Math.floor(inLayer / cols);
    const xSpacing = width + 0.002;
    const zSpacing = depth + 0.002;
    const ySpacing = height + 0.002;
    const baseX = this.rewardCashStackBase.x - xSpacing * 0.5;
    const baseZ = this.rewardCashStackBase.z - zSpacing * 0.5;
    return new Vector3(
      baseX + col * xSpacing,
      this.rewardCashStackBase.y + layer * ySpacing,
      baseZ + row * zSpacing,
    );
  }

  private isInsideRewardCashStackArea(position: Vector3): boolean {
    const { width, depth } = this.player.getCashVisualDimensions();
    return Math.abs(position.x - this.rewardCashStackBase.x) <= width
      && Math.abs(position.z - this.rewardCashStackBase.z) <= depth;
  }

  private hideInitialConveyors(): void {
    for (const id of ['conveyor_left', 'conveyor_right']) {
      const node = this.scene.getTransformNodeById(id)
        ?? this.scene.getTransformNodeByName(id);
      node?.setEnabled(false);
    }
  }

  private updateTruckEmoji(show: boolean): void {
    if (!this.truckEmojiPlane || !this.truckEmojiTexture) return;
    this.truckEmojiPlane.isVisible = show;
    if (!show) return;

    const ctx = this.truckEmojiTexture.getContext();
    ctx.clearRect(0, 0, 256, 192);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 256, 192);
    ctx.fillStyle = '#ffd800';
    ctx.font = 'bold 120px sans-serif';
    (ctx as any).textAlign = 'center';
    (ctx as any).textBaseline = 'middle';
    ctx.fillText('!', 128, 104);
    this.truckEmojiTexture.update();
  }

  private updateGateUnlockAnimation(deltaTime: number): void {
    if (!this.gateUnlockAnimActive) return;

    this.gateUnlockAnimTime += deltaTime;
    const t = this.gateUnlockAnimTime;

    if (this.lockMesh) {
      const openT = Math.min(1, t / 0.22);
      const shrinkT = Math.min(1, Math.max(0, (t - 0.22) / 0.38));
      this.lockMesh.rotation.z = -openT * 0.35;
      const scale = 1 - shrinkT * 0.94;
      this.lockMesh.scaling.setAll(scale);
      this.lockMesh.position.y = 0.4 + shrinkT * 0.15;
      if (t >= 0.62) {
        this.lockMesh.dispose();
        this.lockMesh = null;
      }
    }

    if (this.gateNodes.length > 0) {
      const openT = Math.min(1, t / 0.85);
      const easedOpen = openT * openT * (3 - 2 * openT);
      for (const gateNode of this.gateNodes) {
        const closedPosition = this.gateClosedPositionById.get(gateNode.id);
        const closedYaw = this.gateClosedYawById.get(gateNode.id) ?? gateNode.rotation.y;
        const openYaw = this.gateOpenYawById.get(gateNode.id) ?? gateNode.rotation.y;
        if (closedPosition) {
          gateNode.position.copyFrom(closedPosition);
        }
        gateNode.rotation.y = closedYaw + (openYaw - closedYaw) * easedOpen;
      }
      this.updateGateLockUnlockAnimation(easedOpen);
    }

    if (t >= 1.05) {
      this.gateUnlockAnimActive = false;
    }
  }

  private updateGateLockUnlockAnimation(progress: number): void {
    const visibleScale = Math.max(0, 1 - progress);
    for (const lockNode of this.gateLockNodes) {
      const baseScaling = this.gateLockBaseScalingById.get(lockNode.id);
      const basePosition = this.gateLockBasePositionById.get(lockNode.id);
      if (!baseScaling || !basePosition) continue;

      lockNode.scaling.set(
        baseScaling.x * visibleScale,
        baseScaling.y * visibleScale,
        baseScaling.z * visibleScale,
      );
      lockNode.position.set(
        basePosition.x,
        basePosition.y + progress * 0.16,
        basePosition.z,
      );

      const visible = visibleScale > 0.02;
      lockNode.setEnabled(visible);
      for (const mesh of lockNode.getChildMeshes(false)) {
        mesh.setEnabled(visible);
        mesh.isVisible = visible;
        mesh.visibility = visible ? visibleScale : 0;
      }
    }
  }

  private updateExpansionDoorUnlockAnimation(deltaTime: number): void {
    if (!this.expansionDoorUnlockAnimActive) return;

    this.expansionDoorUnlockAnimTime += deltaTime;
    const t = this.expansionDoorUnlockAnimTime;
    const openT = Math.min(1, t / 0.85);
    const easedOpen = 1 - Math.pow(1 - openT, 3);

    for (const doorNode of this.expansionDoorNodes) {
      const closedYaw = this.expansionDoorClosedYawById.get(doorNode.id);
      const openYaw = this.expansionDoorOpenYawById.get(doorNode.id);
      const closedPosition = this.expansionDoorClosedPositionById.get(doorNode.id);
      if (closedYaw === undefined || openYaw === undefined || !closedPosition) continue;

      doorNode.setEnabled(true);
      doorNode.position.copyFrom(closedPosition);
      doorNode.rotation.y = closedYaw + (openYaw - closedYaw) * easedOpen;
    }

    if (t >= 1.05) {
      this.expansionDoorUnlockAnimActive = false;
    }
  }

  private beginGateCashDelivery(count: number): boolean {
    const targets = this.buildGateCashTargets(count, this.gatePaymentPendingBills);
    const launched = this.player.releaseCarriedCashToTargets(targets);
    if (launched <= 0) return false;
    this.gatePaymentPendingBills += launched;
    return true;
  }

  private beginExpansionCashDelivery(count: number): boolean {
    const targets = this.buildExpansionCashTargets(count, this.expansionPaymentPendingBills);
    const launched = this.player.releaseCarriedCashToTargets(targets);
    if (launched <= 0) return false;
    this.expansionPaymentPendingBills += launched;
    return true;
  }

  private beginConveyorCashDelivery(count: number): boolean {
    const targets = this.buildConveyorCashTargets(count, this.conveyorPaymentPendingBills);
    const launched = this.player.releaseCarriedCashToTargets(targets);
    if (launched <= 0) return false;
    this.conveyorPaymentPendingBills += launched;
    return true;
  }

  private beginSellConveyorCashDelivery(count: number): boolean {
    const targets = this.buildSellConveyorCashTargets(count, this.sellConveyorPaymentPendingBills);
    const launched = this.player.releaseCarriedCashToTargets(targets);
    if (launched <= 0) return false;
    this.sellConveyorPaymentPendingBills += launched;
    return true;
  }

  private beginToolUpgradeCashDelivery(count: number): boolean {
    const targets = this.buildToolUpgradeCashTargets(count, this.toolUpgradePaymentPendingBills);
    const launched = this.player.releaseCarriedCashToTargets(targets);
    if (launched <= 0) return false;
    this.toolUpgradePaymentPendingBills += launched;
    return true;
  }

  private buildGateCashTargets(count: number, startIndex = 0): Vector3[] {
    const targets: Vector3[] = [];
    const columns = 3;
    const spacingX = 0.12;
    const spacingY = 0.05;
    const spacingZ = 0.01;

    for (let i = 0; i < count; i += 1) {
      const index = startIndex + i;
      const column = index % columns;
      const row = Math.floor(index / columns);
      const activeColumns = Math.min(columns, count);
      const baseX = this.gateUnlockPaymentTarget.x - ((activeColumns - 1) * spacingX) * 0.5;
      targets.push(new Vector3(
        baseX + column * spacingX,
        this.gateUnlockPaymentTarget.y + row * spacingY,
        this.gateUnlockPaymentTarget.z + (column - 1) * spacingZ,
      ));
    }

    return targets;
  }

  private buildExpansionCashTargets(count: number, startIndex = 0): Vector3[] {
    const targets: Vector3[] = [];
    const columns = 2;
    const spacingX = 0.12;
    const spacingY = 0.05;
    const spacingZ = 0.01;

    for (let i = 0; i < count; i += 1) {
      const index = startIndex + i;
      const column = index % columns;
      const row = Math.floor(index / columns);
      const activeColumns = Math.min(columns, count);
      const baseX = this.expansionUnlockPaymentTarget.x - ((activeColumns - 1) * spacingX) * 0.5;
      targets.push(new Vector3(
        baseX + column * spacingX,
        this.expansionUnlockPaymentTarget.y + row * spacingY,
        this.expansionUnlockPaymentTarget.z + (column - 0.5) * spacingZ,
      ));
    }

    return targets;
  }

  private buildConveyorCashTargets(count: number, startIndex = 0): Vector3[] {
    void startIndex;
    return Array.from({ length: count }, () => this.conveyorUnlockPaymentTarget.clone());
  }

  private buildSellConveyorCashTargets(count: number, startIndex = 0): Vector3[] {
    void startIndex;
    return Array.from({ length: count }, () => this.sellConveyorUnlockPaymentTarget.clone());
  }

  private buildToolUpgradeCashTargets(count: number, startIndex = 0): Vector3[] {
    const targets: Vector3[] = [];
    const columns = 3;
    const spacingX = 0.12;
    const spacingY = 0.05;
    const spacingZ = 0.01;

    for (let i = 0; i < count; i += 1) {
      const index = startIndex + i;
      const column = index % columns;
      const row = Math.floor(index / columns);
      const activeColumns = Math.min(columns, count);
      const baseX = this.toolUpgradePaymentTarget.x - ((activeColumns - 1) * spacingX) * 0.5;
      targets.push(new Vector3(
        baseX + column * spacingX,
        this.toolUpgradePaymentTarget.y + row * spacingY,
        this.toolUpgradePaymentTarget.z + (column - 1) * spacingZ,
      ));
    }

    return targets;
  }

  private completeForestUnlock(): void {
    if (this.gateUnlocked) return;

    this.gateUnlocked = true;
    this.gateUnlockPaidAmount = this.forestUnlockCost;
    this.gateUnlockReadyToComplete = false;
    this.gateUnlockPaymentCooldown = 0;
    this.gatePaymentPendingBills = 0;
    this.gateUnlockAnimActive = true;
    this.gateUnlockAnimTime = 0;
    this.step = 'unlock_forest';
    this.gateUnlockDecalHideTime = 0.32;

    playDoorUnlockVFX(this.scene, new Vector3(-0.175, 0, -3.71));

    const decalGroup = this.scene.getTransformNodeById('collect_table_expand_decal');
    if (decalGroup) {
      decalGroup.setEnabled(false);
      decalGroup.getChildMeshes(false).forEach((m) => { m.isVisible = false; });
    }
  }

  private completeExpansionUnlock(): void {
    if (this.expansionUnlocked) return;

    this.expansionUnlocked = true;
    this.expansionPaidAmount = this.expansionUnlockCost;
    this.expansionReadyToComplete = false;
    this.expansionPaymentCooldown = 0;
    this.expansionPaymentPendingBills = 0;
    this.expansionDoorUnlockAnimActive = true;
    this.expansionDoorUnlockAnimTime = 0;
    this.expansionDecalHideTime = 0.32;
  }

  private completeConveyorUnlock(): void {
    if (this.conveyorUnlocked) return;

    this.conveyorUnlocked = true;
    this.conveyorPaidAmount = this.conveyorUnlockCost;
    this.conveyorReadyToComplete = false;
    this.conveyorPaymentCooldown = 0;
    this.conveyorPaymentPendingBills = 0;
    this.conveyorUnlockDecalBurstTime = 0.18;
    this.conveyorUnlockDecalHideTime = 0.32;
    const conveyorNode = this.scene.getTransformNodeById('conveyor_right') ?? this.scene.getTransformNodeByName('conveyor_right');
    conveyorNode?.setEnabled(true);
    this.startConveyorArrowAnimation(
      ['conveyor_arrow_2', 'conveyor_arrow_3', 'conveyor_arrow_4', 'conveyor_arrow_5'],
      this.conveyorArrowRuntimes,
      this.getMainConveyorArrowPath(),
      this.conveyorFlightSpeed * 0.45,
    );
    this.player.setPosition(new Vector3(4.70, 0, -5.05));
  }

  private completeSellConveyorUnlock(): void {
    if (this.sellConveyorUnlocked) return;

    this.sellConveyorUnlocked = true;
    this.sellConveyorPaidAmount = this.sellConveyorUnlockCost;
    this.sellConveyorReadyToComplete = false;
    this.sellConveyorPaymentCooldown = 0;
    this.sellConveyorPaymentPendingBills = 0;
    this.sellConveyorUnlockDecalBurstTime = 0.18;
    this.sellConveyorUnlockDecalHideTime = 0.32;
    const conveyorNode = this.scene.getTransformNodeById('conveyor_left') ?? this.scene.getTransformNodeByName('conveyor_left');
    conveyorNode?.setEnabled(true);
    const expansionDecalRoot = this.scene.getTransformNodeById('player_expand_decal') ?? this.scene.getTransformNodeByName('扩建地贴');
    if (expansionDecalRoot && !this.expansionUnlocked) {
      expansionDecalRoot.setEnabled(true);
      for (const child of expansionDecalRoot.getChildMeshes(false)) {
        child.setEnabled(true);
        child.isVisible = true;
        child.visibility = 1;
        child.isPickable = false;
      }
      if (this.expansionDecalMesh && !this.expansionDecalMesh.isDisposed()) {
        this.expansionDecalMesh.visibility = 1;
        this.expansionDecalMesh.setEnabled(true);
      }
    }
    this.startConveyorArrowAnimation(
      ['conveyor_left_arrow_1', 'conveyor_left_arrow_2', 'conveyor_left_arrow_3', 'conveyor_left_arrow_4', 'conveyor_left_arrow_5'],
      this.sellConveyorArrowRuntimes,
      this.getSellConveyorArrowPath(),
      this.sellConveyorFlightSpeed * 0.45,
    );
    this.player.setPosition(new Vector3(3.32, 0, -8.96));
  }

  private startConveyorArrowAnimation(
    ids: string[],
    runtimes: ConveyorArrowRuntime[],
    points: Vector3[],
    speed: number,
  ): void {
    runtimes.length = 0;
    for (const id of ids) {
      const mesh = this.scene.getMeshById(id) ?? this.scene.getMeshByName(id);
      if (!(mesh instanceof Mesh)) continue;
      const runtime: ConveyorArrowRuntime = {
        mesh,
        points: points.map((point) => point.clone()),
        progress: this.getConveyorPathProgressAtPosition(mesh.position, points),
        speed,
      };
      this.applyConveyorArrowPose(runtime);
      mesh.setEnabled(true);
      runtimes.push(runtime);
    }
  }

  private getMainConveyorArrowPath(): Vector3[] {
    const y = this.scene.getMeshById('conveyor_arrow_2')?.position.y ?? 0.4;
    const xOffset = 0.08;
    return [
      new Vector3(this.conveyorPickupPoint.x + xOffset, y, this.conveyorPickupPoint.z),
      new Vector3(this.conveyorSlideEndPoint.x + xOffset, y, this.conveyorSlideEndPoint.z),
    ];
  }

  private getSellConveyorArrowPath(): Vector3[] {
    const activePath = this.sellConveyorArrowRuntimes[0]?.points;
    if (activePath && activePath.length >= 2) {
      return activePath.map((point) => point.clone());
    }

    const first = this.scene.getMeshById('conveyor_left_arrow_1') ?? this.scene.getMeshByName('conveyor_left_arrow_1');
    const last = this.scene.getMeshById('conveyor_left_arrow_5') ?? this.scene.getMeshByName('conveyor_left_arrow_5');
    if (first && last) {
      return [last.position.clone(), first.position.clone()];
    }
    return [new Vector3(4.64, 0.4, -9.85), new Vector3(2.47, 0.4, -9.85)];
  }

  private getNearestSellConveyorArrowRuntime(position: Vector3): ConveyorArrowRuntime | null {
    let best: ConveyorArrowRuntime | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const runtime of this.sellConveyorArrowRuntimes) {
      if (!runtime.mesh || runtime.mesh.isDisposed() || !runtime.mesh.isEnabled()) continue;
      const distance = Vector3.DistanceSquared(position, runtime.mesh.position);
      if (distance >= bestDistance) continue;
      best = runtime;
      bestDistance = distance;
    }
    return best;
  }

  private getCollectTableBoardStackCenter(): Vector3 {
    const table = this.scene.getTransformNodeById('collect_table') ?? this.scene.getTransformNodeByName('置物台');
    const position = table?.getAbsolutePosition();
    if (position) return new Vector3(position.x + 0.2, 0.56, position.z - 0.2);
    return new Vector3(0.86, 0.56, -10.06);
  }

  private getSellQueueBoardStackPosition(index: number): Vector3 {
    return this.getMachineBoardStackPosition(this.getCollectTableBoardStackCenter(), index, 3, 0.04);
  }

  private getConveyorPathProgressAtPosition(position: Vector3, points: Vector3[]): number {
    const total = this.getConveyorPathLength(points);
    let walked = 0;
    let bestProgress = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      const segment = b.subtract(a);
      const segmentLenSq = segment.lengthSquared();
      if (segmentLenSq <= 0.0001) continue;

      const localT = Math.max(0, Math.min(1, Vector3.Dot(position.subtract(a), segment) / segmentLenSq));
      const candidate = Vector3.Lerp(a, b, localT);
      const distance = Vector3.DistanceSquared(position, candidate);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestProgress = (walked + Math.sqrt(segmentLenSq) * localT) / total;
      }
      walked += Math.sqrt(segmentLenSq);
    }

    return Math.max(0, Math.min(1, bestProgress));
  }

  private applyConveyorArrowPose(runtime: ConveyorArrowRuntime): void {
    const pose = this.sampleConveyorPath(runtime.points, runtime.progress);
    runtime.mesh.position.copyFrom(pose.position);
    runtime.mesh.rotation.y = Math.atan2(pose.direction.x, pose.direction.z);
  }

  private completeToolUpgrade(): void {
    if (this.toolUpgradeUnlocked) return;

    this.toolUpgradeUnlocked = true;
    this.toolUpgradePaidAmount = this.toolUpgradeCost;
    this.toolUpgradeReadyToComplete = false;
    this.toolUpgradePaymentCooldown = 0;
    this.toolUpgradePaymentPendingBills = 0;
    this.toolUpgradeDecalBurstTime = 0.18;
    this.toolUpgradeDecalHideTime = 0.32;
    this.player.upgradeToLv2Truck();
    this.conveyorGroundDecalsVisible = true;
    this.syncConveyorGroundDecalVisibility();
    void this.replaceForestShowcaseTruckWithLv3();
  }

  private async replaceForestShowcaseTruckWithLv3(): Promise<void> {
    if (this.forestShowcaseTruckLv3Root) {
      this.forestShowcaseTruckLv3Root.setEnabled(true);
      const oldNode = this.scene.getTransformNodeById('truck_lv2_forest_front') ?? this.scene.getTransformNodeByName('truck_lv2_forest_front');
      oldNode?.setEnabled(false);
      return;
    }
    if (this.forestShowcaseTruckLv3LoadStarted) return;

    const oldNode = this.scene.getTransformNodeById('truck_lv2_forest_front') ?? this.scene.getTransformNodeByName('truck_lv2_forest_front');
    if (!oldNode) return;

    this.forestShowcaseTruckLv3LoadStarted = true;
    oldNode.setEnabled(false);

    try {
      const modelInfo = await getModelPathAndFileAsync(truckLv3GlbUrl);
      const imported = await SceneLoader.ImportMeshAsync(
        '',
        modelInfo.path,
        modelInfo.filename,
        this.scene,
        undefined,
        modelInfo.isDataUrl || modelInfo.isCompressed ? '.glb' : undefined,
      );
      if (this.scene.isDisposed) {
        imported.meshes.forEach((mesh) => mesh.dispose());
        imported.animationGroups.forEach((group) => group.dispose());
        return;
      }

      const runtimeRoot = new TransformNode('truck_lv3_forest_front_runtime', this.scene);
      runtimeRoot.parent = oldNode.parent as TransformNode | null;
      runtimeRoot.position.copyFrom(oldNode.position);
      runtimeRoot.rotation.copyFrom(oldNode.rotation);
      runtimeRoot.rotationQuaternion = oldNode.rotationQuaternion?.clone() ?? null;
      runtimeRoot.scaling.copyFrom(oldNode.scaling);

      const meshSet = new Set(imported.meshes);
      for (const mesh of imported.meshes) {
        if (mesh.parent && meshSet.has(mesh.parent as any)) continue;
        mesh.parent = runtimeRoot;
      }

      imported.animationGroups.forEach((group) => group.dispose());
      this.forestShowcaseTruckLv3Root = runtimeRoot;
    } catch (error) {
      oldNode.setEnabled(true);
      console.warn('[NewbieGuideSystem] Failed to replace showcase truck with lv3 model.', error);
    } finally {
      this.forestShowcaseTruckLv3LoadStarted = false;
    }
  }

  private clearMachineBoardStack(meshes: Mesh[]): void {
    for (const mesh of meshes) {
      mesh.dispose();
    }
    meshes.length = 0;
  }

  private syncMachineBoardStack(
    meshes: Mesh[],
    count: number,
    center: Vector3,
    namePrefix: string,
    clampToOneLayer: boolean,
    itemsPerLayer = this.machineStackPerLayer,
    baseYOffset = 0,
  ): void {
    const perLayer = Math.max(1, itemsPerLayer);
    const boardDepth = 0.3;
    const boardHeight = 0.08;

    const visibleCount = clampToOneLayer ? Math.min(perLayer, Math.max(0, count)) : Math.max(0, count);
    while (meshes.length > visibleCount) {
      const m = meshes.pop();
      m?.dispose();
    }

    while (meshes.length < visibleCount) {
      const idx = meshes.length;
      const mesh = this.createSawmillOutputBoardMesh(`${namePrefix}_${idx}`);
      meshes.push(mesh);
    }

    for (let i = 0; i < meshes.length; i += 1) {
      const mesh = meshes[i];
      mesh.position.copyFrom(this.getMachineBoardStackPosition(center, i, perLayer, baseYOffset, boardDepth, boardHeight));
      mesh.rotation.y = Math.PI;
    }
  }

  private getMachineBoardStackPosition(
    center: Vector3,
    index: number,
    perLayer: number,
    baseYOffset: number,
    boardDepth = 0.18,
    boardHeight = 0.08,
  ): Vector3 {
    const layer = Math.floor(index / perLayer);
    const col = index % perLayer;
    const startZ = center.z - ((perLayer - 1) * boardDepth) * 0.5;
    return new Vector3(
      center.x,
      center.y + baseYOffset + layer * boardHeight,
      startZ + col * boardDepth,
    );
  }

}
