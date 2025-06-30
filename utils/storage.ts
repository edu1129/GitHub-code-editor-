import { SavedVersion, UploadedFile } from '../types';

const VERSION_COUNT_KEY = 'ai_code_modifier_version_count';
const VERSION_PREFIX = 'ai_code_modifier_version_';

/**
 * Saves a version of the project files to localStorage.
 * @param files The array of UploadedFile objects to save.
 * @returns The new version number, or -1 on failure.
 */
export const saveCodeVersion = (files: UploadedFile[]): number => {
  if (typeof localStorage === 'undefined') {
    console.warn('localStorage is not available. Cannot save code version.');
    return -1;
  }
  try {
    const currentVersionCountStr = localStorage.getItem(VERSION_COUNT_KEY);
    const currentVersionCount = currentVersionCountStr ? parseInt(currentVersionCountStr, 10) : 0;
    const newVersion = currentVersionCount + 1;

    localStorage.setItem(`${VERSION_PREFIX}${newVersion}`, JSON.stringify(files));
    localStorage.setItem(VERSION_COUNT_KEY, newVersion.toString());

    console.log(`Saved project state as version ${newVersion}`);
    return newVersion;
  } catch (error) {
    console.error("Failed to save code version to local storage:", error);
    return -1;
  }
};

/**
 * Retrieves all saved project versions from localStorage.
 * @returns An array of SavedVersion objects, sorted by version number.
 */
export const getSavedVersions = (): SavedVersion[] => {
    if (typeof localStorage === 'undefined') {
        return [];
    }
    try {
        const versions: SavedVersion[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(VERSION_PREFIX)) {
                const versionNumber = parseInt(key.replace(VERSION_PREFIX, ''), 10);
                const filesStr = localStorage.getItem(key);
                if (!isNaN(versionNumber) && filesStr) {
                    try {
                        const files = JSON.parse(filesStr);
                        versions.push({ versionNumber, files });
                    } catch (e) {
                        console.error(`Could not parse files for version ${versionNumber}:`, e);
                    }
                }
            }
        }
        return versions.sort((a, b) => a.versionNumber - b.versionNumber);
    } catch (error) {
        console.error("Failed to retrieve code versions from local storage:", error);
        return [];
    }
};

/**
 * Clears all saved versions and the version counter from localStorage.
 */
export const clearAllVersions = (): void => {
    if (typeof localStorage === 'undefined') {
        return;
    }
    try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith(VERSION_PREFIX) || key === VERSION_COUNT_KEY)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log("Cleared all saved code versions.");
    } catch (error) {
        console.error("Failed to clear code versions from local storage:", error);
    }
};
