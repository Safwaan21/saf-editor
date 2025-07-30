import React, { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Eye, EyeOff, Download, Zap, Cloud, X } from "lucide-react";
import type { AIConfiguration, WebLLMModel, APIProvider } from "../types/ai";
import { WEBLLM_MODELS, API_PROVIDERS } from "../types/ai";

interface AISetupDialogProps {
  currentConfig: AIConfiguration;
  onSave: (config: AIConfiguration) => void;
  onInitializeWebLLM: (modelId: string) => Promise<void>;
  isWebLLMLoading: boolean;
  webLLMProgress: string;
  cancelInitializeModel: () => void;
}

export const AISetupDialog: React.FC<AISetupDialogProps> = ({
  currentConfig,
  onSave,
  onInitializeWebLLM,
  isWebLLMLoading,
  webLLMProgress,
  cancelInitializeModel,
}) => {
  const [tempConfig, setTempConfig] = useState<AIConfiguration>(currentConfig);
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});

  const handleSave = async () => {
    // If switching to WebLLM, initialize the model
    if (tempConfig.type === "webllm" && tempConfig.webllmModel) {
      await onInitializeWebLLM(tempConfig.webllmModel);
    }

    onSave(tempConfig);
  };

  const toggleApiKeyVisibility = (provider: string) => {
    setShowApiKeys((prev) => ({ ...prev, [provider]: !prev[provider] }));
  };

  return (
    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5" />
          AI Model Setup
        </DialogTitle>
      </DialogHeader>

      <Tabs
        value={tempConfig.type}
        onValueChange={(value: string) =>
          setTempConfig((prev) => ({
            ...prev,
            type: value as "webllm" | "api",
          }))
        }
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="webllm" className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            WebLLM (Local)
          </TabsTrigger>
          <TabsTrigger value="api" className="flex items-center gap-2">
            <Cloud className="w-4 h-4" />
            API Providers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="webllm" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Local AI Models</CardTitle>
              <CardDescription>
                Run AI models directly in your browser. Models are downloaded
                once and cached locally. No internet required after download.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={tempConfig.webllmModel || WEBLLM_MODELS[0].id}
                onValueChange={(value: string) =>
                  setTempConfig((prev) => ({ ...prev, webllmModel: value }))
                }
              >
                {WEBLLM_MODELS.map((model: WebLLMModel) => (
                  <div
                    key={model.id}
                    className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <RadioGroupItem value={model.id} id={model.id} />
                    <Label htmlFor={model.id} className="flex-1 cursor-pointer">
                      <div className="flex justify-between items-start w-full">
                        <div>
                          <div className="font-medium">{model.name}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {model.description}
                          </div>
                        </div>
                        <div className="text-sm font-mono text-gray-500 self-justify-end">
                          {model.size}
                        </div>
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>

              {isWebLLMLoading && (
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                    <span className="text-sm text-blue-800 dark:text-blue-200">
                      {webLLMProgress || "Loading model..."}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={cancelInitializeModel}
                      className="ml-auto"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API Providers</CardTitle>
              <CardDescription>
                Use cloud-based AI models. Requires an internet connection and
                API key. Generally more powerful than local models.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup
                value={tempConfig.apiProvider || API_PROVIDERS[0].id}
                onValueChange={(value: string) =>
                  setTempConfig((prev) => ({ ...prev, apiProvider: value }))
                }
              >
                {API_PROVIDERS.map((provider: APIProvider) => (
                  <div key={provider.id} className="space-y-3">
                    <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                      <RadioGroupItem value={provider.id} id={provider.id} />
                      <Label
                        htmlFor={provider.id}
                        className="flex-1 cursor-pointer"
                      >
                        <div className="font-medium">{provider.name}</div>
                      </Label>
                    </div>

                    {tempConfig.apiProvider === provider.id && (
                      <div className="ml-6 space-y-2">
                        <Label htmlFor={`${provider.id}-key`}>
                          {provider.keyLabel}
                        </Label>
                        <div className="relative">
                          <Input
                            id={`${provider.id}-key`}
                            type={
                              showApiKeys[provider.id] ? "text" : "password"
                            }
                            placeholder={provider.placeholder}
                            value={tempConfig.apiKey || ""}
                            onChange={(
                              e: React.ChangeEvent<HTMLInputElement>
                            ) =>
                              setTempConfig((prev) => ({
                                ...prev,
                                apiKey: e.target.value,
                              }))
                            }
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => toggleApiKeyVisibility(provider.id)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showApiKeys[provider.id] ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500">
                          Your API key is stored locally and never sent to our
                          servers.
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button
          onClick={handleSave}
          disabled={
            isWebLLMLoading ||
            (tempConfig.type === "api" &&
              (!tempConfig.apiProvider || !tempConfig.apiKey))
          }
        >
          {isWebLLMLoading ? "Loading..." : "Save Configuration"}
        </Button>
      </div>
    </DialogContent>
  );
};
