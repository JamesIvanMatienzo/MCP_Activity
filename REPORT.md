# MCP File-Server Connector — Technical Report

**Project:** CS 3A / CS 3B Elective — Midterms Pt 1  
**Author:** James Ivan Matienzo  
**Date:** 2026-10-15

---

## 1. Technology Stack

### 1.1 Stack summary

| Layer | Choice | Version | Justification |
|---|---|---|---|
| **Runtime** | Node.js | v22+ | Mature async I/O runtime; first-class support from the official MCP SDK. |
| **Language** | TypeScript | 7.0.2 | Static types catch tool-schema mismatches at compile time, not at demo time. |
| **MCP SDK** | `@modelcontextprotocol/sdk` | 1.32.0 | Official Anthropic SDK; handles JSON-RPC framing, transport negotiation, and schema registration. |
| **HTTP framework** | Express | 5.2.1 | Lightweight; needed only for the SSE transport endpoints (`/sse`, `/messages`). |
| **Input validation** | JSON Schema (via SDK) | — | Each tool declares an `inputSchema` with `type`, `properties`, and `required`. The SDK validates incoming arguments against these schemas before the handler runs. |
| **Tunnel (HTTPS)** | `@ngrok/ngrok` (Node SDK) | 1.7.0 | Programmatic tunnel creation inside the server process; no separate CLI needed. Provides HTTPS with a static or ephemeral domain. |
| **Process manager** | pm2 | 7.0.4 | Automatic restart on crash, log rotation, and the `PM2_HOME` env var doubles as a transport-mode signal. |
| **Environment config** | `dotenv` | 18.0.5 | Loads `NGROK_AUTHTOKEN` and `MCP_AUTH_TOKEN` from `.env` without hardcoding secrets. |
| **Build** | `tsc` | 7.0.2 | Compiles `src/` to `build/` (ES module output). |
| **Version control** | git | — | Single initial commit plus iterative feature commits; hosted on GitHub. |

### 1.2 Why this stack over alternatives

| Alternative | Why not chosen |
|---|---|
| **Python + FastMCP** | Viable, but the TypeScript SDK is the reference implementation cited in the course deck. TypeScript's type system also catches schema errors that Python's duck typing would miss. |
| **Cloudflare Tunnel** | Requires a Cloudflare account and DNS delegation. Ngrok's Node SDK is a single `npm install` with no external binary. |
| **Docker** | Heavier than needed for a single-file server. PM2 gives crash recovery with zero container overhead. |
| **Zod validation** | The SDK already validates against JSON Schema `inputSchema`. Adding Zod would duplicate validation without clear benefit for 10 tools. |

---

## 2. Tool Design Choices

### 2.1 Design principles

1. **Small tools that compose** (slide 13). Each tool does one thing. `str_replace` edits one spot without rewriting the whole file. `read_file_chunk` reads a slice without blowing up the context window.

2. **Context conservation**. Three tools exist specifically to prevent agents from dumping entire file trees into their context:
   - `read_file_chunk` — read lines N to M only.
   - `search_code` — find which files contain a string, without reading them all.
   - `get_repo_map` — tree of filenames, zero file content.

3. **Clear failure modes**. `str_replace` fails explicitly if `old_str` is not found or matches more than once. Every handler returns `{ isError: true, content: [...] }` on failure so the agent can recover.

4. **Verb-noun naming**. `list_files`, `read_file`, `write_file`, `delete_file`, `move_file`, `search_code`, `get_repo_map`, `get_project_context`. Stable names that an agent can reason about.

### 2.2 Tool inventory (10 tools)

| # | Tool | Category | Why included |
|---|---|---|---|
| 1 | `list_files` | File ops | Basic navigation; first tool an agent calls. |
| 2 | `read_file` | File ops | Read whole file. |
| 3 | `write_file` | File ops | Create or overwrite a file. |
| 4 | `str_replace` | File ops | Surgical edit without full rewrite. |
| 5 | `delete_file` | File ops | Remove files. Destructive, gated by host prompts. |
| 6 | `move_file` | File ops | Rename or relocate. |
| 7 | `read_file_chunk` | Navigation | Partial read for large files. |
| 8 | `search_code` | Navigation | Exact-string search, replaces git-grep. |
| 9 | `get_repo_map` | Navigation | Full file tree without content. |
| 10 | `get_project_context` | Context | Reads `PROJECT_STATE.md` to orient a new session. |

### 2.3 Tools not included (and why)

| Tool | Reason deferred |
|---|---|
| `repo_commit`, `repo_log`, `repo_diff`, `repo_revert` | Git-lite tools require spawning `git` subprocesses. The minimum requirement is satisfied by `search_code` as the alternative. The host's git CLI handles version control directly. |
| `if_version` | Optimistic locking is a stretch goal. Until implemented, the protocol relies on single-writer discipline and re-reading `PROJECT_STATE.md`. |
| `next_sequence_number`, `get_current_time` | Nice-to-have utilities. Plan/checkpoint numbers are currently assigned by the agent; dates come from the model. |

---

## 3. Security Tradeoffs

### 3.1 Threat model

Giving an agent file access is giving it real power. The course deck (slide 14) identifies four threats:

| # | Threat | Risk | Mitigation | Status |
|---|---|---|---|---|
| 1 | **Path traversal** | `../../etc/passwd` escapes the sandbox | `resolveAndValidatePath` resolves every path against `WORKSPACE_DIR` and rejects anything outside | ✅ Implemented and tested (14/14 tests pass, including sibling-prefix attack) |
| 2 | **Over-privileged tools** | Each extra tool widens the blast radius | 10 focused tools; `delete_file` and `move_file` rely on the host's approval prompt | ✅ Minimal surface |
| 3 | **Open public endpoint** | Tunnel URL reachable by anyone | Bearer token required on every HTTP request; token loaded from `.env`, never logged to workspace | ✅ Implemented in SSE mode |
| 4 | **Prompt injection** | File content carries instructions aimed at the agent | Treat tool output as data, never as orders | ⚠️ Agent-side discipline; no server-side mitigation possible |

### 3.2 Sandbox implementation

```typescript
function resolveAndValidatePath(unsafePath: string): string {
  const normalizedWorkspace = path.resolve(WORKSPACE_DIR) + path.sep;
  const absolutePath = path.resolve(WORKSPACE_DIR, unsafePath);
  if (absolutePath !== path.resolve(WORKSPACE_DIR) &&
      !absolutePath.startsWith(normalizedWorkspace)) {
    throw new Error(`Path traversal detected: ...`);
  }
  return absolutePath;
}
```

Key design decisions:
- **`path.resolve` normalises** `..`, `.`, and mixed separators before comparison. No string manipulation on raw input.
- **Separator-appended prefix check** (`WORKSPACE_DIR + path.sep`) prevents the sibling-prefix attack where `workspace-evil` would pass a naive `startsWith(WORKSPACE_DIR)` check.
- **The workspace root itself is allowed** (for `list_files(".")` and `get_repo_map`).

### 3.3 Path-escape test evidence

14 automated tests in `src/tests/path_security.test.ts` (run via `npm test`):

| Category | Tests | Vectors covered |
|---|---|---|
| Safe paths | 4 | `.`, `fibonacci.py`, nested path, relative navigation that stays inside |
| Unsafe paths | 7+ | `..`, `../..`, `../../etc/passwd`, deep traversal, subdirectory bounce, sibling-prefix attack, absolute system path |

### 3.4 Authentication

In SSE/ngrok mode, every HTTP request must carry `Authorization: Bearer <token>`:

```typescript
app.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${AUTH_TOKEN}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});
```

- Token is read from `process.env.MCP_AUTH_TOKEN` (loaded via `dotenv` from `.env`).
- Falls back to a hardcoded default (`super-secret-token`) only for local development — **must be overridden in production**.
- The token is printed to the server console on startup (for operator use) but never written to workspace files.

### 3.5 Accepted risks

| Risk | Acceptance rationale |
|---|---|
| `delete_file` is ungated server-side | The host (Claude Desktop) prompts the user before every tool call. Adding server-side gating would require a separate approval channel. |
| `write_file` overwrites unconditionally | No optimistic locking (`if_version`). Mitigated by single-writer discipline and the handoff protocol. |
| Hardcoded fallback token | Acceptable for local stdio mode. The `.env` file is `.gitignore`d. |

### 3.6 What the sandbox cannot do

- **Execute code.** The server reads and writes files; it cannot run `python` or `node`. Tests were verified by the operator outside the sandbox.
- **Protect against the agent's own reasoning.** If the agent decides to `delete_file` everything, the server will comply (after host approval). The protocol mitigates this by checkpointing and logging plans before acting.

---

## 4. Architecture Diagram

```
┌──────────────────────────────────────────────────┐
│                  HOST APPLICATION                 │
│              (Claude Desktop / IDE)               │
│                                                   │
│   ┌─────────┐    JSON-RPC     ┌───────────────┐  │
│   │   LLM   │───────────────→ │  MCP Client   │  │
│   └─────────┘  tools/list     └───────┬───────┘  │
│                tools/call             │           │
└───────────────────────────────────────┼───────────┘
                                        │
                          stdio (local) │ HTTPS (remote)
                                        │
┌───────────────────────────────────────┼───────────┐
│             MCP SERVER (Node.js)      │           │
│                                       ▼           │
│   ┌──────────────────────────────────────────┐    │
│   │         Express + SSE Transport          │    │
│   │   Bearer token auth on every request     │    │
│   └────────────────────┬─────────────────────┘    │
│                        │                          │
│   ┌────────────────────▼─────────────────────┐    │
│   │        resolveAndValidatePath()          │    │
│   │   Normalise → prefix check → reject/allow│    │
│   └────────────────────┬─────────────────────┘    │
│                        │                          │
│   ┌────────────────────▼─────────────────────┐    │
│   │              10 Tool Handlers            │    │
│   │  list · read · write · str_replace ·     │    │
│   │  delete · move · chunk · search ·        │    │
│   │  repo_map · project_context              │    │
│   └────────────────────┬─────────────────────┘    │
│                        │ fs.*                     │
│                        ▼                          │
│              ┌─────────────────┐                  │
│              │   workspace/    │                  │
│              │  (sandboxed)    │                  │
│              └─────────────────┘                  │
│                                                   │
│   Tunnel: @ngrok/ngrok (HTTPS)                    │
│   Process manager: pm2                            │
└───────────────────────────────────────────────────┘
```

---

## 5. Conclusion

This connector satisfies all six minimum requirements: sandboxed workspace with tested path validation, 10 tools (file ops + search), HTTPS exposure via ngrok with PM2 keep-alive, a complete handoff protocol (PROJECT_STATE + PLAN_LOG + CHECKPOINTS + DECISIONS), a multi-session demo task on Claude Desktop, and this report. The primary tradeoff is simplicity over sophistication: no optimistic locking, no git-lite tools, and no server-side execution — all deliberate choices that keep the attack surface small and the codebase auditable.
