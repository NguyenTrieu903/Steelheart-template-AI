import { existsSync } from "fs";
import { join } from "path";

export const detectProjectType = (repoPath: string): string => {
  const packageJsonPath = join(repoPath, "package.json");
  const requirementsPath = join(repoPath, "requirements.txt");
  const cargoPath = join(repoPath, "Cargo.toml");
  const goModPath = join(repoPath, "go.mod");

  if (existsSync(packageJsonPath)) {
    return "Node.js/JavaScript";
  } else if (existsSync(requirementsPath)) {
    return "Python";
  } else if (existsSync(cargoPath)) {
    return "Rust";
  } else if (existsSync(goModPath)) {
    return "Go";
  }
  return "Unknown";
};

export const getFileExtension = (filePath: string): string => {
  const ext = filePath.split(".").pop()?.toLowerCase();
  const extensionMap: { [key: string]: string } = {
    js: "javascript",
    ts: "typescript",
    jsx: "jsx",
    tsx: "tsx",
    py: "python",
    java: "java",
    cpp: "cpp",
    c: "c",
    h: "c",
    rs: "rust",
    go: "go",
    php: "php",
    rb: "ruby",
    html: "html",
    css: "css",
    scss: "scss",
    json: "json",
    xml: "xml",
    md: "markdown",
    yml: "yaml",
    yaml: "yaml",
  };
  return extensionMap[ext || ""] || ext || "";
};
