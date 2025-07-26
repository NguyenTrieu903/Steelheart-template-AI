#!/usr/bin/env node

import { Command } from "commander";
import * as dotenv from "dotenv";
import {
  setupCommand,
  autoReviewCommand,
  branchDocsCommand,
  autoCommentCommand,
  genDocumentCommand,
  genTestsCommand,
  analyzeCommand,
  configCommand,
} from "./commands";

// Load environment variables
dotenv.config();

const program = new Command();

// Configure the main program
program
  .name("st")
  .description("🚀 Steelheart AI - AI-powered development toolkit")
  .version("2.1.3");

// Register all commands
program.addCommand(setupCommand);
program.addCommand(autoReviewCommand);
program.addCommand(branchDocsCommand);
program.addCommand(autoCommentCommand);
program.addCommand(genDocumentCommand);
program.addCommand(genTestsCommand);
program.addCommand(analyzeCommand);
program.addCommand(configCommand);

// Parse command line arguments
program.parse();
