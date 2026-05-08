import React, { useEffect, useRef, useCallback } from 'react';
import {
  EditorState,
  Transaction,
  StateField,
  StateEffect,
  RangeSetBuilder,
} from '@codemirror/state';
import {
  EditorView,
  ViewUpdate,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  drawSelection,
  dropCursor,
  rectangularSelection,
  highlightActiveLine,
  Decoration,
  DecorationSet,
  WidgetType,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { oneDark } from '@codemirror/theme-one-dark';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { TextOperation } from '../../ot/TextOperation';
import { RemoteUser } from '../../store/useEditorStore';

// ── Remote Cursor Widget ───────────────────────────────────────────────────────
class RemoteCursorWidget extends WidgetType {
  constructor(readonly username: string, readonly color: string) {
    super();
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('span');
    wrap.className = 'cm-remote-cursor';
    wrap.style.setProperty('--cursor-color', this.color);

    const caret = document.createElement('span');
    caret.className = 'cm-remote-caret';

    const label = document.createElement('span');
    label.className = 'cm-remote-label';
    label.textContent = this.username;
    label.style.background = this.color;

    wrap.appendChild(caret);
    wrap.appendChild(label);
    return wrap;
  }

  eq(other: RemoteCursorWidget) {
    return other.username === this.username && other.color === this.color;
  }

  ignoreEvent() { return true; }
}

// ── StateEffect & StateField for cursor positions ────────────────────────────
const setCursorsEffect = StateEffect.define<RemoteUser[]>();

const cursorDecorationsField = StateField.define<DecorationSet>({
  create() { return Decoration.none; },

  update(deco, tr) {
    // Map existing decorations through document changes
    deco = deco.map(tr.changes);

    for (const effect of tr.effects) {
      if (effect.is(setCursorsEffect)) {
        const builder = new RangeSetBuilder<Decoration>();

        // Sort by cursor position so RangeSetBuilder receives them in order
        const sorted = [...effect.value]
          .filter(u => u.cursor !== undefined && u.cursor >= 0)
          .sort((a, b) => (a.cursor ?? 0) - (b.cursor ?? 0));

        for (const user of sorted) {
          const pos = Math.min(user.cursor!, tr.newDoc.length);
          builder.add(
            pos,
            pos,
            Decoration.widget({
              widget: new RemoteCursorWidget(user.username, user.color),
              side: 1,
            })
          );
        }

        deco = builder.finish();
      }
    }
    return deco;
  },

  provide: f => EditorView.decorations.from(f),
});

// ── Component ─────────────────────────────────────────────────────────────────
interface CollabEditorProps {
  initialDoc: string;
  onLocalOp: (op: TextOperation) => void;
  onCursorChange: (cursor: number) => void;
  /** Ref populated by this component so the parent can push remote ops in */
  applyRemoteRef: React.MutableRefObject<((op: TextOperation) => void) | null>;
  remoteUsers: RemoteUser[];
}

export function CollabEditor({
  initialDoc,
  onLocalOp,
  onCursorChange,
  applyRemoteRef,
  remoteUsers,
}: CollabEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const suppressRef = useRef(false); // prevent remote apply from firing onLocalOp

  // ── Sync remote cursor decorations whenever remoteUsers changes ─────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: setCursorsEffect.of(remoteUsers) });
  }, [remoteUsers]);

  // ── Apply a remote op without triggering onLocalOp ──────────────────────────
  const applyRemoteOp = useCallback((op: TextOperation) => {
    const view = viewRef.current;
    if (!view) return;
    suppressRef.current = true;
    try {
      const currentDoc = view.state.doc.toString();
      const newDoc = op.apply(currentDoc);
      const changes = computeChangesFromOp(op);
      view.dispatch({ changes, annotations: [Transaction.remote.of(true)] });
      // Verify apply succeeded (defensive)
      if (view.state.doc.toString() !== newDoc) {
        // Fallback: replace entire doc
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: newDoc },
          annotations: [Transaction.remote.of(true)],
        });
      }
    } catch (e) {
      console.error('applyRemoteOp failed:', e);
    } finally {
      suppressRef.current = false;
    }
  }, []);

  useEffect(() => {
    applyRemoteRef.current = applyRemoteOp;
  }, [applyRemoteOp, applyRemoteRef]);

  // ── Mount CodeMirror once ────────────────────────────────────────────────────
  useEffect(() => {
    if (!editorRef.current) return;

    const updateListener = EditorView.updateListener.of((update: ViewUpdate) => {
      if (update.docChanged && !suppressRef.current) {
        const changes: Array<{ from: number; to: number; insert: string }> = [];
        update.changes.iterChanges((from, to, _fromB, _toB, insert) => {
          changes.push({ from, to, insert: insert.toString() });
        });
        const prevLen = update.startState.doc.length;
        const op = TextOperation.fromCMChanges(changes, prevLen);
        onLocalOp(op);
      }
      if (update.selectionSet) {
        onCursorChange(update.state.selection.main.head);
      }
    });

    const state = EditorState.create({
      doc: initialDoc,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        history(),
        drawSelection(),
        dropCursor(),
        rectangularSelection(),
        EditorView.lineWrapping,
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        oneDark,
        cursorDecorationsField,
        EditorView.theme({
          '&': {
            height: '100%',
            fontSize: '15px',
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          },
          '.cm-scroller': {
            overflow: 'auto',
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          },
          '.cm-content': { padding: '16px 0', minHeight: '100%' },
          '.cm-gutters': {
            background: '#1a1b26',
            borderRight: '1px solid #2a2b3d',
          },
          '.cm-lineNumbers': { color: '#3d4066' },
          '&.cm-focused': { outline: 'none' },
          // Remote cursor styles injected into the CM theme
          '.cm-remote-cursor': {
            position: 'relative',
            display: 'inline-block',
            width: '0px',
          },
          '.cm-remote-caret': {
            position: 'absolute',
            top: '0',
            bottom: '0',
            left: '-1px',
            width: '2px',
            background: 'var(--cursor-color)',
            borderRadius: '1px',
          },
          '.cm-remote-label': {
            position: 'absolute',
            top: '-22px',
            left: '-1px',
            fontSize: '11px',
            fontFamily: "'Inter', sans-serif",
            fontWeight: '600',
            padding: '1px 6px',
            borderRadius: '4px 4px 4px 0',
            color: '#fff',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: '10',
            opacity: '0',
            transition: 'opacity 0.15s ease',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          },
          '.cm-remote-cursor:hover .cm-remote-label': {
            opacity: '1',
          },
        }),
        // Always show labels (no hover needed for demo)
        EditorView.baseTheme({
          '.cm-remote-label': { opacity: '1 !important' },
        }),
        updateListener,
      ],
    });

    const view = new EditorView({ state, parent: editorRef.current });
    viewRef.current = view;
    view.focus();

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []); // mount once — intentionally no deps

  return <div ref={editorRef} className="cm-editor-wrapper" />;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
/**
 * Convert a TextOperation directly into CodeMirror ChangeSpec array.
 * Walking the ops is cheaper than diffing the resulting strings.
 */
function computeChangesFromOp(op: TextOperation): Array<{ from: number; to?: number; insert?: string }> {
  const changes: Array<{ from: number; to?: number; insert?: string }> = [];
  let pos = 0;
  for (const o of op.ops) {
    if (o.t === 'r') {
      pos += o.n;
    } else if (o.t === 'i') {
      changes.push({ from: pos, insert: o.s });
    } else {
      changes.push({ from: pos, to: pos + o.n });
      pos += o.n;
    }
  }
  return changes;
}
