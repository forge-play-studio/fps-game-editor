export const LOCAL_EDITOR_THEME_CLASS = 'fps-editor-workbench';
export type LocalEditorThemeName = 'dark' | 'light';
export const DEFAULT_LOCAL_EDITOR_THEME: LocalEditorThemeName = 'dark';
const STYLE_ID = 'fps-editor-workbench-theme';

export function normalizeLocalEditorThemeName(theme: unknown): LocalEditorThemeName {
  return theme === 'light' ? 'light' : DEFAULT_LOCAL_EDITOR_THEME;
}

export function applyLocalEditorTheme(element: HTMLElement, theme: unknown): LocalEditorThemeName {
  const normalized = normalizeLocalEditorThemeName(theme);
  element.classList.add(LOCAL_EDITOR_THEME_CLASS);
  element.dataset.fpsEditorTheme = normalized;
  return normalized;
}

export function ensureLocalEditorTheme(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .${LOCAL_EDITOR_THEME_CLASS} {
      --fps-editor-font: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --fps-editor-z-ui: 2147483639;
      font-family: var(--fps-editor-font);
    }
    .${LOCAL_EDITOR_THEME_CLASS}[data-fps-editor-theme="dark"] {
      --fps-editor-bg: #181818;
      --fps-editor-chrome: #202020;
      --fps-editor-chrome-dark: #131313;
      --fps-editor-panel: #222222;
      --fps-editor-panel-soft: #2b2b2b;
      --fps-editor-field: #141414;
      --fps-editor-border: #383838;
      --fps-editor-border-soft: #303030;
      --fps-editor-inspector-section-border: rgba(255, 255, 255, 0.22);
      --fps-editor-divider: #101010;
      --fps-editor-text: #e6e6e6;
      --fps-editor-text-strong: #ffffff;
      --fps-editor-text-inverse: #ffffff;
      --fps-editor-muted: #a0a0a0;
      --fps-editor-muted-strong: #c8c8c8;
      --fps-editor-accent: #2d75d6;
      --fps-editor-accent-soft: rgba(45, 117, 214, 0.28);
      --fps-editor-accent-strong: #58a6ff;
      --fps-editor-editable-bg: #101821;
      --fps-editor-editable-border: rgba(88, 166, 255, 0.58);
      --fps-editor-editable-shadow: 0 0 0 1px rgba(45, 117, 214, 0.18) inset;
      --fps-editor-readonly-bg: rgba(255, 255, 255, 0.035);
      --fps-editor-readonly-border: rgba(255, 255, 255, 0.075);
      --fps-editor-readonly-text: #c8c8c8;
      --fps-editor-warn: #e5b454;
      --fps-editor-warn-soft: rgba(248, 196, 79, 0.08);
      --fps-editor-warn-border: rgba(229, 180, 84, 0.45);
      --fps-editor-warn-strong: rgba(248, 196, 79, 0.95);
      --fps-editor-danger: #f85149;
      --fps-editor-danger-text: #ffd7d5;
      --fps-editor-danger-soft: rgba(248, 81, 73, 0.16);
      --fps-editor-danger-border: rgba(248, 81, 73, 0.45);
      --fps-editor-danger-strong: #ff8f87;
      --fps-editor-success: #7ee787;
      --fps-editor-button: #333333;
      --fps-editor-button-hover: #3d3d3d;
      --fps-editor-button-active: #2d75d6;
      --fps-editor-shadow-panel: 0 10px 28px rgba(0, 0, 0, 0.24);
      --fps-editor-shadow-popover: 0 12px 32px rgba(0, 0, 0, 0.35);
      --fps-editor-shadow-modal: 0 16px 42px rgba(0, 0, 0, 0.35);
      --fps-editor-shadow-inset-highlight: 0 1px 0 rgba(255, 255, 255, 0.03) inset;
      --fps-editor-row-selected: rgba(45, 117, 214, 0.30);
      --fps-editor-row-selected-text: #ffffff;
      --fps-editor-row-active: rgba(45, 117, 214, 0.50);
      --fps-editor-drop-target: rgba(88, 166, 255, 0.95);
      --fps-editor-locked-bg: #262626;
      --fps-editor-locked-text: #777777;
      --fps-editor-role-root-bg: #3a2f18;
      --fps-editor-role-group-bg: #243426;
      --fps-editor-role-object-bg: #252b34;
      --fps-editor-asset-card-bg: #243426;
      --fps-editor-box-select-bg: rgba(56, 139, 253, 0.18);
      --fps-editor-box-select-shadow: 0 0 0 1px rgba(10, 15, 23, 0.55) inset;
      --fps-editor-scrollbar-thumb: #5a5a5a;
      --fps-editor-scrollbar-track: #171717;
      color-scheme: dark;
    }
    .${LOCAL_EDITOR_THEME_CLASS}[data-fps-editor-theme="light"] {
      --fps-editor-bg: #ffffff;
      --fps-editor-chrome: #f7f7f7;
      --fps-editor-chrome-dark: #eeeeee;
      --fps-editor-panel: #ffffff;
      --fps-editor-panel-soft: #f5f5f5;
      --fps-editor-field: #fafafa;
      --fps-editor-border: #d4d4d4;
      --fps-editor-border-soft: #e5e5e5;
      --fps-editor-inspector-section-border: rgba(0, 0, 0, 0.22);
      --fps-editor-divider: #e5e5e5;
      --fps-editor-text: #242424;
      --fps-editor-text-strong: #111111;
      --fps-editor-text-inverse: #ffffff;
      --fps-editor-muted: #6f6f6f;
      --fps-editor-muted-strong: #4f4f4f;
      --fps-editor-accent: #2563eb;
      --fps-editor-accent-soft: rgba(37, 99, 235, 0.14);
      --fps-editor-accent-strong: #1d4ed8;
      --fps-editor-editable-bg: #ffffff;
      --fps-editor-editable-border: rgba(37, 99, 235, 0.42);
      --fps-editor-editable-shadow: 0 0 0 1px rgba(37, 99, 235, 0.08) inset;
      --fps-editor-readonly-bg: rgba(0, 0, 0, 0.035);
      --fps-editor-readonly-border: rgba(0, 0, 0, 0.075);
      --fps-editor-readonly-text: #4f4f4f;
      --fps-editor-warn: #a16207;
      --fps-editor-warn-soft: rgba(161, 98, 7, 0.10);
      --fps-editor-warn-border: rgba(161, 98, 7, 0.34);
      --fps-editor-warn-strong: rgba(202, 138, 4, 0.92);
      --fps-editor-danger: #dc2626;
      --fps-editor-danger-text: #991b1b;
      --fps-editor-danger-soft: rgba(220, 38, 38, 0.10);
      --fps-editor-danger-border: rgba(220, 38, 38, 0.30);
      --fps-editor-danger-strong: #b91c1c;
      --fps-editor-success: #15803d;
      --fps-editor-button: #ffffff;
      --fps-editor-button-hover: #f1f1f1;
      --fps-editor-button-active: #2563eb;
      --fps-editor-shadow-panel: 0 10px 28px rgba(0, 0, 0, 0.12);
      --fps-editor-shadow-popover: 0 12px 32px rgba(0, 0, 0, 0.16);
      --fps-editor-shadow-modal: 0 16px 42px rgba(0, 0, 0, 0.18);
      --fps-editor-shadow-inset-highlight: 0 1px 0 rgba(255, 255, 255, 0.75) inset;
      --fps-editor-row-selected: rgba(37, 99, 235, 0.12);
      --fps-editor-row-selected-text: #1d4ed8;
      --fps-editor-row-active: rgba(37, 99, 235, 0.20);
      --fps-editor-drop-target: rgba(29, 78, 216, 0.92);
      --fps-editor-locked-bg: #f1f1f1;
      --fps-editor-locked-text: #8a8a8a;
      --fps-editor-role-root-bg: #fef3c7;
      --fps-editor-role-group-bg: #dcfce7;
      --fps-editor-role-object-bg: #e0f2fe;
      --fps-editor-asset-card-bg: #eef9ef;
      --fps-editor-box-select-bg: rgba(37, 99, 235, 0.12);
      --fps-editor-box-select-shadow: 0 0 0 1px rgba(255, 255, 255, 0.80) inset;
      --fps-editor-scrollbar-thumb: #c7c7c7;
      --fps-editor-scrollbar-track: #f6f6f6;
      color-scheme: light;
    }
    .${LOCAL_EDITOR_THEME_CLASS} * {
      box-sizing: border-box;
    }
    .${LOCAL_EDITOR_THEME_CLASS} button,
    .${LOCAL_EDITOR_THEME_CLASS} input,
    .${LOCAL_EDITOR_THEME_CLASS} select {
      font-family: var(--fps-editor-font);
    }
    .${LOCAL_EDITOR_THEME_CLASS} button {
      -webkit-font-smoothing: antialiased;
    }
    .${LOCAL_EDITOR_THEME_CLASS} button:focus-visible,
    .${LOCAL_EDITOR_THEME_CLASS} input:focus-visible,
    .${LOCAL_EDITOR_THEME_CLASS} select:focus-visible {
      outline: 1px solid var(--fps-editor-accent-strong);
      outline-offset: 1px;
    }
    .${LOCAL_EDITOR_THEME_CLASS} [data-editor-panel-content]::-webkit-scrollbar,
    .${LOCAL_EDITOR_THEME_CLASS} [data-editor-workbench-region]::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    .${LOCAL_EDITOR_THEME_CLASS} [data-editor-panel-content]::-webkit-scrollbar-thumb,
    .${LOCAL_EDITOR_THEME_CLASS} [data-editor-workbench-region]::-webkit-scrollbar-thumb {
      background: var(--fps-editor-scrollbar-thumb);
    }
    .${LOCAL_EDITOR_THEME_CLASS} [data-editor-panel-content]::-webkit-scrollbar-track,
    .${LOCAL_EDITOR_THEME_CLASS} [data-editor-workbench-region]::-webkit-scrollbar-track {
      background: var(--fps-editor-scrollbar-track);
    }
  `;
  doc.head.appendChild(style);
}
