import { OpenAIClient } from "./openai-client";
import { ReviewReport, Issue, Suggestion, RepositoryAnalysis } from "../types";
import { analyzeRepository } from "../utils/repository-analyzer";
import { writeFileSync, mkdirSync } from "fs";
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

      // Generate review using Gemini
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
- Main File Types: ${Object.entries(analysis.structure.fileTypes)
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
}

// Legacy function for backward compatibility
export async function performCodeReview(
  repoPath: string,
  outputPath?: string
): Promise<ReviewReport> {
  const service = new CodeReviewService();
  return await service.performCodeReview(repoPath, outputPath);
}
