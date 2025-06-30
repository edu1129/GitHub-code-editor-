import { UploadedFile } from '../types';

export interface TreeNode {
  name: string;
  path: string;
  children?: { [key: string]: TreeNode };
  file?: UploadedFile; // Only for file nodes
}

export interface FileTree {
  [key: string]: TreeNode;
}

export const buildFileTree = (files: UploadedFile[]): FileTree => {
  const tree: FileTree = {};

  const sortedFiles = [...files].sort((a, b) => a.name.localeCompare(b.name));

  sortedFiles.forEach(file => {
    const parts = file.name.split('/');
    let currentLevel = tree;
    let currentPath = '';

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = index === parts.length - 1;

      if (!currentLevel[part]) {
        currentLevel[part] = {
          name: part,
          path: currentPath,
          ...(isFile ? { file } : { children: {} }),
        };
      }
      if (!isFile) {
        currentLevel = currentLevel[part].children!;
      }
    });
  });

  return tree;
};