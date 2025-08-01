import type { AgentTool, ToolResult } from "./types";

const installedPackages = new Set<string>();

export const installPackageTool: AgentTool = {
  name: "install_package",
  description: "Install a package in the Python environment",
  parameters: {
    type: "object",
    properties: {
      packageName: {
        type: "string",
        description: "The name of the package to install",
      },
    },
    required: ["packageName"],
  },
  async execute(params: {
    packageName: string;
    pyodideWorker: Worker;
  }): Promise<ToolResult> {
    const { packageName, pyodideWorker } = params;

    if (installedPackages.has(packageName)) {
      return {
        success: true,
        data: {
          message: `Package ${packageName} already installed`,
        },
      };
    }

    // Await a response from the worker by wrapping the onmessage in a Promise
    const result = await new Promise<{
      success: boolean;
      message?: string;
      error?: string;
    }>((resolve) => {
      // Save any previous handler to restore later (optional, for safety)
      const prevHandler = pyodideWorker.onmessage;
      pyodideWorker.onmessage = (event) => {
        if (event.data.type === "success") {
          installedPackages.add(packageName);
          resolve({ success: true, message: event.data.message });
        } else if (event.data.type === "error") {
          resolve({ success: false, error: event.data.error });
        }
        // Optionally restore previous handler
        if (prevHandler) pyodideWorker.onmessage = prevHandler;
      };
      pyodideWorker.postMessage({
        type: "install",
        packageName,
      });
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || `Failed to install package ${packageName}`,
      };
    }
    return {
      success: true,
      data: {
        message: `Installed package ${packageName}`,
      },
    };
  },
};

export const listPackagesTool: AgentTool = {
  name: "list_packages",
  description: "List all installed packages in the Python environment",
  parameters: {
    type: "object",
    properties: {},
  },
  async execute(): Promise<ToolResult> {
    return {
      success: true,
      data: {
        packages: Array.from(installedPackages),
      },
    };
  },
};

export const packageManagementTools = [installPackageTool, listPackagesTool];
