import React, { useRef, useLayoutEffect } from 'react';
import hljs from 'highlight.js';

/**
 * Generates an HTML string with syntax highlighting from highlight.js,
 * and also applies diff highlights for additions/deletions.
 * @param code The code string to highlight.
 * @param highlights An array of strings to mark as diffs.
 * @param color The color to use for the diff highlight.
 * @returns An HTML string.
 */
const getHighlightedHTML = (code: string, highlights: string[] = [], color: 'green' | 'red' = 'green'): string => {
  if (!code) return '';

  const highlightClass = color === 'green'
    ? "bg-green-500/10"
    : "bg-red-500/10 line-through";

  // If there are no diffs, highlight the entire block of code at once for better accuracy.
  if (!highlights || highlights.length === 0) {
    return hljs.highlightAuto(code).value;
  }
  
  const escapedHighlights = highlights.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const validHighlights = escapedHighlights.filter(h => h.length > 0);

  if (validHighlights.length === 0) {
    return hljs.highlightAuto(code).value;
  }
  
  const regex = new RegExp(`(${validHighlights.join('|')})`, 'g');
  const parts = code.split(regex);

  // Process each part: apply diff styles to highlighted parts, and syntax highlight the rest.
  return parts.map(part => {
    if (highlights.includes(part)) {
      // For a diff part, wrap it in our custom highlight class.
      // We don't run syntax highlighting on it to make the diff stand out clearly.
      const escapedPart = part.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `<span class="${highlightClass}">${escapedPart}</span>`;
    }
    // For non-diff parts, apply syntax highlighting.
    return hljs.highlightAuto(part).value;
  }).join('');
};


interface CodeEditorProps {
  value: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  readOnly?: boolean;
  placeholder?: string;
  highlights?: string[];
  highlightColor?: 'green' | 'red';
  showLineNumbers?: boolean;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ value, onChange, readOnly = false, placeholder, highlights, highlightColor = 'green', showLineNumbers = true }) => {
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Use layout effect to prevent flicker when updating the highlighted code.
  useLayoutEffect(() => {
    if (editorRef.current) {
        editorRef.current.innerHTML = getHighlightedHTML(value, highlights, highlightColor);
    }
  }, [value, highlights, highlightColor]);

  const lines = value ? value.split('\n') : [''];

  const syncScroll = (target: HTMLElement) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = target.scrollTop;
    }
    // For editable view, sync textarea scroll with the highlighter div.
    if (!readOnly && editorRef.current?.parentElement) {
      editorRef.current.parentElement.scrollTop = target.scrollTop;
      editorRef.current.parentElement.scrollLeft = target.scrollLeft;
    }
  };

  return (
    <div className="flex flex-grow h-full overflow-hidden font-mono text-sm bg-bunker-900 leading-relaxed">
      {showLineNumbers && (
        <div 
          ref={lineNumbersRef}
          className="text-right text-bunker-500 bg-bunker-800/50 p-4 select-none overflow-y-hidden shrink-0"
          style={{ width: '4rem' }}
          aria-hidden="true"
        >
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
      )}
      
      <div className="relative flex-grow h-full">
        <pre 
            onScroll={(e) => readOnly && syncScroll(e.currentTarget)}
            className={`w-full h-full p-4 overflow-auto m-0 ${readOnly ? '' : 'absolute inset-0 pointer-events-none'}`}
          >
            <code 
                ref={editorRef}
                className={`hljs whitespace-pre-wrap break-words ${!showLineNumbers ? 'pl-4' : ''}`}
            />
        </pre>
        {!readOnly && (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            onScroll={(e) => syncScroll(e.currentTarget)}
            className={`transparent-caret-textarea w-full h-full p-4 bg-transparent text-transparent resize-none focus:outline-none absolute inset-0 m-0 overflow-auto whitespace-pre-wrap break-words ${!showLineNumbers ? 'pl-4' : ''}`}
            spellCheck="false"
          />
        )}
      </div>
    </div>
  );
};

export default CodeEditor;
