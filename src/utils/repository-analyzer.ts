import { readFileSync, statSync, readdirSync } from "fs";
import { join, extname, basename } from "path";
import {
  RepositoryAnalysis,
  FileStructure,
  Technology,
  Dependency,
  CodeMetrics,
} from "../types";

export async function analyzeRepository(
  repoPath: string
): Promise<RepositoryAnalysis> {
  try {
    const structure = await analyzeFileStructure(repoPath);
    const technologies = await detectTechnologies(repoPath, structure);
    const dependencies = await analyzeDependencies(repoPath);
    const metrics = await calculateCodeMetrics(repoPath, structure);

    return {
      structure,
      technologies,
      dependencies,
      metrics,
    };
  } catch (error) {
    console.error("Error analyzing repository:", error);
    throw new Error(`Repository analysis failed: ${error}`);
  }
}

async function analyzeFileStructure(repoPath: string): Promise<FileStructure> {
  const fileTypes: { [extension: string]: number } = {};
  const directories: string[] = [];
  const mainFiles: string[] = [];
  let totalFiles = 0;

  function walkDirectory(dirPath: string, relativePath = ""): void {
    try {
      const items = readdirSync(dirPath);

      for (const item of items) {
        if (item.startsWith(".") && item !== ".env") continue; // Skip hidden files except .env

        const fullPath = join(dirPath, item);
        const relativeItemPath = join(relativePath, item);

        try {
          const stats = statSync(fullPath);

          if (stats.isDirectory()) {
            if (!shouldIgnoreDirectory(item)) {
              directories.push(relativeItemPath);
              walkDirectory(fullPath, relativeItemPath);
            }
          } else if (stats.isFile()) {
            totalFiles++;
            const ext = extname(item);
            fileTypes[ext] = (fileTypes[ext] || 0) + 1;

            if (isMainFile(item, relativePath)) {
              mainFiles.push(relativeItemPath);
            }
          }
        } catch (error) {
          // Skip files that can't be accessed
          continue;
        }
      }
    } catch (error) {
      // Skip directories that can't be accessed
      return;
    }
  }

  walkDirectory(repoPath);

  return {
    totalFiles,
    directories,
    fileTypes,
    mainFiles,
  };
}

function shouldIgnoreDirectory(dirName: string): boolean {
  const ignoredDirs = [
    "node_modules",
    ".git",
    ".vscode",
    ".idea",
    "dist",
    "build",
    "coverage",
    ".nyc_output",
    "vendor",
    "__pycache__",
    ".pytest_cache",
    "target",
    "bin",
    "obj",
    ".gradle",
  ];
  return ignoredDirs.includes(dirName);
}

function isMainFile(fileName: string, relativePath: string): boolean {
  const mainFilePatterns = [
    /^(index|main|app)\.(js|ts|py|java|cpp|c|go|rs)$/,
    /^package\.json$/,
    /^requirements\.txt$/,
    /^setup\.py$/,
    /^Cargo\.toml$/,
    /^go\.mod$/,
    /^pom\.xml$/,
    /^build\.gradle$/,
    /^Dockerfile$/,
    /^README\.(md|txt)$/i,
    /^\.env$/,
  ];

  // Check if it's in the root directory for config files
  if (relativePath === "" || relativePath === ".") {
    return mainFilePatterns.some((pattern) => pattern.test(fileName));
  }

  // For non-root files, only consider code entry points
  return /^(index|main|app)\.(js|ts|py|java|cpp|c|go|rs)$/.test(fileName);
}

async function detectTechnologies(
  repoPath: string,
  structure: FileStructure
): Promise<Technology[]> {
  const technologies: Technology[] = [];

  // Analyze by file extensions
  const extToTech: { [ext: string]: { name: string; confidence: number } } = {
    ".js": { name: "JavaScript", confidence: 0.9 },
    ".ts": { name: "TypeScript", confidence: 0.95 },
    ".py": { name: "Python", confidence: 0.95 },
    ".java": { name: "Java", confidence: 0.95 },
    ".cpp": { name: "C++", confidence: 0.9 },
    ".c": { name: "C", confidence: 0.9 },
    ".go": { name: "Go", confidence: 0.95 },
    ".rs": { name: "Rust", confidence: 0.95 },
    ".php": { name: "PHP", confidence: 0.9 },
    ".rb": { name: "Ruby", confidence: 0.9 },
    ".html": { name: "HTML", confidence: 0.8 },
    ".css": { name: "CSS", confidence: 0.7 },
    ".scss": { name: "SCSS", confidence: 0.8 },
    ".vue": { name: "Vue.js", confidence: 0.9 },
    ".jsx": { name: "React", confidence: 0.9 },
    ".tsx": { name: "React TypeScript", confidence: 0.9 },
  };

  for (const [ext, count] of Object.entries(structure.fileTypes)) {
    if (extToTech[ext] && count > 0) {
      const tech = extToTech[ext];
      technologies.push({
        name: tech.name,
        confidence: Math.min(tech.confidence + count / structure.totalFiles, 1),
        files: [], // Would need to track specific files for this
      });
    }
  }

  // Check for specific technology indicators
  try {
    // Check for package.json (Node.js/JavaScript ecosystem)
    const packageJsonPath = join(repoPath, "package.json");
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

      if (packageJson.dependencies || packageJson.devDependencies) {
        const hasReact =
          packageJson.dependencies?.react || packageJson.devDependencies?.react;
        const hasVue =
          packageJson.dependencies?.vue || packageJson.devDependencies?.vue;
        const hasAngular =
          packageJson.dependencies?.["@angular/core"] ||
          packageJson.devDependencies?.["@angular/core"];
        const hasNext =
          packageJson.dependencies?.next || packageJson.devDependencies?.next;

        if (hasReact) {
          technologies.push({
            name: "React",
            confidence: 0.95,
            files: ["package.json"],
          });
        }
        if (hasVue) {
          technologies.push({
            name: "Vue.js",
            confidence: 0.95,
            files: ["package.json"],
          });
        }
        if (hasAngular) {
          technologies.push({
            name: "Angular",
            confidence: 0.95,
            files: ["package.json"],
          });
        }
        if (hasNext) {
          technologies.push({
            name: "Next.js",
            confidence: 0.95,
            files: ["package.json"],
          });
        }
      }
    } catch (error) {
      // package.json doesn't exist or is invalid
    }

    // Check for requirements.txt (Python)
    try {
      readFileSync(join(repoPath, "requirements.txt"), "utf8");
      if (!technologies.find((t) => t.name === "Python")) {
        technologies.push({
          name: "Python",
          confidence: 0.9,
          files: ["requirements.txt"],
        });
      }
    } catch (error) {
      // requirements.txt doesn't exist
    }

    // Check for Cargo.toml (Rust)
    try {
      readFileSync(join(repoPath, "Cargo.toml"), "utf8");
      if (!technologies.find((t) => t.name === "Rust")) {
        technologies.push({
          name: "Rust",
          confidence: 0.95,
          files: ["Cargo.toml"],
        });
      }
    } catch (error) {
      // Cargo.toml doesn't exist
    }
  } catch (error) {
    // Error reading files, continue with what we have
  }

  return technologies.sort((a, b) => b.confidence - a.confidence);
}

async function analyzeDependencies(repoPath: string): Promise<Dependency[]> {
  const dependencies: Dependency[] = [];

  try {
    // Analyze package.json dependencies
    const packageJsonPath = join(repoPath, "package.json");
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

      // Production dependencies
      if (packageJson.dependencies) {
        for (const [name, version] of Object.entries(
          packageJson.dependencies
        )) {
          dependencies.push({
            name,
            version: version as string,
            type: "production",
          });
        }
      }

      // Development dependencies
      if (packageJson.devDependencies) {
        for (const [name, version] of Object.entries(
          packageJson.devDependencies
        )) {
          dependencies.push({
            name,
            version: version as string,
            type: "development",
          });
        }
      }

      // Peer dependencies
      if (packageJson.peerDependencies) {
        for (const [name, version] of Object.entries(
          packageJson.peerDependencies
        )) {
          dependencies.push({
            name,
            version: version as string,
            type: "peer",
          });
        }
      }
    } catch (error) {
      // package.json doesn't exist or is invalid
    }

    // Analyze requirements.txt for Python
    try {
      const requirementsPath = join(repoPath, "requirements.txt");
      const requirementsContent = readFileSync(requirementsPath, "utf8");

      requirementsContent.split("\n").forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const match = trimmed.match(/^([a-zA-Z0-9_-]+)([><=!]+.+)?$/);
          if (match) {
            dependencies.push({
              name: match[1],
              version: match[2] || "unknown",
              type: "production",
            });
          }
        }
      });
    } catch (error) {
      // requirements.txt doesn't exist
    }
  } catch (error) {
    // Error analyzing dependencies
  }

  return dependencies;
}

async function calculateCodeMetrics(
  repoPath: string,
  structure: FileStructure
): Promise<CodeMetrics> {
  let linesOfCode = 0;
  let complexity = 0;

  // Count lines of code in main programming files
  const codeExtensions = [
    ".js",
    ".ts",
    ".py",
    ".java",
    ".cpp",
    ".c",
    ".go",
    ".rs",
    ".php",
    ".rb",
  ];
  const totalCodeFiles = Object.entries(structure.fileTypes)
    .filter(([ext]) => codeExtensions.includes(ext))
    .reduce((sum, [, count]) => sum + count, 0);

  // Estimate lines of code (rough calculation)
  linesOfCode = totalCodeFiles * 50; // Rough estimate of 50 lines per file

  // Estimate complexity based on file count and types
  complexity = Math.min(totalCodeFiles / 10, 10); // Scale 1-10

  return {
    linesOfCode,
    complexity,
    duplicateCodePercentage: 0, // Would require more sophisticated analysis
    technicalDebt: {
      hours: Math.floor(complexity * 2), // Rough estimate
      rating:
        complexity <= 2
          ? "A"
          : complexity <= 4
          ? "B"
          : complexity <= 6
          ? "C"
          : complexity <= 8
          ? "D"
          : "E",
    },
  };
}
