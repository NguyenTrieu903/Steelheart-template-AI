export interface ReviewReport {
  repositoryUrl: string;
  issues: Array<Issue>;
  suggestions: Array<Suggestion>;
  overallAssessment: string;
  summary: string;
  filesAnalyzed: number;
  criticalIssues: number;
  warningIssues: number;
  infoIssues: number;
  commentResults?: CommentResult[];
}

export interface CommentResult {
  file: string;
  commentsAdded?: number;
  success: boolean;
  error?: any;
  isNew?: boolean;
}

export interface Issue {
  file: string;
  line: number;
  column?: number;
  severity: "critical" | "warning" | "info";
  category: "bug" | "security" | "performance" | "style" | "maintainability";
  description: string;
  suggestion?: string;
  rule?: string;
}

export interface Suggestion {
  type: "improvement" | "refactoring" | "optimization";
  description: string;
  file?: string;
  impact: "high" | "medium" | "low";
}

export interface Documentation {
  repositoryUrl: string;
  content: string;
  sections: Array<DocumentationSection>;
  generatedAt: Date;
}

export interface DocumentationSection {
  title: string;
  content: string;
  type:
    | "overview"
    | "installation"
    | "usage"
    | "api"
    | "examples"
    | "configuration";
}

export interface TestConfig {
  repositoryUrl: string;
  unitTests: Array<UnitTest>;
  integrationTests: Array<IntegrationTest>;
  coverage?: CoverageInfo;
  testFramework: string;
}

export interface UnitTest {
  description: string;
  filePath: string;
  targetFunction: string;
  code: string;
  testCases: Array<TestCase>;
}

export interface IntegrationTest {
  description: string;
  filePath: string;
  setup: string;
  execution: string;
  teardown?: string;
  dependencies: string[];
}

export interface TestCase {
  name: string;
  input: any;
  expectedOutput: any;
  description: string;
}

export interface CoverageInfo {
  percentage: number;
  uncoveredLines: Array<{
    file: string;
    lines: number[];
  }>;
}

export interface RepositoryAnalysis {
  structure: FileStructure;
  technologies: Array<Technology>;
  dependencies: Array<Dependency>;
  metrics: CodeMetrics;
}

export interface FileStructure {
  totalFiles: number;
  directories: string[];
  fileTypes: { [extension: string]: number };
  mainFiles: string[];
}

export interface Technology {
  name: string;
  version?: string;
  confidence: number;
  files: string[];
}

export interface Dependency {
  name: string;
  version: string;
  type: "production" | "development" | "peer";
  vulnerabilities?: Array<{
    severity: string;
    description: string;
  }>;
}

export interface CodeMetrics {
  linesOfCode: number;
  complexity: number;
  duplicateCodePercentage: number;
  technicalDebt: {
    hours: number;
    rating: "A" | "B" | "C" | "D" | "E";
  };
}

export interface GeminiServiceConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  topP?: number;
  outputPath?: string;
}
