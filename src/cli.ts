#!/usr/bin/env node

import { Command } from "commander";
import { CodeReviewService } from "./services/code-review";
import { DocumentationService } from "./services/documentation";
import { TestingService } from "./services/testing";
import { analyzeRepository } from "./utils/repository-analyzer";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import { join, resolve } from "path";
import { existsSync, writeFileSync, readFileSync } from "fs";
import { ensureDirSync } from "fs-extra";
import * as dotenv from "dotenv";
import simpleGit from "simple-git";

// Types for auto-commenting results
interface CommentResult {
  file: string;
  commentsAdded?: number;
  success: boolean;
  error?: any;
}

// Load environment variables
dotenv.config();

const program = new Command();

// Configuration management
const getConfig = () => {
  const configPath = join(process.cwd(), ".steelheart.json");
  if (existsSync(configPath)) {
    try {
      return JSON.parse(readFileSync(configPath, "utf8"));
    } catch {
      return {};
    }
  }
  return {};
};

const saveConfig = (config: any) => {
  const configPath = join(process.cwd(), ".steelheart.json");
  writeFileSync(configPath, JSON.stringify(config, null, 2));
};

// Utility functions
const validateApiKey = (): boolean => {
  const apiKey = process.env.GEMINI_API_KEY || getConfig().apiKey;
  if (!apiKey) {
    console.log(chalk.red("❌ Gemini API key not found!"));
    console.log(chalk.yellow("💡 Please run: st setup"));
    return false;
  }
  return true;
};

const getOutputDir = (specified?: string): string => {
  return (
    specified ||
    getConfig().outputDir ||
    join(process.cwd(), "steelheart-output")
  );
};

const showBanner = () => {
  console.log(
    chalk.cyan("🚀 ") +
      chalk.bold("Steelheart AI") +
      chalk.gray(" - AI-powered development toolkit")
  );
  console.log();
};

// Git utility functions
const getGitInfo = async (repoPath: string) => {
  try {
    const git = simpleGit(repoPath);
    const branch = await git.revparse(["--abbrev-ref", "HEAD"]);
    const status = await git.status();
    const isGitRepo = await git.checkIsRepo();

    return {
      currentBranch: branch.trim(),
      hasChanges: !status.isClean(),
      modifiedFiles: status.modified,
      isGitRepo,
    };
  } catch (error) {
    return {
      currentBranch: "unknown",
      hasChanges: false,
      modifiedFiles: [],
      isGitRepo: false,
    };
  }
};

const detectProjectType = (repoPath: string) => {
  const packageJsonPath = join(repoPath, "package.json");
  const requirementsPath = join(repoPath, "requirements.txt");
  const cargoPath = join(repoPath, "Cargo.toml");
  const goModPath = join(repoPath, "go.mod");

  if (existsSync(packageJsonPath)) {
    return "Node.js/JavaScript";
  } else if (existsSync(requirementsPath)) {
    return "Python";
  } else if (existsSync(cargoPath)) {
    return "Rust";
  } else if (existsSync(goModPath)) {
    return "Go";
  }
  return "Unknown";
};

// Enhanced Git utilities for branch changes and documentation
const getBranchChanges = async (
  repoPath: string,
  baseBranch: string = "main",
  includeUncommitted: boolean = false
) => {
  try {
    const git = simpleGit(repoPath);
    const currentBranch = await git.revparse(["--abbrev-ref", "HEAD"]);

    // Check if base branch exists, fallback to origin/main, origin/master, or HEAD~1
    let actualBaseBranch = baseBranch;
    try {
      await git.revparse([`--verify`, `${baseBranch}`]);
    } catch {
      // Try remote branches
      try {
        await git.revparse([`--verify`, `origin/${baseBranch}`]);
        actualBaseBranch = `origin/${baseBranch}`;
      } catch {
        try {
          await git.revparse([`--verify`, `origin/master`]);
          actualBaseBranch = `origin/master`;
        } catch {
          try {
            await git.revparse([`--verify`, `master`]);
            actualBaseBranch = `master`;
          } catch {
            // Fallback to comparing with HEAD~1 (previous commit)
            actualBaseBranch = `HEAD~1`;
          }
        }
      }
    }

    // If we're on the base branch, compare with HEAD~1
    if (
      currentBranch.trim() === baseBranch ||
      currentBranch.trim() === actualBaseBranch.replace("origin/", "")
    ) {
      actualBaseBranch = `HEAD~1`;
    }

    // Get commits between base branch and current branch
    const commits = await git.log([
      `${actualBaseBranch}..${currentBranch.trim()}`,
    ]);

    // Get file changes (diff)
    let diffSummary, diffContent;

    if (includeUncommitted) {
      // Include working directory changes
      const status = await git.status();
      const committedDiff = await git.diffSummary([
        `${actualBaseBranch}...${currentBranch.trim()}`,
      ]);
      const workingDiff = await git.diffSummary();

      // Combine committed and working directory changes
      const allFiles = new Map();

      // Add committed changes
      committedDiff.files.forEach((file) => {
        allFiles.set(file.file, {
          file: file.file,
          insertions: (file as any).insertions || 0,
          deletions: (file as any).deletions || 0,
          binary: (file as any).binary || false,
        });
      });

      // Add/update with working directory changes
      workingDiff.files.forEach((file) => {
        const existing = allFiles.get(file.file) || {
          file: file.file,
          insertions: 0,
          deletions: 0,
          binary: false,
        };
        allFiles.set(file.file, {
          file: file.file,
          insertions: existing.insertions + ((file as any).insertions || 0),
          deletions: existing.deletions + ((file as any).deletions || 0),
          binary: existing.binary || (file as any).binary || false,
        });
      });

      diffSummary = {
        files: Array.from(allFiles.values()),
        insertions: committedDiff.insertions + workingDiff.insertions,
        deletions: committedDiff.deletions + workingDiff.deletions,
        changed: allFiles.size,
      };

      // Get diff content including working directory
      const committedDiffContent = await git.diff([
        `${actualBaseBranch}...${currentBranch.trim()}`,
      ]);
      const workingDiffContent = await git.diff();
      diffContent =
        committedDiffContent +
        "\n\n--- Working Directory Changes ---\n" +
        workingDiffContent;
    } else {
      // Only committed changes
      diffSummary = await git.diffSummary([
        `${actualBaseBranch}...${currentBranch.trim()}`,
      ]);
      diffContent = await git.diff([
        `${actualBaseBranch}...${currentBranch.trim()}`,
      ]);
    }

    return {
      currentBranch: currentBranch.trim(),
      baseBranch: actualBaseBranch,
      commits: commits.all,
      changedFiles: diffSummary.files,
      diffContent,
      totalInsertions: diffSummary.insertions,
      totalDeletions: diffSummary.deletions,
      totalChanges: diffSummary.changed,
      includeUncommitted,
    };
  } catch (error) {
    console.warn("Could not get branch changes:", error);
    return null;
  }
};

const getFileChanges = async (
  repoPath: string,
  filePath: string,
  baseBranch: string = "main"
) => {
  try {
    const git = simpleGit(repoPath);
    const currentBranch = await git.revparse(["--abbrev-ref", "HEAD"]);

    // Check if base branch exists, fallback to origin/main, origin/master, or HEAD~1
    let actualBaseBranch = baseBranch;
    try {
      await git.revparse([`--verify`, `${baseBranch}`]);
    } catch {
      // Try remote branches
      try {
        await git.revparse([`--verify`, `origin/${baseBranch}`]);
        actualBaseBranch = `origin/${baseBranch}`;
      } catch {
        try {
          await git.revparse([`--verify`, `origin/master`]);
          actualBaseBranch = `origin/master`;
        } catch {
          try {
            await git.revparse([`--verify`, `master`]);
            actualBaseBranch = `master`;
          } catch {
            // Fallback to comparing with HEAD~1 (previous commit)
            actualBaseBranch = `HEAD~1`;
          }
        }
      }
    }

    // If we're on the base branch, compare with HEAD~1
    if (
      currentBranch.trim() === baseBranch ||
      currentBranch.trim() === actualBaseBranch.replace("origin/", "")
    ) {
      actualBaseBranch = `HEAD~1`;
    }

    // Get diff for specific file
    const diff = await git.diff([
      `${actualBaseBranch}...${currentBranch.trim()}`,
      "--",
      filePath,
    ]);

    return {
      filePath,
      diff,
      hasChanges: diff.length > 0,
    };
  } catch (error) {
    return {
      filePath,
      diff: "",
      hasChanges: false,
    };
  }
};

// Helper functions for branch documentation and auto-commenting
const generateBranchDocumentation = async (
  service: DocumentationService,
  branchChanges: any,
  repoPath: string
): Promise<string> => {
  // Enhanced prompt with more context and detailed analysis request
  const prompt = `You are a senior technical documentation expert. Analyze the following Git branch changes and create comprehensive documentation that explains not just WHAT changed, but WHY and HOW it impacts the project.

## Branch Information
- **Current Branch**: ${branchChanges.currentBranch}
- **Base Branch**: ${branchChanges.baseBranch}
- **Total Files Modified**: ${branchChanges.totalChanges}
- **Lines Added**: ${branchChanges.totalInsertions}
- **Lines Removed**: ${branchChanges.totalDeletions}
- **Include Uncommitted**: ${branchChanges.includeUncommitted ? "Yes" : "No"}

## Commit History
${branchChanges.commits
  .map(
    (commit: any) =>
      `- **${commit.hash.substring(0, 8)}**: ${commit.message}${
        commit.author_name ? ` (${commit.author_name})` : ""
      }`
  )
  .join("\n")}

## Files Modified
${branchChanges.changedFiles
  .map(
    (file: any) =>
      `- **${file.file}** (+${file.insertions || 0} -${file.deletions || 0})${
        file.binary ? " [BINARY]" : ""
      }`
  )
  .join("\n")}

## Code Changes (Diff Analysis)
\`\`\`diff
${branchChanges.diffContent.substring(0, 4000)}
${
  branchChanges.diffContent.length > 4000 ? "\n... (truncated for brevity)" : ""
}
\`\`\`

## Analysis Requirements
Please provide a detailed analysis that includes:

### 1. **Executive Summary**
- High-level overview of what this branch accomplishes
- Business value or technical improvement achieved

### 2. **Technical Analysis**
- Detailed breakdown of changes in each file
- Architecture or design patterns introduced/modified
- Code quality improvements or refactoring done

### 3. **Impact Assessment**
- How these changes affect the overall system
- Potential breaking changes or compatibility issues
- Performance implications (if any)

### 4. **Code Quality & Best Practices**
- Adherence to coding standards
- Security considerations
- Error handling improvements

### 5. **Testing & Validation**
- Recommended testing strategies
- Edge cases to consider
- Integration testing requirements

### 6. **Deployment Considerations**
- Migration steps (if any)
- Configuration changes needed
- Rollback procedures

### 7. **Developer Notes**
- Key implementation details
- Design decisions made
- Future considerations or TODOs

Please format as comprehensive markdown documentation with clear sections and actionable insights.`;

  const systemInstruction = `You are a senior technical documentation expert and code reviewer with deep expertise in software architecture, best practices, and team collaboration. Your role is to create documentation that not only describes changes but provides meaningful insights that help team members understand the technical decisions, implications, and next steps. Focus on clarity, completeness, and actionable information.`;

  try {
    const content = await service["geminiClient"].generateContent(
      prompt,
      systemInstruction
    );
    return content;
  } catch (error) {
    console.warn(
      "Failed to generate AI documentation, creating detailed manual analysis"
    );

    // Enhanced fallback with much more detailed analysis
    const analysisDate = new Date().toISOString().split("T")[0];
    const fileTypes = branchChanges.changedFiles.reduce(
      (acc: any, file: any) => {
        const ext = file.file.split(".").pop()?.toLowerCase() || "unknown";
        acc[ext] = (acc[ext] || 0) + 1;
        return acc;
      },
      {}
    );

    const majorFiles = branchChanges.changedFiles.filter(
      (file: any) => (file.insertions || 0) + (file.deletions || 0) > 10
    );

    const minorFiles = branchChanges.changedFiles.filter(
      (file: any) => (file.insertions || 0) + (file.deletions || 0) <= 10
    );

    // Analyze diff content for insights
    const { insights, fileTypeAnalysis } = analyzeDiffContent(
      branchChanges.diffContent,
      branchChanges.changedFiles
    );

    return `# Branch Documentation: ${branchChanges.currentBranch}

> **Generated on**: ${analysisDate}  
> **Base Branch**: ${branchChanges.baseBranch}  
> **Analysis Type**: ${
      branchChanges.includeUncommitted
        ? "Including uncommitted changes"
        : "Committed changes only"
    }

## 📋 Executive Summary

This branch contains **${branchChanges.totalChanges} file(s)** with **${
      branchChanges.totalInsertions
    } additions** and **${
      branchChanges.totalDeletions
    } deletions**, representing ${
      branchChanges.commits.length > 0
        ? `${branchChanges.commits.length} commit(s)`
        : "uncommitted changes"
    }.

${
  insights.newFeatures.length > 0
    ? `### 🆕 New Features Detected\n${insights.newFeatures
        .slice(0, 3)
        .map((f) => `- ${f}`)
        .join("\n")}\n`
    : ""
}
${
  insights.bugFixes.length > 0
    ? `### 🐛 Bug Fixes Detected\n${insights.bugFixes
        .slice(0, 3)
        .map((f) => `- ${f}`)
        .join("\n")}\n`
    : ""
}
${
  insights.functionsModified.length > 0
    ? `### ⚙️ Functions/Classes Modified\n${insights.functionsModified
        .slice(0, 5)
        .map((f) => `- ${f}`)
        .join("\n")}\n`
    : ""
}

## 🔄 Change Overview

### File Type Distribution
${Object.entries(fileTypes)
  .map(([ext, count]) => `- **${ext.toUpperCase()}**: ${count} file(s)`)
  .join("\n")}

### Project Structure Analysis
- **Code Files**: ${fileTypeAnalysis.codeFiles} (TypeScript/JavaScript)
- **Configuration Files**: ${fileTypeAnalysis.configFiles} (JSON/Config)
- **Documentation**: ${fileTypeAnalysis.docFiles} (Markdown)
- **Test Files**: ${fileTypeAnalysis.testFiles} (Test/Spec)

### Commit History
${
  branchChanges.commits.length > 0
    ? branchChanges.commits
        .map(
          (commit: any) =>
            `- **${commit.hash.substring(0, 8)}**: ${commit.message}`
        )
        .join("\n")
    : "_No commits found (working directory changes)_"
}

## 📁 Files Modified

### Major Changes (>10 lines)
${
  majorFiles.length > 0
    ? majorFiles
        .map(
          (file: any) =>
            `- **${file.file}** (+${file.insertions || 0} -${
              file.deletions || 0
            })`
        )
        .join("\n")
    : "_No major changes detected_"
}

### Minor Changes (≤10 lines)
${
  minorFiles.length > 0
    ? minorFiles
        .map(
          (file: any) =>
            `- **${file.file}** (+${file.insertions || 0} -${
              file.deletions || 0
            })`
        )
        .join("\n")
    : "_No minor changes detected_"
}

## 🔍 Technical Analysis

### Code Changes Summary
- **Total Lines Changed**: ${
      branchChanges.totalInsertions + branchChanges.totalDeletions
    }
- **Net Change**: ${
      branchChanges.totalInsertions - branchChanges.totalDeletions > 0
        ? "+"
        : ""
    }${branchChanges.totalInsertions - branchChanges.totalDeletions} lines
- **Change Ratio**: ${
      branchChanges.totalDeletions > 0
        ? Math.round(
            (branchChanges.totalInsertions / branchChanges.totalDeletions) * 100
          ) / 100
        : "N/A"
    } (additions/deletions)

### Change Pattern Analysis
${
  insights.dependencies.length > 0
    ? `- **Dependencies**: ${insights.dependencies.length} dependency-related changes detected\n`
    : ""
}
${
  insights.configChanges.length > 0
    ? `- **Configuration**: ${insights.configChanges.length} configuration changes detected\n`
    : ""
}
${
  fileTypeAnalysis.codeFiles > 0
    ? `- **Code Logic**: ${fileTypeAnalysis.codeFiles} code files modified\n`
    : ""
}
${
  fileTypeAnalysis.testFiles > 0
    ? `- **Testing**: ${fileTypeAnalysis.testFiles} test files modified\n`
    : ""
}

### File Impact Analysis
${branchChanges.changedFiles
  .map((file: any) => {
    const totalChanges = (file.insertions || 0) + (file.deletions || 0);
    const impact =
      totalChanges > 50 ? "HIGH" : totalChanges > 10 ? "MEDIUM" : "LOW";
    return `- **${file.file}**: ${impact} impact (${totalChanges} lines changed)`;
  })
  .join("\n")}

## 📊 Change Statistics

| Metric | Value |
|--------|-------|
| Files Modified | ${branchChanges.totalChanges} |
| Lines Added | ${branchChanges.totalInsertions} |
| Lines Removed | ${branchChanges.totalDeletions} |
| Net Lines | ${branchChanges.totalInsertions - branchChanges.totalDeletions} |
| Commits | ${branchChanges.commits.length} |

## 🔧 Recommended Actions

### For Code Review
- [ ] Review changes in high-impact files: ${
      majorFiles.map((f: any) => f.file).join(", ") || "None"
    }
- [ ] Verify backward compatibility
- [ ] Check for potential security issues
- [ ] Validate error handling in modified code
${
  insights.functionsModified.length > 0
    ? `- [ ] Review modified functions: ${insights.functionsModified
        .slice(0, 3)
        .join(", ")}\n`
    : ""
}

### For Testing
- [ ] Unit tests for modified functions
- [ ] Integration tests for affected modules
- [ ] Regression testing for ${
      fileTypes.js || fileTypes.ts || fileTypes.py
        ? "core functionality"
        : "affected components"
    }
- [ ] Performance testing if applicable
${
  fileTypeAnalysis.testFiles > 0
    ? `- [ ] Run existing test suite (${fileTypeAnalysis.testFiles} test files modified)\n`
    : ""
}

### For Deployment
- [ ] Review configuration changes
- [ ] Check for database migrations (if any)
- [ ] Validate environment variables
- [ ] Plan rollback strategy
${
  insights.dependencies.length > 0
    ? `- [ ] Update dependencies (${insights.dependencies.length} dependency changes detected)\n`
    : ""
}

## 📝 Additional Notes

**Branch Type**: ${
      branchChanges.includeUncommitted
        ? "Working branch with uncommitted changes"
        : "Committed changes ready for review"
    }

**Complexity Assessment**: ${
      branchChanges.totalChanges > 10
        ? "HIGH"
        : branchChanges.totalChanges > 3
        ? "MEDIUM"
        : "LOW"
    } - Based on number of files modified

**Review Priority**: ${majorFiles.length > 0 ? "HIGH" : "MEDIUM"} - ${
      majorFiles.length > 0
        ? "Contains significant changes requiring careful review"
        : "Standard changes requiring normal review process"
    }

${
  insights.newFeatures.length > 0
    ? `**Feature Development**: This appears to be feature development work with ${insights.newFeatures.length} new feature(s) detected.\n`
    : ""
}
${
  insights.bugFixes.length > 0
    ? `**Bug Fixes**: This branch contains ${insights.bugFixes.length} bug fix(es).\n`
    : ""
}

## 🔍 Detailed Diff Analysis

### Key Changes Detected:
${branchChanges.diffContent
  .split("\n")
  .filter((line: string) => line.startsWith("+"))
  .slice(0, 10)
  .map((line: string) => `- ${line.substring(1).trim()}`)
  .join("\n")}

${
  branchChanges.diffContent.length > 1000
    ? "\n### Code Diff Preview:\n```diff\n" +
      branchChanges.diffContent.substring(0, 1000) +
      "\n... (truncated)\n```"
    : ""
}

---
*This documentation was generated automatically. For AI-powered detailed analysis, ensure a valid Gemini API key is configured.*`;
  }
};

const generateCodeComments = async (
  filePath: string,
  diffContent: string
): Promise<{ content: string; commentsAdded: number; preview: string }> => {
  try {
    const originalContent = readFileSync(filePath, "utf8");
    const fileExtension = filePath.split(".").pop()?.toLowerCase();

    const prompt = `Please analyze this code file and its changes, then add helpful comments to explain the logic, especially for the changed parts:

File: ${filePath}
Language: ${fileExtension}

Changes (diff):
${diffContent}

Original Code:
${originalContent}

Please add comments that:
1. Explain complex logic or algorithms
2. Clarify the purpose of functions and classes
3. Document parameters and return values
4. Explain business logic or domain-specific concepts
5. Add TODO or NOTE comments where appropriate

Return the complete file with added comments. Use appropriate comment syntax for ${fileExtension} files.
Only add comments where they would be genuinely helpful - don't over-comment obvious code.

Format your response as JSON:
{
  "commentedCode": "the complete file with added comments",
  "commentsAdded": 5,
  "summary": "brief summary of what comments were added"
}`;

    const systemInstruction = `You are a senior developer adding helpful comments to code. Add clear, concise comments that improve code readability and maintainability. Use the appropriate comment syntax for the programming language.`;

    try {
      // Use Gemini client to generate comments
      const geminiClient = new (
        await import("./services/gemini-client")
      ).GeminiClient();
      const response = await geminiClient.generateContent(
        prompt,
        systemInstruction
      );

      // Try to parse JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          content: parsed.commentedCode || originalContent,
          commentsAdded: parsed.commentsAdded || 0,
          preview: parsed.summary || `Added comments to ${filePath}`,
        };
      }
    } catch (error) {
      console.warn("Failed to generate AI comments, using preview mode");
    }

    // Fallback: return preview without actual changes
    return {
      content: originalContent,
      commentsAdded: 0,
      preview: `Would add intelligent comments to ${filePath} explaining the logic in the diff changes`,
    };
  } catch (error) {
    throw new Error(`Failed to generate comments for ${filePath}: ${error}`);
  }
};

// Function to analyze diff content for meaningful insights
const analyzeDiffContent = (diffContent: string, changedFiles: any[]) => {
  const insights = {
    codePatterns: [] as string[],
    functionsModified: [] as string[],
    newFeatures: [] as string[],
    bugFixes: [] as string[],
    refactoring: [] as string[],
    configChanges: [] as string[],
    dependencies: [] as string[],
  };

  const lines = diffContent.split("\n");

  for (const line of lines) {
    // Detect function additions/modifications
    if (
      line.startsWith("+") &&
      (line.includes("function ") ||
        line.includes("const ") ||
        line.includes("class ") ||
        line.includes("interface "))
    ) {
      const match = line.match(/(?:function|const|class|interface)\s+(\w+)/);
      if (match) {
        insights.functionsModified.push(match[1]);
      }
    }

    // Detect new features
    if (
      line.startsWith("+") &&
      (line.toLowerCase().includes("feature") ||
        line.toLowerCase().includes("add") ||
        line.toLowerCase().includes("new"))
    ) {
      insights.newFeatures.push(
        line.replace(/^\+\s*/, "").substring(0, 50) + "..."
      );
    }

    // Detect bug fixes
    if (
      line.startsWith("+") &&
      (line.toLowerCase().includes("fix") ||
        line.toLowerCase().includes("bug") ||
        line.toLowerCase().includes("error"))
    ) {
      insights.bugFixes.push(
        line.replace(/^\+\s*/, "").substring(0, 50) + "..."
      );
    }

    // Detect dependency changes
    if (line.includes("package.json") || line.includes("dependencies")) {
      insights.dependencies.push(
        line.replace(/^[+-]\s*/, "").substring(0, 50) + "..."
      );
    }

    // Detect configuration changes
    if (
      line.includes(".json") ||
      line.includes(".config") ||
      line.includes(".env")
    ) {
      insights.configChanges.push(
        line.replace(/^[+-]\s*/, "").substring(0, 50) + "..."
      );
    }
  }

  // Analyze file types for patterns
  const fileTypeAnalysis = changedFiles.reduce(
    (acc: any, file: any) => {
      const ext = file.file.split(".").pop()?.toLowerCase();
      if (ext === "ts" || ext === "js") {
        acc.codeFiles += 1;
      } else if (ext === "json") {
        acc.configFiles += 1;
      } else if (ext === "md") {
        acc.docFiles += 1;
      } else if (ext === "test.ts" || ext === "spec.ts") {
        acc.testFiles += 1;
      }
      return acc;
    },
    { codeFiles: 0, configFiles: 0, docFiles: 0, testFiles: 0 }
  );

  return { insights, fileTypeAnalysis };
};

program
  .name("st")
  .description("🚀 Steelheart AI - AI-powered development toolkit")
  .version("1.3.2");

// Setup command
program
  .command("setup")
  .description("🔧 Setup Steelheart AI configuration")
  .option("-i, --interactive", "Interactive setup")
  .action(async (options) => {
    showBanner();
    console.log(chalk.yellow("⚙️  Setting up Steelheart AI..."));

    const config = getConfig();

    if (options.interactive || !config.apiKey) {
      const answers = await inquirer.prompt([
        {
          type: "input",
          name: "apiKey",
          message: "Enter your Gemini API key:",
          default: config.apiKey || process.env.GEMINI_API_KEY,
          validate: (input) => (input.trim() ? true : "API key is required"),
        },
        {
          type: "input",
          name: "outputDir",
          message: "Default output directory:",
          default: config.outputDir || "./steelheart-output",
        },
        {
          type: "list",
          name: "defaultModel",
          message: "Default Gemini model:",
          choices: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"],
          default: config.defaultModel || "gemini-1.5-pro",
        },
      ]);

      saveConfig({ ...config, ...answers });
      console.log(chalk.green("✅ Configuration saved successfully!"));
    } else {
      console.log(
        chalk.green(
          "✅ Configuration already exists. Use --interactive to reconfigure."
        )
      );
    }
  });

// Code review command
program
  .command("review-code")
  .alias("review")
  .description("📝 AI-powered code review")
  .argument("[path]", "Repository path to review", ".")
  .option("-o, --output <dir>", "Output directory")
  .option("-b, --branch <name>", "Specific branch to review")
  .option(
    "-f, --format <type>",
    "Output format (json|markdown|html)",
    "markdown"
  )
  .option("--pr <number>", "Review specific pull request")
  .option("--auto", "Auto-detect current branch and review changes")
  .action(async (repoPath: string, options) => {
    showBanner();
    if (!validateApiKey()) return;

    const spinner = ora("Analyzing repository...").start();

    try {
      const outputDir = getOutputDir(options.output);
      ensureDirSync(outputDir);

      // Get Git information
      const gitInfo = await getGitInfo(repoPath);
      const projectType = detectProjectType(repoPath);

      if (gitInfo.isGitRepo) {
        spinner.text = `Analyzing ${projectType} project on branch: ${gitInfo.currentBranch}`;
        console.log(chalk.blue(`\n📂 Project Type: ${projectType}`));
        console.log(chalk.blue(`🌿 Current Branch: ${gitInfo.currentBranch}`));
        if (gitInfo.hasChanges) {
          console.log(
            chalk.yellow(
              `⚠️  Uncommitted changes detected (${gitInfo.modifiedFiles.length} files)`
            )
          );
        }
      } else {
        spinner.text = `Analyzing ${projectType} project (not a Git repository)`;
      }

      spinner.text = "Performing AI code review...";
      const service = new CodeReviewService();
      const report = await service.performCodeReview(repoPath, outputDir);

      spinner.succeed("Code review completed!");

      console.log(chalk.blue("\n📊 Code Review Summary:"));
      console.log(`${chalk.gray("Repository:")} ${report.repositoryUrl}`);
      console.log(`${chalk.gray("Total Issues:")} ${report.issues.length}`);
      console.log(`${chalk.red("Critical:")} ${report.criticalIssues}`);
      console.log(`${chalk.yellow("Warnings:")} ${report.warningIssues}`);
      console.log(`${chalk.blue("Suggestions:")} ${report.suggestions.length}`);
      console.log(`${chalk.gray("Report saved to:")} ${outputDir}`);

      if (gitInfo.isGitRepo) {
        console.log(
          `${chalk.gray("Branch reviewed:")} ${gitInfo.currentBranch}`
        );
      }
    } catch (error) {
      spinner.fail("Code review failed");
      console.error(chalk.red("Error:"), error);
      process.exit(1);
    }
  });

// Smart auto review command (new feature for library usage)
program
  .command("auto-review")
  .alias("ar")
  .description("🤖 Smart auto-review current branch changes")
  .option("-o, --output <dir>", "Output directory")
  .option("--staged", "Review only staged changes")
  .option("--commits <number>", "Number of recent commits to review", "1")
  .action(async (options) => {
    showBanner();
    if (!validateApiKey()) return;

    const repoPath = process.cwd();
    const spinner = ora("Auto-detecting repository changes...").start();

    try {
      const outputDir = getOutputDir(options.output);
      ensureDirSync(outputDir);

      // Get Git information
      const gitInfo = await getGitInfo(repoPath);

      if (!gitInfo.isGitRepo) {
        spinner.fail("Not a Git repository!");
        console.log(chalk.red("❌ This command requires a Git repository"));
        return;
      }

      const projectType = detectProjectType(repoPath);

      spinner.text = `Smart review on ${gitInfo.currentBranch} branch...`;
      console.log(chalk.blue(`\n🤖 Auto-Review Mode`));
      console.log(chalk.blue(`📂 Project Type: ${projectType}`));
      console.log(chalk.blue(`🌿 Current Branch: ${gitInfo.currentBranch}`));

      if (gitInfo.hasChanges) {
        console.log(
          chalk.yellow(`📝 Modified Files (${gitInfo.modifiedFiles.length}):`)
        );
        gitInfo.modifiedFiles.slice(0, 5).forEach((file) => {
          console.log(chalk.gray(`   • ${file}`));
        });
        if (gitInfo.modifiedFiles.length > 5) {
          console.log(
            chalk.gray(`   ... and ${gitInfo.modifiedFiles.length - 5} more`)
          );
        }
      } else {
        console.log(chalk.green(`✅ No uncommitted changes`));
      }

      spinner.text = "Performing smart AI code review...";
      const service = new CodeReviewService();
      const report = await service.performCodeReview(repoPath, outputDir);

      spinner.succeed("Smart review completed!");

      console.log(chalk.blue("\n🤖 Smart Review Results:"));
      console.log(`${chalk.gray("Branch:")} ${gitInfo.currentBranch}`);
      console.log(`${chalk.gray("Project Type:")} ${projectType}`);
      console.log(`${chalk.gray("Total Issues:")} ${report.issues.length}`);
      console.log(`${chalk.red("Critical:")} ${report.criticalIssues}`);
      console.log(`${chalk.yellow("Warnings:")} ${report.warningIssues}`);
      console.log(`${chalk.blue("Suggestions:")} ${report.suggestions.length}`);
      console.log(`${chalk.gray("Report saved to:")} ${outputDir}`);

      // Show quick tips
      if (report.criticalIssues > 0) {
        console.log(
          chalk.red(
            "\n⚠️  Critical issues found! Please review before pushing."
          )
        );
      } else if (report.warningIssues > 0) {
        console.log(
          chalk.yellow("\n💡 Some improvements suggested. Consider reviewing.")
        );
      } else {
        console.log(chalk.green("\n✨ Great job! No critical issues found."));
      }
    } catch (error) {
      spinner.fail("Smart review failed");
      console.error(chalk.red("Error:"), error);
      process.exit(1);
    }
  });

// Branch documentation command
program
  .command("branch-docs")
  .alias("bd")
  .description("📋 Generate documentation for branch changes")
  .option("-o, --output <dir>", "Output directory")
  .option("-b, --base <branch>", "Base branch to compare against", "main")
  .option(
    "-f, --format <format>",
    "Output format (markdown|html|json)",
    "markdown"
  )
  .option("--commit-messages", "Include commit messages in documentation")
  .option("--include-local", "Include uncommitted local changes")
  .action(async (options) => {
    showBanner();
    if (!validateApiKey()) return;

    const repoPath = process.cwd();
    const spinner = ora("Analyzing branch changes...").start();

    try {
      const outputDir = getOutputDir(options.output);
      ensureDirSync(outputDir);

      // Get Git information
      const gitInfo = await getGitInfo(repoPath);

      if (!gitInfo.isGitRepo) {
        spinner.fail("Not a Git repository!");
        console.log(chalk.red("❌ This command requires a Git repository"));
        return;
      }

      // Get branch changes with optional local changes
      const branchChanges = await getBranchChanges(
        repoPath,
        options.base,
        options.includeLocal
      );

      if (!branchChanges) {
        spinner.warn("Could not analyze branch changes");
        console.log(
          chalk.yellow(
            `❌ Could not analyze Git changes. This might happen if:`
          )
        );
        console.log(
          chalk.yellow(`   • Base branch '${options.base}' doesn't exist`)
        );
        console.log(chalk.yellow(`   • No commits found to compare`));
        console.log(chalk.yellow(`   • Repository has no commit history`));
        console.log(chalk.yellow(`\n💡 Try:`));
        console.log(
          chalk.yellow(`   • steelheart-ai branch-docs --base master`)
        );
        console.log(
          chalk.yellow(`   • steelheart-ai branch-docs --base origin/main`)
        );
        console.log(
          chalk.yellow(
            `   • steelheart-ai branch-docs --include-local (for uncommitted changes)`
          )
        );
        console.log(
          chalk.yellow(`   • git log --oneline (to check commit history)`)
        );
        return;
      }

      if (branchChanges.changedFiles.length === 0 && !options.includeLocal) {
        // Check for working directory changes if no committed changes
        const gitStatus = await simpleGit(repoPath).status();
        if (gitStatus.modified.length > 0 || gitStatus.created.length > 0) {
          spinner.info(
            "No committed changes found, but working directory has modifications"
          );
          console.log(
            chalk.blue(
              `ℹ️  No committed changes between ${options.base} and ${gitInfo.currentBranch}`
            )
          );
          console.log(
            chalk.blue(
              `💡 You have ${
                gitStatus.modified.length + gitStatus.created.length
              } uncommitted changes.`
            )
          );
          console.log(
            chalk.blue(
              `   Use --include-local to include these changes in documentation.`
            )
          );
          console.log(
            chalk.blue(
              `   Or commit your changes first, then run this command again.`
            )
          );
          return;
        } else {
          spinner.warn("No changes found between branches");
          console.log(
            chalk.yellow(
              `No changes found between ${options.base} and ${gitInfo.currentBranch}`
            )
          );
          return;
        }
      }

      spinner.text = "Generating documentation for changes...";

      console.log(chalk.blue(`\n📋 Branch Documentation Generator`));
      console.log(
        chalk.blue(`🌿 Current Branch: ${branchChanges.currentBranch}`)
      );
      console.log(chalk.blue(`🔗 Base Branch: ${branchChanges.baseBranch}`));
      console.log(
        chalk.blue(`📝 Changed Files: ${branchChanges.changedFiles.length}`)
      );
      console.log(
        chalk.blue(`➕ Insertions: ${branchChanges.totalInsertions}`)
      );
      console.log(chalk.blue(`➖ Deletions: ${branchChanges.totalDeletions}`));

      if (options.includeLocal && branchChanges.includeUncommitted) {
        console.log(chalk.yellow("📋 Including uncommitted local changes"));
      }

      // Generate documentation using AI
      const service = new DocumentationService();
      const branchDocs = await generateBranchDocumentation(
        service,
        branchChanges,
        repoPath
      );

      // Save documentation
      const docSuffix = options.includeLocal ? "with-local" : "committed";
      const docPath = join(
        outputDir,
        `branch-${branchChanges.currentBranch}-docs-${docSuffix}.md`
      );
      writeFileSync(docPath, branchDocs);

      spinner.succeed("Branch documentation generated!");

      console.log(chalk.blue("\n📋 Branch Documentation Summary:"));
      console.log(`${chalk.gray("Branch:")} ${branchChanges.currentBranch}`);
      console.log(`${chalk.gray("Commits:")} ${branchChanges.commits.length}`);
      console.log(
        `${chalk.gray("Files changed:")} ${branchChanges.changedFiles.length}`
      );
      if (options.includeLocal && branchChanges.includeUncommitted) {
        console.log(`${chalk.gray("Includes:")} Uncommitted local changes`);
      }
      console.log(`${chalk.gray("Documentation saved to:")} ${docPath}`);
    } catch (error) {
      spinner.fail("Branch documentation generation failed");
      console.error(chalk.red("Error:"), error);
      process.exit(1);
    }
  });

// Auto-comment code command
program
  .command("auto-comment")
  .alias("ac")
  .description("💬 Automatically add AI-generated comments to code")
  .argument(
    "[files...]",
    "Specific files to comment (default: all changed files)"
  )
  .option("-b, --base <branch>", "Base branch to compare against", "main")
  .option("--backup", "Create backup files before commenting")
  .option(
    "--dry-run",
    "Show what comments would be added without modifying files"
  )
  .action(async (files: string[], options) => {
    showBanner();
    if (!validateApiKey()) return;

    const repoPath = process.cwd();
    const spinner = ora("Analyzing code for auto-commenting...").start();

    try {
      // Get Git information
      const gitInfo = await getGitInfo(repoPath);

      if (!gitInfo.isGitRepo) {
        spinner.fail("Not a Git repository!");
        console.log(chalk.red("❌ This command requires a Git repository"));
        return;
      }

      // Get files to process
      let filesToProcess = files;
      if (filesToProcess.length === 0) {
        // First priority: Check working directory changes (uncommitted files)
        const gitStatus = await simpleGit(repoPath).status();
        const workingDirFiles = [
          ...gitStatus.modified,
          ...gitStatus.created,
          ...gitStatus.staged,
        ].filter((file) =>
          file.match(/\.(js|ts|jsx|tsx|py|java|go|rs|php|rb|cpp|c|h)$/)
        );

        if (workingDirFiles.length > 0) {
          filesToProcess = workingDirFiles;
          console.log(
            chalk.blue(
              `\n📝 Found ${workingDirFiles.length} uncommitted code files`
            )
          );
          console.log(
            chalk.gray(
              "   Files: " +
                workingDirFiles.slice(0, 3).join(", ") +
                (workingDirFiles.length > 3 ? "..." : "")
            )
          );
        } else {
          // Second priority: Use committed changes from git
          const branchChanges = await getBranchChanges(
            repoPath,
            options.base,
            false
          );
          if (branchChanges && branchChanges.changedFiles.length > 0) {
            filesToProcess = branchChanges.changedFiles
              .filter((file) =>
                file.file.match(
                  /\.(js|ts|jsx|tsx|py|java|go|rs|php|rb|cpp|c|h)$/
                )
              )
              .map((file) => file.file);
            console.log(
              chalk.blue(
                `\n📝 Found ${filesToProcess.length} committed code files`
              )
            );
          }
        }
      }

      if (filesToProcess.length === 0) {
        spinner.warn("No files to comment");
        console.log(chalk.yellow("❌ No code files found to comment"));
        console.log(chalk.yellow("💡 This command looks for:"));
        console.log(
          chalk.yellow("   • Uncommitted changes (modified/staged files)")
        );
        console.log(
          chalk.yellow("   • Committed changes compared to base branch")
        );
        console.log(
          chalk.yellow(
            "   • Or specify files manually: steelheart auto-comment file1.js file2.ts"
          )
        );
        return;
      }

      spinner.text = `Generating AI comments for ${filesToProcess.length} files...`;

      console.log(chalk.blue(`\n💬 Auto-Comment Generator`));
      console.log(chalk.blue(`🌿 Current Branch: ${gitInfo.currentBranch}`));
      console.log(chalk.blue(`📝 Files to process: ${filesToProcess.length}`));

      // Process each file
      const results: CommentResult[] = [];
      for (const filePath of filesToProcess) {
        spinner.text = `Processing ${filePath}...`;

        try {
          const fullPath = join(repoPath, filePath);
          if (!existsSync(fullPath)) {
            console.log(chalk.yellow(`⚠️  File not found: ${filePath}`));
            results.push({
              file: filePath,
              error: "File not found",
              success: false,
            });
            continue;
          }

          // For uncommitted files, get working directory diff
          let diffContent = "";
          try {
            // Try to get diff from working directory (for uncommitted changes)
            const git = simpleGit(repoPath);
            const workingDiff = await git.diff([filePath]);
            if (workingDiff) {
              diffContent = workingDiff;
              console.log(
                chalk.gray(`📋 Found working directory changes in: ${filePath}`)
              );
            } else {
              // Try staged changes
              const stagedDiff = await git.diff(["--staged", filePath]);
              if (stagedDiff) {
                diffContent = stagedDiff;
                console.log(
                  chalk.gray(`📋 Found staged changes in: ${filePath}`)
                );
              } else {
                // Try committed changes against base branch
                const fileChanges = await getFileChanges(
                  repoPath,
                  filePath,
                  options.base
                );
                if (fileChanges.hasChanges) {
                  diffContent = fileChanges.diff;
                  console.log(
                    chalk.gray(`📋 Found committed changes in: ${filePath}`)
                  );
                } else {
                  console.log(
                    chalk.yellow(`⚠️  No changes detected in: ${filePath}`)
                  );
                  // Still process the file but with empty diff
                  diffContent = `File: ${filePath}\nNo changes detected - adding general code comments`;
                }
              }
            }
          } catch (diffError) {
            console.log(
              chalk.yellow(
                `⚠️  Could not get diff for ${filePath}, processing entire file`
              )
            );
            diffContent = `File: ${filePath}\nProcessing entire file for code comments`;
          }

          const commentedCode = await generateCodeComments(
            fullPath,
            diffContent
          );

          if (options.dryRun) {
            console.log(chalk.blue(`\n📝 Comments for ${filePath}:`));
            console.log(commentedCode.preview);
          } else {
            // Create backup if requested
            if (options.backup) {
              const backupPath = `${fullPath}.backup`;
              const originalContent = readFileSync(fullPath, "utf8");
              writeFileSync(backupPath, originalContent);
              console.log(chalk.gray(`💾 Backup saved: ${backupPath}`));
            }

            // Write commented code only if there are actual changes
            if (commentedCode.content !== readFileSync(fullPath, "utf8")) {
              writeFileSync(fullPath, commentedCode.content);
              console.log(
                chalk.green(
                  `✅ Comments added to: ${filePath} (${commentedCode.commentsAdded} comments)`
                )
              );
            } else {
              console.log(
                chalk.gray(`ℹ️  No new comments added to: ${filePath}`)
              );
            }
          }

          results.push({
            file: filePath,
            commentsAdded: commentedCode.commentsAdded,
            success: true,
          });
        } catch (error) {
          console.log(chalk.red(`❌ Error processing ${filePath}: ${error}`));
          results.push({
            file: filePath,
            error: error,
            success: false,
          });
        }
      }

      spinner.succeed("Auto-commenting completed!");

      // Summary
      const successful = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);
      const totalComments = successful.reduce(
        (sum, r) => sum + (r.commentsAdded || 0),
        0
      );

      console.log(chalk.blue("\n💬 Auto-Comment Summary:"));
      console.log(
        `${chalk.gray("Files processed:")} ${successful.length}/${
          results.length
        }`
      );
      console.log(`${chalk.gray("Comments added:")} ${totalComments}`);
      if (failed.length > 0) {
        console.log(`${chalk.red("Failed:")} ${failed.length}`);
        failed.forEach((f) =>
          console.log(chalk.red(`   • ${f.file}: ${f.error}`))
        );
      }
      if (options.dryRun) {
        console.log(
          chalk.yellow(
            "\n🔍 This was a dry run. Use without --dry-run to apply changes."
          )
        );
      }

      // Show helpful tips
      if (successful.length === 0) {
        console.log(chalk.yellow("\n💡 Tips:"));
        console.log(
          chalk.yellow(
            "   • Make sure files have actual changes or code to comment"
          )
        );
        console.log(
          chalk.yellow(
            "   • Try: steelheart auto-comment --dry-run to see what would happen"
          )
        );
        console.log(
          chalk.yellow(
            "   • Or specify files: steelheart auto-comment src/file.js"
          )
        );
      }
    } catch (error) {
      spinner.fail("Auto-commenting failed");
      console.error(chalk.red("Error:"), error);
      process.exit(1);
    }
  });

// Documentation generation command
program
  .command("gen-document")
  .alias("docs")
  .description("📚 Generate AI documentation")
  .argument("[path]", "Project path to document", ".")
  .option("-o, --output <dir>", "Output directory")
  .option("-t, --type <type>", "Documentation type (api|user|developer)", "api")
  .option(
    "-f, --format <format>",
    "Output format (markdown|html|json)",
    "markdown"
  )
  .option("--pr", "Generate PR documentation")
  .action(async (projectPath: string, options) => {
    showBanner();
    if (!validateApiKey()) return;

    const spinner = ora("Analyzing project structure...").start();

    try {
      const outputDir = getOutputDir(options.output);
      ensureDirSync(outputDir);

      spinner.text = "Generating documentation...";
      const service = new DocumentationService();
      const docs = await service.generateDocumentation(projectPath, outputDir);

      spinner.succeed("Documentation generated!");

      console.log(chalk.blue("\n📚 Documentation Summary:"));
      console.log(`${chalk.gray("Project:")} ${projectPath}`);
      console.log(`${chalk.gray("Type:")} ${options.type}`);
      console.log(`${chalk.gray("Format:")} ${options.format}`);
      console.log(
        `${chalk.gray("Sections generated:")} ${docs.sections?.length || 1}`
      );
      console.log(`${chalk.gray("Output directory:")} ${outputDir}`);
    } catch (error) {
      spinner.fail("Documentation generation failed");
      console.error(chalk.red("Error:"), error);
      process.exit(1);
    }
  });

// Test generation command
program
  .command("gen-tests")
  .alias("test")
  .description("🧪 Generate AI unit/integration tests")
  .argument("[path]", "Project path to test", ".")
  .option("-o, --output <dir>", "Output directory")
  .option(
    "-f, --framework <name>",
    "Testing framework (jest|mocha|vitest)",
    "jest"
  )
  .option("-t, --type <type>", "Test type (unit|integration|e2e)", "unit")
  .option("--coverage", "Include coverage configuration")
  .action(async (projectPath: string, options) => {
    showBanner();
    if (!validateApiKey()) return;

    const spinner = ora("Analyzing project for test generation...").start();

    try {
      const outputDir = getOutputDir(options.output);
      ensureDirSync(outputDir);

      spinner.text = "Generating tests...";
      const service = new TestingService();
      const tests = await service.generateTests(projectPath, outputDir);

      spinner.succeed("Tests generated!");

      console.log(chalk.blue("\n🧪 Test Generation Summary:"));
      console.log(`${chalk.gray("Project:")} ${projectPath}`);
      console.log(`${chalk.gray("Framework:")} ${options.framework}`);
      console.log(`${chalk.gray("Test Type:")} ${options.type}`);
      console.log(
        `${chalk.gray("Unit tests:")} ${tests.unitTests?.length || 0}`
      );
      console.log(`${chalk.gray("Output directory:")} ${outputDir}`);
    } catch (error) {
      spinner.fail("Test generation failed");
      console.error(chalk.red("Error:"), error);
      process.exit(1);
    }
  });

// Full analysis command
program
  .command("analyze")
  .description("🔍 Complete project analysis (review + docs + tests)")
  .argument("[path]", "Project path to analyze", ".")
  .option("-o, --output <dir>", "Output directory")
  .option("--skip-review", "Skip code review")
  .option("--skip-docs", "Skip documentation")
  .option("--skip-tests", "Skip test generation")
  .action(async (projectPath: string, options) => {
    showBanner();
    if (!validateApiKey()) return;

    const spinner = ora("Starting complete project analysis...").start();

    try {
      const outputDir = getOutputDir(options.output);
      ensureDirSync(outputDir);

      const results: any = {};

      // Repository analysis
      spinner.text = "Analyzing repository structure...";
      const analysis = await analyzeRepository(projectPath);
      results.analysis = analysis;

      // Code review
      if (!options.skipReview) {
        spinner.text = "Performing code review...";
        const reviewService = new CodeReviewService();
        results.review = await reviewService.performCodeReview(
          projectPath,
          join(outputDir, "review")
        );
      }

      // Documentation
      if (!options.skipDocs) {
        spinner.text = "Generating documentation...";
        const docService = new DocumentationService();
        results.docs = await docService.generateDocumentation(
          projectPath,
          join(outputDir, "docs")
        );
      }

      // Tests
      if (!options.skipTests) {
        spinner.text = "Generating tests...";
        const testService = new TestingService();
        results.tests = await testService.generateTests(
          projectPath,
          join(outputDir, "tests")
        );
      }

      // Save complete analysis
      writeFileSync(
        join(outputDir, "analysis-summary.json"),
        JSON.stringify(results, null, 2)
      );

      spinner.succeed("Complete analysis finished!");

      console.log(chalk.blue("\n🔍 Analysis Summary:"));
      console.log(`${chalk.gray("Project:")} ${projectPath}`);
      console.log(
        `${chalk.gray("Technologies:")} ${analysis.technologies
          .map((t) => t.name)
          .join(", ")}`
      );
      console.log(
        `${chalk.gray("Files analyzed:")} ${analysis.structure.totalFiles}`
      );
      if (results.review)
        console.log(
          `${chalk.gray("Issues found:")} ${results.review.issues.length}`
        );
      console.log(`${chalk.gray("Complete report:")} ${outputDir}`);
    } catch (error) {
      spinner.fail("Analysis failed");
      console.error(chalk.red("Error:"), error);
      process.exit(1);
    }
  });

// Configuration commands
program
  .command("config")
  .description("⚙️ Manage configuration")
  .option("--show", "Show current configuration")
  .option("--reset", "Reset configuration")
  .action(async (options) => {
    showBanner();
    if (options.reset) {
      const configPath = join(process.cwd(), ".steelheart.json");
      if (existsSync(configPath)) {
        writeFileSync(configPath, "{}");
        console.log(chalk.green("✅ Configuration reset"));
      }
    } else if (options.show) {
      const config = getConfig();
      console.log(chalk.blue("Current configuration:"));
      console.log(JSON.stringify(config, null, 2));
    } else {
      console.log(chalk.yellow("Use --show or --reset flags"));
    }
  });

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
