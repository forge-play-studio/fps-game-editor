import { describe, expect, it } from 'vitest';
import {
  createInspectorRegistry,
  createInspectorEditPayload,
  createSerializedObject,
  coerceInspectorEditValue,
  inspectorComponentSupports,
  mergeInspectorSections,
  serializedMultiObjectToInspectorObject,
  serializedObjectToInspectorObject,
  serializedPropertiesToInspectorSections,
  validateInspectorEditValue,
  type InspectorProperty,
  type SerializedProperty,
} from '@fps-games/editor-core';

interface TestDocument {
  name: string;
  enabled: boolean;
  transform: {
    position: { x: number; y: number; z: number };
  };
}

describe('inspector core compatibility', () => {
  it('converts serialized properties into first-seen inspector sections and preserves property order', () => {
    const document: TestDocument = {
      name: 'Box',
      enabled: true,
      transform: { position: { x: 1, y: 2, z: 3 } },
    };
    const serialized = createSerializedObject({
      document,
      targetId: 'box',
      descriptors: [
        {
          path: 'gameObject.name',
          label: 'Name',
          valueType: 'string',
          readOnly: true,
          getValue: doc => doc.name,
        },
        {
          path: 'transform.position.z',
          label: 'Z',
          valueType: 'number',
          getValue: doc => doc.transform.position.z,
          setValue: doc => doc,
        },
        {
          path: 'transform.position.x',
          label: 'X',
          valueType: 'number',
          getValue: doc => doc.transform.position.x,
          setValue: doc => doc,
        },
        {
          path: 'common.enabled',
          label: 'Enabled',
          valueType: 'boolean',
          getValue: doc => doc.enabled,
          setValue: doc => doc,
        },
      ],
    });

    const inspector = serializedObjectToInspectorObject(serialized, document);

    expect(inspector.targetIds).toEqual(['box']);
    expect(inspector.activeId).toBe('box');
    expect(inspector.sections.map(section => section.id)).toEqual(['gameObject', 'transform', 'common']);
    expect(inspector.sections[0]?.properties[0]).toMatchObject({
      path: 'gameObject.name',
      control: 'readonly',
      persistence: 'readonly',
      readOnly: true,
    });
    expect(inspector.sections[0]?.placement).toBe('summary');
    expect(inspector.sections[1]?.placement).toBe('body');
    expect(inspector.sections[1]?.properties[0]).toMatchObject({
      path: 'transform.position.z',
      control: 'number',
      persistence: 'document',
      commitMode: 'live',
    });
    expect(inspector.sections[1]?.properties.map(property => property.path)).toEqual([
      'transform.position.z',
      'transform.position.x',
    ]);
    expect(inspector.sections[2]?.properties[0]).toMatchObject({
      path: 'common.enabled',
      control: 'boolean',
      persistence: 'document',
      commitMode: 'immediate',
    });
  });

  it('converts serialized multi-objects and preserves mixed values', () => {
    const multi = serializedMultiObjectToInspectorObject({
      targetIds: ['box', 'sphere'],
      activeId: 'box',
      label: '2 objects',
      properties: [
        {
          path: 'transform.position.x',
          label: 'X',
          valueType: 'number',
          value: 1,
          mixed: true,
          readOnly: false,
          descriptor: {
            path: 'transform.position.x',
            getValue: () => 1,
          },
        },
      ],
    });

    expect(multi.targetIds).toEqual(['box', 'sphere']);
    expect(multi.activeId).toBe('box');
    expect(multi.sections[0]?.properties[0]).toMatchObject({
      path: 'transform.position.x',
      mixed: true,
      persistence: 'document',
    });
  });

  it('keeps read-only and runtime-only properties out of editable validation', () => {
    const readOnly: SerializedProperty = {
      path: 'gameObject.id',
      label: 'ID',
      valueType: 'string',
      value: 'box',
      readOnly: true,
      descriptor: {
        path: 'gameObject.id',
        getValue: () => 'box',
      },
    };
    const [section] = serializedPropertiesToInspectorSections([readOnly]);
    const property = section!.properties[0]!;

    expect(validateInspectorEditValue(property, 'next')).toEqual({
      ok: false,
      message: 'Inspector property is not editable.',
    });

    const runtimeOnly: InspectorProperty = {
      path: 'runtime.className',
      label: 'Class',
      valueType: 'string',
      control: 'string',
      value: 'Mesh',
      readOnly: false,
      persistence: 'runtime',
      commitMode: 'blur',
    };

    expect(validateInspectorEditValue(runtimeOnly, 'TransformNode')).toEqual({
      ok: false,
      message: 'Inspector property is not editable.',
    });
  });

  it('keeps default-effect document properties out of editable validation', () => {
    const property: InspectorProperty = {
      path: 'overrides.material.alpha',
      label: 'Alpha',
      valueType: 'number',
      control: 'number',
      value: 1,
      readOnly: false,
      persistence: 'document',
      commitMode: 'live',
      effect: 'default',
      disabledReason: 'Configure a material override first.',
    };

    expect(validateInspectorEditValue(property, 0.5)).toEqual({
      ok: false,
      message: 'Configure a material override first.',
    });
  });

  it('coerces typed edit values before validation', () => {
    const property: InspectorProperty = {
      path: 'transform.position.x',
      label: 'X',
      valueType: 'number',
      control: 'number',
      value: 1,
      readOnly: false,
      persistence: 'document',
      commitMode: 'live',
      validate: value => typeof value === 'number' && value >= 0
        ? { ok: true, value }
        : { ok: false, message: 'Expected a positive number.' },
    };

    expect(coerceInspectorEditValue(property, '2.5')).toBe(2.5);
    expect(createInspectorEditPayload(property, {
      targetId: 'box',
      path: 'transform.position.x',
      value: '2.5',
      source: 'input',
    })).toEqual({
      ok: true,
      value: {
        targetId: 'box',
        targetIds: undefined,
        path: 'transform.position.x',
        value: 2.5,
        control: 'number',
        valueType: 'number',
        commitMode: 'live',
        persistence: 'document',
        source: 'input',
      },
    });
    expect(createInspectorEditPayload(property, {
      targetId: 'box',
      path: 'transform.position.x',
      value: '-1',
      source: 'input',
    })).toEqual({
      ok: false,
      message: 'Expected a positive number.',
    });
  });

  it('rejects malformed number and boolean edits without custom validators', () => {
    const numberProperty: InspectorProperty = {
      path: 'transform.position.x',
      label: 'X',
      valueType: 'number',
      control: 'number',
      value: 1,
      readOnly: false,
      persistence: 'document',
      commitMode: 'live',
    };
    const booleanProperty: InspectorProperty = {
      path: 'common.enabled',
      label: 'Enabled',
      valueType: 'boolean',
      control: 'boolean',
      value: true,
      readOnly: false,
      persistence: 'document',
      commitMode: 'immediate',
    };

    expect(createInspectorEditPayload(numberProperty, {
      targetId: 'box',
      path: 'transform.position.x',
      value: 'not-a-number',
      source: 'input',
    })).toEqual({
      ok: false,
      message: 'Expected a finite number.',
    });
    expect(createInspectorEditPayload(booleanProperty, {
      targetId: 'box',
      path: 'common.enabled',
      value: 'sometimes',
      source: 'toggle',
    })).toEqual({
      ok: false,
      message: 'Expected a boolean value.',
    });
  });

  it('rejects edit payloads for runtime-only or mismatched properties', () => {
    const runtimeOnly: InspectorProperty = {
      path: 'runtime.className',
      label: 'Class',
      valueType: 'string',
      control: 'string',
      value: 'Mesh',
      readOnly: false,
      persistence: 'runtime',
      commitMode: 'blur',
    };

    expect(createInspectorEditPayload(runtimeOnly, {
      targetId: 'box',
      path: 'runtime.className',
      value: 'TransformNode',
      source: 'input',
    })).toEqual({
      ok: false,
      message: 'Inspector property is not editable.',
    });
    expect(createInspectorEditPayload(runtimeOnly, {
      targetId: 'box',
      path: 'runtime.other',
      value: 'TransformNode',
      source: 'input',
    })).toEqual({
      ok: false,
      message: 'Inspector edit path mismatch: expected runtime.className, received runtime.other.',
    });
  });

  it('orders registered inspector components and gates them by capabilities and supports checks', () => {
    const registry = createInspectorRegistry<TestDocument>();
    registry.register({
      id: 'late',
      order: 30,
      requiredCapabilities: ['transform'],
      createSections: () => [{
        id: 'lateSection',
        title: 'Late',
        properties: [],
      }],
    });
    registry.register({
      id: 'early',
      order: 10,
      supports: context => context.activeId === 'box',
      createSections: () => [{
        id: 'earlySection',
        title: 'Early',
        properties: [],
      }],
    });
    registry.register({
      id: 'missingCapability',
      order: 1,
      requiredCapabilities: ['materials'],
      createSections: () => [{
        id: 'missingSection',
        title: 'Missing',
        properties: [],
      }],
    });

    const sections = registry.getSections({
      targetIds: ['box'],
      activeId: 'box',
      capabilities: ['transform'],
    });

    expect(registry.list().map(component => component.id)).toEqual([
      'missingCapability',
      'early',
      'late',
    ]);
    expect(sections.map(section => [section.id, section.order])).toEqual([
      ['earlySection', 10],
      ['lateSection', 30],
    ]);
    expect(inspectorComponentSupports(registry.get('late')!, {
      targetIds: ['box'],
      activeId: 'box',
      capabilities: [],
    })).toBe(false);
  });

  it('defines deterministic inspector registry conflict behavior', () => {
    const createSection = (id: string) => () => [{
      id,
      title: id,
      properties: [],
    }];

    const strictRegistry = createInspectorRegistry();
    strictRegistry.register({ id: 'component', createSections: createSection('first') });
    expect(() => strictRegistry.register({ id: 'component', createSections: createSection('second') }))
      .toThrow('Inspector component "component" is already registered.');

    const replaceRegistry = createInspectorRegistry({ onConflict: 'replace' });
    const firstHandle = replaceRegistry.register({ id: 'component', createSections: createSection('first') });
    const secondHandle = replaceRegistry.register({ id: 'component', createSections: createSection('second') });
    expect(replaceRegistry.getSections({ targetIds: ['box'], activeId: 'box' }).map(section => section.id))
      .toEqual(['second']);
    expect(firstHandle.dispose()).toBe(false);
    expect(secondHandle.dispose()).toBe(true);
    expect(replaceRegistry.get('component')).toBeNull();

    const ignoreRegistry = createInspectorRegistry({ onConflict: 'ignore' });
    const ignoredFirst = ignoreRegistry.register({ id: 'component', createSections: createSection('first') });
    const ignoredSecond = ignoreRegistry.register({ id: 'component', createSections: createSection('second') });
    expect(ignoreRegistry.getSections({ targetIds: ['box'], activeId: 'box' }).map(section => section.id))
      .toEqual(['first']);
    expect(ignoredSecond.dispose()).toBe(false);
    expect(ignoredFirst.dispose()).toBe(true);
  });

  it('rejects ambiguous editable document property paths when merging extensions by default', () => {
    const baseProperty: InspectorProperty = {
      path: 'spawn.team',
      label: 'Team',
      valueType: 'string',
      control: 'string',
      value: 'red',
      readOnly: false,
      persistence: 'document',
      commitMode: 'blur',
    };
    const extensionProperty: InspectorProperty = {
      ...baseProperty,
      label: 'Custom Team',
      control: 'custom',
      customControl: 'test.team',
    };

    expect(() => mergeInspectorSections([
      { id: 'base', title: 'Base', properties: [baseProperty] },
    ], [
      { id: 'extension', title: 'Extension', properties: [extensionProperty] },
    ])).toThrow('Inspector property path "spawn.team" is already registered.');

    expect(mergeInspectorSections([
      { id: 'base', title: 'Base', properties: [baseProperty] },
    ], [
      { id: 'extension', title: 'Extension', properties: [extensionProperty] },
    ], { propertyConflict: 'ignore' }).flatMap(section => section.properties.map(property => property.label)))
      .toEqual(['Team']);

    expect(mergeInspectorSections([
      { id: 'base', title: 'Base', properties: [baseProperty] },
    ], [
      { id: 'extension', title: 'Extension', properties: [extensionProperty] },
    ], { propertyConflict: 'replace' }).flatMap(section => section.properties.map(property => property.label)))
      .toEqual(['Custom Team']);
  });
});
