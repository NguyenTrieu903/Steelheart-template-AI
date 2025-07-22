# Steelheart AI - Usage Guide

## Installation & Setup

### Global Installation (Recommended)

```bash
# Install globally from npm
npm install -g steelheart-ai

# Setup your Gemini API key (one-time setup)
steelheart setup

# You're ready to go! Navigate to any project and run:
steelheart auto-review
```

### Local Installation (For library usage)

```bash
# In your existing project
npm install steelheart-ai

# Or as dev dependency
npm install --save-dev steelheart-ai
```

## Real-World Usage Examples

### Scenario 1: Developer working on a Node.js project

```bash
# You're working on your React/Next.js project
cd ~/my-react-app

# Install Steelheart AI globally (one time)
npm install -g steelheart-ai

# Setup API key (one time)
steelheart setup

# Now, every time you want to review your current branch:
steelheart auto-review

# Output will show:
# 🚀 Steelheart AI - AI-powered development toolkit
#
# 🤖 Auto-Review Mode
# 📂 Project Type: Node.js/JavaScript
# 🌿 Current Branch: feature/user-authentication
# 📝 Modified Files (4):
#    • src/components/LoginForm.tsx
#    • src/hooks/useAuth.ts
#    • src/pages/login.tsx
#    • tests/LoginForm.test.tsx
#
# 🤖 Smart Review Results:
# Branch: feature/user-authentication
# Project Type: Node.js/JavaScript
# Total Issues: 3
# Critical: 1
# Warnings: 2
# Suggestions: 5
# Report saved to: ./steelheart-output
#
# ⚠️  Critical issues found! Please review before pushing.
```

### Scenario 2: Code review for any project type

```bash
# Works with any project type
cd ~/my-python-api
steelheart auto-review

# Or traditional code review
steelheart review

# Generate documentation
steelheart docs

# Generate tests
steelheart gen-tests

# Complete analysis
steelheart analyze
```

### Scenario 3: CI/CD Integration

Add to your `.github/workflows/code-review.yml`:

```yaml
name: AI Code Review
on: [push, pull_request]

jobs:
  ai-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "18"

      - name: Install Steelheart AI
        run: npm install -g steelheart-ai

      - name: Run AI Code Review
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
        run: steelheart auto-review

      - name: Upload Reports
        uses: actions/upload-artifact@v3
        with:
          name: steelheart-reports
          path: steelheart-output/
```

### Scenario 4: Library Usage in Node.js

```typescript
// In your Node.js application
import { CodeReviewService, analyzeRepository } from "steelheart-ai";

async function reviewCurrentProject() {
  try {
    // Quick analysis of current directory
    const results = await analyzeRepository("./", {
      includeReview: true,
      includeDocs: false,
      includeTests: false,
    });

    console.log(`Found ${results.review.issues.length} issues`);

    // Or use individual services
    const reviewService = new CodeReviewService();
    const report = await reviewService.performCodeReview("./");

    // Process the results
    if (report.criticalIssues > 0) {
      console.error("Critical issues found!");
      process.exit(1);
    }

    return report;
  } catch (error) {
    console.error("Review failed:", error);
  }
}

reviewCurrentProject();
```

## Command Reference

### `steelheart auto-review` (Main Feature)

- **Purpose**: Smart review of current Git branch
- **Auto-detects**: Project type, current branch, modified files
- **Usage**: `steelheart auto-review [options]`
- **Options**:
  - `-o, --output <dir>`: Custom output directory
  - `--staged`: Review only staged changes
  - `--commits <number>`: Number of recent commits to review

### `steelheart review`

- **Purpose**: Traditional code review
- **Usage**: `steelheart review [path] [options]`
- **Options**:
  - `-o, --output <dir>`: Output directory
  - `-b, --branch <name>`: Specific branch
  - `-f, --format <type>`: Output format (json|markdown|html)

### `steelheart docs`

- **Purpose**: Generate documentation
- **Usage**: `steelheart docs [path] [options]`
- **Options**:
  - `-t, --type <type>`: Documentation type (api|user|developer)
  - `-f, --format <format>`: Output format (markdown|html|json)

### `steelheart gen-tests`

- **Purpose**: Generate test suites
- **Usage**: `steelheart gen-tests [path] [options]`
- **Options**:
  - `-f, --framework <name>`: Testing framework (jest|mocha|vitest)
  - `-t, --type <type>`: Test type (unit|integration|e2e)

### `steelheart analyze`

- **Purpose**: Complete project analysis
- **Usage**: `steelheart analyze [path] [options]`
- **Options**:
  - `--skip-review`: Skip code review
  - `--skip-docs`: Skip documentation
  - `--skip-tests`: Skip test generation

## Supported Project Types

- **Node.js/JavaScript**: React, Vue, Angular, Next.js, Express
- **TypeScript**: All JS frameworks with TS support
- **Python**: Django, Flask, FastAPI, standard Python projects
- **Go**: Standard Go projects with go.mod
- **Rust**: Cargo-based Rust projects
- **Java**: Maven and Gradle projects
- **PHP**: Laravel, Symfony, standard PHP
- **Ruby**: Rails applications
- **And more**: Auto-detection based on project files

## Configuration

### Environment Variables

```bash
# Required
export GEMINI_API_KEY="your_api_key_here"

# Optional
export GEMINI_MODEL="gemini-2.0-flash-exp"
export GEMINI_TEMPERATURE="0.7"
```

### Config File (`.steelheart.json`)

```json
{
  "apiKey": "your_api_key",
  "outputDir": "./steelheart-output",
  "defaultModel": "gemini-2.0-flash-exp"
}
```

## Getting API Key

1. Visit [Google AI Studio](https://aistudio.google.com/apikey)
2. Create a new API key
3. Run `steelheart setup` and enter your key

## Support

- **Issues**: [GitHub Issues](https://github.com/steelheart-ai/steelheart-ai/issues)
- **Documentation**: This guide covers most use cases
- **API Reference**: Check the TypeScript definitions in the package
