<p align="center">
  <a href="https://agentos.sh"><img src="logos/agentos-primary-no-tagline-transparent-2x.png" alt="AgentOS" height="56" /></a>
  &nbsp;&nbsp;&nbsp;
  <a href="https://frame.dev"><img src="logos/frame-logo-green-no-tagline.svg" alt="Frame.dev" height="36" /></a>
</p>

# @framers/agentos-skills

**Curated SKILL.md prompt modules for AgentOS** — 88 staff-verified skills with a machine-readable registry index.

[![npm](https://img.shields.io/npm/v/@framers/agentos-skills?logo=npm&color=cb3837)](https://www.npmjs.com/package/@framers/agentos-skills)

```bash
npm install @framers/agentos-skills
```

> **This is the content package.** It contains 88 curated SKILL.md files and
> the generated `registry.json` index, with no dependencies. Its runtime code is
> `index.mjs`, which reads `registry.json` and exports it.
>
> For the **catalog SDK** (query helpers, lazy loading, factory functions), see
> [`@framers/agentos-skills-registry`](https://github.com/framerslab/agentos-skills-registry).
>
> For the **runtime engine** (SkillLoader, SkillRegistry, path utilities), see
> [`@framers/agentos`](https://github.com/framerslab/agentos) (`@framers/agentos/cognition/skills`, also re-exported from the package root).

## What's Inside

This package bundles **88 curated SKILL.md files** under `registry/curated/`: 82 in their own directories and six game skills under `registry/curated/game/`. `registry.json` gives each one of these categories:

| Category | Skills |
| --- | --- |
| automation | `account-manager`, `web-scraper` |
| business | `company-research` |
| cloud | `cloud-deployment` |
| communication | `channel-management`, `discord-helper`, `slack-helper`, `voice-conversation` |
| content | `content-creator` |
| creative | `image-gen` |
| developer | `github` |
| developer-tools | `coding-agent`, `git` |
| devops | `healthcheck` |
| entertainment | `movie-lookup` |
| game | `game/combat-balancer`, `game/companion-writer`, `game/encounter-judge`, `game/narrator`, `game/quest-designer`, `game/world-builder` |
| information | `summarize`, `weather`, `web-search` |
| infrastructure | `cloud-ops`, `site-deploy` |
| marketing | `seo-campaign` |
| media | `audio-generation`, `media-discovery`, `spotify-player`, `video-generation`, `whisper-transcribe` |
| productivity | `apple-notes`, `apple-reminders`, `document-export`, `emergent-tools`, `interactive-widgets`, `memory-manager`, `multimodal-rag`, `notion`, `obsidian`, `productivity-suite`, `trello` |
| research | `deep-research`, `fact-grounding`, `research-tools` |
| safety | `hitl-safety` |
| security | `1password`, `code-safety`, `grounding-guard`, `ml-content-classifier`, `pii-redaction`, `topicality` |
| social-automation | `blog-publisher`, `bluesky-bot`, `facebook-bot`, `instagram-bot`, `linkedin-bot`, `mastodon-bot`, `pinterest-bot`, `reddit-bot`, `social-automation`, `threads-bot`, `tiktok-bot`, `twitter-bot`, `youtube-bot` |
| system | `cli-tools`, `system-tools` |
| uncategorized | `agent-config`, `email-intelligence`, `image-editing`, `social-broadcast`, `structured-output` |
| vision | `vision-ocr` |
| voice | `amazon-polly`, `diarization`, `endpoint-semantic`, `google-cloud-stt`, `google-cloud-tts`, `openwakeword`, `piper`, `porcupine`, `streaming-stt-deepgram`, `streaming-stt-whisper`, `streaming-tts-elevenlabs`, `streaming-tts-openai`, `voice-telephony`, `vosk` |

Each skill is a Markdown file with YAML frontmatter:

```yaml
---
name: github
version: '2.0.0'
description: Full GitHub API integration — 26 tools for repos, issues, PRs, branches, commits, releases, Actions, files, gists, and codebase indexing.
author: Wunderland
namespace: wunderland
category: developer
tags: [github, git, repository, issues, pull-requests, code-review, ci-cd, releases, actions, api]
requires_secrets: [github.token]
requires_tools: [github_search, github_repo_list, github_repo_info, ...]
metadata:
  agentos:
    emoji: "\U0001F4BB"
---

# GitHub

[Markdown instructions for the agent...]
```

That is the `github` skill's frontmatter, with `requires_tools` cut short. Under `metadata.agentos`, a skill can also set `primaryEnv`, `os`, `requires` (`bins`, `anyBins`, `env`, `config`) and `install` steps; the runtime engine checks `requires` when a snapshot is built with `strict: true`.

## Ecosystem

```
@framers/agentos/cognition/skills     ← Engine (SkillLoader, SkillRegistry, path utils)
@framers/agentos-skills               ← Content (you are here — 88 SKILL.md files + registry.json)
@framers/agentos-skills-registry      ← Catalog SDK (SKILLS_CATALOG, query helpers, factories)
```

| Package | Role | What | Runtime Code |
| --- | --- | --- | :---: |
| [**@framers/agentos/cognition/skills**](https://github.com/framerslab/agentos/tree/master/src/cognition/skills) | **Engine** | [SkillLoader](https://github.com/framerslab/agentos/blob/master/src/cognition/skills/SkillLoader.ts), [SkillRegistry](https://github.com/framerslab/agentos/blob/master/src/cognition/skills/SkillRegistry.ts), [path utils](https://github.com/framerslab/agentos/blob/master/src/cognition/skills/paths.ts) | Yes |
| [**@framers/agentos-skills**](https://github.com/framerslab/agentos-skills) | **Content** | 88 [SKILL.md files](https://github.com/framerslab/agentos-skills/tree/master/registry/curated) + [registry.json](https://github.com/framerslab/agentos-skills/blob/master/registry.json) index | No |
| [**@framers/agentos-skills-registry**](https://github.com/framerslab/agentos-skills-registry) | **Catalog SDK** | SKILLS_CATALOG, query helpers, lazy loaders, factories | Yes |

> This layout mirrors the extensions ecosystem:
> `@framers/agentos-extensions` (content) + `@framers/agentos-extensions-registry` (SDK).

## Usage

### The registry index

```typescript
import registry from '@framers/agentos-skills';

console.log(`${registry.stats.totalSkills} skills available`);
for (const skill of registry.skills.curated) {
  console.log(`  ${skill.metadata?.emoji ?? '📦'} ${skill.name} — ${skill.description}`);
}
```

### Via the catalog SDK (recommended)

```typescript
import { searchSkills, loadSkillByName } from '@framers/agentos-skills-registry';

const matches = searchSkills('github');
const skill = await loadSkillByName('github');
console.log(skill?.content); // SKILL.md body ready for prompt injection
```

The default export is the parsed `registry.json`. Importing `@framers/agentos-skills/registry.json` directly needs the JSON import attribute (`with { type: 'json' }`) on Node.

### Via the runtime engine

```typescript
import { SkillRegistry } from '@framers/agentos/cognition/skills';

const registry = new SkillRegistry();
await registry.loadFromDirs([
  '/path/to/agentos-skills/registry/curated',
  '/path/to/agentos-skills/registry/curated/game',
]);
const snapshot = registry.buildSnapshot({ platform: 'darwin', strict: true });
console.log(snapshot.prompt);
```

`loadFromDirs()` reads the `SKILL.md` of each directory directly under a listed directory, so the game skills need `registry/curated/game` listed too.

## Contributing

See [CONTRIBUTING.md](https://github.com/framerslab/agentos-skills/blob/master/CONTRIBUTING.md) for guidelines on adding new skills.

## License

Apache 2.0 — see [LICENSE](https://github.com/framerslab/agentos-skills/blob/master/LICENSE).

---

<p align="center">
  <a href="https://agentos.sh"><img src="logos/agentos-primary-no-tagline-transparent-2x.png" alt="AgentOS" height="36" /></a>
  &nbsp;&nbsp;&nbsp;
  <a href="https://frame.dev"><img src="logos/frame-logo-green-no-tagline.svg" alt="Frame.dev" height="28" /></a>
</p>

<p align="center">
  Built by <a href="https://frame.dev">Frame</a><br>
  Contact: <a href="mailto:team@frame.dev">team@frame.dev</a>
</p>
