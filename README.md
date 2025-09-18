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

- 🔍 **Smart Auto-Review**: Automatically analyze your current Git branch changes
- 📝 **AI Code Review**: Deep analysis for bugs, security, and performance
- 📖 **Documentation Generation**: Auto-generate comprehensive project docs
- 🧪 **Test Generation**: Create unit, integration, and e2e tests with framework setup
- 🌿 **Git Integration**: Branch-aware analysis and reporting
- 📦 **CLI & Library**: Use as command-line tool or integrate into your workflow
- 📋 **Branch Documentation**: Generate docs specifically for branch changes
- ⚙️ **Configuration Management**: Easy setup and configuration management
- 🔧 **Project Analysis**: Comprehensive project structure and complexity analysis

## 🎯 Usage Examples

### CLI Usage (After Global Installation)

```bash
# Setup your API key and configuration
steelheart setup

# Quick auto-review of current project changes
steelheart auto-review


# Generate documentation for branch changes
steelheart branch-docs

# Generate tests for your project
steelheart gen-tests

# Complete project analysis (structure and complexity)
steelheart analyze

# Manage configuration
steelheart config --show

# Show help
steelheart --help
# Or use the shorter alias:
st --help
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

### Advanced Features - Branch Documentation

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

# Generate tests for your project
steelheart gen-tests

# Output:
# 🧪 AI Test Generator
# 📁 Project Path: ~/my-react-project
# � Framework: jest (auto-detected)
# 📝 Files to test: 12
#
# ✅ Test generation complete!
# Tests saved to: ./tests/
# Coverage setup: included
```

## Services Overview

### Code Review Service

Analyzes your codebase and provides:

- **Branch-Aware Analysis**: Intelligent review of changed files and git diffs
- **Bug Detection**: Identifies potential bugs and logic errors
- **Security Analysis**: Spots security vulnerabilities
- **Performance Issues**: Finds performance bottlenecks
- **Code Quality**: Checks adherence to best practices
- **Auto-Commenting**: Optional intelligent code commenting for enhanced readability
- **Decision Making**: PASS/FAIL recommendations with categorized issues

**Output**: Structured JSON reports and markdown summaries with categorized issues.

### Documentation Service

Generates comprehensive documentation:

- **Project Overview**: Purpose and architecture description
- **Installation Guide**: Setup and dependency instructions
- **Usage Examples**: Code examples and tutorials
- **API Documentation**: Function and class documentation
- **Branch Documentation**: Generate docs specifically for branch changes
- **Multiple Formats**: Supports markdown

**Output**: README.md, documentation.md, and structured project documentation.

### Testing Service

Creates comprehensive test suites:

- **Unit Tests**: Individual function and class tests
- **Test Infrastructure Setup**: Automatically configures testing frameworks
- **Framework Support**: Jest
- **Coverage Reports**: Generates test coverage analysis

**Output**: Complete test files, framework configuration, and coverage setup.

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
steelheart analyze
```

### Method 2: NPM Package

```bash
# Install as a dependency
npm install steelheart-ai

# Use in your project
import { analyzeRepository } from 'steelheart-ai';
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

Solution: Run `steelheart setup` and enter your API key

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
- Verify your API key at [OpenAI API Keys](https://platform.openai.com/api-keys)

---

**Built with ❤️ using OpenAI GPT**
