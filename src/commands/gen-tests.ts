import { Command } from "commander";
import { ensureDirSync } from "fs-extra";
import ora from "ora";
import { TestingService } from "../services/testing";
import { getOutputDir, validateApiKey } from "../utils/config/config-manager";
import { logError, showBanner } from "../utils/ui/console";

export const genTestsCommand = new Command("gen-tests")
  .alias("test")
  .description("🧪 Generate AI-powered tests")
  .argument("[path]", "Project path to test", ".")
  .option("-o, --output <dir>", "Output directory")
  .option("-t, --type <type>", "Test type (unit|integration|e2e)", "unit")
  .option(
    "-f, --framework <name>",
    "Testing framework (jest|mocha|pytest|go-test)",
    "jest"
  )
  .option("--coverage", "Generate coverage reports")
  .action(async (projectPath: string, options) => {
    showBanner();
    if (!validateApiKey()) return;

    const spinner = ora("Analyzing code for test generation...").start();

    try {
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
