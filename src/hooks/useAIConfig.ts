import { useState, useEffect, useCallback } from "react";
import type { AIConfiguration } from "../types/ai";

const AI_CONFIG_KEY = "ai-configuration";

export const useAIConfig = () => {
  const [config, setConfig] = useState<AIConfiguration>({
    type: "webllm",
    webllmModel: "SmolLM2-135M-Instruct-q0f16-MLC",
  });

  // Load configuration from localStorage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem(AI_CONFIG_KEY);
    if (savedConfig) {
      try {
        const parsedConfig = JSON.parse(savedConfig) as AIConfiguration;
        setConfig(parsedConfig);
      } catch (error) {
        console.error("Failed to parse saved AI configuration:", error);
      }
    }
  }, []);

  const saveConfig = useCallback((newConfig: AIConfiguration) => {
    setConfig(newConfig);
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(newConfig));
  }, []);

  const generateCodeSuggestion = useCallback(
    async (
      prompt: string,
      codeContext: string,
      language: string = "python",
      webllmHook?: {
        generateCodeSuggestion: (
          prompt: string,
          codeContext: string,
          language: string
        ) => Promise<string>;
      },
      apiHook?: {
        generateCodeSuggestion: (
          prompt: string,
          codeContext: string,
          language: string,
          config: { provider: string; apiKey: string }
        ) => Promise<string>;
      }
    ): Promise<string> => {
      if (config.type === "webllm") {
        if (!webllmHook) {
          throw new Error("WebLLM hook not available");
        }
        return webllmHook.generateCodeSuggestion(prompt, codeContext, language);
      } else {
        if (!apiHook) {
          throw new Error("API hook not available");
        }
        if (!config.apiProvider || !config.apiKey) {
          throw new Error("API provider or key not configured");
        }
        return apiHook.generateCodeSuggestion(prompt, codeContext, language, {
          provider: config.apiProvider,
          apiKey: config.apiKey,
        });
      }
    },
    [config]
  );

  return {
    config,
    saveConfig,
    generateCodeSuggestion,
  };
};
