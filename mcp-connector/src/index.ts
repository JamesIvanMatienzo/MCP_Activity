import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as path from "path";
import express from "express";
import { fileTools, handleFileToolCall } from "./tools/file_ops.js";

// 1. Initialize the MCP Server
const server = new Server(
  {
    name: "file-server-connector",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_DIR = path.resolve(__dirname, "../../workspace");
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN || "super-secret-token";

function resolveAndValidatePath(unsafePath: string): string {
  const absolutePath = path.resolve(WORKSPACE_DIR, unsafePath);
  if (!absolutePath.startsWith(WORKSPACE_DIR)) {
    throw new Error(`Path traversal detected: ${unsafePath} is outside the workspace.`);
  }
  return absolutePath;
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: fileTools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    if (fileTools.some(t => t.name === name)) {
      return await handleFileToolCall(name, args, resolveAndValidatePath);
    }
  } catch (error: any) {
    return { isError: true, content: [{ type: "text", text: error.message }] };
  }
  throw new Error(`Tool not found: ${name}`);
});

// 4. Start the Server (Support both STDIO and SSE)
async function run() {
  if (!fs.existsSync(WORKSPACE_DIR)) {
    fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
  }

  // If MCP_TRANSPORT is set to 'stdio' or no PM2/PORT is found, default to stdio for Claude Desktop
  const useStdio = process.env.MCP_TRANSPORT === "stdio" || !process.env.PM2_HOME;

  if (useStdio) {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MCP File Server Connector running on stdio");
  } else {
    const app = express();
    app.use((req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || authHeader !== `Bearer ${AUTH_TOKEN}`) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      next();
    });

    let transport: SSEServerTransport;
    app.get("/sse", async (req, res) => {
      transport = new SSEServerTransport("/messages", res);
      await server.connect(transport);
    });

    app.post("/messages", async (req, res) => {
      if (!transport) return res.status(400).send("SSE connection not established");
      await transport.handlePostMessage(req, res);
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`MCP File Server Connector listening on port ${PORT} (SSE Mode)`);
    });
  }
}

run().catch(console.error);
