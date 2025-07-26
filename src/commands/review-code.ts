import { Command } from "commander";
import { ensureDirSync } from "fs-extra";
import ora from "ora";
import { showBanner, logInfo, logError, logGray } from "../utils/ui/console";
import { validateApiKey, getOutputDir } from "../utils/config/config-manager";
import { CodeReviewService } from "../services/code-review";
import { getGitInfo } from "../utils/git/git-info";
import { detectProjectType } from "../utils/project-analyzer";

export const reviewCodeCommand = new Command("review-code")
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
        logInfo(`\n📂 Project Type: ${projectType}`);
        logInfo(`🌿 Current Branch: ${gitInfo.currentBranch}`);
        if (gitInfo.hasChanges) {
          console.log(
            `⚠️  Uncommitted changes detected (${gitInfo.modifiedFiles.length} files)`
          );
        }
      } else {
        spinner.text = `Analyzing ${projectType} project (not a Git repository)`;
      }

      spinner.text = "Performing AI code review...";
      const service = new CodeReviewService();
      const report = await service.performCodeReview(repoPath, outputDir);

      spinner.succeed("Code review completed!");

      logInfo("\n📊 Code Review Summary:");
      logGray(`Repository: ${report.repositoryUrl}`);
      logGray(`Total Issues: ${report.issues.length}`);
      console.log(`Critical: ${report.criticalIssues}`);
      console.log(`Warnings: ${report.warningIssues}`);
      logInfo(`Suggestions: ${report.suggestions.length}`);
      logGray(`Report saved to: ${outputDir}`);

      if (gitInfo.isGitRepo) {
        logGray(`Branch reviewed: ${gitInfo.currentBranch}`);
      }
    } catch (error) {
      spinner.fail("Code review failed");
      logError(`Error: ${error}`);
      process.exit(1);
    }
  });
