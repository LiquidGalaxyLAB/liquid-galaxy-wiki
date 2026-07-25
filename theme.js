/**
 * theme.js — Dark/Light Mode Manager + Scroll Elevation + Mobile Drawer Scrim
 * Liquid Galaxy Docs
 *
 * NOTE: The no-FOUC inline script that runs BEFORE first paint lives in index.html <head>.
 *       This module runs after DOM is ready and wires up the toggle button.
 */

const STORAGE_KEY = 'lg-theme';

/**
 * Returns current theme ('light' | 'dark') from the html element attribute.
 */
function getCurrentTheme() { 
  return document.documentElement.getAttribute('data-theme') || 'light';
}

/**
 * Applies the given theme by setting data-theme on <html>.
 * Also swaps the icon inside #theme-toggle.
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY, theme);

  const toggle = document.getElementById('theme-toggle');
  if (!toggle) return;

  const icon = toggle.querySelector('.material-icons');
  if (icon) {
    // Micro-animation: fade out → swap icon → fade in (no layout shift)
    icon.style.opacity = '0';
    setTimeout(() => {
      icon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
      icon.style.opacity = '1';
    }, 150); // matches --md-sys-motion-duration-short-3
  }
  toggle.setAttribute(
    'aria-label',
    theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
  );
}

/**
 * Toggles between light and dark.
 */
function toggleTheme() {
  const next = getCurrentTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
}

/**
 * Checks URL for iframe=true query param and attaches or removes token_dark.css dynamically.
 * Does not pollute localStorage so normal viewing uses standard saved theme.
 */
function syncIframeTheme() {
  const isIframeParam = window.location.href.indexOf('iframe=true') !== -1;
  let link = document.getElementById('token-dark-stylesheet');

  if (isIframeParam) {
    document.documentElement.setAttribute('data-theme', 'dark');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'stylesheet';
      link.id = 'token-dark-stylesheet';
      link.href = 'token_dark.css';
      document.head.appendChild(link);
    }
  } else {
    if (link) {
      link.remove();
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    applyTheme(theme);
  }
}

// ── Wire up the theme toggle button ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  syncIframeTheme();
  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', toggleTheme);
    // Sync icon to current theme (may have been set by inline script)
    applyTheme(getCurrentTheme());
  }
});

window.addEventListener('hashchange', syncIframeTheme);
window.addEventListener('popstate', syncIframeTheme);

// ── Header scroll elevation ─────────────────────────────────────────────────
(function initScrollElevation() {
  const header = document.querySelector('.app-bar');
  if (!header) return;

  // Determine which element to observe: the .content-area div (scrollable)
  function getScrollTarget() {
    return document.querySelector('.content-area');
  }

  function onScroll() {
    const scrollTarget = getScrollTarget();
    const scrolled = scrollTarget
      ? scrollTarget.scrollTop > 4
      : window.scrollY > 4;
    header.classList.toggle('scrolled', scrolled);
  }

  // Attach once DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    const scrollTarget = getScrollTarget();
    const el = scrollTarget || window;
    el.addEventListener('scroll', onScroll, { passive: true });
  });
})();

// ── Mobile Drawer Scrim ─────────────────────────────────────────────────────
(function initDrawerScrim() {
  document.addEventListener('DOMContentLoaded', () => {
    const scrim  = document.getElementById('drawer-scrim');
    const drawer = document.getElementById('drawer');
    if (!scrim || !drawer) return;

    // Close drawer when scrim is clicked
    scrim.addEventListener('click', () => {
      drawer.classList.add('collapsed');
      scrim.classList.remove('visible');
    });

    // Observe drawer mutations to show/hide scrim
    const observer = new MutationObserver(() => {
      // On mobile viewports, show scrim when drawer is open
      if (window.innerWidth < 960) {
        const isOpen = !drawer.classList.contains('collapsed');
        scrim.classList.toggle('visible', isOpen);
      } else {
        scrim.classList.remove('visible');
      }
    });

    observer.observe(drawer, { attributes: true, attributeFilter: ['class'] });

    // Also hide scrim when resizing past mobile breakpoint
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 960) {
        scrim.classList.remove('visible');
      }
    }, { passive: true });

    // Close drawer on ESC key (accessibility)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !drawer.classList.contains('collapsed') && window.innerWidth < 960) {
        drawer.classList.add('collapsed');
        scrim.classList.remove('visible');
      }
    });
  });
})();
