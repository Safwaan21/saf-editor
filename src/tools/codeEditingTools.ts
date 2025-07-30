/**
 * Code Editing Tools for AI Agents
 *
 * These tools provide AI agents with the ability to edit and manipulate code,
 * including replacing text, inserting lines, and performing complex edits.
 */

import type { FileNode } from "../App";
import type { AgentTool, ToolResult, CodeEditingParams } from "./types";

/**
 * Utility function to find a file by path in FileNode tree
 */
function findFileByPath(
  nodes: FileNode[],
  targetPath: string
): FileNode | undefined {
  const pathParts = targetPath.split("/").filter((part) => part.length > 0);

  if (pathParts.length === 0) return undefined;

  let currentNodes = nodes;
  let currentNode: FileNode | undefined;

  for (let i = 0; i < pathParts.length; i++) {
    const partName = pathParts[i];
    currentNode = currentNodes.find((node) => node.name === partName);

    if (!currentNode) return undefined;

    if (i === pathParts.length - 1) {
      return currentNode;
    }

    if (currentNode.type !== "folder" || !currentNode.children) {
      return undefined;
    }

    currentNodes = currentNode.children;
  }

  return currentNode;
}

/**
 * Tool: Replace Text
 * Replaces specific text in a file with new content
 *
 * @param filePath - Path to the file to edit
 * @param findText - Text to find and replace
 * @param replaceText - Text to replace with
 * @returns Success status and edit information
 */
export const replaceTextTool: AgentTool = {
  name: "replace_text",
  description: "Replace specific text in a file with new content",
  parameters: {
    type: "object",
    properties: {
      filePath: {
        type: "string",
        description: "Path to the file to edit",
      },
      findText: {
        type: "string",
        description: "Text to find and replace",
      },
      replaceText: {
        type: "string",
        description: "Text to replace with",
      },
      replaceAll: {
        type: "boolean",
        description: "Whether to replace all occurrences (default: false)",
        default: false,
      },
    },
    required: ["filePath", "findText", "replaceText"],
  },

  async execute(
    params: CodeEditingParams & {
      fileTree: FileNode[];
      updateFileTree: (updater: (prev: FileNode[]) => FileNode[]) => void;
      replaceAll?: boolean;
    }
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const {
        filePath,
        findText,
        content: replaceText,
        fileTree,
        updateFileTree,
        replaceAll = false,
      } = params;

      if (!replaceText) {
        return {
          success: false,
          error: "Replace text is required",
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      const targetFile = findFileByPath(fileTree, filePath);

      if (!targetFile) {
        return {
          success: false,
          error: `File not found: ${filePath}`,
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      if (targetFile.type !== "file") {
        return {
          success: false,
          error: `Path is not a file: ${filePath}`,
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      const originalContent = targetFile.content || "";

      if (!originalContent.includes(findText)) {
        return {
          success: false,
          error: `Text not found in file: "${findText}"`,
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      // Perform replacement
      const newContent = replaceAll
        ? originalContent.replaceAll(findText, replaceText)
        : originalContent.replace(findText, replaceText);

      const replacementCount = replaceAll
        ? originalContent.split(findText).length - 1
        : originalContent.includes(findText)
        ? 1
        : 0;

      // Update the file tree
      const updateFile = (nodes: FileNode[]): FileNode[] => {
        return nodes.map((node) => {
          if (node.id === targetFile.id) {
            return { ...node, content: newContent };
          }
          if (node.children) {
            return { ...node, children: updateFile(node.children) };
          }
          return node;
        });
      };

      updateFileTree(updateFile);

      return {
        success: true,
        data: {
          filePath,
          originalLength: originalContent.length,
          newLength: newContent.length,
          replacementCount,
          findText,
          replaceText,
        },
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    }
  },
};

/**
 * Tool: Insert Text at Line
 * Inserts text at a specific line number in a file
 *
 * @param filePath - Path to the file to edit
 * @param lineNumber - Line number to insert at (1-based)
 * @param content - Text content to insert
 * @returns Success status and edit information
 */
export const insertTextAtLineTool: AgentTool = {
  name: "insert_text_at_line",
  description: "Insert text at a specific line number in a file",
  parameters: {
    type: "object",
    properties: {
      filePath: {
        type: "string",
        description: "Path to the file to edit",
      },
      lineNumber: {
        type: "number",
        description: "Line number to insert at (1-based indexing)",
      },
      content: {
        type: "string",
        description: "Text content to insert",
      },
    },
    required: ["filePath", "lineNumber", "content"],
  },

  async execute(
    params: CodeEditingParams & {
      fileTree: FileNode[];
      updateFileTree: (updater: (prev: FileNode[]) => FileNode[]) => void;
    }
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const { filePath, lineNumber, content, fileTree, updateFileTree } =
        params;

      if (!content) {
        return {
          success: false,
          error: "Content is required",
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      if (!lineNumber || lineNumber < 1) {
        return {
          success: false,
          error: "Line number must be a positive integer",
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      const targetFile = findFileByPath(fileTree, filePath);

      if (!targetFile) {
        return {
          success: false,
          error: `File not found: ${filePath}`,
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      if (targetFile.type !== "file") {
        return {
          success: false,
          error: `Path is not a file: ${filePath}`,
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      const originalContent = targetFile.content || "";
      const lines = originalContent.split("\n");

      // Validate line number
      if (lineNumber > lines.length + 1) {
        return {
          success: false,
          error: `Line number ${lineNumber} exceeds file length (${lines.length} lines)`,
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      // Insert content at the specified line
      const insertIndex = lineNumber - 1; // Convert to 0-based
      lines.splice(insertIndex, 0, content);
      const newContent = lines.join("\n");

      // Update the file tree
      const updateFile = (nodes: FileNode[]): FileNode[] => {
        return nodes.map((node) => {
          if (node.id === targetFile.id) {
            return { ...node, content: newContent };
          }
          if (node.children) {
            return { ...node, children: updateFile(node.children) };
          }
          return node;
        });
      };

      updateFileTree(updateFile);

      return {
        success: true,
        data: {
          filePath,
          lineNumber,
          insertedContent: content,
          originalLineCount: lines.length - 1, // Subtract 1 since we added a line
          newLineCount: lines.length,
        },
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    }
  },
};

/**
 * Tool: Delete Lines
 * Deletes a range of lines from a file
 *
 * @param filePath - Path to the file to edit
 * @param startLine - Starting line number (1-based, inclusive)
 * @param endLine - Ending line number (1-based, inclusive)
 * @returns Success status and edit information
 */
export const deleteLinesTool: AgentTool = {
  name: "delete_lines",
  description: "Delete a range of lines from a file",
  parameters: {
    type: "object",
    properties: {
      filePath: {
        type: "string",
        description: "Path to the file to edit",
      },
      startLine: {
        type: "number",
        description: "Starting line number (1-based, inclusive)",
      },
      endLine: {
        type: "number",
        description:
          "Ending line number (1-based, inclusive). If not provided, only startLine is deleted.",
      },
    },
    required: ["filePath", "startLine"],
  },

  async execute(params: {
    filePath: string;
    startLine: number;
    endLine?: number;
    fileTree: FileNode[];
    updateFileTree: (updater: (prev: FileNode[]) => FileNode[]) => void;
  }): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const {
        filePath,
        startLine,
        endLine = startLine,
        fileTree,
        updateFileTree,
      } = params;

      if (startLine < 1 || endLine < 1) {
        return {
          success: false,
          error: "Line numbers must be positive integers",
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      if (startLine > endLine) {
        return {
          success: false,
          error: "Start line cannot be greater than end line",
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      const targetFile = findFileByPath(fileTree, filePath);

      if (!targetFile) {
        return {
          success: false,
          error: `File not found: ${filePath}`,
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      if (targetFile.type !== "file") {
        return {
          success: false,
          error: `Path is not a file: ${filePath}`,
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      const originalContent = targetFile.content || "";
      const lines = originalContent.split("\n");

      // Validate line numbers
      if (startLine > lines.length || endLine > lines.length) {
        return {
          success: false,
          error: `Line numbers exceed file length (${lines.length} lines)`,
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      // Delete the specified lines
      const startIndex = startLine - 1; // Convert to 0-based
      const deleteCount = endLine - startLine + 1;
      const deletedLines = lines.splice(startIndex, deleteCount);
      const newContent = lines.join("\n");

      // Update the file tree
      const updateFile = (nodes: FileNode[]): FileNode[] => {
        return nodes.map((node) => {
          if (node.id === targetFile.id) {
            return { ...node, content: newContent };
          }
          if (node.children) {
            return { ...node, children: updateFile(node.children) };
          }
          return node;
        });
      };

      updateFileTree(updateFile);

      return {
        success: true,
        data: {
          filePath,
          startLine,
          endLine,
          deletedLinesCount: deletedLines.length,
          deletedContent: deletedLines.join("\n"),
          originalLineCount: lines.length + deletedLines.length,
          newLineCount: lines.length,
        },
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    }
  },
};

/**
 * Tool: Append Text
 * Appends text to the end of a file
 *
 * @param filePath - Path to the file to edit
 * @param content - Text content to append
 * @returns Success status and edit information
 */
export const appendTextTool: AgentTool = {
  name: "append_text",
  description: "Append text to the end of a file",
  parameters: {
    type: "object",
    properties: {
      filePath: {
        type: "string",
        description: "Path to the file to edit",
      },
      content: {
        type: "string",
        description: "Text content to append",
      },
      addNewline: {
        type: "boolean",
        description:
          "Whether to add a newline before appending (default: true)",
        default: true,
      },
    },
    required: ["filePath", "content"],
  },

  async execute(params: {
    filePath: string;
    content: string;
    addNewline?: boolean;
    fileTree: FileNode[];
    updateFileTree: (updater: (prev: FileNode[]) => FileNode[]) => void;
  }): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const {
        filePath,
        content,
        addNewline = true,
        fileTree,
        updateFileTree,
      } = params;

      if (!content) {
        return {
          success: false,
          error: "Content is required",
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      const targetFile = findFileByPath(fileTree, filePath);

      if (!targetFile) {
        return {
          success: false,
          error: `File not found: ${filePath}`,
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      if (targetFile.type !== "file") {
        return {
          success: false,
          error: `Path is not a file: ${filePath}`,
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      const originalContent = targetFile.content || "";
      const separator =
        addNewline &&
        originalContent.length > 0 &&
        !originalContent.endsWith("\n")
          ? "\n"
          : "";
      const newContent = originalContent + separator + content;

      // Update the file tree
      const updateFile = (nodes: FileNode[]): FileNode[] => {
        return nodes.map((node) => {
          if (node.id === targetFile.id) {
            return { ...node, content: newContent };
          }
          if (node.children) {
            return { ...node, children: updateFile(node.children) };
          }
          return node;
        });
      };

      updateFileTree(updateFile);

      return {
        success: true,
        data: {
          filePath,
          appendedContent: content,
          originalLength: originalContent.length,
          newLength: newContent.length,
          addedNewline: separator.length > 0,
        },
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    }
  },
};

/**
 * Tool: Prepend Text
 * Prepends text to the beginning of a file
 *
 * @param filePath - Path to the file to edit
 * @param content - Text content to prepend
 * @returns Success status and edit information
 */
export const prependTextTool: AgentTool = {
  name: "prepend_text",
  description: "Prepend text to the beginning of a file",
  parameters: {
    type: "object",
    properties: {
      filePath: {
        type: "string",
        description: "Path to the file to edit",
      },
      content: {
        type: "string",
        description: "Text content to prepend",
      },
      addNewline: {
        type: "boolean",
        description:
          "Whether to add a newline after prepending (default: true)",
        default: true,
      },
    },
    required: ["filePath", "content"],
  },

  async execute(params: {
    filePath: string;
    content: string;
    addNewline?: boolean;
    fileTree: FileNode[];
    updateFileTree: (updater: (prev: FileNode[]) => FileNode[]) => void;
  }): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const {
        filePath,
        content,
        addNewline = true,
        fileTree,
        updateFileTree,
      } = params;

      if (!content) {
        return {
          success: false,
          error: "Content is required",
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      const targetFile = findFileByPath(fileTree, filePath);

      if (!targetFile) {
        return {
          success: false,
          error: `File not found: ${filePath}`,
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      if (targetFile.type !== "file") {
        return {
          success: false,
          error: `Path is not a file: ${filePath}`,
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      const originalContent = targetFile.content || "";
      const separator = addNewline ? "\n" : "";
      const newContent = content + separator + originalContent;

      // Update the file tree
      const updateFile = (nodes: FileNode[]): FileNode[] => {
        return nodes.map((node) => {
          if (node.id === targetFile.id) {
            return { ...node, content: newContent };
          }
          if (node.children) {
            return { ...node, children: updateFile(node.children) };
          }
          return node;
        });
      };

      updateFileTree(updateFile);

      return {
        success: true,
        data: {
          filePath,
          prependedContent: content,
          originalLength: originalContent.length,
          newLength: newContent.length,
          addedNewline: separator.length > 0,
        },
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    }
  },
};

// Export all code editing tools
export const codeEditingTools = [
  replaceTextTool,
  insertTextAtLineTool,
  deleteLinesTool,
  appendTextTool,
  prependTextTool,
];
