import React, { useState, useMemo, useEffect } from 'react';
import { ModificationPlan, UploadedFile } from '../types';
import CodeEditor from './CodeEditor';
import { FileCodeIcon, FileImageIcon, FileTextIcon, PencilIcon, Trash2Icon, LightbulbIcon } from './Icons';

interface ModifiedResult {
  modifiedFiles: UploadedFile[];
  plan: ModificationPlan;
  notes?: string;
}

interface ChangesViewProps {
  originalFiles: UploadedFile[];
  modifiedResult: ModifiedResult | null;
}

const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <FileImageIcon/>;
    if (fileType.includes('javascript') || fileType.includes('typescript')) return <FileCodeIcon />;
    if (fileType === 'text/html' || fileType === 'text/css') return <FileCodeIcon />;
    return <FileTextIcon />;
}

const ChangesView: React.FC<ChangesViewProps> = ({ originalFiles, modifiedResult }) => {
  const [activeChangeFile, setActiveChangeFile] = useState<string | null>(null);

  const changes = useMemo(() => {
    if (!modifiedResult) return null;
    const { modifiedFiles, plan } = modifiedResult;

    const originalMap = new Map(originalFiles.map(f => [f.name, f]));
    const modifiedMap = new Map(modifiedFiles.map(f => [f.name, f]));

    const created = plan.newFiles?.map(f => modifiedMap.get(f.fileName)!) ?? [];
    
    const deleted = plan.deleteFiles?.map(fName => originalMap.get(fName)!).filter(Boolean) ?? [];

    const modified = (plan.modify ?? [])
        .map(mod => mod.fileName)
        .filter((value, index, self) => self.indexOf(value) === index) // unique file names
        .map(fName => ({
            original: originalMap.get(fName)!,
            modified: modifiedMap.get(fName)!
        }))
        .filter(item => item.original && item.modified);

    return { created, deleted, modified };
  }, [originalFiles, modifiedResult]);

  useEffect(() => {
      if (changes) {
          const firstChange = changes.modified[0]?.modified || changes.created[0] || changes.deleted[0];
          setActiveChangeFile(firstChange?.name ?? null);
      } else {
          setActiveChangeFile(null);
      }
  }, [changes]);
  
  if (!modifiedResult || !changes) {
    return (
        <div className="flex flex-col h-full bg-bunker-900 rounded-lg border border-bunker-700 overflow-hidden shadow-lg">
            <header className="flex items-center justify-between bg-bunker-800/50 px-4 py-2 border-b border-bunker-700 flex-shrink-0">
                <h2 className="text-sm font-medium text-bunker-300">Changes Overview</h2>
            </header>
            <div className="w-full flex-grow p-4 overflow-auto font-mono text-sm text-bunker-500 flex items-center justify-center text-center">
                <span>Code modifications will appear here once generated.</span>
            </div>
        </div>
    );
  }

  const activeFileChange = 
      changes.created.find(f => f.name === activeChangeFile) ||
      changes.modified.find(m => m.modified.name === activeChangeFile) ||
      changes.deleted.find(f => f.name === activeChangeFile);

  const getHighlights = (fileName: string, type: 'add' | 'del') => {
      if (!modifiedResult.plan) return [];
      if (type === 'add') {
          return modifiedResult.plan.modify?.filter(m => m.fileName === fileName).map(m => m.newCode) ?? [];
      }
      return modifiedResult.plan.delete?.filter(d => d.fileName === fileName).map(d => d.codeToDelete) ?? [];
  }

  const renderActiveChange = () => {
    if (!activeChangeFile || !activeFileChange) {
        return <div className="w-full h-full flex items-center justify-center text-bunker-500">Select a file to see the changes.</div>
    }
    
    const isCreated = changes.created.some(f => f.name === activeChangeFile);
    const isDeleted = changes.deleted.some(f => f.name === activeChangeFile);
    const isModified = changes.modified.some(m => m.modified.name === activeChangeFile);
    
    const fileData = (activeFileChange as any).modified || (activeFileChange as any).original || activeFileChange;
    const isImage = fileData.type.startsWith('image/');
    
    if (isImage) {
        return (
            <div className="p-4 flex-grow overflow-auto bg-bunker-950/50 flex items-center justify-center h-full">
                <img src={fileData.content} alt={fileData.name} className="max-w-full max-h-full object-contain rounded-md" />
            </div>
        );
    }
    
    if (isCreated) {
        return <CodeEditor value={fileData.content} readOnly={true} showLineNumbers={true} />;
    }
    
    if (isDeleted) {
        return <CodeEditor value={fileData.content} readOnly={true} showLineNumbers={true} highlightColor="red" highlights={[fileData.content]} />;
    }
    
    if (isModified) {
        const modInfo = activeFileChange as { original: UploadedFile, modified: UploadedFile };
        return <CodeEditor value={modInfo.modified.content} readOnly={true} showLineNumbers={true} highlightColor="green" highlights={getHighlights(modInfo.modified.name, 'add')} />;
    }
    
    return null;
  };

  const ChangeCategory = ({ title, files, color, icon, onFileClick, activeFileName }: any) => {
    if (!files || files.length === 0) return null;
    return (
        <div>
            <h3 className={`text-xs font-bold uppercase text-${color}-400 px-2 pt-2 pb-1 flex items-center gap-1.5`}>{icon}{title} ({files.length})</h3>
            <ul>
                {files.map((file: any) => (
                    <li key={file.name} 
                        className={`flex items-center gap-2 p-2 rounded-md cursor-pointer text-sm ${activeFileName === file.name ? `bg-${color}-500/20 text-${color}-300` : `hover:bg-bunker-700/50 text-bunker-300`}`}
                        onClick={() => onFileClick(file.name)}
                    >
                        <span className={`text-${color}-400`}>{getFileIcon(file.type)}</span>
                        <span className="truncate">{file.name}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-bunker-900 rounded-lg border border-bunker-700 overflow-hidden shadow-lg">
      <header className="flex items-center justify-between bg-bunker-800/50 px-4 py-2 border-b border-bunker-700 flex-shrink-0">
        <h2 className="text-sm font-medium text-bunker-300">Changes Overview</h2>
      </header>

      <div className="flex flex-grow min-h-0">
        <aside className="w-1/3 max-w-xs bg-bunker-800/20 border-r border-bunker-700 p-2 overflow-y-auto space-y-3">
            <ChangeCategory 
                title="Created"
                files={changes.created}
                color="yellow"
                icon={<LightbulbIcon className="w-4 h-4" />}
                onFileClick={setActiveChangeFile}
                activeFileName={activeChangeFile}
            />
            <ChangeCategory 
                title="Modified"
                files={changes.modified.map(m => m.modified)}
                color="green"
                icon={<PencilIcon className="w-4 h-4" />}
                onFileClick={setActiveChangeFile}
                activeFileName={activeChangeFile}
            />
            <ChangeCategory 
                title="Deleted"
                files={changes.deleted}
                color="red"
                icon={<Trash2Icon className="w-4 h-4" />}
                onFileClick={setActiveChangeFile}
                activeFileName={activeChangeFile}
            />
        </aside>
        
        <main className="flex-grow w-2/3 bg-bunker-900">
          {renderActiveChange()}
        </main>
      </div>
    </div>
  );
};

export default ChangesView;
