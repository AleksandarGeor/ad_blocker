(() => {
  'use strict';

function injectGoodTubeScript() {
    if (document.getElementById('goodtube-injected')) return;
    const s = document.createElement('script');
    s.id = 'goodtube-injected';
    s.src = chrome.runtime.getURL('goodtubeContent.js'); // Opera uses chrome.runtime too
    s.defer = true;
    document.documentElement.appendChild(s);
}
injectGoodTubeScript();


  const DEFAULT_SETTINGS = { hideAds: true, skipIntro: true };
  let settings = { ...DEFAULT_SETTINGS };
  let buttonInserted = false;
  const log = (...args) => console.log('[GoodTube]', ...args);

  // --- Load/save settings ---
  const loadSettings = async () => {
    try {
      const data = await chrome.storage?.local?.get(DEFAULT_SETTINGS) ?? {};
      settings = { ...DEFAULT_SETTINGS, ...data };
    } catch {
      settings = { ...DEFAULT_SETTINGS };
    }
  };

  const saveSettings = async () => {
    try {
      await chrome.storage?.local?.set(settings);
    } catch (e) { log('Storage unavailable:', e); }
  };

  // --- Helpers ---
  const utils = {
    addStyle(id, css) {
      if (document.getElementById(id)) return;
      const s = document.createElement('style');
      s.id = id;
      s.textContent = css;
      document.head.appendChild(s);
    },
    waitForElement: (selector, timeout = 5000) => new Promise(resolve => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      const obs = new MutationObserver(() => {
        const e = document.querySelector(selector);
        if (e) { obs.disconnect(); resolve(e); }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); resolve(null); }, timeout);
    })
  };

  // --- Inject SkipIntro script ---
  async function injectSkipIntroScript() {
    if (!document.querySelector('script[data-goodtube="skipIntro"]')) {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('skipIntroContent.js');
      script.dataset.goodtube = 'skipIntro';
      script.defer = true;
      document.documentElement.appendChild(script);
      log('Injected skipIntroContent.js');
    }
    window.postMessage({ type: 'GOODTUBE_SKIP_TOGGLE', enabled: settings.skipIntro }, '*');
  }

  // --- Menu colors ---
  function getMenuColors() {
    const dark = document.querySelector('html[darker-dark-theme][dark], [darker-dark-theme] [dark]') !== null;
    return dark
      ? { text:'#fff', hover:'rgba(255,255,255,0.25)', selected:'rgba(255,255,255,0.15)', glow:'rgba(255,255,255,0.3)' }
      : { text:'#000', hover:'rgba(0,0,0,0.25)', selected:'rgba(0,0,0,0.15)', glow:'rgba(0,0,0,0.3)' };
  }

  // --- Create menu button ---
  async function createButtonMenu() {
    if (buttonInserted) return;
    const container = await utils.waitForElement('#end');
    if (!container) return;
    const avatar = container.querySelector('img');
    if (!avatar) return;

    buttonInserted = true;
    const btn = document.createElement('img');
    btn.id = 'goodtube-menu-button';
    btn.src = chrome.runtime.getURL('icon48.png');
    Object.assign(btn.style, {
      width: `${avatar.offsetWidth}px`,
      height: `${avatar.offsetHeight}px`,
      borderRadius:'50%',
      cursor:'pointer',
      marginLeft:'6px',
      verticalAlign:'middle',
      transition:'transform 0.2s ease'
    });
    container.appendChild(btn);
    btn.addEventListener('mouseenter', ()=> btn.style.transform='scale(1.1)');
    btn.addEventListener('mouseleave', ()=> btn.style.transform='scale(1)');

    const menu = document.createElement('ul');
    Object.assign(menu.style,{
      position:'absolute', background:'rgba(255,245,235,0.15)',
      backdropFilter:'blur(20px) saturate(200%)', borderRadius:'16px',
      padding:'16px 0', listStyle:'none', fontFamily:'Inter, sans-serif',
      minWidth:'260px', zIndex:99999, display:'none', flexDirection:'column',
      boxShadow:'0 20px 60px rgba(0,0,0,0.35)', border:'1px solid rgba(0,0,0,0.1)',
      transition:'opacity 0.3s ease, transform 0.3s ease'
    });
    document.body.appendChild(menu);

    const items = [
      { label:'Hide Ads', key:'hideAds', type:'ads' },
      { label:'Skip Intro', key:'skipIntro', type:'skip' }
    ];

    for (const item of items) {
      const li = document.createElement('li');
      li.textContent = item.label;
      const updateColors = () => {
        const colors = getMenuColors();
        li.style.color = colors.text;
        li.style.background = settings[item.key] ? colors.selected : 'transparent';
      };
      Object.assign(li.style,{
        padding:'16px 24px', cursor:'pointer', userSelect:'none',
        borderRadius:'8px', margin:'6px 12px', transition:'background 0.3s ease, color 0.3s ease',
        fontSize:'16px'
      });
      li.onmouseenter = ()=> { const c=getMenuColors(); li.style.background=c.hover; li.style.transform='translateX(4px)'; li.style.boxShadow=`0 4px 12px ${c.glow}`; };
      li.onmouseleave = ()=> { const c=getMenuColors(); li.style.background=settings[item.key]?c.selected:'transparent'; li.style.transform='translateX(0)'; li.style.boxShadow='none'; };
      li.onclick = async e=>{
        e.stopPropagation();
        settings[item.key] = !settings[item.key];

        if(item.type==='skip') {
          window.postMessage({ type:'GOODTUBE_SKIP_TOGGLE', enabled: settings.skipIntro }, '*');
          if(settings.skipIntro) injectSkipIntroScript();
        } else if(item.type==='ads') {
          window.postMessage({ type:'GOODTUBE_ADS_TOGGLE', enabled: settings.hideAds }, '*');
        }

        await saveSettings();
        li.style.background = settings[item.key]?getMenuColors().selected:'transparent';
      };
      menu.appendChild(li);
      updateColors();
    }

    const positionMenu = ()=>{
      const rect=btn.getBoundingClientRect();
      menu.style.top=`${rect.bottom+window.scrollY+8}px`;
      menu.style.left=`${Math.max(rect.left+window.scrollX-menu.offsetWidth+rect.width,8)}px`;
    };

    btn.addEventListener('click', e=>{
      e.stopPropagation();
      const visible = menu.style.display==='flex';
      menu.style.display = visible?'none':'flex';
      if(!visible){
        menu.style.opacity='0';
        menu.style.transform='translateY(-10px)';
        positionMenu();
        requestAnimationFrame(()=>{menu.style.opacity='1'; menu.style.transform='translateY(0)';});
      }
    });

    document.addEventListener('click',()=>menu.style.display='none');
    window.addEventListener('resize',()=>{ if(menu.style.display==='flex') positionMenu(); });
    document.addEventListener('keydown', e=>{ if(e.key==='Escape') menu.style.display='none'; });
  }

  // --- Initialize ---
  async function init() {
    await loadSettings();
    window.postMessage({ type:'GOODTUBE_ADS_TOGGLE', enabled: settings.hideAds }, '*');
    await injectSkipIntroScript();
    createButtonMenu();

    const observer = new MutationObserver(()=>{
      createButtonMenu();
      if(settings.skipIntro) injectSkipIntroScript();
    });
    observer.observe(document.body,{childList:true, subtree:true});
  }

  if(document.readyState==='complete' || document.readyState==='interactive') setTimeout(init,1);
  else window.addEventListener('DOMContentLoaded', init);

})();

