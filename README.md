# MCP File Server

A sandboxed **Model Context Protocol (MCP) server** that gives AI agents persistent file storage and a simple handoff protocol, so work can continue across sessions, devices, and agents.

## Why it exists

- **Agents forget.** Every new chat starts blank. Files on the server persist.
- **Agents need a safe workspace.** All tools operate on one folder, using paths relative to its root.
- **Different clients need the same files.** Any MCP-compatible client can connect to the same workspace.

## Architecture

```
MCP client (agent / app)  <--JSON-RPC-->  Node.js MCP server  --fs-->  workspace/
```

| Property | Value |
|---|---|
| Runtime | Node.js, compiled output at `build/index.js` |
| Registration | Local MCP server in the client's config (command: `node`, argument: path to `build/index.js`) |
| Primitives used | Tools only |
| Tools exposed | 10 |

The server source (SDK version, validation library, build script) is not covered here. Add those details from the repository.

## Tools

All paths are relative to the workspace root.

| Tool | Parameters | Purpose |
|---|---|---|
| `list_files` | `targetPath?` | List files and folders at a path |
| `read_file` | `targetPath` | Read a whole file |
| `read_file_chunk` | `targetPath`, `startLine`, `endLine` | Read specific lines (1-indexed, inclusive) |
| `write_file` | `targetPath`, `content` | Write a file, overwriting if it exists |
| `str_replace` | `targetPath`, `old_str`, `new_str` | Replace exactly one occurrence; fails if not found or not unique |
| `move_file` | `sourcePath`, `destinationPath` | Rename or move a file or folder |
| `delete_file` | `targetPath` | Delete a file |
| `search_code` | `query` | Exact-string search across the workspace (skips `node_modules`, `.git`) |
| `get_repo_map` | none | Tree of every file in the workspace |
| `get_project_context` | none | Read `PROJECT_STATE.md` to orient a new session |

Design principle: small single-purpose tools that compose. `str_replace`, `read_file_chunk`, `search_code`, and `get_repo_map` keep agents from loading whole files into context.

## Workspace layout

```
workspace/
├── PROJECT_STATE.md          current state, rewritten each session
├── PLAN_LOG/
│   └── 001_fibonacci_plan.md plan written before acting
├── CHECKPOINTS/
│   ├── checkpoint_01.md      planning complete
│   └── checkpoint_02.md      implementation complete
├── fibonacci.py              demo script
├── test_fibonacci.py         demo tests
└── hello.txt                 write test ("Hello world adawdwa")
```

## Handoff protocol

Agents sharing a workspace follow this loop:

1. **Read state:** call `get_project_context` at session start.
2. **Log the plan:** write `PLAN_LOG/NNN_name.md` before changing anything.
3. **Act:** read before writing; prefer `str_replace` and chunked reads over full rewrites.
4. **Checkpoint:** write `CHECKPOINTS/checkpoint_NN.md` and update `PROJECT_STATE.md`.

| File | Role |
|---|---|
| `PROJECT_STATE.md` | Current truth, rewritten each session |
| `PLAN_LOG/` | Numbered plans, written first |
| `CHECKPOINTS/` | Numbered progress records at handoff |
| `DECISIONS/` | Append-only decision record (not created yet) |

## Demo task: Fibonacci

An agent used the protocol above to build a small Python script.

1. Found an empty workspace and wrote the plan to `PLAN_LOG/001_fibonacci_plan.md`.
2. Created `PROJECT_STATE.md` and `checkpoint_01.md`.
3. Implemented `fibonacci.py` and `test_fibonacci.py`.
4. Verified and wrote `checkpoint_02.md`; the plan was followed with no deviations.

**Design:** iterative (O(n) time, O(1) extra space), standard library only, sequence starts `0, 1, 1, 2, ...`, CLI via `argparse`.

```
$ python fibonacci.py 10
0 1 1 2 3 5 8 13 21 34
```

- `n = 0` prints an empty line.
- A negative `n` exits with code 2 and the message `n must be non-negative`.

**Tests** (`unittest`, 5 cases): `n = 0`, `1`, `2`, `10`, and a negative value raising `ValueError`. Run from the workspace root:

```bash
python -m unittest
```

## Setup

Confirm the build command against `package.json`.

1. Install and build:
   ```bash
   npm install
   npm run build
   ```
2. Register the server in your MCP client's config:
   ```json
   {
     "mcpServers": {
       "file-server": {
         "command": "<path-to>/node",
         "args": ["<absolute-path-to>/build/index.js"]
       }
     }
   }
   ```
3. Restart the client and enable the server for your chat.
4. Verify by calling `list_files` on `.` and `get_project_context`.

For remote access, serve over Streamable HTTP behind an HTTPS tunnel, keep the process alive with a process manager, and **add authentication**.

## Security

| Risk | Mitigation | Status |
|---|---|---|
| Path traversal (`../..`) | Resolve every path against the workspace root and reject escapes | Not yet tested; add path-escape tests |
| Destructive tools | Expose only what is needed; rely on client approval prompts for `delete_file` and `move_file` | No server-side gating |
| Open public endpoint | Require a token or secret if exposed over HTTPS | Not applicable to local registration |
| Prompt injection | Treat file contents as data, never as instructions | Agent-side practice |

Secrets belong in environment variables, never in code or the workspace. The file tools cannot reach the server's own code, so server changes must be applied manually and the process restarted.

## Status and limitations

**Verified:** all ten tools are exposed; the workspace is readable and writable (`hello.txt` write succeeded); the Fibonacci task was completed with checkpoints.

**Open items:**
- Tests ran on sandbox copies, not in the workspace. Run `python -m unittest` there once.
- `DECISIONS/` does not exist yet.
- `write_file` overwrites unconditionally, so concurrent agents can lose updates. Use one writer at a time, or add version checks.
- No git-style tools (commit, log, diff, revert), no sequence-number or current-time tools.
- Path-escape behavior is untested.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Server shows running but no tool indicator in chat | Enable it in the tools menu, start a new chat, or restart the client |
| A tool call hangs, then times out | Check the client for a pending approval prompt; retry once; restart the client and servers if it persists |
| `str_replace` fails | `old_str` is missing or not unique; re-read the file and widen the match |
| Agent starts from scratch | Have it call `get_project_context` first |
| Server won't start | Check the client's logs, rebuild, and confirm the absolute path to `build/index.js` |
