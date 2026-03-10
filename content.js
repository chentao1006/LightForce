// Light Force - Universal dark-to-light mode converter
// Strategy:
//   Phase 1: Flip known theme signals (class, data attributes, color-scheme)
//   Phase 2: Detect if page is STILL dark by analyzing computed background luminance
//   Phase 3: If still dark, apply universal CSS filter inversion (the nuclear option)

chrome.storage.sync.get(['lightForceEnabled'], (result) => {
  const isEnabled = result.lightForceEnabled !== false;
  if (isEnabled) {
    applyLightForce();
  }
});

// ─── Utility: Calculate relative luminance (WCAG formula) ─────────────────────
function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// ─── Utility: Parse a CSS color string to {r, g, b, a} ───────────────────────
function parseColor(colorStr) {
  if (!colorStr || colorStr === 'transparent' || colorStr === 'rgba(0, 0, 0, 0)') {
    return null; // transparent — not useful for detection
  }
  const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (match) {
    const a = match[4] !== undefined ? parseFloat(match[4]) : 1;
    if (a < 0.1) return null; // nearly transparent
    return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]), a };
  }
  return null;
}

// ─── Utility: Check if a color is "dark" / "light" ─────────────────────────────
function isDarkColor(r, g, b) {
  // Threshold 0.12 covers deep dark colors while excluding medium greys (like #767676)
  return getLuminance(r, g, b) < 0.12;
}

function isLightColor(r, g, b) {
  return getLuminance(r, g, b) > 0.4;
}

function isTextDark(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  const color = parseColor(style.color);
  // Text is considered dark if its luminance is low
  return color && getLuminance(color.r, color.g, color.b) < 0.25;
}

// ─── Utility: Extract any color from an element's background (including shorthand) ─
function getEffectiveBackground(el) {
  if (!el) return null;
  const style = window.getComputedStyle(el);

  // 1. Check backgroundColor (most common)
  const bg = parseColor(style.backgroundColor);
  if (bg) return bg;

  // 2. Check background-image for dark gradient colors
  const bgImage = style.backgroundImage;
  if (bgImage && bgImage !== 'none') {
    const gradientColors = bgImage.match(/rgba?\(\d+,\s*\d+,\s*\d+(?:,\s*[\d.]+)?\)/g);
    if (gradientColors) {
      let darkCount = 0;
      for (const colorStr of gradientColors) {
        const c = parseColor(colorStr);
        if (c && isDarkColor(c.r, c.g, c.b)) darkCount++;
      }
      if (darkCount > gradientColors.length / 2) {
        // Return a representative dark color
        return parseColor(gradientColors[0]);
      }
    }
  }

  return null;
}

// ─── Detect if the page is currently dark ─────────────────────────────────────
// Uses multiple strategies to detect dark pages:
//   1. Check html and body computed backgroundColor + background gradients
//   2. Sample body's first-level children
//   3. Use elementFromPoint to sample actual visible colors at key viewport positions
//   4. Recursively check large nested containers (for sites like Substack)
function isPageDark() {
  // Strategy 1: Check html and body
  const targets = [document.documentElement, document.body];
  for (const el of targets) {
    if (!el) continue;
    const bg = getEffectiveBackground(el);
    // If background is dark, verify the text isn't also dark (false positive check)
    if (bg && isDarkColor(bg.r, bg.g, bg.b) && !isTextDark(el)) {
      return true;
    }
  }

  // Strategy 2: Sample first-level children of body
  if (document.body) {
    const children = document.body.children;
    let darkBgCount = 0;
    let darkTextCount = 0;
    let sampled = 0;
    const maxSample = Math.min(children.length, 12);
    for (let i = 0; i < maxSample; i++) {
      const child = children[i];
      if (!child || child.tagName === 'SCRIPT' || child.tagName === 'STYLE' || child.tagName === 'LINK' || child.tagName === 'NOSCRIPT') continue;
      const rect = child.getBoundingClientRect();
      if (rect.width < 50 || rect.height < 20) continue;

      const bg = getEffectiveBackground(child);
      if (bg && isDarkColor(bg.r, bg.g, bg.b)) darkBgCount++;
      if (isTextDark(child)) darkTextCount++;
      sampled++;
    }
    // Is dark if background is predominantly dark AND text is NOT predominantly dark
    if (sampled > 0 && (darkBgCount / sampled >= 0.4) && (darkTextCount / sampled < 0.3)) {
      return true;
    }
  }

  // Strategy 3: elementFromPoint sampling — checks what's ACTUALLY visible
  try {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const samplePoints = [
      [vw * 0.5, vh * 0.1], [vw * 0.5, vh * 0.5],
      [vw * 0.1, vh * 0.5], [vw * 0.9, vh * 0.5],
      [vw * 0.5, vh * 0.9],
    ];
    let darkBgSamples = 0;
    let darkTextSamples = 0;
    let totalSamples = 0;
    for (const [x, y] of samplePoints) {
      const el = document.elementFromPoint(x, y);
      if (!el) continue;

      let current = el;
      let foundBg = false;
      while (current && current !== document.documentElement) {
        const bg = getEffectiveBackground(current);
        if (bg) {
          if (isDarkColor(bg.r, bg.g, bg.b)) darkBgSamples++;
          foundBg = true;
          break;
        }
        current = current.parentElement;
      }
      if (foundBg) {
        if (isTextDark(el)) darkTextSamples++;
        totalSamples++;
      }
    }
    if (totalSamples >= 3 && (darkBgSamples / totalSamples >= 0.5) && (darkTextSamples / totalSamples < 0.3)) {
      return true;
    }
  } catch (e) { }

  // Strategy 4: Recursive descent into large containers
  // Some sites (like Substack) have a main container 2-3 levels deep
  if (document.body) {
    const queue = [...document.body.children];
    let depth = 0;
    while (queue.length > 0 && depth < 3) {
      depth++;
      const nextQueue = [];
      for (const child of queue) {
        if (!child || !child.getBoundingClientRect) continue;
        if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE' || child.tagName === 'LINK' || child.tagName === 'NOSCRIPT') continue;
        const rect = child.getBoundingClientRect();
        // Only check large containers that dominate the page
        if (rect.width < window.innerWidth * 0.5 || rect.height < window.innerHeight * 0.3) continue;
        const bg = getEffectiveBackground(child);
        if (bg && isDarkColor(bg.r, bg.g, bg.b)) {
          return true;
        }
        // Add children for next depth level
        if (child.children) {
          nextQueue.push(...child.children);
        }
      }
      queue.length = 0;
      queue.push(...nextQueue);
    }
  }

  return false;
}

// ─── Phase 1: Flip known theme signals ────────────────────────────────────────
function flipThemeSignals() {
  // Force color-scheme CSS property
  if (!document.getElementById('light-force-color-scheme')) {
    const style = document.createElement('style');
    style.id = 'light-force-color-scheme';
    style.textContent = `
      :root, html, body {
        color-scheme: light !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  const root = document.documentElement;
  if (root) {
    // Handle dark class
    if (root.classList.contains('dark')) {
      root.classList.remove('dark');
      root.classList.add('light');
    }
    // Flip common dark-related classes
    ['dark-mode', 'dark-theme', 'theme-dark', 'night', 'night-mode'].forEach(cls => {
      if (root.classList.contains(cls)) {
        root.classList.remove(cls);
      }
    });

    // Handle data attributes
    const darkAttrs = ['theme', 'data-theme', 'data-color-mode', 'data-color-scheme',
      'data-mode', 'data-appearance', 'data-bs-theme'];
    darkAttrs.forEach(attr => {
      const val = root.getAttribute(attr);
      if (val && /dark|night/i.test(val)) {
        root.setAttribute(attr, val.replace(/dark|night/gi, 'light'));
      }
    });

    // Handle inline color-scheme style
    const inlineStyle = root.getAttribute('style') || '';
    if (/color-scheme:\s*dark/i.test(inlineStyle)) {
      root.setAttribute('style', inlineStyle.replace(/color-scheme:\s*dark/gi, 'color-scheme: light'));
    }
  }

  const body = document.body;
  if (body) {
    if (body.classList.contains('dark')) {
      body.classList.remove('dark');
      body.classList.add('light');
    }
    ['dark-mode', 'dark-theme', 'theme-dark', 'night', 'night-mode'].forEach(cls => {
      if (body.classList.contains(cls)) {
        body.classList.remove(cls);
      }
    });
    const darkAttrs = ['data-theme', 'data-color-mode', 'data-bs-theme'];
    darkAttrs.forEach(attr => {
      const val = body.getAttribute(attr);
      if (val && /dark|night/i.test(val)) {
        body.setAttribute(attr, val.replace(/dark|night/gi, 'light'));
      }
    });
  }

  // Inject overrides for CSS-variable-based dark themes
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

// ─── Phase 3: Universal CSS filter inversion (the nuclear option) ─────────────
// This is the most reliable way to convert ANY dark page to light.
// It inverts all colors and then re-inverts media elements so they look normal.
//
// Key rule: filter on ancestor is inherited by children as a rendering context,
// so we only need to re-invert the LEAF media elements. We must NOT re-invert
// both a container AND its child (e.g. <picture> + <img>) or they cancel out.
function applyFilterInversion() {
  if (document.getElementById('light-force-invert')) return;

  const invertStyle = document.createElement('style');
  invertStyle.id = 'light-force-invert';
  invertStyle.textContent = `
    /* Invert entire page */
    html {
      filter: invert(1) hue-rotate(180deg) !important;
    }

    /* Re-invert leaf media elements so images/videos look normal.
       Only target elements that DON'T contain other re-inverted elements.
       NOTE: <picture> is excluded — its child <img> handles re-inversion. */
    img,
    video,
    canvas,
    .emoji,
    iframe {
      filter: invert(1) hue-rotate(180deg) !important;
    }

    /* SVG images embedded inline need re-inversion */
    svg image {
      filter: invert(1) hue-rotate(180deg) !important;
    }
  `;
  (document.head || document.documentElement).appendChild(invertStyle);

  // Scan for elements using background-image (url()) and re-invert them
  requestAnimationFrame(() => {
    reInvertBackgroundImages();
  });
}

// ─── Scan for background-image elements and re-invert them ────────────────────
// Elements with background-image: url(...) are NOT handled by the CSS above,
// because there's no pure CSS selector for "has a url() background-image".
// We scan the DOM and tag these elements for re-inversion, but SKIP any element
// that contains an <img>, <video>, <canvas>, or <iframe> child (to avoid
// double re-inversion on the child media).
function reInvertBackgroundImages() {
  if (document.getElementById('light-force-bg-reinvert')) return;

  const selectors = [];
  const walker = document.createTreeWalker(
    document.body || document.documentElement,
    NodeFilter.SHOW_ELEMENT,
    null
  );

  let count = 0;
  let node;
  while ((node = walker.nextNode()) && count < 3000) {
    count++;
    const style = window.getComputedStyle(node);
    if (!style.backgroundImage || style.backgroundImage === 'none') continue;
    if (!style.backgroundImage.includes('url(')) continue;

    // Skip if this element contains media children (they already re-invert themselves)
    if (node.querySelector('img, video, canvas, iframe')) continue;

    // Tag with a data attribute for CSS targeting
    const uid = 'lf-' + Math.random().toString(36).substr(2, 6);
    node.setAttribute('data-lf-bg', uid);
    selectors.push(`[data-lf-bg="${uid}"]`);
  }

  if (selectors.length > 0) {
    const bgStyle = document.createElement('style');
    bgStyle.id = 'light-force-bg-reinvert';
    bgStyle.textContent = selectors
      .map(sel => `${sel} { filter: invert(1) hue-rotate(180deg) !important; }`)
      .join('\n');
    document.head.appendChild(bgStyle);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function applyLightForce() {
  // Phase 1: Immediately inject color-scheme and flip known signals
  flipThemeSignals();

  // Phase 2 & 3: After DOM is ready, detect and invert if still dark
  const detectAndFix = () => {
    // Re-run Phase 1 in case DOM has changed
    flipThemeSignals();

    // Give a frame for CSS to recompute after Phase 1 changes
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
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(detectAndFix, 50);
    });
  } else {
    setTimeout(detectAndFix, 50);
  }

  // Re-check after full page load (some sites load styles lazily)
  window.addEventListener('load', () => {
    setTimeout(detectAndFix, 200);
  });

  // Monitor for dynamic theme changes (SPA navigation, etc.)
  const observer = new MutationObserver(() => {
    clearTimeout(observer._timer);
    observer._timer = setTimeout(() => {
      flipThemeSignals();
      // Only re-check if we haven't already applied inversion
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
      attributes: true,
      childList: true,
      subtree: false,
      attributeFilter: ['class', 'theme', 'data-theme', 'data-color-mode', 'style', 'data-bs-theme']
    });
  }
}
