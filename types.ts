export interface UploadedFile {
    name: string;
    content: string; // text content or base64 data URL for images
    type: string; // MIME type
}

export interface Deletion {
  fileName: string;
  before: string;
  codeToDelete: string;
  after: string;
}

export interface Modification {
  fileName: string;
  before: string;
  codeToDelete: string;
  newCode: string;
  after: string;
}

export interface ModificationPlan {
  delete?: Deletion[];
  modify?: Modification[];
  newFiles?: Array<{ fileName: string, code: string }>;
  deleteFiles?: string[];
  notes?: string;
}

export interface SavedVersion {
  versionNumber: number;
  files: UploadedFile[];
}

export type ModelOption = 'flash' | 'pro';
