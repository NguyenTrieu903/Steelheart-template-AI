# Gemini AI Template

A comprehensive TypeScript template for integrating Google's Gemini AI into your development workflow. This template provides automated **code review**, **documentation generation**, and **test creation** capabilities powered by Gemini AI.

## Features

- 🔍 **Automated Code Review**: Analyze code for bugs, security issues, performance problems, and best practices
- 📖 **Documentation Generation**: Create comprehensive documentation including README, API docs, and usage guides
- 🧪 **Test Generation**: Generate unit tests and integration tests with proper test cases
- 🔧 **CLI Interface**: Easy-to-use command-line tools
- 📦 **Modular Design**: Use as a library or standalone CLI tool
- 🌐 **Multi-language Support**: Works with JavaScript, TypeScript, Python, Java, Go, Rust, and more

## Quick Start

### 1. Installation

```bash
# Clone the template
git clone <your-repo-url>
cd gemini-ai-template

# Install dependencies
npm install

# Set up your Gemini API key
npm run setup -- -k YOUR_GEMINI_API_KEY
```

### 2. Get Your API Key

1. Visit [Google AI Studio](https://aistudio.google.com/apikey)
2. Create a new API key
3. Configure it using the setup command:

```bash
npm run setup -- -k YOUR_API_KEY
```

### 3. Usage

#### CLI Usage

```bash
# Run code review
npm run review /path/to/your/repo

# Generate documentation
npm run docs /path/to/your/repo

# Generate tests
npm run test-gen /path/to/your/repo

# Run all operations
npx ts-node src/cli.ts all /path/to/your/repo
```

#### Programmatic Usage

```typescript
import { analyzeRepository, CodeReviewService } from "./src/index";

// Analyze entire repository
const results = await analyzeRepository("/path/to/repo", {
  outputPath: "./analysis-results",
  includeReview: true,
  includeDocs: true,
  includeTests: true,
});

// Or use individual services
const reviewService = new CodeReviewService();
const report = await reviewService.performCodeReview("/path/to/repo");
```

## Template Structure

```
gemini-ai-template/
├── src/
│   ├── services/           # Core AI services
│   │   ├── gemini-client.ts    # Gemini API client
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
│   └── gemini-config.json  # Configuration template
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
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-2.0-flash-exp
```

### Advanced Configuration

Customize behavior in `config/gemini-config.json`:

```json
{
  "model": "gemini-2.0-flash-exp",
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

Add to your GitHub Actions workflow:

```yaml
name: AI Code Analysis
on: [push, pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "18"

      - name: Run AI Analysis
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
        run: |
          npx gemini-ai-template all ./

      - name: Upload Reports
        uses: actions/upload-artifact@v3
        with:
          name: ai-analysis-reports
          path: output/
```

## Examples

### Code Review Example

```typescript
import { CodeReviewService } from "./src/services/code-review";

const service = new CodeReviewService();
const report = await service.performCodeReview("./my-project", "./reports");

console.log(`Found ${report.issues.length} issues:`);
console.log(`- Critical: ${report.criticalIssues}`);
console.log(`- Warnings: ${report.warningIssues}`);
console.log(`- Suggestions: ${report.suggestions.length}`);
```

### Documentation Example

```typescript
import { DocumentationService } from "./src/services/documentation";

const service = new DocumentationService();
const docs = await service.generateDocumentation("./my-project", "./docs");

console.log(`Generated ${docs.sections.length} documentation sections`);
```

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
- Gemini API key
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

MIT License. See [LICENSE](LICENSE) for details.

## Troubleshooting

### Common Issues

**API Key Not Found**

```bash
Error: GEMINI_API_KEY environment variable is required
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

Solution: Wait a few minutes or upgrade to a paid Gemini API plan

### Getting Help

- Check the [Issues](https://github.com/your-repo/issues) page
- Review the [Configuration](#configuration) section
- Verify your API key at [Google AI Studio](https://aistudio.google.com/apikey)

---

**Built with ❤️ using Google Gemini AI**
