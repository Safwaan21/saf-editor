export interface WebLLMModel {
  id: string;
  name: string;
  size: string;
  description: string;
}

export interface APIProvider {
  id: "claude" | "gemini" | "gpt";
  name: string;
  keyLabel: string;
  placeholder: string;
}

export interface AIConfiguration {
  type: "webllm" | "api";
  webllmModel?: string;
  apiProvider?: string;
  apiKey?: string;
}

export const WEBLLM_MODELS: WebLLMModel[] = [
  {
    id: "SmolLM2-135M-Instruct-q0f16-MLC",
    name: "SmolLM2 135M",
    size: "360 MB",
    description: "Ultra-lightweight model, fastest loading",
  },
  {
    id: "SmolLM2-360M-Instruct-q4f16_1-MLC",
    name: "SmolLM2 360M",
    size: "376 MB",
    description: "Small but more capable than 135M",
  },
  {
    id: "SmolLM2-1.7B-Instruct-q4f16_1-MLC",
    name: "SmolLM2 1.7B",
    size: "1.8 GB",
    description: "Best balance of size and capability",
  },
  {
    id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    name: "Llama 3.2 1B",
    size: "1.0 GB",
    description: "Meta's efficient 1B parameter model",
  },
  {
    id: "Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC",
    name: "Qwen2.5 Coder 0.5B",
    size: "945 MB",
    description: "Optimized for coding tasks",
  },
  {
    id: "TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC",
    name: "TinyLlama 1.1B",
    size: "697 MB",
    description: "Good general purpose small model",
  },
];

export const API_PROVIDERS: APIProvider[] = [
  {
    id: "claude",
    name: "Claude (Anthropic)",
    keyLabel: "Anthropic API Key",
    placeholder: "sk-ant-api03-...",
  },
  {
    id: "gpt",
    name: "GPT (OpenAI)",
    keyLabel: "OpenAI API Key",
    placeholder: "sk-...",
  },
  {
    id: "gemini",
    name: "Gemini (Google)",
    keyLabel: "Google AI API Key",
    placeholder: "AIza...",
  },
];
