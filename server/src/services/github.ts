/**
 * GitHub Service for fetching repository content
 */

export interface GitHubFile {
  path: string;
  name: string;
  content: string;
  size: number;
  sha: string;
}

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  branch: string;
}

// File extensions we can process as text
const TEXT_EXTENSIONS = new Set([
  '.md', '.txt', '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs',
  '.c', '.cpp', '.h', '.hpp', '.cs', '.rb', '.php', '.swift', '.kt', '.scala',
  '.html', '.css', '.scss', '.sass', '.less', '.json', '.yaml', '.yml', '.toml',
  '.xml', '.sql', '.sh', '.bash', '.zsh', '.ps1', '.r', '.m', '.lua', '.vim',
  '.dockerfile', '.makefile', '.cmake', '.gradle', '.sbt', '.pom',
  '.gitignore', '.env.example', '.editorconfig', 'readme', 'license', 'changelog',
]);

const MAX_FILE_SIZE = 1024 * 1024; // 1MB max file size

/**
 * Parse GitHub URL to extract owner, repo, and optional branch/path
 */
export function parseGitHubUrl(url: string): GitHubRepoInfo & { path?: string } {
  // Handle various GitHub URL formats
  // https://github.com/owner/repo
  // https://github.com/owner/repo/tree/branch
  // https://github.com/owner/repo/tree/branch/path/to/dir

  const urlObj = new URL(url);
  const parts = urlObj.pathname.split('/').filter(Boolean);

  if (parts.length < 2) {
    throw new Error('Invalid GitHub URL: must include owner and repo');
  }

  const owner = parts[0];
  const repo = parts[1];
  let branch = 'main';
  let path: string | undefined;

  if (parts.length > 2 && parts[2] === 'tree') {
    branch = parts[3] || 'main';
    if (parts.length > 4) {
      path = parts.slice(4).join('/');
    }
  }

  return { owner, repo, branch, path };
}

/**
 * Fetch repository tree (list of files)
 */
async function fetchRepoTree(
  owner: string,
  repo: string,
  branch: string,
  token?: string
): Promise<Array<{ path: string; type: string; size: number; sha: string }>> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Knowledge-Base-Importer',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    { headers }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`GitHub API error: ${response.status} - ${error.message || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.tree || [];
}

/**
 * Fetch file content from GitHub
 */
async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  branch: string,
  token?: string
): Promise<string> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3.raw',
    'User-Agent': 'Knowledge-Base-Importer',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${path}`);
  }

  return response.text();
}

/**
 * Check if a file should be processed based on its extension
 */
function shouldProcessFile(path: string, size: number): boolean {
  if (size > MAX_FILE_SIZE) return false;

  const fileName = path.split('/').pop()?.toLowerCase() || '';
  const ext = '.' + fileName.split('.').pop();

  // Check if it's a known text file
  if (TEXT_EXTENSIONS.has(ext)) return true;

  // Check for files without extensions that are commonly text
  if (!fileName.includes('.')) {
    const commonTextFiles = ['readme', 'license', 'changelog', 'makefile', 'dockerfile'];
    if (commonTextFiles.includes(fileName)) return true;
  }

  return false;
}

/**
 * Import files from a GitHub repository
 */
export async function importFromGitHub(
  repoUrl: string,
  token?: string,
  pathFilter?: string
): Promise<GitHubFile[]> {
  const { owner, repo, branch, path: urlPath } = parseGitHubUrl(repoUrl);
  const basePath = pathFilter || urlPath || '';

  // Get the repository tree
  const tree = await fetchRepoTree(owner, repo, branch, token);

  // Filter to only text files we can process
  const filesToProcess = tree.filter((item) => {
    if (item.type !== 'blob') return false;
    if (basePath && !item.path.startsWith(basePath)) return false;
    return shouldProcessFile(item.path, item.size);
  });

  // Fetch content for each file (with concurrency limit)
  const files: GitHubFile[] = [];
  const concurrencyLimit = 5;

  for (let i = 0; i < filesToProcess.length; i += concurrencyLimit) {
    const batch = filesToProcess.slice(i, i + concurrencyLimit);

    const results = await Promise.allSettled(
      batch.map(async (file) => {
        const content = await fetchFileContent(owner, repo, file.path, branch, token);
        return {
          path: file.path,
          name: file.path.split('/').pop() || file.path,
          content,
          size: file.size,
          sha: file.sha,
        };
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        files.push(result.value);
      }
    }
  }

  return files;
}

export const githubService = {
  parseGitHubUrl,
  importFromGitHub,
};
