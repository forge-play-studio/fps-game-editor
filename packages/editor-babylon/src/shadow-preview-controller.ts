import {
  createPlanarShadowSystem,
  type PlanarShadowOptions,
  type PlanarShadowSystem,
} from '@fps-games/babylon-renderer';
import type { BabylonEditorProjection } from './projection';
import type { RuntimeScene } from './types';

export interface BabylonEditorPlanarShadowPreviewOptions extends Partial<PlanarShadowOptions> {
  enabled?: boolean;
  directionalLightNodeId?: string | null;
}

export interface BabylonEditorShadowPreviewOptions {
  planar?: BabylonEditorPlanarShadowPreviewOptions | false | null;
}

export interface BabylonEditorShadowPreviewController {
  setOptions(options?: BabylonEditorShadowPreviewOptions | null): void;
  refresh(): void;
  rebuild(): void;
  dispose(): void;
}

export interface BabylonEditorShadowPreviewControllerOptions {
  scene: RuntimeScene;
  projection: BabylonEditorProjection;
  options?: BabylonEditorShadowPreviewOptions | null;
}

type PlanarShadowScene = Parameters<typeof createPlanarShadowSystem>[0];
type PlanarShadowDirectionalLight = Parameters<typeof createPlanarShadowSystem>[1];

export function createBabylonEditorShadowPreviewController(
  options: BabylonEditorShadowPreviewControllerOptions,
): BabylonEditorShadowPreviewController {
  let currentOptions = normalizeShadowPreviewOptions(options.options);
  let planarSystem: PlanarShadowSystem | null = null;
  let planarLight: PlanarShadowDirectionalLight | null = null;

  const disposePlanar = (): void => {
    planarSystem?.dispose();
    planarSystem = null;
    planarLight = null;
  };

  const syncPlanar = (): void => {
    const planarOptions = currentOptions.planar;
    if (!planarOptions || planarOptions.enabled === false) {
      disposePlanar();
      return;
    }
    const light = resolveDirectionalLight(options.projection, planarOptions.directionalLightNodeId ?? null);
    if (!light) {
      disposePlanar();
      return;
    }
    if (!planarSystem || planarLight !== light) {
      disposePlanar();
      planarLight = light;
      planarSystem = createPlanarShadowSystem(
        options.scene as PlanarShadowScene,
        light,
        { ...planarOptions, direction: { mode: 'follow-light' } },
      );
      planarSystem.initialize();
      return;
    }
    planarSystem.setOptions({ ...planarOptions, direction: { mode: 'follow-light' } });
    planarSystem.refresh();
  };

  syncPlanar();

  return {
    setOptions(nextOptions) {
      currentOptions = normalizeShadowPreviewOptions(nextOptions);
      syncPlanar();
    },
    refresh() {
      syncPlanar();
    },
    rebuild() {
      disposePlanar();
      syncPlanar();
    },
    dispose() {
      disposePlanar();
    },
  };
}

function normalizeShadowPreviewOptions(
  options: BabylonEditorShadowPreviewOptions | null | undefined,
): BabylonEditorShadowPreviewOptions {
  return {
    planar: options?.planar ?? null,
  };
}

function resolveDirectionalLight(
  projection: BabylonEditorProjection,
  nodeId: string | null,
): PlanarShadowDirectionalLight | null {
  if (!nodeId) return null;
  const projectedNode = projection.getProjectedNode(nodeId);
  if (!projectedNode) return null;
  for (const runtimeObject of projectedNode.runtimeObjects) {
    if (isDirectionalLight(runtimeObject)) return runtimeObject as PlanarShadowDirectionalLight;
  }
  return null;
}

function isDirectionalLight(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as {
    direction?: unknown;
    metadata?: {
      editorProjection?: {
        runtimeKind?: unknown;
        lightType?: unknown;
      };
    };
  };
  return !!candidate.direction
    && candidate.metadata?.editorProjection?.runtimeKind === 'light'
    && candidate.metadata.editorProjection.lightType === 'directional';
}
