/**
 * Tool Calls Drawer Component
 *
 * Shows an expandable drawer with real-time tool call information
 * including parameters, results, and execution times.
 */

import React, { useState } from "react";
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
        <div className="border-t pt-2 mb-2">
          {/* Compact Tool Call List */}
          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
            {toolCalls.map((toolCall) => (
              <button
                key={toolCall.id}
                className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-xs border transition-colors"
                onClick={() => toggleExpanded(toolCall.id)}
                title={`${toolCall.toolName} - ${
                  toolCall.error
                    ? "Failed"
                    : toolCall.result !== undefined
                    ? "Success"
                    : "Running"
                }`}
              >
                <span className={`text-xs ${getStatusColor(toolCall)}`}>
                  {toolCall.error
                    ? "✕"
                    : toolCall.result !== undefined
                    ? "✓"
                    : "○"}
                </span>
                <span className="font-mono text-xs truncate max-w-[100px]">
                  {toolCall.toolName}
                </span>
                <span className="text-gray-400 text-xs">
                  {expandedCalls.has(toolCall.id) ? "▼" : "▶"}
                </span>
              </button>
            ))}
          </div>

          {/* Expanded Details */}
          {Array.from(expandedCalls).map((callId) => {
            const toolCall = toolCalls.find((tc) => tc.id === callId);
            if (!toolCall) return null;

            return (
              <div
                key={callId}
                className="mt-2 bg-gray-50 dark:bg-gray-800 rounded border p-3 text-xs"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={getStatusColor(toolCall)}>
                    {getStatusIcon(toolCall)}
                  </span>
                  <span className="font-mono font-medium">
                    {toolCall.toolName}
                  </span>
                  <span className="text-gray-500 text-xs">
                    {toolCall.timestamp.toLocaleTimeString()}
                  </span>
                  {toolCall.executionTime && (
                    <span className="text-gray-400 text-xs">
                      {toolCall.executionTime}ms
                    </span>
                  )}
                </div>

                {/* Parameters */}
                <div className="mb-2">
                  <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Parameters:
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded max-h-20 overflow-y-auto">
                    <pre className="text-xs whitespace-pre-wrap break-words">
                      {formatParametersDisplay(toolCall.parameters)}
                    </pre>
                  </div>
                </div>

                {/* Result or Error */}
                {toolCall.error ? (
                  <div>
                    <div className="font-medium text-red-600 dark:text-red-400 mb-1">
                      Error:
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-2 rounded max-h-20 overflow-y-auto">
                      <pre className="text-xs whitespace-pre-wrap break-words">
                        {toolCall.error}
                      </pre>
                    </div>
                  </div>
                ) : toolCall.result !== undefined ? (
                  <div>
                    <div className="font-medium text-green-600 dark:text-green-400 mb-1">
                      Result:
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 p-2 rounded max-h-20 overflow-y-auto">
                      <pre className="text-xs whitespace-pre-wrap break-words">
                        {formatResultDisplay(toolCall.result)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="text-yellow-600 dark:text-yellow-400 font-medium">
                    ⏳ Executing...
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ToolCallsDrawer;
