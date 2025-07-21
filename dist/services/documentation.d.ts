import { Documentation } from "../types";
export declare class DocumentationService {
    private geminiClient;
    constructor(configPath?: string);
    generateDocumentation(repoPath: string, outputPath?: string): Promise<Documentation>;
    private generateDocumentationContent;
    private buildDocumentationPrompt;
    private parseDocumentationContent;
    private createDefaultSections;
    private determineSectionType;
    private saveDocumentation;
    private generateReadme;
}
export declare function generateDocumentation(repoPath: string, outputPath?: string): Promise<string>;
//# sourceMappingURL=documentation.d.ts.map