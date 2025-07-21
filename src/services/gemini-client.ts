import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFileSync } from "fs";
import { join } from "path";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: join(process.cwd(), ".env") });

interface GeminiConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  topP?: number;
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
          temperature: fileConfig.temperature || 0.7,
          topP: fileConfig.topP || 0.8,
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
      temperature: 0.7,
      topP: 0.8,
    };
  }

  async generateContent(
    prompt: string,
    systemInstruction?: string
  ): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: this.config.model!,
        systemInstruction: systemInstruction,
        generationConfig: {
          temperature: this.config.temperature,
          topP: this.config.topP,
        },
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error("Error generating content:", error);
      throw new Error(`Failed to generate content: ${error}`);
    }
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
