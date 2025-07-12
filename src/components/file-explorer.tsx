import {
  File,
  Folder,
  Tree,
  type TreeViewElement,
} from "@/components/magicui/file-tree";
import type { FileNode } from "../App";
import { useMemo, useState, useEffect, useRef } from "react";
import type { ReactElement } from "react";
import { Input } from "@/components/ui/input";
import { Plus, FileIcon, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileExplorerProps {
  fileTree: FileNode[];
  className?: string;
  onSelectFile?: (file: FileNode) => void;
  selectedFileId?: string;
  onCreateFile?: (
    parentId: string | null,
    name: string,
    type: "file" | "folder"
  ) => void;
  onDeleteFile?: (fileId: string) => void;
  onRenameFile?: (fileId: string, newName: string) => void;
  onMoveFile?: (fileId: string, targetFolderId: string | null) => void;
}

// Convert FileNode to TreeViewElement recursively
const convertToTreeViewElement = (node: FileNode): TreeViewElement => {
  return {
    id: node.id,
    name: node.name,
    isSelectable: true, // Both files and folders should be selectable
    children: node.children?.map(convertToTreeViewElement),
  };
};

// Find a file node by ID recursively
const findFileById = (nodes: FileNode[], id: string): FileNode | null => {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    if (node.children) {
      const found = findFileById(node.children, id);
      if (found) return found;
    }
  }
  return null;
};

export default function FileExplorer({
  fileTree,
  className,
  onSelectFile,
  selectedFileId,
  onCreateFile,
  onDeleteFile,
  onRenameFile,
  onMoveFile,
}: FileExplorerProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [focusedFileId, setFocusedFileId] = useState<string | null>(
    selectedFileId || null
  );
  const explorerRef = useRef<HTMLDivElement>(null);
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null);
  const [dragOverFileId, setDragOverFileId] = useState<string | null>(null);

  // Convert FileNode array to TreeViewElement array
  const treeElements = useMemo(
    () => fileTree.map(convertToTreeViewElement),
    [fileTree]
  );

  // Update focused file when selectedFileId changes
  useEffect(() => {
    setFocusedFileId(selectedFileId || null);
  }, [selectedFileId]);

  // Get all visible items (files and folders) in tree order for navigation
  const getAllItemsInOrder = (nodes: FileNode[]): FileNode[] => {
    const result: FileNode[] = [];
    const traverse = (nodeList: FileNode[]) => {
      nodeList.forEach((node) => {
        result.push(node);
        // Include all children for navigation - Tree component handles visibility
        if (node.children) {
          traverse(node.children);
        }
      });
    };
    traverse(nodes);
    return result;
  };

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if explorer is focused and not currently renaming
      if (
        renamingId ||
        !explorerRef.current?.contains(document.activeElement)
      ) {
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        if (focusedFileId) {
          const item = findFileById(fileTree, focusedFileId);
          if (item?.type === "file") {
            // If file is already selected, rename it. Otherwise, open it.
            if (selectedFileId === focusedFileId) {
              handleRename(focusedFileId, item.name);
            } else {
              handleFileClick(item);
            }
          } else if (item?.type === "folder") {
            // For folders, just set focus/selection
            setFocusedFileId(item.id);
          }
        }
      } else if (e.key === "F2") {
        e.preventDefault();
        if (focusedFileId) {
          const file = findFileById(fileTree, focusedFileId);
          if (file) {
            handleRename(focusedFileId, file.name);
          }
        }
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (onDeleteFile && focusedFileId) {
          const file = findFileById(fileTree, focusedFileId);
          if (
            file &&
            confirm(`Delete ${file.name}? This action cannot be undone.`)
          ) {
            onDeleteFile(focusedFileId);
          }
        }
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const allItems = getAllItemsInOrder(fileTree);
        const currentIndex = allItems.findIndex(
          (item: FileNode) => item.id === focusedFileId
        );

        if (e.key === "ArrowDown" && currentIndex < allItems.length - 1) {
          setFocusedFileId(allItems[currentIndex + 1].id);
        } else if (e.key === "ArrowUp" && currentIndex > 0) {
          setFocusedFileId(allItems[currentIndex - 1].id);
        } else if (currentIndex === -1 && allItems.length > 0) {
          // If no item is focused, focus the first one
          setFocusedFileId(allItems[0].id);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [focusedFileId, renamingId, fileTree, onDeleteFile]);

  const handleRename = (fileId: string, currentName: string) => {
    setRenamingId(fileId);
    setNewName(currentName);
  };

  const submitRename = () => {
    if (renamingId && newName.trim() && onRenameFile) {
      onRenameFile(renamingId, newName.trim());
    }
    setRenamingId(null);
    setNewName("");
  };

  const cancelRename = () => {
    setRenamingId(null);
    setNewName("");
  };

  const handleFileClick = (file: FileNode) => {
    setFocusedFileId(file.id);
    if (onSelectFile) {
      onSelectFile(file);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, fileId: string) => {
    console.log("Drag start:", fileId);
    setDraggedFileId(fileId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", fileId);
  };

  const handleDragOver = (
    e: React.DragEvent,
    nodeId: string,
    nodeType: "file" | "folder"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";

    // Only allow dropping on folders or root
    if (nodeType === "folder") {
      setDragOverFileId(nodeId);
    } else {
      setDragOverFileId(null);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    // Only clear drag over if we're actually leaving the target element
    const relatedTarget = e.relatedTarget as Element;
    const currentTarget = e.currentTarget as Element;

    if (!currentTarget.contains(relatedTarget)) {
      setDragOverFileId(null);
    }
  };

  const handleDrop = (
    e: React.DragEvent,
    targetNodeId: string,
    targetNodeType: "file" | "folder"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Drop event:", { targetNodeId, targetNodeType });
    setDragOverFileId(null);

    const draggedId = e.dataTransfer.getData("text/plain");
    console.log("Dragged ID:", draggedId, "Target ID:", targetNodeId);

    if (!draggedId || draggedId === targetNodeId || !onMoveFile) {
      console.log("Drop cancelled - invalid conditions");
      return;
    }

    // Can only drop on folders
    if (targetNodeType === "folder") {
      console.log("Calling onMoveFile:", draggedId, "->", targetNodeId);
      onMoveFile(draggedId, targetNodeId);
    }

    setDraggedFileId(null);
  };

  const handleDragEnd = () => {
    console.log("Drag end");
    setDraggedFileId(null);
    setDragOverFileId(null);
  };

  // Render tree nodes recursively
  const renderTreeNodes = (nodes: FileNode[]): ReactElement[] => {
    return nodes.map((node) => {
      if (node.type === "file") {
        return (
          <div key={node.id}>
            {renamingId === node.id ? (
              <div className="flex w-fit items-center gap-1 rounded-md pr-1 text-sm bg-muted">
                <FileIcon className="size-4" />
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onBlur={submitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitRename();
                    if (e.key === "Escape") cancelRename();
                  }}
                  className="border-0 bg-transparent p-0 h-auto text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                  autoFocus
                />
              </div>
            ) : (
              <div
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  handleDragStart(e, node.id);
                }}
                onDragEnd={(e) => {
                  e.stopPropagation();
                  handleDragEnd();
                }}
                className={`${draggedFileId === node.id ? "opacity-50" : ""}`}
              >
                <File
                  value={node.name}
                  isSelect={selectedFileId === node.id}
                  onClick={() => handleFileClick(node)}
                  tabIndex={0}
                >
                  {node.name}
                </File>
              </div>
            )}
          </div>
        );
      } else {
        return (
          <div key={node.id}>
            {renamingId === node.id ? (
              <div className="flex w-fit items-center gap-1 rounded-md pr-1 text-sm bg-muted">
                <FolderPlus className="size-4 ml-1" />
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onBlur={submitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitRename();
                    if (e.key === "Escape") cancelRename();
                  }}
                  className="border-0 bg-transparent p-0 h-auto text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                  autoFocus
                />
              </div>
            ) : (
              <div
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  handleDragStart(e, node.id);
                }}
                onDragOver={(e) => {
                  e.stopPropagation();
                  handleDragOver(e, node.id, "folder");
                }}
                onDragLeave={(e) => {
                  e.stopPropagation();
                  handleDragLeave(e);
                }}
                onDrop={(e) => {
                  e.stopPropagation();
                  handleDrop(e, node.id, "folder");
                }}
                onDragEnd={(e) => {
                  e.stopPropagation();
                  handleDragEnd();
                }}
                className={`${draggedFileId === node.id ? "opacity-50" : ""} ${
                  dragOverFileId === node.id
                    ? "bg-neutral-500/20 border-neutral-500 border-2 p-1 border-dashed rounded"
                    : ""
                }`}
              >
                <Folder
                  value={node.name}
                  element={node.name}
                  isSelectable={true}
                  onClick={() => setFocusedFileId(node.id)}
                >
                  {node.children && renderTreeNodes(node.children)}
                </Folder>
              </div>
            )}
          </div>
        );
      }
    });
  };

  return (
    <div className={`${className} flex flex-col`} ref={explorerRef}>
      {/* File Explorer Header */}
      <div className="p-2 border-b border-gray-600 bg-[#2d2d2d]">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-300">Files</span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onCreateFile?.(null, "New File.py", "file")}
              className="h-6 w-6 p-0"
              title="New File"
            >
              <Plus className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onCreateFile?.(null, "New Folder", "folder")}
              className="h-6 w-6 p-0"
              title="New Folder"
            >
              <FolderPlus className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="p-2 text-xs text-gray-500 border-b border-gray-700">
        <div>↑↓: Navigate • Enter: Open/Rename • F2: Rename • Del: Delete</div>
        <div>Drag files/folders to move them</div>
      </div>

      {/* File Tree */}
      <div
        className="flex-1 overflow-auto"
        tabIndex={0}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={(e) => {
          e.preventDefault();
          console.log("Root drop event");
          const draggedId = e.dataTransfer.getData("text/plain");
          console.log("Root drop - draggedId:", draggedId);
          if (draggedId && onMoveFile) {
            console.log("Calling onMoveFile for root drop");
            // Drop to root directory
            onMoveFile(draggedId, null);
          }
          setDraggedFileId(null);
          setDragOverFileId(null);
        }}
      >
        <Tree
          className="h-full p-2"
          initialSelectedId={selectedFileId}
          elements={treeElements}
        >
          {renderTreeNodes(fileTree)}
        </Tree>
      </div>
    </div>
  );
}
