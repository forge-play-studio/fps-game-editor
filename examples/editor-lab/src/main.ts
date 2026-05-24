import './styles.css';
import { createLocalEditorHarness } from '@fps-games/editor';
import {
  createLabAuthoringHost,
  createLabDocumentAdapter,
  createLabGrid,
  createLabProjectStore,
  createLabWorldAdapter,
  type LabSceneDocument,
  type LabScenePatch,
} from './lab-project';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app root');

app.innerHTML = `
  <main class="editor-lab-shell" data-editor-lab>
    <canvas id="editor-lab-canvas" class="editor-lab-canvas" aria-label="fps-game-editor lab viewport"></canvas>
    <div class="editor-lab-status" data-editor-lab-status>Initializing editor lab...</div>
  </main>
`;

const store = createLabProjectStore();
const authoringHost = createLabAuthoringHost(store);
const status = document.querySelector<HTMLElement>('[data-editor-lab-status]');

const harness = createLocalEditorHarness<LabSceneDocument, LabScenePatch>({
  root: app,
  localTestActions: true,
  authoringHost,
  documentAdapter: createLabDocumentAdapter(),
  persistenceAdapter: {
    async loadAuthoringSource() {
      const loaded = await authoringHost.loadSource<LabSceneDocument>({
        sourceId: 'lab.scene',
        sourceType: 'scene',
      });
      if (!loaded.ok || !loaded.source || !loaded.document) {
        throw new Error(loaded.diagnostics[0]?.message ?? 'Failed to load lab scene');
      }
      authoringHost.registerSource(loaded.source);
      return {
        source: loaded.source,
        document: loaded.document,
        assets: loaded.document.assets,
        summary: loaded.summary,
      };
    },
    loadAssets() {
      return store.getSavedDocument().assets;
    },
    runGame() {
      document.body.dataset.editorLabMode = 'game';
      updateLabStatus();
    },
  },
  worldAdapter: createLabWorldAdapter(),
  world: {
    cameraTarget: { x: 0, y: 0.7, z: 0 },
    cameraRadius: 8,
    clearColor: { r: 0.055, g: 0.07, b: 0.09, a: 1 },
    useRightHandedSystem: true,
  },
  createGrid: createLabGrid,
});

function updateLabStatus(): void {
  if (!status) return;
  const documentState = harness.getWorkingDocument();
  status.textContent = [
    `mode=${document.body.dataset.editorLabMode ?? 'boot'}`,
    `revision=${store.getRevision()}`,
    `savedObjects=${store.getSavedDocument().scene.gameObjects.length}`,
    `workingObjects=${documentState?.scene.gameObjects.length ?? 'n/a'}`,
  ].join(' | ');
}

void harness.enterEditor()
  .then(() => {
    document.body.dataset.editorLabMode = 'editor';
    harness.render();
    updateLabStatus();
  })
  .catch((error) => {
    if (status) status.textContent = error instanceof Error ? error.message : String(error);
    throw error;
  });

setInterval(updateLabStatus, 500);

Object.assign(window, {
  __FPS_EDITOR_LAB__: {
    harness,
    store,
    getDocument: () => harness.getWorkingDocument(),
  },
});
