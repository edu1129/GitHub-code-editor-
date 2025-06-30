import React, { useState, useCallback, useEffect } from 'react';
import JSZip from 'jszip';
import ActionButton from './components/ActionButton';
import PreviewModal from './components/PreviewModal';
import { getModificationJsonStream } from './services/geminiService';
import { applyChanges } from './utils/codeModifier';
import { ModificationPlan, SavedVersion, UploadedFile, ModelOption } from './types';
import { WandIcon, UndoIcon, DownloadIcon, EyeIcon, CheckIcon, HistoryIcon, LightbulbIcon, PencilIcon, Trash2Icon, CodeIcon, FileZipIcon, GithubIcon } from './components/Icons';
import { saveCodeVersion, getSavedVersions, clearAllVersions } from './utils/storage';
import IconButton from './components/IconButton';
import StreamingJsonModal from './components/StreamingJsonModal';
import AiReplyModal from './components/AiReplyModal';
import ProjectView from './components/ProjectView';
import ChangesView from './components/ChangesView';
import { fetchRepoContents, commitChangesToRepo } from './services/githubService';
import GithubConnect from './components/GithubConnect';

const MAX_HISTORY_LENGTH = 10;

interface ModifiedResult {
  modifiedFiles: UploadedFile[];
  plan: ModificationPlan;
  notes?: string;
}

const App: React.FC = () => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedFileNames, setSelectedFileNames] = useState<string[]>([]);
  const [activeFileName, setActiveFileName] = useState<string | null>(null);
  const [modificationRequest, setModificationRequest] = useState<string>('');
  const [modifiedResult, setModifiedResult] = useState<ModifiedResult | null>(null);
  const [history, setHistory] = useState<UploadedFile[][]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
  const [savedVersions, setSavedVersions] = useState<SavedVersion[]>([]);
  const [isStreamingJson, setIsStreamingJson] = useState<boolean>(false);
  const [streamingJsonContent, setStreamingJsonContent] = useState<string>('');
  const [lastAiResponse, setLastAiResponse] = useState<string | null>(null);
  const [isAiReplyModalOpen, setIsAiReplyModalOpen] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<ModelOption>('flash');

  // GitHub State
  const [githubToken, setGithubToken] = useState<string>('');
  const [githubUsername, setGithubUsername] = useState<string>('');
  const [githubRepo, setGithubRepo] = useState<string>('');
  const [isGithubLoading, setIsGithubLoading] = useState<boolean>(false);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [githubSuccess, setGithubSuccess] = useState<string | null>(null);
  const [isRepoFetched, setIsRepoFetched] = useState<boolean>(false);


  useEffect(() => {
    setSavedVersions(getSavedVersions());
  }, []);

  const refreshVersions = useCallback(() => {
    setSavedVersions(getSavedVersions());
  }, []);

  const resetState = () => {
    setModifiedResult(null);
    setHistory([]);
    setError(null);
    setSuccessMessage(null);
    setLastAiResponse(null);
  }

  const handleFetchFromGithub = async (token: string, username: string, repo: string) => {
    setIsGithubLoading(true);
    setGithubError(null);
    setGithubSuccess(null);
    resetState();
    setFiles([]);
    setActiveFileName(null);
    setSelectedFileNames([]);

    try {
        const fetchedFiles = await fetchRepoContents(token, username, repo);
        setFiles(fetchedFiles);
        setGithubToken(token);
        setGithubUsername(username);
        setGithubRepo(repo);
        setIsRepoFetched(true);
        setGithubSuccess(`Successfully fetched ${repo}! You can now modify the files.`);
        if (fetchedFiles.length > 0) {
          // Sort files to ensure a consistent default file is picked
          const sortedFiles = [...fetchedFiles].sort((a, b) => a.name.localeCompare(b.name));
          setActiveFileName(sortedFiles[0].name);
        }
    } catch (e) {
        console.error("GitHub fetch error:", e);
        const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
        setGithubError(`Fetch failed: ${errorMessage}`);
    } finally {
        setIsGithubLoading(false);
    }
  };
  
  const handleDisconnectFromGithub = () => {
      setGithubToken('');
      setGithubUsername('');
      setGithubRepo('');
      setIsRepoFetched(false);
      setGithubError(null);
      setGithubSuccess(null);
      setFiles([]);
      resetState();
      setActiveFileName(null);
      setSelectedFileNames([]);
  };

  const handleGenerateOrModify = useCallback(async () => {
    if (!modificationRequest) {
      setError('Please provide instructions.');
      return;
    }

    if (files.length > 0 && selectedFileNames.length === 0) {
      setError('Please select at least one file to modify.');
      return;
    }

    setIsLoading(true);
    resetState();
    
    if (files.length > 0) {
        setHistory(prev => [files, ...prev].slice(0, MAX_HISTORY_LENGTH));
    }

    setIsStreamingJson(true);
    setStreamingJsonContent('');
    let fullJson = '';

    try {
        const modelNameMap: Record<ModelOption, string> = {
            flash: 'gemini-2.5-flash-preview-04-17',
            pro: 'gemini-2.5-pro', // NOTE: Using flash for "pro" as a placeholder per guidelines
        };
        const actualModelName = modelNameMap[selectedModel];
        const stream = getModificationJsonStream(files, selectedFileNames, modificationRequest, actualModelName);
        for await (const chunk of stream) {
            fullJson += chunk;
            setStreamingJsonContent(prev => prev + chunk);
        }
        
        setLastAiResponse(fullJson);
        let plan: ModificationPlan = {};
        if (fullJson) {
            try {
                 let jsonStr = fullJson.trim();
                 const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
                 const match = jsonStr.match(fenceRegex);
                 if (match && match[2]) {
                   jsonStr = match[2].trim();
                 }
                 plan = JSON.parse(jsonStr);
            } catch (e) {
                 console.error("Failed to parse streamed JSON:", e);
                 console.error("Raw response:", fullJson);
                 throw new Error("The AI returned an invalid modification plan. Please check the JSON response.");
            }
        }
      
      const hasChanges = plan.delete?.length || plan.modify?.length || plan.newFiles?.length || plan.deleteFiles?.length;
      if (!plan || !hasChanges) {
        setError("AI did not suggest any changes. Try rephrasing your request or using the 'Pro' model for more complex tasks.");
        if(files.length > 0) setHistory(prev => prev.slice(1));
        setLastAiResponse(null);
      } else {
        const { finalFiles } = applyChanges(files, plan);
        setModifiedResult({
            modifiedFiles: finalFiles,
            plan: plan,
            notes: plan.notes 
        });
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'An unknown error occurred during modification.');
      if(files.length > 0) setHistory(prev => prev.slice(1));
    } finally {
      setIsLoading(false);
      setIsStreamingJson(false);
    }
  }, [files, selectedFileNames, modificationRequest, selectedModel]);
  
  const handleApproveClick = useCallback(async () => {
    if (!modifiedResult) return;
    
    if (isRepoFetched) {
        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
            const commitMessage = modifiedResult.notes || 'AI-generated code modifications';
            const commitUrl = await commitChangesToRepo(
                githubToken,
                githubUsername,
                githubRepo,
                modifiedResult.modifiedFiles,
                commitMessage
            );
            setFiles(modifiedResult.modifiedFiles);
            if(activeFileName && !modifiedResult.modifiedFiles.some(f => f.name === activeFileName)) {
              setActiveFileName(null);
            }
            setSelectedFileNames([]);
            resetState();
            setModificationRequest('');
            setSuccessMessage(`Successfully committed to GitHub! View commit: ${commitUrl}`);

        } catch (e) {
            console.error("GitHub commit error:", e);
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            setError(`GitHub Commit Failed: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }

    } else {
        // Original local storage logic
        saveCodeVersion(files);
        refreshVersions();
        setFiles(modifiedResult.modifiedFiles);
        if(activeFileName && !modifiedResult.modifiedFiles.some(f => f.name === activeFileName)) {
          setActiveFileName(null);
        }
        setSelectedFileNames([]);
        resetState();
        setModificationRequest('');
        setSuccessMessage("Changes approved and saved as a new local version.");
    }
  }, [modifiedResult, files, activeFileName, refreshVersions, isRepoFetched, githubToken, githubUsername, githubRepo]);


  const handleUndoClick = useCallback(() => {
    if (history.length > 0) {
      const [previousVersion, ...restOfHistory] = history;
      setFiles(previousVersion);
      setHistory(restOfHistory);
      resetState();
    }
  }, [history]);

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const downloadProjectAsZip = async (projectFiles: UploadedFile[], zipName: string) => {
    const zip = new JSZip();
    projectFiles.forEach(file => {
        if (file.type.startsWith('image/') && file.content.startsWith('data:')) {
            const base64Data = file.content.split(',')[1];
            zip.file(file.name, base64Data, { base64: true });
        } else {
            zip.file(file.name, file.content);
        }
    });
    
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${zipName}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  const handleDownloadProjectClick = async () => {
    if (!modifiedResult) return;
    const projectFiles = modifiedResult.modifiedFiles;
    
    if (projectFiles.length === 1) {
        const file = projectFiles[0];
        downloadFile(file.content, file.name, file.type);
    } else if (projectFiles.length > 1) {
        await downloadProjectAsZip(projectFiles, 'modified-project');
    }
  };

  const handleDownloadVersion = (version: SavedVersion) => {
      downloadProjectAsZip(version.files, `project-v${version.versionNumber}`);
  }

  const handleLoadVersion = (filesToLoad: UploadedFile[]) => {
    setFiles(filesToLoad);
    setActiveFileName(null);
    setSelectedFileNames([]);
    resetState();
  };
  
  const handleFileContentChange = (fileName: string, newContent: string) => {
      setFiles(currentFiles => 
          currentFiles.map(file => 
              file.name === fileName ? { ...file, content: newContent } : file
          )
      );
  };
  
  const handleClearHistory = () => {
      if (window.confirm("Are you sure you want to delete all saved versions? This cannot be undone.")) {
          clearAllVersions();
          refreshVersions();
      }
  };

  const hasModifications = !!modifiedResult;
  const activeFile = files.find(f => f.name === activeFileName) ?? null;

  return (
    <>
      <StreamingJsonModal isOpen={isStreamingJson} content={streamingJsonContent} />
      <AiReplyModal isOpen={isAiReplyModalOpen} onClose={() => setIsAiReplyModalOpen(false)} jsonContent={lastAiResponse ?? ''} />
      {isPreviewing && activeFile && activeFile.type === 'text/html' && (
        <PreviewModal code={activeFile.content} onClose={() => setIsPreviewing(false)} />
      )}
      <div className="flex flex-col h-screen bg-bunker-950 text-bunker-100 font-sans">
        <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-bunker-800">
          <h1 className="text-xl font-bold text-sky-400 flex items-center gap-3">
            <WandIcon /> AI Code Modifier
          </h1>
          <div className="flex items-center gap-3">
             <ActionButton
              onClick={handleUndoClick}
              disabled={isLoading || history.length === 0 || isRepoFetched}
              icon={<UndoIcon />}
              className="bg-bunker-700 hover:bg-bunker-600"
            >
              Undo
            </ActionButton>
            <ActionButton
              onClick={handleApproveClick}
              disabled={isLoading || !hasModifications}
              icon={isRepoFetched ? <GithubIcon/> : <CheckIcon />}
              className={isRepoFetched ? "bg-purple-600 hover:bg-purple-700 disabled:bg-bunker-700" : "bg-emerald-600 hover:bg-emerald-700 disabled:bg-bunker-700"}
            >
              {isRepoFetched ? 'Commit to GitHub' : 'Approve'}
            </ActionButton>
            <ActionButton
              onClick={() => setIsPreviewing(true)}
              disabled={isLoading || !activeFile || activeFile.type !== 'text/html'}
              icon={<EyeIcon />}
              className="bg-teal-600 hover:bg-teal-700"
            >
              Preview Active File
            </ActionButton>
            <ActionButton
              onClick={handleDownloadProjectClick}
              disabled={isLoading || !hasModifications || modifiedResult.modifiedFiles.length === 0}
              icon={<DownloadIcon className="w-5 h-5"/>}
              className="bg-green-600 hover:bg-green-700"
            >
              Download Project
            </ActionButton>
          </div>
        </header>

        <div className="p-4 border-b border-bunker-800">
          <GithubConnect 
            onFetch={handleFetchFromGithub}
            isLoading={isGithubLoading}
            error={githubError}
            success={githubSuccess}
            isFetched={isRepoFetched}
            repoName={isRepoFetched ? `${githubUsername}/${githubRepo}`: ''}
            onDisconnect={handleDisconnectFromGithub}
          />
        </div>
        
        <div className="p-4 flex flex-col flex-grow gap-4 min-h-0">

            {error && (
              <div className="flex-shrink-0 bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-md" role="alert">
                <p><span className="font-bold">Error:</span> {error}</p>
              </div>
            )}
            
            {successMessage && (
               <div className="flex-shrink-0 bg-green-900/50 border border-green-700 text-green-200 px-4 py-3 rounded-md" role="alert">
                 <p className="font-bold">{successMessage}</p>
               </div>
            )}

            {modifiedResult?.notes && (
                <div className="flex-shrink-0 bg-sky-900/50 border border-sky-700 text-sky-200 px-4 py-3 rounded-md flex items-start gap-3" role="status">
                    <LightbulbIcon className="flex-shrink-0 mt-1"/>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold">Notes from AI</h3>
                           {lastAiResponse && (
                             <IconButton ariaLabel="View AI JSON Response" onClick={() => setIsAiReplyModalOpen(true)}>
                                <CodeIcon/>
                             </IconButton>
                           )}
                        </div>
                        <p className="text-sm">{modifiedResult.notes}</p>
                    </div>
                </div>
            )}
            
            {!isRepoFetched && savedVersions.length > 0 && (
                <div className="flex-shrink-0 bg-bunker-900 p-3 rounded-lg border border-bunker-800">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-base font-semibold text-bunker-200 flex items-center gap-2"><HistoryIcon/> Version History</h2>
                        <IconButton onClick={handleClearHistory} ariaLabel="Clear all saved versions">
                            <Trash2Icon />
                        </IconButton>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {savedVersions.map(version => (
                            <div key={version.versionNumber} className="flex items-center gap-1 bg-bunker-800 rounded-full px-3 py-1 text-sm">
                                <span className="font-medium text-bunker-300">V{version.versionNumber}</span>
                                <div className="flex items-center gap-0.5 ml-1 border-l border-bunker-700 pl-1.5">
                                    <IconButton ariaLabel={`Load V${version.versionNumber} into editor`} onClick={() => handleLoadVersion(version.files)}><PencilIcon/></IconButton>
                                    <IconButton ariaLabel={`Download V${version.versionNumber} as a zip file`} onClick={() => handleDownloadVersion(version)}><FileZipIcon/></IconButton>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <main className="flex-grow flex flex-col gap-4 min-h-0">
              <div className="flex-grow grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
                <ProjectView 
                  files={files}
                  selectedFileNames={selectedFileNames}
                  activeFileName={activeFileName}
                  onFilesUpdate={setFiles}
                  onSelectedFileNamesUpdate={setSelectedFileNames}
                  onActiveFileNameUpdate={setActiveFileName}
                  onFileContentChange={handleFileContentChange}
                  isModified={hasModifications}
                  isGithubConnected={isRepoFetched}
                />

                <ChangesView
                    originalFiles={files}
                    modifiedResult={modifiedResult}
                />
              </div>
            </main>
        </div>
        
        <footer className="flex-shrink-0 flex items-center gap-4 p-4 border-t border-bunker-800 bg-bunker-950">
             <div className="flex-grow relative">
                <textarea
                    id="modification-request"
                    value={modificationRequest}
                    onChange={(e) => setModificationRequest(e.target.value)}
                    placeholder={files.length > 0 ? "e.g., 'Refactor the selected files to use arrow functions.'" : "e.g., 'Create a React button component with styling.'" }
                    className="w-full h-16 p-2 pr-12 bg-bunker-900 border border-bunker-700 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-sky-500"
                    rows={2}
                />
                <IconButton 
                    ariaLabel="Clear instructions" 
                    onClick={() => setModificationRequest('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    disabled={!modificationRequest}
                >
                    <Trash2Icon />
                </IconButton>
             </div>
             <div className="flex items-center gap-2">
                <div className="flex flex-col">
                   <label htmlFor="model-selector" className="text-xs text-bunker-400 mb-1">AI Model</label>
                   <select
                      id="model-selector"
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value as ModelOption)}
                      className="bg-bunker-900 border border-bunker-700 rounded-md p-2 h-10 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
                      aria-label="Select AI Model"
                    >
                      <option value="flash">Flash (Fast)</option>
                      <option value="pro">Pro (Advanced)</option>
                    </select>
                </div>
                <ActionButton
                  onClick={handleGenerateOrModify}
                  isLoading={isLoading}
                  disabled={!modificationRequest || isLoading}
                  icon={<WandIcon />}
                  className="h-16 self-end"
                >
                  {isLoading ? 'Thinking...' : (files.length > 0 ? 'Apply Changes' : 'Generate Code')}
                </ActionButton>
             </div>
        </footer>
      </div>
    </>
  );
};

export default App;
