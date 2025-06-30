import { ModificationPlan, UploadedFile } from '../types';

function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const applyChanges = (
    originalFiles: UploadedFile[], 
    plan: ModificationPlan
): { finalFiles: UploadedFile[] } => {
    
    const finalFilesMap = new Map<string, { content: string, type: string }>();
    originalFiles.forEach(file => {
        finalFilesMap.set(file.name, { content: file.content, type: file.type });
    });
    
    // 1. Handle file deletions first
    if (plan.deleteFiles) {
        for (const fileNameToDelete of plan.deleteFiles) {
            finalFilesMap.delete(fileNameToDelete);
        }
    }

    // 2. Handle in-file modifications and content deletions
    const operations = [...(plan.delete ?? []), ...(plan.modify ?? [])];

    for (const op of operations) {
        const fileData = finalFilesMap.get(op.fileName);
        if (!fileData) {
            console.warn(`File "${op.fileName}" not found for modification (it might have been deleted in the same plan).`);
            continue;
        }
        let currentCode = fileData.content;

        const isModification = 'newCode' in op;
        const opAsMod = op as any; // Modification type
        
        if (!fileData.type.startsWith('image/')) {
            const fullContextString = op.before + op.codeToDelete + op.after;
            const replacementString = isModification 
                ? op.before + opAsMod.newCode + op.after 
                : op.before + op.after;
            
            if (currentCode.includes(fullContextString)) {
                currentCode = currentCode.replace(fullContextString, replacementString);
            } else {
                 const occurrences = op.codeToDelete ? (currentCode.match(new RegExp(escapeRegExp(op.codeToDelete), 'g')) || []).length : 0;
                 if (op.codeToDelete && occurrences === 1) {
                    console.warn(`Context mismatch for operation in "${op.fileName}". Falling back to direct, unambiguous replacement.`);
                    const directReplacement = isModification ? opAsMod.newCode : '';
                    currentCode = currentCode.replace(op.codeToDelete, directReplacement);
                 } else {
                    console.error(`Could not apply operation in file "${op.fileName}". Context not found, and direct replacement is ambiguous (found ${occurrences} times) or codeToDelete is empty. Skipping this change.`);
                    console.error('Failed operation details:', op);
                 }
            }
        } else if (isModification) {
            currentCode = opAsMod.newCode;
        }

        finalFilesMap.set(op.fileName, { ...fileData, content: currentCode });
    }
    
    // 3. Handle new files
    if (plan.newFiles) {
        for (const newFile of plan.newFiles) {
            if (finalFilesMap.has(newFile.fileName)) {
                console.warn(`File "${newFile.fileName}" already exists. Overwriting with new content.`);
            }
            const type = newFile.fileName.endsWith('.js') ? 'application/javascript'
                       : newFile.fileName.endsWith('.css') ? 'text/css'
                       : newFile.fileName.endsWith('.html') ? 'text/html'
                       : 'text/plain';
            finalFilesMap.set(newFile.fileName, { content: newFile.code, type });
        }
    }

    const finalFiles: UploadedFile[] = Array.from(finalFilesMap.entries()).map(([name, data]) => ({
        name,
        content: data.content,
        type: data.type
    }));

    return { finalFiles };
};
