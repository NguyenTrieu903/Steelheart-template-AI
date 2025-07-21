#!/usr/bin/env node
"use strict";
const chalk = require("chalk");
const { existsSync, writeFileSync } = require("fs");
const { join } = require("path");
const os = require("os");
function showWelcome() {
    console.log(chalk.cyan("\n🚀 Welcome to Steelheart AI!"));
    console.log(chalk.gray("AI-powered development toolkit\n"));
    console.log(chalk.yellow("📋 Quick Setup:"));
    console.log("1. Get your Gemini API key from: https://aistudio.google.com/apikey");
    console.log("2. Run: " + chalk.cyan("st setup") + " to configure");
    console.log("3. Try: " + chalk.cyan("st --help") + " to see all commands\n");
    console.log(chalk.blue("🔧 Available Commands:"));
    console.log("• " + chalk.cyan("st review-code") + " - AI code review");
    console.log("• " + chalk.cyan("st gen-document") + " - Generate documentation");
    console.log("• " + chalk.cyan("st gen-tests") + " - Generate tests");
    console.log("• " + chalk.cyan("st analyze") + " - Complete analysis");
    console.log("• " + chalk.cyan("st setup") + " - Configure settings\n");
    console.log(chalk.green("✨ Happy coding!"));
}
// Create initial config directory if needed
const homeDir = os.homedir();
const configDir = join(homeDir, ".steelheart");
try {
    if (!existsSync(configDir)) {
        require("fs").mkdirSync(configDir, { recursive: true });
    }
    showWelcome();
}
catch (error) {
    // Silent fail - don't break installation
    console.log(chalk.yellow("⚠️  Post-install setup completed with warnings"));
}
//# sourceMappingURL=setup.js.map