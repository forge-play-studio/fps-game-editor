import { describe, expect, it } from 'vitest';
import {
  createInspectorEditPayload,
  type InspectorObject,
  type InspectorProperty,
} from '@fps-games/editor-core';
import {
  mergeLocalEditorHarnessInspectorComponentSections,
} from '@fps-games/editor';

interface HarnessTestDocument {
  teams: string[];
}

function createInspectorObject(properties: InspectorProperty<HarnessTestDocument>[] = []): InspectorObject<HarnessTestDocument> {
  const document = { teams: ['red', 'blue'] };
  return {
    targetIds: ['spawn_01'],
    activeId: 'spawn_01',
    document,
    selection: {
      targetIds: ['spawn_01'],
      activeId: 'spawn_01',
      targetKind: 'spawnPoint',
      document,
    },
    sections: properties.length > 0
      ? [{ id: 'base', title: 'Base', properties }]
      : [],
  };
}

function createTeamProperty(
  overrides: Partial<InspectorProperty<HarnessTestDocument>> = {},
): InspectorProperty<HarnessTestDocument> {
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
    validate: value => value === 'red' || value === 'blue'
      ? { ok: true, value }
      : { ok: false, message: 'Unknown team.' },
    ...overrides,
  };
}

describe('local editor harness inspector extensions', () => {
  it('merges component fields into the same edit validation contract used by adapter fields', () => {
    const inspector = mergeLocalEditorHarnessInspectorComponentSections({
      inspectorObject: createInspectorObject(),
      components: [{
        id: 'test.spawn',
        requiredCapabilities: ['spawn'],
        supports: context => context.targetKind === 'spawnPoint',
        createSections: () => [{
          id: 'spawn',
          title: 'Spawn',
          properties: [createTeamProperty()],
        }],
      }],
      context: {
        targetIds: ['spawn_01'],
        activeId: 'spawn_01',
        targetKind: 'spawnPoint',
        capabilities: ['spawn'],
      },
    });

    const property = inspector.sections[0]?.properties[0];
    expect(property?.path).toBe('spawn.team');
    expect(createInspectorEditPayload(property!, {
      targetId: 'spawn_01',
      path: 'spawn.team',
      value: 'blue',
      source: 'custom',
    })).toMatchObject({
      ok: true,
      value: {
        path: 'spawn.team',
        value: 'blue',
        source: 'custom',
      },
    });
    expect(createInspectorEditPayload(property!, {
      targetId: 'spawn_01',
      path: 'spawn.team',
      value: 'green',
      source: 'custom',
    })).toEqual({
      ok: false,
      message: 'Unknown team.',
    });
  });

  it('rejects extension fields that collide with base editable document paths by default', () => {
    const baseProperty = createTeamProperty({ label: 'Base Team', control: 'string' });
    const extensionProperty = createTeamProperty({ label: 'Extension Team' });

    expect(() => mergeLocalEditorHarnessInspectorComponentSections({
      inspectorObject: createInspectorObject([baseProperty]),
      components: [{
        id: 'test.spawn',
        createSections: () => [{
          id: 'spawn',
          title: 'Spawn',
          properties: [extensionProperty],
        }],
      }],
    })).toThrow('Inspector property path "spawn.team" is already registered.');

    const replaced = mergeLocalEditorHarnessInspectorComponentSections({
      inspectorObject: createInspectorObject([baseProperty]),
      components: [{
        id: 'test.spawn',
        createSections: () => [{
          id: 'spawn',
          title: 'Spawn',
          properties: [extensionProperty],
        }],
      }],
      propertyConflict: 'replace',
    });

    expect(replaced.sections.flatMap(section => section.properties.map(property => property.label)))
      .toEqual(['Extension Team']);
  });
});
