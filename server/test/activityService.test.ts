import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { getDeveloperCommitAnalytics } from "../src/services/activityService.js";
import { getRepositoryCommitActivity, type GitHubRepository } from "../src/services/githubService.js";

const originalFetch = globalThis.fetch;
let sequence = 0;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function username(prefix: string) {
  sequence += 1;
  return `${prefix}-case-${sequence}`;
}

function repository(owner: string, name: string): GitHubRepository {
  return {
    id: sequence + 1,
    name,
    full_name: `${owner}/${name}`,
    html_url: `https://github.com/${owner}/${name}`,
    description: null,
    stargazers_count: 0,
    forks_count: 0,
    language: null,
    updated_at: new Date().toISOString(),
    fork: false,
    private: false,
    open_issues_count: 0,
  };
}

function weeklyStats() {
  return [{ days: [1, 0, 2, 0, 0, 0, 0], total: 3, week: 1_731_196_800 }];
}

function installFetch(handler: (url: URL) => Response | Promise<Response>) {
  globalThis.fetch = (async (input: string | URL | Request) => handler(new URL(input.toString()))) as typeof fetch;
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

function repoListResponse(owner: string, names: string[]) {
  return jsonResponse(names.map((name) => repository(owner, name)));
}

test("200 response parses weekly commit activity", async () => {
  const owner = username("stats200");
  installFetch(() => jsonResponse(weeklyStats()));
  const result = await getRepositoryCommitActivity(owner, "repo");
  assert.equal(result.status, "available");
  assert.equal(result.httpStatus, 200);
  assert.equal(result.activity[0]?.total, 3);
});

test("202 followed by 200 retries and returns available statistics", async () => {
  const owner = username("retry200");
  let statsCalls = 0;
  installFetch((url) => {
    if (url.pathname.includes("/stats/commit_activity")) {
      statsCalls += 1;
      return statsCalls === 1 ? new Response(null, { status: 202 }) : jsonResponse(weeklyStats());
    }
    return repoListResponse(owner, ["repo"]);
  });
  const result = await getDeveloperCommitAnalytics(owner);
  assert.equal(statsCalls, 2);
  assert.equal(result.repositories[0]?.status, "available");
  assert.equal(result.repositoriesAnalyzed, 1);
});

test("repeated 202 responses stop after two additional attempts", async () => {
  const owner = username("retry-pending");
  let statsCalls = 0;
  installFetch((url) => {
    if (url.pathname.includes("/stats/commit_activity")) {
      statsCalls += 1;
      return new Response(null, { status: 202 });
    }
    return repoListResponse(owner, ["repo"]);
  });
  const result = await getDeveloperCommitAnalytics(owner);
  assert.equal(statsCalls, 3);
  assert.equal(result.repositories[0]?.status, "pending");
  assert.equal(result.repositories[0]?.commits, null);
  assert.equal(result.repositoriesAnalyzed, 0);
  assert.equal(result.pendingRepositories, 1);
});

test("204 response is reported as no_data", async () => {
  const owner = username("no-content");
  installFetch((url) => url.pathname.includes("/stats/commit_activity")
    ? new Response(null, { status: 204 })
    : repoListResponse(owner, ["repo"]));
  const result = await getDeveloperCommitAnalytics(owner);
  assert.equal(result.repositories[0]?.status, "no_data");
  assert.equal(result.noDataRepositories, 1);
  assert.equal(result.totalCommits, null);
});

test("successful stats are aggregated while pending and no-data repos remain distinct", async () => {
  const owner = username("partial");
  installFetch((url) => {
    if (url.pathname.includes("/stats/commit_activity")) {
      if (url.pathname.endsWith("/good/stats/commit_activity")) return jsonResponse(weeklyStats());
      if (url.pathname.endsWith("/none/stats/commit_activity")) return new Response(null, { status: 204 });
      return new Response(null, { status: 202 });
    }
    return repoListResponse(owner, ["good", "none", "pending"]);
  });
  const result = await getDeveloperCommitAnalytics(owner);
  assert.equal(result.repositoriesAnalyzed, 1);
  assert.equal(result.totalCommits, 3);
  assert.equal(result.pendingRepositories, 1);
  assert.equal(result.noDataRepositories, 1);
  assert.equal(result.repositories.find((item) => item.repository.endsWith("/pending"))?.status, "pending");
});

test("403 and 429 rate-limit statuses are preserved and repositories are failed", async () => {
  for (const statusCode of [403, 429]) {
    const owner = username("rate-limit");
    installFetch((url) => url.pathname.includes("/stats/commit_activity")
      ? jsonResponse({ message: "API rate limit exceeded" }, statusCode)
      : repoListResponse(owner, ["repo"]));
    const result = await getDeveloperCommitAnalytics(owner);
    assert.equal(result.repositories[0]?.status, "failed");
    assert.equal(result.repositories[0]?.httpStatus, statusCode);
    assert.match(result.repositories[0]?.message ?? "", /rate limit/i);
    assert.equal(result.failedRepositories, 1);
  }
});

test("other GitHub errors preserve their message and HTTP status", async () => {
  const owner = username("server-error");
  installFetch((url) => url.pathname.includes("/stats/commit_activity")
    ? jsonResponse({ message: "GitHub is temporarily unavailable" }, 500)
    : repoListResponse(owner, ["repo"]));
  const result = await getDeveloperCommitAnalytics(owner);
  assert.equal(result.repositories[0]?.status, "failed");
  assert.equal(result.repositories[0]?.httpStatus, 500);
  assert.equal(result.repositories[0]?.message, "GitHub is temporarily unavailable");
});

test("successful repository statistics are cached", async () => {
  const owner = username("cache-hit");
  let statsCalls = 0;
  installFetch(() => {
    statsCalls += 1;
    return jsonResponse(weeklyStats());
  });
  const first = await getRepositoryCommitActivity(owner, "repo");
  const second = await getRepositoryCommitActivity(owner, "repo");
  assert.equal(first.status, "available");
  assert.equal(second.status, "available");
  assert.equal(statsCalls, 1);
});

test("manual refresh retries pending statistics while reusing successful stats", async () => {
  const owner = username("manual-refresh");
  let statsCalls = 0;
  installFetch((url) => {
    if (url.pathname.includes("/stats/commit_activity")) {
      statsCalls += 1;
      return statsCalls <= 3 ? new Response(null, { status: 202 }) : jsonResponse(weeklyStats());
    }
    return repoListResponse(owner, ["repo"]);
  });
  const pending = await getDeveloperCommitAnalytics(owner);
  assert.equal(pending.repositories[0]?.status, "pending");
  const refreshed = await getDeveloperCommitAnalytics(owner, true);
  assert.equal(refreshed.repositories[0]?.status, "available");
  assert.equal(refreshed.repositoriesAnalyzed, 1);
  assert.equal(statsCalls, 4);
});
