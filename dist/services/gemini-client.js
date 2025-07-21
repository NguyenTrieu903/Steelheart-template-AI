"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiClient = void 0;
const generative_ai_1 = require("@google/generative-ai");
const fs_1 = require("fs");
const path_1 = require("path");
const dotenv = __importStar(require("dotenv"));
// Load environment variables
dotenv.config({ path: (0, path_1.join)(process.cwd(), ".env") });
class GeminiClient {
    constructor(configPath) {
        this.config = this.loadConfig(configPath);
        this.genAI = new generative_ai_1.GoogleGenerativeAI(this.config.apiKey);
    }
    loadConfig(configPath) {
        // Try to load from config file first, then fall back to env variables
        let config;
        if (configPath) {
            try {
                const configFile = (0, fs_1.readFileSync)(configPath, "utf-8");
                const fileConfig = JSON.parse(configFile);
                config = {
                    apiKey: fileConfig.apiKey || process.env.GEMINI_API_KEY,
                    model: fileConfig.model || "gemini-2.0-flash-exp",
                    temperature: fileConfig.temperature || 0.7,
                    topP: fileConfig.topP || 0.8,
                };
            }
            catch (error) {
                console.warn("Could not load config file, using environment variables");
                config = this.getDefaultConfig();
            }
        }
        else {
            config = this.getDefaultConfig();
        }
        if (!config.apiKey) {
            throw new Error("GEMINI_API_KEY environment variable is required. Get your API key from https://aistudio.google.com/apikey");
        }
        return config;
    }
    getDefaultConfig() {
        return {
            apiKey: process.env.GEMINI_API_KEY || "",
            model: "gemini-2.0-flash-exp",
            temperature: 0.7,
            topP: 0.8,
        };
    }
    async generateContent(prompt, systemInstruction) {
        try {
            const model = this.genAI.getGenerativeModel({
                model: this.config.model,
                systemInstruction: systemInstruction,
                generationConfig: {
                    temperature: this.config.temperature,
                    topP: this.config.topP,
                },
            });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        }
        catch (error) {
            console.error("Error generating content:", error);
            throw new Error(`Failed to generate content: ${error}`);
        }
    }
    async analyzeRepository(repoPath, analysisType) {
        // This method will be implemented by specific service methods
        const prompt = this.buildAnalysisPrompt(repoPath, analysisType);
        const systemInstruction = this.getSystemInstruction(analysisType);
        return await this.generateContent(prompt, systemInstruction);
    }
    buildAnalysisPrompt(repoPath, analysisType) {
        return `Please analyze the repository at: ${repoPath} for ${analysisType}`;
    }
    getSystemInstruction(analysisType) {
        const instructions = {
            "code-review": "You are an expert code reviewer. Analyze the code for bugs, security issues, performance problems, and best practices violations. Provide actionable feedback.",
            documentation: "You are a technical documentation expert. Generate comprehensive documentation including API docs, usage examples, and architectural overview.",
            testing: "You are a testing expert. Generate unit tests and integration tests that provide good coverage and follow testing best practices.",
        };
        return (instructions[analysisType] ||
            "You are a helpful AI assistant.");
    }
}
exports.GeminiClient = GeminiClient;
exports.default = GeminiClient;
//# sourceMappingURL=gemini-client.js.map