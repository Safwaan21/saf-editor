import "./App.css";
import { Editor } from "@monaco-editor/react";
import { useState, useEffect, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Button } from "./components/ui/button";
import { TriangleAlert, GripHorizontal, LoaderCircle } from "lucide-react";
import { motion } from "motion/react";
import PyodideWorker from "./pyodideWorker.ts?worker";
import type { editor } from "monaco-editor";
import * as monaco from "monaco-editor";

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

  const isFullyLoaded = pyodideReady && editorReady;

  const handleEditorMount = (editor: editor.IStandaloneCodeEditor) => {
    setEditorReady(true);
    editorRef.current = editor;
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK,
      handleToggleCommandK
    );
  };

  const handleToggleCommandK = () => {};

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

        <div
          className="w-full h-1 bg-gray-700 flex items-center justify-center cursor-row-resize hover:bg-gray-600 transition-colors"
          onMouseDown={handleMouseDown}
        >
          <GripHorizontal className="w-8 h-3 text-gray-400" />
        </div>

        <Tabs
          defaultValue="stdout"
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
