#!/usr/bin/env node

/**
 * Fixes unescaped backticks inside template literal content fields.
 *
 * Blog post content uses JS template literals (backticks). If AI-generated
 * markdown contains backtick characters (code fences, inline code), they
 * prematurely close the template literal and break the build.
 *
 * This script finds all `content: \`` template literals and escapes any
 * interior backticks. Run this BEFORE the build step in CI.
 *
 * Usage:
 *   node scripts/fix-blog-backticks.js [file-path]
 *
 * If no file path is provided, it defaults to src/data/blogPosts.ts
 * relative to the current working directory.
 */

const fs = require('fs');
const path = require('path');

const filePath = process.argv[2]
  || path.join(process.cwd(), 'src', 'data', 'blogPosts.ts');

if (!fs.existsSync(filePath)) {
  console.log(`File not found: ${filePath} — nothing to fix.`);
  process.exit(0);
}

const source = fs.readFileSync(filePath, 'utf8');

// Walk through the file character by character, tracking whether we're
// inside a content template literal. When we are, escape any backticks
// that aren't the closing one.

let result = '';
let i = 0;
let fixes = 0;

while (i < source.length) {
  // Look for `content: \`` pattern
  const contentMatch = source.substring(i).match(/^content:\s*`/);
  if (contentMatch) {
    // Write the "content: `" part as-is
    result += contentMatch[0];
    i += contentMatch[0].length;

    // Now we're inside the template literal. Find the matching closing backtick.
    let contentStr = '';

    while (i < source.length) {
      const ch = source[i];

      if (ch === '\\') {
        // Already escaped character — pass through both chars
        contentStr += ch + source[i + 1];
        i += 2;
        continue;
      }

      if (ch === '`') {
        // Check if this is the closing backtick by looking at what follows
        const after = source.substring(i + 1).trimStart();
        if (after.startsWith(',') || after.startsWith('}')) {
          // This is the real closing backtick
          result += contentStr + '`';
          i += 1;
          break;
        } else {
          // Stray backtick inside content — escape it
          contentStr += '\\`';
          fixes++;
          i += 1;
          continue;
        }
      }

      if (ch === '$' && source[i + 1] === '{') {
        // Escape template expression
        contentStr += '\\${';
        fixes++;
        i += 2;
        continue;
      }

      contentStr += ch;
      i += 1;
    }
  } else {
    result += source[i];
    i += 1;
  }
}

if (fixes > 0) {
  fs.writeFileSync(filePath, result, 'utf8');
  console.log(`Fixed ${fixes} unescaped backtick(s) or \${} expression(s) in ${filePath}`);
} else {
  console.log('No backtick issues found.');
}
