import React, { useLayoutEffect, useRef } from 'react';
import hljs from 'highlight.js';
import CopyButton from './CopyButton';

interface AiReplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  jsonContent: string;
}

const AiReplyModal: React.FC<AiReplyModalProps> = ({ isOpen, onClose, jsonContent }) => {
  const codeRef = useRef<HTMLElement>(null);

  const getFormattedJson = (jsonString: string): string => {
    if (!jsonString) return '';
    try {
      // First, try to parse it to see if it's an object.
      const parsed = JSON.parse(jsonString);
      // Then, stringify it with indentation.
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      // If parsing fails, return the original string.
      return jsonString;
    }
  };

  const formattedContent = getFormattedJson(jsonContent);

  useLayoutEffect(() => {
    if (isOpen && codeRef.current) {
        if (formattedContent) {
            codeRef.current.innerHTML = hljs.highlight(formattedContent, { language: 'json' }).value;
        } else {
            codeRef.current.innerHTML = '';
        }
    }
  }, [isOpen, formattedContent]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-bunker-900 w-full max-w-3xl max-h-[90vh] rounded-lg shadow-xl flex flex-col overflow-hidden border border-bunker-700"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-bunker-700">
          <h2 className="text-lg font-semibold text-sky-400">AI JSON Response</h2>
          <div className="flex items-center gap-4">
            <CopyButton text={formattedContent} ariaLabel="Copy JSON response" />
            <button
              onClick={onClose}
              className="px-4 py-2 bg-bunker-700 text-white rounded-md hover:bg-bunker-600 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-bunker-900"
            >
              Close
            </button>
          </div>
        </header>
        <div className="flex-grow p-4 overflow-auto bg-bunker-950/50">
          <pre className="font-mono text-sm text-bunker-200 whitespace-pre-wrap break-words m-0">
            <code ref={codeRef} className="hljs language-json"/>
          </pre>
        </div>
      </div>
    </div>
  );
};

export default AiReplyModal;