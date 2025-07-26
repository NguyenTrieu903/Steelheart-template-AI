import { OpenAIClient } from "./openai-client";
import { ReviewReport, Issue, Suggestion, RepositoryAnalysis } from "../types";
import { analyzeRepository } from "../utils/repository-analyzer";
import { extractCodeFromResponse, getFileType } from "../utils/code-extraction";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join, dirname } from "path";

export class CodeReviewService {
  private openaiClient: OpenAIClient;

  constructor(configPath?: string) {
    this.openaiClient = new OpenAIClient(configPath);
  }

  async performBranchReview(
    repoPath: string,
    branchChanges: any,
    outputPath?: string,
    autoComment: boolean = false
  ): Promise<any> {
    try {
      console.log("Starting enhanced branch review analysis...");

      const repoAnalysis = await analyzeRepository(repoPath);

      const reviewContent = await this.generateBranchReviewContent(
        repoPath,
        repoAnalysis,
        branchChanges
      );
      if (outputPath) {
        this.saveRawReviewContent(reviewContent, outputPath, "branch-review");
      }

      if (autoComment) {
        console.log("Auto-commenting new and changed code...");
        const commentResults = await this.autoCommentChangedCode(
          repoPath,
          branchChanges
        );
      }

      console.log("Enhanced branch code review completed successfully!");
    } catch (error) {
      console.error("Error performing branch review:", error);
      throw new Error(`Branch code review failed: ${error}`);
    }
  }

  private async generateBranchReviewContent(
    repoPath: string,
    analysis: RepositoryAnalysis,
    branchChanges: any
  ): Promise<string> {
    const newFiles = branchChanges.changedFiles.filter(
      (file: any) => file.isNew
    );
    const modifiedFiles = branchChanges.changedFiles.filter(
      (file: any) => !file.isNew
    );

    const newFileContents: any = {};
    const modifiedFileContents: any = {};
    for (const file of newFiles) {
      try {
        const fullPath = join(repoPath, file.file);
        if (existsSync(fullPath)) {
          const content = readFileSync(fullPath, "utf8");
          newFileContents[file.file] = content;
        }
      } catch (error) {
        console.warn(`Could not read new file ${file.file}:`, error);
      }
    }

    for (const file of modifiedFiles) {
      try {
        const fullPath = join(repoPath, file.file);
        if (existsSync(fullPath)) {
          const content = readFileSync(fullPath, "utf8");
          modifiedFileContents[file.file] = content;
        }
      } catch (error) {
        console.warn(`Could not read modified file ${file.file}:`, error);
      }
    }

    const prompt = this.buildBranchReviewPrompt(
      repoPath,
      analysis,
      branchChanges,
      newFileContents,
      modifiedFileContents
    );
    const systemInstruction = `You are a senior code reviewer with 10+ years of experience. Perform a comprehensive code review focusing on:

                                  FOR NEW FILES (complete review):
                                  1. Architecture and design patterns
                                  2. Code quality and best practices
                                  3. Security vulnerabilities
                                  4. Performance considerations
                                  5. Error handling and edge cases
                                  6. Documentation and comments
                                  7. Testing considerations
                                  8. Integration with existing codebase

                                  FOR MODIFIED FILES (focused review on changes):
                                  1. Review the actual changes made (analyze the diff)
                                  2. Impact of changes on existing functionality
                                  3. Potential breaking changes or regressions
                                  4. Security implications of modifications
                                  5. Performance impact of the changes
                                  6. Code style consistency with existing code
                                  7. Error handling for new/modified logic
                                  8. Test coverage for modified functionality

                                  IMPORTANT: 
                                  - For NEW files: Review the entire file comprehensively
                                  - For MODIFIED files: Focus on the changes but consider the full context
                                  - Provide specific feedback on both what was added/changed and how it fits with existing code
                                  - Flag any potential issues with the modifications
                                  - Suggest improvements for both new and modified code
                                  `;

    return await this.openaiClient.generateContent(prompt, systemInstruction);
  }

  private buildBranchReviewPrompt(
    repoPath: string,
    analysis: RepositoryAnalysis,
    branchChanges: any,
    newFileContents: any,
    modifiedFileContents: any
  ): string {
    const newFiles = branchChanges.changedFiles.filter(
      (file: any) => file.isNew
    );
    const modifiedFiles = branchChanges.changedFiles.filter(
      (file: any) => !file.isNew
    );

    return `Please perform a comprehensive code review of this branch with focus on BOTH new files and modified files:

                Repository Path: ${repoPath}
                Branch: ${branchChanges.currentBranch} (compared to ${
      branchChanges.baseBranch
    })

                ## Repository Context:
                - Total Files: ${analysis.structure.totalFiles}
                - Technologies: ${analysis.technologies
                  .map((t) => `${t.name} ${t.version || ""}`)
                  .join(", ")}
                - Lines of Code: ${analysis.metrics.linesOfCode}

                ## Branch Changes Summary:
                - Total Files Changed: ${branchChanges.totalChanges}
                - New Files Added: ${newFiles.length}
                - Existing Files Modified: ${modifiedFiles.length}
                - Lines Added: ${branchChanges.totalInsertions}
                - Lines Removed: ${branchChanges.totalDeletions}

                ## NEW FILES (Full Review Required):
                ${
                  newFiles.length > 0
                    ? newFiles
                        .map(
                          (file: any) =>
                            `### ${file.file} (+${file.insertions || 0} lines)
                ${
                  newFileContents[file.file]
                    ? `\`\`\`\n${newFileContents[file.file].substring(
                        0,
                        200000
                      )}\n${
                        newFileContents[file.file].length > 200000
                          ? "... (truncated)\n"
                          : ""
                      }\`\`\``
                    : "Content not available"
                }
                `
                        )
                        .join("\n")
                    : "None"
                }

                ## MODIFIED FILES (Change Review Required):
                ${
                  modifiedFiles.length > 0
                    ? modifiedFiles
                        .map(
                          (file: any) =>
                            `### ${file.file} (+${file.insertions || 0} -${
                              file.deletions || 0
                            })
                ${
                  modifiedFileContents[file.file]
                    ? `**Current File Content:**
                \`\`\`
                ${modifiedFileContents[file.file].substring(0, 100000)}${
                        modifiedFileContents[file.file].length > 100000
                          ? "\n... (truncated for length)"
                          : ""
                      }
                \`\`\`

                **Changes in this file:**
                \`\`\`diff
                ${file.diff || "No diff available"}
                \`\`\``
                    : "Content not available"
                }
                `
                        )
                        .join("\n")
                    : "None"
                }

                ## Diff Changes:
                \`\`\`diff
                ${branchChanges.diffContent.substring(0, 3000)}
                ${
                  branchChanges.diffContent.length > 3000
                    ? "\n... (truncated for brevity)"
                    : ""
                }
                \`\`\`

                ## Review Requirements:

                **For NEW FILES - Perform complete analysis:**
                1. Architecture and design patterns compliance
                2. Code quality and adherence to best practices  
                3. Security vulnerabilities and potential attack vectors
                4. Performance implications and optimizations
                5. Error handling and edge case coverage
                6. Integration points with existing codebase
                7. Documentation and maintainability
                8. Testing strategy recommendations

                **For MODIFIED FILES - Analyze changes thoroughly:**
                1. Review each change in the diff carefully
                2. Impact assessment on existing functionality
                3. Breaking change identification and regression risks
                4. Security implications of modifications
                5. Performance impact analysis of the changes
                6. Code style consistency with existing patterns
                7. Logic correctness and error handling improvements
                8. Test coverage needs for modified functionality

                **IMPORTANT:** Provide equal attention to both new and modified files. For modified files, focus on understanding what changed and why, then assess the impact and quality of those specific changes.

                Please provide detailed analysis with specific line numbers and actionable feedback for both new files and modifications.`;
  }

  private saveRawReviewContent(
    content: string,
    outputPath: string,
    prefix: string
  ): void {
    try {
      const fileName = `${prefix}-${new Date().toISOString().split("T")[0]}.md`;
      const filePath = join(outputPath, fileName);

      mkdirSync(dirname(filePath), { recursive: true });

      writeFileSync(filePath, content);

      console.log(`Raw review content saved to: ${filePath}`);
    } catch (error) {
      console.error("Error saving raw review content:", error);
    }
  }

  public async autoCommentChangedCode(
    repoPath: string,
    branchChanges: any
  ): Promise<any[]> {
    const results: any[] = [];

    const codeFiles = branchChanges.changedFiles.filter((file: any) =>
      file.file.match(/\.(js|ts|jsx|tsx|py|java|go|rs|php|rb|cpp|c|h)$/)
    );

    console.log(`💬 Auto-commenting ${codeFiles.length} code files...`);

    for (const fileInfo of codeFiles) {
      const filePath = join(repoPath, fileInfo.file);

      if (!existsSync(filePath)) {
        results.push({
          file: fileInfo.file,
          success: false,
          error: "File not found",
        });
        continue;
      }

      try {
        console.log(
          `   Processing: ${fileInfo.file}${fileInfo.isNew ? " [NEW]" : ""}`
        );

        const fileContent = readFileSync(filePath, "utf8");

        const fileDiff = fileInfo.diff || "";

        const commentedCode = await this.generateSmartComments(
          fileInfo.file,
          fileContent,
          fileDiff,
          fileInfo.isNew
        );

        if (
          commentedCode.content !== fileContent &&
          commentedCode.commentsAdded > 0
        ) {
          writeFileSync(filePath, commentedCode.content);
          console.log(
            `   ✅ Added ${commentedCode.commentsAdded} comments to ${fileInfo.file}`
          );

          results.push({
            file: fileInfo.file,
            commentsAdded: commentedCode.commentsAdded,
            success: true,
            isNew: fileInfo.isNew,
          });
        } else {
          console.log(`   ℹ️  No new comments needed for ${fileInfo.file}`);
          results.push({
            file: fileInfo.file,
            commentsAdded: 0,
            success: true,
            isNew: fileInfo.isNew,
          });
        }
      } catch (error) {
        console.log(`   ❌ Error commenting ${fileInfo.file}: ${error}`);
        results.push({
          file: fileInfo.file,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  private async generateSmartComments(
    fileName: string,
    fileContent: string,
    fileDiff: string,
    isNewFile: boolean
  ): Promise<{ content: string; commentsAdded: number; preview: string }> {
    const fileType = getFileType(fileName);

    const prompt = `As a senior developer, auto-comment all newly added or changed ${fileType} functions and modules in this code. Include inline suggestions where test coverage or docstrings are missing.

                      FILE: ${fileName}
                      TYPE: ${isNewFile ? "NEW FILE" : "MODIFIED FILE"}

                      ${
                        isNewFile
                          ? "FULL NEW FILE CONTENT:"
                          : "CHANGES MADE (Git Diff):"
                      }
                      ${
                        isNewFile
                          ? `\`\`\`${fileType.toLowerCase()}\n${fileContent}\n\`\`\``
                          : `\`\`\`diff\n${fileDiff}\n\`\`\``
                      }

                      ${
                        !isNewFile
                          ? `\nFULL FILE CONTEXT:\n\`\`\`${fileType.toLowerCase()}\n${fileContent}\n\`\`\``
                          : ""
                      }

                      SENIOR DEVELOPER INSTRUCTIONS:
                      1. **Focus on NEW/CHANGED code only** - Don't comment unchanged code
                      2. **Add strategic comments for**:
                        - Complex business logic and algorithms
                        - Non-obvious implementation decisions
                        - Security considerations
                        - Performance implications
                        - Edge cases and error handling
                        - Integration points and dependencies

                      3. **Include inline suggestions where missing**:
                        - "// TODO: Add unit tests for edge cases"
                        - "// TODO: Add JSDoc/docstring for this function"
                        - "// SUGGESTION: Consider error handling for..."
                        - "// PERFORMANCE: Consider caching this expensive operation"
                        - "// SECURITY: Validate input parameters"

                      4. **Comment style guidelines**:
                        - Use appropriate syntax for ${fileType}
                        - Focus on WHY, not WHAT
                        - Be concise but informative
                        - Add function/class documentation where missing
                        - Suggest improvements and testing needs

                      5. **Quality standards**:
                        - Don't over-comment obvious code
                        - Explain complex algorithms step-by-step
                        - Document API contracts and assumptions
                        - Highlight potential issues or improvements`;

    const systemInstruction = `You are a senior software engineer with 15+ years of experience in code review, documentation, and mentoring. Your role is to add meaningful, strategic comments that help junior developers understand complex code, improve code quality, and identify areas needing testing or documentation. Focus on code clarity, maintainability, and best practices.`;

    try {
      const response = await this.openaiClient.generateContent(
        prompt,
        systemInstruction
      );

      const extractedCode = extractCodeFromResponse(response, fileType);

      return {
        content: extractedCode || fileContent,
        commentsAdded: extractedCode && extractedCode !== fileContent ? 1 : 0,
        preview: `Added strategic comments to ${fileName}`,
      };
    } catch (error) {
      console.warn(`Failed to generate AI comments for ${fileName}:`, error);
    }

    return {
      content: fileContent,
      commentsAdded: 0,
      preview: `Could not generate comments for ${fileName}`,
    };
  }
}
