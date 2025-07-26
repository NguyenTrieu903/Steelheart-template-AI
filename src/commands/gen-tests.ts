import { Command } from "commander";
import { ensureDirSync } from "fs-extra";
import ora from "ora";
import { TestingService } from "../services/testing";
import { getOutputDir, validateApiKey } from "../utils/config/config-manager";
import { logError, showBanner, logInfo } from "../utils/ui/console";
import { findGitRoot, getRelativePathFromGitRoot } from "../utils/git/git-root";

export const genTestsCommand = new Command("gen-tests")
  .alias("test")
  .description("🧪 Generate AI-powered tests")
  .argument("[path]", "Project path to test (auto-detected if not provided)")
  .option("-o, --output <dir>", "Output directory")
  .option("-t, --type <type>", "Test type (unit|integration|e2e)", "unit")
  .option(
    "-f, --framework <name>",
    "Testing framework (jest|mocha|pytest|go-test)",
    "jest"
  )
  .option("--coverage", "Generate coverage reports")
  .action(async (providedPath: string | undefined, options) => {
    showBanner();
    if (!validateApiKey()) return;

    const spinner = ora("Analyzing code for test generation...").start();

    try {
      // Smart repository path detection
      let projectPath: string;

      if (providedPath && providedPath !== ".") {
        // Use explicitly provided path
        projectPath = providedPath;
      } else {
        // Auto-detect Git repository root
        const detectedGitRoot = findGitRoot();
        if (!detectedGitRoot) {
          spinner.fail("Not in a Git repository!");
          logError("❌ Not in a Git repository!");
          logInfo(
            "💡 Run this command from within a Git repository or provide a path"
          );
          return;
        }
        projectPath = detectedGitRoot;

        // Show helpful info if running from subdirectory
        const currentDir = process.cwd();
        if (currentDir !== projectPath) {
          const relativePath = getRelativePathFromGitRoot(
            projectPath,
            currentDir
          );
          logInfo(`📂 Auto-detected Git root: ${projectPath}`);
          logInfo(`📍 Running from subdirectory: ${relativePath}`);
        }
      }

      const outputDir = getOutputDir(options.output);
      ensureDirSync(outputDir);

      spinner.text = "Generating tests...";
      const service = new TestingService();
      await service.generateTests(projectPath, outputDir);

      spinner.succeed("Tests generated!");
    } catch (error) {
      spinner.fail("Test generation failed");
      logError(`Error: ${error}`);
      process.exit(1);
    }
  });
