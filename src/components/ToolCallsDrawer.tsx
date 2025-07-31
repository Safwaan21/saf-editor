/**
 * Tool Calls Drawer Component
 *
 * Shows an expandable drawer with real-time tool call information
 * including parameters, results, and execution times.
 */

import React, { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import type { AgentToolCall } from "../hooks/useOpenAIAgents";

interface ToolCallsDrawerProps {
  toolCalls: AgentToolCall[];
  className?: string;
}

const ToolCallsDrawer: React.FC<ToolCallsDrawerProps> = ({
  toolCalls,
  className = "",
}) => {
  const [expandedCalls, setExpandedCalls] = useState<Set<string>>(new Set());

  const toggleExpanded = (callId: string) => {
    setExpandedCalls((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(callId)) {
        newSet.delete(callId);
      } else {
        newSet.add(callId);
      }
      return newSet;
    });
  };

  const getStatusIcon = (toolCall: AgentToolCall) => {
    if (toolCall.error) return "❌";
    if (toolCall.result !== undefined) return "✅";
    return "⏳"; // In progress
  };

  const getStatusColor = (toolCall: AgentToolCall) => {
    if (toolCall.error) return "text-red-500";
    if (toolCall.result !== undefined) return "text-green-500";
    return "text-yellow-500";
  };

  const formatParametersDisplay = (params: any): string => {
    try {
      return JSON.stringify(params, null, 2);
    } catch {
      return String(params);
    }
  };

  const formatResultDisplay = (result: any): string => {
    if (result === null || result === undefined) return "No result";
    try {
      return JSON.stringify(result, null, 2);
    } catch {
      return String(result);
    }
  };

  return (
    <div className={`${className}`}>
      {/* Only show if there are tool calls */}
      {toolCalls.length > 0 && (
        <div className="border-t pt-3 mb-3">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              🔧 Tool Execution
            </span>
            {toolCalls.some((tc) => tc.error) && (
              <span className="text-red-500 text-xs">● Errors</span>
            )}
            {toolCalls.some((tc) => tc.result === undefined && !tc.error) && (
              <span className="text-yellow-500 text-xs animate-pulse">
                ● Running
              </span>
            )}
          </div>

          {/* Inline Tool Call Cards */}
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {toolCalls.map((toolCall) => (
              <div
                key={toolCall.id}
                className="bg-gray-50 dark:bg-gray-800 rounded-lg border p-3"
              >
                {/* Tool Call Header */}
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleExpanded(toolCall.id)}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={getStatusColor(toolCall)}>
                      {getStatusIcon(toolCall)}
                    </span>
                    <span className="font-mono text-xs font-medium truncate">
                      {toolCall.toolName}
                    </span>
                    <span className="text-xs text-gray-500 hidden sm:inline">
                      {toolCall.timestamp.toLocaleTimeString()}
                    </span>
                    {toolCall.executionTime && (
                      <span className="text-xs text-gray-400">
                        {toolCall.executionTime}ms
                      </span>
                    )}
                  </div>
                  <button className="text-xs text-gray-400 hover:text-gray-600 p-1">
                    {expandedCalls.has(toolCall.id) ? "▼" : "▶"}
                  </button>
                </div>

                {/* Quick Status */}
                {!expandedCalls.has(toolCall.id) && (
                  <div className="mt-1 text-xs text-gray-500 truncate">
                    {toolCall.error ? (
                      <span className="text-red-500">
                        Failed: {toolCall.error.slice(0, 60)}...
                      </span>
                    ) : toolCall.result !== undefined ? (
                      <span className="text-green-500">Success</span>
                    ) : (
                      <span className="text-yellow-500">Executing...</span>
                    )}
                  </div>
                )}

                {/* Expanded Details */}
                {expandedCalls.has(toolCall.id) && (
                  <div className="mt-3 space-y-3">
                    {/* Parameters */}
                    <div>
                      <div className="font-medium text-gray-700 dark:text-gray-300 mb-1 text-xs">
                        Parameters:
                      </div>
                      <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded text-xs max-h-32 overflow-y-auto">
                        <pre className="text-xs whitespace-pre-wrap break-words">
                          {formatParametersDisplay(toolCall.parameters)}
                        </pre>
                      </div>
                    </div>

                    {/* Result or Error */}
                    {toolCall.error ? (
                      <div>
                        <div className="font-medium text-red-600 dark:text-red-400 mb-1 text-xs">
                          Error:
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-2 rounded text-xs max-h-32 overflow-y-auto">
                          <pre className="text-xs whitespace-pre-wrap break-words">
                            {toolCall.error}
                          </pre>
                        </div>
                      </div>
                    ) : toolCall.result !== undefined ? (
                      <div>
                        <div className="font-medium text-green-600 dark:text-green-400 mb-1 text-xs">
                          Result:
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 p-2 rounded text-xs max-h-32 overflow-y-auto">
                          <pre className="text-xs whitespace-pre-wrap break-words">
                            {formatResultDisplay(toolCall.result)}
                          </pre>
                        </div>
                      </div>
                    ) : (
                      <div className="text-yellow-600 dark:text-yellow-400 font-medium text-xs">
                        ⏳ Executing...
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ToolCallsDrawer;
