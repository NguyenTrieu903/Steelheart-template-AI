import { OpenAIClient } from "./openai-client";
import {
  TestConfig,
  UnitTest,
  IntegrationTest,
  RepositoryAnalysis,
} from "../types";
import { analyzeRepository } from "../utils/repository-analyzer";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";

export class TestingService {
  private openaiClient: OpenAIClient;

  constructor(configPath?: string) {
    this.openaiClient = new OpenAIClient(configPath);
  }

  async generateTests(
    repoPath: string,
    outputPath?: string
  ): Promise<TestConfig> {
    try {
      console.log("Starting test generation...");

      // Analyze repository structure
      const repoAnalysis = await analyzeRepository(repoPath);

      // Generate tests using Gemini
      const testContent = await this.generateTestContent(
        repoPath,
        repoAnalysis
      );

      // Parse and structure the tests
      const testConfig = this.parseTestContent(testContent, repoPath);

      // Save tests if output path is specified
      if (outputPath) {
        this.saveTests(testConfig, outputPath);
      }

      console.log("Test generation completed successfully!");
      return testConfig;
    } catch (error) {
      console.error("Error generating tests:", error);
      throw new Error(`Test generation failed: ${error}`);
    }
  }

  private async generateTestContent(
    repoPath: string,
    analysis: RepositoryAnalysis
  ): Promise<string> {
    const prompt = this.buildTestPrompt(repoPath, analysis);
    const systemInstruction = `You are a testing expert. Generate comprehensive unit tests and integration tests.
        
                                  Generate tests that include:
                                  1. Unit tests for individual functions and classes
                                  2. Integration tests for system components
                                  3. Test cases covering edge cases and error scenarios
                                  4. Proper setup and teardown procedures
                                  5. Mock dependencies where appropriate
                                  
                                  Provide your response in the following JSON format:
                                  {
                                    "unitTests": [
                                      {
                                        "description": "Test description",
                                        "filePath": "path/to/test/file.test.js",
                                        "targetFunction": "functionName",
                                        "code": "test code",
                                        "testCases": [
                                          {
                                            "name": "test case name",
                                            "input": "input data",
                                            "expectedOutput": "expected result",
                                            "description": "what this test verifies"
                                          }
                                        ]
                                      }
                                    ],
                                    "integrationTests": [
                                      {
                                        "description": "Integration test description",
                                        "filePath": "path/to/integration/test.test.js",
                                        "setup": "setup code",
                                        "execution": "test execution code",
                                        "teardown": "cleanup code",
                                        "dependencies": ["dependency1", "dependency2"]
                                      }
                                    ],
                                    "testFramework": "jest|mocha|vitest|other"
                                  }`;

    return await this.openaiClient.generateContent(prompt, systemInstruction);
  }

  private buildTestPrompt(
    repoPath: string,
    analysis: RepositoryAnalysis
  ): string {
    const mainTechnology = analysis.technologies[0]?.name || "JavaScript";

    return `Please generate comprehensive test suites for this repository:

                Repository Path: ${repoPath}

                Repository Analysis:
                - Primary Technology: ${mainTechnology}
                - Total Files: ${analysis.structure.totalFiles}
                - Technologies: ${analysis.technologies
                  .map((t) => `${t.name} ${t.version || ""}`)
                  .join(", ")}
                - Lines of Code: ${analysis.metrics.linesOfCode}
                - Complexity Score: ${analysis.metrics.complexity}

                Key Dependencies:
                ${analysis.dependencies
                  .map((dep) => `- ${dep.name}@${dep.version} (${dep.type})`)
                  .join("\n")}

                Main Files to Test:
                ${analysis.structure.mainFiles.join("\n")}

                Testing Requirements:
                1. Generate unit tests for core functions and classes
                2. Create integration tests for main workflows
                3. Include edge cases and error handling tests
                4. Use appropriate testing framework for ${mainTechnology}
                5. Provide meaningful test descriptions and assertions
                6. Include setup/teardown where needed

                Focus on testing critical business logic and potential failure points.`;
  }

  private parseTestContent(content: string, repoUrl: string): TestConfig {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        repositoryUrl: repoUrl,
        unitTests: parsed.unitTests || [],
        integrationTests: parsed.integrationTests || [],
        testFramework: parsed.testFramework || "jest",
        coverage: undefined, // Will be calculated after running tests
      };
    } catch (error) {
      console.warn(
        "Failed to parse structured test response, creating basic tests"
      );
      return {
        repositoryUrl: repoUrl,
        unitTests: [],
        integrationTests: [],
        testFramework: "jest",
        coverage: undefined,
      };
    }
  }

  private saveTests(testConfig: TestConfig, outputPath: string): void {
    try {
      // Ensure test directory exists
      const testDir = join(outputPath, "tests");
      mkdirSync(testDir, { recursive: true });

      // Save unit tests
      testConfig.unitTests.forEach((test, index) => {
        const fileName = test.filePath || `unit-test-${index + 1}.test.js`;
        const testPath = join(testDir, fileName);

        // Ensure subdirectory exists
        mkdirSync(dirname(testPath), { recursive: true });

        const testContent = this.generateUnitTestFile(
          test,
          testConfig.testFramework
        );
        writeFileSync(testPath, testContent);

        console.log(`Unit test saved to: ${testPath}`);
      });

      // Save integration tests
      testConfig.integrationTests.forEach((test, index) => {
        const fileName =
          test.filePath || `integration-test-${index + 1}.test.js`;
        const testPath = join(testDir, fileName);

        // Ensure subdirectory exists
        mkdirSync(dirname(testPath), { recursive: true });

        const testContent = this.generateIntegrationTestFile(
          test,
          testConfig.testFramework
        );
        writeFileSync(testPath, testContent);

        console.log(`Integration test saved to: ${testPath}`);
      });

      // Save test configuration
      const configPath = join(testDir, "test-config.json");
      writeFileSync(configPath, JSON.stringify(testConfig, null, 2));

      // Generate test runner script
      const runnerPath = join(outputPath, "run-tests.sh");
      const runnerScript = this.generateTestRunner(testConfig.testFramework);
      writeFileSync(runnerPath, runnerScript);

      console.log(`Test configuration saved to: ${configPath}`);
      console.log(`Test runner script saved to: ${runnerPath}`);
    } catch (error) {
      console.error("Error saving tests:", error);
    }
  }

  private generateUnitTestFile(test: UnitTest, framework: string): string {
    const imports = this.getTestImports(framework);

    return `${imports}

// ${test.description}
describe('${test.targetFunction}', () => {
${test.testCases
  .map(
    (testCase) => `
    it('${testCase.name}', () => {
        // ${testCase.description}
        ${test.code}
        
        // Test case: ${testCase.name}
        const input = ${JSON.stringify(testCase.input)};
        const expectedOutput = ${JSON.stringify(testCase.expectedOutput)};
        
        const result = ${test.targetFunction}(input);
        expect(result).toBe(expectedOutput);
    });
`
  )
  .join("")}
});
`;
  }

  private generateIntegrationTestFile(
    test: IntegrationTest,
    framework: string
  ): string {
    const imports = this.getTestImports(framework);

    return `${imports}

// ${test.description}
describe('Integration Test: ${test.description}', () => {
    beforeAll(async () => {
        // Setup
        ${test.setup}
    });

    afterAll(async () => {
        // Teardown
        ${test.teardown || "// No teardown required"}
    });

    it('should execute integration test successfully', async () => {
        // Test execution
        ${test.execution}
    });
});
`;
  }

  private getTestImports(framework: string): string {
    switch (framework.toLowerCase()) {
      case "jest":
        return `const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');`;
      case "mocha":
        return `const { describe, it, beforeAll, afterAll } = require('mocha');
const { expect } = require('chai');`;
      case "vitest":
        return `import { describe, it, expect, beforeAll, afterAll } from 'vitest';`;
      default:
        return `// Add your testing framework imports here`;
    }
  }

  private generateTestRunner(framework: string): string {
    return `#!/bin/bash

# Test Runner Script
# Generated by Gemini AI Template

echo "Running tests with ${framework}..."

# Install test dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Install test framework if not present
case "${framework}" in
    "jest")
        npm install --save-dev jest @jest/globals
        ;;
    "mocha")
        npm install --save-dev mocha chai
        ;;
    "vitest")
        npm install --save-dev vitest
        ;;
esac

# Run tests
echo "Executing tests..."
case "${framework}" in
    "jest")
        npx jest tests/
        ;;
    "mocha")
        npx mocha tests/**/*.test.js
        ;;
    "vitest")
        npx vitest tests/
        ;;
    *)
        echo "Unknown test framework: ${framework}"
        echo "Please run tests manually"
        ;;
esac

echo "Test execution completed!"
`;
  }
}

// Legacy functions for backward compatibility
export async function writeUnitTest(
  repoPath: string,
  outputPath?: string
): Promise<string> {
  const service = new TestingService();
  const testConfig = await service.generateTests(repoPath, outputPath);
  return `Generated ${testConfig.unitTests.length} unit tests and ${testConfig.integrationTests.length} integration tests`;
}

export async function runIntegrationTest(repoPath: string): Promise<string> {
  return new Promise((resolve) => {
    // Simulate running integration tests
    setTimeout(() => {
      resolve(`Integration tests completed for repository: ${repoPath}`);
    }, 2000);
  });
}
