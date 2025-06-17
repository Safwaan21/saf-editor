/// <reference lib="webworker" />

import { loadPyodide, type PyodideInterface } from "pyodide";

let pyodide: PyodideInterface | null = null;

self.onmessage = async (event) => {
  const { type, code } = event.data;

  if (type === "init") {
    try {
      pyodide = await loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/",
      });

      await pyodide.runPythonAsync(`
        import sys
        import traceback
        class Catcher:
            def __init__(self):
                self.content = ""
            def write(self, s):
                self.content += s
            def flush(self): pass
        sys.stdout = Catcher()
        sys.stderr = Catcher()
      `);

      self.postMessage({ type: "ready" });
    } catch (err) {
      self.postMessage({
        type: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  if (type === "run" && pyodide) {
    try {
      const startTime = performance.now();

      await pyodide.runPythonAsync(`
        try:
            exec(${JSON.stringify(code)})
        except Exception as e:
            import traceback
            sys.stderr.content += traceback.format_exc()
      `);

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      const stdout = await pyodide.runPythonAsync("sys.stdout.content");
      const stderr = await pyodide.runPythonAsync("sys.stderr.content");

      await pyodide.runPythonAsync("sys.stdout.content = ''");
      await pyodide.runPythonAsync("sys.stderr.content = ''");
      self.postMessage({
        type: "result",
        stdout,
        stderr,
        executionTime: executionTime,
      });
    } catch (err) {
      self.postMessage({
        type: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }
};
