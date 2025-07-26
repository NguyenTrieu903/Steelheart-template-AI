import { Command } from "commander";
import { ensureDirSync } from "fs-extra";
import { writeFileSync } from "fs";
import { join } from "path";
import ora from "ora";
import simpleGit from "simple-git";
import {
  showBanner,
  logInfo,
  logWarning,
  logError,
  logGray,
} from "../utils/ui/console";
import { validateApiKey, getOutputDir } from "../utils/config/config-manager";
import { getGitInfo } from "../utils/git/git-info";
import { getBranchChanges } from "../utils/git/branch-operations";
import { DocumentationService } from "../services/documentation";
import { generateBranchDocumentation } from "../utils/documentation-generator";

export const branchDocsCommand = new Command("branch-docs")
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
        logError("❌ This command requires a Git repository");
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
        logWarning(`❌ Could not analyze Git changes. This might happen if:`);
        logWarning(`   • Base branch '${options.base}' doesn't exist`);
        logWarning(`   • No commits found to compare`);
        logWarning(`   • Repository has no commit history`);
        logWarning(`\n💡 Try:`);
        logWarning(`   • steelheart branch-docs --base master`);
        logWarning(`   • steelheart branch-docs --base origin/main`);
        logWarning(
          `   • steelheart branch-docs --include-local (for uncommitted changes)`
        );
        logWarning(`   • git log --oneline (to check commit history)`);
        return;
      }

      if (branchChanges.changedFiles.length === 0 && !options.includeLocal) {
        // Check for working directory changes if no committed changes
        const gitStatus = await simpleGit(repoPath).status();
        if (gitStatus.modified.length > 0 || gitStatus.created.length > 0) {
          spinner.info(
            "No committed changes found, but working directory has modifications"
          );
          logInfo(
            `ℹ️  No committed changes between ${options.base} and ${gitInfo.currentBranch}`
          );
          logInfo(
            `💡 You have ${
              gitStatus.modified.length + gitStatus.created.length
            } uncommitted changes.`
          );
          logInfo(
            `   Use --include-local to include these changes in documentation.`
          );
          logInfo(
            `   Or commit your changes first, then run this command again.`
          );
          return;
        } else {
          spinner.warn("No changes found between branches");
          logWarning(
            `No changes found between ${options.base} and ${gitInfo.currentBranch}`
          );
          return;
        }
      }

      spinner.text = "Generating documentation for changes...";

      logInfo(`\n📋 Branch Documentation Generator`);
      logInfo(`🌿 Current Branch: ${branchChanges.currentBranch}`);
      logInfo(`🔗 Base Branch: ${branchChanges.baseBranch}`);
      logInfo(`📝 Changed Files: ${branchChanges.changedFiles.length}`);
      logInfo(`➕ Insertions: ${branchChanges.totalInsertions}`);
      logInfo(`➖ Deletions: ${branchChanges.totalDeletions}`);

      if (options.includeLocal && branchChanges.includeUncommitted) {
        logWarning("📋 Including uncommitted local changes");
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

      logInfo("\n📋 Branch Documentation Summary:");
      logGray(`Branch: ${branchChanges.currentBranch}`);
      logGray(`Commits: ${branchChanges.commits.length}`);
      logGray(`Files changed: ${branchChanges.changedFiles.length}`);
      if (options.includeLocal && branchChanges.includeUncommitted) {
        logGray(`Includes: Uncommitted local changes`);
      }
      logGray(`Documentation saved to: ${docPath}`);
    } catch (error) {
      spinner.fail("Branch documentation generation failed");
      logError(`Error: ${error}`);
      process.exit(1);
    }
  });
