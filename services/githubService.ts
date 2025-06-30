import { UploadedFile } from '../types';

const GITHUB_API_BASE = 'https://api.github.com';

const commonHeaders = (token: string) => ({
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
});

// Helper to decode base64 content
const decodeBase64 = (encoded: string): string => {
    try {
        const binaryString = atob(encoded);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return new TextDecoder().decode(bytes);
    } catch (e) {
        console.error("Failed to decode base64 string", e);
        // Fallback for non-UTF8 content might be needed, but for code this is usually sufficient
        try {
          return atob(encoded);
        } catch {
          return "";
        }
    }
}

// Function to get repository details, including default branch
async function getRepoDetails(owner: string, repo: string, token: string) {
    const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
        headers: commonHeaders(token),
    });
    if (!response.ok) {
        if (response.status === 404) throw new Error(`Repository not found.`);
        if (response.status === 401) throw new Error(`Invalid authentication token.`);
        const errorData = await response.json();
        throw new Error(`Failed to fetch repo details: ${errorData.message || response.statusText}`);
    }
    return response.json();
}

export async function fetchUserRepos(token: string, owner: string): Promise<{ name: string }[]> {
    let reposUrl = `${GITHUB_API_BASE}/users/${owner}/repos?sort=updated&per_page=100`;
    let response = await fetch(reposUrl, { headers: commonHeaders(token) });

    if (response.status === 404) {
        // If user is not found, it could be an organization
        reposUrl = `${GITHUB_API_BASE}/orgs/${owner}/repos?sort=updated&per_page=100`;
        response = await fetch(reposUrl, { headers: commonHeaders(token) });
    }

    if (!response.ok) {
        if (response.status === 401) throw new Error(`Invalid authentication token.`);
        const errorData = await response.json();
        throw new Error(`Failed to fetch repositories for '${owner}': ${errorData.message || response.statusText}`);
    }

    const data = await response.json();
    return data.map((repo: any) => ({ name: repo.name }));
}


export async function fetchRepoContents(token: string, owner: string, repo: string): Promise<UploadedFile[]> {
    const repoDetails = await getRepoDetails(owner, repo, token);
    const defaultBranch = repoDetails.default_branch;

    const branchResponse = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/branches/${defaultBranch}`, {
        headers: commonHeaders(token),
    });
    if (!branchResponse.ok) throw new Error(`Failed to fetch branch details: ${branchResponse.statusText}`);
    const branchData = await branchResponse.json();
    const lastCommitSha = branchData.commit.sha;

    const treeResponse = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${lastCommitSha}?recursive=1`, {
        headers: commonHeaders(token),
    });
    if (!treeResponse.ok) throw new Error(`Failed to fetch file tree: ${treeResponse.statusText}`);
    const treeData = await treeResponse.json();

    if (treeData.truncated) {
        throw new Error("Repository is too large and the file tree was truncated. This feature is not supported for very large repositories yet.");
    }
    
    const filePromises = treeData.tree
        .filter((item: any) => item.type === 'blob' && item.size > 0) // filter out empty files and folders
        .map(async (file: any) => {
            const blobResponse = await fetch(file.url, { headers: commonHeaders(token) });
            if (!blobResponse.ok) {
                console.warn(`Could not fetch blob for ${file.path}`);
                return null;
            }
            const blobData = await blobResponse.json();

            // A simple check for text vs binary based on common image/font extensions
            const isBinary = /\.(png|jpg|jpeg|gif|webp|ico|woff|woff2|eot|ttf)$/i.test(file.path);
            
            let content: string;
            let type: string;

            if (isBinary) {
                 // For binary files, create a data URL
                 const ext = file.path.split('.').pop()?.toLowerCase();
                 const mimeType = ext === 'png' ? 'image/png'
                                : (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg'
                                : ext === 'gif' ? 'image/gif'
                                : ext === 'webp' ? 'image/webp'
                                : 'application/octet-stream';
                 content = `data:${mimeType};base64,${blobData.content}`;
                 type = mimeType;
            } else {
                 content = decodeBase64(blobData.content);
                 // Crude mime-type detection based on extension for text files
                 const ext = file.path.split('.').pop()?.toLowerCase();
                 type = ext === 'js' || ext === 'jsx' ? 'application/javascript'
                      : ext === 'ts' || ext === 'tsx' ? 'application/typescript'
                      : ext === 'html' ? 'text/html'
                      : ext === 'css' ? 'text/css'
                      : ext === 'json' ? 'application/json'
                      : ext === 'svg' ? 'image/svg+xml'
                      : 'text/plain';
            }

            return {
                name: file.path,
                content,
                type,
            } as UploadedFile;
        });

    const results = await Promise.all(filePromises);
    return results.filter((file): file is UploadedFile => file !== null);
}

export async function commitChangesToRepo(
    token: string,
    owner: string,
    repo: string,
    modifiedFiles: UploadedFile[],
    commitMessage: string
): Promise<string> {
    const repoDetails = await getRepoDetails(owner, repo, token);
    const defaultBranch = repoDetails.default_branch;
    
    // 1. Get latest commit SHA to use as parent
    const branchResponse = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs/heads/${defaultBranch}`, {
        headers: commonHeaders(token),
    });
    if (!branchResponse.ok) throw new Error(`Failed to get ref for branch ${defaultBranch}`);
    const refData = await branchResponse.json();
    const parentCommitSha = refData.object.sha;

    // 2. Create blobs for all files that will be in the new commit
    const treeItems = await Promise.all(modifiedFiles.map(async file => {
        let content: string;
        let encoding: 'utf-8' | 'base64' = 'utf-8';

        if (file.type.startsWith('image/') && file.content.startsWith('data:')) {
            content = file.content.split(',')[1];
            encoding = 'base64';
        } else {
            content = file.content;
        }
        
        const blobResponse = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/blobs`, {
            method: 'POST',
            headers: { ...commonHeaders(token), 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, encoding }),
        });
        if (!blobResponse.ok) throw new Error(`Failed to create blob for ${file.name}: ${await blobResponse.text()}`);
        const blobData = await blobResponse.json();

        return {
            path: file.name,
            mode: '100644', // file
            type: 'blob',
            sha: blobData.sha,
        };
    }));

    // 3. Create a new tree object with the complete file list
    const treeResponse = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees`, {
        method: 'POST',
        headers: { ...commonHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ tree: treeItems }),
    });
    if (!treeResponse.ok) throw new Error(`Failed to create tree: ${await treeResponse.text()}`);
    const newTreeData = await treeResponse.json();

    // 4. Create a new commit
    const commitResponse = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/commits`, {
        method: 'POST',
        headers: { ...commonHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: commitMessage,
            tree: newTreeData.sha,
            parents: [parentCommitSha],
        }),
    });
    if (!commitResponse.ok) throw new Error(`Failed to create commit: ${await commitResponse.text()}`);
    const newCommitData = await commitResponse.json();

    // 5. Update the branch reference
    const updateRefResponse = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs/heads/${defaultBranch}`, {
        method: 'PATCH',
        headers: { ...commonHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ sha: newCommitData.sha }),
    });
    if (!updateRefResponse.ok) {
         throw new Error(`Failed to update branch ref: ${await updateRefResponse.text()}`);
    }
    
    return newCommitData.html_url; // Return URL of the new commit
}