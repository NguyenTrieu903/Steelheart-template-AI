# Steelheart AI

A comprehensive AI-powered development toolkit using OpenAI's GPT models. This package provides automated **code review**, **documentation generation**, and **test creation** capabilities that can be used as a CLI tool or integrated as a library in any project.

## 🚀 Quick Start

### Global Installation (Recommended for CLI usage)

```bash
# Install globally via npm
npm install -g steelheart-ai

# Setup your OpenAI API key
steelheart setup

# Auto-review your current project
cd /path/to/your/project
steelheart auto-review
```
See details [setup](OPENAI-SETUP.md)
### Local Installation (For library usage)

```bash
# Install as a dependency
npm install steelheart-ai

# Or install as dev dependency
npm install --save-dev steelheart-ai
```

## 💰 Cost-Effective AI Analysis

Optimized for developers with budget constraints:

- **Primary Model**: `gpt-4o-mini` (~$0.15 per 1M tokens)
- **Fallback Model**: `gpt-3.5-turbo` (~$0.50 per 1M tokens)
- **Your $5 Budget**: Handles 100-500 comprehensive analyses!
- **Smart Token Management**: Automatic optimization and cost tracking

## 📋 Features

- 🔍 **Smart Auto-Review**: Automatically analyze your current Git branch
- 📝 **AI Code Review**: Deep analysis for bugs, security, performance
- 📖 **Documentation Generation**: Auto-generate comprehensive docs
- 🧪 **Test Generation**: Create unit and integration tests
- 🌿 **Git Integration**: Branch-aware analysis and reporting
- 📦 **CLI & Library**: Use as command-line tool or integrate into your workflow
- 📋 **Branch Documentation**: Generate docs for specific branch changes
- 💬 **Auto-Comment**: Add AI-generated comments to your code

## 🎯 Usage Examples

### CLI Usage (After Global Installation)

```bash
# Quick auto-review of current project
steelheart auto-review

# Full code review
steelheart review

# Generate documentation for branch changes
steelheart branch-docs

# Auto-add comments to code
steelheart auto-comment

# Generate documentation
steelheart docs

# Generate tests
steelheart gen-tests

# Complete analysis (review + docs + tests)
steelheart analyze

# Show help
steelheart --help
```

### Library Usage (Programmatic)

```typescript
import {
  CodeReviewService,
  DocumentationService,
  TestingService,
  analyzeRepository,
} from "steelheart-ai";

// Auto-analyze entire repository
const results = await analyzeRepository("/path/to/project", {
  outputPath: "./analysis-results",
  includeReview: true,
  includeDocs: true,
  includeTests: true,
});

// Or use individual services
const reviewService = new CodeReviewService();
const report = await reviewService.performCodeReview("./");

console.log(`Found ${report.issues.length} issues`);
```

### Real-World Example

```bash
# Navigate to any existing project
cd ~/my-awesome-project

# Install Steelheart AI globally (one time setup)
npm install -g steelheart-ai

# Setup API key (one time setup)
steelheart setup

# Now use it in any project!
steelheart auto-review

# Output:
# 🚀 Steelheart AI - AI-powered development toolkit
#
# 🤖 Auto-Review Mode
# 🌿 Current Branch: feature/new-feature
# 📝 Modified Files (3):
#    • src/components/Button.tsx
#    • src/utils/helpers.ts
#    • tests/Button.test.tsx
#
# 🤖 Smart Review Results:
# Branch: feature/new-feature
# Total Issues: 2
# Critical: 0
# Warnings: 2
# Suggestions: 5
# Report saved to: ./steelheart-output
#
# 💡 Some improvements suggested. Consider reviewing.
```

### Advanced Features - Branch Documentation & Auto-Comments

```bash
# Navigate to any project with Git branches
cd ~/my-react-project

# Generate documentation for current branch changes
steelheart branch-docs

# Output:
# 🚀 Steelheart AI - AI-powered development toolkit
#
# 📋 Branch Documentation Generator
# 🌿 Current Branch: feature/authentication
# 🔗 Base Branch: main
# 📝 Changed Files: 6
# ➕ Insertions: 147
# ➖ Deletions: 23
#
# 📋 Branch Documentation Summary:
# Branch: feature/authentication
# Commits: 4
# Files changed: 6
# Documentation saved to: ./steelheart-output/branch-feature-authentication-docs.md

# Auto-add intelligent comments to your code
steelheart auto-comment --dry-run

# Output shows what comments would be added:
# 💬 Auto-Comment Generator
# 🌿 Current Branch: feature/authentication
# 📝 Files to process: 4
#
# 📝 Comments for src/components/LoginForm.tsx:
# Would add comments explaining authentication logic, form validation, and error handling
#
# 📝 Comments for src/hooks/useAuth.ts:
# Would add comments explaining custom hook logic, state management, and API calls
#
# 🔍 This was a dry run. Use without --dry-run to apply changes.

# Actually apply the comments (with backup)
steelheart auto-comment --backup

# Output:
# 💾 Backup saved: src/components/LoginForm.tsx.backup
# ✅ Comments added to: src/components/LoginForm.tsx
# 💾 Backup saved: src/hooks/useAuth.ts.backup
# ✅ Comments added to: src/hooks/useAuth.ts
#
# 💬 Auto-Comment Summary:
# Files processed: 4/4
# Comments added: 23
```

## Template Structure

```
gemini-ai-template/
├── src/
│   ├── services/           # Core AI services
│   │   ├── openai-client.ts    # OpenAI API client
│   │   ├── code-review.ts      # Code review service
│   │   ├── documentation.ts    # Documentation generation
│   │   └── testing.ts          # Test generation
│   ├── utils/              # Utility functions
│   │   └── repository-analyzer.ts
│   ├── types/              # TypeScript definitions
│   │   └── index.ts
│   ├── cli.ts              # Command-line interface
│   └── index.ts            # Main exports
├── config/
│   └── openai-config.json  # Configuration template
├── package.json
├── tsconfig.json
└── README.md
```

## Services Overview

### Code Review Service

Analyzes your codebase and provides:

- **Bug Detection**: Identifies potential bugs and logic errors
- **Security Analysis**: Spots security vulnerabilities
- **Performance Issues**: Finds performance bottlenecks
- **Code Quality**: Checks adherence to best practices
- **Suggestions**: Provides actionable improvement recommendations

**Output**: JSON and Markdown reports with categorized issues and suggestions.

### Documentation Service

Generates comprehensive documentation:

- **Project Overview**: Purpose and architecture description
- **Installation Guide**: Setup and dependency instructions
- **Usage Examples**: Code examples and tutorials
- **API Documentation**: Function and class documentation
- **Configuration**: Environment and config documentation

**Output**: README.md, full documentation.md, and structured JSON.

### Testing Service

Creates test suites:

- **Unit Tests**: Individual function and class tests
- **Integration Tests**: End-to-end workflow tests
- **Test Cases**: Multiple scenarios including edge cases
- **Framework Support**: Jest, Mocha, Vitest
- **Test Runner**: Automated test execution scripts

**Output**: Test files, configuration, and runner scripts.

## Configuration

### Environment Variables

Create a `.env` file in your project root:

```env
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-4o-mini
```

### Advanced Configuration

Customize behavior in `config/openai-config.json`:

```json
{
  "model": "gpt-4o-mini",
  "temperature": 0.7,
  "features": {
    "codeReview": {
      "severity": ["critical", "warning", "info"],
      "categories": ["bug", "security", "performance"]
    },
    "documentation": {
      "sections": ["overview", "installation", "usage", "api"],
      "generateReadme": true
    },
    "testing": {
      "frameworks": ["jest", "mocha", "vitest"],
      "types": ["unit", "integration"]
    }
  }
}
```

## Integration with Other Repositories

To use this template with any repository:

### Method 1: CLI Tool

```bash
# Navigate to any project
cd /path/to/your/project

# Run analysis
npx /path/to/gemini-ai-template/dist/cli.js all ./
```

### Method 2: NPM Package

```bash
# Install as a dependency
npm install /path/to/gemini-ai-template

# Use in your project
import { analyzeRepository } from 'gemini-ai-template';
```

### Method 3: CI/CD Integration
See at [**CI/CD Integration**](GITHUB-ACTIONS-GUIDE.md).

## Supported Technologies

The template automatically detects and works with:

- **JavaScript/TypeScript**: React, Vue, Angular, Node.js, Next.js
- **Python**: Django, Flask, FastAPI
- **Java**: Spring, Maven, Gradle
- **Go**: Standard library and popular frameworks
- **Rust**: Cargo projects
- **PHP**: Laravel, Symfony
- **Ruby**: Rails applications
- And many more...

## Requirements

- Node.js 18+
- TypeScript 5+
- OpenAI API key
- Git repository (for analysis)

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Add tests if applicable
5. Commit changes: `git commit -am 'Add feature'`
6. Push to branch: `git push origin feature-name`
7. Submit a pull request

## License

Steelheart team. 

## Troubleshooting

### Common Issues

**API Key Not Found**

```bash
Error: OPENAI_API_KEY environment variable is required
```

Solution: Run `npm run setup -- -k YOUR_API_KEY`

**Invalid Repository Path**

```bash
Error: Repository path does not exist
```

Solution: Ensure the path exists and contains a valid project

**Rate Limiting**

```bash
Error: Rate limit exceeded
```

Solution: Wait a few minutes or add credits to your OpenAI account

### Getting Help

- Check the [Issues](https://github.com/your-repo/issues) page
- Review the [Configuration](#configuration) section
- Verify your API key at [Google AI Studio](https://aistudio.google.com/apikey)

---

**Built with ❤️ using OpenAI GPT**
