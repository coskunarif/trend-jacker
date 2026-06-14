import fs from 'node:fs';
import { GoogleGenerativeAI } from '@google/generative-ai';

function getApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  if (process.env.GOOGLE_PROFITHELM_FREE_KEY) return process.env.GOOGLE_PROFITHELM_FREE_KEY;

  try {
    const envPath = '/home/ubuntuadmin/projects/api-keys.env';
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/GOOGLE_PROFITHELM_FREE_KEY=([^\s]+)/);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  } catch (err) {
    console.error('Error reading api-keys.env:', err);
  }
  return null;
}

const apiKey = getApiKey();
if (!apiKey) {
  console.error('No API key found');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function testModel(modelName) {
  try {
    console.log(`Testing model: ${modelName}...`);
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent("Say hello in one word");
    console.log(`Success with ${modelName}:`, result.response.text().trim());
    return true;
  } catch (err) {
    console.log(`Failed with ${modelName}:`, err.message);
    return false;
  }
}

async function main() {
  const models = ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-3.1-flash', 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-pro'];
  for (const m of models) {
    const ok = await testModel(m);
    if (ok) {
      console.log(`=== Recommended Model: ${m} ===`);
    }
  }
}

main();
