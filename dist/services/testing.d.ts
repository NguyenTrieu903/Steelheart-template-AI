import { TestConfig } from "../types";
export declare class TestingService {
    private geminiClient;
    constructor(configPath?: string);
    generateTests(repoPath: string, outputPath?: string): Promise<TestConfig>;
    private generateTestContent;
    private buildTestPrompt;
    private parseTestContent;
    private saveTests;
    private generateUnitTestFile;
    private generateIntegrationTestFile;
    private getTestImports;
    private generateTestRunner;
}
export declare function writeUnitTest(repoPath: string, outputPath?: string): Promise<string>;
export declare function runIntegrationTest(repoPath: string): Promise<string>;
//# sourceMappingURL=testing.d.ts.map