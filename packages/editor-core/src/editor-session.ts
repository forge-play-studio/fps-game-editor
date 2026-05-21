import type { AuthoringSourceDescriptor } from './authoring-source';

export type EditorSessionLifecycle =
  | 'idle'
  | 'editing'
  | 'saving'
  | 'exiting'
  | 'error';

export interface EditorSelectionState {
  selectedIds: string[];
  activeId: string | null;
}

export interface EditorCommandBase {
  type: string;
  label?: string;
}

export interface DocumentPatchCommand<TPatch = unknown> extends EditorCommandBase {
  type: 'document.patch';
  patch: TPatch;
  targetId?: string;
  propertyPath?: string;
}

export interface DocumentReplaceCommand<TDocument> extends EditorCommandBase {
  type: 'document.replace';
  document: TDocument;
}

export type DocumentCommand<TDocument = unknown, TPatch = unknown> =
  | DocumentPatchCommand<TPatch>
  | DocumentReplaceCommand<TDocument>;

export interface SelectionReplaceCommand extends EditorCommandBase {
  type: 'selection.replace';
  selectedIds: string[];
  activeId?: string | null;
}

export interface SelectionAddCommand extends EditorCommandBase {
  type: 'selection.add';
  selectedIds: string[];
  activeId?: string | null;
}

export interface SelectionRemoveCommand extends EditorCommandBase {
  type: 'selection.remove';
  selectedIds: string[];
}

export interface SelectionToggleCommand extends EditorCommandBase {
  type: 'selection.toggle';
  selectedIds: string[];
  activeId?: string | null;
}

export interface SelectionClearCommand extends EditorCommandBase {
  type: 'selection.clear';
}

export type SelectionCommand =
  | SelectionReplaceCommand
  | SelectionAddCommand
  | SelectionRemoveCommand
  | SelectionToggleCommand
  | SelectionClearCommand;

export type EditorCommand<TDocument = unknown, TPatch = unknown> =
  | DocumentCommand<TDocument, TPatch>
  | SelectionCommand;

export interface EditorSessionState<TDocument> {
  persistedDocument: TDocument;
  workingDocument: TDocument;
  source?: AuthoringSourceDescriptor;
  selection: EditorSelectionState;
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  history: EditorSessionHistoryView;
  lifecycle: EditorSessionLifecycle;
}

export interface EditorSessionDispatchResult<TDocument> {
  command: EditorCommand;
  workingDocument: TDocument;
  selection: EditorSelectionState;
  dirty: boolean;
  documentChanged: boolean;
  selectionChanged: boolean;
  transaction?: UndoTransaction<TDocument>;
}

export interface EditorSessionOptions<TDocument, TPatch = unknown> {
  source?: AuthoringSourceDescriptor;
  persistedDocument: TDocument;
  workingDocument?: TDocument;
  selection?: Partial<EditorSelectionState>;
  lifecycle?: EditorSessionLifecycle;
  cloneDocument?: (document: TDocument) => TDocument;
  compareDocuments?: (left: TDocument, right: TDocument) => boolean;
  reduceDocument?: (
    document: TDocument,
    command: DocumentCommand<TDocument, TPatch>,
  ) => TDocument;
}

export interface UndoTransaction<TDocument> {
  id: string;
  label: string;
  commandType: string;
  beforeDocument: TDocument;
  afterDocument: TDocument;
  createdAt: number;
}

export interface EditorSessionHistoryEntry {
  id: string;
  label: string;
  commandType: string;
  createdAt: number;
}

export interface EditorSessionHistoryView {
  entries: EditorSessionHistoryEntry[];
}

export interface EditorSessionHistoryResult<TDocument> {
  transaction: UndoTransaction<TDocument>;
  workingDocument: TDocument;
  selection: EditorSelectionState;
  dirty: boolean;
  documentChanged: true;
}

type StructuredCloneHost = typeof globalThis & {
  structuredClone?: <T>(value: T) => T;
};

function defaultCloneDocument<TDocument>(document: TDocument): TDocument {
  const structuredCloneFn = (globalThis as StructuredCloneHost).structuredClone;
  if (typeof structuredCloneFn === 'function') return structuredCloneFn(document);
  return JSON.parse(JSON.stringify(document)) as TDocument;
}

function defaultCompareDocuments<TDocument>(left: TDocument, right: TDocument): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizeSelection(selection?: Partial<EditorSelectionState>): EditorSelectionState {
  const selectedIds = uniqueIds(selection?.selectedIds ?? []);
  const activeId = selection?.activeId && selectedIds.includes(selection.activeId)
    ? selection.activeId
    : selectedIds[selectedIds.length - 1] ?? null;
  return {
    selectedIds,
    activeId,
  };
}

function uniqueIds(ids: readonly string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

function selectionEquals(left: EditorSelectionState, right: EditorSelectionState): boolean {
  if (left.activeId !== right.activeId) return false;
  if (left.selectedIds.length !== right.selectedIds.length) return false;
  return left.selectedIds.every((id, index) => right.selectedIds[index] === id);
}

function applySelectionCommand(
  selection: EditorSelectionState,
  command: SelectionCommand,
): EditorSelectionState {
  if (command.type === 'selection.clear') return normalizeSelection();

  if (command.type === 'selection.replace') {
    return normalizeSelection({
      selectedIds: command.selectedIds,
      activeId: command.activeId,
    });
  }

  if (command.type === 'selection.add') {
    const selectedIds = uniqueIds([...selection.selectedIds, ...command.selectedIds]);
    return normalizeSelection({
      selectedIds,
      activeId: command.activeId ?? command.selectedIds[command.selectedIds.length - 1] ?? selection.activeId,
    });
  }

  if (command.type === 'selection.remove') {
    const removeIds = new Set(command.selectedIds);
    const selectedIds = selection.selectedIds.filter(id => !removeIds.has(id));
    return normalizeSelection({
      selectedIds,
      activeId: selection.activeId && selectedIds.includes(selection.activeId)
        ? selection.activeId
        : selectedIds[selectedIds.length - 1] ?? null,
    });
  }

  const selectedIds = [...selection.selectedIds];
  let activeId = selection.activeId;
  for (const id of command.selectedIds) {
    const index = selectedIds.indexOf(id);
    if (index >= 0) {
      selectedIds.splice(index, 1);
      if (activeId === id) activeId = selectedIds[selectedIds.length - 1] ?? null;
    } else if (id) {
      selectedIds.push(id);
      activeId = id;
    }
  }
  return normalizeSelection({
    selectedIds,
    activeId: command.activeId ?? activeId,
  });
}

export class EditorSession<TDocument, TPatch = unknown> {
  private source?: AuthoringSourceDescriptor;
  private persistedDocument: TDocument;
  private workingDocument: TDocument;
  private selection: EditorSelectionState;
  private lifecycle: EditorSessionLifecycle;
  private readonly cloneDocument: (document: TDocument) => TDocument;
  private readonly compareDocuments: (left: TDocument, right: TDocument) => boolean;
  private readonly reduceDocument?: (
    document: TDocument,
    command: DocumentCommand<TDocument, TPatch>,
  ) => TDocument;
  private undoStack: UndoTransaction<TDocument>[] = [];
  private redoStack: UndoTransaction<TDocument>[] = [];
  private nextTransactionId = 1;

  constructor(options: EditorSessionOptions<TDocument, TPatch>) {
    this.cloneDocument = options.cloneDocument ?? defaultCloneDocument;
    this.compareDocuments = options.compareDocuments ?? defaultCompareDocuments;
    this.reduceDocument = options.reduceDocument;
    this.source = cloneAuthoringSourceDescriptorOptional(options.source);
    this.persistedDocument = this.cloneDocument(options.persistedDocument);
    this.workingDocument = this.cloneDocument(options.workingDocument ?? options.persistedDocument);
    this.selection = normalizeSelection(options.selection);
    this.lifecycle = options.lifecycle ?? 'editing';
  }

  getState(): EditorSessionState<TDocument> {
    return {
      persistedDocument: this.cloneDocument(this.persistedDocument),
      workingDocument: this.cloneDocument(this.workingDocument),
      source: cloneAuthoringSourceDescriptorOptional(this.source),
      selection: this.getSelection(),
      dirty: this.isDirty(),
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      history: this.getHistoryView(),
      lifecycle: this.lifecycle,
    };
  }

  getWorkingDocument(): TDocument {
    return this.cloneDocument(this.workingDocument);
  }

  getSource(): AuthoringSourceDescriptor | undefined {
    return cloneAuthoringSourceDescriptorOptional(this.source);
  }

  getSelection(): EditorSelectionState {
    return {
      selectedIds: [...this.selection.selectedIds],
      activeId: this.selection.activeId,
    };
  }

  isDirty(): boolean {
    return !this.compareDocuments(this.workingDocument, this.persistedDocument);
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  getLifecycle(): EditorSessionLifecycle {
    return this.lifecycle;
  }

  setLifecycle(lifecycle: EditorSessionLifecycle): EditorSessionState<TDocument> {
    this.lifecycle = lifecycle;
    return this.getState();
  }

  dispatch(command: EditorCommand<TDocument, TPatch>): EditorSessionDispatchResult<TDocument> {
    const beforeDocument = this.cloneDocument(this.workingDocument);
    const beforeSelection = this.selection;
    if (isSelectionCommand(command)) {
      this.selection = applySelectionCommand(this.selection, command);
    } else if (command.type === 'document.replace') {
      this.workingDocument = this.cloneDocument(command.document);
    } else if (command.type === 'document.patch') {
      if (!this.reduceDocument) {
        throw new Error('EditorSession requires reduceDocument to handle document.patch commands.');
      }
      this.workingDocument = this.reduceDocument(
        this.cloneDocument(this.workingDocument),
        command,
      );
    }
    const documentChanged = !this.compareDocuments(beforeDocument, this.workingDocument);
    const selectionChanged = !selectionEquals(beforeSelection, this.selection);
    const transaction = documentChanged && isDocumentCommand(command)
      ? this.pushTransaction(command, beforeDocument, this.workingDocument)
      : undefined;
    return {
      command,
      workingDocument: this.cloneDocument(this.workingDocument),
      selection: this.getSelection(),
      dirty: this.isDirty(),
      documentChanged,
      selectionChanged,
      transaction,
    };
  }

  undo(): EditorSessionHistoryResult<TDocument> | null {
    const transaction = this.undoStack.pop();
    if (!transaction) return null;
    this.redoStack.push(transaction);
    this.workingDocument = this.cloneDocument(transaction.beforeDocument);
    return {
      transaction,
      workingDocument: this.cloneDocument(this.workingDocument),
      selection: this.getSelection(),
      dirty: this.isDirty(),
      documentChanged: true,
    };
  }

  redo(): EditorSessionHistoryResult<TDocument> | null {
    const transaction = this.redoStack.pop();
    if (!transaction) return null;
    this.undoStack.push(transaction);
    this.workingDocument = this.cloneDocument(transaction.afterDocument);
    return {
      transaction,
      workingDocument: this.cloneDocument(this.workingDocument),
      selection: this.getSelection(),
      dirty: this.isDirty(),
      documentChanged: true,
    };
  }

  markSaved(document: TDocument, source?: AuthoringSourceDescriptor): EditorSessionState<TDocument> {
    if (source) this.source = cloneAuthoringSourceDescriptorOptional(source);
    this.persistedDocument = this.cloneDocument(document);
    this.workingDocument = this.cloneDocument(document);
    return this.getState();
  }

  reset(document: TDocument, source?: AuthoringSourceDescriptor): EditorSessionState<TDocument> {
    this.source = cloneAuthoringSourceDescriptorOptional(source);
    this.persistedDocument = this.cloneDocument(document);
    this.workingDocument = this.cloneDocument(document);
    this.selection = normalizeSelection();
    this.lifecycle = 'editing';
    this.undoStack = [];
    this.redoStack = [];
    return this.getState();
  }

  private pushTransaction(
    command: DocumentCommand<TDocument, TPatch>,
    beforeDocument: TDocument,
    afterDocument: TDocument,
  ): UndoTransaction<TDocument> {
    const transaction: UndoTransaction<TDocument> = {
      id: `transaction_${this.nextTransactionId++}`,
      label: command.label ?? command.type,
      commandType: command.type,
      beforeDocument: this.cloneDocument(beforeDocument),
      afterDocument: this.cloneDocument(afterDocument),
      createdAt: Date.now(),
    };
    this.undoStack.push(transaction);
    this.redoStack = [];
    return transaction;
  }

  private getHistoryView(): EditorSessionHistoryView {
    return {
      entries: [...this.undoStack, ...this.redoStack]
        .map(toHistoryEntry)
        .sort((left, right) => right.createdAt - left.createdAt),
    };
  }
}

function toHistoryEntry<TDocument>(
  transaction: UndoTransaction<TDocument>,
): EditorSessionHistoryEntry {
  return {
    id: transaction.id,
    label: transaction.label,
    commandType: transaction.commandType,
    createdAt: transaction.createdAt,
  };
}

function cloneAuthoringSourceDescriptorOptional(
  source: AuthoringSourceDescriptor | undefined,
): AuthoringSourceDescriptor | undefined {
  if (!source) return undefined;
  return {
    ...source,
    ref: { ...source.ref },
    capabilities: source.capabilities ? { ...source.capabilities } : undefined,
    metadata: source.metadata ? { ...source.metadata } : undefined,
  };
}

function isDocumentCommand<TDocument, TPatch>(
  command: EditorCommand<TDocument, TPatch>,
): command is DocumentCommand<TDocument, TPatch> {
  return command.type === 'document.patch' || command.type === 'document.replace';
}

function isSelectionCommand<TDocument, TPatch>(
  command: EditorCommand<TDocument, TPatch>,
): command is SelectionCommand {
  return command.type === 'selection.replace'
    || command.type === 'selection.add'
    || command.type === 'selection.remove'
    || command.type === 'selection.toggle'
    || command.type === 'selection.clear';
}

export function createEditorSession<TDocument>(
  options: EditorSessionOptions<TDocument>,
): EditorSession<TDocument>;
export function createEditorSession<TDocument, TPatch>(
  options: EditorSessionOptions<TDocument, TPatch>,
): EditorSession<TDocument, TPatch>;
export function createEditorSession<TDocument, TPatch = unknown>(
  options: EditorSessionOptions<TDocument, TPatch>,
): EditorSession<TDocument, TPatch> {
  return new EditorSession(options);
}
