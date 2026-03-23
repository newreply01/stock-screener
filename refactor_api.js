const fs = require('fs');
const filePath = '/home/xg/stock-screener/client/src/utils/api.js';
let code = fs.readFileSync(filePath, 'utf8');

// replace simple fetch
code = code.replace(/const res = await fetch\(`\$\{API_BASE\}\/(.*?)`\);\s*if \(!res\.ok\) throw new Error\('([^']+)'\);\s*return res\.json\(\);/gs, "return apiRequest(`\${API_BASE}/$1`);");

// replace simple authFetch
code = code.replace(/const res = await authFetch\(`\$\{API_BASE\}\/(.*?)`\);\s*if \(!res\.ok\) throw new Error\('([^']+)'\);\s*return res\.json\(\);/gs, "return apiRequest(`\${API_BASE}/$1`, {}, true);");

// fetch with params
code = code.replace(/const res = await fetch\(`\$\{API_BASE\}\/(.*?)`, \{(.*?)\}\);\s*if \(!res\.ok\) throw new Error\('([^']+)'\);\s*return res\.json\(\);/gs, "return apiRequest(`\${API_BASE}/$1`, {$2});");

// authFetch with params
code = code.replace(/const res = await authFetch\(`\$\{API_BASE\}\/(.*?)`, \{(.*?)\}\);\s*if \(!res\.ok\) throw new Error\('([^']+)'\);\s*return res\.json\(\);/gs, "return apiRequest(`\${API_BASE}/$1`, {$2}, true);");

fs.writeFileSync(filePath, code);
console.log('Done refactoring api.js');
