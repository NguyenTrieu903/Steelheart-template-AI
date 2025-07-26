import { RepositoryAnalysis } from "../types";
import { getBranchChanges } from "../utils";
import { extractCodeFromResponse, getFileType } from "../utils/code-extraction";
import { analyzeRepository } from "../utils/repository-analyzer";
import { OpenAIClient } from "./openai-client";
import { writeFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { join, dirname, extname } from "path";
import simpleGit from "simple-git";

export class TestingService {
  private openaiClient: OpenAIClient;

  constructor(configPath?: string) {
    this.openaiClient = new OpenAIClient(configPath);
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

      const git = simpleGit(repoPath);
      const currentBranch = (await git.branch()).current;
      console.log(`Current branch: ${currentBranch}`);

      const branchChanges = await getBranchChanges(repoPath, baseBranch);

      if (!branchChanges || branchChanges.changedFiles.length === 0) {
        console.log("No changes found to generate tests for");
        return { message: "No changes found", testsGenerated: 0 };
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
        return { message: "No testable code files found", testsGenerated: 0 };
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
            outputPath
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
    outputPath?: string
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

    const testFilePath = this.getTestFilePath(filePath, outputPath);

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

  private getTestFilePath(
    originalFilePath: string,
    outputPath?: string
  ): string {
    const ext = extname(originalFilePath);
    const baseName = originalFilePath.replace(ext, "");

    if (outputPath) {
      const fileName = baseName.split("/").pop() + ".test" + ext;
      return join(outputPath, fileName);
    } else {
      const dir = dirname(originalFilePath);
      const fileName = baseName.split("/").pop() + ".test" + ext;

      const testsDir = join(dir, "__tests__");
      if (existsSync(testsDir)) {
        return join(testsDir, fileName);
      } else {
        return join(dir, fileName);
      }
    }
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
