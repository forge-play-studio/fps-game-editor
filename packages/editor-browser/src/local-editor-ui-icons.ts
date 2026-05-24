export const LOCAL_EDITOR_ICON_NAMES = [
  'asset',
  'arrange',
  'camera',
  'chevron-down',
  'chevron-right',
  'discard',
  'execute',
  'group',
  'help',
  'hierarchy',
  'history',
  'inspector',
  'local',
  'lock',
  'move',
  'object',
  'place-ground',
  'place-off',
  'place-surface',
  'redo',
  'root',
  'rotate',
  'save',
  'scale',
  'select',
  'snap',
  'status',
  'theme',
  'undo',
  'world',
] as const;

export type LocalEditorIconName = typeof LOCAL_EDITOR_ICON_NAMES[number];

export interface LocalEditorIconOptions {
  size?: number;
  strokeWidth?: number;
}

type LocalEditorIconElement =
  | { tag: 'circle'; attrs: Record<string, string> }
  | { tag: 'line'; attrs: Record<string, string> }
  | { tag: 'path'; attrs: Record<string, string> }
  | { tag: 'polyline'; attrs: Record<string, string> }
  | { tag: 'rect'; attrs: Record<string, string> };

const LOCAL_EDITOR_ICON_SET = new Set<string>(LOCAL_EDITOR_ICON_NAMES);

const LOCAL_EDITOR_ICON_DEFINITIONS = {
  asset: [
    { tag: 'rect', attrs: { x: '4', y: '5', width: '16', height: '14', rx: '2' } },
    { tag: 'path', attrs: { d: 'M8 9h8M8 13h5' } },
    { tag: 'path', attrs: { d: 'M7 19l5-4 5 4' } },
  ],
  arrange: [
    { tag: 'path', attrs: { d: 'M5 6h14M8 6v12M16 6v12M5 18h14' } },
    { tag: 'path', attrs: { d: 'M10 10h4M9 14h6' } },
  ],
  camera: [
    { tag: 'path', attrs: { d: 'M4 8.5A2.5 2.5 0 0 1 6.5 6h2l1.5-2h4l1.5 2h2A2.5 2.5 0 0 1 20 8.5v7A2.5 2.5 0 0 1 17.5 18h-11A2.5 2.5 0 0 1 4 15.5z' } },
    { tag: 'circle', attrs: { cx: '12', cy: '12', r: '3' } },
  ],
  'chevron-down': [
    { tag: 'polyline', attrs: { points: '7 10 12 15 17 10' } },
  ],
  'chevron-right': [
    { tag: 'polyline', attrs: { points: '10 7 15 12 10 17' } },
  ],
  discard: [
    { tag: 'path', attrs: { d: 'M6 6l12 12M18 6L6 18' } },
    { tag: 'path', attrs: { d: 'M5 12a7 7 0 0 1 7-7 7 7 0 0 1 5.2 2.3M19 12a7 7 0 0 1-7 7 7 7 0 0 1-5.2-2.3' } },
  ],
  execute: [
    { tag: 'path', attrs: { d: 'M8 5l10 7-10 7z' } },
  ],
  group: [
    { tag: 'rect', attrs: { x: '5', y: '5', width: '7', height: '7', rx: '1.5' } },
    { tag: 'rect', attrs: { x: '12', y: '12', width: '7', height: '7', rx: '1.5' } },
    { tag: 'path', attrs: { d: 'M8.5 12v3.5H12M12 8.5h3.5V12' } },
  ],
  help: [
    { tag: 'circle', attrs: { cx: '12', cy: '12', r: '9' } },
    { tag: 'path', attrs: { d: 'M9.8 9.4a2.4 2.4 0 0 1 4.4 1.3c0 1.7-1.9 2.1-2.2 3.4' } },
    { tag: 'line', attrs: { x1: '12', y1: '17', x2: '12.01', y2: '17' } },
  ],
  hierarchy: [
    { tag: 'path', attrs: { d: 'M12 5v5M6 14v-3h12v3' } },
    { tag: 'rect', attrs: { x: '9', y: '3', width: '6', height: '4', rx: '1' } },
    { tag: 'rect', attrs: { x: '3', y: '14', width: '6', height: '5', rx: '1' } },
    { tag: 'rect', attrs: { x: '15', y: '14', width: '6', height: '5', rx: '1' } },
  ],
  history: [
    { tag: 'path', attrs: { d: 'M5 7v5h5' } },
    { tag: 'path', attrs: { d: 'M5.8 15.4A7 7 0 1 0 5 7' } },
    { tag: 'path', attrs: { d: 'M12 8v4l3 2' } },
  ],
  inspector: [
    { tag: 'rect', attrs: { x: '5', y: '4', width: '14', height: '16', rx: '2' } },
    { tag: 'path', attrs: { d: 'M9 8h6M9 12h6M9 16h3' } },
  ],
  local: [
    { tag: 'circle', attrs: { cx: '12', cy: '12', r: '3' } },
    { tag: 'path', attrs: { d: 'M12 3v3M12 18v3M3 12h3M18 12h3' } },
  ],
  lock: [
    { tag: 'rect', attrs: { x: '6', y: '10', width: '12', height: '9', rx: '2' } },
    { tag: 'path', attrs: { d: 'M9 10V7a3 3 0 0 1 6 0v3' } },
  ],
  move: [
    { tag: 'path', attrs: { d: 'M12 3v18M3 12h18' } },
    { tag: 'path', attrs: { d: 'M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3' } },
  ],
  object: [
    { tag: 'path', attrs: { d: 'M12 3l7 4v9l-7 4-7-4V7z' } },
    { tag: 'path', attrs: { d: 'M5 7l7 4 7-4M12 11v9' } },
  ],
  'place-ground': [
    { tag: 'path', attrs: { d: 'M4 18h16' } },
    { tag: 'path', attrs: { d: 'M12 4v10' } },
    { tag: 'path', attrs: { d: 'M8 10l4 4 4-4' } },
  ],
  'place-off': [
    { tag: 'path', attrs: { d: 'M4 18h16M12 4v10M8 10l4 4 4-4' } },
    { tag: 'path', attrs: { d: 'M5 5l14 14' } },
  ],
  'place-surface': [
    { tag: 'path', attrs: { d: 'M4 16l5-5 4 4 7-7' } },
    { tag: 'path', attrs: { d: 'M12 4v10M8 10l4 4 4-4' } },
  ],
  redo: [
    { tag: 'path', attrs: { d: 'M19 7v6h-6' } },
    { tag: 'path', attrs: { d: 'M18 13a6 6 0 1 1-1.7-4.2L19 11' } },
  ],
  root: [
    { tag: 'circle', attrs: { cx: '12', cy: '5', r: '2' } },
    { tag: 'path', attrs: { d: 'M12 7v11M7 12h10' } },
    { tag: 'circle', attrs: { cx: '7', cy: '18', r: '2' } },
    { tag: 'circle', attrs: { cx: '17', cy: '18', r: '2' } },
  ],
  rotate: [
    { tag: 'path', attrs: { d: 'M18 8a7 7 0 1 0 1.3 6.1' } },
    { tag: 'path', attrs: { d: 'M18 4v4h-4' } },
  ],
  save: [
    { tag: 'path', attrs: { d: 'M5 4h12l2 2v15H5z' } },
    { tag: 'path', attrs: { d: 'M8 4v6h9M8 21v-6h8v6' } },
  ],
  scale: [
    { tag: 'path', attrs: { d: 'M4 14v6h6M20 10V4h-6' } },
    { tag: 'path', attrs: { d: 'M20 4l-7 7M4 20l7-7' } },
  ],
  select: [
    { tag: 'path', attrs: { d: 'M5 4l10 10-5 1.5L8.5 20z' } },
  ],
  snap: [
    { tag: 'path', attrs: { d: 'M8 4v6a4 4 0 0 0 8 0V4' } },
    { tag: 'path', attrs: { d: 'M8 8h4M16 8h-4M8 4h4M16 4h-4M12 14v6' } },
  ],
  status: [
    { tag: 'circle', attrs: { cx: '12', cy: '12', r: '9' } },
    { tag: 'path', attrs: { d: 'M12 8v5' } },
    { tag: 'line', attrs: { x1: '12', y1: '16', x2: '12.01', y2: '16' } },
  ],
  theme: [
    { tag: 'circle', attrs: { cx: '12', cy: '12', r: '9' } },
    { tag: 'path', attrs: { d: 'M12 3v18' } },
    { tag: 'path', attrs: { d: 'M12 5a7 7 0 0 1 0 14' } },
  ],
  undo: [
    { tag: 'path', attrs: { d: 'M5 7v6h6' } },
    { tag: 'path', attrs: { d: 'M6 13a6 6 0 1 0 1.7-4.2L5 11' } },
  ],
  world: [
    { tag: 'circle', attrs: { cx: '12', cy: '12', r: '9' } },
    { tag: 'path', attrs: { d: 'M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18' } },
  ],
} satisfies Record<LocalEditorIconName, readonly LocalEditorIconElement[]>;

export function isLocalEditorIconName(value: unknown): value is LocalEditorIconName {
  return typeof value === 'string' && LOCAL_EDITOR_ICON_SET.has(value);
}

export function resolveLocalEditorIconName(
  value: unknown,
  fallback: LocalEditorIconName = 'object',
): LocalEditorIconName {
  return isLocalEditorIconName(value) ? value : fallback;
}

export function createLocalEditorIcon(
  doc: Document,
  name: LocalEditorIconName,
  options: LocalEditorIconOptions = {},
): HTMLSpanElement {
  const resolvedName = resolveLocalEditorIconName(name);
  const size = options.size ?? 14;
  const strokeWidth = options.strokeWidth ?? 2;
  const icon = doc.createElement('span');
  icon.dataset.editorIcon = resolvedName;
  icon.setAttribute('aria-hidden', 'true');
  icon.style.cssText = [
    `width:${size}px`,
    `height:${size}px`,
    `flex:0 0 ${size}px`,
    'display:inline-flex',
    'align-items:center',
    'justify-content:center',
    'color:currentColor',
    'pointer-events:none',
  ].join(';');

  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', String(strokeWidth));
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('focusable', 'false');

  for (const node of LOCAL_EDITOR_ICON_DEFINITIONS[resolvedName]) {
    const element = doc.createElementNS('http://www.w3.org/2000/svg', node.tag);
    for (const [key, value] of Object.entries(node.attrs)) {
      element.setAttribute(key, value);
    }
    svg.appendChild(element);
  }

  icon.appendChild(svg);
  return icon;
}
