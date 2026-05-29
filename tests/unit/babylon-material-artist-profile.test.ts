import { describe, expect, it } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { applyArtistMaterialProfileToRuntimeMaterial } from '@fps-games/editor-babylon';

describe('Babylon artist material profile projection', () => {
  it('applies base color adjustments with saturation neutral at 1', () => {
    const { engine, scene } = createScene();
    const material = new PBRMaterial('paint', scene);
    material.albedoColor = new Color3(0.2, 0.4, 0.6);

    const changed = applyArtistMaterialProfileToRuntimeMaterial(
      material,
      scene,
      {
        baseColor: {
          brightness: 1,
          saturation: 1,
          contrast: 1,
          hue: 0,
        },
      },
      { babylon: BABYLON as any },
    );

    expect(changed).toBe(true);
    expect(material.albedoColor.r).toBeCloseTo(0.2);
    expect(material.albedoColor.g).toBeCloseTo(0.4);
    expect(material.albedoColor.b).toBeCloseTo(0.6);

    applyArtistMaterialProfileToRuntimeMaterial(
      material,
      scene,
      {
        baseColor: {
          color: { r: 0.2, g: 0.4, b: 0.6 },
          saturation: 0,
        },
      },
      { babylon: BABYLON as any },
    );

    expect(material.albedoColor.r).toBeCloseTo(material.albedoColor.g);
    expect(material.albedoColor.g).toBeCloseTo(material.albedoColor.b);
    scene.dispose();
    engine.dispose();
  });

  it('applies PBR metallic and roughness values', () => {
    const { engine, scene } = createScene();
    const material = new PBRMaterial('metal', scene);

    applyArtistMaterialProfileToRuntimeMaterial(
      material,
      scene,
      {
        metallic: 0.85,
        roughness: 0.25,
      },
      { babylon: BABYLON as any },
    );

    expect(material.metallic).toBeCloseTo(0.85);
    expect(material.roughness).toBeCloseTo(0.25);
    scene.dispose();
    engine.dispose();
  });

  it('ignores metallic and roughness on StandardMaterial', () => {
    const { engine, scene } = createScene();
    const material = new StandardMaterial('painted-standard', scene);
    const initialRoughness = (material as any).roughness;

    const changed = applyArtistMaterialProfileToRuntimeMaterial(
      material,
      scene,
      {
        metallic: 0.85,
        roughness: 0.25,
      },
      { babylon: BABYLON as any },
    );

    expect(changed).toBe(false);
    expect('metallic' in material).toBe(false);
    expect((material as any).roughness).toBe(initialRoughness);
    scene.dispose();
    engine.dispose();
  });

  it('projects emission intensity and grayscale mask texture fallback', () => {
    const { engine, scene } = createScene();
    const material = new StandardMaterial('screen', scene);

    const changed = applyArtistMaterialProfileToRuntimeMaterial(
      material,
      scene,
      {
        emission: {
          color: { r: 0.25, g: 0.5, b: 1 },
          intensity: 2,
          maskTexture: { url: '/materials/screen-mask.png' },
        },
      },
      { babylon: BABYLON as any },
    );

    expect(changed).toBe(true);
    expect(material.emissiveColor.r).toBeCloseTo(0.5);
    expect(material.emissiveColor.g).toBeCloseTo(1);
    expect(material.emissiveColor.b).toBeCloseTo(2);
    expect(material.emissiveTexture?.name).toBe('/materials/screen-mask.png');
    expect(material.emissiveTexture?.level).toBeCloseTo(2);
    scene.dispose();
    engine.dispose();
  });
});

function createScene(): { engine: NullEngine; scene: Scene } {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  return { engine, scene };
}
