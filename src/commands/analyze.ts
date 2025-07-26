import { Command } from "commander";
import { ensureDirSync } from "fs-extra";
import ora from "ora";
import { showBanner, logInfo, logError, logGray } from "../utils/ui/console";
import { validateApiKey, getOutputDir } from "../utils/config/config-manager";
import { analyzeRepository } from "../utils/repository-analyzer";

export const analyzeCommand = new Command("analyze")
  .description("🔍 Analyze project structure and complexity")
  .argument("[path]", "Project path to analyze", ".")
  .option("-o, --output <dir>", "Output directory")
  .option(
    "-f, --format <type>",
    "Output format (json|markdown|html)",
    "markdown"
  )
  .option("--include-deps", "Include dependency analysis")
  .option("--security", "Include security analysis")
  .action(async (projectPath: string, options) => {
    showBanner();
    if (!validateApiKey()) return;

    const spinner = ora("Analyzing project...").start();

    try {
      const outputDir = getOutputDir(options.output);
      ensureDirSync(outputDir);

      spinner.text = "Performing deep analysis...";
      const analysis = await analyzeRepository(projectPath);

      spinner.succeed("Analysis completed!");

      logInfo("\n🔍 Project Analysis Summary:");
      logGray(`Project: ${projectPath}`);
      logGray(`Files analyzed: ${analysis.structure?.totalFiles || "N/A"}`);
      logGray(
        `Technologies: ${
          analysis.technologies?.map((t) => t.name).join(", ") || "N/A"
        }`
      );
      logGray(`Dependencies: ${analysis.dependencies?.length || 0}`);
      logGray(`Output directory: ${outputDir}`);

      // Display key metrics if available
      if (analysis.metrics) {
        logInfo("\n📊 Code Metrics:");
        logGray(`Lines of Code: ${analysis.metrics.linesOfCode || "N/A"}`);
        logGray(`Complexity Score: ${analysis.metrics.complexity || "N/A"}`);
        logGray(
          `Duplicate Code: ${
            analysis.metrics.duplicateCodePercentage || "N/A"
          }%`
        );
        logGray(
          `Technical Debt: ${
            analysis.metrics.technicalDebt?.hours || "N/A"
          } hours (${analysis.metrics.technicalDebt?.rating || "N/A"})`
        );
      }
    } catch (error) {
      spinner.fail("Analysis failed");
      logError(`Error: ${error}`);
      process.exit(1);
    }
  });
