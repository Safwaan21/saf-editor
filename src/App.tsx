import "./App.css";
import { Editor, type Monaco } from "@monaco-editor/react";
import { useState, useEffect, useRef, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Button } from "./components/ui/button";
import { Dialog, DialogTrigger } from "./components/ui/dialog";
import * as monaco from "monaco-editor";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./components/ui/popover";
import {
  TriangleAlert,
  GripHorizontal,
  LoaderCircle,
  X,
  Save,
  // SaveAll,
  RotateCcw,
  Share2,
  BarChart3,
  Check,
} from "lucide-react";
import { motion } from "motion/react";
import PyodideWorker from "./pyodideWorker.ts?worker";
import type { editor } from "monaco-editor";
import { useWebLLM } from "./hooks/useWebLLM";
import { useAPIProvider } from "./hooks/useAPIProvider";
import { useAIConfig } from "./hooks/useAIConfig";
import { AISetupDialog } from "./components/AISetupDialog";
import { MonacoPyrightProvider } from "monaco-pyright-lsp";
import { MonacoDiffViewer } from "./components/MonacoDiffViewer";
import { Textarea } from "./components/ui/textarea";
import FileExplorer from "./components/file-explorer";
import AgentChat from "./components/AgentChat";
import { WorkspaceSerializer } from "./utils/workspaceSharing";
import { BlurFade } from "./components/magicui/blur-fade";
import { ShineBorder } from "./components/magicui/shine-border";

import { PackageLibrary } from "./components/PackageLibrary";
import { agentToolRegistry, initializeAgentTools } from "./tools";

export interface FileNode {
  id: string;
  name: string;
  type: "file" | "folder";
  content?: string;
  children?: FileNode[];
  isExpanded?: boolean;
  isSelected?: boolean;
}

interface EditorTab {
  fileId: string;
  fileName: string;
  content: string;
  isDirty: boolean;
  originalContent: string;
}

const initialFileTree: FileNode[] = [
  {
    id: "1",
    name: "main.py",
    type: "file",
    content:
      '# Example Python code with type hints for better completions\nimport json\nfrom typing import List, Dict, Optional\n\n# Import from utils folder\nfrom utils.helpers import helper_function\nfrom utils.constants import PI, E\n\ndef greet(name: str) -> str:\n    """Greet a person by name."""\n    return f"Hello, {name}!"\n\ndef calculate_area(radius: float) -> float:\n    """Calculate the area of a circle."""\n    return PI * radius ** 2\n\ndef process_data(data: List[Dict[str, str]]) -> Optional[str]:\n    """Process a list of dictionaries."""\n    if not data:\n        return None\n    return json.dumps(data, indent=2)\n\n# Try typing these to see completions:\n# json.\n# greet(\n# calculate_area(\n# data = [{"name": "John"}]\n# process_data(\n\nprint(\'Hello from main.py!\')\nprint(\'Calling helper function:\')\nprint(helper_function())\n\nprint(f\'\\nConstants from utils:\')\nprint(f\'PI = {PI}\')\nprint(f\'E = {E}\')\n\nprint(\'\\nMulti-file execution works!\')',
  },
  {
    id: "2",
    name: "utils",
    type: "folder",
    isExpanded: false,
    children: [
      {
        id: "2-0",
        name: "__init__.py",
        type: "file",
        content: "# Utils package",
      },
      {
        id: "2-1",
        name: "helpers.py",
        type: "file",
        content:
          "def helper_function():\n    return 'This is a helper function from utils.helpers!'",
      },
      {
        id: "2-2",
        name: "constants.py",
        type: "file",
        content:
          "PI = 3.14159\nE = 2.71828\n\nprint('Constants module loaded!')",
      },
    ],
  },
  {
    id: "3",
    name: "tests",
    type: "folder",
    isExpanded: false,
    children: [
      {
        id: "3-1",
        name: "test_main.py",
        type: "file",
        content:
          "import unittest\n\nclass TestMain(unittest.TestCase):\n    def test_hello(self):\n        self.assertTrue(True)",
      },
    ],
  },
  {
    id: "4",
    name: "README.md",
    type: "file",
    content: "# My Python Project\n\nThis is a sample project structure.",
  },
];

function App() {
  const workerRef = useRef<Worker | null>(null);
  const [code, setCode] = useState("print('Hello, World!')");
  const [terminalTabHeight, setTerminalTabHeight] = useState(25);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startHeight, setStartHeight] = useState(0);
  const [pyodideReady, setPyodideReady] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [pyodideError, setPyodideError] = useState("");
  const pyrightProviderRef = useRef<MonacoPyrightProvider | null>(null);
  // const [executionTime, setExecutionTime] = useState(0);
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [fileTree, setFileTree] = useState<FileNode[]>(initialFileTree);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(
    initialFileTree[0]
  );
  const [openTabs, setOpenTabs] = useState<EditorTab[]>([
    {
      fileId: initialFileTree[0].id,
      fileName: initialFileTree[0].name,
      content: initialFileTree[0].content || "",
      isDirty: false,
      originalContent: initialFileTree[0].content || "",
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>(initialFileTree[0].id);
  const [aiPopover, setAiPopover] = useState({
    isOpen: false,
    position: { x: 0, y: 0 },
    prompt: "",
    codeContext: "",
  });

  // AI integration
  const {
    state: llmState,
    initializeModel,
    generateCodeSuggestion: webllmGenerateCode,
    cancelInitializeModel,
  } = useWebLLM();
  const apiProvider = useAPIProvider();
  const { config: aiConfig, saveConfig: saveAiConfig } = useAIConfig();
  const [diffViewer, setDiffViewer] = useState<{
    isOpen: boolean;
    originalCode: string;
    suggestedCode: string;
  }>({
    isOpen: false,
    originalCode: "",
    suggestedCode: "",
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState("stdout");
  const [autoSave] = useState(true); // setAutoSave removed as unused
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">(
    "saved"
  );
  const [shareStatus, setShareStatus] = useState<"idle" | "copied">("idle");
  const [workspacePopover, setWorkspacePopover] = useState<{
    isOpen: boolean;
    type: "stats" | null;
    content: string;
  }>({
    isOpen: false,
    type: null,
    content: "",
  });
  const [titleState, setTitleState] = useState<"full" | "abbreviated">("full");
  const [showAgentChat, setShowAgentChat] = useState(false);
  const [agentChatWidth, setAgentChatWidth] = useState(320); // Start smaller (320px instead of 40%)
  const [isResizing, setIsResizing] = useState(false);

  const isFullyLoaded = pyodideReady && editorReady;

  // Initialize WebLLM model on startup if configured
  useEffect(() => {
    if (
      aiConfig.type === "webllm" &&
      aiConfig.webllmModel &&
      !llmState.isInitialized &&
      !llmState.isLoading
    ) {
      initializeModel(aiConfig.webllmModel);
    }
  }, [aiConfig, llmState.isInitialized, llmState.isLoading, initializeModel]);

  // Trigger title transition after initial animations complete
  useEffect(() => {
    if (isFullyLoaded) {
      const timer = setTimeout(() => {
        setTitleState("abbreviated");
      }, 6000); // Wait for initial animations + extra time for user to ease into the app

      return () => clearTimeout(timer);
    }
  }, [isFullyLoaded]);

  // Initialize agent tools on app startup
  useEffect(() => {
    if (!agentToolRegistry.getStats().totalTools) {
      initializeAgentTools();
    }
  }, []);

  // Set agent tool registry context when pyodide is ready
  useEffect(() => {
    if (pyodideReady && agentToolRegistry.getStats().totalTools) {
      agentToolRegistry.setContext({
        fileTree,
        updateFileTree: updateFileTreeWithSync,
        pyodideWorker: workerRef.current || undefined,
      });
    }
  }, [pyodideReady, fileTree]);

  // Switch to stderr tab when there's an error, or back to stdout on successful runs
  useEffect(() => {
    if (stderr.length > 0) {
      setActiveTab("stderr");
    } else if (stdout.length > 0 && stderr.length === 0) {
      setActiveTab("stdout");
    }
  }, [stderr, stdout]);

  // Utility functions for file operations
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

  const updateFileContent = (
    nodes: FileNode[],
    fileId: string,
    content: string
  ): FileNode[] => {
    return nodes.map((node) => {
      if (node.id === fileId) {
        return { ...node, content };
      }
      if (node.children) {
        return {
          ...node,
          children: updateFileContent(node.children, fileId, content),
        };
      }
      return node;
    });
  };

  const getAllFiles = (nodes: FileNode[]): FileNode[] => {
    const files: FileNode[] = [];
    for (const node of nodes) {
      if (node.type === "file") {
        files.push(node);
      }
      if (node.children) {
        files.push(...getAllFiles(node.children));
      }
    }
    return files;
  };

  // Generate unique ID for new files/folders
  const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // Generate file path based on file tree structure
  const getFilePath = (
    targetFile: FileNode,
    nodes: FileNode[],
    currentPath: string = ""
  ): string => {
    for (const node of nodes) {
      const nodePath = currentPath ? `${currentPath}/${node.name}` : node.name;

      if (node.id === targetFile.id) {
        return nodePath;
      }

      if (node.children) {
        const childPath = getFilePath(targetFile, node.children, nodePath);
        if (childPath) return childPath;
      }
    }
    return "";
  };

  // CRUD Operations
  const createFile = (
    parentId: string | null,
    name: string,
    type: "file" | "folder"
  ) => {
    // Check for duplicates to prevent React StrictMode double-creation
    const checkForDuplicate = (
      nodes: FileNode[],
      targetName: string
    ): boolean => {
      return nodes.some((node) => node.name === targetName);
    };

    let targetNodes: FileNode[];
    if (parentId === null) {
      targetNodes = fileTree;
    } else {
      const parentFolder = findFileById(fileTree, parentId);
      if (!parentFolder || parentFolder.type !== "folder") return null;
      targetNodes = parentFolder.children || [];
    }

    // Generate unique name if duplicate exists
    let uniqueName = name;
    let counter = 1;
    while (checkForDuplicate(targetNodes, uniqueName)) {
      if (name.includes(".")) {
        // For files with extensions
        const parts = name.split(".");
        const extension = parts.pop();
        const baseName = parts.join(".");
        uniqueName = `${baseName} ${counter}.${extension}`;
      } else {
        // For folders or files without extensions
        uniqueName = `${name} ${counter}`;
      }
      counter++;
    }

    const newNode: FileNode = {
      id: generateId(),
      name: uniqueName,
      type,
      content: type === "file" ? "" : undefined,
      children: type === "folder" ? [] : undefined,
      isExpanded: false,
    };

    if (parentId === null) {
      // Add to root
      setFileTree((prev) => [...prev, newNode]);
    } else {
      // Add to specific folder
      setFileTree((prev) => addToFolder(prev, parentId, newNode));
    }

    // If it's a file, open it in a new tab
    if (type === "file") {
      openFileInTab(newNode);
    }

    return newNode;
  };

  const addToFolder = (
    nodes: FileNode[],
    folderId: string,
    newNode: FileNode
  ): FileNode[] => {
    return nodes.map((node) => {
      if (node.id === folderId && node.type === "folder") {
        return {
          ...node,
          children: [...(node.children || []), newNode],
          isExpanded: true, // Expand folder when adding items
        };
      }
      if (node.children) {
        return {
          ...node,
          children: addToFolder(node.children, folderId, newNode),
        };
      }
      return node;
    });
  };

  const deleteFile = (fileId: string) => {
    // Close any open tabs for this file (and its children if it's a folder)
    const fileToDelete = findFileById(fileTree, fileId);
    if (fileToDelete) {
      const filesToClose: string[] = [];

      const collectFileIds = (node: FileNode) => {
        if (node.type === "file") {
          filesToClose.push(node.id);
        }
        if (node.children) {
          node.children.forEach(collectFileIds);
        }
      };

      collectFileIds(fileToDelete);

      // Close all tabs for files being deleted
      filesToClose.forEach((id) => {
        setOpenTabs((prev) => prev.filter((tab) => tab.fileId !== id));
      });

      // If active tab is being deleted, switch to another tab
      if (filesToClose.includes(activeTabId)) {
        const remainingTabs = openTabs.filter(
          (tab) => !filesToClose.includes(tab.fileId)
        );
        if (remainingTabs.length > 0) {
          const newActiveTab = remainingTabs[remainingTabs.length - 1];
          setActiveTabId(newActiveTab.fileId);
          const fileNode = findFileById(fileTree, newActiveTab.fileId);
          setSelectedFile(fileNode || null);
        } else {
          setActiveTabId("");
          setSelectedFile(null);
        }
      }
    }

    // Remove from file tree
    setFileTree((prev) => removeFromTree(prev, fileId));
  };

  const removeFromTree = (
    nodes: FileNode[],
    idToRemove: string
  ): FileNode[] => {
    return nodes
      .filter((node) => node.id !== idToRemove)
      .map((node) => ({
        ...node,
        children: node.children
          ? removeFromTree(node.children, idToRemove)
          : undefined,
      }));
  };

  const renameFile = (fileId: string, newName: string) => {
    setFileTree((prev) => renameInTree(prev, fileId, newName));

    // Update tab name if file is open
    setOpenTabs((prev) =>
      prev.map((tab) =>
        tab.fileId === fileId ? { ...tab, fileName: newName } : tab
      )
    );
  };

  const renameInTree = (
    nodes: FileNode[],
    fileId: string,
    newName: string
  ): FileNode[] => {
    return nodes.map((node) => {
      if (node.id === fileId) {
        return { ...node, name: newName };
      }
      if (node.children) {
        return {
          ...node,
          children: renameInTree(node.children, fileId, newName),
        };
      }
      return node;
    });
  };

  const moveFile = (fileId: string, targetFolderId: string | null) => {
    // console.log("moveFile called:", { fileId, targetFolderId });

    // Find the file to move
    const fileToMove = findFileById(fileTree, fileId);
    if (!fileToMove) {
      // console.log("File to move not found:", fileId);
      return;
    }

    // console.log("File to move:", fileToMove);

    // Prevent moving a folder into itself or its descendants
    if (fileToMove.type === "folder" && targetFolderId) {
      const isDescendant = (nodeId: string, searchIn: FileNode[]): boolean => {
        for (const node of searchIn) {
          if (node.id === nodeId) return true;
          if (node.children && isDescendant(nodeId, node.children)) return true;
        }
        return false;
      };

      if (
        fileToMove.children &&
        isDescendant(targetFolderId, fileToMove.children)
      ) {
        // console.log("Cannot move folder into itself");
        alert("Cannot move a folder into itself or its descendant folders.");
        return;
      }
    }

    // If targetFolderId is provided, make sure it's actually a folder
    if (targetFolderId) {
      const targetFolder = findFileById(fileTree, targetFolderId);
      if (!targetFolder || targetFolder.type !== "folder") {
        // console.log("Target is not a valid folder:", targetFolder);
        return;
      }
      // console.log("Target folder:", targetFolder);
    }

    // console.log("Before move - current tree:", fileTree);

    // Remove file from its current location
    const treeWithoutFile = removeFromTree(fileTree, fileId);
    // console.log("Tree without file:", treeWithoutFile);

    // Add file to new location
    let newTree: FileNode[];
    if (targetFolderId === null) {
      // Move to root
      newTree = [...treeWithoutFile, fileToMove];
      // console.log("Moving to root, new tree:", newTree);
    } else {
      // Move to specific folder
      newTree = addToFolder(treeWithoutFile, targetFolderId, fileToMove);
      // console.log("Moving to folder, new tree:", newTree);
    }

    setFileTree(newTree);
    // console.log("moveFile completed");
  };

  // Save functionality
  const saveToLocalStorage = (fileTree: FileNode[]) => {
    try {
      localStorage.setItem("safs-editor-files", JSON.stringify(fileTree));
      localStorage.setItem("safs-editor-timestamp", Date.now().toString());
      setSaveStatus("saved");
    } catch (error) {
      console.error("Failed to save to localStorage:", error);
      setSaveStatus("unsaved");
    }
  };

  const loadFromLocalStorage = (): FileNode[] | null => {
    try {
      const saved = localStorage.getItem("safs-editor-files");
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.error("Failed to load from localStorage:", error);
      return null;
    }
  };

  const saveCurrentFile = async () => {
    if (!activeTabId) return;

    setSaveStatus("saving");

    // Update the tab's original content to mark it as saved
    setOpenTabs((prev) =>
      prev.map((tab) =>
        tab.fileId === activeTabId
          ? { ...tab, isDirty: false, originalContent: tab.content }
          : tab
      )
    );

    // Save to localStorage (in a real app, this would be an API call)
    setTimeout(() => {
      saveToLocalStorage(fileTree);
    }, 500); // Simulate save delay
  };

  const saveAllFiles = async () => {
    setSaveStatus("saving");

    // Mark all tabs as saved
    setOpenTabs((prev) =>
      prev.map((tab) => ({
        ...tab,
        isDirty: false,
        originalContent: tab.content,
      }))
    );

    // Save to localStorage
    setTimeout(() => {
      saveToLocalStorage(fileTree);
    }, 500);
  };

  const hasUnsavedChanges = () => {
    return openTabs.some((tab) => tab.isDirty);
  };

  const resetToDefault = () => {
    if (
      !confirm(
        "Are you sure you want to reset to default? All unsaved changes will be lost."
      )
    ) {
      return;
    }

    // Clear localStorage
    localStorage.removeItem("safs-editor-files");
    localStorage.removeItem("safs-editor-timestamp");

    // Reset file tree to initial state
    setFileTree(initialFileTree);

    // Reset tabs to default (open main.py)
    const defaultTab: EditorTab = {
      fileId: initialFileTree[0].id,
      fileName: initialFileTree[0].name,
      content: initialFileTree[0].content || "",
      isDirty: false,
      originalContent: initialFileTree[0].content || "",
    };

    setOpenTabs([defaultTab]);
    setActiveTabId(initialFileTree[0].id);
    setSelectedFile(initialFileTree[0]);

    // Reset other states
    setSaveStatus("saved");
    setStdout("");
    setStderr("");
  };

  // Auto-save functionality
  useEffect(() => {
    if (!autoSave || !hasUnsavedChanges()) return;

    const autoSaveTimer = setTimeout(() => {
      saveAllFiles();
    }, 2000); // Auto-save after 2 seconds of inactivity

    return () => clearTimeout(autoSaveTimer);
  }, [fileTree, openTabs, autoSave]);

  // Workspace sharing functions
  const shareWorkspace = async () => {
    try {
      const url = await WorkspaceSerializer.createShareableURL(fileTree);
      await navigator.clipboard.writeText(url);
      setShareStatus("copied");

      // Reset back to "Share" after 2 seconds
      setTimeout(() => {
        setShareStatus("idle");
      }, 2000);
    } catch (error) {
      console.error("Failed to share workspace:", error);
      // Could show a brief error state here if needed
    }
  };

  const getCompressionInfo = async () => {
    try {
      if (workspacePopover.isOpen) {
        setWorkspacePopover({
          ...workspacePopover,
          isOpen: false,
        });
        return;
      }

      const stats = await WorkspaceSerializer.getCompressionStats(fileTree);

      setWorkspacePopover({
        isOpen: true,
        type: "stats",
        content:
          `Original: ${stats.originalSize} bytes\n` +
          `Compressed: ${stats.compressedSize} bytes\n` +
          `Ratio: ${stats.compressionRatio.toFixed(2)}x\n` +
          `URL Length: ${stats.urlLength} chars`,
      });
    } catch (error) {
      console.error("Failed to get compression stats:", error);
      setWorkspacePopover({
        isOpen: true,
        type: "stats",
        content: "Failed to get compression stats",
      });
    }
  };

  // Load files on startup (check URL first, then localStorage)
  useEffect(() => {
    const loadWorkspace = async () => {
      try {
        // First try to load from URL hash
        const sharedWorkspace =
          await WorkspaceSerializer.loadWorkspaceFromURL();
        if (sharedWorkspace && sharedWorkspace.length > 0) {
          setFileTree(sharedWorkspace);
          const firstFile = getAllFiles(sharedWorkspace)[0];
          if (firstFile) {
            const newTab: EditorTab = {
              fileId: firstFile.id,
              fileName: firstFile.name,
              content: firstFile.content || "",
              isDirty: false,
              originalContent: firstFile.content || "",
            };
            setOpenTabs([newTab]);
            setActiveTabId(firstFile.id);
            setSelectedFile(firstFile);
          }
          return; // Don't load from localStorage if we loaded from URL
        }
      } catch (error) {
        console.error("Failed to load workspace from URL:", error);
      }

      // Fallback to localStorage
      const savedFiles = loadFromLocalStorage();
      if (savedFiles && savedFiles.length > 0) {
        // Clean up any duplicate entries that might have been created
        const cleanedFiles = removeDuplicatesByName(savedFiles);
        setFileTree(cleanedFiles);
        // Open the first file
        const firstFile = getAllFiles(cleanedFiles)[0];
        if (firstFile) {
          const newTab: EditorTab = {
            fileId: firstFile.id,
            fileName: firstFile.name,
            content: firstFile.content || "",
            isDirty: false,
            originalContent: firstFile.content || "",
          };
          setOpenTabs([newTab]);
          setActiveTabId(firstFile.id);
          setSelectedFile(firstFile);
        }
      }
    };

    loadWorkspace();
  }, []); // Only run on mount

  // Helper function to remove duplicate entries
  const removeDuplicatesByName = (nodes: FileNode[]): FileNode[] => {
    const seen = new Set<string>();
    return nodes.filter((node) => {
      if (seen.has(node.name)) {
        return false;
      }
      seen.add(node.name);
      if (node.children) {
        node.children = removeDuplicatesByName(node.children);
      }
      return true;
    });
  };

  // Tab management functions
  const openFileInTab = (file: FileNode) => {
    // Check if file is already open
    const existingTab = openTabs.find((tab) => tab.fileId === file.id);

    if (existingTab) {
      // Switch to existing tab
      setActiveTabId(file.id);
      setSelectedFile(file);
    } else {
      // Open new tab
      const newTab: EditorTab = {
        fileId: file.id,
        fileName: file.name,
        content: file.content || "",
        isDirty: false,
        originalContent: file.content || "",
      };

      setOpenTabs((prev) => [...prev, newTab]);
      setActiveTabId(file.id);
      setSelectedFile(file);
    }
  };

  const closeTab = (fileId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();

    const tabToClose = openTabs.find((tab) => tab.fileId === fileId);
    if (!tabToClose) return;

    // If tab has unsaved changes, you could add a confirmation dialog here
    if (tabToClose.isDirty) {
      if (!confirm(`Close ${tabToClose.fileName}? You have unsaved changes.`)) {
        return;
      }
    }

    const updatedTabs = openTabs.filter((tab) => tab.fileId !== fileId);
    setOpenTabs(updatedTabs);

    // If we're closing the active tab, switch to another tab
    if (activeTabId === fileId) {
      if (updatedTabs.length > 0) {
        const newActiveTab = updatedTabs[updatedTabs.length - 1];
        setActiveTabId(newActiveTab.fileId);
        const fileNode = findFileById(fileTree, newActiveTab.fileId);
        setSelectedFile(fileNode || null);
      } else {
        setActiveTabId("");
        setSelectedFile(null);
      }
    }
  };

  const switchToTab = (fileId: string) => {
    setActiveTabId(fileId);
    const fileNode = findFileById(fileTree, fileId);
    setSelectedFile(fileNode || null);
  };

  const updateTabContent = (fileId: string, content: string) => {
    setOpenTabs((prev) =>
      prev.map((tab) =>
        tab.fileId === fileId
          ? { ...tab, content, isDirty: content !== tab.originalContent }
          : tab
      )
    );

    // Also update the file tree content using the utility function
    setFileTree((prev) => updateFileContent(prev, fileId, content));
  };

  // Synchronized file tree updater that syncs changes with the editor
  const updateFileTreeWithSync = (
    updater: (prev: FileNode[]) => FileNode[]
  ) => {
    const oldFileTree = fileTree;
    const newFileTree = updater(oldFileTree);

    // Update the file tree
    setFileTree(newFileTree);

    // Check if any open tabs need to be updated
    openTabs.forEach((tab) => {
      const oldFile = findFileById(oldFileTree, tab.fileId);
      const newFile = findFileById(newFileTree, tab.fileId);

      if (oldFile && newFile && oldFile.content !== newFile.content) {
        // File content changed - update the tab
        setOpenTabs((prev) =>
          prev.map((prevTab) =>
            prevTab.fileId === tab.fileId
              ? {
                  ...prevTab,
                  content: newFile.content || "",
                  originalContent: newFile.content || "",
                  isDirty: false, // Reset dirty state since this is a tool change
                }
              : prevTab
          )
        );

        // If this is the currently active tab, update the editor content
        if (tab.fileId === activeTabId) {
          setCode(newFile.content || "");

          // Also update the Monaco editor model if it exists
          if (editorRef.current) {
            const model = editorRef.current.getModel();
            if (model) {
              model.setValue(newFile.content || "");
            }
          }
        }
      }
    });
  };

  const handleEditorMount = async (
    editor: editor.IStandaloneCodeEditor,
    monaco: Monaco
  ) => {
    console.log("=== EDITOR MOUNTED ===");
    setEditorReady(true);
    editorRef.current = editor;

    console.log("Editor instance:", editor);
    console.log("Editor model:", editor.getModel());
    console.log("Editor language:", editor.getModel()?.getLanguageId());

    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK,
      handleToggleCommandK
    );

    // Add some debugging for key events
    editor.onDidChangeModelContent(() => {
      const model = editor.getModel();
      if (model) {
        // console.log("Current content:", model.getValue());
        // console.log("Current position:", editor.getPosition());
      }
    });
  };

  // Get cursor screen position for popover
  const getCursorScreenPosition = () => {
    if (!editorRef.current) return { x: 0, y: 0 };

    const position = editorRef.current.getPosition();
    if (!position) return { x: 0, y: 0 };

    const coordinates = editorRef.current.getScrolledVisiblePosition(position);
    if (!coordinates) return { x: 0, y: 0 };

    const editorDom = editorRef.current.getDomNode();
    if (!editorDom) return { x: 0, y: 0 };

    const editorRect = editorDom.getBoundingClientRect();

    return {
      x: editorRect.left + coordinates.left,
      y: editorRect.top + coordinates.top - 10, // 10px above cursor
    };
  };

  // Get current code block context
  const getCurrentCodeBlock = () => {
    const model = editorRef.current?.getModel();
    const position = editorRef.current?.getPosition();
    if (!model || !position) return "";

    const currentLine = position.lineNumber;
    const currentLineContent = model.getLineContent(currentLine);
    const currentIndentation =
      currentLineContent.match(/^(\s*)/)?.[1]?.length || 0;

    let startLine = currentLine;
    let endLine = currentLine;

    // Find the start of the block
    for (let i = currentLine - 1; i >= 1; i--) {
      const lineContent = model.getLineContent(i);
      if (lineContent.trim() === "") continue;

      const lineIndentation = lineContent.match(/^(\s*)/)?.[1]?.length || 0;
      if (
        lineIndentation < currentIndentation ||
        (lineIndentation === currentIndentation &&
          lineContent.trim().endsWith(":"))
      ) {
        startLine = i;
        break;
      }
    }

    // Find the end of the block
    const totalLines = model.getLineCount();
    for (let i = currentLine + 1; i <= totalLines; i++) {
      const lineContent = model.getLineContent(i);
      if (lineContent.trim() === "") continue;

      const lineIndentation = lineContent.match(/^(\s*)/)?.[1]?.length || 0;
      if (lineIndentation < currentIndentation) {
        endLine = i - 1;
        break;
      }
      endLine = i;
    }

    // Get the block content
    const blockLines = [];
    for (let i = startLine; i <= endLine; i++) {
      blockLines.push(model.getLineContent(i));
    }

    return blockLines.join("\n");
  };

  const handleToggleCommandK = () => {
    if (aiPopover.isOpen) {
      // Close popover
      setAiPopover((prev) => ({ ...prev, isOpen: false, prompt: "" }));
    } else {
      // Open popover
      const position = getCursorScreenPosition();
      const codeContext = getCurrentCodeBlock();

      setAiPopover({
        isOpen: true,
        position,
        prompt: "",
        codeContext,
      });
    }
  };

  const handlePromptSubmit = async () => {
    if (!aiPopover.prompt.trim()) return;

    setIsGenerating(true);

    try {
      // Generate code suggestion using the configured AI provider
      let suggestedCode: string;

      if (aiConfig.type === "webllm") {
        // Initialize model if not already initialized
        if (!llmState.isInitialized && !llmState.isLoading) {
          await initializeModel(aiConfig.webllmModel);
        }
        suggestedCode = await webllmGenerateCode(aiPopover.prompt, "python");
      } else if (
        aiConfig.type === "api" &&
        aiConfig.apiProvider &&
        aiConfig.apiKey
      ) {
        suggestedCode = await apiProvider.generateCodeSuggestion(
          aiPopover.prompt,
          "python",
          {
            provider: aiConfig.apiProvider as "claude" | "gpt" | "gemini",
            apiKey: aiConfig.apiKey,
          }
        );
      } else {
        throw new Error("AI configuration not properly set up");
      }

      // Show diff viewer
      setDiffViewer({
        isOpen: true,
        originalCode: aiPopover.codeContext,
        suggestedCode: suggestedCode.trim(),
      });
    } catch (error) {
      console.error("Failed to generate code:", error);
      alert("Failed to generate code suggestion. Please try again.");
    } finally {
      setIsGenerating(false);
    }

    // Close popover
    setAiPopover((prev) => ({ ...prev, isOpen: false, prompt: "" }));
  };

  const handleApplyChanges = () => {
    if (!editorRef.current || !diffViewer.suggestedCode) return;

    // Apply the suggested code to the editor
    const model = editorRef.current.getModel();
    if (model) {
      // For now, replace the entire content - you could make this more sophisticated
      // by finding the exact range to replace based on the original code block
      model.setValue(diffViewer.suggestedCode);
    }
    setCode(diffViewer.suggestedCode);

    // Close diff viewer
    setDiffViewer({ isOpen: false, originalCode: "", suggestedCode: "" });
  };

  const handleRejectChanges = () => {
    setDiffViewer({ isOpen: false, originalCode: "", suggestedCode: "" });
  };

  const handlePromptKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handlePromptSubmit();
    } else if (e.key === "Escape") {
      setAiPopover((prev) => ({ ...prev, isOpen: false, prompt: "" }));
    }
  };

  useEffect(() => {
    workerRef.current = new PyodideWorker();
    workerRef.current.postMessage({ type: "init" });

    workerRef.current.onmessage = (event: MessageEvent) => {
      const { type, stdout, stderr, error } = event.data;

      if (type === "ready") {
        setPyodideReady(true);
      } else if (type === "result") {
        setStdout(stdout || "");
        setStderr(stderr || "");
        // setExecutionTime(executionTime || 0);
      } else if (type === "error") {
        setPyodideError(error || "Unknown error");
      }
    };

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        handleRunCode();
      }
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        handleToggleCommandK();
      }
      if (e.key === "s" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        saveCurrentFile();
      }
      if (e.key === "s" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        saveAllFiles();
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartY(e.clientY);
    setStartHeight(terminalTabHeight);
    e.preventDefault();
  };

  useEffect(() => {
    const initializePyright = async () => {
      if (!editorRef.current) return;
      const pyrightProvider = new MonacoPyrightProvider();
      await pyrightProvider.init(monaco);
      pyrightProviderRef.current = pyrightProvider;
      await pyrightProvider.setupDiagnostics(editorRef.current);
    };

    initializePyright();
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const deltaY = e.clientY - startY;
        const newHeight = startHeight - (deltaY / window.innerHeight) * 100;
        const boundedHeight = Math.max(10, Math.min(60, newHeight));
        setTerminalTabHeight(boundedHeight);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "row-resize";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isDragging, startY, startHeight]);

  const handleRunCode = async () => {
    if (workerRef.current) {
      // Get all files from the file tree
      const allFiles = getAllFiles(fileTree);

      // Convert to the format expected by the worker
      const filesForWorker = allFiles
        .filter((file) => file.content !== undefined) // Only include files with content
        .map((file) => ({
          path: getFilePath(file, fileTree),
          content: file.content || "",
        }));

      workerRef.current.postMessage({
        type: "run",
        code,
        files: filesForWorker,
      });
    }
  };

  // Agent Chat resize handlers
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleResize = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;

      const container = document.querySelector(
        ".main-content-area"
      ) as HTMLElement;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const newWidth = containerRect.right - e.clientX;
      const minWidth = 280;
      const maxWidth = containerRect.width * 0.6; // Max 60% of container width

      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      setAgentChatWidth(clampedWidth);
    },
    [isResizing]
  );

  const handleResizeEnd = () => {
    setIsResizing(false);
  };

  // Add global event listeners for resize
  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleResize);
      document.addEventListener("mouseup", handleResizeEnd);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      return () => {
        document.removeEventListener("mousemove", handleResize);
        document.removeEventListener("mouseup", handleResizeEnd);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }
  }, [isResizing, handleResize]);

  return (
    <div className="relative bg-[#1e1e1e] h-screen">
      {/* Loading Screen Overlay */}
      {!isFullyLoaded && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-50 flex flex-col justify-center items-center bg-[#1e1e1e]"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center gap-6"
          >
            <h1 className="text-4xl font-light text-white">Saf's Editor</h1>
            <div className="flex items-center gap-3 text-amber-500">
              <motion.div
                initial={{ rotate: 0 }}
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <LoaderCircle className="w-6 h-6" />
              </motion.div>
              <span className="text-lg">
                {!editorReady && !pyodideReady
                  ? "Initializing..."
                  : !editorReady
                  ? "Loading Editor..."
                  : "Loading Python..."}
              </span>
            </div>
            {pyodideError && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-red-400 text-center"
              >
                <p>Error: {pyodideError}</p>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}

      {/* Main Interface */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isFullyLoaded ? 1 : 0 }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
        className="flex flex-col h-screen"
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row items-center justify-between w-full px-4 py-2 border-b border-gray-600 bg-[#1e1e1e]">
          {isFullyLoaded && (
            <BlurFade delay={0.8} duration={0.6}>
              <h1 className="md:text-xl text-2xl font-normal text-white p-2 rounded-lg">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 2.0, duration: 0.9 }}
                  className="rounded-lg"
                >
                  <ShineBorder shineColor={["#3b82f6", "#8b5cf6", "#06b6d4"]} />
                </motion.div>
                <motion.span
                  initial={false}
                  animate={{
                    width: titleState === "full" ? "auto" : "3rem",
                  }}
                  transition={{
                    duration: 0.6,
                    ease: "easeInOut",
                    delay: titleState === "abbreviated" ? 0.4 : 0, // Delay shrinking until text fades out
                  }}
                  className="relative inline-block whitespace-nowrap"
                >
                  <motion.span
                    animate={{
                      opacity: titleState === "full" ? 1 : 0,
                    }}
                    transition={{
                      duration: 0.3,
                      ease: "easeInOut",
                      delay: titleState === "abbreviated" ? 0 : 0, // Fade out immediately when transitioning
                    }}
                    className="inline-block"
                  >
                    Saf's Editor
                  </motion.span>
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{
                      opacity: titleState === "abbreviated" ? 1 : 0,
                    }}
                    transition={{
                      duration: 0.3,
                      ease: "easeInOut",
                      delay: titleState === "abbreviated" ? 1.0 : 0, // Appear after text fades and border shrinks
                    }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    SE
                  </motion.span>
                </motion.span>
              </h1>
            </BlurFade>
          )}
          <div className="flex flex-1  justify-end items-center gap-2">
            {/* Save Status & Buttons */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">
                {saveStatus === "saving" && "Saving..."}
                {saveStatus === "saved" && "All changes saved"}
                {saveStatus === "unsaved" &&
                  hasUnsavedChanges() &&
                  "Unsaved changes"}
              </span>

              <Button
                size="sm"
                variant="ghost"
                onClick={saveCurrentFile}
                disabled={
                  !activeTabId ||
                  saveStatus === "saving" ||
                  !hasUnsavedChanges()
                }
                className="h-8 px-2"
              >
                <Save className="w-4 h-4 mr-1" />
                Save
              </Button>
              {/* 
              <Button
                size="sm"
                variant="ghost"
                onClick={saveAllFiles}
                disabled={!hasUnsavedChanges() || saveStatus === "saving"}
                className="h-8 px-2"
              >
                <SaveAll className="w-4 h-4 mr-1" />
                Save All
              </Button> */}

              {/* <Button
                size="sm"
                variant={autoSave ? "default" : "ghost"}
                onClick={() => setAutoSave(!autoSave)}
                className="h-8 px-2"
                title={autoSave ? "Auto-save enabled" : "Auto-save disabled"}
              >
                Auto
              </Button> */}

              <Button
                size="sm"
                variant="ghost"
                onClick={resetToDefault}
                className="h-8 px-2 text-red-400 hover:text-red-300"
                title="Reset to default file structure"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Reset
              </Button>

              <Button
                size="sm"
                variant={shareStatus === "copied" ? "default" : "outline"}
                onClick={shareWorkspace}
                className="h-8 px-2"
                title={
                  shareStatus === "copied"
                    ? "URL copied to clipboard!"
                    : "Share workspace via URL"
                }
                disabled={shareStatus === "copied"}
              >
                {shareStatus === "copied" ? (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    URL copied
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 mr-1" />
                    Copy URL
                  </>
                )}
              </Button>

              <Popover
                open={
                  workspacePopover.isOpen && workspacePopover.type === "stats"
                }
                onOpenChange={(open) =>
                  !open &&
                  setWorkspacePopover((prev) => ({ ...prev, isOpen: false }))
                }
              >
                <PopoverTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={getCompressionInfo}
                    className="h-8 px-2"
                    title="View compression statistics"
                  >
                    <BarChart3 className="w-4 h-4 mr-1" />
                    Stats
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-80 p-4"
                  side="bottom"
                  align="center"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-gray-200">
                        Compression Statistics
                      </h3>
                      <button
                        onClick={() =>
                          setWorkspacePopover((prev) => ({
                            ...prev,
                            isOpen: false,
                          }))
                        }
                        className="text-gray-400 hover:text-gray-200 text-lg leading-none"
                      >
                        ×
                      </button>
                    </div>
                    <div className="text-sm text-gray-300 whitespace-pre-line font-mono">
                      {workspacePopover.content}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">
                  {(aiConfig.type === "webllm" && llmState.isInitialized) ||
                  (aiConfig.type === "api" && aiConfig.apiKey) ? (
                    <>
                      <div className="animate-pulse w-2 h-2 rounded-full bg-green-500" />
                      AI Model Ready
                    </>
                  ) : (
                    <>
                      <div className="animate-pulse w-2 h-2 rounded-full bg-amber-500" />
                      Initialize AI Model
                    </>
                  )}
                </Button>
              </DialogTrigger>
              <AISetupDialog
                currentConfig={aiConfig}
                onSave={saveAiConfig}
                onInitializeWebLLM={initializeModel}
                isWebLLMLoading={llmState.isLoading}
                webLLMProgress={llmState.progress}
                cancelInitializeModel={cancelInitializeModel}
              />
            </Dialog>
            <Button onClick={handleRunCode} variant="outline">
              {getAllFiles(fileTree).some((file) => file.name === "main.py")
                ? "Run main.py (Cmd + Enter)"
                : "Run Code (Cmd + Enter)"}
            </Button>
            <Button
              onClick={() => setShowAgentChat(!showAgentChat)}
              variant={showAgentChat ? "default" : "outline"}
              className="h-8 px-3"
            >
              🤖 Agent Chat
            </Button>
            <PackageLibrary pyodideWorker={workerRef.current || undefined} />
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex flex-row flex-1 overflow-hidden main-content-area">
          <FileExplorer
            fileTree={fileTree}
            className={`${
              showAgentChat ? "w-1/5" : "w-1/4"
            } border-r border-gray-600 flex-shrink-0`}
            onSelectFile={openFileInTab}
            selectedFileId={activeTabId}
            onCreateFile={createFile}
            onDeleteFile={deleteFile}
            onRenameFile={renameFile}
            onMoveFile={moveFile}
          />

          <div
            className="flex flex-col flex-1"
            style={
              showAgentChat
                ? { width: `calc(100% - 20% - ${agentChatWidth}px)` }
                : {}
            }
          >
            {/* Tab Bar */}
            {openTabs.length > 0 && (
              <div className="flex bg-[#2d2d2d] border-b border-gray-600 overflow-x-auto">
                {openTabs.map((tab) => (
                  <div
                    key={tab.fileId}
                    className={`flex items-center px-3 py-2 border-r border-gray-600 cursor-pointer hover:bg-[#3e3e3e] min-w-0 ${
                      activeTabId === tab.fileId ? "bg-[#1e1e1e]" : ""
                    }`}
                    onClick={() => switchToTab(tab.fileId)}
                  >
                    <span className="text-sm text-gray-300 truncate">
                      {tab.fileName}
                      {tab.isDirty && (
                        <span className="ml-1 text-amber-400">•</span>
                      )}
                    </span>
                    <button
                      onClick={(e) => closeTab(tab.fileId, e)}
                      className="ml-2 text-gray-400 hover:text-gray-200 hover:bg-gray-600 rounded p-1 text-xs"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Editor */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {selectedFile ? (
                <Editor
                  height="100%"
                  defaultLanguage="python"
                  value={
                    openTabs.find((tab) => tab.fileId === activeTabId)
                      ?.content || ""
                  }
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    quickSuggestions: {
                      other: true,
                      comments: true,
                      strings: true,
                    },
                    suggestOnTriggerCharacters: true,
                    acceptSuggestionOnCommitCharacter: true,
                    acceptSuggestionOnEnter: "on",
                    tabCompletion: "on",
                    wordBasedSuggestions: "allDocuments",
                    // Enable all suggestion types
                    suggest: {
                      showWords: true,
                      showSnippets: true,
                      showKeywords: true,
                      showFunctions: true,
                      showVariables: true,
                      showClasses: true,
                      showModules: true,
                      showProperties: true,
                      showMethods: true,
                      showValues: true,
                      showEnums: true,
                      showConstants: true,
                      showConstructors: true,
                      showInterfaces: true,
                      showStructs: true,
                      showEvents: true,
                      showOperators: true,
                      showTypeParameters: true,
                      showFolders: true,
                      showFiles: true,
                      showReferences: true,
                      showUsers: true,
                      showIssues: true,
                      showColors: true,
                    },
                  }}
                  onChange={(value) => {
                    setCode(value || "");
                    updateTabContent(activeTabId, value || "");
                  }}
                  onMount={handleEditorMount}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400">
                  <span>No file selected</span>
                </div>
              )}
            </div>
          </div>

          {/* Agent Chat Panel */}
          {showAgentChat && (
            <div
              className="border-l border-gray-600 flex flex-shrink-0 relative"
              style={{ width: `${agentChatWidth}px` }}
            >
              {/* Resize Handle */}
              <div
                className={`absolute left-0 top-0 bottom-0 w-1 bg-transparent hover:bg-blue-500 cursor-col-resize z-10 transition-colors ${
                  isResizing ? "bg-blue-500" : ""
                }`}
                onMouseDown={handleResizeStart}
                style={{ marginLeft: "-2px" }}
                title="Drag to resize Agent Chat"
              >
                {/* Visual indicator for resize handle */}
                <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1 h-8 bg-gray-500 opacity-0 hover:opacity-100 transition-opacity" />
              </div>
              <AgentChat
                fileTree={fileTree}
                updateFileTree={updateFileTreeWithSync}
                pyodideWorker={workerRef.current || undefined}
                className="h-full w-full"
              />
            </div>
          )}
        </div>
        {/* AI Prompt Popover */}
        <Popover
          open={aiPopover.isOpen}
          onOpenChange={(open) =>
            setAiPopover((prev) => ({
              ...prev,
              isOpen: open,
              prompt: open ? prev.prompt : "",
            }))
          }
        >
          <PopoverTrigger asChild>
            <div
              style={{
                position: "fixed",
                left: aiPopover.position.x,
                top: aiPopover.position.y,
                width: 1,
                height: 1,
                pointerEvents: "none",
              }}
            />
          </PopoverTrigger>
          <PopoverContent
            className="w-96 p-3"
            side="top"
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-200">
                  Ask AI to edit your code
                </h3>
                <button
                  onClick={() =>
                    setAiPopover((prev) => ({
                      ...prev,
                      isOpen: false,
                      prompt: "",
                    }))
                  }
                  className="text-gray-400 hover:text-gray-200 text-lg leading-none"
                >
                  ×
                </button>
              </div>
              <Textarea
                rows={4}
                value={aiPopover.prompt}
                onChange={(e) =>
                  setAiPopover((prev) => ({ ...prev, prompt: e.target.value }))
                }
                onKeyDown={handlePromptKeyDown}
                placeholder="Describe the changes you want to make..."
                className="resize-none"
                autoFocus
              />
              <div className="flex justify-end space-x-2">
                <Button
                  onClick={() =>
                    setAiPopover((prev) => ({
                      ...prev,
                      isOpen: false,
                      prompt: "",
                    }))
                  }
                  variant="ghost"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePromptSubmit}
                  variant="outline"
                  disabled={!aiPopover.prompt.trim() || isGenerating}
                >
                  {isGenerating && (
                    <LoaderCircle className="w-3 h-3 animate-spin" />
                  )}
                  <span>{isGenerating ? "Generating..." : "Send"}</span>
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* AI Diff Viewer */}
        {diffViewer.isOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="max-w-6xl w-full max-h-[80vh] overflow-hidden">
              <MonacoDiffViewer
                originalCode={diffViewer.originalCode}
                suggestedCode={diffViewer.suggestedCode}
                language="python"
                onApply={handleApplyChanges}
                onReject={handleRejectChanges}
                height="500px"
              />
            </div>
          </div>
        )}

        {/* Terminal Resizer */}
        <div
          className="w-full h-1 bg-gray-700 flex items-center justify-center cursor-row-resize hover:bg-gray-600 transition-colors flex-shrink-0"
          onMouseDown={handleMouseDown}
        >
          <GripHorizontal className="w-8 h-3 text-gray-400" />
        </div>

        {/* Terminal Section */}
        <div
          className="w-full flex-shrink-0 bg-[#1e1e1e] border-t border-gray-600"
          style={{ height: `${terminalTabHeight}vh` }}
        >
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="h-full flex flex-col"
          >
            <TabsList className="sticky top-0 bg-[#1e1e1e] z-10">
              <TabsTrigger value="stdout">Stdout</TabsTrigger>
              <TabsTrigger value="stderr">
                {stderr.length > 0 && (
                  <TriangleAlert className="w-4 h-4 text-amber-500" />
                )}
                Stderr
              </TabsTrigger>
            </TabsList>
            <TabsContent value="stdout" className="flex-1 overflow-auto p-2">
              <div className="w-full">
                <pre className="text-white text-xs whitespace-pre-wrap font-mono">
                  {stdout}
                </pre>
              </div>
            </TabsContent>
            <TabsContent value="stderr" className="flex-1 overflow-auto p-2">
              <div className="w-full">
                <pre className="text-white text-xs whitespace-pre-wrap font-mono">
                  {stderr}
                </pre>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </motion.div>
    </div>
  );
}

export default App;
