import { Command } from "commander";
import { ensureDirSync } from "fs-extra";
import ora from "ora";
import { showBanner, logInfo, logError, logGray } from "../utils/ui/console";
import { validateApiKey, getOutputDir } from "../utils/config/config-manager";
import { DocumentationService } from "../services/documentation";

export const genDocumentCommand = new Command("gen-document")
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

      logInfo("\n📚 Documentation Summary:");
      logGray(`Project: ${projectPath}`);
      logGray(`Type: ${options.type}`);
      logGray(`Format: ${options.format}`);
      logGray(`Sections generated: ${docs.sections?.length || 1}`);
      logGray(`Output directory: ${outputDir}`);
    } catch (error) {
      spinner.fail("Documentation generation failed");
      logError(`Error: ${error}`);
      process.exit(1);
    }
  });
