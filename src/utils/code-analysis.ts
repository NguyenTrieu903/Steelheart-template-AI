import { CodeAnalysisInsights, FileTypeAnalysis } from "../types/cli";

export const analyzeDiffContent = (
  diffContent: string,
  changedFiles: any[]
) => {
  const insights: CodeAnalysisInsights = {
    codePatterns: [],
    functionsModified: [],
    newFeatures: [],
    bugFixes: [],
    refactoring: [],
    configChanges: [],
    dependencies: [],
  };

  const lines = diffContent.split("\n");

  for (const line of lines) {
    // Detect function additions/modifications
    if (
      line.startsWith("+") &&
      (line.includes("function ") ||
        line.includes("const ") ||
        line.includes("class ") ||
        line.includes("interface "))
    ) {
      const match = line.match(/(?:function|const|class|interface)\s+(\w+)/);
      if (match) {
        insights.functionsModified.push(match[1]);
      }
    }

    // Detect new features
    if (
      line.startsWith("+") &&
      (line.toLowerCase().includes("feature") ||
        line.toLowerCase().includes("add") ||
        line.toLowerCase().includes("new"))
    ) {
      insights.newFeatures.push(
        line.replace(/^\+\s*/, "").substring(0, 50) + "..."
      );
    }

    // Detect bug fixes
    if (
      line.startsWith("+") &&
      (line.toLowerCase().includes("fix") ||
        line.toLowerCase().includes("bug") ||
        line.toLowerCase().includes("error"))
    ) {
      insights.bugFixes.push(
        line.replace(/^\+\s*/, "").substring(0, 50) + "..."
      );
    }

    // Detect dependency changes
    if (line.includes("package.json") || line.includes("dependencies")) {
      insights.dependencies.push(
        line.replace(/^[+-]\s*/, "").substring(0, 50) + "..."
      );
    }

    // Detect configuration changes
    if (
      line.includes(".json") ||
      line.includes(".config") ||
      line.includes(".env")
    ) {
      insights.configChanges.push(
        line.replace(/^[+-]\s*/, "").substring(0, 50) + "..."
      );
    }
  }

  // Analyze file types for patterns
  const fileTypeAnalysis: FileTypeAnalysis = changedFiles.reduce(
    (acc: FileTypeAnalysis, file: any) => {
      const ext = file.file.split(".").pop()?.toLowerCase();
      if (ext === "ts" || ext === "js") {
        acc.codeFiles += 1;
      } else if (ext === "json") {
        acc.configFiles += 1;
      } else if (ext === "md") {
        acc.docFiles += 1;
      } else if (ext === "test.ts" || ext === "spec.ts") {
        acc.testFiles += 1;
      }
      return acc;
    },
    { codeFiles: 0, configFiles: 0, docFiles: 0, testFiles: 0 }
  );

  return { insights, fileTypeAnalysis };
};
