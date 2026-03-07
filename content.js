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

  // 2. Remove common dark theme classes and attributes via MutationObserver
  const observer = new MutationObserver(() => {
    const root = document.documentElement;
    if (root) {
      if (root.classList.contains('dark')) root.classList.remove('dark');
      if (root.getAttribute('theme') === 'dark') root.setAttribute('theme', 'light');
      if (root.getAttribute('data-theme') === 'dark') root.setAttribute('data-theme', 'light');
      if (root.getAttribute('data-color-mode') === 'dark') root.setAttribute('data-color-mode', 'light');
    }

    const body = document.body;
    if (body) {
      if (body.classList.contains('dark')) body.classList.remove('dark');
      if (body.getAttribute('data-theme') === 'dark') body.setAttribute('data-theme', 'light');
    }
  });

  observer.observe(document.documentElement, {
    attributes: true,
    childList: true,
    subtree: true,
    attributeFilter: ['class', 'theme', 'data-theme', 'data-color-mode']
  });
}
