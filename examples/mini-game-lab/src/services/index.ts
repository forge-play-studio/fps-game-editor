/**
 * Services 模块导出 (Scaffold)
 */

export { AssetLoader } from './AssetLoader';
export type { LoadProgress } from './AssetLoader';
export {
  planAssetRegistration,
  planAssetUnregistration,
  resolveAssetReference,
} from './AssetManager';
export type {
  AssetReference,
  AssetReferenceParams,
  AssetManagerErrorCode,
  AssetRegistrationPlan,
  AssetRegistrationPlanParams,
  AssetTransportCommand,
  AssetTransportPlan,
  AssetTransportWrite,
  AssetUnregistrationPlan,
  AssetUnregistrationPlanParams,
} from './AssetManager';
export {
  createAssetInstance,
  removeAssetInstance,
} from './SceneAssetPlacement';
export type {
  AssetInstanceCreateParams,
  AssetInstancePlacementResult,
} from './SceneAssetPlacement';
export {
  assertSceneAssetSourceUnused,
  findSceneAssetUsageBySourceId,
} from './SceneAssetUsage';
export type { SceneAssetUsage } from './SceneAssetUsage';

export { ModelPool } from './ModelPool';
export type { PooledInstance, ModelConfig } from './ModelPool';

export { AnimationService } from './AnimationService';
export type { PlayOptions } from './AnimationService';

export { AudioService } from './AudioService';
export type { SfxType } from './AudioService';

export { InputService } from './InputService';
export type { MovementInputSource, MovementInputState } from './InputService';

export { SceneBuilder } from './SceneBuilder';
export type { SceneEnvironment } from './SceneBuilder';

export { RenderingService } from './RenderingService';
export { ShadowService } from './ShadowService';
export { MaterialConfigService } from './MaterialConfigService';
export { SceneVfxService } from './SceneVfxService';

// 配置服务（便于服务层直接引用）
export { configService, ConfigService } from '../config';

// 配置校验服务
export { configValidator } from './ConfigValidator';
