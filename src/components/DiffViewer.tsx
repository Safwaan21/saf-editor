import React from "react";

interface DiffViewerProps {
  originalCode: string;
  suggestedCode: string;
  language?: string;
  onApply: () => void;
  onReject: () => void;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  originalCode,
  suggestedCode,
  onApply,
  onReject,
}) => {
  // Simple diff highlighting - you could enhance this with a proper diff library
  const renderCodeWithHighlight = (code: string, isOriginal: boolean) => {
    const lines = code.split("\n");
    return lines.map((line, index) => (
      <div
        key={index}
        className={`px-2 py-0.5 font-mono text-sm ${
          isOriginal
            ? "bg-red-900/20 border-l-2 border-red-500"
            : "bg-green-900/20 border-l-2 border-green-500"
        }`}
      >
        <span className="text-gray-400 mr-3 w-8 inline-block text-right">
          {index + 1}
        </span>
        <span className={isOriginal ? "text-red-200" : "text-green-200"}>
          {line || " "}
        </span>
      </div>
    ));
  };

  return (
    <div className="w-full max-w-4xl bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-200">
            AI Code Suggestion
          </h3>
          <div className="flex space-x-2">
            <button
              onClick={onReject}
              className="px-3 py-1.5 text-sm text-gray-300 hover:text-gray-100 border border-gray-600 rounded-md hover:border-gray-500"
            >
              Reject
            </button>
            <button
              onClick={onApply}
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Apply Changes
            </button>
          </div>
        </div>
      </div>

      {/* Diff Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-700">
        {/* Original Code */}
        <div className="bg-gray-900">
          <div className="bg-gray-800 px-3 py-2 text-xs font-medium text-red-300 border-b border-gray-700">
            Original Code
          </div>
          <div className="max-h-64 overflow-y-auto">
            {renderCodeWithHighlight(originalCode, true)}
          </div>
        </div>

        {/* Suggested Code */}
        <div className="bg-gray-900">
          <div className="bg-gray-800 px-3 py-2 text-xs font-medium text-green-300 border-b border-gray-700">
            Suggested Code
          </div>
          <div className="max-h-64 overflow-y-auto">
            {renderCodeWithHighlight(suggestedCode, false)}
          </div>
        </div>
      </div>
    </div>
  );
};
