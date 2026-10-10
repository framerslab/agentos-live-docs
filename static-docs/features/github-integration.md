---
sidebar_label: GitHub Integration
sidebar_position: 32
---

# GitHub Integration

The `@framers/agentos-ext-github` extension pack provides 26 GitHub tools for search, issues, pull requests, files, gists, repositories, branches, commits, releases and Actions runs, built on `@octokit/rest`. It also exports a [`GitHubRepoIndexer`](https://github.com/framerslab/agentos-extensions/blob/master/registry/curated/integrations/github/src/GitHubRepoIndexer.ts) that turns a repository's metadata, file tree and documentation into text chunks.

## Installation

```bash
npm install @framers/agentos-ext-github
```

Load the pack through the extension manifest:

```typescript
import { AgentOS } from '@framers/agentos';

const agentos = await AgentOS.create({
  extensionManifest: {
    packs: [
      {
        package: '@framers/agentos-ext-github',
        options: { token: process.env.GITHUB_TOKEN },
      },
    ],
  },
});
```

## Authentication

The factory resolves a GitHub token in this order:

1. `options.token`
2. `secrets['github.token']`, from a `secrets` map in the pack's options (or a `secrets` map on the factory context)
3. The `GITHUB_TOKEN` environment variable
4. The `GH_TOKEN` environment variable
5. The output of `gh auth token` (GitHub CLI)

When none resolves, the factory throws and AgentOS skips the pack with a `pack:failed` event. Activation calls the GitHub API for the authenticated user to check the token; a rejected token fails the pack the same way.

## Tools

Each tool takes snake_case arguments named after the GitHub REST API (`owner`, `repo`, `pull_number`, `issue_number`, `per_page`).

### Search

| Tool | Description |
|---|---|
| `github_search` | Search repositories (the default), code, issues and pull requests, or users; `per_page` up to 30 |

### Issues

| Tool | Description |
|---|---|
| `github_issue_list` | List a repository's issues, filtered by state (default `open`) and labels |
| `github_issue_create` | Create an issue with labels and assignees |
| `github_issue_update` | Update an issue's title, body, state, labels or assignees (labels and assignees replace the current set) |
| `github_comment_list` | List the comments on an issue or pull request |

### Pull Requests

| Tool | Description |
|---|---|
| `github_pr_list` | List pull requests, filtered by state (default `open`), head and base |
| `github_pr_create` | Create a pull request, optionally as a draft |
| `github_pr_diff` | List the first 30 changed files with their addition and deletion counts; `include_patch` adds each file's patch, cut at 3,000 characters |
| `github_pr_review` | Submit a review (`APPROVE`, `COMMENT` or `REQUEST_CHANGES`) with optional line comments |
| `github_pr_merge` | Merge a pull request (`merge`, `squash` or `rebase`; default `merge`) |
| `github_pr_comment_list` | List the line-level review comments on a pull request |
| `github_pr_comment_create` | Post a comment on a pull request's conversation (an issue comment, not a line comment) |

### Files & Content

| Tool | Description |
|---|---|
| `github_file_read` | Read a file (decoded to UTF-8, with its `sha`) or list a directory, at any ref |
| `github_file_write` | Create or update a file in one commit; an update needs the current file's `sha` |
| `github_gist_create` | Create a gist from a map of filenames to content; secret unless `public` is `true` |

### Repositories

| Tool | Description |
|---|---|
| `github_repo_list` | List a user's repositories, or an organisation's with `type: 'org'`; sorted by last update |
| `github_repo_info` | Repository metadata: description, primary language, stars, forks, open issues, topics, license, default branch, visibility and dates |
| `github_repo_create` | Create a repository under the authenticated user |
| `github_repo_index` | Return text chunks for a repository: metadata, the file tree, the root README, up to `max_doc_files` (default 10) markdown files under `docs/`, `doc/` or `documentation/`, and `package.json`. It stores nothing |

### Branches & Commits

| Tool | Description |
|---|---|
| `github_branch_list` | List branches, optionally only protected ones |
| `github_branch_create` | Create a branch from a branch or commit (default: the default branch) |
| `github_commit_list` | List up to 100 commits from a branch or SHA, filtered by path, author and date range |

### Releases & CI

| Tool | Description |
|---|---|
| `github_release_list` | List releases |
| `github_release_create` | Create a release for a tag, as a draft or prerelease, with written or generated notes |
| `github_actions_list` | List recent workflow runs for the repository or one workflow |
| `github_actions_trigger` | Send a `workflow_dispatch` event with inputs; `ref` defaults to `master` |

### Tool results

A tool returns `{ success: true, data }` or `{ success: false, error }`. AgentOS passes a tool's `output` field to the model, so when these tools run through `agent()` or an AgentOS runtime, the model receives an empty result for a successful call and the error text for a failed one. Code that calls a tool's `execute()` directly reads `data`.

## Calling the tools directly

The tool classes and `GitHubService` are exported. A service must be initialized before a tool runs:

```typescript
import {
  GitHubService,
  GitHubPrListTool,
  GitHubPrDiffTool,
  GitHubPrReviewTool,
} from '@framers/agentos-ext-github';

const service = new GitHubService(process.env.GITHUB_TOKEN!);
await service.initialize();

// 1. List open pull requests
const prs = await new GitHubPrListTool(service).execute({
  owner: 'framerslab',
  repo: 'agentos',
  state: 'open',
});
const first = (prs.data as Array<{ number: number }>)[0];

// 2. Changed files with patches
const diff = await new GitHubPrDiffTool(service).execute({
  owner: 'framerslab',
  repo: 'agentos',
  pull_number: first.number,
  include_patch: true,
});

// 3. Submit a review
await new GitHubPrReviewTool(service).execute({
  owner: 'framerslab',
  repo: 'agentos',
  pull_number: first.number,
  event: 'COMMENT',
  body: 'Two suggestions inline.',
});
```

The same pattern covers the other tools, for example:

```typescript
import { GitHubIssueUpdateTool, GitHubActionsTriggerTool } from '@framers/agentos-ext-github';

await new GitHubIssueUpdateTool(service).execute({
  owner: 'framerslab',
  repo: 'agentos',
  issue_number: 42,
  state: 'closed',
});

await new GitHubActionsTriggerTool(service).execute({
  owner: 'framerslab',
  repo: 'agentos',
  workflow_id: 'release.yml',
  ref: 'master',
  inputs: { version: '2.0.0' },
});
```

## GitHubRepoIndexer

[`GitHubRepoIndexer`](https://github.com/framerslab/agentos-extensions/blob/master/registry/curated/integrations/github/src/GitHubRepoIndexer.ts) builds chunks for a repository. It is separate from the `github_repo_index` tool, which builds its own chunks.

```typescript
import { GitHubService, GitHubRepoIndexer } from '@framers/agentos-ext-github';

const service = new GitHubService(process.env.GITHUB_TOKEN!);
await service.initialize();
const indexer = new GitHubRepoIndexer(service);

// Index one repository (an optional third argument names the branch)
const result = await indexer.indexRepo('framerslab', 'agentos');
console.log(`${result.chunks.length} chunks from ${result.filesScanned} files`);

// Index the built-in repository list
const results = await indexer.indexEcosystem();
for (const r of results) {
  console.log(`${r.repo}: ${r.chunks.length} chunks`);
}
```

`indexRepo()` produces:

- a metadata chunk (description, language, stars, forks, default branch, license, topics, URL)
- a tree chunk listing the paths outside `node_modules`, `dist`, `build`, `.git`, `.next`, `coverage`, `__pycache__` and `.turbo`, cut at 6,000 characters
- chunks for up to 20 documentation files (`README.md`, `CONTRIBUTING.md` and `CHANGELOG.md` at any depth, and markdown files directly under a `docs/` directory), each split at level 1 to 3 headings, with the first five sections kept and each cut at 6,000 characters
- a `package.json` chunk with the name, version, description, dependency names and script names

### Ecosystem indexing

`indexEcosystem()` takes no arguments and indexes six repositories in turn. A repository that fails gives an empty result.

- `framerslab/agentos`
- `jddunn/wunderland`
- `framerslab/agentos-live-docs`
- `jddunn/wunderland-live-docs`
- `framerslab/agentos-skills-registry`
- `framerslab/agentos-extensions`

### [`IndexedChunk`](https://github.com/framerslab/agentos-extensions/blob/master/registry/curated/integrations/github/src/GitHubRepoIndexer.ts)

```typescript
interface IndexedChunk {
  heading: string;     // e.g. "github:framerslab/agentos:README.md" or "github:framerslab/agentos:metadata"
  content: string;     // Chunk text, ready for embedding
  sourcePath: string;  // Path within the repo, or ":metadata" / ":tree"
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

## Extension pack

```typescript
import createExtensionPack from '@framers/agentos-ext-github';

const pack = createExtensionPack({
  options: { token: process.env.GITHUB_TOKEN, priority: 30 },
  logger: console,
});

// pack.descriptors holds the 26 tool descriptors (priority 30 by default)
// pack.onActivate() initializes the shared GitHubService and checks the token
```

All 26 tools share one [`GitHubService`](https://github.com/framerslab/agentos-extensions/blob/master/registry/curated/integrations/github/src/GitHubService.ts), which holds the authenticated Octokit client. The service reports the token's rate limit through `getRateLimit()`; it does not throttle, retry or batch requests.
