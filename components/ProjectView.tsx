import React, { useRef } from 'react';
import JSZip from 'jszip';
import IconButton from './IconButton';
import { UploadIcon, Trash2Icon, WandIcon } from './Icons';
import CodeEditor from './CodeEditor';
import { UploadedFile } from '../types';
import { FileTree } from './FileTree';

interface ProjectViewProps {
  files: UploadedFile[];
  selectedFileNames: string[];
  activeFileName: string | null;
  onFilesUpdate: (files: UploadedFile[]) => void;
  onSelectedFileNamesUpdate: (names: string[]) => void;
  onActiveFileNameUpdate: (name: string | null) => void;
  onFileContentChange: (fileName: string, newContent: string) => void;
  isModified?: boolean;
  isGithubConnected?: boolean;
}

const ProjectView: React.FC<ProjectViewProps> = ({
  files, selectedFileNames, activeFileName,
  onFilesUpdate, onSelectedFileNamesUpdate, onActiveFileNameUpdate, onFileContentChange,
  isModified = false,
  isGithubConnected = false
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files;
    if (!uploadedFiles) return;

    let newFiles: UploadedFile[] = [];
    const supportedTextExtensions = ['.txt', '.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.json', '.md', '.svg'];
    const supportedImageTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

    const processFile = async (file: File): Promise<UploadedFile | null> => {
        const isText = supportedTextExtensions.some(ext => file.name.toLowerCase().endsWith(ext)) || file.type.startsWith('text/');
        const isImage = supportedImageTypes.includes(file.type);
        
        if (isText) {
            return new Promise<UploadedFile>(resolve => {
                const reader = new FileReader();
                reader.onload = (e) => resolve({ name: file.name, content: e.target?.result as string, type: file.type || 'text/plain' });
                reader.readAsText(file);
            });
        } else if (isImage) {
            return new Promise<UploadedFile>(resolve => {
                const reader = new FileReader();
                reader.onload = (e) => resolve({ name: file.name, content: e.target?.result as string, type: file.type });
                reader.readAsDataURL(file);
            });
        }
        console.warn(`File type not supported, skipping: ${file.name}`);
        return null;
    }

    for (const file of Array.from(uploadedFiles)) {
        if (file.name.toLowerCase().endsWith('.zip')) {
            try {
                const zip = await JSZip.loadAsync(file);
                const filePromises: Promise<UploadedFile | null>[] = [];
                zip.forEach((relativePath, zipEntry) => {
                   if (!zipEntry.dir) {
                       const promise = zipEntry.async('blob').then(blob => {
                           const extractedFile = new File([blob], zipEntry.name, { type: blob.type });
                           return processFile(extractedFile);
                       });
                       filePromises.push(promise);
                   }
                });
                const processedFiles = await Promise.all(filePromises);
                newFiles.push(...processedFiles.filter((f): f is UploadedFile => f !== null));
            } catch (e) {
                console.error("Error processing zip file:", e);
                alert("Could not read the zip file. It may be corrupted or in an unsupported format.");
            }
        } else {
            const processedFile = await processFile(file);
            if(processedFile) newFiles.push(processedFile);
        }
    }
    
    if (newFiles.length > 0) {
        // Prevent duplicates
        const existingFileNames = new Set(files.map(f => f.name));
        const uniqueNewFiles = newFiles.filter(f => !existingFileNames.has(f.name));
        onFilesUpdate([...files, ...uniqueNewFiles]);
    }

    event.target.value = ''; // Reset file input
  };
  
  const handleClearFile = (fileName: string) => {
    if(window.confirm(`Are you sure you want to remove ${fileName}?`)) {
        onFilesUpdate(files.filter(f => f.name !== fileName));
        onSelectedFileNamesUpdate(selectedFileNames.filter(n => n !== fileName));
        if (activeFileName === fileName) {
            onActiveFileNameUpdate(files.length > 1 ? files.filter(f => f.name !== fileName)[0]?.name ?? null : null);
        }
    }
  };

  const handleClearAllFiles = () => {
    if(window.confirm(`Are you sure you want to remove all files?`)) {
        onFilesUpdate([]);
        onSelectedFileNamesUpdate([]);
        onActiveFileNameUpdate(null);
    }
  };

  const handleCodeEdit = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (activeFile && !isModified) {
          onFileContentChange(activeFile.name, e.target.value);
      }
  };

  const handleSelectAll = () => {
    if (files.length === 0) return;
    if (selectedFileNames.length === files.length) {
      onSelectedFileNamesUpdate([]);
    } else {
      onSelectedFileNamesUpdate(files.map(f => f.name));
    }
  };

  const activeFile = files.find(f => f.name === activeFileName);
  const isImage = activeFile?.type.startsWith('image/');

  return (
    <div className="flex flex-col h-full bg-bunker-900 rounded-lg border border-bunker-700 overflow-hidden shadow-lg">
      <header className="flex items-center justify-between bg-bunker-800/50 px-4 py-2 border-b border-bunker-700 flex-shrink-0">
        <label className="text-sm font-medium text-bunker-300">
          Project Files
        </label>
        <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAll}
              disabled={files.length === 0 || isModified}
              className="text-xs px-2 py-1 rounded bg-bunker-700 text-bunker-200 hover:bg-bunker-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {files.length > 0 && selectedFileNames.length === files.length ? 'Deselect All' : 'Select All'}
            </button>
            <input type="file" multiple ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".js,.jsx,.ts,.tsx,.html,.css,.json,.md,.txt,.svg,.png,.jpg,.jpeg,.webp,.gif,.zip" />
            <IconButton onClick={() => fileInputRef.current?.click()} ariaLabel="Upload files or zip archive" disabled={isModified || isGithubConnected}>
                <UploadIcon />
            </IconButton>
            <IconButton onClick={handleClearAllFiles} ariaLabel="Clear all files" disabled={files.length === 0 || isModified || isGithubConnected}>
                <Trash2Icon />
            </IconButton>
        </div>
      </header>

      <div className="flex flex-grow min-h-0">
        <aside className="w-1/3 max-w-xs bg-bunker-800/20 border-r border-bunker-700 p-2 overflow-y-auto">
           {files.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-full text-center text-bunker-500 p-4">
                  <WandIcon className="w-10 h-10 mb-4"/>
                  <h3 className="font-semibold text-bunker-300">Start a Project</h3>
                  <p className="text-xs mt-1">Upload files to begin modifying, or write instructions below to generate new code from scratch.</p>
               </div>
           ) : (
                <FileTree 
                    files={files}
                    activeFileName={activeFileName}
                    selectedFileNames={selectedFileNames}
                    isModified={isModified}
                    isGithubConnected={isGithubConnected}
                    onFileClick={onActiveFileNameUpdate}
                    onFileToggle={onSelectedFileNamesUpdate}
                    onFileDelete={handleClearFile}
                />
           )}
        </aside>

        <main className="flex-grow w-2/3 bg-bunker-900">
           {activeFile ? (
                isImage ? (
                    <div className="p-4 flex-grow overflow-auto bg-bunker-950/50 flex items-center justify-center h-full">
                       <img src={activeFile.content} alt={activeFile.name} className="max-w-full max-h-full object-contain rounded-md" />
                    </div>
                ) : (
                    <CodeEditor
                        value={activeFile.content}
                        readOnly={isModified || isGithubConnected}
                        onChange={handleCodeEdit}
                        showLineNumbers={true}
                    />
                )
           ) : (
            <div className="w-full flex-grow p-4 overflow-auto font-mono text-sm text-bunker-500 flex items-center justify-center text-center">
                <span>{files.length > 0 ? 'Select a file to view its content.' : 'Connect to GitHub or upload files to get started.'}</span>
            </div>
           )}
        </main>
      </div>
    </div>
  );
};

export default ProjectView;
