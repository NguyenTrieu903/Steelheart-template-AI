export declare class GeminiClient {
    private genAI;
    private config;
    constructor(configPath?: string);
    private loadConfig;
    private getDefaultConfig;
    generateContent(prompt: string, systemInstruction?: string): Promise<string>;
    analyzeRepository(repoPath: string, analysisType: "code-review" | "documentation" | "testing"): Promise<any>;
    private buildAnalysisPrompt;
    private getSystemInstruction;
}
export default GeminiClient;
//# sourceMappingURL=gemini-client.d.ts.map