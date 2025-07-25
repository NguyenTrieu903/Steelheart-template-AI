# Changelog

## [2.0.8] - 2025-07-25

### ✨ New Features

- **Enhanced Test Generation**: Complete rewrite of testing service to analyze actual Git branch changes
- **Smart File Detection**: Tests are now generated only for files that have been modified or added in the current branch
- **Output Path Support**: Tests can be written to a specified output directory or placed next to source files
- **Intelligent Test Placement**: Automatically detects **tests** directories or creates tests alongside source files
- **Branch-based Analysis**: Uses same Git logic as branch-docs and auto-review for consistent file detection

### 🔧 Improvements

- **Better Error Handling**: Improved error messages and graceful failure handling
- **File Type Detection**: Supports JavaScript, TypeScript, JSX, and TSX files
- **Test Merging**: Appends new tests to existing test files when appropriate
- **Comprehensive Prompts**: AI prompts now include actual file content and Git diffs for accurate test generation

### 📝 Technical Changes

- Updated `TestingService.generateTests()` to accept `baseBranch` parameter
- Added `getBranchChanges()` method for Git analysis
- Enhanced test file path resolution and directory creation
- Improved TypeScript type safety throughout the testing service

## [2.0.8] - 2025-07-24

### 🚀 Major Improvements

- **Enhanced Auto-Comment Logic**: Updated auto-comment to use the same branch detection logic as branch-docs
- **Consistent File Detection**: All commands now use unified `getBranchChanges` approach for detecting files
- **Better New File Handling**: Auto-comment now properly handles new files like branch-docs does
- **Improved Branch Context**: Auto-comment now has full branch context for better diff detection

### 🔧 Technical Changes

- **Unified Branch Analysis**: Auto-comment now uses `getBranchChanges` for consistent file detection
- **Enhanced Diff Logic**: Better handling of new files vs modified files in auto-comment
- **Improved Error Handling**: Better fallback when branch changes cannot be detected
- **TypeScript Fixes**: Fixed all implicit any type errors

## [2.0.8] - 2025-07-24

### 🐛 Bug Fixes

- **Import Error Fix**: Fixed `existsSync is not a function` error in CodeReviewService
- **Enhanced File Detection**: Improved file path resolution for auto-review and auto-comment commands
- **Consistent Git Detection**: Updated all commands to use unified branch change detection logic

### 🔧 Improvements

- **Better Error Handling**: More descriptive error messages for file detection issues
- **Import Cleanup**: Fixed incorrect module imports in service files

## [2.0.8] - 2025-07-24

### 🚀 Major Changes

- **BREAKING CHANGE**: Migrated from Google Gemini AI to OpenAI
- **BREAKING CHANGE**: Environment variable changed from `GEMINI_API_KEY` to `OPENAI_API_KEY`
- **BREAKING CHANGE**: Configuration file changed from `gemini-config.json` to `openai-config.json`

### ✨ New Features

- **OpenAI Integration**: Full support for OpenAI's GPT models
- **Cost Optimization**: Default to `gpt-4o-mini` for maximum cost efficiency
- **Smart Token Management**: Automatic token estimation and request validation
- **Enhanced Error Handling**: Robust retry logic with exponential backoff
- **Fallback Model Support**: Automatic fallback to `gpt-3.5-turbo` when needed
- **Senior-Level Analysis**: Prompts optimized for 10+ years experience perspective

### 💰 Budget-Friendly

- **Cost-Effective**: Optimized for $5 budget with `gpt-4o-mini`
- **Token Estimation**: Built-in cost tracking and budget awareness
- **Efficient Processing**: Smart request optimization to minimize token usage

### 🔧 Technical Improvements

- **Better Reliability**: More stable API connections and error recovery
- **Improved Performance**: Faster response times and better resource management
- **Enhanced Security**: Better API key handling and validation

### 📚 Documentation

- **New Setup Guide**: Comprehensive `OPENAI-SETUP.md`
- **Migration Guide**: Complete `MIGRATION-COMPLETE.md`
- **Updated README**: OpenAI-focused documentation with cost guidance

### 🗑️ Removed

- Google Generative AI dependency
- Gemini-specific configuration files
- Claude client dependencies (unused)

### 🔄 Migration Guide

For users upgrading from v1.x:

1. Get OpenAI API key from https://platform.openai.com/api-keys
2. Replace `GEMINI_API_KEY` with `OPENAI_API_KEY` in your environment
3. Update configuration file from `gemini-config.json` to `openai-config.json`
4. Run `steelheart setup` to configure

### 📦 Dependencies

- **Added**: `openai@^4.104.0`
- **Removed**: `@google/generative-ai`

---

## [1.3.3] - Previous Version

Previous version with Gemini AI support.
