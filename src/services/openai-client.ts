import OpenAI from "openai";
import { readFileSync } from "fs";
import { join } from "path";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: join(process.cwd(), ".env") });

interface OpenAIConfig {
  apiKey: string;
  model?: string;
  fallbackModel?: string;
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
  organization?: string;
  baseURL?: string;
}

export class OpenAIClient {
  private openai: OpenAI;
  private config: OpenAIConfig;

  constructor(configPath?: string) {
    this.config = this.loadConfig(configPath);
    this.openai = new OpenAI({
      apiKey: this.config.apiKey,
      organization: this.config.organization,
      baseURL: this.config.baseURL,
      maxRetries: this.config.maxRetries || 3,
    });
  }

  private loadConfig(configPath?: string): OpenAIConfig {
    // Try to load from config file first, then fall back to env variables
    let config: OpenAIConfig;

    if (configPath) {
      try {
        const configFile = readFileSync(configPath, "utf-8");
        const fileConfig = JSON.parse(configFile);
        config = {
          apiKey: fileConfig.apiKey || process.env.OPENAI_API_KEY,
          model: fileConfig.model || "gpt-4o-mini",
          fallbackModel: fileConfig.fallbackModel || "gpt-3.5-turbo",
          temperature: fileConfig.temperature || 0.7,
          maxTokens: fileConfig.maxTokens || 4000,
          maxRetries: fileConfig.maxRetries || 3,
          organization: fileConfig.organization || process.env.OPENAI_ORG_ID,
          baseURL: fileConfig.baseURL || process.env.OPENAI_BASE_URL,
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
        "OPENAI_API_KEY environment variable is required. Get your API key from https://platform.openai.com/api-keys"
      );
    }

    return config;
  }

  private getDefaultConfig(): OpenAIConfig {
    return {
      apiKey: process.env.OPENAI_API_KEY || "",
      model: "gpt-4o-mini", // Most cost-effective for your $5 budget
      fallbackModel: "gpt-3.5-turbo",
      temperature: 0.7,
      maxTokens: 4000,
      maxRetries: 3,
      organization: process.env.OPENAI_ORG_ID,
      baseURL: process.env.OPENAI_BASE_URL,
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
        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
          [];

        // Add system message if provided
        if (systemInstruction) {
          messages.push({
            role: "system",
            content: systemInstruction,
          });
        }

        // Add user message
        messages.push({
          role: "user",
          content: prompt,
        });

        const response = await this.openai.chat.completions.create({
          model: modelName,
          messages,
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error("No content received from OpenAI");
        }

        return content;
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
      const retryableStatusCodes = [429, 503, 502, 504, 500]; // Rate limit, Service unavailable, Bad gateway, Gateway timeout, Internal server error
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
        "rate limit",
        "too many requests",
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
        "You are an expert code reviewer with 10+ years of experience. Analyze the code for bugs, security issues, performance problems, and best practices violations. Provide actionable feedback with specific recommendations for improvement.",
      documentation:
        "You are a senior technical documentation expert. Generate comprehensive, clear documentation including API docs, usage examples, installation guides, and architectural overview. Focus on making complex concepts accessible.",
      testing:
        "You are a senior testing engineer and QA expert. Generate comprehensive unit tests, integration tests, and end-to-end tests that provide excellent coverage and follow testing best practices. Include edge cases and error scenarios.",
    };

    return (
      instructions[analysisType as keyof typeof instructions] ||
      "You are a helpful senior software engineer with extensive experience in software development and best practices."
    );
  }

  // Utility method to estimate token usage for cost control
  estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  // Method to check if we're approaching token limits
  validateRequestSize(prompt: string, systemInstruction?: string): boolean {
    const totalText = prompt + (systemInstruction || "");
    const estimatedTokens = this.estimateTokens(totalText);

    // Leave buffer for response tokens (typically need 25-50% of input for response)
    const maxInputTokens = Math.floor((this.config.maxTokens || 4000) * 0.7);

    if (estimatedTokens > maxInputTokens) {
      console.warn(
        `Warning: Request size (${estimatedTokens} tokens) may exceed limits. Consider reducing input size.`
      );
      return false;
    }

    return true;
  }
}

export default OpenAIClient;
