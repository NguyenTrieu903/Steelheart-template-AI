# 🚀 Steelheart AI v1.2.0 - Complete Usage Guide

## What's New in v1.2.0

✨ **New Features:**

- 📋 **Branch Documentation**: Generate docs for specific Git branch changes
- 💬 **Auto-Comment**: Add AI-generated comments to your code
- 🔍 **Enhanced Git Integration**: Better branch detection and diff analysis

## Installation & Quick Start

```bash
# Install globally (recommended)
npm install -g steelheart-ai@1.2.0

# Setup API key (one-time)
steelheart setup

# You're ready to go!
```

## Complete Command Reference

### 1. Smart Auto-Review (Main Feature)

```bash
# Auto-review current project in any directory
cd ~/my-project
steelheart auto-review

# Review with custom output directory
steelheart auto-review -o ./reports
```

### 2. Branch Documentation (NEW!)

```bash
# Generate documentation for current branch changes
steelheart branch-docs

# Compare against specific base branch
steelheart branch-docs -b develop

# Custom output format and location
steelheart branch-docs -o ./docs -f markdown
```

### 3. Auto-Comment Code (NEW!)

```bash
# Preview what comments would be added (safe)
steelheart auto-comment --dry-run

# Auto-comment all changed files with backup
steelheart auto-comment --backup

# Comment specific files only
steelheart auto-comment src/utils/helpers.ts src/components/Button.tsx

# Compare against specific branch
steelheart auto-comment -b main --dry-run
```

### 4. Traditional Commands

```bash
# Full code review
steelheart review

# Generate project documentation
steelheart docs

# Generate tests
steelheart gen-tests

# Complete analysis (all features)
steelheart analyze
```

## Real-World Workflow Examples

### Example 1: Feature Branch Workflow

```bash
# You're working on a feature branch
git checkout -b feature/user-dashboard
# ... make changes ...
git add .
git commit -m "Add user dashboard components"

# Quick review before pushing
steelheart auto-review

# Generate documentation for this branch
steelheart branch-docs

# Add helpful comments to code
steelheart auto-comment --backup

# Push with confidence!
git push origin feature/user-dashboard
```

### Example 2: Code Review Process

```bash
# Reviewer checking a pull request
git checkout feature/authentication

# Understand what changed
steelheart branch-docs -b main

# Review the implementation
steelheart auto-review

# Check if code needs better comments
steelheart auto-comment --dry-run
```

### Example 3: Legacy Code Documentation

```bash
# Working with legacy code
cd ~/legacy-project

# Add comprehensive comments
steelheart auto-comment --backup --dry-run

# Review what would be added, then apply
steelheart auto-comment --backup

# Generate project documentation
steelheart docs
```

## Integration Examples

### GitHub Actions Workflow

```yaml
name: AI Code Analysis
on: [push, pull_request]

jobs:
  ai-analysis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0 # Important for branch comparisons

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "18"

      - name: Install Steelheart AI
        run: npm install -g steelheart-ai@1.2.0

      - name: Auto-Review Changes
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
        run: steelheart auto-review

      - name: Generate Branch Documentation
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
        run: steelheart branch-docs -b main

      - name: Upload Reports
        uses: actions/upload-artifact@v3
        with:
          name: ai-analysis-reports
          path: steelheart-output/
```

### Package.json Scripts

```json
{
  "scripts": {
    "review": "steelheart auto-review",
    "docs:branch": "steelheart branch-docs",
    "comment:check": "steelheart auto-comment --dry-run",
    "comment:apply": "steelheart auto-comment --backup",
    "ai:full": "steelheart analyze"
  }
}
```

### Pre-commit Hook

```bash
#!/bin/sh
# .git/hooks/pre-commit

echo "🤖 Running AI code review..."
steelheart auto-review

if [ $? -ne 0 ]; then
    echo "❌ AI review found critical issues. Please review before committing."
    exit 1
fi

echo "✅ AI review passed!"
```

## Supported Project Types

- **JavaScript/TypeScript**: React, Vue, Angular, Next.js, Node.js, Express
- **Python**: Django, Flask, FastAPI, standard Python projects
- **Go**: All Go projects with go.mod
- **Rust**: Cargo-based Rust projects
- **Java**: Maven and Gradle projects
- **PHP**: Laravel, Symfony, standard PHP
- **Ruby**: Rails applications
- **C/C++**: Standard C/C++ projects
- **And more**: Auto-detection based on project files

## API Key Setup

1. Visit [Google AI Studio](https://aistudio.google.com/apikey)
2. Create a new API key
3. Run `steelheart setup` and enter your key
4. Or set environment variable: `export GEMINI_API_KEY="your_key_here"`

## Output Examples

### Branch Documentation Output

```markdown
# Branch Documentation: feature/user-authentication

## Summary of Changes

This branch implements comprehensive user authentication...

## Files Modified

- src/components/LoginForm.tsx (+45 -0): New login form component
- src/hooks/useAuth.ts (+38 -0): Authentication state management
- src/services/authAPI.ts (+67 -0): Authentication API service

## Breaking Changes

⚠️ Protected routes now require authentication

## Testing Recommendations

1. Test registration with valid/invalid emails
2. Verify session persistence
3. Check logout functionality
```

### Auto-Comment Output

```typescript
// Before:
const handleLogin = async (email, password) => {
  const response = await api.post("/auth/login", { email, password });
  return response.data;
};

// After:
/**
 * Authenticate user with email and password
 * @param {string} email - User's email address
 * @param {string} password - User's password
 * @returns {Promise<AuthResponse>} Authentication response with user data and token
 */
const handleLogin = async (email, password) => {
  // Send authentication request to backend API
  const response = await api.post("/auth/login", { email, password });

  // Return authentication data (user info + JWT token)
  return response.data;
};
```

## Troubleshooting

### Common Issues

**No Git repository**

```bash
Error: Not a Git repository!
```

Solution: Run commands in a Git repository or initialize one with `git init`

**No API key**

```bash
❌ Gemini API key not found!
```

Solution: Run `steelheart setup` or set `GEMINI_API_KEY` environment variable

**No branch changes**

```bash
No changes found between main and current-branch
```

Solution: Make sure you have commits on your feature branch, or specify different base branch with `-b`

### Getting Help

- 📧 **Issues**: [GitHub Issues](https://github.com/steelheart-ai/steelheart-ai/issues)
- 📖 **Documentation**: This guide and `steelheart --help`
- 🔑 **API Key**: [Google AI Studio](https://aistudio.google.com/apikey)

## Contributing

Found a bug or have a feature request? We'd love to hear from you!

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with `steelheart auto-review`
5. Submit a pull request

---

**Made with ❤️ using Google Gemini AI**

_Steelheart AI v1.2.0 - Making code review and documentation intelligent and effortless._
