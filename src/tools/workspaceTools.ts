/**
 * Workspace Management Tools for AI Agents
 *
 * These tools provide AI agents with the ability to manage the workspace,
 * including creating, deleting, renaming, moving, and copying files and folders.
 */

import type { FileNode } from "../App";
import type { AgentTool, ToolResult, WorkspaceParams } from "./types";

/**
 * Utility function to find a file or folder by path in FileNode tree
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
 * Utility function to generate unique ID for new nodes
 */
function generateId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Utility function to deep clone a FileNode
 */
function cloneFileNode(node: FileNode): FileNode {
  return {
    ...node,
    id: generateId(), // Generate new ID for cloned node
    children: node.children ? node.children.map(cloneFileNode) : undefined,
  };
}

/**
 * Tool: Create File or Folder
 * Creates a new file or folder in the workspace
 *
 * @param path - Path where to create the item
 * @param type - Type of item to create ('file' or 'folder')
 * @param content - Initial content for files (optional)
 * @returns Success status and creation information
 */
export const createItemTool: AgentTool = {
  name: "create_item",
  description: "Create a new file or folder in the workspace",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path where to create the item (including the item name)",
      },
      type: {
        type: "string",
        enum: ["file", "folder"],
        description: "Type of item to create",
      },
      content: {
        type: "string",
        description: "Initial content for files (optional)",
        default: "",
      },
    },
    required: ["path", "type"],
  },

  async execute(
    params: WorkspaceParams & {
      fileTree: FileNode[];
      updateFileTree: (updater: (prev: FileNode[]) => FileNode[]) => void;
      content?: string;
    }
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const { path, type, content = "", fileTree, updateFileTree } = params;

      // Check if item already exists
      const existingItem = findFileByPath(fileTree, path);
      if (existingItem) {
        return {
          success: false,
          error: `Item already exists at path: ${path}`,
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      // Parse path to get parent directory and item name
      const pathParts = path.split("/").filter((part) => part.length > 0);
      const itemName = pathParts.pop()!;
      const parentPath = pathParts.join("/");

      // Find or validate parent directory
      let parentNode: FileNode[] | undefined;
      if (parentPath) {
        const parent = findFileByPath(fileTree, parentPath);
        if (!parent) {
          return {
            success: false,
            error: `Parent directory not found: ${parentPath}`,
            metadata: { executionTime: Date.now() - startTime },
          };
        }
        if (parent.type !== "folder") {
          return {
            success: false,
            error: `Parent path is not a directory: ${parentPath}`,
            metadata: { executionTime: Date.now() - startTime },
          };
        }
        parentNode = parent.children || [];
      } else {
        parentNode = fileTree;
      }

      // Check for name conflicts in parent directory
      const nameExists = parentNode.some((node) => node.name === itemName);
      if (nameExists) {
        return {
          success: false,
          error: `Item with name '${itemName}' already exists in directory`,
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      // Create new node
      const newNode: FileNode = {
        id: generateId(),
        name: itemName,
        type: type as "file" | "folder",
        content: type === "file" ? content : undefined,
        children: type === "folder" ? [] : undefined,
        isExpanded: false,
      };

      // Update file tree
      if (!parentPath) {
        // Add to root
        updateFileTree((prev) => [...prev, newNode]);
      } else {
        // Add to specific directory
        const addToDirectory = (nodes: FileNode[]): FileNode[] => {
          return nodes.map((node) => {
            if (
              getNodePath(node, fileTree) === parentPath &&
              node.type === "folder"
            ) {
              return {
                ...node,
                children: [...(node.children || []), newNode],
              };
            }
            if (node.children) {
              return { ...node, children: addToDirectory(node.children) };
            }
            return node;
          });
        };

        updateFileTree(addToDirectory);
      }

      return {
        success: true,
        data: {
          path,
          name: itemName,
          type,
          id: newNode.id,
          parentPath: parentPath || "/",
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
 * Tool: Delete Item
 * Deletes a file or folder from the workspace
 *
 * @param path - Path of the item to delete
 * @returns Success status and deletion information
 */
export const deleteItemTool: AgentTool = {
  name: "delete_item",
  description: "Delete a file or folder from the workspace",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Path of the item to delete",
      },
    },
    required: ["path"],
  },

  async execute(params: {
    path: string;
    fileTree: FileNode[];
    updateFileTree: (updater: (prev: FileNode[]) => FileNode[]) => void;
  }): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const { path, fileTree, updateFileTree } = params;

      const targetItem = findFileByPath(fileTree, path);
      if (!targetItem) {
        return {
          success: false,
          error: `Item not found: ${path}`,
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      // Remove the item from the tree
      const removeItem = (nodes: FileNode[]): FileNode[] => {
        return nodes
          .filter((node) => {
            if (node.id === targetItem.id) {
              return false; // Remove this node
            }
            if (node.children) {
              return {
                ...node,
                children: removeItem(node.children),
              };
            }
            return true;
          })
          .map((node) => {
            if (node.children) {
              return {
                ...node,
                children: removeItem(node.children),
              };
            }
            return node;
          });
      };

      updateFileTree(removeItem);

      return {
        success: true,
        data: {
          path,
          name: targetItem.name,
          type: targetItem.type,
          id: targetItem.id,
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
 * Tool: Rename Item
 * Renames a file or folder in the workspace
 *
 * @param path - Current path of the item
 * @param newName - New name for the item
 * @returns Success status and rename information
 */
export const renameItemTool: AgentTool = {
  name: "rename_item",
  description: "Rename a file or folder in the workspace",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Current path of the item to rename",
      },
      newName: {
        type: "string",
        description: "New name for the item",
      },
    },
    required: ["path", "newName"],
  },

  async execute(params: {
    path: string;
    newName: string;
    fileTree: FileNode[];
    updateFileTree: (updater: (prev: FileNode[]) => FileNode[]) => void;
  }): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const { path, newName, fileTree, updateFileTree } = params;

      const targetItem = findFileByPath(fileTree, path);
      if (!targetItem) {
        return {
          success: false,
          error: `Item not found: ${path}`,
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      // Validate new name
      if (!newName || newName.trim().length === 0) {
        return {
          success: false,
          error: "New name cannot be empty",
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      // Check for name conflicts in the same directory
      const pathParts = path.split("/").filter((part) => part.length > 0);
      pathParts.pop(); // Remove current name
      const parentPath = pathParts.join("/");

      const siblings = parentPath
        ? findFileByPath(fileTree, parentPath)?.children || []
        : fileTree;

      const nameExists = siblings.some(
        (node) => node.name === newName.trim() && node.id !== targetItem.id
      );

      if (nameExists) {
        return {
          success: false,
          error: `Item with name '${newName}' already exists in the same directory`,
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      // Rename the item
      const renameItem = (nodes: FileNode[]): FileNode[] => {
        return nodes.map((node) => {
          if (node.id === targetItem.id) {
            return { ...node, name: newName.trim() };
          }
          if (node.children) {
            return { ...node, children: renameItem(node.children) };
          }
          return node;
        });
      };

      updateFileTree(renameItem);

      const newPath = parentPath ? `${parentPath}/${newName}` : newName;

      return {
        success: true,
        data: {
          oldPath: path,
          newPath,
          oldName: targetItem.name,
          newName: newName.trim(),
          type: targetItem.type,
          id: targetItem.id,
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
 * Tool: Move Item
 * Moves a file or folder to a different location in the workspace
 *
 * @param sourcePath - Current path of the item
 * @param targetPath - Target directory path
 * @returns Success status and move information
 */
export const moveItemTool: AgentTool = {
  name: "move_item",
  description: "Move a file or folder to a different location in the workspace",
  parameters: {
    type: "object",
    properties: {
      sourcePath: {
        type: "string",
        description: "Current path of the item to move",
      },
      targetPath: {
        type: "string",
        description: "Target directory path (empty string for root)",
      },
    },
    required: ["sourcePath", "targetPath"],
  },

  async execute(
    params: WorkspaceParams & {
      fileTree: FileNode[];
      updateFileTree: (updater: (prev: FileNode[]) => FileNode[]) => void;
    }
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const { sourcePath, targetPath, fileTree, updateFileTree } = params;

      const sourceItem = findFileByPath(fileTree, sourcePath);
      if (!sourceItem) {
        return {
          success: false,
          error: `Source item not found: ${sourcePath}`,
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      // Validate target directory
      let targetDir: FileNode[] | FileNode | undefined;
      if (targetPath && targetPath !== "/") {
        targetDir = findFileByPath(fileTree, targetPath);
        if (!targetDir) {
          return {
            success: false,
            error: `Target directory not found: ${targetPath}`,
            metadata: { executionTime: Date.now() - startTime },
          };
        }
        if (targetDir.type !== "folder") {
          return {
            success: false,
            error: `Target path is not a directory: ${targetPath}`,
            metadata: { executionTime: Date.now() - startTime },
          };
        }
      }

      // Prevent moving a folder into itself or its descendants
      if (sourceItem.type === "folder" && targetPath) {
        if (
          targetPath.startsWith(sourcePath + "/") ||
          targetPath === sourcePath
        ) {
          return {
            success: false,
            error: "Cannot move a folder into itself or its descendants",
            metadata: { executionTime: Date.now() - startTime },
          };
        }
      }

      // Check for name conflicts in target directory
      const targetChildren =
        targetPath && targetPath !== "/"
          ? (targetDir as FileNode).children || []
          : fileTree;

      const nameExists = targetChildren.some(
        (node) => node.name === sourceItem.name
      );
      if (nameExists) {
        return {
          success: false,
          error: `Item with name '${sourceItem.name}' already exists in target directory`,
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      // Remove item from source location and add to target location
      const moveItem = (nodes: FileNode[]): FileNode[] => {
        // First, remove the item from its current location
        const withoutSource = nodes
          .filter((node) => node.id !== sourceItem.id)
          .map((node) => {
            if (node.children) {
              return { ...node, children: moveItem(node.children) };
            }
            return node;
          });

        // Then, add it to the target location
        if (!targetPath || targetPath === "/") {
          // Moving to root
          return [...withoutSource, sourceItem];
        } else {
          // Moving to specific directory
          return withoutSource.map((node) => {
            if (
              getNodePath(node, fileTree) === targetPath &&
              node.type === "folder"
            ) {
              return {
                ...node,
                children: [...(node.children || []), sourceItem],
              };
            }
            if (node.children) {
              return { ...node, children: moveItem(node.children) };
            }
            return node;
          });
        }
      };

      updateFileTree(moveItem);

      const newPath =
        targetPath && targetPath !== "/"
          ? `${targetPath}/${sourceItem.name}`
          : sourceItem.name;

      return {
        success: true,
        data: {
          sourcePath,
          targetPath: targetPath || "/",
          newPath,
          name: sourceItem.name,
          type: sourceItem.type,
          id: sourceItem.id,
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
 * Tool: Copy Item
 * Copies a file or folder to a different location in the workspace
 *
 * @param sourcePath - Current path of the item
 * @param targetPath - Target directory path
 * @param newName - Optional new name for the copied item
 * @returns Success status and copy information
 */
export const copyItemTool: AgentTool = {
  name: "copy_item",
  description: "Copy a file or folder to a different location in the workspace",
  parameters: {
    type: "object",
    properties: {
      sourcePath: {
        type: "string",
        description: "Current path of the item to copy",
      },
      targetPath: {
        type: "string",
        description: "Target directory path (empty string for root)",
      },
      newName: {
        type: "string",
        description: "Optional new name for the copied item",
      },
    },
    required: ["sourcePath", "targetPath"],
  },

  async execute(
    params: WorkspaceParams & {
      fileTree: FileNode[];
      updateFileTree: (updater: (prev: FileNode[]) => FileNode[]) => void;
    }
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const { sourcePath, targetPath, newName, fileTree, updateFileTree } =
        params;

      const sourceItem = findFileByPath(fileTree, sourcePath);
      if (!sourceItem) {
        return {
          success: false,
          error: `Source item not found: ${sourcePath}`,
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      // Validate target directory
      let targetDir: FileNode | undefined;
      if (targetPath && targetPath !== "/") {
        targetDir = findFileByPath(fileTree, targetPath);
        if (!targetDir) {
          return {
            success: false,
            error: `Target directory not found: ${targetPath}`,
            metadata: { executionTime: Date.now() - startTime },
          };
        }
        if (targetDir.type !== "folder") {
          return {
            success: false,
            error: `Target path is not a directory: ${targetPath}`,
            metadata: { executionTime: Date.now() - startTime },
          };
        }
      }

      const copyName = newName || sourceItem.name;

      // Check for name conflicts in target directory
      const targetChildren =
        targetPath && targetPath !== "/" ? targetDir!.children || [] : fileTree;

      const nameExists = targetChildren.some((node) => node.name === copyName);
      if (nameExists) {
        return {
          success: false,
          error: `Item with name '${copyName}' already exists in target directory`,
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      // Create a deep copy of the source item
      const copiedItem = cloneFileNode(sourceItem);
      copiedItem.name = copyName;

      // Add the copied item to the target location
      const addCopiedItem = (nodes: FileNode[]): FileNode[] => {
        if (!targetPath || targetPath === "/") {
          // Adding to root
          return [...nodes, copiedItem];
        } else {
          // Adding to specific directory
          return nodes.map((node) => {
            if (
              getNodePath(node, fileTree) === targetPath &&
              node.type === "folder"
            ) {
              return {
                ...node,
                children: [...(node.children || []), copiedItem],
              };
            }
            if (node.children) {
              return { ...node, children: addCopiedItem(node.children) };
            }
            return node;
          });
        }
      };

      updateFileTree(addCopiedItem);

      const newPath =
        targetPath && targetPath !== "/"
          ? `${targetPath}/${copyName}`
          : copyName;

      return {
        success: true,
        data: {
          sourcePath,
          targetPath: targetPath || "/",
          newPath,
          originalName: sourceItem.name,
          copyName,
          type: sourceItem.type,
          sourceId: sourceItem.id,
          copyId: copiedItem.id,
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

// Export all workspace management tools
export const workspaceTools = [
  createItemTool,
  deleteItemTool,
  renameItemTool,
  moveItemTool,
  copyItemTool,
];
