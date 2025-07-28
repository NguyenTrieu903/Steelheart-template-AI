// Test file to verify configuration fix
import { getConfig, validateApiKey } from './src/utils/config/config-manager';

console.log('Testing configuration system...');

const config = getConfig();
console.log('Config found:', !!config.apiKey);
console.log('API Key length:', config.apiKey?.length || 0);
console.log('Default model:', config.defaultModel);
console.log('Output dir:', config.outputDir);

const isValid = validateApiKey();
console.log('API Key validation:', isValid ? 'PASS' : 'FAIL');
