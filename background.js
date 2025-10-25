// ===== background.js =====
// Auto-updates ad-blocking rules daily from EasyList, AdGuard, and uBlock filters

const FILTER_SOURCES = {
  EasyList: 'https://raw.githubusercontent.com/easylist/easylist/master/easylist/easylist_general_block.txt',
  AdGuard: 'https://raw.githubusercontent.com/AdguardTeam/AdguardFilters/master/BaseFilter/sections/adservers.txt',
  uBlock: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt'
};

const MAX_RULES = 30000;
const UPDATE_INTERVAL_HOURS = 24;
const STORAGE_KEY = 'goodtube_rules_last_update';

// --- Fetch text helper --------------------------------------------------------
async function fetchText(name, url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      console.log(`[GoodTube] ${name} fetched (${text.length.toLocaleString()} chars)`);
      return text;
    } catch (err) {
      console.warn(`[GoodTube] ${name} fetch attempt ${attempt} failed:`, err.message);
      if (attempt === 3) return '';
      await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
}

// --- Extract patterns (same logic as generateRules.js) ------------------------
function extractPatterns(text) {
  const entries = new Set();
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const l = raw.trim();
    if (!l || l.startsWith('!') || l.startsWith('[')) continue;

    const match = l.match(/\|\|?([a-z0-9.-]+\.[a-z]{2,})/i) || l.match(/([a-z0-9.-]+\.[a-z]{2,})/i);
    if (match) {
      const domain = match[1].replace(/\^|\$/g, '');
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

    if (/(\/ads?\/|adservice|doubleclick|googlesyndication|pagead|banner)/i.test(l)) {
      const frag = l.match(/\/[a-z0-9._-]*ads?[a-z0-9._-]*\//i);
      if (frag) entries.add('*' + frag[0] + '*');
    }
  }
  return entries;
}

// --- Build & apply rules ------------------------------------------------------
async function buildAndApplyRules() {
  console.log('[GoodTube] Updating ad-block rules...');
  const results = await Promise.all(
    Object.entries(FILTER_SOURCES).map(async ([name, url]) => {
      const text = await fetchText(name, url);
      const set = extractPatterns(text);
      console.log(`[GoodTube] ${name}: ${set.size.toLocaleString()} patterns`);
      return set;
    })
  );

  const all = new Set();
  for (const s of results) for (const e of s) all.add(e);
  const patterns = Array.from(all).slice(0, MAX_RULES);
  console.log(`[GoodTube] Total unique: ${patterns.length.toLocaleString()}`);

  const rules = patterns.map((pattern, i) => ({
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

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: Array.from({ length: MAX_RULES }, (_, i) => i + 1),
      addRules: rules
    });
    console.log(`[GoodTube] ✅ Applied ${rules.length} blocking rules`);
    await chrome.storage.local.set({ [STORAGE_KEY]: Date.now() });
  } catch (err) {
    console.error('[GoodTube] ❌ Failed to apply rules:', err);
  }
}

// --- Periodic updater ---------------------------------------------------------
async function maybeUpdate() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const last = stored[STORAGE_KEY] || 0;
  const hoursSince = (Date.now() - last) / 3.6e6;
  if (hoursSince > UPDATE_INTERVAL_HOURS) {
    await buildAndApplyRules();
  } else {
    console.log(`[GoodTube] Rules updated ${hoursSince.toFixed(1)} h ago — skipping.`);
  }
}

// --- On startup ---------------------------------------------------------------
chrome.runtime.onStartup.addListener(maybeUpdate);
chrome.runtime.onInstalled.addListener(maybeUpdate);

// --- Manual update via popup or console message -------------------------------
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'GOODTUBE_FORCE_UPDATE') {
    buildAndApplyRules();
  }
});
