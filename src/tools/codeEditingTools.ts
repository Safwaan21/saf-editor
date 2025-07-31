/**
 * Code Editing Tools for AI Agents
 *
 * Simplified and reliable text editing tools that properly sync with the editor.
 */

import type { FileNode } from "../App";
import type { AgentTool, ToolResult } from "./types";

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
 * Tool: Modify Text
 * Replaces the entire content of a file or replaces specific text
 */
export const modifyTextTool: AgentTool = {
  name: "modify_text",
  description:
    "Modify file content by replacing the entire content or finding and replacing specific text",
  parameters: {
    type: "object",
    properties: {
      filePath: {
        type: "string",
        description: "Path to the file to edit",
      },
      newContent: {
        type: "string",
        description: "New content for the file (replaces entire file)",
      },
      findText: {
        type: "string",
        description: "Text to find and replace (alternative to newContent)",
      },
      replaceText: {
        type: "string",
        description: "Text to replace with (used with findText)",
      },
      replaceAll: {
        type: "boolean",
        description:
          "Whether to replace all occurrences when using findText (default: false)",
        default: false,
      },
    },
    required: ["filePath"],
  },

  async execute(params: {
    filePath: string;
    newContent?: string;
    findText?: string;
    replaceText?: string;
    replaceAll?: boolean;
    fileTree: FileNode[];
    updateFileTree: (updater: (prev: FileNode[]) => FileNode[]) => void;
  }): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const {
        filePath,
        newContent,
        findText,
        replaceText,
        replaceAll = false,
        fileTree,
        updateFileTree,
      } = params;

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
      let finalContent: string;

      if (newContent !== undefined) {
        // Replace entire file content
        finalContent = newContent;
      } else if (findText !== undefined && replaceText !== undefined) {
        // Find and replace specific text
        if (!originalContent.includes(findText)) {
          return {
            success: false,
            error: `Text not found in file: "${findText}"`,
            metadata: { executionTime: Date.now() - startTime },
          };
        }

        finalContent = replaceAll
          ? originalContent.split(findText).join(replaceText)
          : originalContent.replace(findText, replaceText);
      } else {
        return {
          success: false,
          error:
            "Either newContent or both findText and replaceText must be provided",
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      // Update the file tree
      const updateFile = (nodes: FileNode[]): FileNode[] => {
        return nodes.map((node) => {
          if (node.id === targetFile.id) {
            return { ...node, content: finalContent };
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
          newLength: finalContent.length,
          modificationType:
            newContent !== undefined ? "full_replace" : "find_replace",
          ...(findText && { findText, replaceText }),
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

// Export simplified code editing tools
export const codeEditingTools = [modifyTextTool];
