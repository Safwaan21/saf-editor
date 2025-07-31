/**
 * Tool Test Menu Component
 *
 * Provides one-click testing for all agent tools with pre-configured parameters
 */

import React, { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";

interface ToolTestMenuProps {
  onExecuteTest: (
    testName: string,
    toolName: string,
    parameters: Record<string, unknown>
  ) => void;
  isVisible: boolean;
  onToggle: () => void;
}

interface ToolTest {
  name: string;
  description: string;
  toolName: string;
  parameters: Record<string, unknown>;
  category: string;
  expectation: string;
}

const ToolTestMenu: React.FC<ToolTestMenuProps> = ({
  onExecuteTest,
  isVisible,
  onToggle,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Pre-configured tool tests
  const toolTests: ToolTest[] = [
    // File System Tests
    {
      name: "Create Basic File",
      description: "Create a simple text file",
      toolName: "write_file",
      parameters: {
        path: "test_basic.txt",
        content: "Hello World!\nThis is a test file.",
      },
      category: "filesystem",
      expectation: "File created successfully",
    },
    {
      name: "Read File",
      description: "Read an existing file",
      toolName: "read_file",
      parameters: {
        path: "test_basic.txt",
      },
      category: "filesystem",
      expectation: "Returns file content",
    },
    {
      name: "List Directory",
      description: "List current directory contents",
      toolName: "read_directory",
      parameters: {
        path: ".",
        includeContent: false,
        recursive: false,
      },
      category: "filesystem",
      expectation: "Shows file listing",
    },

    // Code Editing Tests
    {
      name: "Find & Replace Text",
      description: "Replace specific text in a file",
      toolName: "modify_text",
      parameters: {
        filePath: "test_basic.txt",
        findText: "Hello World!",
        replaceText: "Hello Universe!",
      },
      category: "editing",
      expectation: "Text replaced successfully",
    },
    {
      name: "Replace All Occurrences",
      description: "Replace all instances of text in a file",
      toolName: "modify_text",
      parameters: {
        filePath: "test_basic.txt",
        findText: "test",
        replaceText: "demo",
        replaceAll: true,
      },
      category: "editing",
      expectation: "All occurrences replaced",
    },
    {
      name: "Replace Entire File",
      description: "Replace entire file content with new content",
      toolName: "modify_text",
      parameters: {
        filePath: "test_basic.txt",
        newContent:
          "# New File Content\nThis is completely new content!\nLine 2\nLine 3\nEnd of file.",
      },
      category: "editing",
      expectation: "File content completely replaced",
    },
    {
      name: "Create Python Script",
      description: "Create a Python script using modify_text",
      toolName: "modify_text",
      parameters: {
        filePath: "test_script_new.py",
        newContent: `#!/usr/bin/env python3
"""
Test Python script created with modify_text tool
"""

def greet(name):
    return f"Hello, {name}!"

def main():
    print(greet("World"))
    print("Script executed successfully!")
    
    # Test some calculations
    result = 2 ** 10
    print(f"2^10 = {result}")

if __name__ == "__main__":
    main()
`,
      },
      category: "editing",
      expectation: "Python script created with full content",
    },

    // Code Execution Tests
    {
      name: "Execute Python",
      description: "Run Python code directly",
      toolName: "execute_python",
      parameters: {
        code: `print("🐍 Python execution test!")
result = 10 * 5
print(f"10 × 5 = {result}")
import math
print(f"π = {math.pi:.4f}")`,
      },
      category: "execution",
      expectation: "Python output displayed",
    },
    {
      name: "Create & Execute Script",
      description: "Create Python file and execute it",
      toolName: "write_file",
      parameters: {
        path: "test_script.py",
        content: `#!/usr/bin/env python3
print("Hello from test script!")
for i in range(3):
    print(f"Count: {i + 1}")
print("Script completed successfully!")`,
      },
      category: "execution",
      expectation: "Script file created",
    },
    {
      name: "Execute Script File",
      description: "Run the created Python script",
      toolName: "execute_with_workspace",
      parameters: {
        code: "exec(open('test_script.py').read())",
      },
      category: "execution",
      expectation: "Script output displayed",
    },

    // Workspace Management Tests
    {
      name: "Create File Item",
      description: "Create file using workspace tool",
      toolName: "create_item",
      parameters: {
        path: "workspace_created.txt",
        type: "file",
        content: "Created by workspace tool!",
      },
      category: "workspace",
      expectation: "File created via workspace tool",
    },
    {
      name: "Create Folder",
      description: "Create a new folder",
      toolName: "create_item",
      parameters: {
        path: "test_folder",
        type: "folder",
      },
      category: "workspace",
      expectation: "Folder created",
    },
    {
      name: "Copy File",
      description: "Copy an existing file",
      toolName: "copy_item",
      parameters: {
        sourcePath: "test_basic.txt",
        destinationPath: "test_copy.txt",
      },
      category: "workspace",
      expectation: "File copied successfully",
    },
    {
      name: "Move File",
      description: "Move file to new location",
      toolName: "move_item",
      parameters: {
        sourcePath: "test_copy.txt",
        destinationPath: "test_folder/moved_file.txt",
      },
      category: "workspace",
      expectation: "File moved to folder",
    },
    {
      name: "Rename File",
      description: "Rename an existing file",
      toolName: "rename_item",
      parameters: {
        oldPath: "workspace_created.txt",
        newPath: "renamed_file.txt",
      },
      category: "workspace",
      expectation: "File renamed successfully",
    },
    {
      name: "Delete File",
      description: "Delete a test file",
      toolName: "delete_item",
      parameters: {
        path: "renamed_file.txt",
      },
      category: "workspace",
      expectation: "File deleted",
    },

    // Edge Case Tests
    {
      name: "Missing File Test",
      description: "Try to read non-existent file (should fail)",
      toolName: "read_file",
      parameters: {
        path: "nonexistent_file.txt",
      },
      category: "edge-cases",
      expectation: "❌ Should fail with file not found",
    },
    {
      name: "Python Error Test",
      description: "Execute invalid Python code (should fail)",
      toolName: "execute_python",
      parameters: {
        code: "print(undefined_variable)  # This should cause an error",
      },
      category: "edge-cases",
      expectation: "❌ Should fail with Python error",
    },
  ];

  const categories = [
    { id: "all", name: "All Tests", icon: "🔧" },
    { id: "filesystem", name: "File System", icon: "📁" },
    { id: "editing", name: "Code Editing", icon: "✏️" },
    { id: "execution", name: "Code Execution", icon: "🐍" },
    { id: "workspace", name: "Workspace", icon: "🏗️" },
    { id: "edge-cases", name: "Edge Cases", icon: "⚠️" },
  ];

  const filteredTests =
    selectedCategory === "all"
      ? toolTests
      : toolTests.filter((test) => test.category === selectedCategory);

  const getStatusIcon = (category: string) => {
    switch (category) {
      case "filesystem":
        return "📁";
      case "editing":
        return "✏️";
      case "execution":
        return "🐍";
      case "workspace":
        return "🏗️";
      case "edge-cases":
        return "⚠️";
      default:
        return "🔧";
    }
  };

  const handleTestClick = (test: ToolTest) => {
    onExecuteTest(test.name, test.toolName, test.parameters);
  };

  if (!isVisible) {
    return (
      <Button onClick={onToggle} variant="outline" size="sm" className="mb-2">
        🧪 Tool Tests
      </Button>
    );
  }

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium">🧪 One-Click Tool Tests</h3>
        <Button onClick={onToggle} variant="ghost" size="sm">
          ✕
        </Button>
      </div>

      <Card className="bg-gray-50 dark:bg-gray-900 overflow-y-auto">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-1">
            {categories.map((category) => (
              <Button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                variant={
                  selectedCategory === category.id ? "default" : "outline"
                }
                size="sm"
                className="text-xs"
              >
                {category.icon} {category.name}
              </Button>
            ))}
          </div>
        </CardHeader>

        <CardContent>
          <ScrollArea className="max-h-96 overflow-y-auto">
            <div className="space-y-2">
              {filteredTests.map((test, index) => (
                <div
                  key={`${test.toolName}-${index}`}
                  className="border rounded-lg p-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span>{getStatusIcon(test.category)}</span>
                      <span className="font-medium text-sm">{test.name}</span>
                      <span className="font-mono text-xs text-gray-500">
                        {test.toolName}
                      </span>
                    </div>
                    <Button
                      onClick={() => handleTestClick(test)}
                      size="sm"
                      className="text-xs"
                    >
                      Run Test
                    </Button>
                  </div>

                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                    {test.description}
                  </p>

                  <div className="text-xs text-gray-500 mb-2">
                    <strong>Expected:</strong> {test.expectation}
                  </div>

                  <details className="text-xs">
                    <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                      Show Parameters
                    </summary>
                    <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs overflow-x-auto">
                      {JSON.stringify(test.parameters, null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">
            <strong>💡 Tip:</strong> Run tests in order for best results. Start
            with "Create Basic File" then test editing operations on that file.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ToolTestMenu;
