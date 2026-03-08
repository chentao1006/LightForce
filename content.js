// This script forces light mode onto web pages that are using dark mode.
chrome.storage.sync.get(['lightForceEnabled'], (result) => {
  const isEnabled = result.lightForceEnabled !== false;
  if (isEnabled) {
    applyLightForce();
  }
});

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

      // Handle specific implementations like OpenClaw
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
      el.style.setProperty('color', '#333', 'important');
    });
  };

  // 4. More aggressive CSS injection for sites that hardcode dark mode
  const forceLightCSS = document.createElement('style');
  forceLightCSS.id = 'light-force-global-overrides';
  forceLightCSS.textContent = `
      :root[data-theme="dark"], :root.dark {
          --background: 0 0% 100% !important;
          --foreground: 222.2 84% 4.9% !important;
      }
      [data-theme="dark"] body {
          background-color: white !important;
          color: black !important;
      }
  `;
  (document.head || document.documentElement).appendChild(forceLightCSS);

  // Run immediately
  enforceLight();

  // 5. Monitor for changes
  const observer = new MutationObserver(enforceLight);

  observer.observe(document.documentElement, {
    attributes: true,
    childList: true,
    subtree: true,
    attributeFilter: ['class', 'theme', 'data-theme', 'data-color-mode', 'style']
  });
}
