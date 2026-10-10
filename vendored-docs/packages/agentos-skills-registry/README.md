# @framers/agentos-skills-registry

**Catalog SDK** for querying and loading AgentOS skills (this page describes 0.19.5).

[![npm](https://img.shields.io/npm/v/@framers/agentos-skills-registry?logo=npm&color=cb3837)](https://www.npmjs.com/package/@framers/agentos-skills-registry)

```bash
npm install @framers/agentos-skills-registry
```

The skill content (88 SKILL.md files and `registry.json`) lives in [`@framers/agentos-skills`](https://github.com/framerslab/agentos-skills), which this package depends on and reads.

## Ecosystem

| Package | Role | What | Dependencies |
| --- | --- | --- | --- |
| [**@framers/agentos**](https://github.com/framerslab/agentos/tree/master/src/cognition/skills) (`@framers/agentos/cognition/skills`) | **Engine** | [SkillLoader](https://github.com/framerslab/agentos/blob/master/src/cognition/skills/SkillLoader.ts), [SkillRegistry](https://github.com/framerslab/agentos/blob/master/src/cognition/skills/SkillRegistry.ts), [path utils](https://github.com/framerslab/agentos/blob/master/src/cognition/skills/paths.ts) | |
| [**@framers/agentos-skills**](https://github.com/framerslab/agentos-skills) | **Content** | 88 [SKILL.md files](https://github.com/framerslab/agentos-skills/tree/master/registry/curated) + [registry.json](https://github.com/framerslab/agentos-skills/blob/master/registry.json) index | None |
| [**@framers/agentos-skills-registry**](https://github.com/framerslab/agentos-skills-registry) | **Catalog SDK** | `SKILLS_CATALOG`, query helpers, lazy loaders, factories | `@framers/agentos-skills`, `yaml`; peer `@framers/agentos` |

> This layout mirrors the extensions ecosystem:
> [`@framers/agentos-extensions`](https://github.com/framerslab/agentos-extensions) (content) + [`@framers/agentos-extensions-registry`](https://github.com/framerslab/agentos-extensions-registry) (SDK).

## Quick Start

### 1. Browse the catalog

```typescript
import {
  SKILLS_CATALOG,
  searchSkills,
  getSkillsByCategory,
  getSkillByName,
} from '@framers/agentos-skills-registry/catalog';

// Search names, display names, descriptions and tags
const matches = searchSkills('github');
console.log(matches.map((s) => `${s.name}: ${s.description}`));

// By category
const devSkills = getSkillsByCategory('developer-tools');
console.log(`${devSkills.length} developer-tools skills`);

// By name
const gh = getSkillByName('github');
console.log(gh?.requiredSecrets); // ['github.token']
```

`SKILLS_CATALOG` is built from `@framers/agentos-skills/registry.json` when the module loads: its curated and community entries (88 curated, no community entries in 0.10.1), sorted by name. Each entry carries `name`, `displayName`, `description`, `category`, `tags`, `requiredSecrets`, `requiredTools`, `skillPath`, `source`, `namespace` and a lazy `loadSkill()`.

### 2. Load a skill on demand

```typescript
import { loadSkillByName } from '@framers/agentos-skills-registry';

const skill = await loadSkillByName('github');
if (skill) {
  console.log(skill.content);         // SKILL.md body for prompt injection
  console.log(skill.metadata?.emoji); // the emoji from the skill's metadata.agentos block
}
```

A loaded skill has `name`, `displayName`, `description`, `content`, `frontmatter`, `metadata` and `sourcePath`. The frontmatter is parsed with `@framers/agentos`'s skill parser when that package is installed, else with the package's own YAML parser. `loadSkillByName()` resolves to `null` for a name the catalog does not hold.

### 3. Build a SkillSnapshot (requires @framers/agentos)

```typescript
import { createCuratedSkillSnapshot } from '@framers/agentos-skills-registry';

const snapshot = await createCuratedSkillSnapshot({
  skills: ['github', 'web-search', 'notion'],
  platform: 'darwin',
});

// Inject into the agent's prompt
console.log(snapshot.prompt);
```

`createCuratedSkillRegistry({ skills, config })` imports `SkillRegistry` from `@framers/agentos/cognition/skills` and registers the selected skills (`'all'` by default, `'none'`, or a list of names); only the listed `SKILL.md` files are read. `createCuratedSkillSnapshot({ skills, platform, eligibility, config })` builds that registry and returns `registry.buildSnapshot({ platform, eligibility })`; with `skills: 'none'` it returns an empty snapshot without loading anything.

### 4. Workspace skill discovery

```typescript
import {
  discoverWorkspaceSkills,
  mergeWithWorkspaceSkills,
  SKILLS_CATALOG,
} from '@framers/agentos-skills-registry';

// Scan .agents/skills/ under the working directory for <name>/SKILL.md
const workspace = await discoverWorkspaceSkills();

// Workspace skills first; a catalog skill with the same name is dropped
const merged = mergeWithWorkspaceSkills(SKILLS_CATALOG, workspace);
```

`discoverWorkspaceSkills()` takes `cwd` and `skillsDir` options and returns an empty array when the directory does not exist.

## Sub-exports

| Entry Point | What | Peer Deps |
| --- | --- | --- |
| `@framers/agentos-skills-registry` | Full API: catalog + factories + workspace discovery + schema types | `@framers/agentos` (needed by the factories) |
| `@framers/agentos-skills-registry/catalog` | `SKILLS_CATALOG`, query helpers, lazy loaders | None |
| `@framers/agentos-skills-registry/workspace-discovery` | Workspace skill scanning + merging | None |

## API Reference

### Catalog Queries

- `SKILLS_CATALOG`: sorted array of the curated and community skill entries
- `searchSkills(query)`: case-insensitive substring search across names, display names, descriptions and tags
- `getSkillsByCategory(category)`: filter by category
- `getSkillByName(name)`: single skill lookup
- `getAvailableSkills(installedTools)`: the skills whose `requiredTools` are all in `installedTools`
- `getCategories()`: sorted list of unique categories
- `getSkillsByTag(tag)`: filter by tag (case-insensitive exact match)
- `getCuratedSkills()` / `getCommunitySkills()` / `getAllSkills()`: source filters
- `getSkillEntries(names)`: filter by name list (`'all'` | `'none'` | `string[]`)

### Lazy Loading

- `loadSkillByName(name)`: load and parse a single SKILL.md by name
- `loadSkillsByNames(names)`: load several in parallel, skipping unknown names
- `loadSkillFromAbsolutePath(path, displayName)`, `createLocalSkillProxy(relativePath, displayName)`: load a SKILL.md by path

### Factory Functions (require @framers/agentos)

- `createCuratedSkillRegistry(options?)`: a live `SkillRegistry` with the selected curated skills
- `createCuratedSkillSnapshot(options?)`: a `SkillSnapshot` ready for prompt injection

### Registry Data and Path Helpers

- `getSkillsCatalog()`: the parsed `registry.json`; `getAvailableCuratedSkills()`: its curated entries
- `getBundledCuratedSkillsDir()`: absolute path to `@framers/agentos-skills/registry/curated/`
- `getBundledCommunitySkillsDir()`: absolute path to `@framers/agentos-skills/registry/community/`

### Workspace Discovery

- `discoverWorkspaceSkills(options?)`: scan `.agents/skills/` for workspace-local skills
- `mergeWithWorkspaceSkills(registry, workspace)`: merge, workspace skills first
- `parseSkillFrontmatter(content)`: parse YAML frontmatter from skill content

### Schema Types

`SkillRegistryEntry`, `SkillsRegistry`, `SkillsRegistryStats`, `SkillMetadata`, `SkillRequirements`, `SkillInstallSpec` and `SkillInstallKind` describe `registry.json` and are exported from the package root.

## Contributing and support

| Guide | What |
|---|---|
| [Contributing](https://github.com/framerslab/agentos-skills-registry/blob/master/CONTRIBUTING.md) | Development setup, commit and pull request rules, review threads, contribution licensing |
| [Release guide](https://github.com/framerslab/agentos-skills-registry/blob/master/RELEASING.md) | How a push to master becomes an npm release |
| [Code of Conduct](https://github.com/framerslab/agentos-skills-registry/blob/master/.github/CODE_OF_CONDUCT.md) | Community standards |
| [Security Policy](https://github.com/framerslab/agentos-skills-registry/blob/master/.github/SECURITY.md) | Reporting vulnerabilities privately |
| [Support](https://github.com/framerslab/agentos-skills-registry/blob/master/SUPPORT.md) | Where to get help |

New skills are added to [`@framers/agentos-skills`](https://github.com/framerslab/agentos-skills/blob/master/CONTRIBUTING.md).

## License

Apache 2.0. See [LICENSE](https://github.com/framerslab/agentos-skills-registry/blob/master/LICENSE).
