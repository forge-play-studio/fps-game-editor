import { LOCAL_EDITOR_THEME_CLASS } from './local-editor-ui-theme';
import type {
  LocalEditorWorkbenchLayout,
  LocalEditorWorkbenchPanelDescriptor,
  LocalEditorWorkbenchRegionDescriptor,
} from './local-editor-ui-types';

export const LOCAL_EDITOR_WORKBENCH_REGIONS = [
  { id: 'top-app-bar', label: 'Top App Bar' },
  { id: 'left-dock', label: 'Left Dock' },
  { id: 'scene-view', label: 'Scene View' },
  { id: 'scene-header', label: 'Scene View Header' },
  { id: 'right-dock', label: 'Right Dock' },
  { id: 'bottom-dock', label: 'Bottom Dock' },
] satisfies LocalEditorWorkbenchRegionDescriptor[];

export const LOCAL_EDITOR_WORKBENCH_PANELS = [
  { id: 'hierarchy', title: '层级', area: 'left', toolbar: 'scene-graph' },
  { id: 'inspector', title: '检查器', area: 'right' },
  { id: 'assets', title: '资产', area: 'bottom', contextMenu: 'asset-browser' },
  { id: 'history', title: '历史', area: 'bottom' },
] satisfies LocalEditorWorkbenchPanelDescriptor[];

export function createDefaultLocalEditorWorkbenchLayout(): LocalEditorWorkbenchLayout {
  return {
    regions: [...LOCAL_EDITOR_WORKBENCH_REGIONS],
    panels: [...LOCAL_EDITOR_WORKBENCH_PANELS],
    activeTabs: {
      left: 'hierarchy',
      right: 'inspector',
      bottom: 'assets',
    },
  };
}

export interface LocalEditorWorkbenchElements {
  root: HTMLDivElement;
  leftDock: HTMLDivElement;
  sceneFrame: HTMLDivElement;
  sceneHeader: HTMLDivElement;
  rightDock: HTMLDivElement;
  bottomDock: HTMLDivElement;
}

export function createLocalEditorWorkbench(doc: Document): LocalEditorWorkbenchElements {
  const root = doc.createElement('div');
  root.dataset.editorWorkbench = 'true';
  root.className = LOCAL_EDITOR_THEME_CLASS;
  root.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'right:0',
    'bottom:0',
    'z-index:2147483639',
    'display:none',
    'pointer-events:none',
    'font-family:var(--fps-editor-font)',
    'color:var(--fps-editor-text)',
    'font-size:12px',
  ].join(';');

  const leftDock = createDock(doc, 'left');
  const rightDock = createDock(doc, 'right');
  const bottomDock = createDock(doc, 'bottom');
  const sceneFrame = doc.createElement('div');
  sceneFrame.dataset.editorWorkbenchRegion = 'scene-view';
  sceneFrame.style.cssText = [
    'position:absolute',
    'top:0',
    'left:300px',
    'right:340px',
    'bottom:260px',
    'display:flex',
    'flex-direction:column',
    'min-width:0',
    'min-height:0',
    'border-left:1px solid var(--fps-editor-divider)',
    'border-right:1px solid var(--fps-editor-divider)',
    'border-bottom:1px solid var(--fps-editor-divider)',
    'background:transparent',
    'pointer-events:none',
    'overflow:hidden',
  ].join(';');
  const sceneHeader = doc.createElement('div');
  sceneHeader.dataset.editorWorkbenchRegion = 'scene-header';
  sceneHeader.style.cssText = [
    'height:38px',
    'flex:0 0 38px',
    'display:flex',
    'align-items:center',
    'justify-content:flex-start',
    'border-bottom:1px solid var(--fps-editor-divider)',
    'background:var(--fps-editor-chrome)',
    'box-shadow:var(--fps-editor-shadow-inset-highlight)',
    'pointer-events:none',
  ].join(';');
  sceneFrame.appendChild(sceneHeader);

  root.appendChild(sceneFrame);
  root.appendChild(leftDock);
  root.appendChild(rightDock);
  root.appendChild(bottomDock);
  return { root, leftDock, sceneFrame, sceneHeader, rightDock, bottomDock };
}

function createDock(doc: Document, area: 'left' | 'right' | 'bottom'): HTMLDivElement {
  const dock = doc.createElement('div');
  dock.dataset.editorWorkbenchRegion = area === 'left' ? 'left-dock' : area === 'right' ? 'right-dock' : 'bottom-dock';
  const placement = area === 'left'
    ? 'top:0;left:0;bottom:260px;width:300px'
    : area === 'right'
      ? 'top:0;right:0;bottom:0;width:340px'
      : 'left:0;right:340px;bottom:0;height:260px';
  dock.style.cssText = [
    'position:absolute',
    placement,
    'display:flex',
    'flex-direction:column',
    'min-width:0',
    'min-height:0',
    'border:1px solid var(--fps-editor-divider)',
    'background:var(--fps-editor-panel)',
    'pointer-events:auto',
    'overflow:hidden',
  ].join(';');
  return dock;
}

export function createWorkbenchPanelContent(doc: Document): HTMLDivElement {
  const content = doc.createElement('div');
  content.dataset.editorPanelContent = 'true';
  content.style.cssText = [
    'flex:1',
    'min-height:0',
    'overflow:auto',
    'padding:8px',
  ].join(';');
  return content;
}

export function createSceneHeaderToolbar(doc: Document): HTMLDivElement {
  const toolbar = doc.createElement('div');
  toolbar.dataset.editorWorkbenchRegion = 'scene-toolbar';
  toolbar.style.cssText = [
    'display:flex',
    'align-items:center',
    'gap:7px',
    'width:100%',
    'height:100%',
    'max-width:100%',
    'padding:5px 8px',
    'background:transparent',
    'pointer-events:auto',
    'overflow:hidden',
  ].join(';');
  return toolbar;
}
