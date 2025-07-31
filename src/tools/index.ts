/**
 * AI Agent Tools - Main Export Module
 *
 * This module provides a comprehensive set of tools for AI agents to perform
 * agentic coding tasks, including file system operations, code execution,
 * code editing, and workspace management.
 */

// Export all types and interfaces
export type {
  AgentTool,
  ToolResult,
  AgentToolRegistry,
  ToolExecutionContext,
  FileSystemParams,
  CodeExecutionParams,
  CodeExecutionResult,
  CodeEditingParams,
  WorkspaceParams,
  DirectoryListing,
} from "./types";

// Export the main registry and utilities
export {
  agentToolRegistry,
  initializeAgentTools,
  createToolResponse,
  executeToolSequence,
  type ToolExecutionContext,
} from "./agentToolRegistry";

// Export tool collections
export {
  fileSystemTools,
  readDirectoryTool,
  readFileTool,
  writeFileTool,
} from "./fileSystemTools";

export {
  codeExecutionTools,
  executePythonTool,
  executeWithWorkspaceTool,
  runMainScriptTool,
  testCodeTool,
} from "./codeExecutionTools";

export { codeEditingTools, modifyTextTool } from "./codeEditingTools";

export {
  workspaceTools,
  createItemTool,
  deleteItemTool,
  renameItemTool,
  moveItemTool,
  copyItemTool,
} from "./workspaceTools";

/**
 * Tool Categories for easy reference
 */
export const TOOL_CATEGORIES = {
  FILESYSTEM: "filesystem",
  EXECUTION: "execution",
  EDITING: "editing",
  WORKSPACE: "workspace",
} as const;

/**
 * All available tool names grouped by category
 */
export const AVAILABLE_TOOLS = {
  [TOOL_CATEGORIES.FILESYSTEM]: ["read_directory", "read_file", "write_file"],
  [TOOL_CATEGORIES.EXECUTION]: [
    "execute_python",
    "execute_with_workspace",
    "run_main_script",
    "test_code",
  ],
  [TOOL_CATEGORIES.EDITING]: ["modify_text"],
  [TOOL_CATEGORIES.WORKSPACE]: [
    "create_item",
    "delete_item",
    "rename_item",
    "move_item",
    "copy_item",
  ],
} as const;
