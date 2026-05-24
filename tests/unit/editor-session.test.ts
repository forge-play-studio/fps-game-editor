import { describe, expect, it } from 'vitest';
import {
  createEditorSession,
  type DocumentCommand,
} from '@fps-games/editor-core';

interface CounterDocument {
  value: number;
}

type CounterPatch = { value: number };

function reduceCounterDocument(
  document: CounterDocument,
  command: DocumentCommand<CounterDocument, CounterPatch>,
): CounterDocument {
  if (command.type === 'document.replace') return command.document;
  if (command.type === 'document.patch') return { value: command.patch.value };
  return document;
}

describe('EditorSession history merge', () => {
  it('removes and toggles selected ids while keeping active id valid', () => {
    const session = createEditorSession<CounterDocument, CounterPatch>({
      persistedDocument: { value: 0 },
      selection: {
        selectedIds: ['box', 'sphere'],
        activeId: 'sphere',
      },
    });

    session.dispatch({
      type: 'selection.remove',
      selectedIds: ['sphere'],
      label: 'Remove Selection',
    });
    expect(session.getSelection()).toEqual({
      selectedIds: ['box'],
      activeId: 'box',
    });

    session.dispatch({
      type: 'selection.toggle',
      selectedIds: ['box'],
      activeId: 'box',
      label: 'Toggle Selection',
    });
    expect(session.getSelection()).toEqual({
      selectedIds: [],
      activeId: null,
    });

    session.dispatch({
      type: 'selection.toggle',
      selectedIds: ['tree'],
      activeId: 'tree',
      label: 'Toggle Selection',
    });
    expect(session.getSelection()).toEqual({
      selectedIds: ['tree'],
      activeId: 'tree',
    });
  });

  it('keeps normal document patches as separate undo transactions', () => {
    const session = createEditorSession<CounterDocument, CounterPatch>({
      persistedDocument: { value: 0 },
      reduceDocument: reduceCounterDocument,
    });

    session.dispatch({ type: 'document.patch', patch: { value: 1 }, label: 'Set 1' });
    session.dispatch({ type: 'document.patch', patch: { value: 2 }, label: 'Set 2' });

    expect(session.getState().history.entries).toHaveLength(2);
    expect(session.undo()?.workingDocument).toEqual({ value: 1 });
    expect(session.undo()?.workingDocument).toEqual({ value: 0 });
  });

  it('merges a document patch into the previous undo transaction when requested', () => {
    const session = createEditorSession<CounterDocument, CounterPatch>({
      persistedDocument: { value: 0 },
      reduceDocument: reduceCounterDocument,
    });

    const first = session.dispatch({ type: 'document.patch', patch: { value: 1 }, label: 'Duplicate' });
    const second = session.dispatch(
      { type: 'document.patch', patch: { value: 2 }, label: 'Move duplicate' },
      { mergeWithPrevious: true },
    );

    expect(first.transaction?.id).toBe(second.transaction?.id);
    expect(session.getState().history.entries).toHaveLength(1);
    expect(session.getState().history.entries[0]?.label).toBe('Duplicate');
    expect(session.undo()?.workingDocument).toEqual({ value: 0 });
    expect(session.redo()?.workingDocument).toEqual({ value: 2 });
  });

  it('undoes duplicate and merged movement as one document transaction', () => {
    interface SceneDocument {
      objects: Array<{ id: string; x: number }>;
    }
    type ScenePatch =
      | { kind: 'duplicate'; object: { id: string; x: number } }
      | { kind: 'move'; id: string; x: number };
    const session = createEditorSession<SceneDocument, ScenePatch>({
      persistedDocument: { objects: [{ id: 'box', x: 0 }] },
      reduceDocument(document, command) {
        if (command.type === 'document.replace') return command.document;
        const patch = command.patch;
        if (patch.kind === 'duplicate') {
          return { objects: [...document.objects, patch.object] };
        }
        return {
          objects: document.objects.map(object => (
            object.id === patch.id ? { ...object, x: patch.x } : object
          )),
        };
      },
    });

    session.dispatch({
      type: 'document.patch',
      label: 'Duplicate box',
      patch: { kind: 'duplicate', object: { id: 'box_copy', x: 0 } },
    });
    session.dispatch({
      type: 'selection.replace',
      selectedIds: ['box_copy'],
      activeId: 'box_copy',
    });
    session.dispatch({
      type: 'document.patch',
      label: 'Move box_copy',
      patch: { kind: 'move', id: 'box_copy', x: 3 },
    }, {
      mergeWithPrevious: true,
    });

    expect(session.getState().history.entries).toHaveLength(1);
    expect(session.getState().workingDocument.objects).toEqual([
      { id: 'box', x: 0 },
      { id: 'box_copy', x: 3 },
    ]);
    expect(session.undo()?.workingDocument.objects).toEqual([{ id: 'box', x: 0 }]);
    expect(session.redo()?.workingDocument.objects).toEqual([
      { id: 'box', x: 0 },
      { id: 'box_copy', x: 3 },
    ]);
  });
});
