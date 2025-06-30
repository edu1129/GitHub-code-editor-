import React from 'react';
import { LoaderIcon } from './Icons';

interface StreamingJsonModalProps {
  isOpen: boolean;
  content: string;
}

const StreamingJsonModal: React.FC<StreamingJsonModalProps> = ({ isOpen, content }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 transition-opacity duration-300">
      <div 
        className="bg-bunker-900 w-full max-w-2xl max-h-[80vh] rounded-lg shadow-xl flex flex-col overflow-hidden border border-bunker-700 animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: 'fade-in-up 0.3s ease-out forwards',
        }}
      >
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-bunker-700">
          <h2 className="text-lg font-semibold text-sky-400 flex items-center gap-3">
            <LoaderIcon className="animate-spin" />
            Generating Modification Plan...
          </h2>
        </div>
        <div className="flex-grow p-4 overflow-auto bg-bunker-950/50">
          <pre className="font-mono text-sm text-bunker-200 whitespace-pre-wrap break-words">
            <code>
              {content}
              <span className="inline-block w-2 h-4 bg-sky-400 animate-pulse ml-1" />
            </code>
          </pre>
        </div>
      </div>
      <style>
        {`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.3s ease-out forwards;
        }
        `}
      </style>
    </div>
  );
};

export default StreamingJsonModal;
