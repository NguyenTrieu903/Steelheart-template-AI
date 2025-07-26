import { readFileSync } from "fs";
import { getFileExtension } from "./project-analyzer";
import { getChangedLinesFromDiff } from "./git/branch-operations";
import { CommentGeneration } from "../types/cli";

export const generateCodeComments = async (
  filePath: string,
  diffContent: string
): Promise<CommentGeneration> => {
  try {
    const originalContent = readFileSync(filePath, "utf8");
    const fileExtension = filePath.split(".").pop()?.toLowerCase();
    const changedLines = getChangedLinesFromDiff(diffContent);

    // Filter to only added lines (where we want to add comments)
    const addedLines = changedLines.filter((line) => line.type === "added");

    if (addedLines.length === 0) {
      return {
        content: originalContent,
        commentsAdded: 0,
        preview: `No new lines to comment in ${filePath}`,
      };
    }

    const prompt = `Please analyze this code file and add helpful comments ONLY to the newly added or changed lines. Do not modify existing code or comments.

                      File: ${filePath}
                      Language: ${fileExtension}

                      ## Changed Lines to Comment (line numbers are approximate):
                      ${addedLines
                        .map(
                          (line) => `Line ~${line.lineNumber}: ${line.content}`
                        )
                        .join("\n")}

                      ## Context - Full Diff:
                      ${
                        diffContent.length > 1000000
                          ? diffContent.substring(0, 1000000) +
                            "\n... (truncated)"
                          : diffContent
                      }

                      ## Original File Content:
                      ${
                        originalContent.length > 1000000
                          ? originalContent.substring(0, 1000000) +
                            "\n... (truncated)"
                          : originalContent
                      }

                      INSTRUCTIONS:
                      1. Add comments ONLY to the newly added lines shown above
                      2. Focus on explaining WHY the code does what it does, not WHAT it does
                      3. Explain complex logic, business rules, or non-obvious implementations
                      4. Use appropriate comment syntax for ${fileExtension} files
                      5. DO NOT over-comment simple operations
                      6. DO NOT modify existing code or comments
                      7. Return the complete file with strategically placed comments on the changed lines

                      Format your response as JSON:
                      {
                        "commentedCode": "the complete file with comments added only to new/changed lines",
                        "commentsAdded": number_of_comments_added,
                        "summary": "brief summary of what comments were added and where"
                      }`;

    const systemInstruction = `You are a senior developer with 10+ years experience adding strategic comments to code. Your role is to add meaningful comments that help other developers understand complex logic, business rules, and implementation decisions. Focus on the WHY, not the WHAT. Only comment on newly added or changed lines - do not modify existing code or comments.`;

    try {
      // Use OpenAI client to generate comments
      const openaiClient = new (
        await import("../services/openai-client")
      ).OpenAIClient();
      const response = await openaiClient.generateContent(
        prompt,
        systemInstruction
      );

      // Try to parse JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          content: parsed.commentedCode || originalContent,
          commentsAdded: parsed.commentsAdded || 0,
          preview:
            parsed.summary ||
            `Added ${
              parsed.commentsAdded || 0
            } strategic comments to changed lines in ${filePath}`,
        };
      }
    } catch (error) {
      console.warn("Failed to generate AI comments, using preview mode");
    }

    // Fallback: return preview without actual changes
    return {
      content: originalContent,
      commentsAdded: 0,
      preview: `Would add strategic comments to ${addedLines.length} newly added lines in ${filePath}`,
    };
  } catch (error) {
    throw new Error(`Failed to generate comments for ${filePath}: ${error}`);
  }
};
