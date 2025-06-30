import React, { useState } from 'react';
import { buildFileTree, FileTree as FileTreeType, TreeNode } from '../utils/fileTree';
import { UploadedFile } from '../types';
import { ChevronRightIcon, FileCodeIcon, FileImageIcon, FileTextIcon, FileVideoIcon, FolderIcon, FolderOpenIcon, Trash2Icon } from './Icons';
import IconButton from './IconButton';

const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <FileImageIcon className="text-sky-400" />;
    if (fileType.startsWith('video/')) return <FileVideoIcon className="text-purple-400" />;
    if (fileType.includes('javascript') || fileType.includes('typescript')) return <FileCodeIcon className="text-yellow-400" />;
    if (fileType === 'text/html' || fileType === 'text/css') return <FileCodeIcon className="text-orange-400" />;
    return <FileTextIcon className="text-bunker-300" />;
}

interface TreeEntryProps {
  node: TreeNode;
  level: number;
  activeFileName: string | null;
  selectedFileNames: string[];
  isModified: boolean;
  isGithubConnected: boolean;
  onFileClick: (name: string) => void;
  onFileToggle: (names: string[]) => void;
  onFileDelete: (name: string) => void;
}

const TreeEntry: React.FC<TreeEntryProps> = ({ node, level, activeFileName, selectedFileNames, isModified, isGithubConnected, onFileClick, onFileToggle, onFileDelete }) => {
  const isFolder = !!node.children;
  const [isOpen, setIsOpen] = useState(true);

  const handleFileSelectToggle = (fileName: string) => {
    const newSelected = selectedFileNames.includes(fileName)
      ? selectedFileNames.filter(name => name !== fileName)
      : [...selectedFileNames, fileName];
    onFileToggle(newSelected);
  };

  const handleClearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    if(node.file) {
        onFileDelete(node.file.name);
    }
  };


  if (isFolder) {
    return (
      <li className="text-sm">
        <div
          className="flex items-center gap-1.5 p-1.5 rounded-md cursor-pointer hover:bg-bunker-700/50"
          style={{ paddingLeft: `${level * 1.25}rem` }}
          onClick={() => setIsOpen(!isOpen)}
        >
          <ChevronRightIcon className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
          {isOpen ? <FolderOpenIcon className="text-sky-400" /> : <FolderIcon className="text-sky-400" />}
          <span className="truncate">{node.name}</span>
        </div>
        {isOpen && (
          <ul>
            {Object.values(node.children)
              .sort((a,b) => {
                // sort folders before files
                if(a.children && !b.children) return -1;
                if(!a.children && b.children) return 1;
                return a.name.localeCompare(b.name);
              })
              .map(childNode => (
              <TreeEntry
                key={childNode.path}
                node={childNode}
                level={level + 1}
                activeFileName={activeFileName}
                selectedFileNames={selectedFileNames}
                isModified={isModified}
                isGithubConnected={isGithubConnected}
                onFileClick={onFileClick}
                onFileToggle={onFileToggle}
                onFileDelete={onFileDelete}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  // It's a file
  return (
    <li className="text-sm">
       <div
          className={`flex items-center gap-1.5 p-1.5 rounded-md cursor-pointer group ${activeFileName === node.path ? 'bg-sky-800/50 text-sky-200' : 'hover:bg-bunker-700/50'}`}
          style={{ paddingLeft: `${level * 1.25}rem` }}
          onClick={() => onFileClick(node.path)}
        >
            <input 
                type="checkbox" 
                className="form-checkbox h-4 w-4 bg-bunker-900 border-bunker-600 rounded text-sky-500 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                checked={selectedFileNames.includes(node.path)}
                onChange={() => handleFileSelectToggle(node.path)}
                onClick={(e) => e.stopPropagation()}
                disabled={isModified}
            />
            <span className="flex-shrink-0">{getFileIcon(node.file!.type)}</span>
            <span className="truncate flex-grow" title={node.path}>{node.name}</span>
            {!isModified && !isGithubConnected && (
                <IconButton ariaLabel={`Remove ${node.name}`} onClick={handleClearFile} className="ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100">
                    <Trash2Icon className="h-3 w-3"/>
                </IconButton>
            )}
        </div>
    </li>
  );
};

interface FileTreeProps {
  files: UploadedFile[];
  activeFileName: string | null;
  selectedFileNames: string[];
  isModified: boolean;
  isGithubConnected: boolean;
  onFileClick: (name: string) => void;
  onFileToggle: (names: string[]) => void;
  onFileDelete: (name: string) => void;
}

export const FileTree: React.FC<FileTreeProps> = (props) => {
  const tree = buildFileTree(props.files);

  return (
    <ul className="space-y-1">
      {Object.values(tree)
        .sort((a,b) => {
            if(a.children && !b.children) return -1;
            if(!a.children && b.children) return 1;
            return a.name.localeCompare(b.name);
        })
        .map(node => (
        <TreeEntry key={node.path} node={node} level={0} {...props} />
      ))}
    </ul>
  );
};
