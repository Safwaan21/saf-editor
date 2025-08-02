/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * OpenAI Agents SDK Integration Hook
 *
 * This hook provides integration with the OpenAI Agents SDK for agentic AI chat.
 * It converts our existing agent tools to the OpenAI Agents format and manages
 * the agent lifecycle.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Agent, Runner, setDefaultOpenAIClient, tool } from "@openai/agents";
import { z } from "zod";
import { agentToolRegistry, initializeAgentTools } from "../tools";
import type { ToolExecutionContext } from "../tools/agentToolRegistry";
import { OpenAI } from "openai";

// Types for OpenAI Agents integration
export interface AgentToolCall {
  id: string;
  toolName: string;
  parameters: any;
  result?: any;
  error?: string;
  timestamp: Date;
  executionTime?: number;
}

export interface AgentChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  toolCalls?: AgentToolCall[];
}

export interface OpenAIAgentsState {
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  messages: AgentChatMessage[];
  agent: Agent | null;
  runner: Runner | null;
  currentToolCalls: AgentToolCall[];
  isExecutingCode: boolean;
  canCancel: boolean;
}

export interface OpenAIAgentsConfig {
  apiKey: string;
  model?: string;
  agentName?: string;
  instructions?: string;
}

/**
 * Convert our agent tool to OpenAI Agents SDK format with simplified Zod schemas
 */
function convertToOpenAITool(
  toolName: string,
  onToolCall?: (toolCall: AgentToolCall) => void
) {
  const toolDefinition = agentToolRegistry.get(toolName);
  if (!toolDefinition) {
    throw new Error(`Tool ${toolName} not found in registry`);
  }

  // Create simplified Zod schemas based on tool name
  // OpenAI Agents SDK requires specific patterns for structured outputs
  let zodSchema: any;

  switch (toolName) {
    case "read_directory":
      zodSchema = z.object({
        path: z.string().describe("Directory path to read"),
        includeContent: z
          .boolean()
          .nullable()
          .describe("Whether to include file contents"),
        recursive: z
          .boolean()
          .nullable()
          .describe("Whether to recursively list subdirectories"),
      });
      break;

    case "read_file":
      zodSchema = z.object({
        path: z.string().describe("File path to read"),
      });
      break;

    case "write_file":
      zodSchema = z.object({
        path: z.string().describe("File path to write to"),
        content: z.string().describe("Content to write to the file"),
      });
      break;

    case "execute_python":
      zodSchema = z.object({
        code: z.string().describe("Python code to execute"),
        timeout: z
          .number()
          .nullable()
          .describe("Execution timeout in milliseconds"),
      });
      break;

    case "execute_with_workspace":
      zodSchema = z.object({
        code: z.string().describe("Python code to execute"),
        timeout: z
          .number()
          .nullable()
          .describe("Execution timeout in milliseconds"),
      });
      break;

    case "run_main_script":
      zodSchema = z.object({
        fallbackCode: z
          .string()
          .nullable()
          .describe("Code to execute if main.py doesn't exist"),
        timeout: z
          .number()
          .nullable()
          .describe("Execution timeout in milliseconds"),
      });
      break;

    case "test_code":
      zodSchema = z.object({
        code: z.string().describe("Python code to test"),
        expectedOutput: z
          .string()
          .nullable()
          .describe("Expected output for validation"),
        timeout: z
          .number()
          .nullable()
          .describe("Execution timeout in milliseconds"),
      });
      break;

    case "modify_text":
      zodSchema = z.object({
        filePath: z.string().describe("Path to the file to edit"),
        newContent: z
          .string()
          .nullable()
          .describe("New content for the file (replaces entire file)"),
        findText: z
          .string()
          .nullable()
          .describe("Text to find and replace (alternative to newContent)"),
        replaceText: z
          .string()
          .nullable()
          .describe("Text to replace with (used with findText)"),
        replaceAll: z
          .boolean()
          .nullable()
          .describe("Whether to replace all occurrences when using findText"),
      });
      break;

    case "create_item":
      zodSchema = z.object({
        path: z.string().describe("Path where to create the item"),
        type: z.enum(["file", "folder"]).describe("Type of item to create"),
        content: z.string().nullable().describe("Initial content for files"),
      });
      break;

    case "delete_item":
      zodSchema = z.object({
        path: z.string().describe("Path of the item to delete"),
      });
      break;

    case "rename_item":
      zodSchema = z.object({
        path: z.string().describe("Current path of the item to rename"),
        newName: z.string().describe("New name for the item"),
      });
      break;

    case "move_item":
      zodSchema = z.object({
        sourcePath: z.string().describe("Current path of the item to move"),
        targetPath: z.string().describe("Target directory path"),
      });
      break;

    case "copy_item":
      zodSchema = z.object({
        sourcePath: z.string().describe("Current path of the item to copy"),
        targetPath: z.string().describe("Target directory path"),
        newName: z
          .string()
          .nullable()
          .describe("Optional new name for the copied item"),
      });
      break;

    case "install_package":
      zodSchema = z.object({
        packageName: z.string().describe("The name of the package to install"),
      });
      break;

    case "list_packages":
      zodSchema = z.object({});
      break;

    default:
      // Fallback for any tools we haven't explicitly defined
      zodSchema = z.object({});
  }

  return tool({
    name: toolDefinition.name,
    description: toolDefinition.description,
    parameters: zodSchema,
    execute: async (params: any) => {
      const startTime = Date.now();
      const toolCallId = `${toolName}_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Create tool call tracking object
      const toolCall: AgentToolCall = {
        id: toolCallId,
        toolName: toolDefinition.name,
        parameters: params,
        timestamp: new Date(),
      };

      // Notify about tool call start
      if (onToolCall) {
        onToolCall(toolCall);
      }

      try {
        // Convert nullable fields to undefined for our internal tools
        const processedParams = Object.keys(params).reduce((acc, key) => {
          acc[key] = params[key] === null ? undefined : params[key];
          return acc;
        }, {} as any);

        const result = await agentToolRegistry.execute(
          toolDefinition.name,
          processedParams
        );

        const executionTime = Date.now() - startTime;

        if (result.success) {
          // Update tool call with success result
          const updatedToolCall: AgentToolCall = {
            ...toolCall,
            result: result.data,
            executionTime,
          };

          if (onToolCall) {
            onToolCall(updatedToolCall);
          }

          // Return formatted result for the agent
          return {
            success: true,
            data: result.data,
            metadata: result.metadata,
          };
        } else {
          // Update tool call with error
          const updatedToolCall: AgentToolCall = {
            ...toolCall,
            error: result.error,
            executionTime,
          };

          if (onToolCall) {
            onToolCall(updatedToolCall);
          }

          throw new Error(result.error || "Tool execution failed");
        }
      } catch (error) {
        const executionTime = Date.now() - startTime;
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Unknown error during tool execution";

        // Update tool call with error
        const updatedToolCall: AgentToolCall = {
          ...toolCall,
          error: errorMessage,
          executionTime,
        };

        if (onToolCall) {
          onToolCall(updatedToolCall);
        }

        throw new Error(errorMessage);
      }
    },
  });
}

/**
 * Hook for managing OpenAI Agents SDK integration
 */
export function useOpenAIAgents() {
  const [state, setState] = useState<OpenAIAgentsState>({
    isInitialized: false,
    isLoading: false,
    error: null,
    messages: [],
    agent: null,
    runner: null,
    currentToolCalls: [],
    isExecutingCode: false,
    canCancel: false,
  });

  const agentRef = useRef<Agent | null>(null);
  const runnerRef = useRef<Runner | null>(null);
  const contextRef = useRef<ToolExecutionContext | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Format recent chat history for context
   */
  const formatChatHistoryForContext = useCallback(
    (messages: AgentChatMessage[], maxMessages = 10): string => {
      if (messages.length === 0) return "";

      const recentMessages = messages.slice(-maxMessages);
      const formattedHistory = recentMessages
        .map((msg) => {
          const timestamp = msg.timestamp.toLocaleTimeString();
          let content = `[${timestamp}] ${msg.role.toUpperCase()}: ${
            msg.content
          }`;

          // Include tool calls if present
          if (msg.toolCalls && msg.toolCalls.length > 0) {
            const toolSummary = msg.toolCalls
              .map(
                (tc) =>
                  `${tc.toolName}(${JSON.stringify(tc.parameters).slice(
                    0,
                    100
                  )}...)`
              )
              .join(", ");
            content += `\n  🔧 Tools used: ${toolSummary}`;
          }

          return content;
        })
        .join("\n\n");

      return `\n\n## Recent Chat History\n${formattedHistory}\n\n---\n\n`;
    },
    []
  );

  /**
   * Initialize the OpenAI Agent with tools and configuration
   */
  const initializeAgent = useCallback(
    async (
      config: OpenAIAgentsConfig,
      toolExecutionContext: ToolExecutionContext
    ) => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        // Initialize our tool registry first
        if (!agentToolRegistry.getStats().totalTools) {
          initializeAgentTools();
        }

        // Set the execution context
        agentToolRegistry.setContext(toolExecutionContext);
        contextRef.current = toolExecutionContext;

        // Tool call tracking callback
        const handleToolCall = (toolCall: AgentToolCall) => {
          setState((prev) => {
            const existingIndex = prev.currentToolCalls.findIndex(
              (tc) => tc.id === toolCall.id
            );

            // Track if this is a code execution tool (only run_main_script is allowed)
            const isCodeExecution = toolCall.toolName === "run_main_script";

            const isCompleted =
              toolCall.result !== undefined || toolCall.error !== undefined;

            if (existingIndex >= 0) {
              // Update existing tool call
              const updatedToolCalls = [...prev.currentToolCalls];
              updatedToolCalls[existingIndex] = toolCall;

              // Update execution status
              const stillExecutingCode = updatedToolCalls.some((tc) => {
                const isCodeTool = tc.toolName === "run_main_script";
                return (
                  isCodeTool &&
                  tc.result === undefined &&
                  tc.error === undefined
                );
              });

              return {
                ...prev,
                currentToolCalls: updatedToolCalls,
                isExecutingCode: stillExecutingCode,
              };
            } else {
              // Add new tool call
              return {
                ...prev,
                currentToolCalls: [...prev.currentToolCalls, toolCall],
                isExecutingCode:
                  prev.isExecutingCode || (isCodeExecution && !isCompleted),
              };
            }
          });
        };

        // Convert all our tools to OpenAI Agents format
        const toolNames = agentToolRegistry.getStats().toolNames;
        const openAITools = toolNames.map((name) =>
          convertToOpenAITool(name, handleToolCall)
        );

        // Create the agent
        const agent = new Agent({
          name: config.agentName || "Coding Assistant",
          instructions:
            config.instructions ||
            `You are an AI coding assistant with access to powerful tools for agentic coding tasks. You can:

- Read and analyze file systems and directories
- Execute Python code safely in a sandboxed environment
- Edit and manipulate code files with precision
- Manage workspace structure (create, delete, move files/folders)

When helping users:
1. Always understand the full context before making changes
2. Explain what you're doing and why
3. Use the appropriate tools for each task
4. Provide clear feedback about results
5. Handle errors gracefully and suggest solutions

Available tools: ${toolNames.join(", ")}`,
          tools: openAITools,
          model: config.model || "gpt-4o-mini", // Use OpenAI models
        });

        // Configure OpenAI client correctly
        setDefaultOpenAIClient(
          new OpenAI({
            apiKey: config.apiKey, // Should be an OpenAI API key
            dangerouslyAllowBrowser: true,
          })
        );

        // Create the runner with the configured OpenAI client
        const runner = new Runner({
          model: config.model || "gpt-4o-mini",
        });

        agentRef.current = agent;
        runnerRef.current = runner;

        setState((prev) => ({
          ...prev,
          isInitialized: true,
          isLoading: false,
          agent,
          runner,
        }));

        console.log("✅ OpenAI Agent initialized with tools:", toolNames);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to initialize agent";
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));
        console.error("❌ Failed to initialize OpenAI Agent:", error);
      }
    },
    []
  );

  /**
   * Send a message to the agent and get a response
   */
  const sendMessage = useCallback(
    async (message: string): Promise<void> => {
      if (!agentRef.current || !runnerRef.current) {
        throw new Error(
          "Agent not initialized. Please call initializeAgent first."
        );
      }

      // Add user message to state
      const userMessage: AgentChatMessage = {
        id: `user_${Date.now()}`,
        role: "user",
        content: message,
        timestamp: new Date(),
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
      }));

      // Add streaming assistant message placeholder
      const assistantMessageId = `assistant_${Date.now()}`;
      const assistantMessage: AgentChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        currentToolCalls: [], // Clear previous tool calls
        canCancel: true,
        isExecutingCode: false,
      }));

      try {
        // Create abort controller for cancellation
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        // Update context if needed
        if (contextRef.current) {
          agentToolRegistry.setContext(contextRef.current);
        }

        // Get current messages before running agent (for chat history)
        const currentMessages = state.messages.concat([userMessage]);
        const chatHistory = formatChatHistoryForContext(currentMessages);

        // Enhance message with chat history context
        const enhancedMessage =
          currentMessages.length > 1
            ? `${message}${chatHistory}Please consider the above chat history when responding and refer to previous conversations when relevant.`
            : message;

        // Run the agent with cancellation support
        const result = await runnerRef.current.run(
          agentRef.current,
          enhancedMessage,
          { signal: abortController.signal }
        );

        // Update the assistant message with the final result and tool calls
        setState((prev) => ({
          ...prev,
          messages: prev.messages.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: result.finalOutput || "No response generated.",
                  isStreaming: false,
                  toolCalls: prev.currentToolCalls, // Attach tool calls to message
                }
              : msg
          ),
          currentToolCalls: [], // Clear current tool calls after attaching to message
          canCancel: false,
          isExecutingCode: false,
        }));

        // Clear abort controller
        abortControllerRef.current = null;
      } catch (error) {
        const isAborted = error instanceof Error && error.name === "AbortError";
        const errorMessage = isAborted
          ? "Execution cancelled by user"
          : error instanceof Error
          ? error.message
          : "Unknown error occurred";

        // Update the assistant message with error
        setState((prev) => ({
          ...prev,
          messages: prev.messages.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: isAborted
                    ? "🛑 Execution cancelled"
                    : `❌ Error: ${errorMessage}`,
                  isStreaming: false,
                  toolCalls: prev.currentToolCalls, // Attach tool calls even on error
                }
              : msg
          ),
          error: isAborted ? null : errorMessage,
          currentToolCalls: [], // Clear current tool calls after attaching to message
          canCancel: false,
          isExecutingCode: false,
        }));

        // Clear abort controller
        abortControllerRef.current = null;
      }
    },
    [formatChatHistoryForContext, state.messages]
  );

  /**
   * Cancel the current execution
   */
  const cancelExecution = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  /**
   * Clear the conversation
   */
  const clearConversation = useCallback(() => {
    setState((prev) => ({
      ...prev,
      messages: [],
      error: null,
      currentToolCalls: [],
      isExecutingCode: false,
      canCancel: false,
    }));
  }, []);

  /**
   * Reset the agent (useful for configuration changes)
   */
  const resetAgent = useCallback(() => {
    // Cancel any ongoing execution
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    agentRef.current = null;
    runnerRef.current = null;
    contextRef.current = null;
    abortControllerRef.current = null;

    setState({
      isInitialized: false,
      isLoading: false,
      error: null,
      messages: [],
      agent: null,
      runner: null,
      currentToolCalls: [],
      isExecutingCode: false,
      canCancel: false,
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cancel any ongoing execution
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      agentRef.current = null;
      runnerRef.current = null;
      contextRef.current = null;
      abortControllerRef.current = null;
    };
  }, []);

  return {
    ...state,
    initializeAgent,
    sendMessage,
    clearConversation,
    resetAgent,
    cancelExecution,
  };
}
