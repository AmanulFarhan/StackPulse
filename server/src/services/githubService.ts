const GITHUB_API = "https://api.github.com";
const CACHE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 400;

const headers: HeadersInit = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(process.env.GITHUB_TOKEN && {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
  }),
};

type CachedValue = { expiresAt: number; value: unknown };
const responseCache = new Map<string, CachedValue>();
const inFlightRequests = new Map<string, Promise<unknown>>();

export class GitHubApiError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
    this.name = "GitHubApiError";
  }
}

export type GitHubProfile = {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
};

export type GitHubRepository = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  updated_at: string;
  fork: boolean;
  private: boolean;
  open_issues_count: number;
};

export type GitHubUserSearchResult = {
  login: string;
  avatar_url: string;
  html_url: string;
  score: number;
  type: string;
};

export type GitHubSearchResponse = {
  total_count: number;
  items: GitHubUserSearchResult[];
};

export type WeeklyCommitActivity = {
  days: number[];
  total: number;
  week: number;
};

export type RepositoryCommitActivityResult =
  | { status: "available"; httpStatus: 200; activity: WeeklyCommitActivity[] }
  | { status: "pending"; httpStatus: 202; activity: null }
  | { status: "no_data"; httpStatus: 204; activity: null };

export type DeveloperComparisonResult = {
  username: string;
  profile: GitHubProfile | null;
  repositories: GitHubRepository[] | null;
  profileError: string | null;
  repositoriesError: string | null;
};

function cacheResponse(endpoint: string, value: unknown, ttlMs = CACHE_TTL_MS) {
  const now = Date.now();
  for (const [key, entry] of responseCache) {
    if (entry.expiresAt <= now) responseCache.delete(key);
  }
  if (responseCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) responseCache.delete(oldestKey);
  }
  responseCache.set(endpoint, { value, expiresAt: now + ttlMs });
}

async function githubRequest<T>(endpoint: string, forceRefresh = false): Promise<T> {
  const cached = responseCache.get(endpoint);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) return cached.value as T;
  if (cached) responseCache.delete(endpoint);

  const pending = inFlightRequests.get(endpoint);
  if (pending) return (await pending) as T;

  const request = (async (): Promise<unknown> => {
    const response = await fetch(`${GITHUB_API}${endpoint}`, { headers });
    if (!response.ok) {
      if (response.status === 404) {
        throw new GitHubApiError("GitHub user or resource not found", 404);
      }
      if (response.status === 403 || response.status === 429) {
        throw new GitHubApiError("GitHub API rate limit exceeded; try again shortly", response.status);
      }
      throw new GitHubApiError(`GitHub API request failed (${response.status})`, response.status);
    }

    const responseText = await response.text();
    const value: unknown = JSON.parse(responseText);
    cacheResponse(endpoint, value);
    return value;
  })();

  inFlightRequests.set(endpoint, request);
  try {
    return (await request) as T;
  } finally {
    inFlightRequests.delete(endpoint);
  }
}

export function searchDevelopers(query: string): Promise<GitHubSearchResponse> {
  const params = new URLSearchParams({ q: query, per_page: "10" });
  return githubRequest<GitHubSearchResponse>(`/search/users?${params.toString()}`);
}

export function getDeveloperProfile(username: string, forceRefresh = false): Promise<GitHubProfile> {
  return githubRequest<GitHubProfile>(`/users/${encodeURIComponent(username)}`, forceRefresh);
}

export function getDeveloperRepositories(username: string, forceRefresh = false): Promise<GitHubRepository[]> {
  const params = new URLSearchParams({ sort: "updated", per_page: "100", type: "owner" });
  return githubRequest<GitHubRepository[]>(
    `/users/${encodeURIComponent(username)}/repos?${params.toString()}`,
    forceRefresh,
  );
}

export async function getRepositoryCommitActivity(
  owner: string,
  repository: string,
  forceRefresh = false,
): Promise<RepositoryCommitActivityResult> {
  const endpoint = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/stats/commit_activity`;
  const cached = responseCache.get(endpoint);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.value as RepositoryCommitActivityResult);
  }
  if (cached) responseCache.delete(endpoint);

  const pendingRequest = inFlightRequests.get(endpoint);
  if (pendingRequest) return pendingRequest as Promise<RepositoryCommitActivityResult>;

  const request = (async (): Promise<RepositoryCommitActivityResult> => {
    const response = await fetch(`${GITHUB_API}${endpoint}`, { headers });
    if (response.status === 202) {
      console.info(`[github-stats] ${owner}/${repository} returned HTTP 202`);
      return { status: "pending", httpStatus: 202, activity: null };
    }
    if (response.status === 204) {
      console.info(`[github-stats] ${owner}/${repository} returned HTTP 204`);
      return { status: "no_data", httpStatus: 204, activity: null };
    }
    if (response.status !== 200) {
      let message = `GitHub API request failed (${response.status})`;
      try {
        const body: unknown = await response.json();
        if (typeof body === "object" && body !== null && "message" in body && typeof body.message === "string") {
          message = body.message;
        }
      } catch {
        // Preserve the HTTP status even when GitHub returns an empty or non-JSON error body.
      }
      console.warn(`[github-stats] ${owner}/${repository} returned HTTP ${response.status}`);
      if (response.status === 403 || response.status === 429) {
        throw new GitHubApiError("GitHub API rate limit exceeded; try again shortly", response.status);
      }
      throw new GitHubApiError(message, response.status);
    }

    let activity: WeeklyCommitActivity[];
    try {
      activity = await response.json() as WeeklyCommitActivity[];
    } catch {
      throw new GitHubApiError("GitHub returned invalid commit statistics", 502);
    }
    if (!Array.isArray(activity)) {
      throw new GitHubApiError("GitHub returned an unexpected commit statistics response", 502);
    }
    console.info(`[github-stats] ${owner}/${repository} returned HTTP 200 (${activity.length} weeks)`);
    const result: RepositoryCommitActivityResult = { status: "available", httpStatus: 200, activity };
    cacheResponse(endpoint, result, 30 * 60 * 1000);
    return result;
  })();

  inFlightRequests.set(endpoint, request);
  try {
    return await request;
  } finally {
    inFlightRequests.delete(endpoint);
  }
}

export async function compareDevelopers(usernames: string[], forceRefresh = false): Promise<DeveloperComparisonResult[]> {
  return Promise.all(
    usernames.map(async (username) => {
      const [profileResult, repositoryResult] = await Promise.allSettled([
        getDeveloperProfile(username, forceRefresh),
        getDeveloperRepositories(username, forceRefresh),
      ]);

      return {
        username,
        profile: profileResult.status === "fulfilled" ? profileResult.value : null,
        repositories: repositoryResult.status === "fulfilled" ? repositoryResult.value : null,
        profileError: profileResult.status === "rejected" ? errorMessage(profileResult.reason) : null,
        repositoriesError: repositoryResult.status === "rejected" ? errorMessage(repositoryResult.reason) : null,
      };
    }),
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof GitHubApiError) return error.message;
  return "Could not load this GitHub resource";
}
