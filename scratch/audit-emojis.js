import fs from 'fs';
import path from 'path';

const publicDir = './public';

// Regular expression to detect emojis
const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{1F191}-\u{1F251}]|[\u{1F004}]|[\u{1F0CF}]|[\u{1F170}-\u{1F171}]|[\u{1F17E}-\u{1F17F}]|[\u{1F18E}]|[\u{3030}]|[\u{2B50}]|[\u{2B55}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{2194}-\u{21A0}]|[\u{3297}]|[\u{3299}]|[\u{303D}]|[\u{2b50}]|[\u{2b55}]|[\u{2b06}]|[\u{2b07}]|[\u{2b05}]|[\u{2192}]|[\u{2934}]/gu;

function scanDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDirectory(fullPath);
    } else if (file.endsWith('.html') || file.endsWith('.js')) {
      auditFile(fullPath);
    }
  }
}

function auditFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    const matches = line.match(emojiRegex);
    if (matches) {
      console.log(`EMOJI FOUND in [${filePath}:${idx + 1}]: ${line.trim()} (Matches: ${matches.join(', ')})`);
    }
  });
}

console.log("Starting emoji audit in public/ directory...");
scanDirectory(publicDir);
console.log("Audit complete.");
