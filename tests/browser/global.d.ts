import type { LocalEditorHarness } from '@fps-games/editor';
import type { LabProjectStore, LabSceneDocument } from '../../examples/editor-lab/src/lab-project';

declare global {
  interface Window {
    __FPS_EDITOR_LAB__?: {
      harness: LocalEditorHarness<LabSceneDocument>;
      store: LabProjectStore;
      getDocument: () => LabSceneDocument | null;
    };
  }
}

export {};
