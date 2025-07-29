import { OpenAIClient } from "./openai-client";
import { ReviewReport, Issue, Suggestion, RepositoryAnalysis } from "../types";
import { analyzeRepository } from "../utils/repository-analyzer";
import { extractCodeFromResponse, getFileType } from "../utils/code-extraction";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join, dirname } from "path";

export class CodeReviewService {
  private openaiClient: OpenAIClient;

  constructor(configPath?: string) {
    // Don't pass configPath to use the improved steelheart config system
    this.openaiClient = new OpenAIClient();
  }

  async performBranchReview(
    repoPath: string,
    branchChanges: any,
    outputPath?: string,
    autoComment: boolean = false
  ): Promise<{
    decision: "PASS" | "FAIL";
    criticalIssues: string[];
    majorIssues: string[];
    minorIssues: string[];
    summary: string;
    rawContent: string;
  }> {
    try {
      console.log("Starting enhanced branch review analysis...");

      const repoAnalysis = await analyzeRepository(repoPath);

      const reviewContent = await this.generateBranchReviewContent(
        repoPath,
        repoAnalysis,
        branchChanges
      );

      // Extract structured results from review content
      const structuredResult = this.parseReviewContent(reviewContent);

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

      console.log(`Review completed: ${structuredResult.decision}`);
      if (structuredResult.criticalIssues.length > 0) {
        console.log(
          `❌ ${structuredResult.criticalIssues.length} critical issues found`
        );
      }
      if (structuredResult.majorIssues.length > 0) {
        console.log(
          `⚠️  ${structuredResult.majorIssues.length} major issues found`
        );
      }

      return structuredResult;
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
    const systemInstruction = `You are a senior code reviewer with 10+ years of experience. Your role is to provide a PASS/FAIL decision with detailed analysis.

                                  RESPONSE FORMAT REQUIRED:
                                  ## REVIEW DECISION: [PASS/FAIL]
                                  
                                  ## CRITICAL ISSUES:
                                  🔴 **CRITICAL** - [If any critical issues exist, list them here. If none, write "None."]
                                  
                                  ## MAJOR ISSUES:
                                  🟡 **MAJOR** - [If any major issues exist, list them here. If none, write "None."]
                                  
                                  ## MINOR ISSUES:
                                  🔵 **MINOR** - [If any minor issues exist, list them here. If none, write "None."]
                                  
                                  ## DETAILED ANALYSIS:
                                  
                                  ### NEW FILES:
                                  [Comprehensive review of new files]
                                  
                                  ### MODIFIED FILES:
                                  [Focused review on changes and their impact]
                                  
                                  ## ACTIONABLE SOLUTIONS:
                                  [Specific code fixes and improvements]
                                  
                                  EVALUATION CRITERIA:
                                  - **PASS**: No critical issues, acceptable quality for production
                                  - **FAIL**: Has critical security/functionality/breaking change issues
                                  
                                  IMPORTANT: 
                                  - If there are NO issues in a category, write "None." 
                                  - Only list ACTUAL issues found, not category descriptions
                                  - Be specific with file names and line numbers when possible
                                  
                                  Focus on production readiness and code quality standards.`;

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

                **MANDATORY REVIEW CRITERIA (must evaluate for PASS/FAIL):**

                **🔴 CRITICAL (FAIL if found):**
                1. **Security Vulnerabilities**: SQL injection, XSS, authentication bypass, data exposure
                2. **Breaking Changes**: API changes, removed features, incompatible modifications
                3. **Critical Bugs**: Null pointer exceptions, infinite loops, data corruption
                4. **Production Blockers**: Missing error handling for critical paths, hardcoded secrets

                **🟡 MAJOR (should fix before merge):**
                1. **Performance Issues**: N+1 queries, memory leaks, inefficient algorithms
                2. **Code Quality**: Duplicated logic, poor abstraction, hard-to-maintain code
                3. **Missing Tests**: No unit tests for business logic, missing integration tests
                4. **Documentation**: Missing API docs, unclear complex logic

                **🔵 MINOR (can fix after merge):**
                1. **Code Style**: Formatting, naming conventions, minor refactoring
                2. **Optimization**: Small performance improvements, better variable names
                3. **Documentation**: Comments, README updates, inline documentation

                **FOR NEW FILES - Complete analysis required:**
                - Architecture compliance and design patterns
                - Security vulnerability scan (authentication, authorization, input validation)
                - Performance bottlenecks and resource usage
                - Error handling completeness (try-catch, null checks, edge cases)
                - Integration impact with existing systems
                - Test coverage strategy and missing tests
                - Documentation and maintainability assessment

                **FOR MODIFIED FILES - Change-focused analysis:**
                - Line-by-line diff review for logic correctness
                - Breaking change detection (API changes, behavior changes)
                - Regression risk assessment on existing functionality
                - Security impact of each modification
                - Performance implications of changes
                - Backward compatibility verification
                - Test update requirements for modified logic

                **DECISION FRAMEWORK:**
                - **PASS**: Zero critical issues, minor/major issues are acceptable for production
                - **FAIL**: One or more critical issues that block safe deployment

                **REQUIRED OUTPUT:**
                1. Clear PASS/FAIL decision with reasoning
                2. Categorized issues by severity (🔴🟡🔵)
                3. Specific line numbers and code snippets for each issue
                4. Actionable solutions with code examples where possible
                5. Priority order for fixing issues

                Provide detailed, actionable feedback that enables immediate issue resolution.`;
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

    const prompt = `As a senior developer reviewer, analyze and enhance this ${fileType} code with strategic comments and improvement suggestions.

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

                      SENIOR REVIEWER GUIDELINES:
                      
                      **PRIORITY 1 - Critical Issues (Flag for Review)**:
                      - Security vulnerabilities (input validation, authentication)
                      - Performance bottlenecks (expensive operations, memory leaks)
                      - Error handling gaps (uncaught exceptions, null checks)
                      - Breaking changes or compatibility issues
                      
                      **PRIORITY 2 - Quality Improvements**:
                      - Complex business logic explanations
                      - Non-obvious implementation decisions
                      - Integration points and dependencies
                      - Code maintainability suggestions
                      
                      **PRIORITY 3 - Developer Guidance**:
                      - Testing recommendations with specific test cases
                      - Documentation gaps (JSDoc, function contracts)
                      - Code style and best practice suggestions
                      - Performance optimization opportunities
                      
                      **COMMENT TYPES TO ADD**:
                      - \`// CRITICAL: [Security/Performance/Error issue]\`
                      - \`// TODO: Add unit tests for [specific scenarios]\`
                      - \`// REVIEW: Consider [alternative approach]\`
                      - \`// DOCS: Add JSDoc/docstring explaining [purpose/params]\`
                      - \`// PERF: Optimize [specific operation]\`
                      - \`// SECURITY: Validate [input/authorization]\`
                      
                      **OUTPUT REQUIREMENTS**:
                      1. Return the COMPLETE file with strategic comments added
                      2. Focus on NEW/CHANGED code only
                      3. Use appropriate syntax for ${fileType}
                      4. Prioritize actionable, specific feedback
                      5. Include line-specific improvement suggestions
                      
                      Make the code more maintainable and help junior developers understand complex logic.`;

    const systemInstruction = `You are a senior software engineer and code reviewer with 15+ years of experience. Your role is to enhance code quality through strategic commenting and identification of improvement opportunities.

RESPONSE REQUIREMENTS:
1. Return the COMPLETE file with added comments
2. Focus on critical issues, quality improvements, and developer guidance
3. Use appropriate comment syntax for the file type
4. Prioritize actionable feedback over general observations
5. Help junior developers understand complex logic and best practices

EVALUATION PRIORITIES:
- Security and performance issues (highest priority)
- Code maintainability and best practices
- Testing and documentation gaps
- Developer learning opportunities

Provide meaningful, strategic comments that improve code quality and team knowledge transfer.`;

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

  private parseReviewContent(content: string): {
    decision: "PASS" | "FAIL";
    criticalIssues: string[];
    majorIssues: string[];
    minorIssues: string[];
    summary: string;
    rawContent: string;
  } {
    let decision: "PASS" | "FAIL" = "PASS";
    const criticalIssues: string[] = [];
    const majorIssues: string[] = [];
    const minorIssues: string[] = [];
    let summary = "";

    // Extract decision - look for both formats
    const decisionMatch =
      content.match(/## REVIEW DECISION:\s*(PASS|FAIL)/i) ||
      content.match(/Decision:\s*(PASS|FAIL)/i);
    if (decisionMatch) {
      decision = decisionMatch[1].toUpperCase() as "PASS" | "FAIL";
    }

    // Extract critical issues - look for actual issue content, not headers
    const criticalSection = content.match(
      /🔴.*?Critical.*?Issues.*?\n(.*?)(?=🟡|🔵|##|$)/s
    );
    if (criticalSection) {
      const issueText = criticalSection[1];
      // Only extract if there's actual content (not just "None" or empty)
      if (
        issueText &&
        !issueText.match(/^\s*(None|No critical issues)\s*\.?\s*$/i)
      ) {
        const issues = issueText.match(/(?:^|\n)\s*[-*]\s*(.+)/g);
        if (issues) {
          issues.forEach((issue) => {
            const cleanIssue = issue.replace(/^[\n\s]*[-*]\s*/, "").trim();
            if (
              cleanIssue &&
              !cleanIssue.match(/^(Location:|Details:|Actionable Solution:)/i)
            ) {
              criticalIssues.push(cleanIssue);
            }
          });
        }
      }
    }

    // Extract major issues
    const majorSection = content.match(
      /.*?Major.*?Issues.*?\n(.*?)(?=🔴|🔵|##|$)/s
    );
    if (majorSection) {
      const issueText = majorSection[1];
      if (
        issueText &&
        !issueText.match(/^\s*(None|No major issues)\s*\.?\s*$/i)
      ) {
        // Look for actual issue titles, not just any bullet point
        const issueBlocks = issueText.split(/\n(?=\w)/); // Split on lines that start with a word
        issueBlocks.forEach((block) => {
          const firstLine = block.split("\n")[0].trim();
          if (
            firstLine &&
            !firstLine.match(/^(Location:|Details:|Actionable Solution:)/i) &&
            !firstLine.includes("fix before merge") &&
            firstLine.length > 10
          ) {
            // Avoid short generic text
            majorIssues.push(firstLine);
          }
        });
      }
    }

    // Extract minor issues
    const minorSection = content.match(
      /🔵.*?Minor.*?Issues.*?\n(.*?)(?=🔴|🟡|##|$)/s
    );
    if (minorSection) {
      const issueText = minorSection[1];
      if (
        issueText &&
        !issueText.match(/^\s*(None|No minor issues)\s*\.?\s*$/i)
      ) {
        const issueBlocks = issueText.split(/\n(?=\w)/);
        issueBlocks.forEach((block) => {
          const firstLine = block.split("\n")[0].trim();
          if (
            firstLine &&
            !firstLine.match(/^(Location:|Details:|Actionable Solution:)/i) &&
            !firstLine.includes("fix after merge") &&
            firstLine.length > 10
          ) {
            minorIssues.push(firstLine);
          }
        });
      }
    }

    // If we have critical issues, it should be FAIL
    if (criticalIssues.length > 0) {
      decision = "FAIL";
    }

    // Generate summary
    summary = `${decision}: ${criticalIssues.length} critical, ${majorIssues.length} major, ${minorIssues.length} minor issues found`;

    return {
      decision,
      criticalIssues: [...new Set(criticalIssues)], // Remove duplicates
      majorIssues: [...new Set(majorIssues)],
      minorIssues: [...new Set(minorIssues)],
      summary,
      rawContent: content,
    };
  }
}
