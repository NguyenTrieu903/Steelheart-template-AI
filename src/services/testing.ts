import { RepositoryAnalysis } from "../types";
import { getBranchChanges } from "../utils";
import { extractCodeFromResponse, getFileType } from "../utils/code-extraction";
import { analyzeRepository } from "../utils/repository-analyzer";
import { OpenAIClient } from "./openai-client";
import { writeFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { join, dirname, extname, resolve } from "path";
import simpleGit from "simple-git";

interface TestSetupResult {
  hasTestSetup: boolean;
  testDirectory: string;
  packageJsonPath: string;
  setupPerformed: boolean;
}

export class TestingService {
  private openaiClient: OpenAIClient;

  constructor(configPath?: string) {
    // Don't pass configPath to use the improved steelheart config system
    this.openaiClient = new OpenAIClient();
  }

  // Part 1: Check if the source has set up unit test, if not, set it up
  private async checkAndSetupTestInfrastructure(
    repoPath: string,
    sourcePath: string = process.cwd()
  ): Promise<TestSetupResult> {
    console.log("🔍 Checking test infrastructure...");

    const packageJsonPath = join(sourcePath, "package.json");
    let hasTestSetup = false;
    let testDirectory = "";
    let setupPerformed = false;

    // Check if package.json exists (for Node.js/JavaScript projects)
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

        // Check if test scripts and dependencies are configured
        const hasTestScript =
          packageJson.scripts &&
          (packageJson.scripts.test ||
            packageJson.scripts["test:unit"] ||
            packageJson.scripts.jest);

        const hasTestDeps =
          (packageJson.devDependencies &&
            (packageJson.devDependencies.jest ||
              packageJson.devDependencies.mocha ||
              packageJson.devDependencies.vitest ||
              packageJson.devDependencies["@testing-library/jest-dom"])) ||
          (packageJson.dependencies &&
            (packageJson.dependencies.jest ||
              packageJson.dependencies.mocha ||
              packageJson.dependencies.vitest));

        hasTestSetup = hasTestScript && hasTestDeps;

        if (hasTestSetup) {
          console.log("✅ Test infrastructure already configured");
          // Determine test directory based on existing setup
          testDirectory = this.findExistingTestDirectory(repoPath);
        } else {
          console.log("⚠️  Test infrastructure not found, setting up...");
          const setupResult = await this.setupTestInfrastructure(
            sourcePath,
            packageJson
          );
          testDirectory = setupResult.testDirectory;
          setupPerformed = setupResult.setupPerformed;
          hasTestSetup = true;
        }
      } catch (error) {
        console.error("Error reading package.json:", error);
        // Fallback: create basic test directory
        testDirectory = join(repoPath, "tests");
        setupPerformed = true;
      }
    } else {
      console.log("📦 No package.json found, creating basic test structure...");
      // For non-Node.js projects, create a basic tests directory
      testDirectory = join(repoPath, "tests");
      if (!existsSync(testDirectory)) {
        mkdirSync(testDirectory, { recursive: true });
        setupPerformed = true;
        console.log(`✅ Created test directory: ${testDirectory}`);
      }
    }

    return {
      hasTestSetup,
      testDirectory,
      packageJsonPath,
      setupPerformed,
    };
  }

  private findExistingTestDirectory(repoPath: string): string {
    const possibleTestDirs = [
      join(repoPath, "__tests__"),
      join(repoPath, "tests"),
      join(repoPath, "test"),
      join(repoPath, "src", "__tests__"),
      join(repoPath, "src", "tests"),
      join(repoPath, "spec"),
    ];

    for (const dir of possibleTestDirs) {
      if (existsSync(dir)) {
        console.log(`📁 Found existing test directory: ${dir}`);
        return dir;
      }
    }

    // Default to __tests__ if none found
    const defaultTestDir = join(repoPath, "__tests__");
    console.log(`📁 Using default test directory: ${defaultTestDir}`);
    return defaultTestDir;
  }

  private async setupTestInfrastructure(
    repoPath: string,
    packageJson: any
  ): Promise<{ testDirectory: string; setupPerformed: boolean }> {
    console.log("🔧 Setting up test infrastructure...");

    try {
      // Update package.json with test dependencies and scripts
      if (!packageJson.devDependencies) {
        packageJson.devDependencies = {};
      }

      if (!packageJson.scripts) {
        packageJson.scripts = {};
      }

      // Add Jest as the default testing framework
      packageJson.devDependencies.jest = "^29.0.0";
      packageJson.devDependencies["@types/jest"] = "^29.0.0";
      packageJson.devDependencies["ts-jest"] = "^29.0.0";

      // Add test scripts
      if (!packageJson.scripts.test) {
        packageJson.scripts.test = "jest";
      }
      if (!packageJson.scripts["test:watch"]) {
        packageJson.scripts["test:watch"] = "jest --watch";
      }
      if (!packageJson.scripts["test:coverage"]) {
        packageJson.scripts["test:coverage"] = "jest --coverage";
      }

      // Write updated package.json
      const packageJsonPath = join(repoPath, "package.json");
      writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      console.log("✅ Updated package.json with test dependencies");

      // Create Jest configuration
      const jestConfig = {
        testEnvironment: "node",
        collectCoverageFrom: [
          "src/**/*.{js,ts,jsx,tsx}",
          "!src/**/*.test.{js,ts,jsx,tsx}",
          "!src/**/*.spec.{js,ts,jsx,tsx}",
        ],
        testMatch: [
          "**/__tests__/**/*.(test|spec).{js,ts,jsx,tsx}",
          "**/?(*.)(test|spec).{js,ts,jsx,tsx}",
        ],
        transform: {
          "^.+\\.(ts|tsx)$": "ts-jest",
        },
      };

      const jestConfigPath = join(repoPath, "jest.config.js");
      if (!existsSync(jestConfigPath)) {
        const jestConfigContent = `module.exports = ${JSON.stringify(
          jestConfig,
          null,
          2
        )};`;
        writeFileSync(jestConfigPath, jestConfigContent);
        console.log("✅ Created jest.config.js");
      }

      // Create test directory
      const testDirectory = join(repoPath, "__tests__");
      if (!existsSync(testDirectory)) {
        mkdirSync(testDirectory, { recursive: true });
        console.log(`✅ Created test directory: ${testDirectory}`);
      }

      // Create a sample test file if directory is empty
      const sampleTestPath = join(testDirectory, "sample.test.js");
      if (!existsSync(sampleTestPath)) {
        const sampleTestContent = `// Sample test file
describe('Sample Test Suite', () => {
  test('should run basic test', () => {
    expect(true).toBe(true);
  });
});
`;
        writeFileSync(sampleTestPath, sampleTestContent);
        console.log("✅ Created sample test file");
      }

      console.log("🎉 Test infrastructure setup completed!");

      return {
        testDirectory,
        setupPerformed: true,
      };
    } catch (error) {
      console.error("❌ Error setting up test infrastructure:", error);
      // Fallback: just create test directory
      const fallbackTestDir = join(repoPath, "__tests__");
      if (!existsSync(fallbackTestDir)) {
        mkdirSync(fallbackTestDir, { recursive: true });
      }
      return {
        testDirectory: fallbackTestDir,
        setupPerformed: false,
      };
    }
  }

  async generateTests(
    repoPath: string,
    outputPath?: string,
    baseBranch: string = "main"
  ): Promise<any> {
    try {
      console.log("Starting test generation...");
      console.log(`Analyzing changes in repository: ${repoPath}`);
      console.log(`Base branch: ${baseBranch}`);

      // Part 1: Check and setup test infrastructure
      const testSetup = await this.checkAndSetupTestInfrastructure(
        `${process.cwd()}/src`
      );

      const git = simpleGit(repoPath);
      const currentBranch = (await git.branch()).current;
      console.log(`Current branch: ${currentBranch}`);

      const branchChanges = await getBranchChanges(repoPath, baseBranch);

      if (!branchChanges || branchChanges.changedFiles.length === 0) {
        console.log("No changes found to generate tests for");
        return {
          message: "No changes found",
          testsGenerated: 0,
          testSetup: testSetup,
        };
      }

      const codeFiles = branchChanges.changedFiles.filter(
        (file) =>
          file.file.match(/\.(js|ts|jsx|tsx)$/) &&
          !file.file.match(/\.(test|spec)\.(js|ts|jsx|tsx)$/) &&
          !file.file.includes("node_modules") &&
          !file.file.includes("dist") &&
          !file.file.includes("build")
      );

      if (codeFiles.length === 0) {
        console.log("No code files found that need tests");
        return {
          message: "No testable code files found",
          testsGenerated: 0,
          testSetup: testSetup,
        };
      }

      console.log(
        `Found ${codeFiles.length} code files to generate tests for:`
      );
      codeFiles.forEach((file) => {
        const status = file.isNew ? "[NEW]" : "[MODIFIED]";
        console.log(`  • ${file.file} ${status}`);
      });

      const testResults = [];
      for (const file of codeFiles) {
        console.log(`\nGenerating tests for: ${file.file}`);

        try {
          const testResult = await this.generateTestForFile(
            repoPath,
            file,
            branchChanges,
            baseBranch,
            outputPath,
            testSetup
          );
          testResults.push(testResult);
        } catch (error) {
          console.error(`Error generating test for ${file.file}:`, error);
          testResults.push({
            file: file.file,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const successful = testResults.filter((r) => r.success);
      const failed = testResults.filter((r) => !r.success);

      console.log(`\n✅ Test generation completed!`);
      console.log(`Files processed: ${testResults.length}`);
      console.log(`Tests generated: ${successful.length}`);
      if (failed.length > 0) {
        console.log(`Failed: ${failed.length}`);
        failed.forEach((f) => {
          if ("error" in f) {
            console.log(`  • ${f.file}: ${f.error}`);
          }
        });
      }

      return {
        message: "Test generation completed",
        testsGenerated: successful.length,
        totalFiles: testResults.length,
        results: testResults,
        testSetup: testSetup,
      };
    } catch (error) {
      console.error("Error generating tests:", error);
      throw new Error(`Test generation failed: ${error}`);
    }
  }

  private async generateTestForFile(
    repoPath: string,
    fileInfo: any,
    branchChanges: any,
    baseBranch: string,
    outputPath?: string,
    testSetup?: TestSetupResult
  ) {
    const filePath = join(repoPath, fileInfo.file);

    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fileContent = readFileSync(filePath, "utf8");

    const fileDiff = fileInfo.diff || "";

    const testContent = await this.generateTestContent(
      fileInfo.file,
      fileContent,
      fileDiff,
      fileInfo.isNew
    );

    const fileType = getFileType(fileInfo.file);
    const extractedCode = extractCodeFromResponse(testContent, fileType);

    // Part 2: Use test setup directory instead of output path when available
    const testFilePath = this.getTestFilePath(filePath, outputPath, testSetup);

    this.writeTestFile(
      testFilePath,
      extractedCode || testContent,
      fileInfo.file
    );

    return {
      file: fileInfo.file,
      testFile: testFilePath,
      success: true,
      isNew: fileInfo.isNew,
    };
  }

  // Part 2: Determine test file path based on setup
  private getTestFilePath(
    originalFilePath: string,
    outputPath?: string,
    testSetup?: TestSetupResult
  ): string {
    const ext = extname(originalFilePath);
    const baseName = originalFilePath.replace(ext, "");
    const fileName = baseName.split("/").pop() + ".test" + ext;

    if (testSetup && testSetup.testDirectory) {
      console.log(
        `📁 Using test infrastructure directory: ${testSetup.testDirectory}`
      );
      return join(testSetup.testDirectory, fileName);
    }

    // Priority 3: Look for existing test directories near the source file
    const dir = dirname(originalFilePath);
    const possibleTestDirs = [
      join(dir, "__tests__"),
      join(dir, "tests"),
      join(dir, "test"),
    ];

    for (const testDir of possibleTestDirs) {
      if (existsSync(testDir)) {
        console.log(`📁 Using existing local test directory: ${testDir}`);
        return join(testDir, fileName);
      }
    }

    // Priority 4: Create __tests__ directory next to source file
    const localTestsDir = join(dir, "__tests__");
    console.log(`📁 Creating local test directory: ${localTestsDir}`);
    if (!existsSync(localTestsDir)) {
      mkdirSync(localTestsDir, { recursive: true });
    }
    return join(localTestsDir, fileName);
  }

  private writeTestFile(
    testFilePath: string,
    content: string,
    originalFile: string
  ) {
    const dir = dirname(testFilePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    if (existsSync(testFilePath)) {
      console.log(`Test file already exists: ${testFilePath}`);
      const existingContent = readFileSync(testFilePath, "utf8");
      const mergedContent = this.mergeTestContent(
        existingContent,
        content,
        originalFile
      );
      writeFileSync(testFilePath, mergedContent);
      console.log(`✅ Updated existing test file: ${testFilePath}`);
    } else {
      writeFileSync(testFilePath, content);
      console.log(`✅ Created new test file: ${testFilePath}`);
    }
  }

  private mergeTestContent(
    existingContent: string,
    newContent: string,
    originalFile: string
  ): string {
    const separator = `\n\n// Tests for changes in ${originalFile}\n`;
    return existingContent + separator + newContent;
  }

  private async generateTestContent(
    fileName: string,
    fileContent: string,
    fileDiff: string,
    isNewFile: boolean
  ): Promise<string> {
    const fileType = getFileType(fileName);
    const testFramework = "Jest";

    const prompt = `Generate comprehensive ${testFramework} unit tests for the ${fileType} file: ${fileName}

                          FILE CONTENT:
                          \`\`\`${fileType.toLowerCase()}
                          ${fileContent}
                          \`\`\`

                          ${
                            isNewFile
                              ? "This is a NEW file"
                              : "CHANGES MADE (Git Diff):"
                          }
                          ${
                            isNewFile
                              ? "Generate tests for all functions, classes, and methods in this file."
                              : `\`\`\`diff\n${fileDiff}\n\`\`\``
                          }

                          Requirements:
                          1. Generate tests ONLY for the ${
                            isNewFile
                              ? "functions, classes, and methods"
                              : "added or modified code shown in the diff"
                          }
                          2. Use ${testFramework} testing framework with describe, test/it, and expect assertions
                          3. Include edge cases and error scenarios
                          4. Mock external dependencies appropriately
                          5. Follow ${fileType} best practices
                          6. Ensure tests are syntactically correct and runnable
                          7. Add descriptive test names and comments
                          8. Test both success and failure cases where applicable

                          Generate a complete test file that can be saved as ${fileName.replace(
                            /\.(js|ts|jsx|tsx)$/,
                            ".test.$1"
                          )}`;

    return await this.openaiClient.generateContent(prompt);
  }
}
