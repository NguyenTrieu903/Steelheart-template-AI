import chalk from "chalk";

export const showBanner = (): void => {
  console.log(
    chalk.cyan("🚀 ") +
      chalk.bold("Steelheart AI") +
      chalk.gray(" - AI-powered development toolkit")
  );
  console.log();
};

export const logInfo = (message: string): void => {
  console.log(chalk.blue(message));
};

export const logSuccess = (message: string): void => {
  console.log(chalk.green(message));
};

export const logWarning = (message: string): void => {
  console.log(chalk.yellow(message));
};

export const logError = (message: string): void => {
  console.log(chalk.red(message));
};

export const logGray = (message: string): void => {
  console.log(chalk.gray(message));
};
