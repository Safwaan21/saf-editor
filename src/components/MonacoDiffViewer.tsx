import React, { useRef, useEffect } from "react";
import * as monaco from "monaco-editor";

interface MonacoDiffViewerProps {
  originalCode: string;
  suggestedCode: string;
  language?: string;
  onApply: () => void;
  onReject: () => void;
  height?: string;
}

export const MonacoDiffViewer: React.FC<MonacoDiffViewerProps> = ({
  originalCode,
  suggestedCode,
  language = "python",
  onApply,
  onReject,
  height = "400px",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const diffEditorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(
    null
  );

  useEffect(() => {
    if (!containerRef.current) return;

    // Create the diff editor
    const diffEditor = monaco.editor.createDiffEditor(containerRef.current, {
      theme: "vs-dark",
      readOnly: false,
      renderSideBySide: true, // Side-by-side view
      ignoreTrimWhitespace: false,
      renderIndicators: true,
      originalEditable: false,
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: 13,
      lineNumbers: "on",
      glyphMargin: false,
      folding: false,
    });

    // Set the models
    const originalModel = monaco.editor.createModel(originalCode, language);
    const modifiedModel = monaco.editor.createModel(suggestedCode, language);

    diffEditor.setModel({
      original: originalModel,
      modified: modifiedModel,
    });

    diffEditorRef.current = diffEditor;

    // Cleanup function
    return () => {
      originalModel.dispose();
      modifiedModel.dispose();
      diffEditor.dispose();
    };
  }, [originalCode, suggestedCode, language]);

  // Update content when props change
  useEffect(() => {
    if (diffEditorRef.current) {
      const model = diffEditorRef.current.getModel();
      if (model) {
        model.original.setValue(originalCode);
        model.modified.setValue(suggestedCode);
      }
    }
  }, [originalCode, suggestedCode]);

  return (
    <div className="w-full bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h3 className="text-sm font-medium text-gray-200">
              AI Code Suggestion
            </h3>
            <div className="flex items-center space-x-2 text-xs text-gray-400">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span>Original</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span>Suggested</span>
              </div>
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={onReject}
              className="px-3 py-1.5 text-sm text-gray-300 hover:text-gray-100 border border-gray-600 rounded-md hover:border-gray-500 transition-colors"
            >
              Reject
            </button>
            <button
              onClick={onApply}
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Apply Changes
            </button>
          </div>
        </div>
      </div>

      {/* Monaco Diff Editor */}
      <div ref={containerRef} style={{ height }} className="w-full" />
    </div>
  );
};
