import { useState, useRef, useCallback } from "react";
import * as webllm from "@mlc-ai/web-llm";

export interface WebLLMState {
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  progress: string;
}

export const useWebLLM = () => {
  const [state, setState] = useState<WebLLMState>({
    isLoading: false,
    isInitialized: false,
    error: null,
    progress: "",
  });

  const engineRef = useRef<webllm.MLCEngineInterface | null>(null);

  const cancelInitializeModel = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.unload();
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isInitialized: false,
        error: null,
        progress: "",
      }));
    }
  }, []);

  const initializeModel = useCallback(async (modelId?: string) => {
    const selectedModel = modelId || "SmolLM2-135M-Instruct-q0f16-MLC";

    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
      progress: "Initializing...",
    }));

    try {
      // If we have an existing engine, we can reuse it
      let engine = engineRef.current;
      if (!engine) {
        engine = new webllm.MLCEngine();
        engine.setInitProgressCallback((progress) => {
          setState((prev) => ({
            ...prev,
            progress: progress.text || "Loading...",
          }));
        });
      }

      await engine.reload(selectedModel);

      engineRef.current = engine;
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isInitialized: true,
        progress: "Model ready!",
      }));
    } catch (error) {
      console.error("Failed to initialize WebLLM:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error:
          error instanceof Error ? error.message : "Failed to initialize model",
        progress: "",
      }));
    }
  }, []);

  const generateCodeSuggestion = useCallback(
    async (
      prompt: string,
      codeContext: string,
      language: string = "python"
    ): Promise<string> => {
      if (!engineRef.current) {
        throw new Error("Model not initialized");
      }

      const systemPrompt = `You are a ${language} code generator. You MUST follow these rules strictly:

CRITICAL RULES:
1. Output ONLY valid ${language} code - no explanations, no markdown, no text
2. Do NOT use \`\`\`${language} or \`\`\` code blocks
3. Do NOT add any explanations before or after the code
4. Do NOT repeat "The // operator is used for..." or similar explanations
5. Output should be ready to execute immediately

You will receive code context and a request. Respond with ONLY the ${language} code that addresses the request.

EXAMPLE 1:

Code Context:

for i in range(2):
    print(i)

Request:

Change this to print numbers 0 to 9

Output:

for i in range(10):
    print(i)

EXAMPLE 2:

Code Context:

print("Hello, World!")

Request:

Print each character in the string "Hello, World!" on a new line

Output:

for char in "Hello, World!":
    print(char)


${language.toUpperCase()} CODE ONLY (no markdown, no explanations):
`;

      const userPrompt = `Code Context:
${codeContext}

Request: ${prompt}

${language.toUpperCase()} CODE ONLY (no markdown, no explanations):`;

      try {
        const response = await engineRef.current.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.8,
          max_tokens: 1000,
        });

        let generatedCode = response.choices[0]?.message?.content || "";

        // Clean up the response - remove markdown code blocks and explanations
        generatedCode = generatedCode
          // Remove markdown code blocks
          .replace(/```[\w]*\n?/g, "")
          .replace(/```/g, "")
          // Remove common explanation patterns
          .replace(/Explanation:[\s\S]*$/i, "")
          .replace(/The .* operator is used for[\s\S]*$/i, "")
          // Remove numbered explanations
          .replace(/^\d+\.\s.*$/gm, "")
          // Remove lines that start with explanation keywords
          .replace(/^(Here's|This|The|Explanation|Note:|Output:).*$/gm, "")
          // Clean up excessive whitespace
          .replace(/\n\s*\n\s*\n/g, "\n\n")
          .trim();

        return generatedCode;
      } catch (error) {
        console.error("Failed to generate code:", error);
        throw new Error("Failed to generate code suggestion");
      }
    },
    []
  );

  return {
    state,
    cancelInitializeModel,
    initializeModel,
    generateCodeSuggestion,
  };
};
