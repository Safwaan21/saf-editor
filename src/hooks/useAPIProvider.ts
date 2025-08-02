import { useCallback } from "react";
import { toast } from "sonner";

interface APIConfig {
  provider: "claude" | "gpt" | "gemini";
  apiKey: string;
}

export const useAPIProvider = () => {
  const generateCodeSuggestion = useCallback(
    async (
      prompt: string,
      language: string = "python",
      config: APIConfig
    ): Promise<string> => {
      const systemPrompt = `You are a ${language} code generator. You MUST follow these rules strictly:

CRITICAL RULES:
1. Output ONLY valid ${language} code - no explanations, no markdown, no text
2. Do NOT use \`\`\`${language} or \`\`\` code blocks
3. Do NOT add any explanations before or after the code
4. Output should be ready to execute immediately

You will receive code context and a request. Respond with ONLY the ${language} code that addresses the request.`;

      const userPrompt = `
Request: ${prompt}

${language.toUpperCase()} CODE ONLY (no markdown, no explanations):`;

      try {
        let response;

        switch (config.provider) {
          case "claude":
            response = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": config.apiKey,
              },
              body: JSON.stringify({
                model: "claude-3-haiku-20240307",
                max_tokens: 1000,
                temperature: 0.1,
                messages: [
                  {
                    role: "user",
                    content: `${systemPrompt}\n\n${userPrompt}`,
                  },
                ],
              }),
            });
            break;

          case "gpt":
            response = await fetch(
              "http://localhost:3001/api/openai/chat/completions",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${config.apiKey}`,
                },
                body: JSON.stringify({
                  model: "gpt-4o-mini",
                  temperature: 0.1,
                  max_tokens: 1000,
                  messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                  ],
                }),
              }
            );
            break;

          case "gemini":
            response = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.apiKey}`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  contents: [
                    {
                      parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
                    },
                  ],
                  generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 1000,
                  },
                }),
              }
            );
            break;

          default:
            throw new Error(`Unsupported provider: ${config.provider}`);
        }

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(
            `API request failed: ${response.status} - ${errorData}`
          );
        }

        const data = await response.json();
        let generatedCode = "";

        switch (config.provider) {
          case "claude":
            generatedCode = data.content[0]?.text || "";
            break;
          case "gpt":
            generatedCode = data.choices[0]?.message?.content || "";
            break;
          case "gemini":
            generatedCode = data.candidates[0]?.content?.parts[0]?.text || "";
            break;
        }

        // Clean up the response - same cleanup as WebLLM
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
        toast.error(
          `Failed to generate code via API: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        throw new Error(
          `Failed to generate code suggestion: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    },
    []
  );

  return {
    generateCodeSuggestion,
  };
};
