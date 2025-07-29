# GitHub Actions CI/CD Integration Guide

## Problem: Git History Issues in CI/CD

The error you encountered happens because GitHub Actions (and other CI/CD systems) often checkout repositories with limited git history, causing issues when trying to compare branches or access `HEAD~1`.

## Solution: Enhanced Git Detection

I've updated the `getBranchChanges` function to handle CI/CD environments better with:

### 1. **Smart Fallback Strategy**

- Detects limited git history
- Falls back to analyzing all files when git diff fails
- Provides meaningful analysis even without full git history

### 2. **CI/CD Environment Detection**

- Checks for commit count before using `HEAD~1`
- Handles fresh repositories gracefully
- Provides informative error messages

## GitHub Actions Setup

### Option 1: Full Git History (Recommended)

```yaml
name: AI Code Review
on: [push, pull_request]

jobs:
  code-review:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout with full history
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # This fetches full git history

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "18"

      - name: Install Steelheart AI
        run: npm install -g steelheart-ai

      - name: Configure API Key
        run: |
          echo '{"apiKey":"${{ secrets.OPENAI_API_KEY }}","outputDir":"./review-output","defaultModel":"gpt-4o-mini"}' > .steelheart.json

      - name: Run AI Code Review
        run: steelheart auto-review --output ./review-output

      - name: Upload Review Results
        uses: actions/upload-artifact@v4
        with:
          name: ai-code-review
          path: ./review-output/
```

### Option 2: Fallback Mode (Limited History)

```yaml
name: AI Code Review (Fallback)
on: [push, pull_request]

jobs:
  code-review:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout (default shallow)
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "18"

      - name: Install Steelheart AI
        run: npm install -g steelheart-ai

      - name: Configure API Key
        run: |
          echo '{"apiKey":"${{ secrets.OPENAI_API_KEY }}","outputDir":"./review-output","defaultModel":"gpt-4o-mini"}' > .steelheart.json

      - name: Run AI Code Review (Fallback Mode)
        run: steelheart auto-review --include-local --output ./review-output

      - name: Upload Review Results
        uses: actions/upload-artifact@v4
        with:
          name: ai-code-review-fallback
          path: ./review-output/
```

## Security Setup

### 1. **Add OpenAI API Key to GitHub Secrets**

1. Go to your GitHub repository
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `OPENAI_API_KEY`
5. Value: Your OpenAI API key (sk-proj-...)

### 2. **Protect Your API Key**

```yaml
# ❌ Never do this (exposes API key in logs)
- run: steelheart setup --api-key ${{ secrets.OPENAI_API_KEY }}

# ✅ Do this instead (secure config creation)
- run: |
    echo '{"apiKey":"${{ secrets.OPENAI_API_KEY }}","outputDir":"./review-output","defaultModel":"gpt-4o-mini"}' > .steelheart.json
```

## Advanced CI/CD Configurations

### Pull Request Comments

```yaml
- name: Run AI Code Review
  id: review
  run: steelheart auto-review --output ./review-output

- name: Comment PR with Review Results
  uses: actions/github-script@v7
  if: github.event_name == 'pull_request'
  with:
    script: |
      const fs = require('fs');
      const reviewFile = './review-output/branch-review-*.md';
      // Add logic to read review results and comment on PR
```

### Multi-Environment Support

```yaml
strategy:
  matrix:
    environment: [development, staging, production]
    include:
      - environment: development
        model: "gpt-4o-mini"
      - environment: staging
        model: "gpt-4o"
      - environment: production
        model: "gpt-4o"

steps:
  - name: Configure for Environment
    run: |
      echo '{"apiKey":"${{ secrets.OPENAI_API_KEY }}","outputDir":"./review-output","defaultModel":"${{ matrix.model }}"}' > .steelheart.json
```

## Troubleshooting CI/CD Issues

### Error: "unknown revision or path not in the working tree"

**Solution:** Use `fetch-depth: 0` in your checkout action

### Error: "API key not found"

**Solution:** Ensure your secret is correctly configured:

```yaml
- run: |
    echo '{"apiKey":"${{ secrets.OPENAI_API_KEY }}"}' > .steelheart.json
    steelheart auto-review
```

### Error: "No changes found to review"

**Solutions:**

- Use `--include-local` flag
- Ensure files have been committed
- Check that base branch exists

### Performance Optimization

```yaml
# Cache node_modules for faster builds
- name: Cache dependencies
  uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}

# Install Steelheart globally for reuse
- name: Install Steelheart AI
  run: npm install -g steelheart-ai
```

## Local Development vs CI/CD

### Local Development

```bash
# One-time setup
steelheart setup

# Regular usage
steelheart auto-review
steelheart docs
steelheart test
```

### CI/CD Environment

```bash
# Config via file (for automation)
echo '{"apiKey":"'$OPENAI_API_KEY'","outputDir":"./output"}' > .steelheart.json

# Run with appropriate flags
steelheart auto-review --include-local --output ./output
```

## Cost Management in CI/CD

### Smart Model Selection

```yaml
# Use cost-effective models for CI/CD
- run: |
    echo '{"apiKey":"${{ secrets.OPENAI_API_KEY }}","defaultModel":"gpt-4o-mini"}' > .steelheart.json
```

### Conditional Reviews

```yaml
# Only run on specific branches or conditions
on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]
```

This setup ensures your AI code review works reliably in GitHub Actions and other CI/CD environments while maintaining security and cost-effectiveness.
