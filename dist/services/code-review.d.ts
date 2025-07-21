import { ReviewReport } from "../types";
export declare class CodeReviewService {
    private geminiClient;
    constructor(configPath?: string);
    performCodeReview(repoPath: string, outputPath?: string): Promise<ReviewReport>;
    private generateReviewContent;
    private buildReviewPrompt;
    private parseReviewContent;
    private generateSummary;
    private saveReviewReport;
    private generateMarkdownReport;
}
export declare function performCodeReview(repoPath: string, outputPath?: string): Promise<ReviewReport>;
//# sourceMappingURL=code-review.d.ts.map