/**
 * AI Agent Tool Types and Interfaces
 *
 * This file defines the TypeScript interfaces and types for AI agent tools
 * that enable agentic coding capabilities.
 */

/**
 * Base interface for all AI agent tools
 * Each tool must have a name, description, and execute function
 */
export interface AgentTool {
  /** Unique identifier for the tool */
  name: string;

  /** Human-readable description of what the tool does */
  description: string;

  /** JSON schema defining the parameters this tool accepts */
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };

  /** Execute the tool with given parameters and return result */
  execute: (params: any) => Promise<ToolResult>;
}

/**
 * Standard result format for all tool executions
 * Provides consistent success/error handling and data return
 */
export interface ToolResult {
  /** Whether the tool execution was successful */
  success: boolean;

  /** The main data returned by the tool */
  data?: any;

  /** Error message if execution failed */
  error?: string;

  /** Additional metadata about the execution */
  metadata?: {
    executionTime?: number;
    [key: string]: any;
  };
}

/**
 * File system operation parameters
 */
export interface FileSystemParams {
  /** File or directory path */
  path: string;

  /** File content (for write operations) */
  content?: string;

  /** Whether to include file contents when listing directories */
  includeContent?: boolean;

  /** Whether to recursively traverse subdirectories */
  recursive?: boolean;
}

/**
 * Code execution parameters
 */
export interface CodeExecutionParams {
  /** Programming language (currently supports 'python') */
  language: "python";

  /** Code to execute */
  code: string;

  /** Optional files to include in execution context */
  files?: Array<{
    path: string;
    content: string;
  }>;

  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/**
 * Code execution result
 */
export interface CodeExecutionResult {
  /** Standard output from code execution */
  stdout: string;

  /** Standard error from code execution */
  stderr: string;

  /** Execution time in milliseconds */
  executionTime: number;

  /** Whether execution completed successfully */
  success: boolean;

  /** Any runtime errors */
  error?: string;
}

/**
 * Code editing parameters
 */
export interface CodeEditingParams {
  /** File path to edit */
  filePath: string;

  /** Type of edit operation */
  operation: "replace" | "insert" | "delete" | "append" | "prepend";

  /** Content to insert/replace/append/prepend */
  content?: string;

  /** For replace operations: the text to find and replace */
  findText?: string;

  /** For insert/delete operations: line number (1-based) */
  lineNumber?: number;

  /** For insert/delete operations: character position */
  position?: number;

  /** For delete operations: number of characters to delete */
  length?: number;
}

/**
 * Workspace management parameters
 */
export interface WorkspaceParams {
  /** Operation type */
  operation: "create" | "delete" | "rename" | "move" | "copy";

  /** Source path */
  sourcePath: string;

  /** Target path (for move/copy/rename operations) */
  targetPath?: string;

  /** New name (for rename operations) */
  newName?: string;

  /** Type of item being created */
  type?: "file" | "folder";
}

/**
 * Directory listing result
 */
export interface DirectoryListing {
  /** Directory path */
  path: string;

  /** List of files and subdirectories */
  entries: Array<{
    name: string;
    type: "file" | "folder";
    path: string;
    size?: number;
    content?: string;
    children?: DirectoryListing["entries"];
  }>;

  /** Total number of entries */
  totalCount: number;
}

/**
 * Agent tool registry interface
 */
export interface AgentToolRegistry {
  /** Register a new tool */
  register: (tool: AgentTool) => void;

  /** Get a tool by name */
  get: (name: string) => AgentTool | undefined;

  /** Get all registered tools */
  getAll: () => AgentTool[];

  /** Execute a tool by name with parameters */
  execute: (name: string, params: any) => Promise<ToolResult>;

  /** Check if a tool is registered */
  has: (name: string) => boolean;
}
