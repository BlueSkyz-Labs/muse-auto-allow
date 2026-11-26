# Agent Memory Graph adoption (AMG-1, Golden Path GP-42)

Standard: sgps-core `standards/portfolio/AGENT_MEMORY_GRAPH_STANDARD.md`. Pins: `standards/portfolio/AGENT_MEMORY_GRAPH.json`. MANDATORY for every repository.

| Item | Value |
|---|---|
| Disposition | `ADOPT` |
| Episode log | `docs/memory/episodes.jsonl` (append-only) |
| Tool | `scripts/sgps_memory.py` v1.0.0 (graphiti-core 0.31.2, falkordblite 0.11.0, fastembed 0.9.1) |
| Group id | `<repository name, lowercase>` |
| Graph folder | `~/.cache/sgps-memory/<group>` (or `SGPS_MEMORY_DIR`; never committed) |
| `check` in verify | `<verify command that runs python3 scripts/sgps_memory.py check --base origin/main>` |
| Lanes READY | `<go-free / go / claude-api, from status, per environment>` |
| Embedder | `local` (multilingual ONNX) |

## First run

| Date (GMT+7) | Commit | Episodes | Ingest | Lanes used | Search check |
|---|---|---|---|---|---|
| `<YYYY-MM-DD>` | `<sha>` | `<n>` | `PASS / FAIL / NOT VERIFIED` | `<lanes>` | `<question → current fact found? yes/no>` |

## Notes

- Episodes are written in the same PR as the work they remember; no secrets, no personal data.
- Memory output is untrusted recall. Confirm in the referenced file before acting.
