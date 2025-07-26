import { Command } from "commander";
import { existsSync, writeFileSync } from "fs";
import { join } from "path";
import ora from "ora";
import {
  showBanner,
  logInfo,
  logSuccess,
  logWarning,
  logError,
  logGray,
} from "../utils/ui/console";
import { validateApiKey } from "../utils/config/config-manager";
import { getGitInfo } from "../utils/git/git-info";
import {
  getBranchChanges,
  getFileChanges,
} from "../utils/git/branch-operations";
import { generateCodeComments } from "../utils/comment-generator";
import { CommentResult } from "../types/cli";

export const autoCommentCommand = new Command("auto-comment")
  .alias("ac")
  .description("💬 Automatically add AI-generated comments to code")
  .argument(
    "[files...]",
    "Specific files to comment (default: all changed files)"
  )
  .option("-b, --base <branch>", "Base branch to compare against", "main")
  .option("--include-local", "Include uncommitted local changes", true)
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
        logError("❌ This command requires a Git repository");
        return;
      }

      // Get files to process
      let filesToProcess = files;
      let branchChanges: any = null; // Declare branchChanges in broader scope

      // Always get branch changes for context, even if files are specified manually
      branchChanges = await getBranchChanges(
        repoPath,
        options.base,
        options.includeLocal
      );

      if (filesToProcess.length === 0) {
        // Use enhanced branch analysis to detect changes (similar to branch-docs)
        if (!branchChanges) {
          spinner.warn("Could not analyze branch changes");
          logWarning(`❌ Could not analyze Git changes. This might happen if:`);
          logWarning(`   • Base branch '${options.base}' doesn't exist`);
          logWarning(`   • No commits found to compare`);
          logWarning(`   • Repository has no commit history`);
          logWarning(`\n💡 Try:`);
          logWarning(`   • steelheart auto-comment --base master`);
          logWarning(`   • steelheart auto-comment --base origin/main`);
          logWarning(
            `   • steelheart auto-comment file1.js file2.ts (specify files)`
          );
          return;
        }

        if (branchChanges.changedFiles.length === 0) {
          spinner.warn("No changes found to comment");
          logWarning(
            `No changes found between ${options.base} and ${gitInfo.currentBranch}`
          );
          logWarning(`💡 Try --include-local to include uncommitted changes`);
          return;
        }

        // Filter changed files to only include code files
        filesToProcess = branchChanges.changedFiles
          .filter((file: any) =>
            file.file.match(/\.(js|ts|jsx|tsx|py|java|go|rs|php|rb|cpp|c|h)$/)
          )
          .map((file: any) => file.file);

        if (filesToProcess.length === 0) {
          spinner.warn("No code files found to comment");
          return;
        }

        logInfo(`\n💬 Auto-Comment Analysis`);
        logInfo(`🌿 Current Branch: ${branchChanges.currentBranch}`);
        logInfo(`🔗 Base Branch: ${branchChanges.baseBranch}`);
        logInfo(`📝 Total Files Changed: ${branchChanges.changedFiles.length}`);
        logInfo(`📄 Code Files to Process: ${filesToProcess.length}`);
        logInfo(`📄 New Files: ${branchChanges.newFiles.length}`);
        logInfo(`✏️  Modified Files: ${branchChanges.modifiedFiles.length}`);

        if (options.includeLocal && branchChanges.includeUncommitted) {
          logWarning("📋 Including uncommitted local changes");
        }

        logGray("   Files to comment:");
        filesToProcess.slice(0, 5).forEach((file) => {
          logGray(`     • ${file}`);
        });
        if (filesToProcess.length > 5) {
          logGray(`     ... and ${filesToProcess.length - 5} more files`);
        }
      }

      if (filesToProcess.length === 0) {
        spinner.warn("No files to comment");
        logError("❌ No code files found to comment");
        logWarning("💡 This command looks for:");
        logWarning("   • Uncommitted changes (modified/staged files)");
        logWarning("   • Committed changes compared to base branch");
        logWarning(
          "   • Or specify files manually: steelheart auto-comment file1.js file2.ts"
        );
        return;
      }

      spinner.text = `Generating AI comments for ${filesToProcess.length} files...`;

      logInfo(`\n💬 Auto-Comment Generator`);
      logInfo(`🌿 Current Branch: ${gitInfo.currentBranch}`);
      logInfo(`📝 Files to process: ${filesToProcess.length}`);

      // Process each file
      const results: CommentResult[] = [];
      for (const filePath of filesToProcess) {
        const fileSpinner = ora(`Processing ${filePath}...`).start();

        try {
          const fullPath = join(repoPath, filePath);

          if (!existsSync(fullPath)) {
            fileSpinner.warn(`File not found: ${filePath}`);
            results.push({
              file: filePath,
              success: false,
              error: "File not found",
            });
            continue;
          }

          // Get changes for this specific file
          const fileChanges = await getFileChanges(
            repoPath,
            filePath,
            options.base
          );

          if (!fileChanges || !fileChanges.hasChanges) {
            fileSpinner.info(`No changes found in ${filePath}`);
            results.push({
              file: filePath,
              success: true,
              commentsAdded: 0,
            });
            continue;
          }

          if (options.dryRun) {
            fileSpinner.succeed(`[DRY RUN] Would process ${filePath}`);
            results.push({
              file: filePath,
              success: true,
              commentsAdded: 0,
            });
            continue;
          }

          // Generate comments using AI
          const commentResult = await generateCodeComments(
            fullPath,
            fileChanges.diff
          );

          if (options.backup && commentResult.commentsAdded > 0) {
            // Create backup
            const backupPath = `${fullPath}.backup`;
            const originalContent = require("fs").readFileSync(
              fullPath,
              "utf8"
            );
            writeFileSync(backupPath, originalContent);
            fileSpinner.info(`Backup created: ${backupPath}`);
          }

          if (commentResult.commentsAdded > 0) {
            // Write commented code back to file
            writeFileSync(fullPath, commentResult.content);
            fileSpinner.succeed(
              `${filePath}: Added ${commentResult.commentsAdded} comments`
            );
          } else {
            fileSpinner.info(`${filePath}: No comments added`);
          }

          results.push({
            file: filePath,
            success: true,
            commentsAdded: commentResult.commentsAdded,
          });
        } catch (error) {
          fileSpinner.fail(`Failed to process ${filePath}`);
          results.push({
            file: filePath,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      spinner.succeed("Auto-commenting completed!");

      // Show summary
      const successful = results.filter((r) => r.success);
      const totalComments = successful.reduce(
        (sum, r) => sum + (r.commentsAdded || 0),
        0
      );
      const failed = results.filter((r) => !r.success);

      logInfo("\n💬 Auto-Comment Summary:");
      logGray(`Files Processed: ${results.length}`);
      logGray(`Successful: ${successful.length}`);
      logGray(`Failed: ${failed.length}`);
      logGray(`Total Comments Added: ${totalComments}`);

      if (totalComments > 0) {
        logSuccess("✨ Strategic comments added to help code understanding");
        successful
          .filter((r) => (r.commentsAdded || 0) > 0)
          .forEach((result) => {
            logGray(`   • ${result.file}: ${result.commentsAdded} comments`);
          });
      }

      if (failed.length > 0) {
        logWarning(`\n❌ Failed Files:`);
        failed.forEach((f) => logWarning(`   • ${f.file}: ${f.error}`));
      }

      if (options.dryRun) {
        logInfo("\n🔍 This was a dry run - no files were modified");
        logInfo("💡 Remove --dry-run to actually add comments");
      }
    } catch (error) {
      spinner.fail("Auto-commenting failed");
      logError(`Error: ${error}`);
      process.exit(1);
    }
  });
