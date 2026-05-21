/**
 * 配置模块入口
 *
 * 统一导出配置类型和配置服务
 */

// 导出所有类型定义
export * from './types';
export {
  assertSceneJsonV2,
  validateSceneJsonV2,
} from './SceneJsonV2Validator';
export type {
  SceneJsonV2ValidationError,
  SceneJsonV2ValidationOptions,
} from './SceneJsonV2Validator';

// 导出配置服务
export { ConfigService, configService } from './ConfigService';
