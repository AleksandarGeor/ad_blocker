// ===== GoodTube — Safe Opera Version (No Loop, No Playback Error) =====
(() => {
  'use strict';
  if (window.goodtubeLoaded) return;
  window.goodtubeLoaded = true;
  console.log('[GoodTube] Lightweight adblock active');

  // --- Hide ad-related DOM elements instantly ---
  const adBlockCSS = `
    ytd-display-ad-renderer,
    ytd-ad-slot-renderer,
    ytd-player-legacy-desktop-watch-ads-renderer,
    .ytp-ad-module,
    .ytp-ad-overlay-slot,
    .ytp-ad-player-overlay,
    .ytp-ad-text-overlay,
    #player-ads,
    #masthead-ad,
    .ytd-promoted-sparkles-text-search-renderer,
    .ytd-companion-slot-renderer,
    ytd-promoted-video-renderer,
    ytd-promoted-sparkles-web-renderer,
    ytd-rich-item-renderer:has(ytd-promoted-sparkles-web-renderer),
    ytd-rich-section-renderer:has(ytd-promoted-sparkles-web-renderer),
    ytd-action-companion-ad-renderer,
    #ad_creative_3,
    #ad_creative_4 {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
    }
  `;
  const style = document.createElement('style');
  style.textContent = adBlockCSS;
  document.documentElement.appendChild(style);

  // --- Hide Shorts from feeds ---
  function hideShorts() {
    document.querySelectorAll('a[href*="/shorts/"]').forEach(a => {
      const item = a.closest('ytd-rich-grid-media, ytd-video-renderer, ytd-compact-video-renderer');
      if (item) item.style.setProperty('display', 'none', 'important');
    });
  }

  // --- Skip skippable ads safely ---
  function skipAds() {
    const skipButton = document.querySelector('.ytp-ad-skip-button, .ytp-ad-overlay-close-button');
    if (skipButton) {
      console.log('[GoodTube] Skipping ad');
      skipButton.click();
    }
  }

  // --- Remove ad containers dynamically ---
  const adSelectors = [
    'ytd-display-ad-renderer',
    '.ytp-ad-module',
    '.ytp-ad-player-overlay',
    '.ytp-ad-overlay-slot',
    '.ytp-ad-text-overlay',
    '.video-ads',
    'ytd-promoted-video-renderer'
  ];

  function removeAdElements() {
    adSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => el.remove());
    });
  }

  // --- Observe DOM for new ad elements ---
  const observer = new MutationObserver(() => {
    removeAdElements();
    hideShorts();
    skipAds();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // --- Anti-freeze helper ---
  setInterval(() => {
    const video = document.querySelector('video');
    const adShowing = document.querySelector('.ad-showing');
    if (video && adShowing) {
      video.muted = true;
      try {
        video.currentTime = video.duration || video.currentTime + 9999;
      } catch {}
    }
  }, 1000);

  // --- YouTube SPA reload support ---
  window.addEventListener('yt-navigate-finish', () => {
    console.log('[GoodTube] Page changed — reapplying cleanup');
    removeAdElements();
    hideShorts();
  });

  console.log('[GoodTube] Running clean mode — no fetch/XHR interference.');
})();
