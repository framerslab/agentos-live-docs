---
title: 'Code Safety'
sidebar_position: 21
---

# Code Safety

Regex-based OWASP Top 10 code safety scanning for LLM-generated code. Detects insecure patterns in fenced code blocks of streamed output and user input, and in code passed to `scan_code`, using language-aware rule sets. Pure regex: no models, and no runtime dependency beyond `@framers/agentos`.

**Package:** `@framers/agentos-ext-code-safety`

---

## Overview

The Code Safety extension provides two modes of operation:

- **Passive protection** via a guardrail that scans fenced code blocks in streamed agent output and in user input (see [Tool Call Scanning](#tool-call-scanning) for tool arguments)
- **Active capability** via an agent-callable tool (`scan_code`) for on-demand code safety scanning

It detects:

- **Injection** -- `eval()`, `exec()`, `os.system()`, dynamic code execution
- **SQL injection** -- string concatenation in SQL queries, format-string injection
- **XSS** -- `innerHTML`, `document.write`, `dangerouslySetInnerHTML`
- **Path traversal** -- unsanitized `../` in file paths, user-input path construction
- **Hardcoded secrets** -- AWS keys, passwords, tokens, private keys in code
- **Weak cryptography** -- MD5/SHA1 for passwords, `Math.random()` for security
- **Insecure deserialization** -- `pickle.loads()`, `yaml.load()` without SafeLoader
- **SSRF** -- unvalidated URL construction from user input
- **Incorrect permissions** -- `chmod 777`, world-writable files

All detection is stateless and synchronous via compiled regex patterns. No ML models, no network calls, no external dependencies.

---

## Installation

```bash
npm install @framers/agentos-ext-code-safety
```

No additional dependencies required.

---

## Usage

### Direct factory usage

```typescript
import { AgentOS } from '@framers/agentos';
import { createCodeSafetyGuardrail } from '@framers/agentos-ext-code-safety';

const codeSafetyPack = createCodeSafetyGuardrail({
  severityActions: {
    critical: 'block',
    high: 'block',
    medium: 'flag',
    low: 'flag',
  },
});

const agentos = await AgentOS.create({
  extensionManifest: { packs: [{ factory: () => codeSafetyPack }] },
});
```

### Manifest-based loading

```typescript
const agentos = await AgentOS.create({
  extensionManifest: {
    packs: [
      {
        package: '@framers/agentos-ext-code-safety',
        options: {
          disabledRules: ['weak-crypto-hash'], // allow MD5 for non-security use
          guardrailScope: 'output',
        },
      },
    ],
  },
});
```

---

## Language-Aware Patterns

Rules have per-language regex variants. The universal `'*'` key matches in any language. Language-specific keys add patterns that only apply when that language is detected.

When scanning Python code, both `'*'` and `'python'` patterns run. When the language cannot be determined, only universal `'*'` patterns apply.

### Supported Languages

Python, JavaScript/TypeScript, SQL, Ruby, PHP, Bash, Go, Java.

### Language Detection

1. **Fence tag** -- extracted from markdown code fence (e.g., ` ```python `)
2. **Keyword heuristics** -- when no fence tag is present, detected via patterns:
   - Python: `def name(`/`from ... import`/a top-level `import`/an indented block after a colon
   - SQL: `SELECT`/`INSERT INTO`/`CREATE TABLE`/`UPDATE ... SET`/`DROP TABLE`
   - Ruby: `class Foo < Bar`/`.each do |x|`/`#{...}` interpolation/a line ending in `end`
   - PHP: `<?php`/`$variable =`
   - Bash: shebang/`if [`/`echo "`/`$(cmd`
   - Go: `package name`/`func name(`/`fmt.Print`
   - Java: `public class`/`System.out.`/`import java.`
   - JavaScript: `function name(`/`const x =`/`=>`/`require(`/`console.`

   The checks run in that order and the first match wins. A fence tag of `ts` or `tsx` selects `typescript` patterns; unfenced TypeScript is detected as `javascript`.

---

## Code Fence Extraction

The guardrail extracts code blocks from markdown text using a lightweight fence parser:

```markdown
Here is some code:

` ` `python
import os
os.system("rm -rf /")
` ` `

This text is not scanned.
```

Only content inside triple-backtick fences is scanned. Non-code text passes through with zero overhead.

---

## Default Rules (25 rules)

### Injection (5 rules)

| Rule ID                      | Severity | What It Detects                                                        |
| ---------------------------- | -------- | ---------------------------------------------------------------------- |
| `code-injection-eval`        | critical | `eval()`, `exec()`, `compile()`, `new Function()`, `setTimeout("...")` |
| `command-injection-system`   | critical | `os.system()`, `subprocess.call(shell=True)`, `system()`               |
| `command-injection-backtick` | high     | Backtick execution in Ruby/Perl/Bash, `$(...)` command substitution    |
| `code-injection-template`    | medium   | Template literals inside eval/Function, f-strings in exec              |
| `unsafe-reflection`          | medium   | `Class.forName(userInput)`, `getattr(obj, userInput)`                  |

### SQL Injection (3 rules)

| Rule ID                  | Severity | What It Detects                                                                     |
| ------------------------ | -------- | ----------------------------------------------------------------------------------- |
| `sql-injection-concat`   | critical | String concatenation in SQL: `"SELECT * FROM " + var`, f-strings, template literals |
| `sql-injection-format`   | high     | `.format()` or `%s` in SQL strings                                                  |
| `sql-injection-keywords` | high     | `' OR 1=1`, `UNION SELECT`, `; DROP TABLE` in string literals                       |

### XSS (3 rules)

| Rule ID               | Severity | What It Detects                                             |
| --------------------- | -------- | ----------------------------------------------------------- |
| `xss-innerhtml`       | high     | `.innerHTML =`, `v-html=`, `[innerHTML]=`                   |
| `xss-document-write`  | high     | `document.write()`, `document.writeln()`                    |
| `xss-dangerously-set` | medium   | `dangerouslySetInnerHTML` (flagged for review, not blocked) |

### Path Traversal (2 rules)

| Rule ID                     | Severity | What It Detects                                             |
| --------------------------- | -------- | ----------------------------------------------------------- |
| `path-traversal-dotdot`     | high     | `../` repeated 2+ times in string literals, `..\\`          |
| `path-traversal-user-input` | medium   | `path.join(userInput`, `os.path.join(request.`, `open(user` |

### Secrets (4 rules)

| Rule ID                 | Severity | What It Detects                                                                |
| ----------------------- | -------- | ------------------------------------------------------------------------------ |
| `hardcoded-aws-key`     | critical | `AKIA[0-9A-Z]{16}` pattern                                                     |
| `hardcoded-password`    | high     | `password = "..."`, `passwd =`, `secret = "..."`                               |
| `hardcoded-token`       | high     | `Bearer eyJ`, `token = "eyJ..."`, `api_key = "..."` with 20+ chars             |
| `hardcoded-private-key` | critical | PEM `BEGIN ... PRIVATE KEY` headers: plain, `RSA`, `EC`, `DSA` and `OPENSSH`   |

### Crypto (2 rules)

| Rule ID            | Severity | What It Detects                                                      |
| ------------------ | -------- | -------------------------------------------------------------------- |
| `weak-crypto-hash` | medium   | `md5()`, `sha1()`, `hashlib.md5`, `hashlib.sha1` in password context |
| `insecure-random`  | medium   | `Math.random()` in security context, `random.random()` for tokens    |

### Deserialization (2 rules)

| Rule ID           | Severity | What It Detects                                      |
| ----------------- | -------- | ---------------------------------------------------- |
| `insecure-pickle` | critical | `pickle.loads()`, `pickle.load()`, `cPickle.loads()` |
| `insecure-yaml`   | high     | `yaml.load()` without `Loader=SafeLoader`            |

### SSRF (2 rules)

| Rule ID                | Severity | What It Detects                                                         |
| ---------------------- | -------- | ----------------------------------------------------------------------- |
| `ssrf-unvalidated-url` | high     | `fetch(userInput)`, `requests.get(user_`, `urllib.request.urlopen(user` |
| `ssrf-redirect-follow` | medium   | `redirect: 'follow'` with dynamic URL                                   |

### Permissions (2 rules)

| Rule ID          | Severity | What It Detects                                   |
| ---------------- | -------- | ------------------------------------------------- |
| `world-writable` | high     | `chmod 777`, `os.chmod(path, 0o777)`              |
| `insecure-tmp`   | low      | `open('/tmp/...)` without `tempfile` or `mkstemp` |

---

## Tool Call Scanning

The guardrail's `evaluateOutput()` scans the code argument of a `TOOL_CALL_REQUEST` chunk that targets a registered code-executing tool. The AgentOS guardrail dispatcher passes output guardrails only TEXT_DELTA chunks (to guardrails with streaming evaluation, as this one has) and the chunks that carry `isFinal: true`, so a TOOL_CALL_REQUEST in an AgentOS stream never reaches it and tool arguments are not scanned there. A host that calls `evaluateOutput()` with such a chunk itself gets the scan, with the mapping below.

### Default Tool Mapping

| Tool Name       | Argument Key | Default Language |
| --------------- | ------------ | ---------------- |
| `shell_execute` | `command`    | `bash`           |
| `run_sql`       | `query`      | `sql`            |
| `write_file`    | `content`    | auto-detect      |
| `create_file`   | `content`    | auto-detect      |
| `edit_file`     | `content`    | auto-detect      |

### Custom Tool Mapping

```typescript
const pack = createCodeSafetyGuardrail({
  codeExecutingTools: ['shell_execute', 'run_sql', 'my_custom_tool'],
  codeArgumentMapping: {
    my_custom_tool: { argKey: 'script', language: 'python' },
  },
});
```

---

## Custom Rules

Add custom rules using the `ICodeSafetyRule` interface (`src/types.ts` of [`@framers/agentos-ext-code-safety`](https://www.npmjs.com/package/@framers/agentos-ext-code-safety)):

```typescript
interface ICodeSafetyRule {
  id: string;
  name: string;
  description: string;
  category: CodeSafetyCategory;
  severity: 'critical' | 'high' | 'medium' | 'low';
  patterns: Record<string, RegExp[]>; // '*' = universal, 'python' = Python-only, etc.
  action?: 'flag' | 'block'; // override severity-to-action mapping
}
```

Example:

```typescript
const pack = createCodeSafetyGuardrail({
  customRules: [
    {
      id: 'my-custom-rule',
      name: 'Unsafe Database Connection',
      description: 'Detects hardcoded database connection strings',
      category: 'secrets',
      severity: 'high',
      patterns: {
        '*': [/mongodb:\/\/[^:]+:[^@]+@/i, /postgres:\/\/[^:]+:[^@]+@/i],
      },
    },
  ],
});
```

---

## Configuration

### `CodeSafetyPackOptions`

| Option                | Type                                   | Default                                                                  | Description                                                               |
| --------------------- | -------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `customRules`         | `ICodeSafetyRule[]`                    | `[]`                                                                     | Custom rules to add alongside defaults.                                   |
| `includeDefaultRules` | `boolean`                              | `true`                                                                   | Whether to include the 25 default rules. Set to `false` for custom-only.  |
| `disabledRules`       | `string[]`                             | `[]`                                                                     | Rule IDs to disable from the default set.                                 |
| `severityActions`     | `Partial<Record<severity, action>>`    | `{ critical: 'block', high: 'block', medium: 'flag', low: 'flag' }`      | Action mapping by severity.                                               |
| `codeExecutingTools`  | `string[]`                             | `['shell_execute', 'run_sql', 'write_file', 'create_file', 'edit_file']` | Tools whose arguments should be scanned.                                  |
| `codeArgumentMapping` | `Record<string, { argKey, language }>` | see defaults above                                                       | Maps tool names to code argument key and language.                        |
| `guardrailScope`      | `'output'`                             | `'output'`                                                               | The only accepted value; `evaluateInput()` scans fenced code in user input regardless. |

---

## Agent Tools

### `scan_code`

On-demand code safety scanning. Lets agents proactively check code before writing to files, executing, or presenting to users.

```
Agent: Let me check this code for security issues before writing it.
-> scan_code({ code: "eval(user_input)", language: "python" })
<- output: {
    safe: false,
    violations: [
      {
        ruleId: 'code-injection-eval',
        ruleName: 'Unsafe eval() / exec() usage',
        category: 'injection',
        severity: 'critical',
        matchedText: 'eval(',
        language: 'python',
        action: 'block'
      }
    ],
    blocksScanned: 1,
    summary: "1 violation(s) in 1 block(s): 1×critical — BLOCKED"
  }
```

---

## Memory Impact

| Component                  | Held                                                   | When Loaded      |
| -------------------------- | ------------------------------------------------------ | ---------------- |
| Rules (25 default regexes) | The compiled patterns of the active rules              | Pack load        |
| Per-stream fence buffer    | The streamed text of a stream until its fence closes   | First TEXT_DELTA |

The pack loads no model.

---

## Graceful Degradation

| Condition                             | Behavior                                                |
| ------------------------------------- | ------------------------------------------------------- |
| No rules configured (empty set)       | Guardrail is a no-op, returns null                      |
| No code fences in text                | Zero-cost passthrough (no scanning performed)           |
| Unknown language                      | Only universal `'*'` patterns applied                   |
| Tool call for non-code-executing tool | Skipped (not in `codeExecutingTools` list)              |

---

## Related Documentation

- [Guardrails](/features/guardrails)
- [Extension Architecture](/extensions/extension-architecture)
- [Extensions Overview](/extensions)
- [PII Redaction](/extensions/built-in/pii-redaction)
- [ML Content Classifiers](/extensions/built-in/ml-classifiers)
- [Topicality](/extensions/built-in/topicality)
- [Grounding Guard](/extensions/built-in/grounding-guard)
