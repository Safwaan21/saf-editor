# AI Agent Tools Documentation

This directory contains a comprehensive set of tools that enable AI agents to perform agentic coding tasks. The tools are organized into four main categories:

## Tool Categories

### 1. File System Tools (`fileSystemTools.ts`)

Tools for interacting with the file system and reading directory structures.

#### `read_directory`

- **Description**: Lists files and subdirectories in a given directory path
- **Parameters**:
  - `path` (string): Directory path to read (empty string for root)
  - `includeContent` (boolean, optional): Whether to include file contents
  - `recursive` (boolean, optional): Whether to recursively list subdirectories
- **Returns**: `DirectoryListing` with files and folders

#### `read_file`

- **Description**: Reads the contents of a specific file
- **Parameters**:
  - `path` (string): File path to read
- **Returns**: File content, size, and metadata

#### `write_file`

- **Description**: Writes content to a file (creates if doesn't exist)
- **Parameters**:
  - `path` (string): File path to write to
  - `content` (string): Content to write to the file
- **Returns**: Success status and file information

### 2. Code Execution Tools (`codeExecutionTools.ts`)

Tools for executing Python code using the existing Pyodide worker infrastructure.

#### `execute_python`

- **Description**: Executes Python code with optional file context
- **Parameters**:
  - `code` (string): Python code to execute
  - `files` (array, optional): Files to include in execution context
  - `timeout` (number, optional): Execution timeout in milliseconds (default: 30000)
- **Returns**: Execution result with stdout, stderr, and timing

#### `execute_with_workspace`

- **Description**: Executes Python code with the entire workspace as context
- **Parameters**:
  - `code` (string): Python code to execute
  - `timeout` (number, optional): Execution timeout in milliseconds
- **Returns**: Execution result with workspace files included

#### `run_main_script`

- **Description**: Executes main.py if it exists, or fallback code
- **Parameters**:
  - `fallbackCode` (string, optional): Code to run if main.py doesn't exist
  - `timeout` (number, optional): Execution timeout in milliseconds
- **Returns**: Execution result with metadata about which script was run

#### `test_code`

- **Description**: Executes Python code in a test environment with validation
- **Parameters**:
  - `code` (string): Python code to test
  - `expectedOutput` (string, optional): Expected output for validation
  - `timeout` (number, optional): Execution timeout (default: 15000ms)
- **Returns**: Test result with validation information

### 3. Code Editing Tools (`codeEditingTools.ts`)

Tools for editing and manipulating code files.

#### `replace_text`

- **Description**: Replaces specific text in a file with new content
- **Parameters**:
  - `filePath` (string): Path to the file to edit
  - `findText` (string): Text to find and replace
  - `replaceText` (string): Text to replace with
  - `replaceAll` (boolean, optional): Whether to replace all occurrences
- **Returns**: Success status and replacement information

#### `insert_text_at_line`

- **Description**: Inserts text at a specific line number
- **Parameters**:
  - `filePath` (string): Path to the file to edit
  - `lineNumber` (number): Line number to insert at (1-based)
  - `content` (string): Text content to insert
- **Returns**: Success status and insertion information

#### `delete_lines`

- **Description**: Deletes a range of lines from a file
- **Parameters**:
  - `filePath` (string): Path to the file to edit
  - `startLine` (number): Starting line number (1-based, inclusive)
  - `endLine` (number, optional): Ending line number (defaults to startLine)
- **Returns**: Success status and deletion information

#### `append_text`

- **Description**: Appends text to the end of a file
- **Parameters**:
  - `filePath` (string): Path to the file to edit
  - `content` (string): Text content to append
  - `addNewline` (boolean, optional): Whether to add newline before appending
- **Returns**: Success status and append information

#### `prepend_text`

- **Description**: Prepends text to the beginning of a file
- **Parameters**:
  - `filePath` (string): Path to the file to edit
  - `content` (string): Text content to prepend
  - `addNewline` (boolean, optional): Whether to add newline after prepending
- **Returns**: Success status and prepend information

### 4. Workspace Tools (`workspaceTools.ts`)

Tools for managing the workspace structure (creating, deleting, moving files/folders).

#### `create_item`

- **Description**: Creates a new file or folder in the workspace
- **Parameters**:
  - `path` (string): Path where to create the item (including name)
  - `type` (string): Type of item ('file' or 'folder')
  - `content` (string, optional): Initial content for files
- **Returns**: Success status and creation information

#### `delete_item`

- **Description**: Deletes a file or folder from the workspace
- **Parameters**:
  - `path` (string): Path of the item to delete
- **Returns**: Success status and deletion information

#### `rename_item`

- **Description**: Renames a file or folder in the workspace
- **Parameters**:
  - `path` (string): Current path of the item
  - `newName` (string): New name for the item
- **Returns**: Success status and rename information

#### `move_item`

- **Description**: Moves a file or folder to a different location
- **Parameters**:
  - `sourcePath` (string): Current path of the item
  - `targetPath` (string): Target directory path
- **Returns**: Success status and move information

#### `copy_item`

- **Description**: Copies a file or folder to a different location
- **Parameters**:
  - `sourcePath` (string): Current path of the item
  - `targetPath` (string): Target directory path
  - `newName` (string, optional): Optional new name for copied item
- **Returns**: Success status and copy information

## Usage

### Basic Setup

```typescript
import {
  initializeAgentTools,
  agentToolRegistry,
  type ToolExecutionContext,
} from "./tools";

// Initialize all tools
initializeAgentTools();

// Set up execution context
const context: ToolExecutionContext = {
  fileTree: yourFileTreeState,
  updateFileTree: yourUpdateFunction,
  pyodideWorker: yourPyodideWorkerInstance,
};

agentToolRegistry.setContext(context);
```

### Executing Tools

```typescript
// Execute a single tool
const result = await agentToolRegistry.execute("read_directory", {
  path: "",
  includeContent: false,
  recursive: true,
});

if (result.success) {
  console.log("Directory listing:", result.data);
} else {
  console.error("Error:", result.error);
}

// Execute multiple tools in sequence
const results = await executeToolSequence([
  {
    name: "create_item",
    parameters: { path: "test.py", type: "file", content: 'print("Hello")' },
  },
  {
    name: "execute_python",
    parameters: { code: 'exec(open("test.py").read())' },
  },
]);
```

### Tool Validation

```typescript
// Validate parameters before execution
const validation = agentToolRegistry.validateParameters("read_file", {
  path: "test.py",
});

if (!validation.valid) {
  console.error("Validation errors:", validation.errors);
}
```

### Getting Tool Schemas (for AI Integration)

```typescript
// Get schema for a specific tool
const schema = agentToolRegistry.getToolSchema("execute_python");

// Get all tool schemas (useful for AI function calling)
const allSchemas = agentToolRegistry.getAllToolSchemas();
```

## Integration with AI Models

The tools are designed to work seamlessly with AI models that support function calling. Each tool returns results in a standardized `ToolResult` format that includes:

- `success`: Boolean indicating if the operation succeeded
- `data`: The main result data
- `error`: Error message if the operation failed
- `metadata`: Additional information like execution time

## Error Handling

All tools implement comprehensive error handling and return detailed error messages. Common error scenarios include:

- File not found
- Invalid parameters
- Permission issues
- Execution timeouts
- Validation failures

## Performance Considerations

- Tools include execution timing in metadata
- Code execution tools support configurable timeouts
- File operations are optimized for the browser environment
- The registry supports parameter validation to catch errors early

## Extension

To add new tools:

1. Create a new tool file following the existing patterns
2. Implement the `AgentTool` interface
3. Register the tool in `agentToolRegistry.ts`
4. Export it from `index.ts`
5. Update this documentation

Each tool should:

- Have comprehensive parameter validation
- Return standardized `ToolResult` objects
- Include detailed error messages
- Support the execution context pattern
- Be thoroughly documented with JSDoc comments
