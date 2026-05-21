export type SerializedPropertyPath = string;

export type SerializedPropertyValueType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'asset'
  | 'object'
  | 'unknown';

export interface SerializedPropertyContext {
  targetId?: string;
  [key: string]: unknown;
}

export interface SerializedPropertyDescriptor<TDocument = unknown> {
  path: SerializedPropertyPath;
  label?: string;
  valueType?: SerializedPropertyValueType;
  readOnly?: boolean;
  getValue(document: TDocument, context: SerializedPropertyContext): unknown;
  setValue?(
    document: TDocument,
    value: unknown,
    context: SerializedPropertyContext,
  ): TDocument;
}

export interface SerializedProperty<TDocument = unknown> {
  path: SerializedPropertyPath;
  label: string;
  valueType: SerializedPropertyValueType;
  value: unknown;
  mixed?: boolean;
  readOnly: boolean;
  descriptor: SerializedPropertyDescriptor<TDocument>;
}

export interface SerializedObject<TDocument = unknown> {
  targetId: string;
  label?: string;
  properties: SerializedProperty<TDocument>[];
}

export interface SerializedMultiObject<TDocument = unknown> {
  targetIds: string[];
  activeId: string | null;
  label?: string;
  properties: SerializedProperty<TDocument>[];
}

export interface SerializedPropertyPatch {
  targetId: string;
  path: SerializedPropertyPath;
  value: unknown;
}

export interface SerializedPropertyAdapter<TDocument = unknown> {
  getSerializedObject(
    document: TDocument,
    targetId: string,
  ): SerializedObject<TDocument> | null;
  applySerializedPropertyPatch(
    document: TDocument,
    patch: SerializedPropertyPatch,
  ): TDocument;
}

export interface CreateSerializedObjectOptions<TDocument> {
  document: TDocument;
  targetId: string;
  label?: string;
  descriptors: readonly SerializedPropertyDescriptor<TDocument>[];
  context?: Omit<SerializedPropertyContext, 'targetId'>;
}

export function createSerializedObject<TDocument>(
  options: CreateSerializedObjectOptions<TDocument>,
): SerializedObject<TDocument> {
  const context: SerializedPropertyContext = {
    ...options.context,
    targetId: options.targetId,
  };
  return {
    targetId: options.targetId,
    label: options.label,
    properties: options.descriptors.map((descriptor) => ({
      path: descriptor.path,
      label: descriptor.label ?? descriptor.path,
      valueType: descriptor.valueType ?? 'unknown',
      value: descriptor.getValue(options.document, context),
      readOnly: descriptor.readOnly === true || typeof descriptor.setValue !== 'function',
      descriptor,
    })),
  };
}

export function applySerializedPropertyPatch<TDocument>(
  document: TDocument,
  descriptors: readonly SerializedPropertyDescriptor<TDocument>[],
  patch: SerializedPropertyPatch,
  context: Omit<SerializedPropertyContext, 'targetId'> = {},
): TDocument {
  const descriptor = descriptors.find((candidate) => candidate.path === patch.path);
  if (!descriptor) {
    throw new Error(`Serialized property descriptor not found: ${patch.path}`);
  }
  if (descriptor.readOnly === true || typeof descriptor.setValue !== 'function') {
    throw new Error(`Serialized property is read-only: ${patch.path}`);
  }
  return descriptor.setValue(document, patch.value, {
    ...context,
    targetId: patch.targetId,
  });
}
