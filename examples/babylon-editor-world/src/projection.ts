import {
  Color3,
  HighlightLayer,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';
import {
  resolveSnapshotNode,
  resolveSnapshotVisible,
  type EditorPrefab,
  type PreviewSnapshot,
  type SceneDocument,
  type SceneNode,
  type Vec3,
} from './document';

export interface ProjectionBinding {
  nodeId: string;
  prefabId: string;
}

export interface ProjectedNode {
  nodeId: string;
  mesh: Mesh;
  binding: ProjectionBinding;
}

export interface DocumentProjection {
  nodes: Map<string, ProjectedNode>;
  updateNode(node: SceneNode, snapshot?: PreviewSnapshot | null): void;
  applySnapshot(document: SceneDocument, snapshot: PreviewSnapshot | null): void;
  setSelectedNode(nodeId: string | null): void;
  dispose(): void;
}

function toVector3(value: Vec3): Vector3 {
  return new Vector3(value.x, value.y, value.z);
}

function toColor3(hex: string): Color3 {
  return Color3.FromHexString(hex);
}

function createPrimitive(prefab: EditorPrefab, scene: Scene): Mesh {
  if (prefab.primitive === 'sphere') {
    return MeshBuilder.CreateSphere(prefab.id, {
      diameter: prefab.dimensions?.diameter ?? 1,
      segments: 24,
    }, scene);
  }
  if (prefab.primitive === 'cylinder') {
    return MeshBuilder.CreateCylinder(prefab.id, {
      diameter: prefab.dimensions?.diameter ?? 1,
      height: prefab.dimensions?.height ?? 1,
      tessellation: 6,
    }, scene);
  }
  return MeshBuilder.CreateBox(prefab.id, {
    size: prefab.dimensions?.size ?? 1,
  }, scene);
}

function applyNodeTransform(mesh: Mesh, node: SceneNode): void {
  mesh.position = toVector3(node.transform.position);
  mesh.rotation = toVector3(node.transform.rotation);
  mesh.scaling = toVector3(node.transform.scaling);
}

export function projectDocument(scene: Scene, document: SceneDocument): DocumentProjection {
  const prefabById = new Map(document.prefabs.map(prefab => [prefab.id, prefab]));
  const projectedNodes = new Map<string, ProjectedNode>();
  const highlightLayer = new HighlightLayer('editor-selection-highlight', scene);

  for (const node of document.nodes) {
    const prefab = prefabById.get(node.prefabId);
    if (!prefab) continue;

    const mesh = createPrimitive(prefab, scene);
    mesh.name = node.name;
    mesh.id = node.id;
    mesh.metadata = {
      ...(mesh.metadata ?? {}),
      editorProjection: {
        nodeId: node.id,
        prefabId: prefab.id,
      } satisfies ProjectionBinding,
    };
    applyNodeTransform(mesh, node);

    const material = new StandardMaterial(`${node.id}.material`, scene);
    material.diffuseColor = toColor3(prefab.color);
    material.specularColor = new Color3(0.12, 0.14, 0.18);
    mesh.material = material;

    projectedNodes.set(node.id, {
      nodeId: node.id,
      mesh,
      binding: mesh.metadata.editorProjection as ProjectionBinding,
    });
  }

  return {
    nodes: projectedNodes,
    updateNode(node: SceneNode, snapshot: PreviewSnapshot | null = null) {
      const projected = projectedNodes.get(node.id);
      if (!projected) return;
      const resolvedNode = resolveSnapshotNode(node, snapshot);
      applyNodeTransform(projected.mesh, resolvedNode);
      projected.mesh.setEnabled(resolveSnapshotVisible(node, snapshot));
    },
    applySnapshot(nextDocument: SceneDocument, snapshot: PreviewSnapshot | null) {
      for (const node of nextDocument.nodes) {
        this.updateNode(node, snapshot);
      }
    },
    setSelectedNode(nodeId: string | null) {
      highlightLayer.removeAllMeshes();
      if (!nodeId) return;
      const projected = projectedNodes.get(nodeId);
      if (!projected) return;
      highlightLayer.addMesh(projected.mesh, Color3.White());
    },
    dispose() {
      highlightLayer.dispose();
      for (const projected of projectedNodes.values()) {
        projected.mesh.dispose(false, true);
      }
      projectedNodes.clear();
    },
  };
}
