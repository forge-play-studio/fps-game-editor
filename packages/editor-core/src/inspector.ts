import type {
  SerializedMultiObject,
  SerializedObject,
  SerializedProperty,
  SerializedPropertyValueType,
} from './serialized-object';

export type InspectorPersistenceMode = 'document' | 'runtime' | 'readonly';

export type InspectorControlKind =
  | 'readonly'
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'vec2'
  | 'vec3'
  | 'color'
  | 'asset'
  | 'object'
  | 'custom';

export type InspectorCommitMode = 'live' | 'blur' | 'change' | 'immediate';

export interface InspectorSelectionContext<TDocument = unknown> {
  targetIds: string[];
  activeId: string | null;
  targetKind?: string;
  document?: TDocument;
  runtimeTarget?: unknown;
  capabilities?: readonly string[];
}

export interface InspectorValidationSuccess<TValue = unknown> {
  ok: true;
  value: TValue;
}

export interface InspectorValidationFailure {
  ok: false;
  message: string;
}

export type InspectorValidationResult<TValue = unknown> =
  | InspectorValidationSuccess<TValue>
  | InspectorValidationFailure;

export interface InspectorEnumOption<TValue = string | number | boolean> {
  label: string;
  value: TValue;
  disabled?: boolean;
}

export interface InspectorProperty<TDocument = unknown> {
  id?: string;
  path: string;
  label: string;
  valueType: SerializedPropertyValueType | 'color' | 'vec2' | 'vec3';
  control: InspectorControlKind;
  customControl?: string;
  controlOptions?: Record<string, unknown>;
  value: unknown;
  mixed?: boolean;
  readOnly: boolean;
  persistence: InspectorPersistenceMode;
  commitMode: InspectorCommitMode;
  order?: number;
  tags?: readonly string[];
  tooltip?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: readonly InspectorEnumOption[];
  document?: TDocument;
  validate?: (value: unknown) => InspectorValidationResult;
  coerce?: (value: unknown) => unknown;
  source?: SerializedProperty<TDocument>;
}

export interface InspectorSection<TDocument = unknown> {
  id: string;
  title: string;
  order?: number;
  placement?: 'summary' | 'body';
  collapsedByDefault?: boolean;
  persistence?: InspectorPersistenceMode;
  runtimeOnly?: boolean;
  tags?: readonly string[];
  properties: InspectorProperty<TDocument>[];
}

export interface InspectorObject<TDocument = unknown> {
  targetIds: string[];
  activeId: string | null;
  label?: string;
  selection: InspectorSelectionContext<TDocument>;
  sections: InspectorSection<TDocument>[];
  document?: TDocument;
}

export interface InspectorEditPayload {
  targetId: string;
  targetIds?: string[];
  path: string;
  value: unknown;
  control: InspectorControlKind;
  valueType: InspectorProperty['valueType'];
  commitMode: InspectorCommitMode;
  persistence: InspectorPersistenceMode;
  source?: 'input' | 'toggle' | 'select' | 'color' | 'asset' | 'custom';
}

export interface InspectorEditInput {
  targetId: string;
  targetIds?: string[];
  path: string;
  value: unknown;
  control?: InspectorControlKind;
  valueType?: InspectorProperty['valueType'];
  commitMode?: InspectorCommitMode;
  persistence?: InspectorPersistenceMode;
  source?: InspectorEditPayload['source'];
}

export interface InspectorComponentRegistration<TDocument = unknown> {
  id: string;
  order?: number;
  requiredCapabilities?: readonly string[];
  supports?(context: InspectorSelectionContext<TDocument>): boolean;
  createSections(context: InspectorSelectionContext<TDocument>): InspectorSection<TDocument>[];
}

export type InspectorRegistryConflictStrategy = 'error' | 'ignore' | 'replace';

export interface InspectorRegistryOptions {
  onConflict?: InspectorRegistryConflictStrategy;
  propertyConflict?: InspectorRegistryConflictStrategy;
}

export interface InspectorRegistrationOptions {
  onConflict?: InspectorRegistryConflictStrategy;
}

export interface InspectorRegistrationHandle {
  id: string;
  dispose(): boolean;
}

export interface InspectorSectionMergeOptions {
  propertyConflict?: InspectorRegistryConflictStrategy;
}

export interface InspectorRegistry<TDocument = unknown> {
  register(
    component: InspectorComponentRegistration<TDocument>,
    options?: InspectorRegistrationOptions,
  ): InspectorRegistrationHandle;
  unregister(id: string): boolean;
  get(id: string): InspectorComponentRegistration<TDocument> | null;
  list(): InspectorComponentRegistration<TDocument>[];
  getSections(context: InspectorSelectionContext<TDocument>): InspectorSection<TDocument>[];
}

export function createInspectorRegistry<TDocument = unknown>(
  options: InspectorRegistryOptions = {},
): InspectorRegistry<TDocument> {
  const registrations = new Map<string, InspectorComponentRegistration<TDocument>>();
  const defaultConflict = options.onConflict ?? 'error';
  const propertyConflict = options.propertyConflict ?? 'error';
  return {
    register(component, registerOptions = {}) {
      const normalized = normalizeInspectorComponent(component);
      const conflict = registerOptions.onConflict ?? defaultConflict;
      const previous = registrations.get(normalized.id);
      if (previous) {
        if (conflict === 'error') {
          throw new Error(`Inspector component "${normalized.id}" is already registered.`);
        }
        if (conflict === 'ignore') {
          return {
            id: normalized.id,
            dispose: () => false,
          };
        }
      }
      registrations.set(normalized.id, normalized);
      return {
        id: normalized.id,
        dispose() {
          if (registrations.get(normalized.id) !== normalized) return false;
          registrations.delete(normalized.id);
          return true;
        },
      };
    },
    unregister(id) {
      return registrations.delete(id);
    },
    get(id) {
      return registrations.get(id) ?? null;
    },
    list() {
      return listInspectorComponents(registrations);
    },
    getSections(context) {
      const sections = listInspectorComponents(registrations)
        .filter(component => inspectorComponentSupports(component, context))
        .flatMap(component => component.createSections(context)
          .map(section => section.order == null && component.order != null
            ? { ...section, order: component.order }
            : section));
      return mergeInspectorSections([], sections, { propertyConflict });
    },
  };
}

export function inspectorContextHasCapabilities<TDocument>(
  context: InspectorSelectionContext<TDocument>,
  requiredCapabilities: readonly string[] | undefined,
): boolean {
  if (!requiredCapabilities || requiredCapabilities.length === 0) return true;
  const available = new Set(context.capabilities ?? []);
  return requiredCapabilities.every(capability => available.has(capability));
}

export function inspectorComponentSupports<TDocument>(
  component: InspectorComponentRegistration<TDocument>,
  context: InspectorSelectionContext<TDocument>,
): boolean {
  if (!inspectorContextHasCapabilities(context, component.requiredCapabilities)) return false;
  return component.supports?.(context) ?? true;
}

export function mergeInspectorSections<TDocument>(
  baseSections: readonly InspectorSection<TDocument>[],
  extensionSections: readonly InspectorSection<TDocument>[],
  options: InspectorSectionMergeOptions = {},
): InspectorSection<TDocument>[] {
  const propertyConflict = options.propertyConflict ?? 'error';
  const sections = new Map<string, InspectorSection<TDocument>>();
  const explicitEmptySections = new Set<string>();
  const editableProperties = new Map<string, {
    sectionId: string;
    property: InspectorProperty<TDocument>;
  }>();

  const appendSection = (section: InspectorSection<TDocument>) => {
    let target = sections.get(section.id);
    if (!target) {
      target = { ...section, properties: [] };
      sections.set(section.id, target);
    }
    if (section.properties.length === 0) explicitEmptySections.add(section.id);
    for (const property of section.properties) {
      appendProperty(target, property);
    }
  };

  const appendProperty = (
    section: InspectorSection<TDocument>,
    property: InspectorProperty<TDocument>,
  ) => {
    if (isEditableDocumentInspectorProperty(property)) {
      const previous = editableProperties.get(property.path);
      if (previous) {
        if (propertyConflict === 'error') {
          throw new Error(`Inspector property path "${property.path}" is already registered.`);
        }
        if (propertyConflict === 'ignore') return;
        const previousSection = sections.get(previous.sectionId);
        if (previousSection) {
          previousSection.properties = previousSection.properties.filter(candidate => candidate !== previous.property);
        }
      }
      editableProperties.set(property.path, { sectionId: section.id, property });
    }
    section.properties.push(property);
  };

  for (const section of baseSections) appendSection(section);
  for (const section of extensionSections) appendSection(section);
  return [...sections.values()]
    .filter(section => section.properties.length > 0 || explicitEmptySections.has(section.id))
    .sort(compareInspectorSections);
}

export function isEditableDocumentInspectorProperty<TDocument>(
  property: InspectorProperty<TDocument>,
): boolean {
  return property.persistence === 'document' && property.readOnly !== true;
}

export function serializedObjectToInspectorObject<TDocument>(
  serializedObject: SerializedObject<TDocument>,
  document?: TDocument,
): InspectorObject<TDocument> {
  return {
    targetIds: [serializedObject.targetId],
    activeId: serializedObject.targetId,
    label: serializedObject.label,
    document,
    selection: {
      targetIds: [serializedObject.targetId],
      activeId: serializedObject.targetId,
      document,
    },
    sections: serializedPropertiesToInspectorSections(serializedObject.properties),
  };
}

export function serializedMultiObjectToInspectorObject<TDocument>(
  serializedObject: SerializedMultiObject<TDocument>,
  document?: TDocument,
): InspectorObject<TDocument> {
  return {
    targetIds: serializedObject.targetIds,
    activeId: serializedObject.activeId,
    label: serializedObject.label,
    document,
    selection: {
      targetIds: serializedObject.targetIds,
      activeId: serializedObject.activeId,
      document,
    },
    sections: serializedPropertiesToInspectorSections(serializedObject.properties),
  };
}

export function serializedPropertiesToInspectorSections<TDocument>(
  properties: readonly SerializedProperty<TDocument>[],
): InspectorSection<TDocument>[] {
  const sections = new Map<string, { order: number; properties: InspectorProperty<TDocument>[] }>();
  for (const [index, property] of properties.entries()) {
    const sectionId = inferInspectorSectionId(property.path);
    const section = sections.get(sectionId) ?? { order: sections.size, properties: [] };
    section.properties.push(serializedPropertyToInspectorProperty(property, index));
    sections.set(sectionId, section);
  }

  return [...sections.entries()]
    .map(([id, section]) => ({
      id,
      title: toInspectorTitle(id),
      order: section.order,
      placement: id === 'gameObject' ? 'summary' as const : 'body' as const,
      persistence: inferSectionPersistence(section.properties),
      properties: section.properties,
    }))
    .sort(compareInspectorSections);
}

export function serializedPropertyToInspectorProperty<TDocument>(
  property: SerializedProperty<TDocument>,
  order?: number,
): InspectorProperty<TDocument> {
  const readOnly = property.readOnly === true;
  return {
    path: property.path,
    label: property.label,
    valueType: property.valueType,
    control: inferControlKind(property),
    value: property.value,
    mixed: property.mixed,
    readOnly,
    persistence: readOnly ? 'readonly' : 'document',
    commitMode: inferCommitMode(property),
    order,
    source: property,
  };
}

export function coerceInspectorEditValue(
  property: Pick<InspectorProperty, 'control' | 'valueType' | 'coerce'>,
  value: unknown,
): unknown {
  if (property.coerce) return property.coerce(value);
  if (property.control === 'number' || property.valueType === 'number') {
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : value;
  }
  if (property.control === 'boolean' || property.valueType === 'boolean') {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return value;
}

export function validateInspectorEditValue(
  property: Pick<InspectorProperty, 'readOnly' | 'persistence' | 'validate' | 'control' | 'valueType'>,
  value: unknown,
): InspectorValidationResult {
  if (property.readOnly || property.persistence !== 'document') {
    return { ok: false, message: 'Inspector property is not editable.' };
  }
  if ((property.control === 'number' || property.valueType === 'number')
    && (typeof value !== 'number' || !Number.isFinite(value))) {
    return { ok: false, message: 'Expected a finite number.' };
  }
  if ((property.control === 'boolean' || property.valueType === 'boolean') && typeof value !== 'boolean') {
    return { ok: false, message: 'Expected a boolean value.' };
  }
  return property.validate?.(value) ?? { ok: true, value };
}

export function createInspectorEditPayload(
  property: InspectorProperty,
  input: InspectorEditInput,
): InspectorValidationResult<InspectorEditPayload> {
  if (property.path !== input.path) {
    return {
      ok: false,
      message: `Inspector edit path mismatch: expected ${property.path}, received ${input.path}.`,
    };
  }
  const coercedValue = coerceInspectorEditValue(property, input.value);
  const validation = validateInspectorEditValue(property, coercedValue);
  if (!validation.ok) return validation;
  return {
    ok: true,
    value: {
      targetId: input.targetId,
      targetIds: input.targetIds,
      path: property.path,
      value: validation.value,
      control: property.control,
      valueType: property.valueType,
      commitMode: property.commitMode,
      persistence: property.persistence,
      source: input.source,
    },
  };
}

export function compareInspectorSections<TDocument>(
  left: InspectorSection<TDocument>,
  right: InspectorSection<TDocument>,
): number {
  return (left.order ?? 0) - (right.order ?? 0)
    || left.title.localeCompare(right.title)
    || left.id.localeCompare(right.id);
}

export function compareInspectorProperties<TDocument>(
  left: InspectorProperty<TDocument>,
  right: InspectorProperty<TDocument>,
): number {
  return (left.order ?? 0) - (right.order ?? 0)
    || left.label.localeCompare(right.label)
    || left.path.localeCompare(right.path);
}

function normalizeInspectorComponent<TDocument>(
  component: InspectorComponentRegistration<TDocument>,
): InspectorComponentRegistration<TDocument> {
  const id = component.id.trim();
  if (!id) throw new Error('Inspector component id is required.');
  return id === component.id ? component : { ...component, id };
}

function listInspectorComponents<TDocument>(
  registrations: Map<string, InspectorComponentRegistration<TDocument>>,
): InspectorComponentRegistration<TDocument>[] {
  return [...registrations.values()].sort(compareInspectorComponents);
}

function compareInspectorComponents<TDocument>(
  left: InspectorComponentRegistration<TDocument>,
  right: InspectorComponentRegistration<TDocument>,
): number {
  return (left.order ?? 0) - (right.order ?? 0) || left.id.localeCompare(right.id);
}

function inferInspectorSectionId(path: string): string {
  return path.split('.')[0] || 'properties';
}

function inferControlKind<TDocument>(property: SerializedProperty<TDocument>): InspectorControlKind {
  if (property.readOnly) return 'readonly';
  switch (property.valueType) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'enum':
      return 'enum';
    case 'asset':
      return 'asset';
    case 'object':
      return 'object';
    default:
      return 'readonly';
  }
}

function inferCommitMode<TDocument>(property: SerializedProperty<TDocument>): InspectorCommitMode {
  switch (property.valueType) {
    case 'number':
      return 'live';
    case 'boolean':
    case 'enum':
    case 'asset':
      return 'immediate';
    default:
      return 'blur';
  }
}

function inferSectionPersistence<TDocument>(
  properties: readonly InspectorProperty<TDocument>[],
): InspectorPersistenceMode {
  if (properties.some(property => property.persistence === 'document')) return 'document';
  if (properties.some(property => property.persistence === 'runtime')) return 'runtime';
  return 'readonly';
}

function toInspectorTitle(id: string): string {
  return id
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}
