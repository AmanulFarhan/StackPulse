import {
  getDeveloperRepositories,
  getRepositoryCommitActivity,
  GitHubApiError,
  type GitHubRepository,
  type WeeklyCommitActivity,
} from "./githubService.js";

const ANALYTICS_CACHE_TTL_MS = 30_000;
const PENDING_CACHE_TTL_MS = 8_000;
const MAX_ANALYTICS_CACHE_ENTRIES = 100;
const MAX_CONCURRENT_REPOSITORIES = 3;
const WEEKS_PER_YEAR = 52;
const PENDING_RETRY_DELAY_MS = 2_200;
const MAX_PENDING_RETRIES = 2;

export type RepositoryActivityStatus = "available" | "pending" | "no_data" | "failed";

export type RepositoryCommitActivity = {
  repository: string;
  htmlUrl: string;
  updatedAt: string;
  status: RepositoryActivityStatus;
  httpStatus: number | null;
  commits: number | null;
  weeklyActivity: { week: string; commits: number }[] | null;
  message: string | null;
};

export type DeveloperCommitAnalytics = {
  username: string;
  scope: string;
  repositoriesAnalyzed: number;
  totalRepositoriesSelected: number;
  repositoriesWithStats: number;
  pendingRepositories: number;
  noDataRepositories: number;
  failedRepositories: number;
  totalCommits: number | null;
  averageWeeklyCommits: number | null;
  mostActiveWeek: { week: string; commits: number } | null;
  weeklyActivity: { week: string; commits: number }[];
  dailyActivity: { day: string; commits: number }[] | null;
  repositories: RepositoryCommitActivity[];
};

type AnalyticsCacheEntry = { expiresAt: number; value: DeveloperCommitAnalytics };
const analyticsCache = new Map<string, AnalyticsCacheEntry>();
const pendingAnalytics = new Map<string, Promise<DeveloperCommitAnalytics>>();

type RepositoryResult = {
  repository: GitHubRepository;
  activity: WeeklyCommitActivity[] | null;
  status: RepositoryActivityStatus;
  httpStatus: number | null;
  message: string | null;
};

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]!);
    }
  });
  await Promise.all(workers);
  return results;
}

function asWeekDate(week: number): string {
  return new Date(week * 1000).toISOString();
}

async function buildAnalytics(username: string): Promise<DeveloperCommitAnalytics> {
  const allRepositories = await getDeveloperRepositories(username);
  const selectedRepositories = [...allRepositories]
    .sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at))
    .slice(0, 10);

  const results = await mapWithConcurrency(
    selectedRepositories,
    MAX_CONCURRENT_REPOSITORIES,
    async (repository): Promise<RepositoryResult> => {
      const [owner = "", repoName = repository.name] = repository.full_name.split("/");
      try {
        let result = await getRepositoryCommitActivity(owner, repoName);
        for (let attempt = 0; result.status === "pending" && attempt < MAX_PENDING_RETRIES; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, PENDING_RETRY_DELAY_MS));
          result = await getRepositoryCommitActivity(owner, repoName, true);
        }
        if (result.status === "pending") {
          return {
            repository,
            activity: null,
            status: "pending",
            httpStatus: result.httpStatus,
            message: "GitHub is still generating commit statistics. Refresh analytics in a little while.",
          };
        }
        if (result.status === "no_data" || result.activity.length === 0) {
          return {
            repository,
            activity: null,
            status: "no_data",
            httpStatus: result.httpStatus,
            message: "GitHub has no commit statistics available for this repository.",
          };
        }
        return { repository, activity: result.activity.slice(-WEEKS_PER_YEAR), status: "available", httpStatus: result.httpStatus, message: null };
      } catch (error) {
        return {
          repository,
          activity: null,
          status: "failed",
          httpStatus: error instanceof GitHubApiError ? error.statusCode : null,
          message: error instanceof Error ? error.message : "Could not load repository commit statistics.",
        };
      }
    },
  );

  const available = results.filter(
    (result): result is RepositoryResult & { activity: WeeklyCommitActivity[] } =>
    result.status === "available" && result.activity !== null,
  );
  const weeklyTotals = new Map<number, number>();
  const dailyTotals = Array<number>(7).fill(0);

  for (const result of available) {
    for (const week of result.activity) {
      weeklyTotals.set(week.week, (weeklyTotals.get(week.week) ?? 0) + week.total);
      // GitHub indexes days Sunday through Saturday; the UI uses Monday through Sunday.
      for (let githubDay = 0; githubDay < 7; githubDay += 1) {
        const mondayFirstIndex = (githubDay + 6) % 7;
        dailyTotals[mondayFirstIndex] = (dailyTotals[mondayFirstIndex] ?? 0) + (week.days[githubDay] ?? 0);
      }
    }
  }

  const weeklyActivity = [...weeklyTotals.entries()]
    .sort(([left], [right]) => left - right)
    .slice(-WEEKS_PER_YEAR)
    .map(([week, commits]) => ({ week: asWeekDate(week), commits }));
  const totalCommits = available.reduce(
    (total, result) => total + result.activity.reduce((repoTotal, week) => repoTotal + week.total, 0),
    0,
  );
  const mostActiveWeek = weeklyActivity.length
    ? weeklyActivity.reduce((mostActive, week) => week.commits > mostActive.commits ? week : mostActive)
    : null;
  const repositories: RepositoryCommitActivity[] = results.map((result) => {
    const repositoryWeeks = result.activity?.map((week) => ({ week: asWeekDate(week.week), commits: week.total })) ?? null;
    return {
      repository: result.repository.full_name,
      htmlUrl: result.repository.html_url,
      updatedAt: result.repository.updated_at,
      status: result.status,
      httpStatus: result.httpStatus,
      commits: result.activity?.reduce((total, week) => total + week.total, 0) ?? null,
      weeklyActivity: repositoryWeeks,
      message: result.message,
    };
  });
  const hasStats = available.length > 0;
  const pendingRepositories = results.filter((result) => result.status === "pending").length;
  const noDataRepositories = results.filter((result) => result.status === "no_data").length;
  const failedRepositories = results.filter((result) => result.status === "failed").length;

  return {
    username,
    scope: `Up to 10 most recently updated public repositories for @${username}`,
    repositoriesAnalyzed: available.length,
    totalRepositoriesSelected: selectedRepositories.length,
    repositoriesWithStats: available.length,
    pendingRepositories,
    noDataRepositories,
    failedRepositories,
    totalCommits: hasStats ? totalCommits : null,
    averageWeeklyCommits: hasStats && weeklyActivity.length ? totalCommits / weeklyActivity.length : null,
    mostActiveWeek,
    weeklyActivity,
    dailyActivity: hasStats
      ? ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day, index) => ({
        day,
        commits: dailyTotals[index] ?? 0,
      }))
      : null,
    repositories,
  };
}

function cacheAnalytics(key: string, value: DeveloperCommitAnalytics) {
  const now = Date.now();
  for (const [cachedKey, entry] of analyticsCache) {
    if (entry.expiresAt <= now) analyticsCache.delete(cachedKey);
  }
  if (analyticsCache.size >= MAX_ANALYTICS_CACHE_ENTRIES) {
    const oldestKey = analyticsCache.keys().next().value;
    if (oldestKey) analyticsCache.delete(oldestKey);
  }
  const hasPendingStats = value.repositories.some((repository) => repository.status === "pending");
  analyticsCache.set(key, {
    value,
    expiresAt: now + (hasPendingStats ? PENDING_CACHE_TTL_MS : ANALYTICS_CACHE_TTL_MS),
  });
}

export async function getDeveloperCommitAnalytics(username: string, forceRefresh = false): Promise<DeveloperCommitAnalytics> {
  const key = username.toLowerCase();
  const cached = analyticsCache.get(key);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) analyticsCache.delete(key);

  const pending = pendingAnalytics.get(key);
  if (pending) return pending;

  const request = buildAnalytics(username);
  pendingAnalytics.set(key, request);
  try {
    const result = await request;
    cacheAnalytics(key, result);
    return result;
  } finally {
    pendingAnalytics.delete(key);
  }
}
