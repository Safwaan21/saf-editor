/**
 * Agent Chat Component
 *
 * A chat interface for interacting with AI agents using the OpenAI Agents SDK.
 * Integrates with the existing agent tools for comprehensive coding assistance.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Textarea } from "./ui/textarea";
import { ScrollArea } from "./ui/scroll-area";
import {
  useOpenAIAgents,
  type OpenAIAgentsConfig,
} from "../hooks/useOpenAIAgents";
import { useAIConfig } from "../hooks/useAIConfig";
import ToolCallsDrawer from "./ToolCallsDrawer";
import ToolTestMenu from "./ToolTestMenu";
import type { FileNode } from "../App";

interface AgentChatProps {
  fileTree: FileNode[];
  updateFileTree: (updater: (prev: FileNode[]) => FileNode[]) => void;
  pyodideWorker?: Worker;
  className?: string;
}

const AgentChat: React.FC<AgentChatProps> = ({
  fileTree,
  updateFileTree,
  pyodideWorker,
  className = "",
}) => {
  const [input, setInput] = useState("");
  const [isConfigured, setIsConfigured] = useState(false);
  const [showTestMenu, setShowTestMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { config: aiConfig } = useAIConfig();
  const {
    isInitialized,
    isLoading,
    error,
    messages,
    currentToolCalls,
    initializeAgent,
    sendMessage,
    updateContext,
    clearConversation,
    // resetAgent, // Unused for now
  } = useOpenAIAgents();

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Initialize agent when configuration is available
  useEffect(() => {
    const setupAgent = async () => {
      if (
        aiConfig.type === "api" &&
        aiConfig.apiProvider === "gpt" &&
        aiConfig.apiKey &&
        !isInitialized &&
        !isLoading
      ) {
        try {
          const config: OpenAIAgentsConfig = {
            apiKey: aiConfig.apiKey,
            model: "gpt-4o-mini",
            agentName: "Coding Assistant",
            instructions: `You are an expert AI coding assistant with access to powerful tools for agentic coding tasks. You can help users with:

🔧 **Development Tasks:**
- Read and analyze project structures
- Execute Python code in a safe sandbox
- Edit and refactor code files
- Manage workspace organization

📁 **File Operations:**
- Create, read, update, and delete files
- Navigate directory structures
- Organize project hierarchies

🐍 **Code Execution:**
- Run Python scripts with full workspace context
- Test code snippets safely
- Debug and validate implementations

✨ **Smart Assistance:**
- Understand context from the entire workspace
- Provide detailed explanations of your actions
- Suggest best practices and improvements
- Handle errors gracefully with helpful guidance

Always explain what you're doing and why. Use the appropriate tools for each task and provide clear feedback about results.`,
          };

          const toolContext = {
            fileTree,
            updateFileTree,
            pyodideWorker,
          };

          await initializeAgent(config, toolContext);
          setIsConfigured(true);
        } catch (err) {
          console.error("Failed to setup agent:", err);
        }
      }
    };

    setupAgent();
  }, [
    aiConfig,
    isInitialized,
    isLoading,
    fileTree,
    updateFileTree,
    pyodideWorker,
    initializeAgent,
  ]);

  // Update context when dependencies change
  useEffect(() => {
    if (isInitialized) {
      updateContext({
        fileTree,
        updateFileTree,
        pyodideWorker,
      });
    }
  }, [fileTree, updateFileTree, pyodideWorker, isInitialized, updateContext]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const messageText = input.trim();
    setInput("");

    try {
      await sendMessage(messageText);
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    clearConversation();
  };

  const handleExecuteTest = async (
    testName: string,
    toolName: string,
    parameters: Record<string, unknown>
  ) => {
    // Import the tool registry
    const { agentToolRegistry } = await import("../tools");

    try {
      // Set the current context for tools (file tree, update function, etc.)
      agentToolRegistry.setContext({
        fileTree,
        updateFileTree,
        pyodideWorker,
      });

      // Execute the tool directly
      const result = await agentToolRegistry.execute(toolName, parameters);

      // Log the result for debugging
      console.log(`Tool test "${testName}" (${toolName}):`, result);

      // Log the status message for user feedback
      const statusMessage = result.success
        ? `✅ Test "${testName}" completed successfully!`
        : `❌ Test "${testName}" failed: ${result.error}`;

      console.log(`🧪 Tool Test Result: ${statusMessage}`);
    } catch (error) {
      console.error(`Tool test "${testName}" (${toolName}) failed:`, error);

      // Add error message to chat
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.log(`❌ Test "${testName}" failed with error: ${errorMessage}`);
    }

    // Close the test menu after execution
    setShowTestMenu(false);
  };

  const formatMessageContent = (content: string) => {
    const lines = content.split("\n");
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];
    let codeBlockLanguage = "";
    let inList = false;
    let listItems: string[] = [];

    const flushList = () => {
      if (inList && listItems.length > 0) {
        elements.push(
          <ul
            key={`list-${elements.length}`}
            className="list-disc ml-6 mb-2 space-y-1"
          >
            {listItems.map((item, idx) => (
              <li key={idx} className="text-sm">
                {formatInlineMarkdown(item)}
              </li>
            ))}
          </ul>
        );
        listItems = [];
        inList = false;
      }
    };

    const formatInlineMarkdown = (text: string): React.ReactNode => {
      // Handle inline code
      text = text.replace(
        /`([^`]+)`/g,
        '<code class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs font-mono">$1</code>'
      );

      // Handle bold text
      text = text.replace(
        /\*\*([^*]+)\*\*/g,
        '<strong class="font-semibold">$1</strong>'
      );

      // Handle italic text
      text = text.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');

      // Handle links (basic)
      text = text.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" class="text-blue-500 hover:text-blue-700 underline" target="_blank" rel="noopener noreferrer">$1</a>'
      );

      return <span dangerouslySetInnerHTML={{ __html: text }} />;
    };

    lines.forEach((line) => {
      // Handle code blocks
      if (line.startsWith("```")) {
        if (inCodeBlock) {
          // End code block
          elements.push(
            <div
              key={`code-${elements.length}`}
              className="bg-gray-100 dark:bg-gray-800 rounded p-3 mb-3 overflow-x-auto"
            >
              <div className="text-xs text-gray-500 mb-1">
                {codeBlockLanguage || "code"}
              </div>
              <pre className="font-mono text-sm">
                <code>{codeBlockContent.join("\n")}</code>
              </pre>
            </div>
          );
          codeBlockContent = [];
          codeBlockLanguage = "";
          inCodeBlock = false;
        } else {
          // Start code block
          flushList();
          codeBlockLanguage = line.replace(/```/, "").trim();
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        return;
      }

      // Handle headers (made smaller as requested)
      if (line.startsWith("### ")) {
        flushList();
        elements.push(
          <h4
            key={`h4-${elements.length}`}
            className="text-sm font-semibold mt-3 mb-1 text-gray-800 dark:text-gray-200"
          >
            {line.replace("### ", "")}
          </h4>
        );
        return;
      }

      if (line.startsWith("## ")) {
        flushList();
        elements.push(
          <h3
            key={`h3-${elements.length}`}
            className="text-base font-semibold mt-3 mb-2 text-gray-800 dark:text-gray-200"
          >
            {line.replace("## ", "")}
          </h3>
        );
        return;
      }

      if (line.startsWith("# ")) {
        flushList();
        elements.push(
          <h2
            key={`h2-${elements.length}`}
            className="text-lg font-semibold mt-4 mb-2 text-gray-800 dark:text-gray-200"
          >
            {line.replace("# ", "")}
          </h2>
        );
        return;
      }

      // Handle lists
      if (line.match(/^[-*+]\s+/)) {
        if (!inList) {
          inList = true;
        }
        listItems.push(line.replace(/^[-*+]\s+/, ""));
        return;
      }

      // Handle numbered lists
      if (line.match(/^\d+\.\s+/)) {
        flushList();
        const content = line.replace(/^\d+\.\s+/, "");
        elements.push(
          <div key={`numbered-${elements.length}`} className="flex mb-1">
            <span className="text-sm font-medium mr-2">
              {line.match(/^\d+/)?.[0]}.
            </span>
            <span className="text-sm">{formatInlineMarkdown(content)}</span>
          </div>
        );
        return;
      }

      // Handle blockquotes
      if (line.startsWith("> ")) {
        flushList();
        elements.push(
          <blockquote
            key={`quote-${elements.length}`}
            className="border-l-4 border-gray-300 dark:border-gray-600 pl-3 my-2 text-sm italic text-gray-700 dark:text-gray-300"
          >
            {formatInlineMarkdown(line.replace("> ", ""))}
          </blockquote>
        );
        return;
      }

      // Handle horizontal rules
      if (line.trim() === "---" || line.trim() === "***") {
        flushList();
        elements.push(
          <hr
            key={`hr-${elements.length}`}
            className="border-gray-300 dark:border-gray-600 my-3"
          />
        );
        return;
      }

      // Flush any pending list before regular content
      if (!line.match(/^[-*+]\s+/) && inList) {
        flushList();
      }

      // Handle regular paragraphs
      if (line.trim()) {
        elements.push(
          <p
            key={`p-${elements.length}`}
            className="text-sm mb-2 leading-relaxed"
          >
            {formatInlineMarkdown(line)}
          </p>
        );
      } else {
        // Empty line - add some spacing
        elements.push(<div key={`space-${elements.length}`} className="h-2" />);
      }
    });

    // Flush any remaining list items
    flushList();

    return elements;
  };

  // Show configuration prompt if not properly configured
  if (!isConfigured && aiConfig.type !== "api") {
    return (
      <Card className={`w-full h-full ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🤖 Agent Chat
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-full space-y-4">
          <div className="text-center text-muted-foreground">
            <h3 className="text-lg font-medium mb-2">Configure OpenAI API</h3>
            <p>
              Please configure your OpenAI API settings to use the Agent Chat.
            </p>
            <p className="text-sm mt-2">
              Go to Settings → AI Configuration → Use API → Select "GPT
              (OpenAI)"
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isConfigured && !aiConfig.apiKey) {
    return (
      <Card className={`w-full h-full ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🤖 Agent Chat
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-full space-y-4">
          <div className="text-center text-muted-foreground">
            <h3 className="text-lg font-medium mb-2">API Key Required</h3>
            <p>Please add your OpenAI API key to use the Agent Chat.</p>
            <p className="text-sm mt-2">
              Go to Settings → AI Configuration → Enter your OpenAI API key
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`w-full h-full flex flex-col ${className}`}>
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            🤖 Agent Chat
            {isLoading && (
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowTestMenu(!showTestMenu)}
              variant="outline"
              size="sm"
            >
              🧪 Tests
            </Button>
            <Button
              onClick={handleClearChat}
              variant="outline"
              size="sm"
              disabled={messages.length === 0}
            >
              Clear
            </Button>
          </div>
        </div>
        {error && (
          <div className="text-red-500 text-sm bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded p-2">
            ❌ {error}
          </div>
        )}
        {isInitialized && (
          <div className="text-green-600 text-sm">
            ✅ Agent ready with {fileTree.length} workspace files
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Tool Test Menu */}
        <ToolTestMenu
          onExecuteTest={handleExecuteTest}
          isVisible={showTestMenu}
          onToggle={() => setShowTestMenu(!showTestMenu)}
        />

        {/* Messages Area */}
        <ScrollArea className="flex-1 pr-4 mb-4 h-0">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <div className="text-4xl mb-4">👋</div>
                <h3 className="text-lg font-medium mb-2">
                  Welcome to Agent Chat!
                </h3>
                <p className="text-sm max-w-md mx-auto">
                  I'm your AI coding assistant with access to powerful tools. I
                  can help you:
                </p>
                <ul className="text-sm mt-3 space-y-1 max-w-sm mx-auto text-left">
                  <li>• 📁 Read and manage your files</li>
                  <li>• 🐍 Execute Python code safely</li>
                  <li>• ✏️ Edit and refactor code</li>
                  <li>• 🏗️ Organize your workspace</li>
                </ul>
                <p className="text-sm mt-4 text-muted-foreground">
                  Just type a message below to get started!
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.role === "user"
                        ? "bg-blue-500 text-white"
                        : message.role === "assistant"
                        ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        : "bg-yellow-100 dark:bg-yellow-900 text-yellow-900 dark:text-yellow-100"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="text-sm font-medium">
                        {message.role === "user" ? "👤" : "🤖"}
                      </div>
                      <div className="flex-1">
                        {message.isStreaming ? (
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-current rounded-full animate-pulse" />
                            <span className="text-sm">Thinking...</span>
                          </div>
                        ) : (
                          <div className="text-sm">
                            {formatMessageContent(message.content)}
                            {message.toolCalls &&
                              message.toolCalls.length > 0 && (
                                <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded text-xs">
                                  <div className="font-medium mb-1">
                                    🔧 Tools used:
                                  </div>
                                  <div className="space-y-1">
                                    {message.toolCalls.map((toolCall, idx) => (
                                      <div
                                        key={idx}
                                        className="flex items-center gap-2"
                                      >
                                        <span
                                          className={
                                            toolCall.error
                                              ? "text-red-500"
                                              : toolCall.result !== undefined
                                              ? "text-green-500"
                                              : "text-yellow-500"
                                          }
                                        >
                                          {toolCall.error
                                            ? "❌"
                                            : toolCall.result !== undefined
                                            ? "✅"
                                            : "⏳"}
                                        </span>
                                        <span className="font-mono">
                                          {toolCall.toolName}
                                        </span>
                                        {toolCall.executionTime && (
                                          <span className="text-gray-400">
                                            ({toolCall.executionTime}ms)
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString()}
                      {message.toolCalls && message.toolCalls.length > 0 && (
                        <span className="ml-2">
                          • {message.toolCalls.length} tool call
                          {message.toolCalls.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Tool Calls Drawer */}
        <ToolCallsDrawer toolCalls={currentToolCalls} className="" />

        {/* Input Area */}
        <div className="flex-shrink-0 border-t pt-4">
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isInitialized
                  ? "Ask me to help with your code, analyze files, run tests, or anything else!"
                  : "Initializing agent..."
              }
              disabled={!isInitialized || isLoading}
              className="flex-1 min-h-[60px] max-h-[120px] resize-none"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!input.trim() || !isInitialized || isLoading}
              size="lg"
              className="self-end"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                "Send"
              )}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Press Enter to send, Shift+Enter for new line
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AgentChat;
