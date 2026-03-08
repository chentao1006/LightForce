// ==UserScript==
// @name         Light Force
// @namespace    http://tampermonkey.net/
// @version      1.0
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

  // 1. Get initial state safely
  let isEnabled = GM_getValue('lightForceEnabled');
  if (isEnabled === undefined) isEnabled = true;

  console.log('[Light Force] Status:', isEnabled ? 'Enabled' : 'Disabled');

  // 2. Register menu command to toggle
  const menuLabel = isEnabled ? 'Disable Light Force' : 'Enable Light Force';
  GM_registerMenuCommand(menuLabel, () => {
    GM_setValue('lightForceEnabled', !isEnabled);
    console.log('[Light Force] Toggled to:', !isEnabled);
    location.reload();
  });

  if (isEnabled) {
    applyLightForce();
  }

  function applyLightForce() {
    // 1. Force the color-scheme CSS property on root element
    const style = document.createElement('style');
    style.id = 'light-force-css';
    style.textContent = `
            :root, html, body {
                color-scheme: light !important;
            }
        `;

    // Inject immediately
    if (document.head || document.documentElement) {
      (document.head || document.documentElement).appendChild(style);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        (document.head || document.documentElement).appendChild(style);
      });
    }

    // 2. Helper to enforce light theme
    const enforceLight = () => {
      const root = document.documentElement;
      if (root) {
        // Handle classes (Flip 'dark' to 'light')
        if (root.classList.contains('dark')) {
          root.classList.remove('dark');
          root.classList.add('light');
        }

        // Handle attributes (Classic themes)
        if (root.getAttribute('theme') === 'dark') root.setAttribute('theme', 'light');
        if (root.getAttribute('data-theme') === 'dark') root.setAttribute('data-theme', 'light');
        if (root.getAttribute('data-color-mode') === 'dark') root.setAttribute('data-color-mode', 'light');

        // Handle OpenClaw specific (and common others)
        // Note: Even if it's not set to dark, we want to force 'light'
        if (root.getAttribute('data-theme') !== 'light') {
          root.setAttribute('data-theme', 'light');
        }

        // Handle hardcoded style attribute on root
        const currentStyle = root.getAttribute('style') || '';
        if (currentStyle.includes('color-scheme: dark')) {
          root.setAttribute('style', currentStyle.replace(/color-scheme:\s*dark/g, 'color-scheme: light'));
        }
      }

      const body = document.body;
      if (body) {
        if (body.classList.contains('dark')) {
          body.classList.remove('dark');
          body.classList.add('light');
        }
        if (body.getAttribute('data-theme') === 'dark') body.setAttribute('data-theme', 'light');
        if (body.getAttribute('data-theme') !== 'light') body.setAttribute('data-theme', 'light');
      }

      // 3. Target specific elements that use hardcoded dark classes (Tailwind, etc.)
      const darkElements = document.querySelectorAll('.bg-black, .bg-gray-900, .bg-zinc-950, [class*="bg-black/"], [class*="bg-zinc-950/"], .bg-slate-950');
      darkElements.forEach(el => {
        if (window.getComputedStyle(el).position === 'fixed' || window.getComputedStyle(el).position === 'absolute') {
          el.style.setProperty('background-color', 'rgba(255, 255, 255, 0.8)', 'important');
        } else {
          el.style.setProperty('background-color', 'white', 'important');
          el.style.setProperty('color', '#1a1a1a', 'important');
        }
      });

      // Fix invisible text (light text on white background)
      const lightTextElements = document.querySelectorAll('.text-gray-100, .text-zinc-100, .text-white, .text-slate-100, .text-zinc-400, .text-gray-400');
      lightTextElements.forEach(el => {
        el.style.setProperty('color', '#333', 'important'); // Force dark gray
      });
    };

    // 4. More aggressive CSS injection for sites that hardcode dark mode
    const forceLightCSS = document.createElement('style');
    forceLightCSS.id = 'light-force-global-overrides';
    forceLightCSS.textContent = `
        /* Overwrite common dark mode variables if they exist at :root */
        :root[data-theme="dark"], :root.dark {
            --background: 0 0% 100% !important;
            --foreground: 222.2 84% 4.9% !important;
        }
        /* Generic fallback inversion for very stubborn elements */
        [data-theme="dark"] body {
            background-color: white !important;
            color: black !important;
        }
    `;
    (document.head || document.documentElement).appendChild(forceLightCSS);

    // Run immediately
    enforceLight();

    // 3. Monitor for changes
    const observer = new MutationObserver(enforceLight);

    observer.observe(document.documentElement, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['class', 'theme', 'data-theme', 'data-color-mode', 'style']
    });
  }
})();
