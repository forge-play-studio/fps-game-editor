import { describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';

import { configService } from '../../.local/pa_template/src/config';
import type { SceneConfig, ScenePrimitiveNode } from '../../.local/pa_template/src/config';
import { SceneBuilder } from '../../.local/pa_template/src/services/SceneBuilder';

describe('pa_template SceneBuilder material kind projection', () => {
  it('creates primitive runtime materials from bound material asset kind', () => {
    const previousSceneDocument = structuredClone(configService.getSceneDocument());
    const { engine, scene } = createScene();

    try {
      configService.replaceSceneDocument(createMaterialKindSceneDocument());
      const builder = new SceneBuilder(scene, {} as any);

      const pbrNode = (builder as any).createPrimitiveRuntimeNode(createPrimitiveNode('pbr_plane', 'mat_pbr'));
      expect((pbrNode as any).material).toBeInstanceOf(PBRMaterial);

      const standardNodeConfig = createPrimitiveNode('standard_plane', 'mat_standard');
      const standardNode = (builder as any).createPrimitiveRuntimeNode(standardNodeConfig);
      const initialStandardRoughness = (standardNode as any).material.roughness;
      (builder as any).applySceneNodeOverrides(standardNodeConfig, standardNode);

      expect((standardNode as any).material).toBeInstanceOf(StandardMaterial);
      expect('metallic' in (standardNode as any).material).toBe(false);
      expect((standardNode as any).material.roughness).toBe(initialStandardRoughness);
      expect((standardNode as any).material.diffuseColor.r).toBeCloseTo(1);
      expect((standardNode as any).material.diffuseColor.g).toBeCloseTo(0.2);
      expect((standardNode as any).material.diffuseColor.b).toBeCloseTo(0.1);
    } finally {
      configService.replaceSceneDocument(previousSceneDocument as SceneConfig);
      scene.dispose();
      engine.dispose();
    }
  });
});

function createScene(): { engine: NullEngine; scene: Scene } {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  return { engine, scene };
}

function createMaterialKindSceneDocument(): SceneConfig {
  return {
    scene: {
      rootId: 'root',
      assets: [],
      nodes: [],
      materialAssets: [
        {
          id: 'mat_pbr',
          name: 'PBR Test',
          materialKind: 'pbr',
          profile: { metallic: 0.5, roughness: 0.25 },
        },
        {
          id: 'mat_standard',
          name: 'Standard Test',
          materialKind: 'standard',
          profile: {
            baseColor: { color: { r: 1, g: 0.2, b: 0.1 } },
            metallic: 0.5,
            roughness: 0.25,
          },
        },
      ],
      materials: [],
      textures: [],
    },
  } as SceneConfig;
}

function createPrimitiveNode(id: string, materialAssetId: string): ScenePrimitiveNode {
  return {
    id,
    kind: 'primitive',
    primitive: { shape: 'plane' },
    overrides: {
      materialBinding: { materialAssetId },
    },
  };
}
