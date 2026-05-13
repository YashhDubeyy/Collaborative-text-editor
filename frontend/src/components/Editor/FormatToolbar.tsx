import React, { useRef } from 'react';
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, ListChecks, Quote, Minus, Link2, Table,
  ImagePlus, Eye, EyeOff, Code2,
} from 'lucide-react';

export type FormatAction =
  | 'bold' | 'italic' | 'strikethrough' | 'inline-code'
  | 'h1' | 'h2' | 'h3'
  | 'code-block' | 'blockquote' | 'hr'
  | 'ul' | 'ol' | 'task-list'
  | 'link' | 'table' | 'image';

interface FormatToolbarProps {
  onFormat: (action: FormatAction) => void;
  onImageUpload: () => void;
  showPreview: boolean;
  onTogglePreview: () => void;
}

interface ToolbarBtn {
  action?: FormatAction;
  icon: React.ReactNode;
  label: string;
  special?: 'image' | 'preview';
}

const GROUPS: ToolbarBtn[][] = [
  [
    { action: 'bold',          icon: <Bold size={15} />,          label: 'Bold (Ctrl+B)' },
    { action: 'italic',        icon: <Italic size={15} />,        label: 'Italic (Ctrl+I)' },
    { action: 'strikethrough', icon: <Strikethrough size={15} />, label: 'Strikethrough' },
    { action: 'inline-code',   icon: <Code size={15} />,          label: 'Inline Code' },
  ],
  [
    { action: 'h1', icon: <Heading1 size={15} />, label: 'Heading 1' },
    { action: 'h2', icon: <Heading2 size={15} />, label: 'Heading 2' },
    { action: 'h3', icon: <Heading3 size={15} />, label: 'Heading 3' },
  ],
  [
    { action: 'ul',        icon: <List size={15} />,         label: 'Bullet List' },
    { action: 'ol',        icon: <ListOrdered size={15} />,  label: 'Numbered List' },
    { action: 'task-list', icon: <ListChecks size={15} />,   label: 'Task List' },
  ],
  [
    { action: 'blockquote', icon: <Quote size={15} />,  label: 'Blockquote' },
    { action: 'code-block', icon: <Code2 size={15} />,  label: 'Code Block' },
    { action: 'hr',         icon: <Minus size={15} />,  label: 'Horizontal Rule' },
  ],
  [
    { action: 'link',  icon: <Link2 size={15} />,   label: 'Insert Link' },
    { action: 'table', icon: <Table size={15} />,    label: 'Insert Table' },
    { special: 'image', icon: <ImagePlus size={15} />, label: 'Upload Image' },
  ],
];

export function FormatToolbar({ onFormat, onImageUpload, showPreview, onTogglePreview }: FormatToolbarProps) {
  return (
    <div className="format-toolbar">
      <div className="format-toolbar-groups">
        {GROUPS.map((group, gi) => (
          <React.Fragment key={gi}>
            <div className="format-group">
              {group.map((btn) => {
                if (btn.special === 'image') {
                  return (
                    <button
                      key="image"
                      className="format-btn"
                      title={btn.label}
                      onClick={onImageUpload}
                      type="button"
                    >
                      {btn.icon}
                    </button>
                  );
                }
                return (
                  <button
                    key={btn.action}
                    className="format-btn"
                    title={btn.label}
                    onClick={() => onFormat(btn.action!)}
                    type="button"
                  >
                    {btn.icon}
                  </button>
                );
              })}
            </div>
            {gi < GROUPS.length - 1 && <div className="format-sep" />}
          </React.Fragment>
        ))}
      </div>

      {/* Preview toggle — far right */}
      <button
        className={`format-btn preview-toggle-btn ${showPreview ? 'active' : ''}`}
        title={showPreview ? 'Hide Preview' : 'Show Preview'}
        onClick={onTogglePreview}
        type="button"
      >
        {showPreview ? <EyeOff size={15} /> : <Eye size={15} />}
        <span className="preview-toggle-label">{showPreview ? 'Hide Preview' : 'Preview'}</span>
      </button>
    </div>
  );
}
