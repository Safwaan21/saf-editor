import "./App.css";
import { Editor } from "@monaco-editor/react";
import { useState, useEffect, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Button } from "./components/ui/button";
import { Dialog, DialogTrigger } from "./components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./components/ui/popover";
import { TriangleAlert, GripHorizontal, LoaderCircle } from "lucide-react";
import { motion } from "motion/react";
import PyodideWorker from "./pyodideWorker.ts?worker";
import type { editor } from "monaco-editor";
import * as monaco from "monaco-editor";
import { useWebLLM } from "./hooks/useWebLLM";
import { useAPIProvider } from "./hooks/useAPIProvider";
import { useAIConfig } from "./hooks/useAIConfig";
import { AISetupDialog } from "./components/AISetupDialog";
import { MonacoDiffViewer } from "./components/MonacoDiffViewer";

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
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
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

  // Switch to stderr tab when there's an error, or back to stdout on successful runs
  useEffect(() => {
    if (stderr.length > 0) {
      setActiveTab("stderr");
    } else if (stdout.length > 0 && stderr.length === 0) {
      setActiveTab("stdout");
    }
  }, [stderr, stdout]);

  const handleEditorMount = (editor: editor.IStandaloneCodeEditor) => {
    setEditorReady(true);
    editorRef.current = editor;
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK,
      handleToggleCommandK
    );
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
        suggestedCode = await webllmGenerateCode(
          aiPopover.prompt,
          aiPopover.codeContext,
          "python"
        );
      } else if (
        aiConfig.type === "api" &&
        aiConfig.apiProvider &&
        aiConfig.apiKey
      ) {
        suggestedCode = await apiProvider.generateCodeSuggestion(
          aiPopover.prompt,
          aiPopover.codeContext,
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

      console.log("=== AI Generation ===");
      console.log("User Input:", aiPopover.prompt);
      console.log("Original Code:", aiPopover.codeContext);
      console.log("AI Suggestion:", suggestedCode);
      console.log("====================");
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
    console.log("init");
    workerRef.current = new PyodideWorker();
    console.log(workerRef.current);
    workerRef.current.postMessage({ type: "init" });

    workerRef.current.onmessage = (event: MessageEvent) => {
      const { type, stdout, stderr, error } = event.data;

      if (type === "ready") {
        setPyodideReady(true);
      } else if (type === "result") {
        setStdout(stdout || "");
        setStderr(stderr || "");
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
      workerRef.current.postMessage({ type: "run", code });
    }
  };

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
        className="flex flex-col justify-center items-center h-screen"
      >
        <div className="flex flex-col md:flex-row items-center justify-between w-full px-4 gap-2 mb-2">
          <div className="flex-1"></div>
          <h1 className="h-[5vh] md:text-xl mt-4 text-2xl font-normal text-white ">
            Saf's Editor
          </h1>
          <div className="flex-1 flex justify-end items-center gap-2">
            <Dialog>
              <DialogTrigger>
                <Button variant="outline">
                  {(aiConfig.type === "webllm" && llmState.isInitialized) ||
                  (aiConfig.type === "api" && aiConfig.apiKey) ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-green-500" />
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
              />
            </Dialog>
            <Button onClick={handleRunCode} variant="outline">
              Run Code (Cmd + Enter)
            </Button>
          </div>
        </div>

        <Editor
          height={`${95 - terminalTabHeight}vh`}
          defaultLanguage="python"
          defaultValue={code}
          theme="vs-dark"
          options={{ minimap: { enabled: false } }}
          onChange={(value) => setCode(value || "")}
          onMount={handleEditorMount}
        />

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
              <textarea
                value={aiPopover.prompt}
                onChange={(e) =>
                  setAiPopover((prev) => ({ ...prev, prompt: e.target.value }))
                }
                onKeyDown={handlePromptKeyDown}
                placeholder="Describe the changes you want to make..."
                className="w-full h-20 px-3 py-2 text-sm bg-gray-800 border border-gray-600 rounded-md text-gray-100 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() =>
                    setAiPopover((prev) => ({
                      ...prev,
                      isOpen: false,
                      prompt: "",
                    }))
                  }
                  className="px-3 py-1.5 text-sm text-gray-300 hover:text-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePromptSubmit}
                  disabled={!aiPopover.prompt.trim() || isGenerating}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isGenerating && (
                    <LoaderCircle className="w-3 h-3 animate-spin" />
                  )}
                  <span>{isGenerating ? "Generating..." : "Send"}</span>
                </button>
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

        <div
          className="w-full h-1 bg-gray-700 flex items-center justify-center cursor-row-resize hover:bg-gray-600 transition-colors"
          onMouseDown={handleMouseDown}
        >
          <GripHorizontal className="w-8 h-3 text-gray-400" />
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full pt-2 px-2 font-mono overflow-y-auto"
          style={{ height: `${terminalTabHeight}vh` }}
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
          <TabsContent value="stdout">
            <div className="w-full">
              <h1 className="text-white whitespace-pre-wrap">{stdout}</h1>
            </div>
          </TabsContent>
          <TabsContent value="stderr">
            <div className="w-full">
              <h1 className="text-white whitespace-pre-wrap">{stderr}</h1>
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}

export default App;
