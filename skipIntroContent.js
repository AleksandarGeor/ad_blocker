// ===== skipIntroContent.js (FINAL Opera fix) =====
(() => {
  'use strict';
  if (window.goodtubeSkipOnce) return;
  window.goodtubeSkipOnce = true;

  let skipEnabled = true;
  const SKIP_URL = 'https://sponsor.ajay.app/api/skipSegments';

  window.addEventListener('message', e => {
    if (e.source !== window || !e.data) return;
    if (e.data.type === 'GOODTUBE_SKIP_TOGGLE') {
      skipEnabled = !!e.data.enabled;
      console.log('[GoodTube] Skip toggle updated:', skipEnabled);
    }
  }, { once: true }); // only once per load

  async function fetchSegments(videoId) {
    try {
      const res = await fetch(`${SKIP_URL}?videoID=${videoId}`);
      return res.ok ? res.json() : [];
    } catch {
      return [];
    }
  }

  async function runSkips() {
    const video = document.querySelector('video');
    if (!video || !skipEnabled) return;
    const videoId = new URLSearchParams(location.search).get('v');
    if (!videoId) return;

    const segments = await fetchSegments(videoId);
    if (!segments?.length) return;

    const check = () => {
      const t = video.currentTime;
      for (const s of segments) {
        const [start, end] = s.segment;
        if (t >= start && t < end) video.currentTime = end + 0.1;
      }
    };
    clearInterval(window.goodtubeSBInterval);
    window.goodtubeSBInterval = setInterval(check, 600);
  }

  const observer = new MutationObserver(() => {
    if (document.querySelector('video') && !window.goodtubeSBStarted) {
      window.goodtubeSBStarted = true;
      runSkips();
    }
  });
  observer.observe(document, { childList: true, subtree: true });

  window.addEventListener('yt-navigate-start', () => {
    clearInterval(window.goodtubeSBInterval);
    observer.disconnect();
    window.goodtubeSkipOnce = false;
    window.goodtubeSBStarted = false;
  });
})();
