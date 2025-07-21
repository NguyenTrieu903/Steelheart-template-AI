"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiClient = exports.TestingService = exports.DocumentationService = exports.CodeReviewService = void 0;
exports.analyzeRepository = analyzeRepository;
const code_review_1 = require("./services/code-review");
Object.defineProperty(exports, "CodeReviewService", { enumerable: true, get: function () { return code_review_1.CodeReviewService; } });
const documentation_1 = require("./services/documentation");
Object.defineProperty(exports, "DocumentationService", { enumerable: true, get: function () { return documentation_1.DocumentationService; } });
const testing_1 = require("./services/testing");
Object.defineProperty(exports, "TestingService", { enumerable: true, get: function () { return testing_1.TestingService; } });
const gemini_client_1 = require("./services/gemini-client");
Object.defineProperty(exports, "GeminiClient", { enumerable: true, get: function () { return gemini_client_1.GeminiClient; } });
const dotenv = __importStar(require("dotenv"));
// Load environment variables
dotenv.config();
__exportStar(require("./types"), exports);
// Main execution function for when used as a module
async function analyzeRepository(repoPath, options = {}) {
    const { outputPath = "./output", configPath, includeReview = true, includeDocs = true, includeTests = true, } = options;
    console.log(`Starting comprehensive analysis for: ${repoPath}`);
    const results = {};
    try {
        if (includeReview) {
            console.log("Running code review...");
            const reviewService = new code_review_1.CodeReviewService(configPath);
            results.review = await reviewService.performCodeReview(repoPath, outputPath);
        }
        if (includeDocs) {
            console.log("Generating documentation...");
            const docService = new documentation_1.DocumentationService(configPath);
            results.documentation = await docService.generateDocumentation(repoPath, outputPath);
        }
        if (includeTests) {
            console.log("Generating tests...");
            const testService = new testing_1.TestingService(configPath);
            results.tests = await testService.generateTests(repoPath, outputPath);
        }
        console.log("Analysis completed successfully!");
        return results;
    }
    catch (error) {
        console.error("Error during repository analysis:", error);
        throw error;
    }
}
// Legacy main function for backward compatibility
async function main() {
    const repositoryPath = process.argv[2] || process.cwd();
    if (!process.env.GEMINI_API_KEY) {
        console.error("GEMINI_API_KEY environment variable is required");
        console.log("Get your API key from: https://aistudio.google.com/apikey");
        process.exit(1);
    }
    try {
        await analyzeRepository(repositoryPath);
    }
    catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}
// Run main function if this file is executed directly
if (require.main === module) {
    main();
}
//# sourceMappingURL=index.js.map