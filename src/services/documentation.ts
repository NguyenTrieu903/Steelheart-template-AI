import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { OpenAIClient } from "./openai-client";
import {
  Documentation,
  DocumentationSection,
  RepositoryAnalysis,
} from "../types";
import { analyzeRepository } from "../utils/repository-analyzer";

export class DocumentationService {
  private openaiClient: OpenAIClient;

  constructor(configPath?: string) {
    this.openaiClient = new OpenAIClient(configPath);
  }

  async generateDocumentation(
    repoPath: string,
    outputPath?: string
  ): Promise<Documentation> {
    try {
      console.log("Starting documentation generation...");

      // Analyze repository structure
      const repoAnalysis = await analyzeRepository(repoPath);

      // Generate documentation using Gemini
      const docContent = await this.generateDocumentationContent(
        repoPath,
        repoAnalysis
      );

      // Parse and structure the documentation
      const documentation = this.parseDocumentationContent(
        docContent,
        repoPath
      );

      // Save documentation if output path is specified
      if (outputPath) {
        this.saveDocumentation(documentation, outputPath);
      }

      console.log("Documentation generated successfully!");
      return documentation;
    } catch (error) {
      console.error("Error generating documentation:", error);
      throw new Error(`Documentation generation failed: ${error}`);
    }
  }

  private async generateDocumentationContent(
    repoPath: string,
    analysis: RepositoryAnalysis
  ): Promise<string> {
    const prompt = this.buildDocumentationPrompt(repoPath, analysis);
    const systemInstruction = `You are a technical documentation expert. Create comprehensive, clear, and well-structured documentation.
        
        Generate documentation that includes:
        1. Project overview and purpose
        2. Installation instructions
        3. Usage examples
        4. API documentation (if applicable)
        5. Configuration options
        6. Contributing guidelines
        7. Architecture overview
        
        Provide your response in the following JSON format:
        {
          "sections": [
            {
              "title": "Section Title",
              "content": "Section content in markdown format",
              "type": "overview|installation|usage|api|examples|configuration"
            }
          ],
          "content": "Full documentation content in markdown format"
        }`;

    return await this.openaiClient.generateContent(prompt, systemInstruction);
  }

  private buildDocumentationPrompt(
    repoPath: string,
    analysis: RepositoryAnalysis
  ): string {
    return `Please generate comprehensive documentation for this repository:

Repository Path: ${repoPath}

Repository Analysis:
- Total Files: ${analysis.structure.totalFiles}
- Technologies: ${analysis.technologies
      .map((t) => `${t.name} ${t.version || ""}`)
      .join(", ")}
- Main File Types: ${Object.entries(analysis.structure.fileTypes)
      .map(([ext, count]) => `${ext}: ${count}`)
      .join(", ")}
- Lines of Code: ${analysis.metrics.linesOfCode}

Key Dependencies:
${analysis.dependencies
  .map((dep) => `- ${dep.name}@${dep.version} (${dep.type})`)
  .join("\n")}

Project Structure:
${analysis.structure.directories.slice(0, 10).join("\n")}

Main Files:
${analysis.structure.mainFiles.join("\n")}

Please create documentation that would help new developers understand and contribute to this project. 
Include practical examples and clear setup instructions.`;
  }

  private parseDocumentationContent(
    content: string,
    repoUrl: string
  ): Documentation {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      let sections: DocumentationSection[] = [];
      let documentationContent = content;

      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          sections = parsed.sections || [];
          documentationContent = parsed.content || content;
        } catch (parseError) {
          console.warn("Failed to parse JSON response, using full content");
        }
      }

      // If no structured sections, create default sections from content
      if (sections.length === 0) {
        sections = this.createDefaultSections(documentationContent);
      }

      return {
        repositoryUrl: repoUrl,
        content: documentationContent,
        sections: sections,
        generatedAt: new Date(),
      };
    } catch (error) {
      console.warn(
        "Failed to parse documentation content, creating basic documentation"
      );
      return {
        repositoryUrl: repoUrl,
        content: content.substring(0, 1000) + "...",
        sections: [],
        generatedAt: new Date(),
      };
    }
  }

  private createDefaultSections(content: string): DocumentationSection[] {
    const sections: DocumentationSection[] = [];

    // Split content by markdown headers
    const headerRegex = /^#+\s+(.+)$/gm;
    const matches = Array.from(content.matchAll(headerRegex));

    for (let i = 0; i < matches.length; i++) {
      const currentMatch = matches[i];
      const nextMatch = matches[i + 1];

      const startIndex = currentMatch.index!;
      const endIndex = nextMatch ? nextMatch.index! : content.length;

      const sectionContent = content.substring(startIndex, endIndex).trim();
      const title = currentMatch[1];

      sections.push({
        title: title,
        content: sectionContent,
        type: this.determineSectionType(title),
      });
    }

    return sections;
  }

  private determineSectionType(title: string): DocumentationSection["type"] {
    const titleLower = title.toLowerCase();

    if (titleLower.includes("install")) return "installation";
    if (titleLower.includes("usage") || titleLower.includes("how to"))
      return "usage";
    if (titleLower.includes("api") || titleLower.includes("reference"))
      return "api";
    if (titleLower.includes("example")) return "examples";
    if (titleLower.includes("config")) return "configuration";
    if (titleLower.includes("overview") || titleLower.includes("about"))
      return "overview";

    return "overview";
  }

  private saveDocumentation(
    documentation: Documentation,
    outputPath: string
  ): void {
    try {
      const docPath = join(outputPath, "README.md");
      const fullDocPath = join(outputPath, "documentation.md");
      const jsonPath = join(outputPath, "documentation.json");

      // Ensure directory exists
      mkdirSync(dirname(docPath), { recursive: true });

      // Generate README.md (condensed version)
      const readmeContent = this.generateReadme(documentation);
      writeFileSync(docPath, readmeContent);

      // Save full documentation
      writeFileSync(fullDocPath, documentation.content);

      // Save JSON version
      writeFileSync(jsonPath, JSON.stringify(documentation, null, 2));

      console.log(`README.md saved to: ${docPath}`);
      console.log(`Full documentation saved to: ${fullDocPath}`);
      console.log(`JSON documentation saved to: ${jsonPath}`);
    } catch (error) {
      console.error("Error saving documentation:", error);
    }
  }

  private generateReadme(documentation: Documentation): string {
    const overviewSection = documentation.sections.find(
      (s) => s.type === "overview"
    );
    const installSection = documentation.sections.find(
      (s) => s.type === "installation"
    );
    const usageSection = documentation.sections.find((s) => s.type === "usage");

    return `# Project Documentation

*Generated on ${documentation.generatedAt.toISOString()}*

${overviewSection ? overviewSection.content : ""}

${installSection ? installSection.content : ""}

${usageSection ? usageSection.content : ""}

## Additional Documentation

For complete documentation, see [documentation.md](./documentation.md).

---
*This documentation was automatically generated using Gemini AI.*
`;
  }
}

// Legacy function for backward compatibility
export async function generateDocumentation(
  repoPath: string,
  outputPath?: string
): Promise<string> {
  const service = new DocumentationService();
  const documentation = await service.generateDocumentation(
    repoPath,
    outputPath
  );
  return documentation.content;
}
