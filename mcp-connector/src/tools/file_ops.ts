import * as fs from "fs";
import * as path from "path";
import { Tool } from "@modelcontextprotocol/sdk/types.js";

export const fileTools: Tool[] = [
  {
    name: "list_files",
    description: "List files and directories in a given path within the workspace.",
    inputSchema: {
      type: "object",
      properties: {
        targetPath: { type: "string", description: "Relative path to list (e.g., '.', 'src', 'docs'). Defaults to root of workspace." },
      },
    },
  },
  {
    name: "read_file",
    description: "Read the contents of a file within the workspace.",
    inputSchema: {
      type: "object",
      properties: {
        targetPath: { type: "string", description: "Relative path to the file to read." },
      },
      required: ["targetPath"],
    },
  },
  {
    name: "write_file",
    description: "Write content to a file, overwriting it if it exists.",
    inputSchema: {
      type: "object",
      properties: {
        targetPath: { type: "string", description: "Relative path to the file to write." },
        content: { type: "string", description: "Content to write to the file." },
      },
      required: ["targetPath", "content"],
    },
  },
  {
    name: "str_replace",
    description: "Replace one exact occurrence of old_str with new_str in a file. Fails if the match is not unique or not found.",
    inputSchema: {
      type: "object",
      properties: {
        targetPath: { type: "string", description: "Relative path to the file." },
        old_str: { type: "string", description: "Exact string to replace." },
        new_str: { type: "string", description: "String to replace with." },
      },
      required: ["targetPath", "old_str", "new_str"],
    },
  },
  {
    name: "delete_file",
    description: "Delete a file within the workspace.",
    inputSchema: {
      type: "object",
      properties: {
        targetPath: { type: "string", description: "Relative path to the file to delete." },
      },
      required: ["targetPath"],
    },
  },
  {
    name: "move_file",
    description: "Rename or move a file or directory within the workspace.",
    inputSchema: {
      type: "object",
      properties: {
        sourcePath: { type: "string", description: "Relative path of the source file." },
        destinationPath: { type: "string", description: "Relative path of the destination." },
      },
      required: ["sourcePath", "destinationPath"],
    },
  },
  {
    name: "read_file_chunk",
    description: "Read specific lines of a file (1-indexed). Useful for large files to avoid blowing up context.",
    inputSchema: {
      type: "object",
      properties: {
        targetPath: { type: "string", description: "Relative path to the file." },
        startLine: { type: "number", description: "Starting line number (1-indexed)." },
        endLine: { type: "number", description: "Ending line number (inclusive)." },
      },
      required: ["targetPath", "startLine", "endLine"],
    },
  },
  {
    name: "search_code",
    description: "Search for an exact string recursively across all files in the workspace (ignores node_modules, .git).",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "The string to search for." },
      },
      required: ["query"],
    },
  },
  {
    name: "get_repo_map",
    description: "Get a high-level tree visualization of all files in the workspace. Useful for navigation.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_project_context",
    description: "Read the PROJECT_STATE.md file from the workspace root to understand the current task and handoff state.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// Helper for search and repo map
function walkDir(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === "node_modules" || file === ".git") continue;
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      walkDir(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  }
  return fileList;
}

export async function handleFileToolCall(
  name: string,
  args: any,
  resolveAndValidatePath: (p: string) => string
): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
  
  if (name === "list_files") {
    const targetPath = args.targetPath || ".";
    const safePath = resolveAndValidatePath(targetPath);
    const entries = fs.readdirSync(safePath, { withFileTypes: true });
    const content = entries.map((e) => `${e.isDirectory() ? "[DIR]" : "[FILE]"} ${e.name}`).join("\n");
    return { content: [{ type: "text", text: content || "(empty directory)" }] };
  }
  
  if (name === "read_file") {
    const safePath = resolveAndValidatePath(args.targetPath);
    const content = fs.readFileSync(safePath, "utf-8");
    return { content: [{ type: "text", text: content }] };
  }
  
  if (name === "write_file") {
    const safePath = resolveAndValidatePath(args.targetPath);
    fs.mkdirSync(path.dirname(safePath), { recursive: true });
    fs.writeFileSync(safePath, args.content, "utf-8");
    return { content: [{ type: "text", text: `Successfully wrote to ${args.targetPath}` }] };
  }
  
  if (name === "str_replace") {
    const safePath = resolveAndValidatePath(args.targetPath);
    const content = fs.readFileSync(safePath, "utf-8");
    const occurrences = content.split(args.old_str).length - 1;
    if (occurrences === 0) return { isError: true, content: [{ type: "text", text: "Error: old_str not found in file." }] };
    if (occurrences > 1) return { isError: true, content: [{ type: "text", text: "Error: old_str occurs multiple times." }] };
    const newContent = content.replace(args.old_str, args.new_str);
    fs.writeFileSync(safePath, newContent, "utf-8");
    return { content: [{ type: "text", text: `Successfully replaced string in ${args.targetPath}` }] };
  }
  
  if (name === "delete_file") {
    const safePath = resolveAndValidatePath(args.targetPath);
    fs.unlinkSync(safePath);
    return { content: [{ type: "text", text: `Successfully deleted ${args.targetPath}` }] };
  }
  
  if (name === "move_file") {
    const safeSource = resolveAndValidatePath(args.sourcePath);
    const safeDest = resolveAndValidatePath(args.destinationPath);
    fs.mkdirSync(path.dirname(safeDest), { recursive: true });
    fs.renameSync(safeSource, safeDest);
    return { content: [{ type: "text", text: `Moved ${args.sourcePath} to ${args.destinationPath}` }] };
  }
  
  if (name === "read_file_chunk") {
    const safePath = resolveAndValidatePath(args.targetPath);
    const content = fs.readFileSync(safePath, "utf-8");
    const lines = content.split("\n");
    const chunk = lines.slice(args.startLine - 1, args.endLine).join("\n");
    return { content: [{ type: "text", text: chunk }] };
  }
  
  if (name === "search_code") {
    const workspacePath = resolveAndValidatePath(".");
    const allFiles = walkDir(workspacePath);
    const results: string[] = [];
    for (const f of allFiles) {
      const content = fs.readFileSync(f, "utf-8");
      if (content.includes(args.query)) {
        const relative = path.relative(workspacePath, f);
        results.push(`Found in ${relative}`);
      }
    }
    return { content: [{ type: "text", text: results.length > 0 ? results.join("\n") : "No matches found." }] };
  }
  
  if (name === "get_repo_map") {
    const workspacePath = resolveAndValidatePath(".");
    const allFiles = walkDir(workspacePath);
    const map = allFiles.map(f => path.relative(workspacePath, f)).join("\n");
    return { content: [{ type: "text", text: map || "(workspace empty)" }] };
  }

  if (name === "get_project_context") {
    const statePath = resolveAndValidatePath("PROJECT_STATE.md");
    if (!fs.existsSync(statePath)) {
      return { content: [{ type: "text", text: "No PROJECT_STATE.md found yet. Consider creating one." }] };
    }
    return { content: [{ type: "text", text: fs.readFileSync(statePath, "utf-8") }] };
  }
  
  throw new Error(`Unhandled tool: ${name}`);
}
