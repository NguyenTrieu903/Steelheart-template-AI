import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFileSync } from "fs";
import { join } from "path";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: join(process.cwd(), ".env") });

interface GeminiConfig {
  apiKey: string;
  model?: string;
  fallbackModel?: string;
  temperature?: number;
  topP?: number;
  maxRetries?: number;
}

export class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private config: GeminiConfig;

  constructor(configPath?: string) {
    this.config = this.loadConfig(configPath);
    this.genAI = new GoogleGenerativeAI(this.config.apiKey);
  }

  private loadConfig(configPath?: string): GeminiConfig {
    // Try to load from config file first, then fall back to env variables
    let config: GeminiConfig;

    if (configPath) {
      try {
        const configFile = readFileSync(configPath, "utf-8");
        const fileConfig = JSON.parse(configFile);
        config = {
          apiKey: fileConfig.apiKey || process.env.GEMINI_API_KEY,
          model: fileConfig.model || "gemini-2.0-flash-exp",
          fallbackModel: fileConfig.fallbackModel || "gemini-1.5-flash",
          temperature: fileConfig.temperature || 0.7,
          topP: fileConfig.topP || 0.8,
          maxRetries: fileConfig.maxRetries || 3,
        };
      } catch (error) {
        console.warn("Could not load config file, using environment variables");
        config = this.getDefaultConfig();
      }
    } else {
      config = this.getDefaultConfig();
    }

    if (!config.apiKey) {
      throw new Error(
        "GEMINI_API_KEY environment variable is required. Get your API key from https://aistudio.google.com/apikey"
      );
    }

    return config;
  }

  private getDefaultConfig(): GeminiConfig {
    return {
      apiKey: process.env.GEMINI_API_KEY || "",
      model: "gemini-2.0-flash-exp",
      fallbackModel: "gemini-1.5-flash",
      temperature: 0.7,
      topP: 0.8,
      maxRetries: 3,
    };
  }

  async generateContent(
    prompt: string,
    systemInstruction?: string,
    maxRetries: number = 3
  ): Promise<string> {
    // First try with primary model
    try {
      return await this.generateWithModel(
        prompt,
        systemInstruction,
        this.config.model!,
        maxRetries
      );
    } catch (primaryError) {
      console.warn(
        `Primary model (${this.config.model}) failed. Trying fallback model...`
      );

      // Try with fallback model if available
      if (
        this.config.fallbackModel &&
        this.config.fallbackModel !== this.config.model
      ) {
        try {
          console.log(
            `Switching to fallback model: ${this.config.fallbackModel}`
          );
          return await this.generateWithModel(
            prompt,
            systemInstruction,
            this.config.fallbackModel,
            maxRetries
          );
        } catch (fallbackError) {
          console.error(`Both primary and fallback models failed.`);
          throw new Error(
            `All models failed. Primary: ${primaryError}. Fallback: ${fallbackError}`
          );
        }
      }

      throw primaryError;
    }
  }

  private async generateWithModel(
    prompt: string,
    systemInstruction: string | undefined,
    modelName: string,
    maxRetries: number
  ): Promise<string> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const model = this.genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: systemInstruction,
          generationConfig: {
            temperature: this.config.temperature,
            topP: this.config.topP,
          },
        });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
      } catch (error: any) {
        lastError = error;

        // Check if it's a retryable error
        const isRetryable = this.isRetryableError(error);

        if (!isRetryable || attempt === maxRetries) {
          console.error(
            `Error with model ${modelName} (attempt ${attempt}/${maxRetries}):`,
            error.message || error
          );
          break;
        }

        // Calculate exponential backoff delay
        const baseDelay = 1000; // 1 second
        const delay =
          baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;

        console.warn(
          `Model ${modelName} attempt ${attempt}/${maxRetries} failed. Retrying in ${Math.round(
            delay
          )}ms...`
        );
        console.warn(`Error: ${error.message || error}`);

        await this.delay(delay);
      }
    }

    throw new Error(
      `Model ${modelName} failed after ${maxRetries} attempts: ${
        lastError.message || lastError
      }`
    );
  }

  private isRetryableError(error: any): boolean {
    // Retry on specific error conditions
    if (error.status) {
      // HTTP status codes that should be retried
      const retryableStatusCodes = [429, 503, 502, 504]; // Rate limit, Service unavailable, Bad gateway, Gateway timeout
      return retryableStatusCodes.includes(error.status);
    }

    // Retry on network errors
    if (error.message) {
      const retryableMessages = [
        "network error",
        "timeout",
        "connection refused",
        "service unavailable",
        "overloaded",
        "temporarily unavailable",
      ];
      const errorMessage = error.message.toLowerCase();
      return retryableMessages.some((msg) => errorMessage.includes(msg));
    }

    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async analyzeRepository(
    repoPath: string,
    analysisType: "code-review" | "documentation" | "testing"
  ): Promise<any> {
    // This method will be implemented by specific service methods
    const prompt = this.buildAnalysisPrompt(repoPath, analysisType);
    const systemInstruction = this.getSystemInstruction(analysisType);

    return await this.generateContent(prompt, systemInstruction);
  }

  private buildAnalysisPrompt(repoPath: string, analysisType: string): string {
    return `Please analyze the repository at: ${repoPath} for ${analysisType}`;
  }

  private getSystemInstruction(analysisType: string): string {
    const instructions = {
      "code-review":
        "You are an expert code reviewer. Analyze the code for bugs, security issues, performance problems, and best practices violations. Provide actionable feedback.",
      documentation:
        "You are a technical documentation expert. Generate comprehensive documentation including API docs, usage examples, and architectural overview.",
      testing:
        "You are a testing expert. Generate unit tests and integration tests that provide good coverage and follow testing best practices.",
    };

    return (
      instructions[analysisType as keyof typeof instructions] ||
      "You are a helpful AI assistant."
    );
  }
}

export default GeminiClient;
