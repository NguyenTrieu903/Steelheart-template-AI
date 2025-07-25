import { RepositoryAnalysis } from "../types";
import { analyzeRepository } from "../utils/repository-analyzer";
import { OpenAIClient } from "./openai-client";

export class TestingService {
  private openaiClient: OpenAIClient;

  constructor(configPath?: string) {
    this.openaiClient = new OpenAIClient(configPath);
  }

  async generateTests(repoPath: string, outputPath?: string): Promise<any> {
    try {
      console.log("Starting test generation...");

      const repoAnalysis = await analyzeRepository(repoPath);

      const testContent = await this.generateTestContent(
        repoPath,
        repoAnalysis
      );
      console.log(testContent);
      console.log("Test content generated successfully!");
    } catch (error) {
      console.error("Error generating tests:", error);
      throw new Error(`Test generation failed: ${error}`);
    }
  }

  private async generateTestContent(
    repoPath: string,
    analysis: RepositoryAnalysis
  ): Promise<string> {
    const prompt = `From the ${analysis}, generate unit tests using Jest for all JavaScript functions, classes, or methods that have been added or modified in this branch compared to the master branch.

              Analyze the Git diff between this branch and master, and identify all JavaScript source files with added or changed exports (functions, classes, methods).

              For each identified change, generate appropriate Jest test cases:

                - If a test file (e.g., *.test.js or *.spec.js) already exists, append the new tests to it.

                - If no test file exists, create a new test file in the same folder or a __tests__/ or tests/ directory, consistent with the project’s structure.

              Follow the project's existing testing style, use realistic test inputs, and focus on code coverage and edge cases.

              Ensure the generated tests are:

                - Syntactically correct and runnable

                - Focused only on new or changed logic

                - Written in Jest, using describe, test or it, and expect assertions.

              Do not generate tests for unchanged or deleted code.`;
    return await this.openaiClient.generateContent(prompt);
  }
}
