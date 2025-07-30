/**
 * Code Execution Tools for AI Agents
 *
 * These tools provide AI agents with the ability to execute code,
 * leveraging the existing Pyodide worker infrastructure.
 */

import type { FileNode } from "../App";
import type {
  AgentTool,
  ToolResult,
  CodeExecutionParams,
  CodeExecutionResult,
} from "./types";

/**
 * Interface for Pyodide worker communication
 */
interface PyodideWorkerMessage {
  type: "init" | "run" | "ready" | "result" | "error";
  code?: string;
  files?: Array<{ path: string; content: string }>;
  stdout?: string;
  stderr?: string;
  executionTime?: number;
  error?: string;
}

/**
 * Utility function to convert FileNode tree to file array for Pyodide
 * @param nodes - FileNode array
 * @param basePath - Base path prefix
 * @returns Array of files for Pyodide worker
 */
function convertFileTreeToFiles(
  nodes: FileNode[],
  basePath: string = ""
): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = [];

  for (const node of nodes) {
    const currentPath = basePath ? `${basePath}/${node.name}` : node.name;

    if (node.type === "file" && node.content !== undefined) {
      files.push({
        path: currentPath,
        content: node.content,
      });
    }

    if (node.type === "folder" && node.children) {
      files.push(...convertFileTreeToFiles(node.children, currentPath));
    }
  }

  return files;
}

/**
 * Tool: Execute Python Code
 * Executes Python code using the Pyodide worker with optional file context
 *
 * @param code - Python code to execute
 * @param files - Optional files to include in execution context
 * @param timeout - Execution timeout in milliseconds
 * @returns Execution result with stdout, stderr, and timing
 */
export const executePythonTool: AgentTool = {
  name: "execute_python",
  description:
    "Execute Python code using the Pyodide runtime with optional file context",
  parameters: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "Python code to execute",
      },
      files: {
        type: "array",
        description: "Optional files to include in execution context",
        items: {
          type: "object",
          properties: {
            path: { type: "string", description: "File path" },
            content: { type: "string", description: "File content" },
          },
          required: ["path", "content"],
        },
      },
      timeout: {
        type: "number",
        description: "Execution timeout in milliseconds (default: 30000)",
        default: 30000,
      },
    },
    required: ["code"],
  },

  async execute(
    params: CodeExecutionParams & {
      pyodideWorker?: Worker;
    }
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const { code, files = [], timeout = 30000, pyodideWorker } = params;

      if (!pyodideWorker) {
        return {
          success: false,
          error:
            "Pyodide worker not available. Please ensure the worker is initialized.",
          metadata: {
            executionTime: Date.now() - startTime,
          },
        };
      }

      // Create a promise that resolves when worker responds
      const executionPromise = new Promise<CodeExecutionResult>(
        (resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error(`Code execution timed out after ${timeout}ms`));
          }, timeout);

          const handleMessage = (event: MessageEvent<PyodideWorkerMessage>) => {
            const { type, stdout, stderr, executionTime, error } = event.data;

            if (type === "result") {
              clearTimeout(timeoutId);
              pyodideWorker.removeEventListener("message", handleMessage);

              resolve({
                stdout: stdout || "",
                stderr: stderr || "",
                executionTime: executionTime || 0,
                success: true,
              });
            } else if (type === "error") {
              clearTimeout(timeoutId);
              pyodideWorker.removeEventListener("message", handleMessage);

              resolve({
                stdout: "",
                stderr: error || "Unknown execution error",
                executionTime: Date.now() - startTime,
                success: false,
                error: error || "Unknown execution error",
              });
            }
          };

          pyodideWorker.addEventListener("message", handleMessage);

          // Send execution request
          pyodideWorker.postMessage({
            type: "run",
            code,
            files,
          });
        }
      );

      const result = await executionPromise;

      return {
        success: result.success,
        data: result,
        error: result.error,
        metadata: {
          executionTime: Date.now() - startTime,
          codeLength: code.length,
          filesIncluded: files.length,
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
 * Tool: Execute Code with Workspace Context
 * Executes Python code with the entire workspace file tree as context
 *
 * @param code - Python code to execute
 * @param timeout - Execution timeout in milliseconds
 * @returns Execution result with stdout, stderr, and timing
 */
export const executeWithWorkspaceTool: AgentTool = {
  name: "execute_with_workspace",
  description:
    "Execute Python code with the entire workspace file tree as context",
  parameters: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "Python code to execute",
      },
      timeout: {
        type: "number",
        description: "Execution timeout in milliseconds (default: 30000)",
        default: 30000,
      },
    },
    required: ["code"],
  },

  async execute(
    params: CodeExecutionParams & {
      pyodideWorker?: Worker;
      fileTree: FileNode[];
    }
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const { code, timeout = 30000, pyodideWorker, fileTree } = params;

      if (!pyodideWorker) {
        return {
          success: false,
          error:
            "Pyodide worker not available. Please ensure the worker is initialized.",
          metadata: {
            executionTime: Date.now() - startTime,
          },
        };
      }

      // Convert file tree to files array
      const files = convertFileTreeToFiles(fileTree);

      // Use the existing execute tool with workspace files
      const executionResult = await executePythonTool.execute({
        language: "python",
        code,
        files,
        timeout,
        pyodideWorker,
      });

      return {
        ...executionResult,
        metadata: {
          ...executionResult.metadata,
          workspaceFilesIncluded: files.length,
          totalExecutionTime: Date.now() - startTime,
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
 * Tool: Run Main Script
 * Executes the main.py file if it exists, or fallback to provided code
 *
 * @param fallbackCode - Code to run if main.py doesn't exist
 * @param timeout - Execution timeout in milliseconds
 * @returns Execution result with stdout, stderr, and timing
 */
export const runMainScriptTool: AgentTool = {
  name: "run_main_script",
  description:
    "Execute the main.py file from the workspace, or fallback to provided code",
  parameters: {
    type: "object",
    properties: {
      fallbackCode: {
        type: "string",
        description: "Code to execute if main.py doesn't exist (optional)",
      },
      timeout: {
        type: "number",
        description: "Execution timeout in milliseconds (default: 30000)",
        default: 30000,
      },
    },
    required: [],
  },

  async execute(params: {
    fallbackCode?: string;
    timeout?: number;
    pyodideWorker?: Worker;
    fileTree: FileNode[];
  }): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const {
        fallbackCode = "",
        timeout = 30000,
        pyodideWorker,
        fileTree,
      } = params;

      if (!pyodideWorker) {
        return {
          success: false,
          error:
            "Pyodide worker not available. Please ensure the worker is initialized.",
          metadata: {
            executionTime: Date.now() - startTime,
          },
        };
      }

      // Convert file tree to files array
      const files = convertFileTreeToFiles(fileTree);

      // Check if main.py exists
      const hasMainPy = files.some((file) => file.path === "main.py");

      if (!hasMainPy && !fallbackCode) {
        return {
          success: false,
          error: "No main.py file found and no fallback code provided",
          metadata: {
            executionTime: Date.now() - startTime,
          },
        };
      }

      // Use the existing execute tool
      const executionResult = await executePythonTool.execute({
        language: "python",
        code: fallbackCode, // Pyodide worker will prefer main.py if it exists
        files,
        timeout,
        pyodideWorker,
      });

      return {
        ...executionResult,
        metadata: {
          ...executionResult.metadata,
          executedMainPy: hasMainPy,
          usedFallback: !hasMainPy && fallbackCode.length > 0,
          totalExecutionTime: Date.now() - startTime,
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
 * Tool: Test Code
 * Executes Python code in a safe test environment with validation
 *
 * @param code - Python code to test
 * @param expectedOutput - Optional expected output for validation
 * @param timeout - Execution timeout in milliseconds
 * @returns Test result with validation information
 */
export const testCodeTool: AgentTool = {
  name: "test_code",
  description:
    "Execute Python code in a test environment with optional output validation",
  parameters: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description: "Python code to test",
      },
      expectedOutput: {
        type: "string",
        description: "Expected output for validation (optional)",
      },
      timeout: {
        type: "number",
        description: "Execution timeout in milliseconds (default: 15000)",
        default: 15000,
      },
    },
    required: ["code"],
  },

  async execute(params: {
    code: string;
    expectedOutput?: string;
    timeout?: number;
    pyodideWorker?: Worker;
  }): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const { code, expectedOutput, timeout = 15000, pyodideWorker } = params;

      if (!pyodideWorker) {
        return {
          success: false,
          error:
            "Pyodide worker not available. Please ensure the worker is initialized.",
          metadata: {
            executionTime: Date.now() - startTime,
          },
        };
      }

      // Execute the code
      const executionResult = await executePythonTool.execute({
        language: "python",
        code,
        files: [], // No files for basic testing
        timeout,
        pyodideWorker,
      });

      if (!executionResult.success) {
        return executionResult;
      }

      const result = executionResult.data as CodeExecutionResult;

      // Validate output if expected output is provided
      let validationPassed = true;
      let validationMessage = "";

      if (expectedOutput !== undefined) {
        const actualOutput = result.stdout.trim();
        const expectedTrimmed = expectedOutput.trim();
        validationPassed = actualOutput === expectedTrimmed;
        validationMessage = validationPassed
          ? "Output matches expected result"
          : `Expected: "${expectedTrimmed}", Got: "${actualOutput}"`;
      }

      return {
        success: true,
        data: {
          ...result,
          testPassed: result.success && validationPassed,
          validationMessage,
          hasErrors: result.stderr.length > 0,
        },
        metadata: {
          executionTime: Date.now() - startTime,
          codeLength: code.length,
          outputValidated: expectedOutput !== undefined,
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

// Export all code execution tools
export const codeExecutionTools = [
  executePythonTool,
  executeWithWorkspaceTool,
  runMainScriptTool,
  testCodeTool,
];
