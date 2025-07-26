import { Command } from "commander";
import inquirer from "inquirer";
import { showBanner, logSuccess } from "../utils/ui/console";
import { getConfig, saveConfig } from "../utils/config/config-manager";

export const setupCommand = new Command("setup")
  .description("🔧 Setup Steelheart AI configuration")
  .option("-i, --interactive", "Interactive setup")
  .action(async (options) => {
    showBanner();
    console.log("⚙️  Setting up Steelheart AI...");

    const config = getConfig();

    if (options.interactive || !config.apiKey) {
      const answers = await inquirer.prompt([
        {
          type: "input",
          name: "apiKey",
          message: "Enter your OpenAI API key:",
          default: config.apiKey || process.env.OPENAI_API_KEY,
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
          message: "Default OpenAI model:",
          choices: ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"],
          default: config.defaultModel || "gpt-4o-mini",
        },
      ]);

      saveConfig({ ...config, ...answers });
      logSuccess("✅ Configuration saved successfully!");
    } else {
      logSuccess(
        "✅ Configuration already exists. Use --interactive to reconfigure."
      );
    }
  });
