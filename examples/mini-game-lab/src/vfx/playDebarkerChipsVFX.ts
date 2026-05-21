import {
  Scene,
  Vector3,
  MeshBuilder,
  Color3,
  StandardMaterial,
  Mesh,
  InstancedMesh,
} from '@babylonjs/core';

let cachedChipProto: Mesh | null = null;
let cachedMat: StandardMaterial | null = null;

function getChipPrototype(scene: Scene): Mesh {
  if (cachedChipProto && !cachedChipProto.isDisposed()) {
    return cachedChipProto;
  }

  // 使用纯色土黄色/亮棕色，放弃原贴图。因为原贴图带有较粗的黑色描边，在缩小后贴到碎片上会导致碎片大面积发黑、像是有黑色描边一样。
  cachedMat = new StandardMaterial('woodChipMat', scene);
  cachedMat.diffuseColor = new Color3(0.9, 0.65, 0.25);
  cachedMat.emissiveColor = new Color3(0.9, 0.65, 0.25);
  // 禁用光照，避免背光面或法线问题导致发黑
  cachedMat.disableLighting = true;
  cachedMat.specularColor = new Color3(0, 0, 0);

  // Wedge/splinter shape: a triangular prism
  cachedChipProto = MeshBuilder.CreateCylinder('woodChipProto', {
    diameterTop: 0,
    diameterBottom: 0.15,
    height: 0.4,
    tessellation: 3,
  }, scene);
  cachedChipProto.material = cachedMat;
  cachedChipProto.isVisible = false;

  cachedChipProto.onDisposeObservable.addOnce(() => {
    cachedChipProto = null;
    if (cachedMat) {
      cachedMat.dispose();
      cachedMat = null;
    }
  });

  return cachedChipProto;
}

export function disposeDebarkerChipsVFXCache(): void {
  cachedChipProto?.dispose();
  cachedChipProto = null;
}

interface ChipData {
  mesh: InstancedMesh;
  vel: Vector3;
  rotVel: Vector3;
  life: number;
}

export function playDebarkerChipsVFX(
  scene: Scene,
  position: Vector3
): { dispose: () => void } {
  const proto = getChipPrototype(scene);
  const chips: ChipData[] = [];
  const count = 15 + Math.floor(Math.random() * 8); // 15-22 chips

  for (let i = 0; i < count; i++) {
    const chip = proto.createInstance(`woodChip_${Date.now()}_${i}`);

    // Spread position slightly around the contact area
    const offsetX = (Math.random() - 0.5) * 0.4;
    const offsetY = (Math.random() - 0.5) * 0.3;
    const offsetZ = (Math.random() - 0.5) * 0.6;
    chip.position.copyFrom(position).addInPlaceFromFloats(offsetX, offsetY, offsetZ);

    // Randomize shape to create high variance: from tiny grains to large splinters
    const sizeType = Math.random();
    if (sizeType > 0.8) {
      // 20% Large chunks/splinters
      chip.scaling.set(
        0.5 + Math.random() * 0.4,
        1.2 + Math.random() * 0.8,
        0.3 + Math.random() * 0.3
      );
    } else if (sizeType > 0.3) {
      // 50% Medium normal chips
      chip.scaling.set(
        0.2 + Math.random() * 0.15,
        0.35 + Math.random() * 0.3,
        0.1 + Math.random() * 0.1
      );
    } else {
      // 30% Tiny grains
      chip.scaling.set(
        0.1 + Math.random() * 0.05,
        0.1 + Math.random() * 0.1,
        0.05 + Math.random() * 0.05
      );
    }

    // Randomize initial rotation
    chip.rotation.set(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    );

    // Velocity: outwards and upwards (parabola)
    // Logs are moving along Z, we want chips to spray mainly outwards (X and up Y)
    // Some spray along Z as well
    const vX = (Math.random() - 0.5) * 8;
    const vY = 3 + Math.random() * 5.0;
    const vZ = (Math.random() - 0.5) * 5;

    // Spin speed (strong tumbling effect)
    const rotVel = new Vector3(
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 20
    );

    chips.push({
      mesh: chip,
      vel: new Vector3(vX, vY, vZ),
      rotVel,
      life: 0.6 + Math.random() * 0.5 // 0.6s to 1.1s life
    });
  }

  const observer = scene.onBeforeRenderObservable.add(() => {
    const dt = scene.getEngine().getDeltaTime() / 1000;
    for (let i = chips.length - 1; i >= 0; i--) {
      const c = chips[i];
      c.life -= dt;
      if (c.life <= 0) {
        c.mesh.dispose();
        chips.splice(i, 1);
        continue;
      }
      // Gravity pulls them down in a parabola
      c.vel.y -= 15 * dt;

      // Move
      c.mesh.position.addInPlace(c.vel.scale(dt));
      // Rotate
      c.mesh.rotation.addInPlace(c.rotVel.scale(dt));

      // Shrink at the end of life for smooth disappearance
      if (c.life < 0.15) {
        c.mesh.scaling.scaleInPlace(0.8);
      }
    }

    if (chips.length === 0) {
      scene.onBeforeRenderObservable.remove(observer);
    }
  });

  return {
    dispose() {
      scene.onBeforeRenderObservable.remove(observer);
      chips.forEach(c => c.mesh.dispose());
      chips.length = 0;
    }
  };
}
