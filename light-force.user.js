// ==UserScript==
// @name         Light Force
// @namespace    https://ct106.com
// @version      1.3
// @description  May the Light Force be with you. Forces dark-themed websites into light mode, leaving originally light websites unaffected.
// @author       chentao1006
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  let isEnabled = GM_getValue('lightForceEnabled', true);
  let isOnlyDaylight = GM_getValue('onlyDaylightEnabled', false);

  console.log('[Light Force] Status:', isEnabled ? 'Enabled' : 'Disabled', '| Only for Daylight:', isOnlyDaylight ? 'Yes' : 'No');

  GM_registerMenuCommand(isEnabled ? 'Disable Light Force' : 'Enable Light Force', () => {
    GM_setValue('lightForceEnabled', !isEnabled);
    location.reload();
  });

  GM_registerMenuCommand(isOnlyDaylight ? 'Disable Only for Daylight' : 'Enable Only for Daylight', () => {
    GM_setValue('onlyDaylightEnabled', !isOnlyDaylight);
    location.reload();
  });

  if (isEnabled) {
    if (isOnlyDaylight && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      console.log('[Light Force] "Only for day light" is active and system is in dark mode. Skipping.');
      return;
    }
    applyLightForce();
  }

  // ─── Utility: WCAG relative luminance ─────────────────────────────────────
  function getLuminance(r, g, b) {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  function parseColor(colorStr) {
    if (!colorStr || colorStr === 'transparent' || colorStr === 'rgba(0, 0, 0, 0)') return null;
    const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
      const a = match[4] !== undefined ? parseFloat(match[4]) : 1;
      if (a < 0.1) return null;
      return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]), a };
    }
    return null;
  }

  function isDarkColor(r, g, b) { return getLuminance(r, g, b) < 0.12; }
  function isTextDark(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    const color = parseColor(style.color);
    return color && getLuminance(color.r, color.g, color.b) < 0.25;
  }

  // ─── Extract effective background from an element ─────────────────────────
  function getEffectiveBackground(el) {
    if (!el) return null;
    const style = window.getComputedStyle(el);
    const bg = parseColor(style.backgroundColor);
    if (bg) return bg;
    const bgImage = style.backgroundImage;
    if (bgImage && bgImage !== 'none') {
      const gradientColors = bgImage.match(/rgba?\(\d+,\s*\d+,\s*\d+(?:,\s*[\d.]+)?\)/g);
      if (gradientColors) {
        let dc = 0;
        for (const cs of gradientColors) { const c = parseColor(cs); if (c && isDarkColor(c.r, c.g, c.b)) dc++; }
        if (dc > gradientColors.length / 2) return parseColor(gradientColors[0]);
      }
    }
    return null;
  }

  // ─── Detect if the page is dark (multi-strategy) ──────────────────────────
  function isPageDark() {
    // Strategy 1: html and body
    for (const el of [document.documentElement, document.body]) {
      if (!el) continue;
      const bg = getEffectiveBackground(el);
      if (!bg) continue;

      // --- NEW: Definitive Light Signal ---
      if (getLuminance(bg.r, bg.g, bg.b) > 0.4) return false;

      if (isDarkColor(bg.r, bg.g, bg.b) && !isTextDark(el)) return true;
    }

    // Strategy 2: Sample first-level children
    if (document.body) {
      const children = document.body.children;
      let db = 0, dt = 0, s = 0;
      for (let i = 0; i < Math.min(children.length, 12); i++) {
        const child = children[i];
        if (!child || ['SCRIPT', 'STYLE', 'LINK', 'NOSCRIPT'].includes(child.tagName)) continue;
        const rect = child.getBoundingClientRect();
        if (rect.width < 50 || rect.height < 20) continue;
        const bg = getEffectiveBackground(child);
        if (bg && isDarkColor(bg.r, bg.g, bg.b)) db++;
        if (isTextDark(child)) dt++;
        s++;
      }
      if (s > 0 && db / s >= 0.4 && dt / s < 0.3) return true;
    }

    // Strategy 3: elementFromPoint sampling
    try {
      const vw = window.innerWidth, vh = window.innerHeight;
      const points = [[vw * 0.5, vh * 0.1], [vw * 0.5, vh * 0.5], [vw * 0.1, vh * 0.5], [vw * 0.9, vh * 0.5], [vw * 0.5, vh * 0.9]];
      let db = 0, dt = 0, ts = 0;
      for (const [x, y] of points) {
        const el = document.elementFromPoint(x, y);
        if (!el) continue;
        let curr = el, foundBg = false;
        while (curr && curr !== document.documentElement) {
          const bg = getEffectiveBackground(curr);
          if (bg) { if (isDarkColor(bg.r, bg.g, bg.b)) db++; foundBg = true; break; }
          curr = curr.parentElement;
        }
        if (foundBg) { if (isTextDark(el)) dt++; ts++; }
      }
      if (ts >= 3 && db / ts >= 0.5 && dt / ts < 0.3) return true;
    } catch (e) { }

    // Strategy 4: Recursive descent into large containers
    if (document.body) {
      const queue = [...document.body.children];
      let depth = 0;
      while (queue.length > 0 && depth < 3) {
        depth++;
        const nextQueue = [];
        for (const child of queue) {
          if (!child || !child.getBoundingClientRect) continue;
          if (['SCRIPT', 'STYLE', 'LINK', 'NOSCRIPT'].includes(child.tagName)) continue;
          const rect = child.getBoundingClientRect();
          if (rect.width < window.innerWidth * 0.5 || rect.height < window.innerHeight * 0.3) continue;
          const bg = getEffectiveBackground(child);
          if (bg && isDarkColor(bg.r, bg.g, bg.b)) return true;
          if (child.children) nextQueue.push(...child.children);
        }
        queue.length = 0;
        queue.push(...nextQueue);
      }
    }
    return false;
  }

  // ─── Phase 1: Flip known theme signals ────────────────────────────────────
  function flipThemeSignals() {
    if (!document.getElementById('light-force-color-scheme')) {
      const style = document.createElement('style');
      style.id = 'light-force-color-scheme';
      style.textContent = ':root, html, body { color-scheme: light !important; }';
      (document.head || document.documentElement).appendChild(style);
    }

    const root = document.documentElement;
    if (root) {
      if (root.classList.contains('dark')) { root.classList.remove('dark'); root.classList.add('light'); }
      ['dark-mode', 'dark-theme', 'theme-dark', 'night', 'night-mode', 'theme-system'].forEach(cls => {
        if (root.classList.contains(cls)) {
          root.classList.remove(cls);
          if (cls === 'theme-system') root.classList.add('theme-light');
        }
      });
      ['theme', 'data-theme', 'data-color-mode', 'data-color-scheme', 'data-mode', 'data-appearance', 'data-bs-theme'].forEach(attr => {
        const val = root.getAttribute(attr);
        if (val && /dark|night/i.test(val)) root.setAttribute(attr, val.replace(/dark|night/gi, 'light'));
      });
      const inlineStyle = root.getAttribute('style') || '';
      if (/color-scheme:\s*dark/i.test(inlineStyle)) {
        root.setAttribute('style', inlineStyle.replace(/color-scheme:\s*dark/gi, 'color-scheme: light'));
      }
    }

    const body = document.body;
    if (body) {
      if (body.classList.contains('dark')) { body.classList.remove('dark'); body.classList.add('light'); }
      ['dark-mode', 'dark-theme', 'theme-dark', 'night', 'night-mode', 'theme-system'].forEach(cls => {
        if (body.classList.contains(cls)) {
          body.classList.remove(cls);
          if (cls === 'theme-system') body.classList.add('theme-light');
        }
      });
      ['data-theme', 'data-color-mode', 'data-bs-theme'].forEach(attr => {
        const val = body.getAttribute(attr);
        if (val && /dark|night/i.test(val)) body.setAttribute(attr, val.replace(/dark|night/gi, 'light'));
      });
    }

    if (!document.getElementById('light-force-theme-overrides')) {
      const overrideStyle = document.createElement('style');
      overrideStyle.id = 'light-force-theme-overrides';
      overrideStyle.textContent = `
        :root[data-theme="dark"], :root.dark,
        [data-theme="dark"] body, .dark body {
          --background: 0 0% 100% !important;
          --foreground: 222.2 84% 4.9% !important;
          background-color: white !important;
          color: #1a1a1a !important;
        }
      `;
      (document.head || document.documentElement).appendChild(overrideStyle);
    }
  }

  // ─── Phase 3: Universal CSS filter inversion ──────────────────────────────
  function applyFilterInversion() {
    if (document.getElementById('light-force-invert')) return;
    const invertStyle = document.createElement('style');
    invertStyle.id = 'light-force-invert';
    invertStyle.textContent = `
      html { filter: invert(1) hue-rotate(180deg) !important; }
      img, video, canvas, .emoji, iframe { filter: invert(1) hue-rotate(180deg) !important; }
      svg image { filter: invert(1) hue-rotate(180deg) !important; }
    `;
    (document.head || document.documentElement).appendChild(invertStyle);
    requestAnimationFrame(() => { reInvertBackgroundImages(); });
  }

  function reInvertBackgroundImages() {
    if (document.getElementById('light-force-bg-reinvert')) return;
    const selectors = [];
    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_ELEMENT, null);
    let count = 0, node;
    while ((node = walker.nextNode()) && count < 3000) {
      count++;
      const style = window.getComputedStyle(node);
      if (!style.backgroundImage || style.backgroundImage === 'none') continue;
      if (!style.backgroundImage.includes('url(')) continue;
      if (node.querySelector('img, video, canvas, iframe')) continue;
      const uid = 'lf-' + Math.random().toString(36).substr(2, 6);
      node.setAttribute('data-lf-bg', uid);
      selectors.push(`[data-lf-bg="${uid}"]`);
    }
    if (selectors.length > 0) {
      const bgStyle = document.createElement('style');
      bgStyle.id = 'light-force-bg-reinvert';
      bgStyle.textContent = selectors.map(sel => `${sel} { filter: invert(1) hue-rotate(180deg) !important; }`).join('\n');
      document.head.appendChild(bgStyle);
    }
  }

  // ─── Main ──────────────────────────────────────────────────────────────────
  function applyLightForce() {
    flipThemeSignals();

    const detectAndFix = () => {
      flipThemeSignals();
      requestAnimationFrame(() => {
        if (isPageDark()) {
          console.log('[Light Force] Page detected as dark — applying filter inversion');
          applyFilterInversion();
        } else {
          console.log('[Light Force] Page is light — no inversion needed');
        }
      });
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => { setTimeout(detectAndFix, 50); });
    } else {
      setTimeout(detectAndFix, 50);
    }

    window.addEventListener('load', () => { setTimeout(detectAndFix, 200); });

    const observer = new MutationObserver(() => {
      clearTimeout(observer._timer);
      observer._timer = setTimeout(() => {
        flipThemeSignals();
        if (!document.getElementById('light-force-invert')) {
          requestAnimationFrame(() => {
            if (isPageDark()) {
              console.log('[Light Force] Page turned dark dynamically — applying filter inversion');
              applyFilterInversion();
            }
          });
        }
      }, 200);
    });

    if (document.documentElement) {
      observer.observe(document.documentElement, {
        attributes: true, childList: true, subtree: false,
        attributeFilter: ['class', 'theme', 'data-theme', 'data-color-mode', 'style', 'data-bs-theme']
      });
    }
  }
})();
