import type { BrowserHost } from '@fps-games/editor-browser';
import type { EditorTool } from '@fps-games/editor-protocol';

export type InspectorTransformTool = Exclude<EditorTool, 'pick'>;

export interface InspectorAdapterOptions {
  host?: BrowserHost;
}

function getDocument(host?: BrowserHost): Document | null {
  if (host) return host.document;
  return typeof document === 'undefined' ? null : document;
}

export function getInspectorContainer(host?: BrowserHost): HTMLElement | null {
  const doc = getDocument(host);
  if (!doc) return null;
  return doc.getElementById('babylon-inspector-container')
    || doc.querySelector('#inspector-host, #babylon-inspector-container');
}

export function readInspectorButtonLabel(button: HTMLButtonElement, host?: BrowserHost): string {
  const doc = getDocument(host) ?? button.ownerDocument;
  const describedById = button.getAttribute('aria-describedby');
  const describedByText = describedById ? doc?.getElementById(describedById)?.textContent : null;
  const container = button.closest('[title], [aria-label], [aria-description], [description]');
  const values = [
    button.getAttribute('title'),
    button.getAttribute('aria-label'),
    button.getAttribute('aria-description'),
    button.getAttribute('description'),
    describedByText,
    button.textContent,
    button.parentElement?.getAttribute('title'),
    button.parentElement?.getAttribute('aria-label'),
    button.parentElement?.getAttribute('aria-description'),
    button.parentElement?.getAttribute('description'),
    container?.getAttribute('title'),
    container?.getAttribute('aria-label'),
    container?.getAttribute('aria-description'),
    container?.getAttribute('description'),
  ];
  return values.filter(Boolean).join(' ').toLowerCase();
}

export function findInspectorTransformButtons(container = getInspectorContainer(), host?: BrowserHost) {
  if (!container) return null;
  const buttons = Array.from(container.querySelectorAll('button[aria-pressed], button')) as HTMLButtonElement[];
  const map = new Map<InspectorTransformTool, HTMLButtonElement>();
  for (const button of buttons) {
    const label = readInspectorButtonLabel(button, host);
    if (!label) continue;
    if (!map.has('move') && label.includes('translate')) map.set('move', button);
    else if (!map.has('rotate') && label.includes('rotate')) map.set('rotate', button);
    else if (!map.has('scale') && label.includes('scale')) map.set('scale', button);
    if (map.size === 3) break;
  }
  return map;
}

export function setInspectorPicking(enabled: boolean, container = getInspectorContainer()): boolean {
  if (!container) return false;
  const targetLabel = (enabled ? 'enable picking' : 'disable picking').toLowerCase();
  const button = Array.from(container.querySelectorAll('button')).find((candidate) =>
    readInspectorButtonLabel(candidate as HTMLButtonElement).includes(targetLabel)
  ) as HTMLButtonElement | undefined;
  if (!button) return false;
  button.click();
  return true;
}

export function isPickingToggleButton(button: HTMLButtonElement): 'enable' | 'disable' | null {
  const label = readInspectorButtonLabel(button);
  if (label.includes('enable picking')) return 'enable';
  if (label.includes('disable picking')) return 'disable';
  return null;
}

export function syncInspectorToolState(tool: EditorTool, container = getInspectorContainer(), host?: BrowserHost): boolean {
  const buttons = findInspectorTransformButtons(container, host);
  if (!buttons) return false;

  if (tool === 'pick') {
    for (const button of buttons.values()) {
      if (button.getAttribute('aria-pressed') === 'true') {
        button.click();
        return true;
      }
    }
    return true;
  }

  const targetButton = buttons.get(tool as InspectorTransformTool);
  if (!targetButton) return false;
  if (targetButton.getAttribute('aria-pressed') !== 'true') targetButton.click();
  return true;
}
