import { existsSync } from "fs";
import { join, dirname, resolve } from "path";

/**
 * Finds the Git repository root directory starting from the given path
 * @param startPath - The path to start searching from (defaults to current working directory)
 * @returns The absolute path to the Git repository root, or null if not found
 */
export function findGitRoot(startPath: string = process.cwd()): string | null {
  let currentPath = resolve(startPath);

  while (true) {
    // Check if .git directory exists in current path
    const gitPath = join(currentPath, ".git");
    if (existsSync(gitPath)) {
      return currentPath;
    }

    // Move up one directory
    const parentPath = dirname(currentPath);

    // If we've reached the root directory (parent === current), stop
    if (parentPath === currentPath) {
      break;
    }

    currentPath = parentPath;
  }

  return null;
}

/**
 * Gets the relative path from the Git root to the current working directory
 * @param gitRoot - The Git repository root path
 * @param currentPath - The current working directory (defaults to process.cwd())
 * @returns The relative path from Git root to current directory
 */
export function getRelativePathFromGitRoot(
  gitRoot: string,
  currentPath: string = process.cwd()
): string {
  const relativePath = resolve(currentPath)
    .replace(resolve(gitRoot), "")
    .replace(/^\//, "");
  return relativePath || ".";
}

/**
 * Checks if the current directory is within a Git repository
 * @param startPath - The path to check (defaults to current working directory)
 * @returns True if within a Git repository, false otherwise
 */
export function isInGitRepository(startPath: string = process.cwd()): boolean {
  return findGitRoot(startPath) !== null;
}
