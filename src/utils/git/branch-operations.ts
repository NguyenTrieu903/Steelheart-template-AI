import simpleGit from "simple-git";
import { readFileSync } from "fs";
import { join } from "path";
import { BranchChanges, FileChanges, ChangedLine } from "../../types/cli";

export const getBranchChanges = async (
  repoPath: string,
  baseBranch: string = "main",
  includeUncommitted: boolean = false
): Promise<BranchChanges | null> => {
  try {
    const git = simpleGit(repoPath);
    const currentBranch = await git.revparse(["--abbrev-ref", "HEAD"]);

    // Enhanced CI/CD environment detection and handling
    let actualBaseBranch = baseBranch;
    let fallbackStrategy = false;

    // Try to find a valid base branch reference
    try {
      await git.revparse([`--verify`, `${baseBranch}`]);
    } catch {
      try {
        await git.revparse([`--verify`, `origin/${baseBranch}`]);
        actualBaseBranch = `origin/${baseBranch}`;
      } catch {
        try {
          await git.revparse([`--verify`, `origin/master`]);
          actualBaseBranch = `origin/master`;
        } catch {
          try {
            await git.revparse([`--verify`, `master`]);
            actualBaseBranch = `master`;
          } catch {
            // Check if we have at least one commit before using HEAD~1
            try {
              const log = await git.log({ maxCount: 2 });
              if (log.total >= 2) {
                actualBaseBranch = `HEAD~1`;
              } else {
                // Fallback for single commit or fresh repository
                console.log(
                  "⚠️  Repository has limited history. Using alternative analysis method."
                );
                fallbackStrategy = true;
              }
            } catch {
              fallbackStrategy = true;
            }
          }
        }
      }
    }

    // If we're on the base branch, compare with previous commit if available
    if (
      currentBranch.trim() === baseBranch ||
      currentBranch.trim() === actualBaseBranch.replace("origin/", "")
    ) {
      try {
        const log = await git.log({ maxCount: 2 });
        if (log.total >= 2) {
          actualBaseBranch = `HEAD~1`;
        } else {
          fallbackStrategy = true;
        }
      } catch {
        fallbackStrategy = true;
      }
    }

    let commits, diffSummary, diffContent;
    let newFiles: string[] = [];
    let modifiedFiles: string[] = [];

    if (fallbackStrategy) {
      // Fallback strategy for CI/CD or fresh repositories
      console.log(
        "🔄 Using fallback analysis for repository with limited history..."
      );

      // Get all files in working directory as "new" files for analysis
      const allFiles = await git
        .raw(["ls-files"])
        .then((output) =>
          output
            .trim()
            .split("\n")
            .filter((f) => f.trim())
        )
        .catch(() => []);

      // Check git status for any changes
      const status = await git.status();

      newFiles = allFiles.slice(0, 50); // Limit to first 50 files to avoid overwhelming analysis
      modifiedFiles = [...status.modified, ...status.staged].slice(0, 20);

      // Create mock diff summary for analysis
      diffSummary = {
        changed: newFiles.length + modifiedFiles.length,
        insertions: 0,
        deletions: 0,
        files: [
          ...newFiles.map((f) => ({
            file: f,
            insertions: 0,
            deletions: 0,
            binary: false,
            isNew: true,
          })),
          ...modifiedFiles.map((f) => ({
            file: f,
            insertions: 0,
            deletions: 0,
            binary: false,
            isNew: false,
          })),
        ],
      };

      commits = { all: [] }; // No commit comparison in fallback mode
      diffContent =
        "Fallback mode: Repository analysis without git diff comparison";
    } else {
      // Normal git diff analysis
      commits = await git.log([`${actualBaseBranch}..${currentBranch.trim()}`]);

      diffSummary = await git.diffSummary([
        `${actualBaseBranch}...${currentBranch.trim()}`,
      ]);

      newFiles = await git
        .raw([
          "diff",
          "--name-only",
          "--diff-filter=A",
          `${actualBaseBranch}...${currentBranch.trim()}`,
        ])
        .then((output) =>
          output
            .trim()
            .split("\n")
            .filter((f) => f)
        );

      modifiedFiles = diffSummary.files
        .map((f) => f.file)
        .filter((f) => !newFiles.includes(f));

      // Add isNew flag to file objects
      diffSummary.files = diffSummary.files.map((file) => ({
        ...file,
        isNew: newFiles.includes(file.file),
      }));

      diffContent = await git.diff([
        `${actualBaseBranch}...${currentBranch.trim()}`,
      ]);
    }

    if (includeUncommitted) {
      // Include working directory changes
      const status = await git.status();
      const committedDiff = await git.diffSummary([
        `${actualBaseBranch}...${currentBranch.trim()}`,
      ]);
      const workingDiff = await git.diffSummary();

      // Get committed new files
      const committedNewFiles = await git
        .raw([
          "diff",
          "--name-only",
          "--diff-filter=A",
          `${actualBaseBranch}...${currentBranch.trim()}`,
        ])
        .then((output) =>
          output
            .trim()
            .split("\n")
            .filter((f) => f)
        );

      const stagedAddedFiles = await git
        .raw(["diff", "--cached", "--name-status"])
        .then((output) => {
          return output
            .trim()
            .split("\n")
            .filter((line) => line.trim() && line.startsWith("A"))
            .map((line) => line.split("\t")[1])
            .filter((f) => f);
        })
        .catch(() => []);

      // Get untracked (unadded) files using git ls-files --others --exclude-standard
      const untrackedFiles = await git
        .raw(["ls-files", "--others", "--exclude-standard"])
        .then((output) =>
          output
            .trim()
            .split("\n")
            .filter((f) => f)
        )
        .catch(() => []);

      // Combine all new files: committed + staged + untracked
      newFiles = Array.from(
        new Set([...committedNewFiles, ...stagedAddedFiles, ...untrackedFiles])
      );

      // Modified files are from committed changes + working directory modified files (excluding new files)
      modifiedFiles = committedDiff.files
        .map((f) => f.file)
        .filter((f) => !newFiles.includes(f))
        .concat(status.modified.filter((f) => !newFiles.includes(f)));

      // Combine committed and working directory changes
      const allFiles = new Map();

      // Add committed changes
      committedDiff.files.forEach((file) => {
        allFiles.set(file.file, {
          file: file.file,
          insertions: (file as any).insertions || 0,
          deletions: (file as any).deletions || 0,
          binary: (file as any).binary || false,
          isNew: newFiles.includes(file.file),
        });
      });

      // Add/update with working directory changes
      workingDiff.files.forEach((file) => {
        const existing = allFiles.get(file.file) || {
          file: file.file,
          insertions: 0,
          deletions: 0,
          binary: false,
          isNew: newFiles.includes(file.file),
        };
        allFiles.set(file.file, {
          file: file.file,
          insertions: existing.insertions + ((file as any).insertions || 0),
          deletions: existing.deletions + ((file as any).deletions || 0),
          binary: existing.binary || (file as any).binary || false,
          isNew: existing.isNew || newFiles.includes(file.file),
        });
      });

      // Add staged added files to the files map (they might not be in workingDiff)
      stagedAddedFiles.forEach((file) => {
        if (!allFiles.has(file)) {
          allFiles.set(file, {
            file: file,
            insertions: 0, // We'll get this from git diff --cached
            deletions: 0,
            binary: false,
            isNew: true,
          });
        }
      });

      // Add untracked files to the files map
      untrackedFiles.forEach((file) => {
        if (!allFiles.has(file)) {
          allFiles.set(file, {
            file: file,
            insertions: 0, // We'll count lines for new files separately
            deletions: 0,
            binary: false,
            isNew: true,
          });
        }
      });

      diffSummary = {
        files: Array.from(allFiles.values()),
        insertions: committedDiff.insertions + workingDiff.insertions,
        deletions: committedDiff.deletions + workingDiff.deletions,
        changed: allFiles.size,
      };

      // Get diff content including working directory
      const committedDiffContent = await git.diff([
        `${actualBaseBranch}...${currentBranch.trim()}`,
      ]);
      const workingDiffContent = await git.diff();
      const stagedDiffContent = await git.diff(["--cached"]);

      diffContent =
        committedDiffContent +
        "\n\n--- Staged Changes ---\n" +
        stagedDiffContent +
        "\n\n--- Working Directory Changes ---\n" +
        workingDiffContent;
    } else {
      // Only committed changes
      diffSummary = await git.diffSummary([
        `${actualBaseBranch}...${currentBranch.trim()}`,
      ]);

      // Get new files
      newFiles = await git
        .raw([
          "diff",
          "--name-only",
          "--diff-filter=A",
          `${actualBaseBranch}...${currentBranch.trim()}`,
        ])
        .then((output) =>
          output
            .trim()
            .split("\n")
            .filter((f) => f)
        );

      modifiedFiles = diffSummary.files
        .map((f) => f.file)
        .filter((f) => !newFiles.includes(f));

      // Add isNew flag to file objects
      diffSummary.files = diffSummary.files.map((file) => ({
        ...file,
        isNew: newFiles.includes(file.file),
      }));

      diffContent = await git.diff([
        `${actualBaseBranch}...${currentBranch.trim()}`,
      ]);
    }

    return {
      currentBranch: currentBranch.trim(),
      baseBranch: actualBaseBranch,
      commits: [...commits.all],
      changedFiles: diffSummary.files,
      newFiles,
      modifiedFiles,
      diffContent,
      totalInsertions: diffSummary.insertions,
      totalDeletions: diffSummary.deletions,
      totalChanges: diffSummary.changed,
      includeUncommitted,
    };
  } catch (error) {
    console.warn("Could not get branch changes:", error);
    return null;
  }
};

export const getFileChanges = async (
  repoPath: string,
  filePath: string,
  baseBranch: string = "main"
): Promise<FileChanges | null> => {
  try {
    const git = simpleGit(repoPath);
    const currentBranch = await git.revparse(["--abbrev-ref", "HEAD"]);

    // Check if base branch exists, fallback to origin/main, origin/master, or HEAD~1
    let actualBaseBranch = baseBranch;
    try {
      await git.revparse([`--verify`, `${baseBranch}`]);
    } catch {
      // Try remote branches
      try {
        await git.revparse([`--verify`, `origin/${baseBranch}`]);
        actualBaseBranch = `origin/${baseBranch}`;
      } catch {
        try {
          await git.revparse([`--verify`, `origin/master`]);
          actualBaseBranch = `origin/master`;
        } catch {
          try {
            await git.revparse([`--verify`, `master`]);
            actualBaseBranch = `master`;
          } catch {
            // Fallback to comparing with HEAD~1 (previous commit)
            actualBaseBranch = `HEAD~1`;
          }
        }
      }
    }

    // If we're on the base branch, compare with HEAD~1
    if (
      currentBranch.trim() === baseBranch ||
      currentBranch.trim() === actualBaseBranch.replace("origin/", "")
    ) {
      actualBaseBranch = `HEAD~1`;
    }

    // Check if file is new
    const isNewFile = await git
      .raw([
        "diff",
        "--name-only",
        "--diff-filter=A",
        `${actualBaseBranch}...${currentBranch.trim()}`,
        "--",
        filePath,
      ])
      .then((output) => output.trim() !== "");

    // Get diff for specific file
    const diff = await git.diff([
      `${actualBaseBranch}...${currentBranch.trim()}`,
      "--",
      filePath,
    ]);

    // For new files, also get the full content
    let fullContent = "";
    if (isNewFile) {
      try {
        fullContent = readFileSync(join(repoPath, filePath), "utf8");
      } catch (error) {
        console.warn(`Could not read file content for ${filePath}:`, error);
      }
    }

    return {
      filePath,
      diff,
      isNewFile,
      fullContent,
      hasChanges: diff.trim() !== "",
    };
  } catch (error) {
    console.warn(`Could not get changes for ${filePath}:`, error);
    return null;
  }
};

export const getChangedLinesFromDiff = (diffContent: string): ChangedLine[] => {
  const lines = diffContent.split("\n");
  const changedLines: ChangedLine[] = [];
  let currentLineNumber = 0;

  for (const line of lines) {
    // Parse diff header to get line numbers
    const headerMatch = line.match(/^@@ -(\d+),?\d* \+(\d+),?\d* @@/);
    if (headerMatch) {
      currentLineNumber = parseInt(headerMatch[2]) - 1;
      continue;
    }

    // Skip file headers
    if (
      line.startsWith("+++") ||
      line.startsWith("---") ||
      line.startsWith("diff --git")
    ) {
      continue;
    }

    currentLineNumber++;

    if (line.startsWith("+") && !line.startsWith("+++")) {
      changedLines.push({
        lineNumber: currentLineNumber,
        content: line.substring(1),
        type: "added",
      });
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      changedLines.push({
        lineNumber: currentLineNumber - 1,
        content: line.substring(1),
        type: "removed",
      });
      currentLineNumber--; // Don't increment for removed lines
    }
  }

  return changedLines;
};
