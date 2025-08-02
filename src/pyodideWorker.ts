/// <reference lib="webworker" />

import { loadPyodide, type PyodideInterface } from "pyodide";

interface FileData {
  path: string;
  content: string;
}

let pyodide: PyodideInterface | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let micropip: any = null;

self.onmessage = async (event) => {
  const { type, code, files, packageName } = event.data;

  if (type === "init") {
    try {
      pyodide = await loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/",
      });
      await pyodide.loadPackage("micropip");
      micropip = pyodide.pyimport("micropip");

      await pyodide.runPythonAsync(`
        import sys
        import traceback
        import os
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

  if (type === "install") {
    console.log(`Installing package ${packageName}`);
    try {
      await micropip.install(packageName);
      self.postMessage({
        type: "success",
        message: `Installed package ${packageName}`,
      });
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

      // Write all files to the virtual file system
      if (files && Array.isArray(files)) {
        for (const file of files as FileData[]) {
          // Create directories if they don't exist
          const dirPath = file.path.substring(0, file.path.lastIndexOf("/"));
          if (dirPath) {
            await pyodide.runPythonAsync(`
              import os
              os.makedirs('${dirPath}', exist_ok=True)
            `);
          }

          // Write the file content
          pyodide.FS.writeFile(file.path, file.content);
        }
      }

      // Always run main.py if it exists, otherwise fall back to the provided code
      let hasMainPy = false;
      if (files && Array.isArray(files)) {
        hasMainPy = (files as FileData[]).some(
          (file) => file.path === "main.py"
        );
      }

      if (hasMainPy) {
        // Run main.py as the entry point
        await pyodide.runPythonAsync(`
          try:
              with open('main.py', 'r') as f:
                  main_code = f.read()
              exec(main_code)
          except Exception as e:
              import traceback
              sys.stderr.content += traceback.format_exc()
        `);
      } else {
        // Fallback to running the provided code directly
        await pyodide.runPythonAsync(`
          try:
              exec(${JSON.stringify(code)})
          except Exception as e:
              import traceback
              sys.stderr.content += traceback.format_exc()
        `);
      }

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
