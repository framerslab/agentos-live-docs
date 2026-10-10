---
sidebar_label: Self-Improving Agents
sidebar_position: 31
---

# Self-Improving Agents

AgentOS has four opt-in tools that let a running agent change its own behaviour within configured limits: `adapt_personality` shifts a HEXACO trait, `manage_skills` turns skills on and off for the session, `create_workflow` chains tools into a reusable sequence, and `self_evaluate` scores a response and adjusts runtime parameters. They run in the AgentOS runtime (`AgentOS.create()` and `processRequest()`); `agent()` and `agency()` do not register them.

## Configuration

The tools are part of the emergent capability engine, so `emergent: true` is required, and [`SelfImprovementConfig`](https://github.com/framerslab/agentos/blob/master/src/cognition/emergent/SelfImprovementConfig.ts) sits under `emergentConfig.selfImprovement`. It is off by default:

```typescript
import { AgentOS } from '@framers/agentos';

const agentos = await AgentOS.create({
  emergent: true,
  emergentConfig: {
    selfImprovement: {
      enabled: true,
      personality: {
        maxDeltaPerSession: 0.15,  // Max absolute change per trait per session
        persistWithDecay: true,    // Record mutations (with a storage adapter) and decay them
        decayRate: 0.05,           // Strength removed per decay step
      },
      skills: {
        allowlist: ['*'],                       // Which skills the agent may enable
        requireApprovalForNewCategories: true,  // Answer requires_approval for a new category
      },
      workflows: {
        maxSteps: 10,              // Max steps per composed workflow
        allowedTools: ['*'],       // Which tools may appear in workflows
      },
      selfEval: {
        autoAdjust: true,          // Apply the judge's suggested adjustments
        adjustableParams: ['temperature', 'verbosity', 'personality'],
        maxEvaluationsPerSession: 10,
      },
    },
  },
});
```

Sections left out take their defaults (below). With `enabled: true`, the four tools are registered with the tool orchestrator next to `forge_tool`. Each tool keeps its state per session and acts on the GMI that made the call.

## Tools

### `adapt_personality`

Changes one HEXACO trait of the calling GMI by a signed delta. `reasoning` is required.

```json
{
  "tool": "adapt_personality",
  "args": {
    "trait": "openness",
    "delta": 0.1,
    "reasoning": "User prefers creative, exploratory responses."
  }
}
```

**Valid traits**: `openness`, `conscientiousness`, `emotionality`, `extraversion`, `agreeableness`, `honesty`

**Budget**: the absolute changes applied to a trait in one session add up to at most `maxDeltaPerSession`; a delta beyond the remaining budget is cut to it, and the result is clamped to [0, 1]. A trait the persona does not set starts from 0.5.

The change applies to the calling GMI's own copy of the persona; the shared persona definition stays as it was. With a storage adapter and `persistWithDecay` on (the default), each change is also recorded in the [`PersonalityMutationStore`](https://github.com/framerslab/agentos/blob/master/src/cognition/emergent/PersonalityMutationStore.ts) (below). Stored mutations are not loaded back into a GMI, so a trait change lasts for the instance that made it.

**Result**:

```typescript
interface AdaptPersonalityOutput {
  trait: string;
  previousValue: number;
  newValue: number;
  delta: number;          // The change applied after budget and range limits
  clamped: boolean;
  sessionTotal: number;
  remainingBudget: number;
}
```

### `manage_skills`

Enables, disables, searches or lists skills for the session. `action` is one of `enable`, `disable`, `search` (with `query`) and `list`; `enable` and `disable` take `skillId`.

```json
{
  "tool": "manage_skills",
  "args": {
    "action": "enable",
    "skillId": "deep-research"
  }
}
```

A skill may be enabled when the allowlist holds `'*'`, its ID or `category:<its category>`, or when another enabled skill of the session shares its category. Otherwise the tool answers `requires_approval` when `requireApprovalForNewCategories` is `true` and refuses when it is `false`. `requires_approval` is a status in the tool result: no approval request is raised, and the skill stays off. With the default allowlist `['*']`, every skill is allowed.

The allowlist supports three matching modes:
- `['*']`: all skills
- `['category:research']`: skills in the `research` category
- `['deep-research']`: an exact skill ID

Up to three enabled skills, with their descriptions and content (cut at 1,200 characters each), are added to the prompt of the session's later turns. A disabled skill is left out of the turn's capability planning.

### `create_workflow`

Creates, runs and lists tool sequences for the session. `action` is one of `create`, `run` and `list`.

```json
{
  "tool": "create_workflow",
  "args": {
    "action": "create",
    "name": "search-and-aggregate",
    "description": "Search the web for a topic, then aggregate several searches on it",
    "steps": [
      { "tool": "web_search", "args": { "query": "$input" } },
      { "tool": "research_aggregate", "args": { "topic": "$input", "depth": "quick" } }
    ]
  }
}
```

```json
{
  "tool": "create_workflow",
  "args": { "action": "run", "workflowId": "workflow-1", "input": "solid-state batteries" }
}
```

(`web_search` and `research_aggregate` come from the `@framers/agentos-ext-web-search` pack; any registered tools work.)

`create` returns a `workflowId` (`workflow-1`, `workflow-2`, ...). `run` takes that `workflowId` and an `input`, and runs the steps in order, each through the tool orchestrator as the caller, with a 30-second limit per step. A step argument whose whole value is `"$input"`, `"$prev"` or `"$steps[N]"` is replaced with the run input, the previous step's output or step N's output; references inside a longer string or with a property path (`"$input.topic"`) stay as written.

**Constraints**:
- At most `maxSteps` steps (default 10)
- `create_workflow` cannot be a step
- Every step tool must be registered, listed in `allowedTools`, and pass the chaining check, at `create` and again at each `run`

### `self_evaluate`

Scores a response, adjusts a runtime parameter, or reports on the session. `action` is one of `evaluate`, `adjust` and `report`.

```json
{
  "tool": "self_evaluate",
  "args": {
    "action": "evaluate",
    "query": "What are the basics of quantum computing?",
    "response": "The answer I gave about quantum computing..."
  }
}
```

`evaluate` needs `query` and `response`. A model call scores the response from 0 to 1 on relevance, clarity, accuracy and helpfulness; a session gets at most `maxEvaluationsPerSession` evaluations. When `autoAdjust` is `true`, the judge may also suggest adjustments limited to `adjustableParams`, and the tool applies them as `adjust` would.

`adjust` takes `param` and `value`:
- `temperature` (a number) becomes the temperature of the session's later `processRequest()` turns
- `verbosity` (`concise`, `balanced` or `detailed`) becomes a user preference that the prompt engine turns into a response-length instruction
- `personality`, with `value: { trait, delta }`, goes through `adapt_personality` and its budget

The evaluation model is `selfEval.evaluationModel` when set, else the cheap default model of the detected text provider, else `openai:gpt-4o-mini`. Scores are stored as a session-scoped trace in the calling GMI's cognitive memory when it has one.

## PersonalityMutationStore

[`PersonalityMutationStore`](https://github.com/framerslab/agentos/blob/master/src/cognition/emergent/PersonalityMutationStore.ts) keeps mutations in SQL tables (`personality_mutations`, `personality_decay_cycles`) on a storage adapter, each with a strength that decays:

```typescript
import { PersonalityMutationStore } from '@framers/agentos/emergent';

const store = new PersonalityMutationStore(storageAdapter);

// Record a mutation
const id = await store.record({
  agentId: 'agent-42',
  trait: 'openness',
  delta: 0.1,
  reasoning: 'User prefers creative responses',
  baselineValue: 0.7,
  mutatedValue: 0.8,
});

// Strength-weighted deltas per trait
const deltas = await store.getEffectiveDeltas('agent-42');
// => { openness: 0.1 }  (strength is 1.0 initially)

// Lower every mutation's strength by 0.05
const { decayed, pruned } = await store.decayAll(0.05);
```

### Decay

1. Each mutation starts with `strength = 1.0`.
2. A decay step subtracts `rate` from each mutation's strength and deletes the mutations whose strength drops to 0.1 or below.
3. In the runtime, `adapt_personality` runs one step with `decayRate` over the calling agent's mutations before it records a new one, when `persistWithDecay` is `true`. `decayForAgent()` runs at most one step per agent per UTC day.
4. [`ConsolidationLoop`](https://github.com/framerslab/agentos/blob/master/src/cognition/memory/pipeline/consolidation/ConsolidationLoop.ts) calls `decayAll(rate)` on each cycle when it is constructed with a `personalityMutationStore`; nothing in AgentOS constructs it with one.

Decay changes the stored records only. It does not move a live GMI's trait back toward its baseline.

### Effective deltas

`getEffectiveDeltas(agentId)` sums `delta × strength` per trait over the agent's mutations with strength above 0.1:

```typescript
// If the agent has two openness mutations:
// - delta: +0.1, strength: 1.0  → contributes 0.10
// - delta: +0.05, strength: 0.5 → contributes 0.025
// Effective openness delta: 0.125
```

## Limits

| Limit | Mechanism |
|---|---|
| **Master switch** | `selfImprovement.enabled: false` (the default) registers none of the four tools |
| **Per-session budgets** | `maxDeltaPerSession` caps the change to each trait in a session |
| **Value clamping** | Traits stay in [0, 1] |
| **Skill allowlists** | Only allowed skills, or skills of an already active category, can be enabled |
| **New categories** | `requireApprovalForNewCategories` returns `requires_approval` instead of enabling (no effect under `'*'`) |
| **Workflow step limits** | `maxSteps` caps each workflow |
| **Tool allowlists** | Only `allowedTools` can appear in workflows |
| **Evaluation limits** | `maxEvaluationsPerSession` caps evaluations |
| **Adjustable parameters** | `adjustableParams` limits what `self_evaluate` may change |
| **Audit trail** | Every recorded mutation keeps its reasoning, baseline and new value |

## Default configuration

```typescript
const DEFAULT_SELF_IMPROVEMENT_CONFIG = {
  enabled: false,
  personality: {
    maxDeltaPerSession: 0.15,
    persistWithDecay: true,
    decayRate: 0.05,
  },
  skills: {
    allowlist: ['*'],
    requireApprovalForNewCategories: true,
  },
  workflows: {
    maxSteps: 10,
    allowedTools: ['*'],
  },
  selfEval: {
    autoAdjust: true,
    adjustableParams: ['temperature', 'verbosity', 'personality'],
    maxEvaluationsPerSession: 10,
  },
};
```
