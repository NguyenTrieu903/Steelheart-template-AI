"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeReviewService = void 0;
exports.performCodeReview = performCodeReview;
const gemini_client_1 = require("./gemini-client");
const repository_analyzer_1 = require("../utils/repository-analyzer");
const fs_1 = require("fs");
const path_1 = require("path");
class CodeReviewService {
    constructor(configPath) {
        this.geminiClient = new gemini_client_1.GeminiClient(configPath);
    }
    async performCodeReview(repoPath, outputPath) {
        try {
            console.log("Starting code review analysis...");
            // Analyze repository structure and get relevant files
            const repoAnalysis = await (0, repository_analyzer_1.analyzeRepository)(repoPath);
            // Generate review using Gemini
            const reviewContent = await this.generateReviewContent(repoPath, repoAnalysis);
            // Parse and structure the review
            const reviewReport = this.parseReviewContent(reviewContent, repoPath);
            // Save report if output path is specified
            if (outputPath) {
                this.saveReviewReport(reviewReport, outputPath);
            }
            console.log("Code review completed successfully!");
            return reviewReport;
        }
        catch (error) {
            console.error("Error performing code review:", error);
            throw new Error(`Code review failed: ${error}`);
        }
    }
    async generateReviewContent(repoPath, analysis) {
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
        return await this.geminiClient.generateContent(prompt, systemInstruction);
    }
    buildReviewPrompt(repoPath, analysis) {
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
    parseReviewContent(content, repoUrl) {
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
        }
        catch (error) {
            console.warn("Failed to parse structured response, creating basic report");
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
    generateSummary(parsed) {
        const totalIssues = (parsed.criticalIssues || 0) +
            (parsed.warningIssues || 0) +
            (parsed.infoIssues || 0);
        return `Found ${totalIssues} total issues: ${parsed.criticalIssues || 0} critical, ${parsed.warningIssues || 0} warnings, ${parsed.infoIssues || 0} info. ${parsed.suggestions?.length || 0} improvement suggestions provided.`;
    }
    saveReviewReport(report, outputPath) {
        try {
            const reportPath = (0, path_1.join)(outputPath, "code-review-report.json");
            const readablePath = (0, path_1.join)(outputPath, "code-review-report.md");
            // Ensure directory exists
            (0, fs_1.mkdirSync)((0, path_1.dirname)(reportPath), { recursive: true });
            // Save JSON report
            (0, fs_1.writeFileSync)(reportPath, JSON.stringify(report, null, 2));
            // Save markdown report
            const markdownReport = this.generateMarkdownReport(report);
            (0, fs_1.writeFileSync)(readablePath, markdownReport);
            console.log(`Review report saved to: ${reportPath}`);
            console.log(`Readable report saved to: ${readablePath}`);
        }
        catch (error) {
            console.error("Error saving review report:", error);
        }
    }
    generateMarkdownReport(report) {
        return `# Code Review Report

**Repository:** ${report.repositoryUrl}  
**Generated:** ${new Date().toISOString()}

## Summary
${report.summary}

## Overall Assessment
${report.overallAssessment}

## Issues Found (${report.issues.length})

${report.issues
            .map((issue) => `
### ${issue.severity.toUpperCase()}: ${issue.category} issue in ${issue.file}
**Line:** ${issue.line}${issue.column ? `, Column: ${issue.column}` : ""}
**Description:** ${issue.description}
${issue.suggestion ? `**Suggestion:** ${issue.suggestion}` : ""}
${issue.rule ? `**Rule:** ${issue.rule}` : ""}
`)
            .join("\n")}

## Improvement Suggestions (${report.suggestions.length})

${report.suggestions
            .map((suggestion) => `
### ${suggestion.type.toUpperCase()} (${suggestion.impact} impact)
${suggestion.description}
${suggestion.file ? `**File:** ${suggestion.file}` : ""}
`)
            .join("\n")}
`;
    }
}
exports.CodeReviewService = CodeReviewService;
// Legacy function for backward compatibility
async function performCodeReview(repoPath, outputPath) {
    const service = new CodeReviewService();
    return await service.performCodeReview(repoPath, outputPath);
}
//# sourceMappingURL=code-review.js.map