/**
 * AI Agent Tool Registry
 *
 * This is the main registry and integration point for all AI agent tools.
 * It provides a centralized way to register, manage, and execute tools.
 */

import type { FileNode } from "../App";
import type { AgentTool, ToolResult, AgentToolRegistry } from "./types";

// Import all tool collections
import { fileSystemTools } from "./fileSystemTools";
import { codeExecutionTools } from "./codeExecutionTools";
import { codeEditingTools } from "./codeEditingTools";
import { workspaceTools } from "./workspaceTools";
import { packageManagementTools } from "./packageManagementTools";

/**
 * Tool execution context interface
 * Contains all the necessary context and callbacks for tools to operate
 */
export interface ToolExecutionContext {
  /** Current file tree state */
  fileTree: FileNode[];

  /** Function to update the file tree */
  updateFileTree: (updater: (prev: FileNode[]) => FileNode[]) => void;

  /** Pyodide worker instance for code execution */
  pyodideWorker?: Worker;

  /** Additional context data */
  [key: string]: any;
}

/**
 * Agent Tool Registry Implementation
 * Manages registration and execution of AI agent tools
 */
class AgentToolRegistryImpl implements AgentToolRegistry {
  private tools: Map<string, AgentTool> = new Map();
  private context: ToolExecutionContext | null = null;

  /**
   * Register a new tool in the registry
   * @param tool - The tool to register
   */
  register(tool: AgentTool): void {
    if (this.tools.has(tool.name)) {
      console.warn(`Tool '${tool.name}' is already registered. Overwriting.`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Get a tool by name
   * @param name - Name of the tool to retrieve
   * @returns The tool if found, undefined otherwise
   */
  get(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   * @returns Array of all registered tools
   */
  getAll(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Check if a tool is registered
   * @param name - Name of the tool to check
   * @returns True if tool exists, false otherwise
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Set the execution context for tools
   * @param context - The execution context
   */
  setContext(context: ToolExecutionContext): void {
    this.context = context;
  }

  /**
   * Get the current execution context
   * @returns The current context or null if not set
   */
  getContext(): ToolExecutionContext | null {
    return this.context;
  }

  /**
   * Execute a tool by name with parameters
   * @param name - Name of the tool to execute
   * @param params - Parameters to pass to the tool
   * @returns Promise resolving to tool execution result
   */
  async execute(name: string, params: any): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const tool = this.tools.get(name);

      if (!tool) {
        return {
          success: false,
          error: `Tool '${name}' not found in registry`,
          metadata: {
            executionTime: Date.now() - startTime,
          },
        };
      }

      if (!this.context) {
        return {
          success: false,
          error:
            "Tool execution context not set. Please call setContext() first.",
          metadata: {
            executionTime: Date.now() - startTime,
          },
        };
      }

      // Merge context with parameters
      const enhancedParams = {
        ...params,
        ...this.context,
      };

      // Validate parameters before execution
      const validation = this.validateParameters(name, enhancedParams);
      if (!validation.valid) {
        return {
          success: false,
          error: `Parameter validation failed: ${validation.errors.join(", ")}`,
          metadata: {
            executionTime: Date.now() - startTime,
          },
        };
      }

      // Execute the tool
      const result = await tool.execute(enhancedParams);

      // Add registry metadata
      return {
        ...result,
        metadata: {
          ...result.metadata,
          toolName: name,
          registryExecutionTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error during tool execution",
        metadata: {
          toolName: name,
          registryExecutionTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Get tools by category
   * @param category - Category of tools to retrieve
   * @returns Array of tools in the specified category
   */
  getToolsByCategory(category: string): AgentTool[] {
    const categoryMap: Record<string, string[]> = {
      filesystem: fileSystemTools.map((t) => t.name),
      execution: codeExecutionTools.map((t) => t.name),
      editing: codeEditingTools.map((t) => t.name),
      workspace: workspaceTools.map((t) => t.name),
      packageManagement: packageManagementTools.map((t) => t.name),
    };

    const toolNames = categoryMap[category] || [];
    return toolNames
      .map((name) => this.tools.get(name))
      .filter(Boolean) as AgentTool[];
  }

  /**
   * Get tool schema for external integration (e.g., AI models)
   * @param name - Name of the tool
   * @returns Tool schema compatible with AI model function calling
   */
  getToolSchema(name: string): any {
    const tool = this.tools.get(name);
    if (!tool) return null;

    return {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    };
  }

  /**
   * Get all tool schemas for external integration
   * @returns Array of tool schemas
   */
  getAllToolSchemas(): any[] {
    return this.getAll().map((tool) => this.getToolSchema(tool.name));
  }

  /**
   * Validate tool parameters against schema
   * @param toolName - Name of the tool
   * @param params - Parameters to validate
   * @returns Validation result
   */
  validateParameters(
    toolName: string,
    params: any
  ): { valid: boolean; errors: string[] } {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return { valid: false, errors: [`Tool '${toolName}' not found`] };
    }

    const errors: string[] = [];
    const schema = tool.parameters;

    // Check required parameters
    if (schema.required) {
      for (const requiredParam of schema.required) {
        if (!(requiredParam in params)) {
          errors.push(`Missing required parameter: ${requiredParam}`);
        }
      }
    }

    // Basic type checking for properties
    if (schema.properties) {
      for (const [paramName, paramValue] of Object.entries(params)) {
        const paramSchema = schema.properties[paramName];
        if (paramSchema && paramSchema.type) {
          const actualType = typeof paramValue;
          const expectedType = paramSchema.type;

          if (expectedType === "string" && actualType !== "string") {
            errors.push(
              `Parameter '${paramName}' should be a string, got ${actualType}`
            );
          } else if (expectedType === "number" && actualType !== "number") {
            errors.push(
              `Parameter '${paramName}' should be a number, got ${actualType}`
            );
          } else if (expectedType === "boolean" && actualType !== "boolean") {
            errors.push(
              `Parameter '${paramName}' should be a boolean, got ${actualType}`
            );
          } else if (expectedType === "array" && !Array.isArray(paramValue)) {
            errors.push(
              `Parameter '${paramName}' should be an array, got ${actualType}`
            );
          } else if (
            expectedType === "object" &&
            (actualType !== "object" || Array.isArray(paramValue))
          ) {
            errors.push(
              `Parameter '${paramName}' should be an object, got ${actualType}`
            );
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    this.tools.clear();
  }

  /**
   * Get registry statistics
   * @returns Statistics about the registry
   */
  getStats(): {
    totalTools: number;
    toolsByCategory: Record<string, number>;
    toolNames: string[];
  } {
    const toolNames = Array.from(this.tools.keys());

    return {
      totalTools: this.tools.size,
      toolsByCategory: {
        filesystem: this.getToolsByCategory("filesystem").length,
        execution: this.getToolsByCategory("execution").length,
        editing: this.getToolsByCategory("editing").length,
        workspace: this.getToolsByCategory("workspace").length,
        packageManagement: this.getToolsByCategory("packageManagement").length,
      },
      toolNames,
    };
  }
}

// Create and configure the global registry instance
export const agentToolRegistry = new AgentToolRegistryImpl();

/**
 * Initialize the agent tool registry with restricted tools for safe execution
 * Only includes essential tools with controlled execution environment
 */
export function initializeAgentTools(): void {
  // Register all file system tools (read-only operations)
  fileSystemTools.forEach((tool) => {
    agentToolRegistry.register(tool);
  });

  // Register all code execution tools
  codeExecutionTools.forEach((tool) => {
    agentToolRegistry.register(tool);
  });

  // Register all code editing tools (for file modifications)
  codeEditingTools.forEach((tool) => {
    agentToolRegistry.register(tool);
  });

  // Register all workspace management tools (for project organization)
  workspaceTools.forEach((tool) => {
    agentToolRegistry.register(tool);
  });

  // Register all package management tools (for package installation)
  packageManagementTools.forEach((tool) => {
    agentToolRegistry.register(tool);
  });

  console.log(
    `Initialized agent tool registry with ${
      agentToolRegistry.getStats().totalTools
    } tools (restricted set)`
  );
  console.log("Available tools:", agentToolRegistry.getStats().toolNames);
}

/**
 * Utility function to create a properly formatted function call result
 * for AI model integration
 */
export function createToolResponse(result: ToolResult): {
  tool_call_id?: string;
  content: string;
} {
  const content = JSON.stringify(
    {
      success: result.success,
      data: result.data,
      error: result.error,
      metadata: result.metadata,
    },
    null,
    2
  );

  return { content };
}

/**
 * Utility function to execute multiple tools in sequence
 * @param toolCalls - Array of tool calls to execute
 * @returns Array of results
 */
export async function executeToolSequence(
  toolCalls: Array<{ name: string; parameters: any }>
): Promise<ToolResult[]> {
  const results: ToolResult[] = [];

  for (const toolCall of toolCalls) {
    try {
      const result = await agentToolRegistry.execute(
        toolCall.name,
        toolCall.parameters
      );
      results.push(result);

      // If a tool fails, optionally stop the sequence
      if (!result.success) {
        console.warn(`Tool '${toolCall.name}' failed:`, result.error);
        // Continue execution for now, but this could be configurable
      }
    } catch (error) {
      results.push({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          toolName: toolCall.name,
          sequenceIndex: results.length,
        },
      });
    }
  }

  return results;
}

// Export types and utilities for external use
export type { AgentTool, ToolResult, AgentToolRegistry };
export {
  fileSystemTools,
  codeExecutionTools,
  codeEditingTools,
  workspaceTools,
  packageManagementTools,
};
