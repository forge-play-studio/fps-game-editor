export type Vec3 = {
  x: number;
  y: number;
  z: number;
};

export type PrimitivePrefabKind = 'box' | 'sphere' | 'cylinder';

export interface EditorPrefab {
  id: string;
  label: string;
  primitive: PrimitivePrefabKind;
  color: string;
  dimensions?: Partial<{
    size: number;
    diameter: number;
    height: number;
  }>;
}

export interface SceneNode {
  id: string;
  name: string;
  prefabId: string;
  transform: {
    position: Vec3;
    rotation: Vec3;
    scaling: Vec3;
  };
}

export type SnapshotOverride = {
  nodeId: string;
  visible?: boolean;
  transform?: Partial<SceneNode['transform']>;
};

export interface PreviewSnapshot {
  id: string;
  label: string;
  previewTime: number;
  overrides: SnapshotOverride[];
}

export interface SceneDocument {
  version: 1;
  prefabs: EditorPrefab[];
  nodes: SceneNode[];
  previewSnapshots: PreviewSnapshot[];
}

export type DocumentPatch =
  | {
      kind: 'node.transform.patch';
      nodeId: string;
      transform: Partial<SceneNode['transform']>;
    }
  | {
      kind: 'snapshot.override.patch';
      snapshotId: string;
      nodeId: string;
      override: Omit<SnapshotOverride, 'nodeId'>;
    };

export function cloneDocument(document: SceneDocument): SceneDocument {
  return structuredClone(document);
}

export function applyDocumentPatch(document: SceneDocument, patch: DocumentPatch): SceneDocument {
  if (patch.kind === 'node.transform.patch') {
    return {
      ...document,
      nodes: document.nodes.map(node => {
        if (node.id !== patch.nodeId) return node;
        return {
          ...node,
          transform: {
            position: patch.transform.position ?? node.transform.position,
            rotation: patch.transform.rotation ?? node.transform.rotation,
            scaling: patch.transform.scaling ?? node.transform.scaling,
          },
        };
      }),
    };
  }

  if (patch.kind === 'snapshot.override.patch') {
    return {
      ...document,
      previewSnapshots: document.previewSnapshots.map(snapshot => {
        if (snapshot.id !== patch.snapshotId) return snapshot;
        const existing = snapshot.overrides.find(override => override.nodeId === patch.nodeId);
        const nextOverride: SnapshotOverride = {
          nodeId: patch.nodeId,
          visible: patch.override.visible ?? existing?.visible,
          transform: {
            position: patch.override.transform?.position ?? existing?.transform?.position,
            rotation: patch.override.transform?.rotation ?? existing?.transform?.rotation,
            scaling: patch.override.transform?.scaling ?? existing?.transform?.scaling,
          },
        };
        return {
          ...snapshot,
          overrides: existing
            ? snapshot.overrides.map(override => override.nodeId === patch.nodeId ? nextOverride : override)
            : [...snapshot.overrides, nextOverride],
        };
      }),
    };
  }

  return document;
}

export function resolveSnapshotNode(baseNode: SceneNode, snapshot: PreviewSnapshot | null): SceneNode {
  const override = snapshot?.overrides.find(item => item.nodeId === baseNode.id);
  if (!override?.transform) return baseNode;
  return {
    ...baseNode,
    transform: {
      position: override.transform.position ?? baseNode.transform.position,
      rotation: override.transform.rotation ?? baseNode.transform.rotation,
      scaling: override.transform.scaling ?? baseNode.transform.scaling,
    },
  };
}

export function resolveSnapshotVisible(baseNode: SceneNode, snapshot: PreviewSnapshot | null): boolean {
  const override = snapshot?.overrides.find(item => item.nodeId === baseNode.id);
  return override?.visible ?? true;
}
