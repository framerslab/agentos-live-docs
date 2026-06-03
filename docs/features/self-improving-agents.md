---
title: "Self-Improving Agents"
sidebar_position: 6.5
displayed_sidebar: guideSidebar
---

AgentOS includes a bounded self-improvement system that lets agents adapt their personality, manage their own skills, compose workflows, and evaluate their own performance at runtime. All capabilities are opt-in and constrained by configurable limits to prevent runaway self-modification.

## Configuration

Self-improvement is controlled by the [`SelfImprovementConfig`](https://github.com/framerslab/agentos/blob/master/src/cognition/emergent/SelfImprovementConfig.ts) interface, disabled by default:

```typescript
import { AgentOS } from '@framers/agentos';

const agent = new AgentOS();
await agent.initialize({
  provider: 'openai',
  selfImprovement: {
    enabled: true,
    personality: {
      maxDeltaPerSession: 0.15,  // Max absolute delta per trait per session
      persistWithDecay: true,     // Persist mutations with Ebbinghaus decay
      decayRate: 0.05,            // Decay rate per consolidation cycle
    },
    skills: {
      allowlist: ['*'],                        // Which skills the agent may enable
      requireApprovalForNewCategories: true,   // HITL for new skill categories
    },
    workflows: {
      maxSteps: 10,              // Max steps per composed workflow
      allowedTools: ['*'],       // Which tools may appear in workflows
    },
    selfEval: {
      autoAdjust: true,          // Auto-apply evaluation suggestions
      adjustableParams: ['temperature', 'verbosity', 'personality'],
      maxEvaluationsPerSession: 10,
    },
  },
});
```

When `enabled: true`, four self-improvement tools are registered with the agent's tool orchestrator.

## Tools

### `adapt_personality`

Adjusts a HEXACO personality trait by a bounded delta. Requires reasoning for every mutation and enforces per-session budgets.

```typescript
// Agent calls this tool autonomously:
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

**Budget enforcement**: Each trait has a per-session budget (`maxDeltaPerSession`). Deltas exceeding the remaining budget are clamped. Values are always clamped to [0, 1].

**Result**:

```typescript
interface AdaptPersonalityOutput {
  trait: string;
  previousValue: number;
  newValue: number;
  delta: number;
  clamped: boolean;
  sessionTotal: number;
  remainingBudget: number;
}
```

### `manage_skills`

Enables or disables skills at runtime, subject to the configured allowlist.

```typescript
{
  "tool": "manage_skills",
  "args": {
    "action": "enable",
    "skillId": "deep-research"
  }
}
```

When `requireApprovalForNewCategories` is `true`, enabling a skill whose category is not yet active returns a `requires_approval` status instead of enabling immediately.

The allowlist supports three matching modes:
- `['*']` -- All skills allowed
- `['category:research']` -- Skills in the `research` category
- `['deep-research']` -- Exact skill ID match

### `create_workflow`

Composes a multi-step tool pipeline at runtime. Steps execute sequentially with reference resolution between them (`$input`, `$prev`, `$steps[N]`).

```typescript
{
  "tool": "create_workflow",
  "args": {
    "name": "research-and-summarize",
    "description": "Search the web, then summarize the results",
    "steps": [
      { "tool": "web_search", "params": { "query": "$input.topic" } },
      { "tool": "generate_text", "params": { "prompt": "Summarize: $prev.results" } }
    ]
  }
}
```

**Constraints**:
- Maximum steps per workflow: `maxSteps` (default 10)
- `create_workflow` is always excluded from step tools to prevent recursion
- Only tools in the `allowedTools` list may appear as steps

### `self_evaluate`

Evaluates the agent's own response quality using an LLM judge, scores on multiple criteria, and optionally adjusts operational parameters.

```typescript
{
  "tool": "self_evaluate",
  "args": {
    "response": "The answer I gave about quantum computing...",
    "context": "User asked about quantum computing basics",
    "criteria": ["accuracy", "helpfulness", "conciseness"]
  }
}
```

When `autoAdjust` is `true`, the tool applies suggested parameter adjustments immediately. Adjustable parameters include `temperature`, `verbosity`, and `personality` (any HEXACO trait delta).

The evaluation model defaults to the cheapest configured text model (e.g. `gpt-4o-mini`) and can be overridden via `selfEval.evaluationModel`.

## PersonalityMutationStore

Mutations are persisted to a SQLite-backed [`PersonalityMutationStore`](https://github.com/framerslab/agentos/blob/master/src/cognition/emergent/AdaptPersonalityTool.ts) with Ebbinghaus-style strength decay:

```typescript
import { PersonalityMutationStore } from '@framers/agentos/emergent';

const store = new PersonalityMutationStore(sqliteAdapter);

// Record a mutation
const id = await store.record({
  agentId: 'agent-42',
  trait: 'openness',
  delta: 0.1,
  reasoning: 'User prefers creative responses',
  baselineValue: 0.7,
  mutatedValue: 0.8,
});

// Get strength-weighted effective deltas
const deltas = await store.getEffectiveDeltas('agent-42');
// => { openness: 0.1 }  (strength is 1.0 initially)

// Decay all mutations by 5%
const { decayed, pruned } = await store.decayAll(0.05);
```

### Decay lifecycle

1. Each mutation starts with `strength = 1.0`.
2. The [`ConsolidationLoop`](https://github.com/framerslab/agentos/blob/master/src/cognition/memory/pipeline/consolidation/ConsolidationLoop.ts) calls `store.decayAll(rate)` each cycle.
3. Each cycle subtracts `rate` (default 0.05) from every mutation's strength.
4. Mutations whose strength drops to 0.1 or below are pruned (deleted).
5. Mutations that the agent reinforces by repeated adaptation stay strong.

This implements Ebbinghaus-style forgetting: personality changes that are not reinforced gradually fade back toward baseline.

### Effective deltas

`getEffectiveDeltas(agentId)` computes the strength-weighted sum of all active mutations per trait. This gives a realistic picture of personality drift accounting for decay:

```typescript
// If the agent has two openness mutations:
// - delta: +0.1, strength: 1.0  → contributes 0.10
// - delta: +0.05, strength: 0.5 → contributes 0.025
// Effective openness delta: 0.125
```

## Bounded autonomy

The self-improvement system is designed with guardrails at every level:

| Guardrail | Mechanism |
|---|---|
| **Master switch** | `enabled: false` disables all self-improvement tools |
| **Per-session budgets** | `maxDeltaPerSession` caps trait drift per session |
| **Value clamping** | Traits always stay in [0, 1] |
| **Skill allowlists** | Only approved skills can be enabled |
| **HITL approval** | New skill categories require human approval |
| **Workflow step limits** | `maxSteps` prevents unbounded pipelines |
| **Tool allowlists** | Only approved tools can appear in workflows |
| **Evaluation limits** | `maxEvaluationsPerSession` caps self-scoring calls |
| **Ebbinghaus decay** | Unreinforced mutations fade back to baseline |
| **Audit trail** | Every mutation records reasoning for review |

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
