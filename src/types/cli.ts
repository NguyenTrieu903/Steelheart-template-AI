export interface CommentResult {
  file: string;
  commentsAdded?: number;
  success: boolean;
  error?: any;
  isNew?: boolean;
}

export interface GitInfo {
  currentBranch: string;
  hasChanges: boolean;
  modifiedFiles: string[];
  isGitRepo: boolean;
}

export interface BranchChanges {
  currentBranch: string;
  baseBranch: string;
  commits: any[];
  changedFiles: any[];
  newFiles: string[];
  modifiedFiles: string[];
  diffContent: string;
  totalInsertions: number;
  totalDeletions: number;
  totalChanges: number;
  includeUncommitted: boolean;
}

export interface FileChanges {
  filePath: string;
  diff: string;
  isNewFile: boolean;
  fullContent: string;
  hasChanges: boolean;
}

export interface ChangedLine {
  lineNumber: number;
  content: string;
  type: "added" | "removed";
}

export interface CodeAnalysisInsights {
  codePatterns: string[];
  functionsModified: string[];
  newFeatures: string[];
  bugFixes: string[];
  refactoring: string[];
  configChanges: string[];
  dependencies: string[];
}

export interface FileTypeAnalysis {
  codeFiles: number;
  configFiles: number;
  docFiles: number;
  testFiles: number;
}

export interface CommentGeneration {
  content: string;
  commentsAdded: number;
  preview: string;
}
