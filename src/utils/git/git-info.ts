import simpleGit from "simple-git";
import { GitInfo } from "../../types/cli";

export const getGitInfo = async (repoPath: string): Promise<GitInfo> => {
  try {
    const git = simpleGit(repoPath);
    const branch = await git.revparse(["--abbrev-ref", "HEAD"]);
    const status = await git.status();
    const isGitRepo = await git.checkIsRepo();

    return {
      currentBranch: branch.trim(),
      hasChanges: !status.isClean(),
      modifiedFiles: status.modified,
      isGitRepo,
    };
  } catch (error) {
    return {
      currentBranch: "unknown",
      hasChanges: false,
      modifiedFiles: [],
      isGitRepo: false,
    };
  }
};
