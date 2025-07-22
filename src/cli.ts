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
  baseBranch: string = "main"
) => {
  try {
    const git = simpleGit(repoPath);
    const currentBranch = await git.revparse(["--abbrev-ref", "HEAD"]);

    // Get commits between base branch and current branch
    const commits = await git.log([`${baseBranch}..${currentBranch.trim()}`]);

    // Get file changes (diff)
    const diffSummary = await git.diffSummary([
      `${baseBranch}...${currentBranch.trim()}`,
    ]);

    // Get actual diff content
    const diffContent = await git.diff([
      `${baseBranch}...${currentBranch.trim()}`,
    ]);

    return {
      currentBranch: currentBranch.trim(),
      baseBranch,
      commits: commits.all,
      changedFiles: diffSummary.files,
      diffContent,
      totalInsertions: diffSummary.insertions,
      totalDeletions: diffSummary.deletions,
      totalChanges: diffSummary.changed,
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

    // Get diff for specific file
    const diff = await git.diff([
      `${baseBranch}...${currentBranch.trim()}`,
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
  const prompt = `Please generate comprehensive documentation for the following branch changes:

Branch: ${branchChanges.currentBranch}
Base Branch: ${branchChanges.baseBranch}
Total Changes: ${branchChanges.totalChanges} files
Insertions: ${branchChanges.totalInsertions}
Deletions: ${branchChanges.totalDeletions}

Commits:
${branchChanges.commits
  .map((commit: any) => `- ${commit.hash.substring(0, 8)}: ${commit.message}`)
  .join("\n")}

Changed Files:
${branchChanges.changedFiles
  .map((file: any) => `- ${file.file} (+${file.insertions} -${file.deletions})`)
  .join("\n")}

Diff Content (first 2000 chars):
${branchChanges.diffContent.substring(0, 2000)}

Please create documentation that includes:
1. Summary of changes
2. Purpose and impact of changes
3. Files modified and their significance
4. Any breaking changes or important notes
5. Testing recommendations

Format as markdown documentation.`;

  const systemInstruction = `You are a technical documentation expert. Generate clear, comprehensive documentation for Git branch changes that helps team members understand what was modified and why.`;

  try {
    const content = await service["geminiClient"].generateContent(
      prompt,
      systemInstruction
    );
    return content;
  } catch (error) {
    console.warn("Failed to generate AI documentation, creating basic summary");
    return `# Branch Documentation: ${branchChanges.currentBranch}

## Summary
Changes from ${branchChanges.baseBranch} to ${branchChanges.currentBranch}

## Files Changed
${branchChanges.changedFiles.map((file: any) => `- ${file.file}`).join("\n")}

## Commits
${branchChanges.commits.map((commit: any) => `- ${commit.message}`).join("\n")}
`;
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

program
  .name("st")
  .description("🚀 Steelheart AI - AI-powered development toolkit")
  .version("1.2.0");

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

      // Get branch changes
      const branchChanges = await getBranchChanges(repoPath, options.base);

      if (!branchChanges || branchChanges.changedFiles.length === 0) {
        spinner.warn("No changes found between branches");
        console.log(
          chalk.yellow(
            `No changes found between ${options.base} and ${gitInfo.currentBranch}`
          )
        );
        return;
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

      // Generate documentation using AI
      const service = new DocumentationService();
      const branchDocs = await generateBranchDocumentation(
        service,
        branchChanges,
        repoPath
      );

      // Save documentation
      const docPath = join(
        outputDir,
        `branch-${branchChanges.currentBranch}-docs.md`
      );
      writeFileSync(docPath, branchDocs);

      spinner.succeed("Branch documentation generated!");

      console.log(chalk.blue("\n📋 Branch Documentation Summary:"));
      console.log(`${chalk.gray("Branch:")} ${branchChanges.currentBranch}`);
      console.log(`${chalk.gray("Commits:")} ${branchChanges.commits.length}`);
      console.log(
        `${chalk.gray("Files changed:")} ${branchChanges.changedFiles.length}`
      );
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
        // Use changed files from git
        const branchChanges = await getBranchChanges(repoPath, options.base);
        if (branchChanges) {
          filesToProcess = branchChanges.changedFiles
            .filter((file) =>
              file.file.match(/\.(js|ts|jsx|tsx|py|java|go|rs|php|rb|cpp|c|h)$/)
            )
            .map((file) => file.file);
        }
      }

      if (filesToProcess.length === 0) {
        spinner.warn("No files to comment");
        console.log(chalk.yellow("No code files found to comment"));
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
            continue;
          }

          const fileChanges = await getFileChanges(
            repoPath,
            filePath,
            options.base
          );
          if (!fileChanges.hasChanges) {
            console.log(chalk.gray(`ℹ️  No changes in: ${filePath}`));
            continue;
          }

          const commentedCode = await generateCodeComments(
            fullPath,
            fileChanges.diff
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

            // Write commented code
            writeFileSync(fullPath, commentedCode.content);
            console.log(chalk.green(`✅ Comments added to: ${filePath}`));
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
      }
      if (options.dryRun) {
        console.log(
          chalk.yellow(
            "\n🔍 This was a dry run. Use without --dry-run to apply changes."
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
