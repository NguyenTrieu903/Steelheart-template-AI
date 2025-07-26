import { Command } from "commander";
import inquirer from "inquirer";
import { showBanner, logInfo, logSuccess, logGray } from "../utils/ui/console";
import { getConfig, saveConfig } from "../utils/config/config-manager";

export const configCommand = new Command("config")
  .description("⚙️ Manage Steelheart AI configuration")
  .option("--show", "Show current configuration")
  .option("--reset", "Reset configuration to defaults")
  .action(async (options) => {
    showBanner();

    if (options.show) {
      const config = getConfig();
      logInfo("📋 Current Configuration:");
      logGray(`API Key: ${config.apiKey ? "***configured***" : "not set"}`);
      logGray(
        `Output Directory: ${
          config.outputDir || "default (./steelheart-output)"
        }`
      );
      logGray(
        `Default Model: ${config.defaultModel || "default (gpt-4o-mini)"}`
      );
      return;
    }

    if (options.reset) {
      const confirm = await inquirer.prompt([
        {
          type: "confirm",
          name: "reset",
          message: "Are you sure you want to reset all configuration?",
          default: false,
        },
      ]);

      if (confirm.reset) {
        saveConfig({});
        logSuccess("✅ Configuration reset successfully!");
      }
      return;
    }

    // Interactive configuration
    const currentConfig = getConfig();
    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "apiKey",
        message: "OpenAI API Key:",
        default: currentConfig.apiKey,
        validate: (input) => (input.trim() ? true : "API key is required"),
      },
      {
        type: "input",
        name: "outputDir",
        message: "Default output directory:",
        default: currentConfig.outputDir || "./steelheart-output",
      },
      {
        type: "list",
        name: "defaultModel",
        message: "Default OpenAI model:",
        choices: ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"],
        default: currentConfig.defaultModel || "gpt-4o-mini",
      },
    ]);

    saveConfig({ ...currentConfig, ...answers });
    logSuccess("✅ Configuration updated successfully!");
  });
