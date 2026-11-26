# Claude subscription budget (CSB 1.0, Golden Path GP-32)

Standard: sgps-core `standards/finops/CLAUDE_SUBSCRIPTION_BUDGET_STANDARD.md`. Fill one row per scheduled task of this project. Update when a task is added, removed or changed.

As of: `<YYYY-MM-DD HH:mm GMT+7>` · project default model: `<model>` · last audit: `<file or NOT_VERIFIED>`

| Scheduled task | Class (script / machine / judgment) | Model (explicit) | Session (fresh / persistent) | Cadence | Free pre-check (CSB-03) | Quota guard step 0 (CSB-04) |
|---|---|---|---|---|---|---|
| `<name>` | script | `claude-haiku-5-5` | fresh | daily 07:31 | `<command>` | yes |

Grunt work routes through the project worker (free pool → Go/Mistral → Claude API) before any subscription subagent (CSB-05): `<worker path or NOT_APPLICABLE>`.

Open findings from the last `sgps-sub-budget.mjs audit` and who owns each: `<list or none>`.
