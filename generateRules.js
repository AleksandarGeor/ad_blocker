// ===== generateRules.js =====
// Updated safe version (prevents blocking YouTube playback domains)

const https = require('https');
const fs = require('fs');
const path = require('path');

const SOURCES = {
  EasyList: 'https://raw.githubusercontent.com/easylist/easylist/master/easylist/easylist_general_block.txt',
  AdGuard: 'https://raw.githubusercontent.com/AdguardTeam/AdguardFilters/master/BaseFilter/sections/adservers.txt',
  uBlock: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt'
};

const OUT_FILE = path.join(process.cwd(), 'rules.json');
const MAX_RULES = 30000;
const RETRIES = 3;

// --- Fetch text with retries ---
function fetchText(name, url) {
  return new Promise((resolve) => {
    const get = (attempt = 1) => {
      https.get(url, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchText(name, res.headers.location).then(resolve);
        }
        if (res.statusCode !== 200) {
          console.warn(`⚠️  ${name} returned HTTP ${res.statusCode} (attempt ${attempt})`);
          if (attempt < RETRIES) return get(attempt + 1);
          return resolve('');
        }
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => resolve(data));
      }).on('error', err => {
        console.warn(`⚠️  ${name} fetch failed: ${err.message}`);
        if (attempt < RETRIES) return get(attempt + 1);
        resolve('');
      });
    };
    get();
  });
}

// --- Extract valid blocking patterns ---
function extractPatterns(text) {
  const entries = new Set();
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const l = raw.trim();
    if (!l || l.startsWith('!') || l.startsWith('[')) continue;

    const match = l.match(/\|\|?([a-z0-9.-]+\.[a-z]{2,})/i) || l.match(/([a-z0-9.-]+\.[a-z]{2,})/i);
    if (match) {
      const domain = match[1].replace(/\^|\$/g, '');

      // ✅ Skip YouTube essential domains
      if (
        !domain.includes('youtube.com') &&
        !domain.includes('googlevideo.com') &&
        !domain.includes('ytimg.com') &&
        domain.length > 6 &&
        !domain.includes('*')
      ) {
        entries.add('*' + domain.toLowerCase() + '*');
      }
    }

    // ad-related URL path fragments
    if (/(\/ads?\/|adservice|doubleclick|googlesyndication|pagead|banner)/i.test(l)) {
      const frag = l.match(/\/[a-z0-9._-]*ads?[a-z0-9._-]*\//i);
      if (frag) entries.add('*' + frag[0] + '*');
    }
  }
  return entries;
}

// --- Main execution ---
(async () => {
  try {
    console.log('Fetching and combining filter lists...');
    const results = await Promise.all(
      Object.entries(SOURCES).map(async ([name, url]) => {
        const text = await fetchText(name, url);
        const patterns = extractPatterns(text);
        console.log(`✅ ${name}: ${patterns.size.toLocaleString()} patterns`);
        return patterns;
      })
    );

    const allPatterns = new Set();
    for (const set of results) for (const p of set) allPatterns.add(p);

    const selected = Array.from(allPatterns).slice(0, MAX_RULES);
    console.log(`\nTotal combined unique patterns: ${selected.length.toLocaleString()}`);

    const rules = selected.map((pattern, i) => ({
      id: i + 1,
      priority: 1,
      action: { type: 'block' },
      condition: {
        urlFilter: pattern,
        resourceTypes: [
          'main_frame',
          'sub_frame',
          'script',
          'image',
          'xmlhttprequest',
          'media',
          'other'
        ]
      }
    }));

    fs.writeFileSync(OUT_FILE, JSON.stringify(rules, null, 2));
    console.log(`\n✅ Wrote ${rules.length} rules to ${OUT_FILE}`);
  } catch (err) {
    console.error('❌ Error generating rules:', err);
  }
})();
