import React, { useEffect, useRef, useCallback, useState } from 'react';
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
import { FormatToolbar, FormatAction } from './FormatToolbar';
import { MarkdownPreview } from './MarkdownPreview';

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
    deco = deco.map(tr.changes);

    for (const effect of tr.effects) {
      if (effect.is(setCursorsEffect)) {
        const builder = new RangeSetBuilder<Decoration>();

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
  applyRemoteRef: React.MutableRefObject<((op: TextOperation) => void) | null>;
  remoteUsers: RemoteUser[];
  /** Callback to open the image upload file picker */
  onImageUpload: () => void;
  /** Ref that EditorPage populates: call it to insert text at the current cursor */
  insertTextRef: React.MutableRefObject<((text: string) => void) | null>;
}

export function CollabEditor({
  initialDoc,
  onLocalOp,
  onCursorChange,
  applyRemoteRef,
  remoteUsers,
  onImageUpload,
  insertTextRef,
}: CollabEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const suppressRef = useRef(false);

  const [showPreview, setShowPreview] = useState(true);
  const [previewContent, setPreviewContent] = useState(initialDoc);

  // ── Sync remote cursor decorations ───────────────────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: setCursorsEffect.of(remoteUsers) });
  }, [remoteUsers]);

  // ── Apply a remote op ────────────────────────────────────────────────────────
  const applyRemoteOp = useCallback((op: TextOperation) => {
    const view = viewRef.current;
    if (!view) return;
    suppressRef.current = true;
    try {
      const currentDoc = view.state.doc.toString();
      const newDoc = op.apply(currentDoc);
      const changes = computeChangesFromOp(op);
      view.dispatch({ changes, annotations: [Transaction.remote.of(true)] });
      if (view.state.doc.toString() !== newDoc) {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: newDoc },
          annotations: [Transaction.remote.of(true)],
        });
      }
      setPreviewContent(view.state.doc.toString());
    } catch (e) {
      console.error('applyRemoteOp failed:', e);
    } finally {
      suppressRef.current = false;
    }
  }, []);

  useEffect(() => {
    applyRemoteRef.current = applyRemoteOp;
  }, [applyRemoteOp, applyRemoteRef]);

  // ── Expose insertText to parent (for image uploads) ──────────────────────────
  useEffect(() => {
    insertTextRef.current = (text: string) => {
      const view = viewRef.current;
      if (!view) return;
      const { from } = view.state.selection.main;
      view.dispatch({
        changes: { from, to: from, insert: text },
        selection: { anchor: from + text.length },
      });
      view.focus();
    };
    return () => { insertTextRef.current = null; };
  }, [insertTextRef]);

  // ── Format toolbar action → insert markdown syntax ───────────────────────────
  const handleFormat = useCallback((action: FormatAction) => {
    const view = viewRef.current;
    if (!view) return;

    const { from, to } = view.state.selection.main;
    const selected = view.state.sliceDoc(from, to);
    const line = view.state.doc.lineAt(from);

    let insert = '';
    let anchor: number | undefined;
    let head: number | undefined;

    switch (action) {
      case 'bold':
        insert = `**${selected || 'bold text'}**`;
        if (!selected) { anchor = from + 2; head = from + 9; }
        break;
      case 'italic':
        insert = `*${selected || 'italic text'}*`;
        if (!selected) { anchor = from + 1; head = from + 12; }
        break;
      case 'strikethrough':
        insert = `~~${selected || 'strikethrough'}~~`;
        if (!selected) { anchor = from + 2; head = from + 15; }
        break;
      case 'inline-code':
        insert = `\`${selected || 'code'}\``;
        if (!selected) { anchor = from + 1; head = from + 5; }
        break;
      case 'h1':
        view.dispatch({ changes: { from: line.from, to: line.from, insert: '# ' } });
        return;
      case 'h2':
        view.dispatch({ changes: { from: line.from, to: line.from, insert: '## ' } });
        return;
      case 'h3':
        view.dispatch({ changes: { from: line.from, to: line.from, insert: '### ' } });
        return;
      case 'blockquote':
        view.dispatch({ changes: { from: line.from, to: line.from, insert: '> ' } });
        return;
      case 'hr':
        view.dispatch({ changes: { from: line.to, insert: '\n\n---\n\n' } });
        return;
      case 'ul':
        view.dispatch({ changes: { from: line.from, to: line.from, insert: '- ' } });
        return;
      case 'ol':
        view.dispatch({ changes: { from: line.from, to: line.from, insert: '1. ' } });
        return;
      case 'task-list':
        view.dispatch({ changes: { from: line.from, to: line.from, insert: '- [ ] ' } });
        return;
      case 'code-block': {
        const snippet = `\`\`\`\n${selected || 'code here'}\n\`\`\`\n`;
        view.dispatch({
          changes: { from: line.from, to: to, insert: snippet },
          selection: { anchor: line.from + 4, head: line.from + 4 + (selected ? selected.length : 9) },
        });
        return;
      }
      case 'link':
        insert = `[${selected || 'link text'}](url)`;
        if (!selected) { anchor = from + 1; head = from + 10; }
        break;
      case 'table':
        insert = '\n| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n| Cell     | Cell     | Cell     |\n';
        view.dispatch({ changes: { from: line.to, insert } });
        return;
      case 'image':
        onImageUpload();
        return;
      default:
        return;
    }

    view.dispatch({
      changes: { from, to, insert },
      selection: anchor !== undefined ? { anchor, head: head ?? anchor } : undefined,
    });
    view.focus();
  }, [onImageUpload]);

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
        setPreviewContent(update.state.doc.toString());
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
  }, []); // mount once

  return (
    <div className="editor-split-root">
      {/* Formatting Toolbar */}
      <FormatToolbar
        onFormat={handleFormat}
        onImageUpload={onImageUpload}
        showPreview={showPreview}
        onTogglePreview={() => setShowPreview(v => !v)}
      />

      {/* Split Pane */}
      <div className={`editor-split-body ${showPreview ? 'split-active' : ''}`}>
        {/* CodeMirror Editor */}
        <div ref={editorRef} className="cm-editor-wrapper" />

        {/* Live Preview */}
        {showPreview && (
          <MarkdownPreview
            content={previewContent}
            onClose={() => setShowPreview(false)}
          />
        )}
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
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
