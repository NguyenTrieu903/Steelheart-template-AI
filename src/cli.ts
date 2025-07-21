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

program
  .name("st")
  .description("🚀 Steelheart AI - AI-powered development toolkit")
  .version("1.0.0");

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
  .action(async (repoPath: string, options) => {
    showBanner();
    if (!validateApiKey()) return;

    const spinner = ora("Analyzing repository...").start();

    try {
      const outputDir = getOutputDir(options.output);
      ensureDirSync(outputDir);

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
    } catch (error) {
      spinner.fail("Code review failed");
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
