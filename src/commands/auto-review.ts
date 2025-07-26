import { Command } from "commander";
import { ensureDirSync } from "fs-extra";
import ora from "ora";
import {
  showBanner,
  logInfo,
  logSuccess,
  logWarning,
  logError,
  logGray,
} from "../utils/ui/console";
import { validateApiKey, getOutputDir } from "../utils/config/config-manager";
import { getGitInfo } from "../utils/git/git-info";
import { getBranchChanges } from "../utils/git/branch-operations";
import { detectProjectType } from "../utils/project-analyzer";
import { CodeReviewService } from "../services/code-review";

export const autoReviewCommand = new Command("auto-review")
  .alias("ar")
  .description("🤖 Smart auto-review for code changes")
  .option("-o, --output <dir>", "Output directory")
  .option("-b, --base <branch>", "Base branch to compare against", "main")
  .option("--staged", "Review only staged changes")
  .option("--include-local", "Include uncommitted local changes")
  .option("--auto-comment", "Enable auto-commenting on reviewed code")
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
        logError("❌ This command requires a Git repository");
        return;
      }

      const projectType = detectProjectType(repoPath);

      spinner.text = `Smart review on ${gitInfo.currentBranch} branch...`;
      logInfo(`\n🤖 Auto-Review Mode`);
      logInfo(`📂 Project Type: ${projectType}`);
      logInfo(`🌿 Current Branch: ${gitInfo.currentBranch}`);

      // Use enhanced branch analysis to detect changes (including local files)
      const branchChanges = await getBranchChanges(
        repoPath,
        options.base,
        options.includeLocal || options.staged || true // Default to include local changes for auto-review
      );

      if (!branchChanges) {
        spinner.warn("Could not analyze branch changes");
        logWarning(`❌ Could not analyze Git changes. This might happen if:`);
        logWarning(`   • Base branch '${options.base}' doesn't exist`);
        logWarning(`   • No commits found to compare`);
        logWarning(`   • Repository has no commit history`);
        logWarning(`\n💡 Try:`);
        logWarning(`   • steelheart auto-review --base master`);
        logWarning(`   • steelheart auto-review --base origin/main`);
        logWarning(`   • steelheart auto-review --include-local`);
        return;
      }

      if (branchChanges.changedFiles.length === 0) {
        spinner.warn("No changes found to review");
        logWarning(
          `No changes found between ${options.base} and ${gitInfo.currentBranch}`
        );
        logWarning(`💡 Try --include-local to include uncommitted changes`);
        return;
      }

      logInfo(`📝 Files to review: ${branchChanges.changedFiles.length}`);
      logInfo(`📄 New files: ${branchChanges.newFiles.length}`);
      logInfo(`✏️  Modified files: ${branchChanges.modifiedFiles.length}`);
      logInfo(`➕ Insertions: ${branchChanges.totalInsertions}`);
      logInfo(`➖ Deletions: ${branchChanges.totalDeletions}`);

      if (options.includeLocal && branchChanges.includeUncommitted) {
        logWarning("📋 Including uncommitted local changes");
      }

      const enableAutoComment = !!options.autoComment; // Auto-comment disabled by default, enabled with --auto-comment flag
      if (enableAutoComment) {
        console.log(
          "💬 Auto-commenting enabled - will add strategic comments after review"
        );
      } else {
        console.log(
          "📝 Review-only mode (use --auto-comment to enable strategic commenting)"
        );
      }

      spinner.text = "Performing enhanced AI code review...";
      const service = new CodeReviewService();

      await service.performBranchReview(repoPath, branchChanges, outputDir);

      spinner.succeed("Code review completed!");

      logInfo("\n🤖 Enhanced Review Results:");
      logGray(`Branch: ${gitInfo.currentBranch}`);
      logGray(`Base: ${branchChanges.baseBranch}`);
      logGray(`Project Type: ${projectType}`);
      logGray(`Files Reviewed: ${branchChanges.changedFiles.length}`);
      logGray(`New Files: ${branchChanges.newFiles.length}`);
      logGray(`Modified Files: ${branchChanges.modifiedFiles.length}`);
      logGray(`Report saved to: ${outputDir}`);

      //Perform auto-commenting if enabled (after review is complete and saved)
      if (enableAutoComment) {
        spinner.start("Performing auto-commenting on reviewed code...");

        try {
          const commentResults = await service.autoCommentChangedCode(
            repoPath,
            branchChanges
          );

          spinner.succeed("Auto-commenting completed!");

          const successfulComments = commentResults.filter((r) => r.success);
          const totalCommentsAdded = successfulComments.reduce(
            (sum, r) => sum + (r.commentsAdded || 0),
            0
          );

          console.log(`\n💬 Auto-Comment Results:`);
          logGray(`Files Processed: ${commentResults.length}`);
          logGray(`Comments Added: ${totalCommentsAdded}`);

          if (totalCommentsAdded > 0) {
            logSuccess(
              "✨ Strategic comments added to help code understanding"
            );
            successfulComments.forEach((result) => {
              if (result.commentsAdded && result.commentsAdded > 0) {
                logGray(
                  `   • ${result.file}: ${result.commentsAdded} comments${
                    result.isNew ? " [NEW]" : ""
                  }`
                );
              }
            });
          } else {
            logInfo("ℹ️  No new comments were added to the code");
          }

          const failed = commentResults.filter((r) => !r.success);
          if (failed.length > 0) {
            logWarning(`Comment Failures: ${failed.length}`);
            failed.forEach((f) => logWarning(`   • ${f.file}: ${f.error}`));
          }
        } catch (commentError) {
          spinner.fail("Auto-commenting failed");
          logWarning(`Auto-commenting error: ${commentError}`);
          logInfo(
            "Review completed successfully, but auto-commenting encountered issues"
          );
        }
      }
    } catch (error) {
      spinner.fail("Smart review failed");
      logError(`Error: ${error}`);
      process.exit(1);
    }
  });
