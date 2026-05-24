import { describe, expect, it } from 'vitest';
import {
  applyLocalEditorBrowserInspectorControlBinding,
  createLocalEditorBrowserInspectorControlRegistry,
  formatLocalEditorBrowserInspectorValue,
  resolveLocalEditorBrowserInspectorSectionStatus,
  resolveLocalEditorBrowserInspectorControlRegistration,
  type LocalEditorBrowserInspectorControlRegistration,
  type LocalEditorBrowserInspectorControlRenderContext,
  type LocalEditorBrowserInspectorObject,
  type LocalEditorBrowserInspectorProperty,
} from '@fps-games/editor-browser';

const target: LocalEditorBrowserInspectorObject = {
  targetIds: ['spawn_01'],
  activeId: 'spawn_01',
  selection: {
    targetIds: ['spawn_01'],
    activeId: 'spawn_01',
  },
  sections: [],
};

function createTeamProperty(
  overrides: Partial<LocalEditorBrowserInspectorProperty> = {},
): LocalEditorBrowserInspectorProperty {
  return {
    path: 'spawn.team',
    label: 'Team',
    valueType: 'string',
    control: 'custom',
    customControl: 'test.team',
    value: 'red',
    readOnly: false,
    persistence: 'document',
    commitMode: 'change',
    ...overrides,
  };
}

function createContext(
  property = createTeamProperty(),
): LocalEditorBrowserInspectorControlRenderContext {
  return {
    doc: {} as Document,
    target,
    property,
    bindInput(element, options) {
      applyLocalEditorBrowserInspectorControlBinding(element, target, property, options);
    },
  };
}

describe('browser inspector control extensions', () => {
  it('orders custom control registrations and applies deterministic conflict behavior', () => {
    const first: LocalEditorBrowserInspectorControlRegistration = {
      id: 'test.team',
      customControl: 'test.team',
      render: () => ({ dataset: {} }) as HTMLElement,
    };
    const second: LocalEditorBrowserInspectorControlRegistration = {
      id: 'test.team',
      customControl: 'test.team',
      render: () => ({ dataset: { replacement: 'true' } }) as unknown as HTMLElement,
    };

    expect(() => createLocalEditorBrowserInspectorControlRegistry([first, second]))
      .toThrow('Inspector control "test.team" is already registered.');

    const ignored = createLocalEditorBrowserInspectorControlRegistry([first, second], 'ignore');
    expect(resolveLocalEditorBrowserInspectorControlRegistration(ignored, createContext())?.render)
      .toBe(first.render);

    const replaced = createLocalEditorBrowserInspectorControlRegistry([first, second], 'replace');
    expect(resolveLocalEditorBrowserInspectorControlRegistration(replaced, createContext())?.render)
      .toBe(second.render);
  });

  it('binds custom control inputs into the shared property edit metadata contract', () => {
    const element = {
      dataset: {},
      title: '',
      disabled: true,
    } as unknown as HTMLInputElement;
    const property = createTeamProperty({
      tooltip: 'Choose a spawn team',
    });

    applyLocalEditorBrowserInspectorControlBinding(element, target, property, { source: 'custom' });

    expect(element.dataset).toMatchObject({
      serializedTargetId: 'spawn_01',
      serializedPath: 'spawn.team',
      serializedControl: 'custom',
      serializedValueType: 'string',
      serializedCommitMode: 'change',
      serializedPersistence: 'document',
      serializedEditSource: 'custom',
    });
    expect(element.title).toBe('Choose a spawn team');
    expect(element.disabled).toBe(false);
  });

  it('disables bound inputs for non-document custom properties', () => {
    const element = {
      dataset: {},
      title: '',
      disabled: false,
    } as unknown as HTMLInputElement;

    applyLocalEditorBrowserInspectorControlBinding(element, target, createTeamProperty({
      persistence: 'runtime',
    }));

    expect(element.disabled).toBe(true);
  });

  it('disables bound inputs when a document property is not effective', () => {
    const element = {
      dataset: {},
      title: '',
      disabled: false,
    } as unknown as HTMLInputElement;

    applyLocalEditorBrowserInspectorControlBinding(element, target, createTeamProperty({
      effect: 'default',
      disabledReason: 'Configure an override first.',
    }));

    expect(element.dataset).toMatchObject({
      serializedEffect: 'default',
      serializedDisabledReason: 'Configure an override first.',
    });
    expect(element.title).toContain('Configure an override first.');
    expect(element.disabled).toBe(true);
  });

  it('resolves default sections as readonly while keeping Defaults as the visible effect summary', () => {
    const status = resolveLocalEditorBrowserInspectorSectionStatus({
      id: 'material',
      title: 'Material',
      summary: 'Defaults',
      persistence: 'readonly',
      effect: 'default',
      properties: [
        createTeamProperty({
          control: 'readonly',
          readOnly: true,
          persistence: 'readonly',
          effect: 'default',
        }),
      ],
    });

    expect(status).toEqual({
      access: 'readonly',
      effect: 'default',
      showEffectBadge: false,
    });
  });

  it('formats readonly object values with stable keys and circular guards', () => {
    const value: Record<string, unknown> = {
      z: 3,
      nested: {
        b: true,
        a: 'first',
      },
      a: 1,
    };
    value.self = value;

    expect(formatLocalEditorBrowserInspectorValue(value)).toBe([
      '{',
      '  "a": 1,',
      '  "nested": {',
      '    "a": "first",',
      '    "b": true',
      '  },',
      '  "self": "[Circular]",',
      '  "z": 3',
      '}',
    ].join('\n'));
  });
});
