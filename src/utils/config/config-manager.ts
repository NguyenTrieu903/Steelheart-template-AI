import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import chalk from "chalk";

export interface SteelheartConfig {
  apiKey?: string;
  outputDir?: string;
  defaultModel?: string;
}

export const getConfig = (): SteelheartConfig => {
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

export const saveConfig = (config: SteelheartConfig): void => {
  const configPath = join(process.cwd(), ".steelheart.json");
  writeFileSync(configPath, JSON.stringify(config, null, 2));
};

export const validateApiKey = (): boolean => {
  const apiKey = process.env.OPENAI_API_KEY || getConfig().apiKey;
  if (!apiKey) {
    console.log(chalk.red("❌ OpenAI API key not found!"));
    console.log(chalk.yellow("💡 Please run: st setup"));
    return false;
  }
  return true;
};

export const getOutputDir = (specified?: string): string => {
  return (
    specified ||
    getConfig().outputDir ||
    join(process.cwd(), "steelheart-output")
  );
};
