import { CodeReviewService } from "./services/code-review";
import { DocumentationService } from "./services/documentation";
import { TestingService } from "./services/testing";
import { GeminiClient } from "./services/gemini-client";
export { CodeReviewService, DocumentationService, TestingService, GeminiClient, };
export * from "./types";
export declare function analyzeRepository(repoPath: string, options?: {
    outputPath?: string;
    configPath?: string;
    includeReview?: boolean;
    includeDocs?: boolean;
    includeTests?: boolean;
}): Promise<any>;
//# sourceMappingURL=index.d.ts.map