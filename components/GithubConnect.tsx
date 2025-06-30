import React, { useState, useEffect } from 'react';
import ActionButton from './ActionButton';
import { GithubIcon, LoaderIcon } from './Icons';
import { fetchUserRepos } from '../services/githubService';

interface GithubConnectProps {
  onFetch: (token: string, username: string, repo: string) => void;
  isLoading: boolean;
  error: string | null;
  success: string | null;
  isFetched: boolean;
  repoName: string;
  onDisconnect: () => void;
}

const GithubConnect: React.FC<GithubConnectProps> = ({ onFetch, isLoading, error, success, isFetched, repoName, onDisconnect }) => {
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [repo, setRepo] = useState('');

  const [repoList, setRepoList] = useState<string[]>([]);
  const [isListingRepos, setIsListingRepos] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('github_pat');
    const savedUsername = localStorage.getItem('github_username');
    if (savedToken) setToken(savedToken);
    if (savedUsername) setUsername(savedUsername);
  }, []);

  const handleTokenChange = (value: string) => {
    setToken(value);
    localStorage.setItem('github_pat', value);
  };
  const handleUsernameChange = (value: string) => {
    setUsername(value);
    localStorage.setItem('github_username', value);
  };

  const handleListRepos = async () => {
    setIsListingRepos(true);
    setListError(null);
    setRepoList([]);
    setRepo('');
    try {
        const fetchedRepos = await fetchUserRepos(token, username);
        setRepoList(fetchedRepos.map(r => r.name));
    } catch (e) {
        setListError(e instanceof Error ? e.message : 'An unknown error occurred.');
    } finally {
        setIsListingRepos(false);
    }
  };

  const handleFetchClick = () => {
    if (token && username && repo) {
      onFetch(token, username, repo);
    }
  };

  if (isFetched) {
    return (
      <div className="flex items-center gap-4 bg-bunker-900 p-3 rounded-lg border border-bunker-800">
        <GithubIcon className="text-green-300 w-6 h-6 flex-shrink-0" />
        <div className="flex-grow">
          <p className="font-semibold text-bunker-100">Connected to GitHub Repository</p>
          <p className="text-sm text-bunker-300 font-mono">{repoName}</p>
        </div>
        <ActionButton onClick={onDisconnect} className="bg-red-600 hover:bg-red-700">
          Disconnect
        </ActionButton>
      </div>
    );
  }

  return (
    <div className="bg-bunker-900 p-4 rounded-lg border border-bunker-800">
      <div className="flex items-center gap-3 mb-3">
        <GithubIcon className="w-6 h-6" />
        <h2 className="text-lg font-semibold text-bunker-200">Connect to GitHub Repository</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          type="password"
          value={token}
          onChange={(e) => handleTokenChange(e.target.value)}
          placeholder="GitHub Personal Access Token"
          className="w-full p-2 bg-bunker-800 border border-bunker-700 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
          aria-label="GitHub Personal Access Token"
        />
        <input
          type="text"
          value={username}
          onChange={(e) => handleUsernameChange(e.target.value)}
          placeholder="Username / Org"
          className="w-full p-2 bg-bunker-800 border border-bunker-700 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
          aria-label="GitHub Username or Organization"
        />
        <ActionButton
            onClick={handleListRepos}
            disabled={isListingRepos || !token || !username}
            isLoading={isListingRepos}
          >
            List Repositories
        </ActionButton>
      </div>

      {listError && <p className="text-red-400 mt-2 text-sm">{listError}</p>}
      
      {repoList.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
               <select
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  className="md:col-span-2 w-full p-2 bg-bunker-800 border border-bunker-700 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                  aria-label="Select Repository"
                >
                  <option value="">-- Select a Repository --</option>
                  {repoList.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <ActionButton
                  onClick={handleFetchClick}
                  disabled={isLoading || !repo}
                  isLoading={isLoading}
                  icon={<GithubIcon />}
                >
                  Fetch Repository
              </ActionButton>
          </div>
      )}
      
      <div className="mt-4 flex items-center justify-between">
         <div className="text-xs text-bunker-400">
              Your Personal Access Token is used only for this session and is not stored permanently. It needs 'repo' scope access.
           </div>
        <div className="text-sm h-5 text-right">
           {isLoading && <p className="text-sky-400 flex items-center gap-2"><LoaderIcon /> Fetching repository content...</p>}
           {error && <p className="text-red-400">{error}</p>}
           {success && !isFetched && <p className="text-green-400">{success}</p>}
        </div>
      </div>
    </div>
  );
};

export default GithubConnect;
