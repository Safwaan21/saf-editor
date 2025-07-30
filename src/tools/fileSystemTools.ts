/**
 * File System Tools for AI Agents
 *
 * These tools provide AI agents with the ability to interact with the file system,
 * including reading directories, reading files, and writing files.
 * Uses the existing FileNode structure and workspace management.
 */

import type { FileNode } from "../App";
import type {
  AgentTool,
  ToolResult,
  FileSystemParams,
  DirectoryListing,
} from "./types";

/**
 * Utility function to find a file or folder by path in FileNode tree
 * @param nodes - Array of FileNode objects to search
 * @param targetPath - Path to find (e.g., "folder/subfolder/file.py")
 * @returns FileNode if found, undefined otherwise
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
      // This is the final part, return the node
      return currentNode;
    }

    if (currentNode.type !== "folder" || !currentNode.children) {
      // Path continues but this node is not a folder or has no children
      return undefined;
    }

    currentNodes = currentNode.children;
  }

  return currentNode;
}

/**
 * Tool: Read Directory
 * Lists files and subdirectories in a given directory path
 *
 * @param path - Directory path to read (empty string for root)
 * @param includeContent - Whether to include file contents in the response
 * @param recursive - Whether to recursively list subdirectories
 * @returns DirectoryListing with files and folders
 */
export const readDirectoryTool: AgentTool = {
  name: "read_directory",
  description:
    "Read and list the contents of a directory, including files and subdirectories",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description:
          'Directory path to read (empty string or "/" for root directory)',
      },
      includeContent: {
        type: "boolean",
        description:
          "Whether to include file contents in the response (default: false)",
        default: false,
      },
      recursive: {
        type: "boolean",
        description:
          "Whether to recursively list subdirectories (default: false)",
        default: false,
      },
    },
    required: ["path"],
  },

  async execute(
    params: FileSystemParams & { fileTree: FileNode[] }
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const {
        path,
        includeContent = false,
        recursive = false,
        fileTree,
      } = params;

      // Handle root directory
      if (!path || path === "/" || path === ".") {
        const entries = fileTree.map((node) => ({
          name: node.name,
          type: node.type as "file" | "folder",
          path: node.name,
          size:
            node.type === "file" && node.content
              ? node.content.length
              : undefined,
          content:
            includeContent && node.type === "file" ? node.content : undefined,
          children:
            recursive && node.type === "folder" && node.children
              ? node.children.map((child) => ({
                  name: child.name,
                  type: child.type as "file" | "folder",
                  path: `${node.name}/${child.name}`,
                  size:
                    child.type === "file" && child.content
                      ? child.content.length
                      : undefined,
                  content:
                    includeContent && child.type === "file"
                      ? child.content
                      : undefined,
                }))
              : undefined,
        }));

        const result: DirectoryListing = {
          path: path || "/",
          entries,
          totalCount: entries.length,
        };

        return {
          success: true,
          data: result,
          metadata: {
            executionTime: Date.now() - startTime,
          },
        };
      }

      // Find the target directory
      const targetDir = findFileByPath(fileTree, path);

      if (!targetDir) {
        return {
          success: false,
          error: `Directory not found: ${path}`,
          metadata: {
            executionTime: Date.now() - startTime,
          },
        };
      }

      if (targetDir.type !== "folder") {
        return {
          success: false,
          error: `Path is not a directory: ${path}`,
          metadata: {
            executionTime: Date.now() - startTime,
          },
        };
      }

      const entries = (targetDir.children || []).map((node) => ({
        name: node.name,
        type: node.type as "file" | "folder",
        path: `${path}/${node.name}`,
        size:
          node.type === "file" && node.content
            ? node.content.length
            : undefined,
        content:
          includeContent && node.type === "file" ? node.content : undefined,
        children:
          recursive && node.type === "folder" && node.children
            ? node.children.map((child) => ({
                name: child.name,
                type: child.type as "file" | "folder",
                path: `${path}/${node.name}/${child.name}`,
                size:
                  child.type === "file" && child.content
                    ? child.content.length
                    : undefined,
                content:
                  includeContent && child.type === "file"
                    ? child.content
                    : undefined,
              }))
            : undefined,
      }));

      const result: DirectoryListing = {
        path,
        entries,
        totalCount: entries.length,
      };

      return {
        success: true,
        data: result,
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
 * Tool: Read File
 * Reads the contents of a specific file
 *
 * @param path - File path to read
 * @returns File content as string
 */
export const readFileTool: AgentTool = {
  name: "read_file",
  description: "Read the contents of a specific file",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "File path to read",
      },
    },
    required: ["path"],
  },

  async execute(
    params: FileSystemParams & { fileTree: FileNode[] }
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const { path, fileTree } = params;

      const targetFile = findFileByPath(fileTree, path);

      if (!targetFile) {
        return {
          success: false,
          error: `File not found: ${path}`,
          metadata: {
            executionTime: Date.now() - startTime,
          },
        };
      }

      if (targetFile.type !== "file") {
        return {
          success: false,
          error: `Path is not a file: ${path}`,
          metadata: {
            executionTime: Date.now() - startTime,
          },
        };
      }

      return {
        success: true,
        data: {
          path,
          content: targetFile.content || "",
          size: targetFile.content ? targetFile.content.length : 0,
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
 * Tool: Write File
 * Writes content to a specific file (creates if doesn't exist)
 *
 * @param path - File path to write
 * @param content - Content to write to the file
 * @returns Success status and file info
 */
export const writeFileTool: AgentTool = {
  name: "write_file",
  description: "Write content to a file (creates file if it doesn't exist)",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "File path to write to",
      },
      content: {
        type: "string",
        description: "Content to write to the file",
      },
    },
    required: ["path", "content"],
  },

  async execute(
    params: FileSystemParams & {
      fileTree: FileNode[];
      updateFileTree: (updater: (prev: FileNode[]) => FileNode[]) => void;
    }
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const { path, content, fileTree, updateFileTree } = params;

      // Check if file already exists
      const existingFile = findFileByPath(fileTree, path);

      if (existingFile) {
        if (existingFile.type !== "file") {
          return {
            success: false,
            error: `Path exists but is not a file: ${path}`,
            metadata: {
              executionTime: Date.now() - startTime,
            },
          };
        }

        // Update existing file
        const updateFile = (nodes: FileNode[]): FileNode[] => {
          return nodes.map((node) => {
            if (
              node.name === existingFile.name &&
              node.id === existingFile.id
            ) {
              return { ...node, content };
            }
            if (node.children) {
              return { ...node, children: updateFile(node.children) };
            }
            return node;
          });
        };

        updateFileTree(updateFile);
      } else {
        // Create new file
        const pathParts = path.split("/").filter((part) => part.length > 0);
        const fileName = pathParts.pop()!;
        const dirPath = pathParts.join("/");

        // Validate parent directory
        if (dirPath) {
          const targetDir = findFileByPath(fileTree, dirPath);
          if (!targetDir) {
            return {
              success: false,
              error: `Parent directory not found: ${dirPath}`,
              metadata: {
                executionTime: Date.now() - startTime,
              },
            };
          }
          if (targetDir.type !== "folder") {
            return {
              success: false,
              error: `Parent path is not a directory: ${dirPath}`,
              metadata: {
                executionTime: Date.now() - startTime,
              },
            };
          }
        }

        const newFile: FileNode = {
          id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: fileName,
          type: "file",
          content,
        };

        // Add the new file to the appropriate location
        if (!dirPath) {
          // Add to root
          updateFileTree((prev) => [...prev, newFile]);
        } else {
          // Add to specific directory
          const addToDir = (nodes: FileNode[]): FileNode[] => {
            return nodes.map((node) => {
              const nodePath = getNodePath(node, nodes);
              if (nodePath === dirPath && node.type === "folder") {
                return {
                  ...node,
                  children: [...(node.children || []), newFile],
                };
              }
              if (node.children) {
                return { ...node, children: addToDir(node.children) };
              }
              return node;
            });
          };

          updateFileTree(addToDir);
        }
      }

      return {
        success: true,
        data: {
          path,
          size: content?.length || 0,
          created: !existingFile,
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
 * Helper function to get the full path of a node within a tree
 */
function getNodePath(
  targetNode: FileNode,
  nodes: FileNode[],
  currentPath: string = ""
): string {
  for (const node of nodes) {
    const nodePath = currentPath ? `${currentPath}/${node.name}` : node.name;

    if (node.id === targetNode.id) {
      return nodePath;
    }

    if (node.children) {
      const childPath = getNodePath(targetNode, node.children, nodePath);
      if (childPath) return childPath;
    }
  }
  return "";
}

// Export all file system tools
export const fileSystemTools = [readDirectoryTool, readFileTool, writeFileTool];
