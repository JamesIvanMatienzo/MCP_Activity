# MCP File-Server Connector

A sandboxed **Model Context Protocol (MCP) server** that gives AI agents persistent file storage and a handoff protocol for multi-session work. Built for the **CS 3A / CS 3B Elective, Week 06: Model Context Protocol (Agentic AI II, Tool Use & Orchestration)**, as the *Midterms Pt 1* project.

---

## Why it exists

| Problem | How the connector addresses it |
|---|---|
| **Agents forget.** Every new chat starts blank. | Files persist on the server across sessions and devices. |
| **Agents need a safe place to work.** | Everything lives under one workspace root; tool paths are relative to it. |
| **Different agents and apps need the same files.** | Any MCP-compatible client can connect and share the same project files. |

---

## Architecture

```
Local:   MCP client  ──JSON-RPC (stdio)──>  Node.js MCP server  ──fs──>  workspace/

Remote:  MCP client  ──HTTPS──>  ngrok tunnel  ──HTTP──>  Node.js MCP server  ──fs──>  workspace/
                                 (static domain)          (kept alive by pm2)
```

| Property | Value |
|---|---|
| Runtime | Node.js (compiled output at `build/index.js`) |
| Language | TypeScript 7.0.2 |
| MCP SDK | `@modelcontextprotocol/sdk` v1.32.0 |
| HTTP framework | Express 5.2.1 (SSE transport endpoints) |
| Input validation | JSON Schema via SDK `inputSchema` on every tool |
| Tunnel (HTTPS) | `@ngrok/ngrok` v1.7.0 (programmatic, Node SDK) |
| Process manager | pm2 v7.0.4 |
| Environment config | `dotenv` v18.0.5 (loads `.env` for secrets) |
| Build command | `npm run build` → `tsc` |
| Primitives used | Tools only |
| Tools exposed | 10 |

---

## Tools

All paths are **relative to the workspace root**.

| Tool | Parameters | Purpose |
|---|---|---|
| `list_files` | `targetPath?` (default: root) | List files and directories at a path |
| `read_file` | `targetPath` | Read a whole file |
| `read_file_chunk` | `targetPath`, `startLine`, `endLine` | Read specific lines (1-indexed, inclusive) |
| `write_file` | `targetPath`, `content` | Write content to a file, overwriting if it exists |
| `str_replace` | `targetPath`, `old_str`, `new_str` | Replace exactly one occurrence; fails if not found or not unique |
| `move_file` | `sourcePath`, `destinationPath` | Rename or move a file or directory |
| `delete_file` | `targetPath` | Delete a file |
| `search_code` | `query` | Exact-string search across workspace (skips `node_modules`, `.git`) |
| `get_repo_map` | none | Tree of all files in the workspace |
| `get_project_context` | none | Read `PROJECT_STATE.md` to orient a new session |

**Design principle:** small tools that compose beat one giant tool. `str_replace` edits one spot without rewriting the file. `read_file_chunk`, `search_code`, and `get_repo_map` keep agents from dumping entire files into context.

---

## Workspace layout

```
workspace/
├── PROJECT_STATE.md                      # current truth, rewritten each session
├── PLAN_LOG/
│   └── 001_fibonacci_plan.md             # plan written before acting
├── CHECKPOINTS/
│   ├── checkpoint_01.md                  # planning complete
│   └── checkpoint_02.md                  # implementation complete
├── DECISIONS/
│   ├── 001_fibonacci_algorithm.md        # iterative algorithm choice
│   └── 002_tool_surface_design.md        # composable tools rationale
├── fibonacci.py                          # demo deliverable
└── test_fibonacci.py                     # demo tests (5/5 pass)
```

---

## Handoff protocol

When several agent sessions share one workspace, they need a protocol or they overwrite each other. The loop:

```
READ STATE ──> LOG PLAN ──> ACT ──> CHECKPOINT ──┐
     ^                                            │
     └────────────────────────────────────────────┘
```

1. **Read state:** call `get_project_context` at session start.
2. **Log the plan:** write `PLAN_LOG/NNN_name.md` before changing anything.
3. **Act:** read before writing; prefer `str_replace` and chunked reads over full rewrites.
4. **Checkpoint:** write `CHECKPOINTS/checkpoint_NN.md` and update `PROJECT_STATE.md`.

| Path | Role | Written when |
|---|---|---|
| `PROJECT_STATE.md` | Current truth; rewritten each session | Start and end of a session |
| `PLAN_LOG/` | Numbered plans | Before acting |
| `CHECKPOINTS/` | Numbered progress records | At handoff |
| `DECISIONS/` | Append-only decision record | When a decision is made |

---

## Demo task: Fibonacci

An agent used the protocol above to build a small Python script across **2 sessions** (16 tool calls total). Full transcript: [`TRANSCRIPT.md`](TRANSCRIPT.md).

**Timeline:**

| Step | Session | Artifact | Result |
|---|---|---|---|
| 1. Inspect | 1 | — | Workspace was empty |
| 2. Plan | 1 | `PLAN_LOG/001_fibonacci_plan.md` | Six-step plan with design decisions |
| 3. Checkpoint 01 | 1 | `CHECKPOINTS/checkpoint_01.md` | Planning complete |
| 4. Implement | 1 | `fibonacci.py`, `test_fibonacci.py` | Written per plan |
| 5. Re-orient | 2 | — | `get_project_context` called at session start |
| 6. Verify | 2 | — | 5/5 tests pass; CLI prints expected output |
| 7. Checkpoint 02 | 2 | `CHECKPOINTS/checkpoint_02.md` | Implementation complete |

```
$ python fibonacci.py 10
0 1 1 2 3 5 8 13 21 34
```

- `n = 0` prints an empty line.
- Negative `n` exits with code 2 and the message `n must be non-negative`.
- **Tests** (`unittest`, 5 cases): run from the workspace root with `python -m unittest`.

---

## Setup

### Prerequisites

- Node.js (v18+)
- Claude Desktop (or any MCP-compatible client)
- Python 3.10+ (for the demo task)

### Install and build

```bash
cd mcp-connector
npm install
npm run build
```

### Run path-escape tests

```bash
npm test
```

All 14 tests should pass, covering safe paths, traversal attacks, and the sibling-prefix edge case.

### Register with Claude Desktop (local, stdio)

Claude Desktop → **Settings → Developer → Edit config**:

```json
{
  "mcpServers": {
    "file-server": {
      "command": "node",
      "args": ["<absolute-path-to>/mcp-connector/build/index.js"]
    }
  }
}
```

Restart Claude Desktop. The server should show **Running**.

### Deploy remotely (HTTPS + pm2)

1. Copy `.env.example` to `.env` and fill in your `NGROK_AUTHTOKEN` and `MCP_AUTH_TOKEN`.
2. Start with pm2:
   ```bash
   MCP_TRANSPORT=sse npm run start
   ```
   Or directly:
   ```bash
   MCP_TRANSPORT=sse pm2 start build/index.js --name mcp-server
   ```
3. The server will start on port 3000 (configurable via `PORT`), create an ngrok tunnel, and print the public HTTPS URL.
4. Configure your remote MCP client to connect to `https://<ngrok-url>/sse` with `Authorization: Bearer <your-token>`.

---

## Security

| Threat | Risk | Mitigation | Status |
|---|---|---|---|
| **Path traversal** | `../../etc` escapes the sandbox | `resolveAndValidatePath` resolves, normalises, and rejects. Separator-appended prefix check prevents sibling-prefix attacks. | ✅ Implemented + 14 automated tests |
| **Over-privileged tools** | Each extra tool widens the blast radius | 10 focused tools; destructive tools gated by host approval prompts | ✅ Minimal surface |
| **Open public endpoint** | Tunnel URL reachable by anyone | Bearer token required on every HTTP request; loaded from `.env` | ✅ Implemented |
| **Prompt injection** | File content carries instructions aimed at the agent | Treat tool output as data, never as orders | ⚠️ Agent-side practice |

Secrets belong in environment variables (`.env`), never hardcoded or committed. The file tools cannot reach the server's own code, so an agent cannot modify or redeploy the server.

---

## Requirements checklist

| # | Requirement | Status |
|---|---|---|
| 1 | Sandboxed workspace root; escapes rejected | ✅ `resolveAndValidatePath` + 14 path-escape tests (`npm test`) |
| 2 | At least 8 tools: file ops + git-lite or search | ✅ 10 tools (file ops + `search_code`, `get_repo_map`, `read_file_chunk`) |
| 3 | Served over HTTPS via tunnel, kept alive by process manager | ✅ `@ngrok/ngrok` + pm2 (see `package.json` scripts) |
| 4 | Handoff protocol: PROJECT_STATE, PLAN_LOG, CHECKPOINTS, DECISIONS | ✅ All four present in `workspace/` |
| 5 | Connected to real MCP client; multi-step task across 2+ sessions | ✅ Claude Desktop; Fibonacci task across 2 sessions ([`TRANSCRIPT.md`](TRANSCRIPT.md)) |
| 6 | Short report: stack, tool design, security tradeoffs | ✅ [`REPORT.md`](REPORT.md) |

**Stretch goals:** `search_code` ✅ · `get_repo_map` ✅ · token auth ✅ · `if_version` locking ☐

**Deliverables:**
- Working repository ✅
- README (this file) ✅
- Tool-call transcript ([`TRANSCRIPT.md`](TRANSCRIPT.md)) ✅
- Short report ([`REPORT.md`](REPORT.md)) ✅
- 5-minute live demo at Week 7 midterm checkpoint

---

## Troubleshooting

| Symptom | Likely cause | What to do |
|---|---|---|
| Server shows running but no tool indicator in chat | Not enabled for the current chat | Start a new chat, check the tools menu, or restart Claude Desktop |
| A tool call hangs then times out | Pending approval prompt in Claude Desktop | Check for the prompt and approve it; restart if it persists |
| `str_replace` fails | `old_str` not found or matches more than once | Re-read the file and widen `old_str` with surrounding text |
| Agent starts "from scratch" | Did not read project state | Have it call `get_project_context` first |
| Server won't start | Wrong path or `build/` out of date | Check logs, rebuild with `npm run build`, confirm path |
| ngrok tunnel fails | Missing or invalid `NGROK_AUTHTOKEN` | Set it in `.env`; see `.env.example` |

---

## Project structure

```
MCP/
├── README.md                          ← this file
├── REPORT.md                          ← technical report (Req 06)
├── TRANSCRIPT.md                      ← tool-call transcript (Req 05)
├── .gitignore
├── mcp-connector/                     ← server source
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   ├── src/
│   │   ├── index.ts                   ← server entry point
│   │   ├── tools/
│   │   │   └── file_ops.ts            ← 10 tool definitions + handlers
│   │   └── tests/
│   │       └── path_security.test.ts  ← 14 path-escape tests
│   └── build/                         ← compiled JS (gitignored)
└── workspace/                         ← sandboxed agent workspace
    ├── PROJECT_STATE.md
    ├── PLAN_LOG/
    ├── CHECKPOINTS/
    ├── DECISIONS/
    ├── fibonacci.py
    └── test_fibonacci.py
```
