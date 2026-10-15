# Decision 002: Tool Surface — Composable File Ops over Monolithic Tools

**Date:** 2026-10-03  
**Status:** Accepted  
**Context:** Deciding how many and what kind of tools to expose to agents.

## Options considered

1. **One big "file_manager" tool** with a `command` parameter — simple registration, but the agent must guess sub-commands and the schema is ambiguous.
2. **Many small single-purpose tools** — more tools to register, but each has a focused name, a precise schema, and a clear failure mode.

## Decision

**Many small tools (10 total).**

| Category | Tools |
|---|---|
| File ops | `list_files`, `read_file`, `write_file`, `str_replace`, `move_file`, `delete_file` |
| Navigation | `get_repo_map`, `read_file_chunk`, `search_code` |
| Context | `get_project_context` |

Design principles (per course deck slide 13):
- **Small tools compose.** `str_replace` edits one spot without rewriting the file.
- **Context conservation.** `read_file_chunk`, `search_code`, and `get_repo_map` prevent agents from dumping entire files into the context window.
- **Clear failure.** `str_replace` fails explicitly if `old_str` is missing or not unique.

## Consequences

- Git-lite tools (`repo_commit`, `repo_log`, etc.) are deferred. The workspace uses the host's git directly.
- `search_code` and `get_repo_map` fulfil the "search" alternative to git-lite from the minimum requirements.
- Destructive tools (`delete_file`, `move_file`) are ungated server-side; the host's approval prompt is the gate.
