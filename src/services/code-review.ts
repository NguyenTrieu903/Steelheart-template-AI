import { OpenAIClient } from "./openai-client";
import { ReviewReport, Issue, Suggestion, RepositoryAnalysis } from "../types";
import { analyzeRepository } from "../utils/repository-analyzer";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join, dirname } from "path";

export class CodeReviewService {
  private openaiClient: OpenAIClient;

  constructor(configPath?: string) {
    this.openaiClient = new OpenAIClient(configPath);
  }

  async performCodeReview(
    repoPath: string,
    outputPath?: string
  ): Promise<ReviewReport> {
    try {
      console.log("Starting code review analysis...");

      // Analyze repository structure and get relevant files
      const repoAnalysis = await analyzeRepository(repoPath);

      // Generate review using OpenAI
      const reviewContent = await this.generateReviewContent(
        repoPath,
        repoAnalysis
      );

      // Parse and structure the review
      const reviewReport = this.parseReviewContent(reviewContent, repoPath);

      // Save report if output path is specified
      if (outputPath) {
        this.saveReviewReport(reviewReport, outputPath);
      }

      console.log("Code review completed successfully!");
      return reviewReport;
    } catch (error) {
      console.error("Error performing code review:", error);
      throw new Error(`Code review failed: ${error}`);
    }
  }

  async performBranchReview(
    repoPath: string,
    branchChanges: any,
    outputPath?: string,
    autoComment: boolean = false
  ): Promise<ReviewReport> {
    try {
      console.log("Starting enhanced branch review analysis...");

      // Analyze repository structure and get relevant files
      const repoAnalysis = await analyzeRepository(repoPath);

      // Generate enhanced review for branch changes including new files
      const reviewContent = await this.generateBranchReviewContent(
        repoPath,
        repoAnalysis,
        branchChanges
      );

      // Parse and structure the review
      const reviewReport = this.parseReviewContent(reviewContent, repoPath);

      // If auto-comment is enabled, also add comments to new/changed code
      if (autoComment) {
        console.log("Auto-commenting new and changed code...");
        const commentResults = await this.autoCommentChangedCode(
          repoPath,
          branchChanges
        );

        // Add comment results to the review report
        reviewReport.commentResults = commentResults;
      }

      // Save report if output path is specified
      if (outputPath) {
        this.saveReviewReport(reviewReport, outputPath);
      }

      console.log("Enhanced branch code review completed successfully!");
      return reviewReport;
    } catch (error) {
      console.error("Error performing branch review:", error);
      throw new Error(`Branch code review failed: ${error}`);
    }
  }

  private async generateReviewContent(
    repoPath: string,
    analysis: RepositoryAnalysis
  ): Promise<string> {
    const prompt = this.buildReviewPrompt(repoPath, analysis);
    const systemInstruction = `You are an expert code reviewer with years of experience in software development.
                                  Analyze the provided repository for:
                                  1. Bugs and potential issues
                                  2. Security vulnerabilities  
                                  3. Performance bottlenecks
                                  4. Code style and best practices
                                  5. Maintainability concerns
                                  6. Architecture improvements
                                  
                                  Provide your response in the following JSON format:
                                  {
                                    "issues": [
                                      {
                                        "file": "path/to/file.js",
                                        "line": 10,
                                        "column": 5,
                                        "severity": "critical|warning|info",
                                        "category": "bug|security|performance|style|maintainability", 
                                        "description": "Description of the issue",
                                        "suggestion": "How to fix it",
                                        "rule": "Rule name if applicable"
                                      }
                                    ],
                                    "suggestions": [
                                      {
                                        "type": "improvement|refactoring|optimization",
                                        "description": "Suggestion description",
                                        "file": "optional file path",
                                        "impact": "high|medium|low"
                                      }
                                    ],
                                    "overallAssessment": "Overall code quality assessment",
                                    "criticalIssues": 0,
                                    "warningIssues": 0,
                                    "infoIssues": 0
                                  }`;

    return await this.openaiClient.generateContent(prompt, systemInstruction);
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

    // Get full content of new files for comprehensive review
    const newFileContents: any = {};

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

    const prompt = this.buildBranchReviewPrompt(
      repoPath,
      analysis,
      branchChanges,
      newFileContents
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

                                  FOR MODIFIED FILES (focused review):
                                  1. Impact of changes on existing functionality
                                  2. Potential breaking changes
                                  3. Security implications of modifications
                                  4. Performance impact
                                  5. Code style consistency
                                  6. Regression risks

                                  Provide your response in the following JSON format:
                                  {
                                    "issues": [
                                      {
                                        "file": "path/to/file.js",
                                        "line": 10,
                                        "column": 5,
                                        "severity": "critical|warning|info",
                                        "category": "bug|security|performance|style|maintainability|architecture", 
                                        "description": "Description of the issue",
                                        "suggestion": "How to fix it",
                                        "rule": "Rule name if applicable",
                                        "isNewFile": true|false
                                      }
                                    ],
                                    "suggestions": [
                                      {
                                        "type": "improvement|refactoring|optimization|architecture",
                                        "description": "Suggestion description",
                                        "file": "optional file path",
                                        "impact": "high|medium|low",
                                        "isForNewFile": true|false
                                      }
                                    ],
                                    "overallAssessment": "Overall assessment including new file integration",
                                    "newFilesAnalyzed": ${newFiles.length},
                                    "modifiedFilesAnalyzed": ${modifiedFiles.length},
                                    "criticalIssues": 0,
                                    "warningIssues": 0,
                                    "infoIssues": 0
                                  }`;

    return await this.openaiClient.generateContent(prompt, systemInstruction);
  }

  private buildReviewPrompt(
    repoPath: string,
    analysis: RepositoryAnalysis
  ): string {
    return `Please perform a comprehensive code review of this repository:

                Repository Path: ${repoPath}

                Repository Analysis:
                - Total Files: ${analysis.structure.totalFiles}
                - Technologies: ${analysis.technologies
                  .map((t) => `${t.name} ${t.version || ""}`)
                  .join(", ")}
                - Main File Types: ${Object.entries(
                  analysis.structure.fileTypes
                )
                  .map(([ext, count]) => `${ext}: ${count}`)
                  .join(", ")}
                - Lines of Code: ${analysis.metrics.linesOfCode}
                - Complexity Score: ${analysis.metrics.complexity}

                Key Dependencies:
                ${analysis.dependencies
                  .map((dep) => `- ${dep.name}@${dep.version} (${dep.type})`)
                  .join("\n")}

                Main Files to Focus On:
                ${analysis.structure.mainFiles.join("\n")}

                Please provide a thorough code review focusing on code quality, security, performance, and maintainability. 
                Prioritize critical issues that could cause bugs or security vulnerabilities.`;
  }

  private buildBranchReviewPrompt(
    repoPath: string,
    analysis: RepositoryAnalysis,
    branchChanges: any,
    newFileContents: any
  ): string {
    const newFiles = branchChanges.changedFiles.filter(
      (file: any) => file.isNew
    );
    const modifiedFiles = branchChanges.changedFiles.filter(
      (file: any) => !file.isNew
    );

    return `Please perform a comprehensive code review of this branch with enhanced focus on new files:

Repository Path: ${repoPath}
Branch: ${branchChanges.currentBranch} (compared to ${branchChanges.baseBranch})

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
    ? `\`\`\`\n${newFileContents[file.file].substring(0, 2000)}\n${
        newFileContents[file.file].length > 2000 ? "... (truncated)\n" : ""
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
            `- ${file.file} (+${file.insertions || 0} -${file.deletions || 0})`
        )
        .join("\n")
    : "None"
}

## Diff Changes:
\`\`\`diff
${branchChanges.diffContent.substring(0, 3000)}
${
  branchChanges.diffContent.length > 3000 ? "\n... (truncated for brevity)" : ""
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

**For MODIFIED FILES - Focus on changes:**
1. Impact assessment on existing functionality
2. Breaking change identification
3. Security implications of modifications
4. Performance impact analysis
5. Regression risk evaluation
6. Code style consistency

Please provide detailed analysis with specific line numbers where applicable.`;
  }

  private parseReviewContent(content: string, repoUrl: string): ReviewReport {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        repositoryUrl: repoUrl,
        issues: parsed.issues || [],
        suggestions: parsed.suggestions || [],
        overallAssessment: parsed.overallAssessment || "No assessment provided",
        summary: this.generateSummary(parsed),
        filesAnalyzed: 0, // Will be populated by repository analyzer
        criticalIssues: parsed.criticalIssues || 0,
        warningIssues: parsed.warningIssues || 0,
        infoIssues: parsed.infoIssues || 0,
      };
    } catch (error) {
      console.warn(
        "Failed to parse structured response, creating basic report"
      );
      return {
        repositoryUrl: repoUrl,
        issues: [],
        suggestions: [],
        overallAssessment: content.substring(0, 500) + "...",
        summary: "Review completed but response format was not structured",
        filesAnalyzed: 0,
        criticalIssues: 0,
        warningIssues: 0,
        infoIssues: 0,
      };
    }
  }

  private generateSummary(parsed: any): string {
    const totalIssues =
      (parsed.criticalIssues || 0) +
      (parsed.warningIssues || 0) +
      (parsed.infoIssues || 0);
    return `Found ${totalIssues} total issues: ${
      parsed.criticalIssues || 0
    } critical, ${parsed.warningIssues || 0} warnings, ${
      parsed.infoIssues || 0
    } info. ${
      parsed.suggestions?.length || 0
    } improvement suggestions provided.`;
  }

  private saveReviewReport(report: ReviewReport, outputPath: string): void {
    try {
      const reportPath = join(outputPath, "code-review-report.json");
      const readablePath = join(outputPath, "code-review-report.md");

      // Ensure directory exists
      mkdirSync(dirname(reportPath), { recursive: true });

      // Save JSON report
      writeFileSync(reportPath, JSON.stringify(report, null, 2));

      // Save markdown report
      const markdownReport = this.generateMarkdownReport(report);
      writeFileSync(readablePath, markdownReport);

      console.log(`Review report saved to: ${reportPath}`);
      console.log(`Readable report saved to: ${readablePath}`);
    } catch (error) {
      console.error("Error saving review report:", error);
    }
  }

  private generateMarkdownReport(report: ReviewReport): string {
    return `# Code Review Report

**Repository:** ${report.repositoryUrl}  
**Generated:** ${new Date().toISOString()}

## Summary
${report.summary}

## Overall Assessment
${report.overallAssessment}

## Issues Found (${report.issues.length})

${report.issues
  .map(
    (issue) => `
### ${issue.severity.toUpperCase()}: ${issue.category} issue in ${issue.file}
**Line:** ${issue.line}${issue.column ? `, Column: ${issue.column}` : ""}
**Description:** ${issue.description}
${issue.suggestion ? `**Suggestion:** ${issue.suggestion}` : ""}
${issue.rule ? `**Rule:** ${issue.rule}` : ""}
`
  )
  .join("\n")}

## Improvement Suggestions (${report.suggestions.length})

${report.suggestions
  .map(
    (suggestion) => `
### ${suggestion.type.toUpperCase()} (${suggestion.impact} impact)
${suggestion.description}
${suggestion.file ? `**File:** ${suggestion.file}` : ""}
`
  )
  .join("\n")}
`;
  }

  // Auto-comment method for new and changed code
  public async autoCommentChangedCode(
    repoPath: string,
    branchChanges: any
  ): Promise<any[]> {
    const results: any[] = [];

    // Filter for code files that can be commented
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

        // Read the file content
        const fileContent = readFileSync(filePath, "utf8");

        // Get the diff for this specific file
        const fileDiff = fileInfo.diff || "";

        // Generate AI comments with the enhanced prompt
        const commentedCode = await this.generateSmartComments(
          fileInfo.file,
          fileContent,
          fileDiff,
          fileInfo.isNew
        );

        // Only write if there are actual changes
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

  // Enhanced comment generation with senior developer prompt
  private async generateSmartComments(
    fileName: string,
    fileContent: string,
    fileDiff: string,
    isNewFile: boolean
  ): Promise<{ content: string; commentsAdded: number; preview: string }> {
    const fileType =
      fileName.endsWith(".ts") || fileName.endsWith(".tsx")
        ? "TypeScript"
        : fileName.endsWith(".py")
        ? "Python"
        : fileName.endsWith(".java")
        ? "Java"
        : fileName.endsWith(".go")
        ? "Go"
        : "JavaScript";

    const prompt = `As a senior developer, auto-comment all newly added or changed ${fileType} functions and modules in this code. Include inline suggestions where test coverage or docstrings are missing.

FILE: ${fileName}
TYPE: ${isNewFile ? "NEW FILE" : "MODIFIED FILE"}

${isNewFile ? "FULL NEW FILE CONTENT:" : "CHANGES MADE (Git Diff):"}
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
   - Highlight potential issues or improvements

Return the complete file with strategic comments added ONLY to new/changed code.

Format as JSON:
{
  "commentedCode": "complete file with strategic comments",
  "commentsAdded": number_of_comments_added,
  "summary": "brief summary of commenting strategy used"
}`;

    const systemInstruction = `You are a senior software engineer with 15+ years of experience in code review, documentation, and mentoring. Your role is to add meaningful, strategic comments that help junior developers understand complex code, improve code quality, and identify areas needing testing or documentation. Focus on code clarity, maintainability, and best practices.`;

    try {
      const response = await this.openaiClient.generateContent(
        prompt,
        systemInstruction
      );

      // Try to parse JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          content: parsed.commentedCode || fileContent,
          commentsAdded: parsed.commentsAdded || 0,
          preview: parsed.summary || `Added strategic comments to ${fileName}`,
        };
      }
    } catch (error) {
      console.warn(`Failed to generate AI comments for ${fileName}:`, error);
    }

    // Fallback: return original content
    return {
      content: fileContent,
      commentsAdded: 0,
      preview: `Could not generate comments for ${fileName}`,
    };
  }
}

// Legacy function for backward compatibility
export async function performCodeReview(
  repoPath: string,
  outputPath?: string
): Promise<ReviewReport> {
  const service = new CodeReviewService();
  return await service.performCodeReview(repoPath, outputPath);
}
