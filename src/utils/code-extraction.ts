export function extractCodeFromResponse(
  response: string,
  fileType: string
): string | null {
  try {
    // Try to find code block with language specification
    const languagePatterns = [
      fileType.toLowerCase(),
      "javascript",
      "js",
      "typescript",
      "ts",
      "jsx",
      "tsx",
      "python",
      "py",
      "java",
      "go",
      "rust",
      "rs",
      "php",
      "rb",
      "cpp",
      "c",
      "h",
    ];

    // Look for code blocks with language specification
    for (const lang of languagePatterns) {
      const codeBlockRegex = new RegExp(
        `\`\`\`${lang}\\s*\\n([\\s\\S]*?)\\n\`\`\``,
        "i"
      );
      const match = response.match(codeBlockRegex);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Try to find any code block without language specification
    const genericCodeBlockRegex = /```\s*\n([\s\S]*?)\n```/;
    const genericMatch = response.match(genericCodeBlockRegex);
    if (genericMatch && genericMatch[1]) {
      return genericMatch[1].trim();
    }

    // If no code blocks found, look for the largest block of code-like content
    // This would be content that has proper indentation and code structure
    const lines = response.split("\n");
    let codeStart = -1;
    let codeEnd = -1;

    // Find start of code (lines that look like imports, functions, etc.)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (
        line.match(
          /^(import|export|const|let|var|function|class|\/\*|\/\/|\{|\}|<|>|describe|test|it|expect)/
        )
      ) {
        codeStart = i;
        break;
      }
    }

    // Find end of code (last meaningful code line)
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.match(/^(export|return|\}|>;|;|\/\*|\/\/|\}\);)/)) {
        codeEnd = i;
        break;
      }
    }

    if (codeStart !== -1 && codeEnd !== -1 && codeEnd > codeStart) {
      return lines.slice(codeStart, codeEnd + 1).join("\n");
    }
  } catch (error) {
    console.warn("Error extracting code from response:", error);
  }

  return null;
}

export function getFileType(fileName: string): string {
  if (fileName.endsWith(".ts") || fileName.endsWith(".tsx")) {
    return "TypeScript";
  } else if (fileName.endsWith(".js") || fileName.endsWith(".jsx")) {
    return "JavaScript";
  } else if (fileName.endsWith(".py")) {
    return "Python";
  } else if (fileName.endsWith(".java")) {
    return "Java";
  } else if (fileName.endsWith(".go")) {
    return "Go";
  } else if (fileName.endsWith(".rs")) {
    return "Rust";
  } else if (fileName.endsWith(".php")) {
    return "PHP";
  } else if (fileName.endsWith(".rb")) {
    return "Ruby";
  } else if (
    fileName.endsWith(".cpp") ||
    fileName.endsWith(".c") ||
    fileName.endsWith(".h")
  ) {
    return "C++";
  }
  return "JavaScript";
}
