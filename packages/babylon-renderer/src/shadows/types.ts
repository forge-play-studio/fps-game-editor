import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';

export interface PlanarShadowVec3 {
  x: number;
  y: number;
  z: number;
}

export interface PlanarShadowColorRGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface PlanarShadowPlaneOptions {
  normal: PlanarShadowVec3;
  height: number;
  bias: number;
}

export interface PlanarShadowAppearanceOptions {
  color: PlanarShadowColorRGBA;
}

export interface PlanarShadowDirectionOptions {
  mode: 'follow-light';
}

export interface PlanarShadowStencilOptions {
  enabled: boolean;
  receiverRenderingGroup?: number;
  shadowRenderingGroup?: number;
}

export interface PlanarShadowCasterOptions {
  autoDetectAll?: boolean;
  includePatterns?: string[];
  excludePatterns?: string[];
  rootBoundaryPatterns?: string[];
  minVolume?: number;
}

export interface PlanarShadowReceiverOptions {
  patterns?: string[];
}

export interface PlanarShadowOptions {
  enabled: boolean;
  plane: PlanarShadowPlaneOptions;
  appearance: PlanarShadowAppearanceOptions;
  direction?: PlanarShadowDirectionOptions;
  stencil?: PlanarShadowStencilOptions;
  casters?: PlanarShadowCasterOptions;
  receivers?: PlanarShadowReceiverOptions;
  debug?: boolean;
}

export interface ResolvedPlanarShadowOptions {
  enabled: boolean;
  plane: PlanarShadowPlaneOptions;
  appearance: PlanarShadowAppearanceOptions;
  direction: PlanarShadowDirectionOptions;
  stencil: Required<PlanarShadowStencilOptions>;
  casters: Required<Pick<PlanarShadowCasterOptions, 'autoDetectAll' | 'includePatterns' | 'excludePatterns' | 'rootBoundaryPatterns' | 'minVolume'>>;
  receivers: Required<PlanarShadowReceiverOptions>;
  debug: boolean;
}

export interface PlanarShadowCasterInfo {
  source: AbstractMesh;
  shadow: AbstractMesh;
  hasSkeleton: boolean;
}

export interface PlanarShadowReceiverInfo {
  mesh: AbstractMesh;
  originalRenderingGroup: number;
  material: { stencil?: { enabled: boolean } } | null;
}

export interface PlanarShadowSystem {
  initialize(): void;
  addCaster(mesh: AbstractMesh): void;
  removeCaster(mesh: AbstractMesh): void;
  addReceiver(mesh: AbstractMesh): void;
  removeReceiver(mesh: AbstractMesh): void;
  enableCasterAutoDetection(patterns: string[]): void;
  enableAutoDetectionForAll(): void;
  refresh(): void;
  setOptions(options: Partial<PlanarShadowOptions>): void;
  getOptions(): ResolvedPlanarShadowOptions;
  getCasterCount(): number;
  getReceiverCount(): number;
  dispose(): void;
}

export const DEFAULT_PLANAR_SHADOW_OPTIONS: ResolvedPlanarShadowOptions = {
  enabled: true,
  plane: {
    normal: { x: 0, y: 1, z: 0 },
    height: 0.05,
    bias: 0.4,
  },
  appearance: {
    color: { r: 0, g: 0, b: 0, a: 0.35 },
  },
  direction: { mode: 'follow-light' },
  stencil: {
    enabled: false,
    receiverRenderingGroup: 0,
    shadowRenderingGroup: 1,
  },
  casters: {
    autoDetectAll: false,
    includePatterns: [],
    excludePatterns: [
      '_planarshadow',
      '_shadow',
      'placeholder',
      'collision',
      'trigger',
      'helper',
      'camera',
      'light',
      'gizmo',
      'grid',
      'ui',
    ],
    rootBoundaryPatterns: [],
    minVolume: 0.001,
  },
  receivers: {
    patterns: [],
  },
  debug: false,
};
