import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { DocumentationService } from "../services/documentation";
import { getFileExtension } from "./project-analyzer";
import { analyzeDiffContent } from "./code-analysis";
import { BranchChanges } from "../types/cli";

export const generateBranchDocumentation = async (
  service: DocumentationService,
  branchChanges: BranchChanges,
  repoPath: string
): Promise<string> => {
  // Separate new files from modified files
  const newFiles = branchChanges.changedFiles.filter((file: any) => file.isNew);
  const modifiedFiles = branchChanges.changedFiles.filter(
    (file: any) => !file.isNew
  );

  // Get full content of new files for better documentation
  const newFileContents: any = {};
  for (const file of newFiles) {
    try {
      const fullPath = join(repoPath, file.file);
      if (existsSync(fullPath)) {
        const content = readFileSync(fullPath, "utf8");
        // Truncate very long files for prompt
        newFileContents[file.file] =
          content.length > 2000
            ? content.substring(0, 2000) + "\n... (truncated)"
            : content;
      }
    } catch (error) {
      console.warn(`Could not read new file ${file.file}:`, error);
    }
  }

  // Enhanced prompt with more context and detailed analysis request
  const prompt = `You are a senior technical documentation expert. Analyze the following Git branch changes and create comprehensive documentation that explains not just WHAT changed, but WHY and HOW it impacts the project.

## Branch Information
- **Current Branch**: ${branchChanges.currentBranch}
- **Base Branch**: ${branchChanges.baseBranch}
- **Total Files Modified**: ${branchChanges.totalChanges}
- **New Files Added**: ${newFiles.length}
- **Existing Files Modified**: ${modifiedFiles.length}
- **Lines Added**: ${branchChanges.totalInsertions}
- **Lines Removed**: ${branchChanges.totalDeletions}
- **Include Uncommitted**: ${branchChanges.includeUncommitted ? "Yes" : "No"}

## Commit History
${branchChanges.commits
  .map(
    (commit: any) =>
      `- **${commit.hash.substring(0, 8)}**: ${commit.message}${
        commit.author_name ? ` (${commit.author_name})` : ""
      }`
  )
  .join("\n")}

## New Files Added (${newFiles.length})
${
  newFiles.length > 0
    ? newFiles
        .map(
          (file: any) =>
            `- **${file.file}** (+${file.insertions || 0} lines)${
              file.binary ? " [BINARY]" : ""
            }`
        )
        .join("\n")
    : "None"
}

## Existing Files Modified (${modifiedFiles.length})
${
  modifiedFiles.length > 0
    ? modifiedFiles
        .map(
          (file: any) =>
            `- **${file.file}** (+${file.insertions || 0} -${
              file.deletions || 0
            })${file.binary ? " [BINARY]" : ""}`
        )
        .join("\n")
    : "None"
}

${
  Object.keys(newFileContents).length > 0
    ? `
## New File Contents
${Object.entries(newFileContents)
  .map(
    ([filePath, content]) => `
### ${filePath}
\`\`\`${getFileExtension(filePath)}
${content}
\`\`\`
`
  )
  .join("")}
`
    : ""
}

## Code Changes (Diff Analysis)
\`\`\`diff
${branchChanges.diffContent.substring(0, 3000)}
${
  branchChanges.diffContent.length > 3000 ? "\n... (truncated for brevity)" : ""
}
\`\`\`

## Analysis Requirements
Please provide a detailed analysis that includes:

### 1. **Executive Summary**
- High-level overview of what this branch accomplishes
- Business value or technical improvement achieved

### 2. **Technical Analysis**
- Detailed breakdown of changes in each file
- Architecture or design patterns introduced/modified
- Code quality improvements or refactoring done

### 3. **Impact Assessment**
- How these changes affect the overall system
- Potential breaking changes or compatibility issues
- Performance implications (if any)

### 4. **Code Quality & Best Practices**
- Adherence to coding standards
- Security considerations
- Error handling improvements

### 5. **Testing & Validation**
- Recommended testing strategies
- Edge cases to consider
- Integration testing requirements

### 6. **Deployment Considerations**
- Migration steps (if any)
- Configuration changes needed
- Rollback procedures

### 7. **Developer Notes**
- Key implementation details
- Design decisions made
- Future considerations or TODOs

Please format as comprehensive markdown documentation with clear sections and actionable insights.`;

  const systemInstruction = `You are a senior technical documentation expert and code reviewer with deep expertise in software architecture, best practices, and team collaboration. Your role is to create documentation that not only describes changes but provides meaningful insights that help team members understand the technical decisions, implications, and next steps. Focus on clarity, completeness, and actionable information.`;

  try {
    const content = await service["openaiClient"].generateContent(
      prompt,
      systemInstruction
    );
    return content;
  } catch (error) {
    console.warn(
      "Failed to generate AI documentation, creating detailed manual analysis"
    );

    // Enhanced fallback with much more detailed analysis
    const analysisDate = new Date().toISOString().split("T")[0];
    const fileTypes = branchChanges.changedFiles.reduce(
      (acc: any, file: any) => {
        const ext = file.file.split(".").pop()?.toLowerCase() || "unknown";
        acc[ext] = (acc[ext] || 0) + 1;
        return acc;
      },
      {}
    );

    const majorFiles = branchChanges.changedFiles.filter(
      (file: any) => (file.insertions || 0) + (file.deletions || 0) > 10
    );

    const minorFiles = branchChanges.changedFiles.filter(
      (file: any) => (file.insertions || 0) + (file.deletions || 0) <= 10
    );

    // Analyze diff content for insights
    const { insights, fileTypeAnalysis } = analyzeDiffContent(
      branchChanges.diffContent,
      branchChanges.changedFiles
    );

    return `# Branch Documentation: ${branchChanges.currentBranch}

> **Generated on**: ${analysisDate}  
> **Base Branch**: ${branchChanges.baseBranch}  
> **Analysis Type**: ${
      branchChanges.includeUncommitted
        ? "Including uncommitted changes"
        : "Committed changes only"
    }

## 📋 Executive Summary

This branch contains **${branchChanges.totalChanges} file(s)** with **${
      branchChanges.totalInsertions
    } additions** and **${
      branchChanges.totalDeletions
    } deletions**, representing ${
      branchChanges.commits.length > 0
        ? `${branchChanges.commits.length} commit(s)`
        : "uncommitted changes"
    }.

${
  insights.newFeatures.length > 0
    ? `### 🆕 New Features Detected\n${insights.newFeatures
        .slice(0, 3)
        .map((f) => `- ${f}`)
        .join("\n")}\n`
    : ""
}
${
  insights.bugFixes.length > 0
    ? `### 🐛 Bug Fixes Detected\n${insights.bugFixes
        .slice(0, 3)
        .map((f) => `- ${f}`)
        .join("\n")}\n`
    : ""
}
${
  insights.functionsModified.length > 0
    ? `### ⚙️ Functions/Classes Modified\n${insights.functionsModified
        .slice(0, 5)
        .map((f) => `- ${f}`)
        .join("\n")}\n`
    : ""
}

## 🔄 Change Overview

### File Type Distribution
${Object.entries(fileTypes)
  .map(([ext, count]) => `- **${ext.toUpperCase()}**: ${count} file(s)`)
  .join("\n")}

### Project Structure Analysis
- **Code Files**: ${fileTypeAnalysis.codeFiles} (TypeScript/JavaScript)
- **Configuration Files**: ${fileTypeAnalysis.configFiles} (JSON/Config)
- **Documentation**: ${fileTypeAnalysis.docFiles} (Markdown)
- **Test Files**: ${fileTypeAnalysis.testFiles} (Test/Spec)

### Commit History
${
  branchChanges.commits.length > 0
    ? branchChanges.commits
        .map(
          (commit: any) =>
            `- **${commit.hash.substring(0, 8)}**: ${commit.message}`
        )
        .join("\n")
    : "_No commits found (working directory changes)_"
}

## 📁 Files Modified

### Major Changes (>10 lines)
${
  majorFiles.length > 0
    ? majorFiles
        .map(
          (file: any) =>
            `- **${file.file}** (+${file.insertions || 0} -${
              file.deletions || 0
            })`
        )
        .join("\n")
    : "_No major changes detected_"
}

### Minor Changes (≤10 lines)
${
  minorFiles.length > 0
    ? minorFiles
        .map(
          (file: any) =>
            `- **${file.file}** (+${file.insertions || 0} -${
              file.deletions || 0
            })`
        )
        .join("\n")
    : "_No minor changes detected_"
}

## 🔍 Technical Analysis

### Code Changes Summary
- **Total Lines Changed**: ${
      branchChanges.totalInsertions + branchChanges.totalDeletions
    }
- **Net Change**: ${
      branchChanges.totalInsertions - branchChanges.totalDeletions > 0
        ? "+"
        : ""
    }${branchChanges.totalInsertions - branchChanges.totalDeletions} lines
- **Change Ratio**: ${
      branchChanges.totalDeletions > 0
        ? Math.round(
            (branchChanges.totalInsertions / branchChanges.totalDeletions) * 100
          ) / 100
        : "N/A"
    } (additions/deletions)

### Change Pattern Analysis
${
  insights.dependencies.length > 0
    ? `- **Dependencies**: ${insights.dependencies.length} dependency-related changes detected\n`
    : ""
}
${
  insights.configChanges.length > 0
    ? `- **Configuration**: ${insights.configChanges.length} configuration changes detected\n`
    : ""
}
${
  fileTypeAnalysis.codeFiles > 0
    ? `- **Code Logic**: ${fileTypeAnalysis.codeFiles} code files modified\n`
    : ""
}
${
  fileTypeAnalysis.testFiles > 0
    ? `- **Testing**: ${fileTypeAnalysis.testFiles} test files modified\n`
    : ""
}

### File Impact Analysis
${branchChanges.changedFiles
  .map((file: any) => {
    const totalChanges = (file.insertions || 0) + (file.deletions || 0);
    const impact =
      totalChanges > 50 ? "HIGH" : totalChanges > 10 ? "MEDIUM" : "LOW";
    return `- **${file.file}**: ${impact} impact (${totalChanges} lines changed)`;
  })
  .join("\n")}

## 📊 Change Statistics

| Metric | Value |
|--------|-------|
| Files Modified | ${branchChanges.totalChanges} |
| Lines Added | ${branchChanges.totalInsertions} |
| Lines Removed | ${branchChanges.totalDeletions} |
| Net Lines | ${branchChanges.totalInsertions - branchChanges.totalDeletions} |
| Commits | ${branchChanges.commits.length} |

## 🔧 Recommended Actions

### For Code Review
- [ ] Review changes in high-impact files: ${
      majorFiles.map((f: any) => f.file).join(", ") || "None"
    }
- [ ] Verify backward compatibility
- [ ] Check for potential security issues
- [ ] Validate error handling in modified code
${
  insights.functionsModified.length > 0
    ? `- [ ] Review modified functions: ${insights.functionsModified
        .slice(0, 3)
        .join(", ")}\n`
    : ""
}

### For Testing
- [ ] Unit tests for modified functions
- [ ] Integration tests for affected modules
- [ ] Regression testing for ${
      fileTypes.js || fileTypes.ts || fileTypes.py
        ? "core functionality"
        : "affected components"
    }
- [ ] Performance testing if applicable
${
  fileTypeAnalysis.testFiles > 0
    ? `- [ ] Run existing test suite (${fileTypeAnalysis.testFiles} test files modified)\n`
    : ""
}

### For Deployment
- [ ] Review configuration changes
- [ ] Check for database migrations (if any)
- [ ] Validate environment variables
- [ ] Plan rollback strategy
${
  insights.dependencies.length > 0
    ? `- [ ] Update dependencies (${insights.dependencies.length} dependency changes detected)\n`
    : ""
}

## 📝 Additional Notes

**Branch Type**: ${
      branchChanges.includeUncommitted
        ? "Working branch with uncommitted changes"
        : "Committed changes ready for review"
    }

**Complexity Assessment**: ${
      branchChanges.totalChanges > 10
        ? "HIGH"
        : branchChanges.totalChanges > 3
        ? "MEDIUM"
        : "LOW"
    } - Based on number of files modified

**Review Priority**: ${majorFiles.length > 0 ? "HIGH" : "MEDIUM"} - ${
      majorFiles.length > 0
        ? "Contains significant changes requiring careful review"
        : "Standard changes requiring normal review process"
    }

${
  insights.newFeatures.length > 0
    ? `**Feature Development**: This appears to be feature development work with ${insights.newFeatures.length} new feature(s) detected.\n`
    : ""
}
${
  insights.bugFixes.length > 0
    ? `**Bug Fixes**: This branch contains ${insights.bugFixes.length} bug fix(es).\n`
    : ""
}

## 🔍 Detailed Diff Analysis

### Key Changes Detected:
${branchChanges.diffContent
  .split("\n")
  .filter((line: string) => line.startsWith("+"))
  .slice(0, 10)
  .map((line: string) => `- ${line.substring(1).trim()}`)
  .join("\n")}

${
  branchChanges.diffContent.length > 1000
    ? "\n### Code Diff Preview:\n```diff\n" +
      branchChanges.diffContent.substring(0, 1000) +
      "\n... (truncated)\n```"
    : ""
}

---
*This documentation was generated automatically. For AI-powered detailed analysis, ensure a valid OpenAI API key is configured.*`;
  }
};
