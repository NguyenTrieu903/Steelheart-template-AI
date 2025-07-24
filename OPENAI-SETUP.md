# OpenAI Integration Setup Guide

## 🚀 Quick Start

Your Steelheart AI project has been successfully migrated from Gemini to OpenAI! This guide will help you get started.

## 🔑 API Key Setup

### 1. Get Your OpenAI API Key

1. Visit [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Sign in to your OpenAI account
3. Click "Create new secret key"
4. Copy the API key (starts with `sk-...`)

### 2. Configure Your Environment

Create a `.env` file in your project root:

```bash
# Required: Your OpenAI API key
OPENAI_API_KEY=sk-your-api-key-here

# Optional: Organization ID (if you have one)
OPENAI_ORG_ID=org-your-org-id

# Optional: Custom base URL (for Azure OpenAI, etc.)
OPENAI_BASE_URL=https://api.openai.com/v1

# Optional: Model preference
OPENAI_MODEL=gpt-4o-mini
```

### 3. Quick Setup Command

Run the interactive setup:

```bash
npm run setup
# or
steelheart setup
```

## 💰 Cost Management for $5 Budget

Your setup is optimized for cost efficiency:

### Default Model: `gpt-4o-mini`

- **Cost**: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- **Perfect for**: Code review, documentation, testing
- **Your $5 budget**: ~33M input tokens or 8M output tokens

### Fallback Model: `gpt-3.5-turbo`

- **Cost**: ~$0.50 per 1M input tokens, ~$1.50 per 1M output tokens
- **Good for**: Simple tasks when primary model fails

### Cost Estimation

- **Code review**: ~500-2000 tokens per file
- **Documentation**: ~1000-5000 tokens per generation
- **Test generation**: ~1000-3000 tokens per file

**Estimate**: Your $5 budget can handle 100-500 code reviews or documentation generations!

## 🛠 Usage

### Code Review

```bash
steelheart review
# or
npm run review
```

### Documentation Generation

```bash
steelheart docs
# or
npm run docs
```

### Test Generation

```bash
steelheart test
# or
npm run test-gen
```

### All Features

```bash
steelheart all
# or
npm run all
```

## ⚙️ Configuration

### Config File: `config/openai-config.json`

```json
{
  "apiKey": "${OPENAI_API_KEY}",
  "model": "gpt-4o-mini",
  "fallbackModel": "gpt-3.5-turbo",
  "temperature": 0.7,
  "maxTokens": 4000,
  "maxRetries": 3,
  "features": {
    "codeReview": { "enabled": true },
    "documentation": { "enabled": true },
    "testing": { "enabled": true }
  }
}
```

### Available Models

| Model           | Best For                 | Cost (per 1M tokens) |
| --------------- | ------------------------ | -------------------- |
| `gpt-4o-mini`   | Code review, docs, tests | $0.15 / $0.60        |
| `gpt-4o`        | Complex analysis         | $2.50 / $10.00       |
| `gpt-3.5-turbo` | Simple tasks             | $0.50 / $1.50        |

## 🎯 Features

### 1. Smart Code Review

- Bug detection and security analysis
- Performance recommendations
- Code style and best practices
- Architecture improvements

### 2. Documentation Generation

- README files with examples
- API documentation
- Installation guides
- Architecture overviews

### 3. Test Generation

- Unit tests with Jest/Mocha/Vitest
- Integration tests
- Edge case coverage
- Mocking and fixtures

## 🔧 Advanced Configuration

### Custom System Instructions

The OpenAI client includes optimized prompts for senior-level analysis:

- **Code Review**: 10+ years experience perspective
- **Documentation**: Technical writing expertise
- **Testing**: QA engineer best practices

### Token Management

- Automatic token estimation
- Request size validation
- Cost-aware processing
- Buffer management for responses

### Error Handling

- Exponential backoff retry logic
- Fallback model support
- Rate limit handling
- Network error recovery

## 📊 Monitoring Usage

### Check Token Usage

The client automatically estimates tokens and warns about large requests.

### Cost Tracking

Monitor your usage at: https://platform.openai.com/usage

## 🆘 Troubleshooting

### Common Issues

1. **API Key Not Working**

   ```bash
   # Check your environment
   echo $OPENAI_API_KEY
   ```

2. **Rate Limits**

   - The client automatically retries with exponential backoff
   - Consider upgrading your OpenAI plan if needed

3. **Token Limits**

   - Large files are automatically chunked
   - Adjust `maxTokens` in config if needed

4. **Network Issues**
   - Automatic retry with backoff
   - Check your internet connection

### Getting Help

1. Check the console output for detailed error messages
2. Verify your API key is valid and has credits
3. Ensure your OpenAI account has API access

## 🎉 Migration Complete!

Your project is now powered by OpenAI instead of Gemini/Claude. The interface remains the same, but you now have:

- ✅ Cost-effective `gpt-4o-mini` model
- ✅ Fallback to `gpt-3.5-turbo`
- ✅ Senior-level analysis prompts
- ✅ Smart token management
- ✅ Robust error handling

Happy coding! 🚀
