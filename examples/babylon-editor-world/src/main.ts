import './styles.css';
import {
  ArcRotateCamera,
  Color3,
  Color4,
  Engine,
  GizmoManager,
  HemisphericLight,
  LinesMesh,
  MeshBuilder,
  PointerEventTypes,
  Scene,
  StandardMaterial,
  type Node,
  UtilityLayerRenderer,
  Vector3,
} from '@babylonjs/core';
import { createBabylonEditorWorld } from '@fps-games/editor-babylon';
import {
  applyDocumentPatch,
  cloneDocument,
  type DocumentPatch,
  type PreviewSnapshot,
  type SceneDocument,
  type SceneNode,
  type Vec3,
} from './document';
import { projectDocument } from './projection';
import { sampleDocument } from './sample-document';

type Nullable<T> = T | null;

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Missing #app root');
}

app.innerHTML = `
  <main class="shell">
    <header class="toolbar">
      <strong>Babylon EditorWorld MVP</strong>
      <span>data-first editor world with snapshot preview scopes</span>
    </header>
    <section class="workspace">
      <canvas id="editor-canvas" aria-label="Babylon EditorWorld viewport"></canvas>
      <aside class="status-panel">
        <h2>Editing Scope</h2>
        <label class="field">
          <span>Scope</span>
          <select id="editing-scope">
            <option value="base">Base Scene</option>
            <option value="snapshot">Current PreviewSnapshot</option>
          </select>
        </label>
        <label class="field">
          <span>Snapshot</span>
          <select id="snapshot-select"></select>
        </label>
        <h2>EditorWorld</h2>
        <dl>
          <dt>Scene</dt>
          <dd>independent Babylon.Scene</dd>
          <dt>Objects</dt>
          <dd id="object-count">0</dd>
          <dt>Status</dt>
          <dd id="render-status">initializing</dd>
          <dt>Selected</dt>
          <dd id="selected-node">none</dd>
          <dt>Preview Time</dt>
          <dd id="preview-time">0s</dd>
        </dl>
        <h2>SceneDocument</h2>
        <pre id="document-json" class="document-json"></pre>
      </aside>
    </section>
  </main>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#editor-canvas');
const objectCount = document.querySelector<HTMLElement>('#object-count');
const renderStatus = document.querySelector<HTMLElement>('#render-status');
const selectedNodeLabel = document.querySelector<HTMLElement>('#selected-node');
const previewTimeLabel = document.querySelector<HTMLElement>('#preview-time');
const editingScopeSelect = document.querySelector<HTMLSelectElement>('#editing-scope');
const snapshotSelect = document.querySelector<HTMLSelectElement>('#snapshot-select');
const documentJson = document.querySelector<HTMLElement>('#document-json');

if (!canvas) {
  throw new Error('Missing editor canvas');
}

const engine = new Engine(canvas, true, {
  preserveDrawingBuffer: true,
  stencil: true,
  antialias: true,
});

const editorWorld = createBabylonEditorWorld({
  engine,
  canvas,
  babylon: {
    Scene,
    ArcRotateCamera,
    Vector3,
    Color4,
    HemisphericLight,
    GizmoManager,
    UtilityLayerRenderer,
  },
  cameraTarget: { x: 0, y: 0.8, z: 0 },
  cameraRadius: 9,
  clearColor: { r: 0.055, g: 0.074, b: 0.102, a: 1 },
  enableGizmoManager: true,
});

const scene = editorWorld.scene as Scene;
const camera = editorWorld.camera as ArcRotateCamera;
camera.lowerRadiusLimit = 4;
camera.upperRadiusLimit = 18;
camera.wheelPrecision = 48;

const ground = MeshBuilder.CreateGround('editor-grid', { width: 14, height: 14 }, scene);
ground.isPickable = false;

const groundMaterial = new StandardMaterial('editor-ground-material', scene);
groundMaterial.diffuseColor = new Color3(0.09, 0.12, 0.17);
groundMaterial.specularColor = new Color3(0.02, 0.025, 0.03);
ground.material = groundMaterial;

function createGridLines(size: number, step: number): LinesMesh[] {
  const lines: LinesMesh[] = [];
  const half = size / 2;
  for (let offset = -half; offset <= half; offset += step) {
    const color = Math.abs(offset) < 0.001
      ? new Color3(0.42, 0.54, 0.7)
      : new Color3(0.19, 0.25, 0.34);
    const xLine = MeshBuilder.CreateLines(`grid-x-${offset}`, {
      points: [new Vector3(-half, 0.01, offset), new Vector3(half, 0.01, offset)],
    }, scene);
    xLine.color = color;
    xLine.isPickable = false;
    const zLine = MeshBuilder.CreateLines(`grid-z-${offset}`, {
      points: [new Vector3(offset, 0.01, -half), new Vector3(offset, 0.01, half)],
    }, scene);
    zLine.color = color;
    zLine.isPickable = false;
    lines.push(xLine, zLine);
  }
  return lines;
}

createGridLines(14, 1);

let workingDocument: SceneDocument = cloneDocument(sampleDocument);
const projection = projectDocument(scene, workingDocument);
const gizmoManager = editorWorld.gizmoManager;
let selectedNodeId: string | null = null;
let editingScope: 'base' | 'snapshot' = 'base';
let activeSnapshotId = workingDocument.previewSnapshots[0]?.id ?? null;

if (gizmoManager) {
  gizmoManager.positionGizmoEnabled = true;
  gizmoManager.rotationGizmoEnabled = false;
  gizmoManager.scaleGizmoEnabled = false;
  gizmoManager.usePointerToAttachGizmos = false;
}

function findNode(nodeId: string): SceneNode | null {
  return workingDocument.nodes.find(node => node.id === nodeId) ?? null;
}

function activeSnapshot(): PreviewSnapshot | null {
  return workingDocument.previewSnapshots.find(snapshot => snapshot.id === activeSnapshotId) ?? null;
}

function renderSnapshotOptions(): void {
  if (!snapshotSelect) return;
  snapshotSelect.innerHTML = workingDocument.previewSnapshots
    .map(snapshot => `<option value="${snapshot.id}">${snapshot.label}</option>`)
    .join('');
  if (activeSnapshotId) snapshotSelect.value = activeSnapshotId;
}

function visibleSnapshotForScope(): PreviewSnapshot | null {
  return editingScope === 'snapshot' ? activeSnapshot() : null;
}

function vec3FromBabylon(value: Vector3): Vec3 {
  return {
    x: Number(value.x.toFixed(3)),
    y: Number(value.y.toFixed(3)),
    z: Number(value.z.toFixed(3)),
  };
}

function renderDocumentPanel(): void {
  if (documentJson) documentJson.textContent = JSON.stringify(workingDocument, null, 2);
  if (selectedNodeLabel) {
    const selected = selectedNodeId ? findNode(selectedNodeId) : null;
    selectedNodeLabel.textContent = selected ? `${selected.name} (${selected.id})` : 'none';
  }
  if (previewTimeLabel) previewTimeLabel.textContent = `${activeSnapshot()?.previewTime ?? 0}s`;
}

function applyPatch(patch: DocumentPatch): void {
  workingDocument = applyDocumentPatch(workingDocument, patch);
  const nodeId = patch.kind === 'node.transform.patch' || patch.kind === 'snapshot.override.patch'
    ? patch.nodeId
    : null;
  const node = nodeId ? findNode(nodeId) : null;
  if (node) projection.updateNode(node, visibleSnapshotForScope());
  window.__FPS_EDITOR_WORLD_STAGE_2__!.document = workingDocument;
  renderDocumentPanel();
}

function applyActiveSnapshot(): void {
  projection.applySnapshot(workingDocument, visibleSnapshotForScope());
  renderDocumentPanel();
}

function selectNode(nodeId: string | null): void {
  selectedNodeId = nodeId;
  projection.setSelectedNode(nodeId);
  const projected = nodeId ? projection.nodes.get(nodeId) : null;
  if (gizmoManager) gizmoManager.attachToMesh(projected?.mesh ?? null);
  renderDocumentPanel();
}

function resolveProjectedNodeId(pickedMesh: Nullable<Node>): string | null {
  let current: Nullable<Node> = pickedMesh;
  while (current) {
    const nodeId = current.metadata?.editorProjection?.nodeId;
    if (typeof nodeId === 'string') return nodeId;
    current = current.parent;
  }
  return null;
}

scene.onPointerObservable.add(pointerInfo => {
  if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return;
  const pickedMesh = pointerInfo.pickInfo?.pickedMesh ?? null;
  selectNode(resolveProjectedNodeId(pickedMesh));
});

gizmoManager?.gizmos.positionGizmo?.onDragEndObservable.add(() => {
  if (!selectedNodeId) return;
  const projected = projection.nodes.get(selectedNodeId);
  if (!projected) return;
  if (editingScope === 'snapshot') {
    const snapshot = activeSnapshot();
    if (!snapshot) return;
    applyPatch({
      kind: 'snapshot.override.patch',
      snapshotId: snapshot.id,
      nodeId: selectedNodeId,
      override: {
        transform: {
          position: vec3FromBabylon(projected.mesh.position),
        },
      },
    });
    return;
  }
  applyPatch({
    kind: 'node.transform.patch',
    nodeId: selectedNodeId,
    transform: {
      position: vec3FromBabylon(projected.mesh.position),
    },
  });
});

editingScopeSelect?.addEventListener('change', () => {
  editingScope = editingScopeSelect.value === 'snapshot' ? 'snapshot' : 'base';
  applyActiveSnapshot();
});

snapshotSelect?.addEventListener('change', () => {
  activeSnapshotId = snapshotSelect.value;
  applyActiveSnapshot();
});

if (objectCount) objectCount.textContent = `${projection.nodes.size} projected nodes + grid`;
if (renderStatus) renderStatus.textContent = 'rendering';
renderSnapshotOptions();
applyActiveSnapshot();
renderDocumentPanel();

engine.runRenderLoop(() => {
  editorWorld.render();
});

window.addEventListener('resize', () => {
  engine.resize();
});

function disposeDemo(): void {
  projection.dispose();
  editorWorld.dispose();
  engine.dispose();
}

window.addEventListener('beforeunload', () => {
  disposeDemo();
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    disposeDemo();
  });
}

declare global {
  interface Window {
    __FPS_EDITOR_WORLD_STAGE_2__?: {
      engine: Engine;
    scene: Scene;
    camera: ArcRotateCamera;
    editorWorld: typeof editorWorld;
    document: SceneDocument;
  };
}
}

window.__FPS_EDITOR_WORLD_STAGE_2__ = {
  engine,
  scene,
  camera,
  editorWorld,
  document: workingDocument,
};
