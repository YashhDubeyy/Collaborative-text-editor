import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeHighlight from 'rehype-highlight';
import { X } from 'lucide-react';

interface MarkdownPreviewProps {
  content: string;
  onClose: () => void;
}

export function MarkdownPreview({ content, onClose }: MarkdownPreviewProps) {
  return (
    <div className="markdown-preview-pane">
      <div className="preview-pane-header">
        <span className="preview-pane-title">Preview</span>
        <button className="preview-close-btn" onClick={onClose} title="Close preview">
          <X size={14} />
        </button>
      </div>
      <div className="markdown-preview-body">
        {content.trim() ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkBreaks]}
            rehypePlugins={[rehypeHighlight]}
            components={{
              // Open links in new tab
              a: ({ node, ...props }) => (
                <a {...props} target="_blank" rel="noopener noreferrer" />
              ),
              // Wrap images for responsive display
              img: ({ node, ...props }) => (
                <img
                  {...props}
                  style={{ maxWidth: '100%', borderRadius: '8px', display: 'block', margin: '12px 0' }}
                  alt={props.alt || ''}
                />
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        ) : (
          <div className="preview-empty">
            <p>Start writing markdown in the editor…</p>
            <p className="preview-empty-sub">Tables, code blocks, images and more will render here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
