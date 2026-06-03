---
title: "GitHub Integration"
sidebar_position: 13.5
displayed_sidebar: guideSidebar
---

The `@framers/agentos-ext-github` extension provides 26 GitHub tools that give agents full programmatic access to repositories, issues, pull requests, files, branches, releases, and CI/CD workflows. It also includes a [`GitHubRepoIndexer`](https://github.com/framerslab/agentos-extensions/blob/master/registry/curated/integrations/github/src/GitHubRepoIndexer.ts) for RAG-ready codebase ingestion.

## Installation

The extension is loaded via the AgentOS extension system:

```typescript
import { AgentOS } from '@framers/agentos';

const agent = new AgentOS();
await agent.initialize({
  provider: 'openai',
  extensions: ['@framers/agentos-ext-github'],
});
```

## Authentication

The extension resolves a GitHub token in priority order:

1. `options.token` (passed at extension load time)
2. `secrets["github.token"]` (from the secrets store)
3. `GITHUB_TOKEN` environment variable
4. `GH_TOKEN` environment variable
5. `gh auth token` (GitHub CLI fallback)

## Tools

### Search

| Tool | Description |
|---|---|
| `github_search` | Search code, issues, PRs, repos, and users across GitHub |

### Issues

| Tool | Description |
|---|---|
| `github_issue_list` | List issues for a repository with filters |
| `github_issue_create` | Create a new issue |
| `github_issue_update` | Update an existing issue (title, body, state, labels, assignees) |
| `github_comment_list` | List comments on an issue |

### Pull Requests

| Tool | Description |
|---|---|
| `github_pr_list` | List pull requests for a repository with filters |
| `github_pr_create` | Create a new pull request |
| `github_pr_diff` | Get the diff for a pull request |
| `github_pr_review` | Submit a review (approve, request changes, comment) |
| `github_pr_merge` | Merge a pull request |
| `github_pr_comment_list` | List review comments on a PR |
| `github_pr_comment_create` | Create a review comment on a PR |

### Files & Content

| Tool | Description |
|---|---|
| `github_file_read` | Read a file from a repository at any ref |
| `github_file_write` | Create or update a file in a repository |
| `github_gist_create` | Create a public or secret gist |

### Repositories

| Tool | Description |
|---|---|
| `github_repo_list` | List repositories for a user or organisation |
| `github_repo_info` | Get repository metadata (description, stars, languages) |
| `github_repo_create` | Create a new repository |
| `github_repo_index` | Index a repository for RAG (via GitHubRepoIndexer) |

### Branches & Commits

| Tool | Description |
|---|---|
| `github_branch_list` | List branches for a repository |
| `github_branch_create` | Create a new branch from a ref |
| `github_commit_list` | List commits on a branch with pagination |

### Releases & CI

| Tool | Description |
|---|---|
| `github_release_list` | List releases for a repository |
| `github_release_create` | Create a new release with optional assets |
| `github_actions_list` | List GitHub Actions workflow runs |
| `github_actions_trigger` | Trigger a workflow dispatch event |

## GitHubRepoIndexer

The [`GitHubRepoIndexer`](https://github.com/framerslab/agentos-extensions/blob/master/registry/curated/integrations/github/src/GitHubRepoIndexer.ts) walks a repository tree, extracts documentation and source files, splits them by markdown headings, and returns structured [`IndexedChunk`](https://github.com/framerslab/agentos-extensions/blob/master/registry/curated/integrations/github/src/GitHubRepoIndexer.ts) arrays suitable for vector-store ingestion.

```typescript
import { GitHubRepoIndexer } from '@framers/agentos-ext-github';

const indexer = new GitHubRepoIndexer(githubService);

// Index a single repository
const result = await indexer.indexRepo({ owner: 'framerslab', repo: 'agentos' });
console.log(`${result.chunks.length} chunks from ${result.filesScanned} files`);

// Index the ecosystem (default repos)
const results = await indexer.indexEcosystem();
for (const r of results) {
  console.log(`${r.repo}: ${r.chunks.length} chunks`);
}
```

### Ecosystem auto-indexing

The indexer ships with a default list of ecosystem repositories that are indexed automatically when `indexEcosystem()` is called without arguments:

- `framerslab/agentos`
- `jddunn/wunderland`
- `framerslab/agentos-live-docs`
- `jddunn/wunderland-live-docs`

### [`IndexedChunk`](https://github.com/framerslab/agentos-extensions/blob/master/registry/curated/integrations/github/src/GitHubRepoIndexer.ts)

```typescript
interface IndexedChunk {
  heading: string;     // e.g. "github:framerslab/agentos:README.md#Installation"
  content: string;     // Chunk text content, ready for embedding
  sourcePath: string;  // Source path within the repo
}
```

### [`IndexResult`](https://github.com/framerslab/agentos-extensions/blob/master/registry/curated/integrations/github/src/GitHubRepoIndexer.ts)

```typescript
interface IndexResult {
  repo: string;          // "owner/repo"
  chunks: IndexedChunk[];
  filesScanned: number;
  treeSize: number;      // Total tree entries before filtering
  durationMs: number;
}
```

## Usage examples

### PR review workflow

An agent can review a pull request end-to-end by chaining tools:

```typescript
// 1. List open PRs
const prs = await agent.callTool('github_pr_list', {
  owner: 'framerslab',
  repo: 'agentos',
  state: 'open',
});

// 2. Get the diff for the first PR
const diff = await agent.callTool('github_pr_diff', {
  owner: 'framerslab',
  repo: 'agentos',
  number: prs[0].number,
});

// 3. Submit a review
await agent.callTool('github_pr_review', {
  owner: 'framerslab',
  repo: 'agentos',
  number: prs[0].number,
  event: 'COMMENT',
  body: 'LGTM with minor suggestions...',
});
```

### Codebase exploration

An agent can explore a repository's structure and content:

```typescript
// Read a specific file
const readme = await agent.callTool('github_file_read', {
  owner: 'framerslab',
  repo: 'agentos',
  path: 'README.md',
});

// Search for patterns across GitHub
const results = await agent.callTool('github_search', {
  query: 'generateVideo language:typescript',
  type: 'code',
});

// Index repository content for RAG retrieval
await agent.callTool('github_repo_index', {
  owner: 'framerslab',
  repo: 'agentos',
});
```

### Issue management

```typescript
// Create an issue
await agent.callTool('github_issue_create', {
  owner: 'framerslab',
  repo: 'agentos',
  title: 'Add WebM output support to video pipeline',
  body: 'The video pipeline currently only supports MP4 output...',
  labels: ['enhancement', 'video'],
});

// Update issue state
await agent.callTool('github_issue_update', {
  owner: 'framerslab',
  repo: 'agentos',
  number: 42,
  state: 'closed',
});
```

### CI/CD automation

```typescript
// List recent workflow runs
const runs = await agent.callTool('github_actions_list', {
  owner: 'framerslab',
  repo: 'agentos',
  workflow_id: 'ci.yml',
});

// Trigger a workflow
await agent.callTool('github_actions_trigger', {
  owner: 'framerslab',
  repo: 'agentos',
  workflow_id: 'release.yml',
  ref: 'master',
  inputs: { version: '2.0.0' },
});
```

## Extension pack

The extension follows the standard `createExtensionPack()` factory pattern:

```typescript
import createExtensionPack from '@framers/agentos-ext-github';

const pack = createExtensionPack({
  options: { token: 'ghp_...', priority: 30 },
  logger: console,
});

// pack.descriptors contains 26 tool descriptors
// pack.onActivate() initialises the GitHubService
```

All 26 tools share a single [`GitHubService`](https://github.com/framerslab/agentos-extensions/blob/master/registry/curated/integrations/github/src/GitHubService.ts) instance that handles authentication, rate limiting, and request batching.
