import { CodeReviewService } from "./services/code-review";
import { DocumentationService } from "./services/documentation";
import { TestingService } from "./services/testing";
import { OpenAIClient } from "./services/openai-client";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

export {
  CodeReviewService,
  DocumentationService,
  TestingService,
  OpenAIClient,
};

export * from "./types";

// Main execution function for when used as a module
export async function analyzeRepository(
  repoPath: string,
  options: {
    outputPath?: string;
    configPath?: string;
    includeReview?: boolean;
    includeDocs?: boolean;
    includeTests?: boolean;
  } = {}
) {
  const {
    outputPath = "./output",
    configPath,
    includeReview = true,
    includeDocs = true,
    includeTests = true,
  } = options;

  console.log(`Starting comprehensive analysis for: ${repoPath}`);

  const results: any = {};

  try {
    if (includeReview) {
      console.log("Running code review...");
      const reviewService = new CodeReviewService(configPath);
      results.review = await reviewService.performCodeReview(
        repoPath,
        outputPath
      );
    }

    if (includeDocs) {
      console.log("Generating documentation...");
      const docService = new DocumentationService(configPath);
      results.documentation = await docService.generateDocumentation(
        repoPath,
        outputPath
      );
    }

    if (includeTests) {
      console.log("Generating tests...");
      const testService = new TestingService(configPath);
      results.tests = await testService.generateTests(repoPath, outputPath);
    }

    console.log("Analysis completed successfully!");
    return results;
  } catch (error) {
    console.error("Error during repository analysis:", error);
    throw error;
  }
}

// Legacy main function for backward compatibility
async function main() {
  const repositoryPath = process.argv[2] || process.cwd();

  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY environment variable is required");
    console.log("Get your API key from: https://platform.openai.com/api-keys");
    process.exit(1);
  }

  try {
    await analyzeRepository(repositoryPath);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

// Run main function if this file is executed directly
if (require.main === module) {
  main();
}
