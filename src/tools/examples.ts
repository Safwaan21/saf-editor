/**
 * AI Agent Tools - Usage Examples
 *
 * This file demonstrates how to use the AI agent tools in practical scenarios.
 * These examples can be used as reference implementations or starting points.
 */

import {
  agentToolRegistry,
  initializeAgentTools,
  executeToolSequence,
} from "./index";
import type { ToolExecutionContext } from "./index";
import type { FileNode } from "../App";

/**
 * Example: Initialize the tool system
 */
export function initializeToolSystem(
  fileTree: FileNode[],
  updateFileTree: (updater: (prev: FileNode[]) => FileNode[]) => void,
  pyodideWorker?: Worker
): void {
  // Initialize all available tools
  initializeAgentTools();

  // Set up the execution context
  const context: ToolExecutionContext = {
    fileTree,
    updateFileTree,
    pyodideWorker,
  };

  agentToolRegistry.setContext(context);

  console.log("✅ Agent tool system initialized");
  console.log(`📊 Available tools: ${agentToolRegistry.getStats().totalTools}`);
  console.log(
    "🔧 Tool categories:",
    agentToolRegistry.getStats().toolsByCategory
  );
}

/**
 * Example: Create a Python project structure
 */
export async function createPythonProject(projectName: string): Promise<void> {
  console.log(`🚀 Creating Python project: ${projectName}`);

  const results = await executeToolSequence([
    // Create project folder
    {
      name: "create_item",
      parameters: { path: projectName, type: "folder" },
    },

    // Create main.py with basic structure
    {
      name: "create_item",
      parameters: {
        path: `${projectName}/main.py`,
        type: "file",
        content: `#!/usr/bin/env python3
"""
${projectName} - Main Module
"""

def main():
    print("Hello from ${projectName}!")

if __name__ == "__main__":
    main()
`,
      },
    },

    // Create requirements.txt
    {
      name: "create_item",
      parameters: {
        path: `${projectName}/requirements.txt`,
        type: "file",
        content: "# Project dependencies\n",
      },
    },

    // Create README.md
    {
      name: "create_item",
      parameters: {
        path: `${projectName}/README.md`,
        type: "file",
        content: `# ${projectName}

A Python project created with AI agent tools.

## Usage

\`\`\`bash
python main.py
\`\`\`
`,
      },
    },
  ]);

  // Check results
  const failedOperations = results.filter((r) => !r.success);
  if (failedOperations.length > 0) {
    console.error("❌ Some operations failed:", failedOperations);
  } else {
    console.log("✅ Python project created successfully!");
  }
}

/**
 * Example: Read and analyze workspace structure
 */
export async function analyzeWorkspace(): Promise<{
  totalFiles: number;
  totalFolders: number;
  pythonFiles: number;
  totalLines: number;
}> {
  console.log("🔍 Analyzing workspace structure...");

  // Read the entire workspace recursively
  const result = await agentToolRegistry.execute("read_directory", {
    path: "",
    includeContent: true,
    recursive: true,
  });

  if (!result.success) {
    throw new Error(`Failed to read workspace: ${result.error}`);
  }

  const listing = result.data;
  let totalFiles = 0;
  let totalFolders = 0;
  let pythonFiles = 0;
  let totalLines = 0;

  function analyzeEntries(entries: any[]): void {
    for (const entry of entries) {
      if (entry.type === "file") {
        totalFiles++;
        if (entry.name.endsWith(".py")) {
          pythonFiles++;
        }
        if (entry.content) {
          totalLines += entry.content.split("\n").length;
        }
      } else if (entry.type === "folder") {
        totalFolders++;
        if (entry.children) {
          analyzeEntries(entry.children);
        }
      }
    }
  }

  analyzeEntries(listing.entries);

  const stats = { totalFiles, totalFolders, pythonFiles, totalLines };
  console.log("📊 Workspace analysis:", stats);

  return stats;
}

/**
 * Example: Execute Python code with error handling and testing
 */
export async function runPythonWithTesting(
  code: string,
  expectedOutput?: string
): Promise<boolean> {
  console.log("🐍 Executing Python code with testing...");

  try {
    // First, test the code in a safe environment
    const testResult = await agentToolRegistry.execute("test_code", {
      code,
      expectedOutput,
      timeout: 10000,
    });

    if (!testResult.success) {
      console.error("❌ Code test failed:", testResult.error);
      return false;
    }

    const testData = testResult.data;
    if (!testData.testPassed) {
      console.error("❌ Test validation failed:", testData.validationMessage);
      return false;
    }

    // If test passed, execute with full workspace context
    const execResult = await agentToolRegistry.execute(
      "execute_with_workspace",
      {
        code,
        timeout: 30000,
      }
    );

    if (!execResult.success) {
      console.error("❌ Workspace execution failed:", execResult.error);
      return false;
    }

    const execData = execResult.data;
    console.log("✅ Code executed successfully!");
    console.log("📤 Output:", execData.stdout);

    if (execData.stderr) {
      console.warn("⚠️ Warnings/Errors:", execData.stderr);
    }

    return true;
  } catch (error) {
    console.error("❌ Execution error:", error);
    return false;
  }
}

/**
 * Example: Refactor code - rename a function across multiple files
 */
export async function refactorFunctionName(
  oldName: string,
  newName: string,
  filePattern: string = ".py"
): Promise<number> {
  console.log(`🔧 Refactoring function: ${oldName} → ${newName}`);

  // First, find all relevant files
  const workspaceResult = await agentToolRegistry.execute("read_directory", {
    path: "",
    includeContent: true,
    recursive: true,
  });

  if (!workspaceResult.success) {
    throw new Error(`Failed to read workspace: ${workspaceResult.error}`);
  }

  // Find files that match the pattern and contain the old function name
  const filesToUpdate: string[] = [];
  function findMatchingFiles(entries: any[], currentPath: string = ""): void {
    for (const entry of entries) {
      if (entry.type === "file" && entry.name.endsWith(filePattern)) {
        const filePath = currentPath
          ? `${currentPath}/${entry.name}`
          : entry.name;
        if (entry.content && entry.content.includes(oldName)) {
          filesToUpdate.push(filePath);
        }
      } else if (entry.type === "folder" && entry.children) {
        const folderPath = currentPath
          ? `${currentPath}/${entry.name}`
          : entry.name;
        findMatchingFiles(entry.children, folderPath);
      }
    }
  }

  findMatchingFiles(workspaceResult.data.entries);

  console.log(
    `📝 Found ${filesToUpdate.length} files to update:`,
    filesToUpdate
  );

  // Update each file
  let updateCount = 0;
  for (const filePath of filesToUpdate) {
    try {
      const replaceResult = await agentToolRegistry.execute("replace_text", {
        filePath,
        findText: oldName,
        replaceText: newName,
        replaceAll: true,
      });

      if (replaceResult.success) {
        updateCount += replaceResult.data.replacementCount;
        console.log(
          `✅ Updated ${filePath}: ${replaceResult.data.replacementCount} replacements`
        );
      } else {
        console.error(`❌ Failed to update ${filePath}:`, replaceResult.error);
      }
    } catch (error) {
      console.error(`❌ Error updating ${filePath}:`, error);
    }
  }

  console.log(
    `🎉 Refactoring complete! Made ${updateCount} total replacements.`
  );
  return updateCount;
}

/**
 * Example: Create a comprehensive code documentation
 */
export async function generateProjectDocumentation(): Promise<string> {
  console.log("📚 Generating project documentation...");

  // Analyze the workspace
  const stats = await analyzeWorkspace();

  // Read all Python files for analysis
  const workspaceResult = await agentToolRegistry.execute("read_directory", {
    path: "",
    includeContent: true,
    recursive: true,
  });

  if (!workspaceResult.success) {
    throw new Error(`Failed to read workspace: ${workspaceResult.error}`);
  }

  let documentation = `# Project Documentation

## Overview
- **Total Files**: ${stats.totalFiles}
- **Total Folders**: ${stats.totalFolders}  
- **Python Files**: ${stats.pythonFiles}
- **Total Lines of Code**: ${stats.totalLines}

## File Structure
`;

  function generateFileTree(entries: any[], level: number = 0): string {
    let tree = "";
    const indent = "  ".repeat(level);

    for (const entry of entries) {
      const icon = entry.type === "folder" ? "📁" : "📄";
      tree += `${indent}- ${icon} ${entry.name}\n`;

      if (entry.type === "folder" && entry.children) {
        tree += generateFileTree(entry.children, level + 1);
      }
    }

    return tree;
  }

  documentation += generateFileTree(workspaceResult.data.entries);
  documentation += "\n## Python Files Analysis\n";

  // Analyze Python files
  function analyzePythonFiles(entries: any[], currentPath: string = ""): void {
    for (const entry of entries) {
      if (
        entry.type === "file" &&
        entry.name.endsWith(".py") &&
        entry.content
      ) {
        const filePath = currentPath
          ? `${currentPath}/${entry.name}`
          : entry.name;
        const lines = entry.content.split("\n");
        const functions = lines.filter((line: string) =>
          line.trim().startsWith("def ")
        ).length;
        const classes = lines.filter((line: string) =>
          line.trim().startsWith("class ")
        ).length;

        documentation += `
### \`${filePath}\`
- **Lines**: ${lines.length}
- **Functions**: ${functions}
- **Classes**: ${classes}
`;
      } else if (entry.type === "folder" && entry.children) {
        const folderPath = currentPath
          ? `${currentPath}/${entry.name}`
          : entry.name;
        analyzePythonFiles(entry.children, folderPath);
      }
    }
  }

  analyzePythonFiles(workspaceResult.data.entries);

  // Save documentation
  await agentToolRegistry.execute("write_file", {
    path: "PROJECT_DOCS.md",
    content: documentation,
  });

  console.log("✅ Documentation generated and saved to PROJECT_DOCS.md");
  return documentation;
}

/**
 * Example: Setup development environment
 */
export async function setupDevEnvironment(): Promise<void> {
  console.log("🛠️ Setting up development environment...");

  const setupSteps = [
    // Create .gitignore
    {
      name: "create_item",
      parameters: {
        path: ".gitignore",
        type: "file",
        content: `# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg

# IDE
.vscode/
.idea/
*.swp
*.swo

# Environment
.env
.venv
env/
venv/
ENV/
env.bak/
venv.bak/
`,
      },
    },

    // Create setup.py
    {
      name: "create_item",
      parameters: {
        path: "setup.py",
        type: "file",
        content: `from setuptools import setup, find_packages

setup(
    name="my-project",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        # Add your dependencies here
    ],
    python_requires=">=3.7",
    author="AI Agent",
    description="A project created with AI agent tools",
)
`,
      },
    },

    // Create tests directory and basic test
    {
      name: "create_item",
      parameters: { path: "tests", type: "folder" },
    },

    {
      name: "create_item",
      parameters: {
        path: "tests/test_main.py",
        type: "file",
        content: `import unittest

class TestMain(unittest.TestCase):
    def test_example(self):
        """Example test case"""
        self.assertTrue(True)

if __name__ == '__main__':
    unittest.main()
`,
      },
    },
  ];

  const results = await executeToolSequence(setupSteps);

  const failures = results.filter((r) => !r.success);
  if (failures.length > 0) {
    console.error("❌ Some setup steps failed:", failures);
  } else {
    console.log("✅ Development environment setup complete!");
  }
}

// Export all examples for easy access
export const examples = {
  initializeToolSystem,
  createPythonProject,
  analyzeWorkspace,
  runPythonWithTesting,
  refactorFunctionName,
  generateProjectDocumentation,
  setupDevEnvironment,
};
