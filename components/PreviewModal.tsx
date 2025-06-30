import React from 'react';

interface PreviewModalProps {
  code: string;
  onClose: () => void;
}

const PreviewModal: React.FC<PreviewModalProps> = ({ code, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-bunker-900 w-full h-full rounded-lg shadow-xl flex flex-col overflow-hidden border border-bunker-700" onClick={(e) => e.stopPropagation()}>
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-bunker-700">
          <h2 className="text-lg font-semibold text-sky-400">Live Preview</h2>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-bunker-900"
          >
            Close
          </button>
        </div>
        <div className="flex-grow w-full h-full bg-white">
          <iframe
            srcDoc={code}
            title="Live Preview"
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      </div>
    </div>
  );
};

export default PreviewModal;