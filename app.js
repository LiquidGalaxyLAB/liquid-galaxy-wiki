import { marked, attachCopyButtons } from './markdown-setup.js';

import { GitHubService } from './github.js';

// Configuration — content is read from the public LiquidGalaxyLAB/lg-wiki-content repo
const CONTENT_OWNER = 'LiquidGalaxyLAB';
const CONTENT_REPO  = 'lg-wiki-content';

// PR submissions still go to the same repo
const owner = CONTENT_OWNER;
const repo  = CONTENT_REPO;

const github = new GitHubService(owner, repo);

// UI Elements — all IDs unchanged
const drawer = document.getElementById('drawer');
const menuToggle = document.getElementById('menu-toggle');
const navList = document.getElementById('nav-list');
const markdownContent = document.getElementById('markdown-content');

// Global Search Elements
const searchDialog = document.getElementById('mdn-search-modal');
const dialogSearchInput = document.getElementById('dialog-search-input');
const searchDialogResults = document.getElementById('search-dialog-results');
const headerSearchBtn = document.getElementById('header-search-btn');
const closeSearchBtn = document.getElementById('close-search-btn');


let wikiIndex = { pages: [] };

// ── [DESIGN] Track active page for nav highlight ────────────────────────────
let _currentFile = null;
// Disconnectable IntersectionObserver for TOC highlighting
let _tocObserver = null;

// Initialize
async function init() {
  // Fetch index
  wikiIndex = await github.fetchIndex();
  renderNav(wikiIndex.pages);

  // On desktop (≥960px) the sidebar is a persistent panel — start it open
  if (window.innerWidth >= 960) {
    drawer.classList.remove('collapsed');
    menuToggle.setAttribute('aria-expanded', 'true');
  }

  // Show home page when no hash; load doc if hash is present
  const initialHash = window.location.hash.replace('#', '');
  if (initialHash) {
    loadPage(initialHash);
  } else {
    renderHome();
  }

  setupEventListeners();
  setupIframeMessaging();
}

// Render Navigation Drawer
function renderNav(pages) {
  navList.innerHTML = '';
  pages.forEach(page => {
    const item = document.createElement('md-list-item');
    item.textContent = page.title;
    item.type = 'button';
    // [DESIGN] Store filename on element for active-state highlighting
    item.dataset.file = page.file;
    item.addEventListener('click', () => {
      window.location.hash = page.file;
      loadPage(page.file);
      // Collapse drawer on smaller screens
      if (window.innerWidth < 960) {
        drawer.classList.add('collapsed');
      }
    });
    navList.appendChild(item);
  });

  // Inject the Contribute link
  const hr = document.createElement('hr');
  hr.style.margin = '16px 0';
  hr.style.border = 'none';
  hr.style.borderTop = '1px solid var(--md-sys-color-outline-variant)';
  navList.appendChild(hr);

  const contributeItem = document.createElement('md-list-item');
  contributeItem.innerHTML = `
    <span slot="start" class="material-icons" style="color: var(--md-sys-color-primary);">edit_note</span>
    How to Contribute
  `;
  contributeItem.type = 'button';
  contributeItem.addEventListener('click', () => {
    window.location.hash = 'how-to-contribute-to-lg-wiki.md';
    loadPage('how-to-contribute-to-lg-wiki.md');
    // Collapse drawer on smaller screens
    if (window.innerWidth < 960) {
      drawer.classList.add('collapsed');
    }
  });
  navList.appendChild(contributeItem);

  // Re-apply active state after re-render (e.g. after search filter)
  if (_currentFile) _updateActiveNav(_currentFile);
}

// Render the beautiful homepage
function renderHome() {
  _currentFile = null;
  _updateActiveNav(null);

  // Close sidebar on home screen as requested
  const drawer = document.getElementById('drawer');
  if (drawer && !drawer.classList.contains('collapsed')) {
    drawer.classList.add('collapsed');
  }

  // Hide TOC when on homepage
  const tocSidebar = document.getElementById('toc-sidebar');
  if (tocSidebar) tocSidebar.style.display = 'none';

  // Get Top 5 recent entries (assuming latest added are at the end of the array)
  const recentEntries = (wikiIndex.pages || []).slice(-5).reverse();
  const recentHtml = recentEntries.map(page => `
    <div class="recent-doc-item" onclick="window.location.hash='${page.file}'" role="button" tabindex="0">
      <span class="material-icons">article</span>
      <span>${page.title}</span>
    </div>
  `).join('');

  markdownContent.innerHTML = `
    <div class="home-hero">
      <div class="lg-badge">
        <span class="material-icons" style="font-size:16px;">public</span>
        Liquid Galaxy Project
      </div>
      <h1>Explore Liquid Galaxy</h1>
      <p>Welcome to LG Wiki! Discover clear documentation, implementation guides, and architectural insights for the Liquid Galaxy project — your go-to resource for both beginners and enthusiasts.</p>
      <div class="hero-search-container">
        <button id="hero-search-overlay" class="hero-search-btn" aria-label="Search documentation">
          <span class="material-icons search-icon">search</span>
          <span class="search-placeholder">Search documentation...</span>
          <span class="search-shortcut">/</span>
        </button>
      </div>
    </div>

    <!-- 5 Recent Wiki Entries -->
    <div class="home-section">
      <h2 class="section-title">Recently Added Documentation</h2>
      <div class="recent-docs-grid">
        ${recentHtml || '<p>No entries found.</p>'}
      </div>
    </div>

    <!-- All Features in One Section Grid (Commented Out as requested) -->
    <!--
    <div class="home-section">
      <h2 class="section-title">Why Liquid Galaxy?</h2>
      <div class="features-grid">
        <div class="feature-card">
          <img src="public/assets/rig.png" alt="" onerror="this.style.display='none'">
          <h3>Immersive Panoramic Display</h3>
          <p>Connects a cluster of machines and screens into a seamless 3D viewer. Built by the LAB community.</p>
        </div>
        <div class="feature-card">
          <img src="public/assets/opensource.svg" alt="" onerror="this.style.display='none'">
          <h3>Open Source Ecosystem</h3>
          <p>Driven by the global community and actively participating in Google Summer of Code (GSoC).</p>
        </div>
        <div class="feature-card">
          <img src="public/assets/usecases.svg" alt="" onerror="this.style.display='none'">
          <h3>Limitless Use Cases</h3>
          <p>Beyond GIS, serving as a powerful rig for interactive gaming like Asteroids, Pacman, and Pong.</p>
        </div>
        <div class="feature-card">
          <img src="public/assets/technologies.svg" alt="" onerror="this.style.display='none'">
          <h3>Cutting-Edge Tech</h3>
          <p>Bridging Ubuntu LTS clusters with Node.js, Python, TensorFlow, Flutter, and native Android.</p>
        </div>
      </div>
    </div>
    -->

    <!-- CTA Section at the end -->
    <div class="home-cta-section">
      <h2>Ready to Dive In?</h2>
      <p>Join our global open-source community. Explore apps on the store or contribute your own documentation.</p>
      <div class="home-cta-buttons">
        <button class="cta-primary" id="home-docs-btn">
          <span class="material-icons">menu_book</span> Read Documentation
        </button>
        <button class="cta-secondary" id="home-contribute-btn">
          <span class="material-icons">edit_note</span> How to Contribute
        </button>
        <a class="cta-secondary" href="https://store.liquidgalaxy.eu" target="_blank">
          <svg viewBox="0 0 68 32" height="24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path class="earth" d="M46.3449 19.1259C41.2313 12.3618 35.9813 17.5018 37.3517 22.2293C40.7988 29.7671 49.705 33.0839 57.2443 29.6374C59.8429 28.4494 62.0485 26.5445 63.6017 24.1466C59.6489 27.8482 52.471 27.2295 46.3449 19.1259Z" fill="#255FDB"></path>
            <path class="earth" d="M50.9165 14.4683C43.8835 3.8032 36 9.4868 36 16.0021C35.9972 18.1598 36.4624 20.2926 37.3636 22.2532C36.4279 17.8375 41.5023 14.4325 46.2273 20.7705C53.0881 29.9733 59.821 28.3543 63.5881 24.167C64.7979 22.3102 65.5792 20.2075 65.8756 18.0114V18.0403C64.2579 23.0576 57.1193 23.8739 50.9165 14.4683Z" fill="#4285F4"></path>
            <path class="earth" d="M55.7369 9.69641C50.5142 1.08154 43.8921 1.85696 39.4091 6.47371C37.1993 9.15694 35.9938 12.5263 36 16.0021C36.4688 9.69642 44.0966 5.30803 51 16.0021C57.1364 25.5202 64.7813 23.0405 65.8687 18.0676V18.0199C65.9639 17.3425 66.0044 16.6586 65.9898 15.9748V15.2931C63.3324 17.195 59.8381 16.4605 55.7369 9.69641Z" fill="#91BFFF"></path>
            <path class="earth" d="M55.7727 11.2302C60.5557 18.918 64.679 16.9513 66 15.3067C65.9466 14.1576 65.7607 13.0184 65.446 11.9119C63.2165 11.9579 62.6966 11.5864 60.5029 8.24612C57.15 3.10957 52.9262 -0.358538 45.5455 2.02738C43.1541 2.96514 41.042 4.49795 39.4091 6.48053C44.4801 1.81435 50.7017 3.0806 55.7727 11.2302Z" fill="#C4E1FF"></path>
            <path class="earth" d="M60.1756 8.90735C62.3625 12.2528 63.6937 12.4232 65.446 11.9119C63.174 3.93305 54.8629 -0.693625 46.8826 1.57794C46.4301 1.70674 45.9839 1.85672 45.5455 2.02739C52.1386 -0.051779 56.8142 3.7691 60.1756 8.90735Z" fill="#F5F5F5"></path>
            <path class="earth" d="M51 30.9994C59.2843 30.9994 66 24.285 66 16.0022C66 7.71949 59.2843 1.005 51 1.005C42.7157 1.005 36 7.71949 36 16.0022C36 24.285 42.7157 30.9994 51 30.9994Z" fill="url(#paint0_radial_45_2)" fill-opacity="0.1"></path>
            <path class="earth" d="M51 1.17543C59.251 1.17543 65.9531 7.83794 66 16.0874V16.0022C66 7.7195 59.2842 1.005 51 1.005C42.7157 1.005 36 7.7195 36 16.0022V16.0874C36.0469 7.83794 42.749 1.17543 51 1.17543Z" fill="white" fill-opacity="0.2"></path>
            <path class="earth" d="M51 30.8288C42.749 30.8288 36.0469 24.1663 36 15.9168V16.002C36 24.2848 42.7157 30.9993 51 30.9993C59.2843 30.9993 66 24.2848 66 16.0021V15.9168C65.9531 24.1663 59.251 30.8288 51 30.8288Z" fill="#1A237E" fill-opacity="0.2"></path>
            <path class="variant" d="M30.08 16.3333C30.08 15.2933 29.9867 14.2933 29.8133 13.3333H16V19.0133H23.8933C23.5467 20.84 22.5067 22.3867 20.9467 23.4267V27.12H25.7067C28.48 24.56 30.08 20.8 30.08 16.3333Z" fill="#C4E1FF"></path>
            <path class="google" d="M16 30.6667C19.96 30.6667 23.28 29.36 25.7067 27.12L20.9467 23.4267C19.64 24.3067 17.9733 24.84 16 24.84C12.1867 24.84 8.94668 22.2667 7.78668 18.8H2.90668V22.5867C5.32001 27.3733 10.2667 30.6667 16 30.6667Z" fill="#96C2FF"></path>
            <path class="google" d="M7.78665 18.7867C7.49331 17.9067 7.31998 16.9733 7.31998 16C7.31998 15.0267 7.49331 14.0933 7.78665 13.2133V9.42667H2.90665C1.90665 11.4 1.33331 13.6267 1.33331 16C1.33331 18.3733 1.90665 20.6 2.90665 22.5733L6.70665 19.6133L7.78665 18.7867Z" fill="#4E8CF5"></path>
            <path class="google" d="M16 7.17334C18.16 7.17334 20.08 7.92001 21.6133 9.36001L25.8133 5.16001C23.2667 2.78668 19.96 1.33334 16 1.33334C10.2667 1.33334 5.32001 4.62668 2.90668 9.42668L7.78668 13.2133C8.94668 9.74668 12.1867 7.17334 16 7.17334Z" fill="#2E65DC"></path>
            <defs>
              <radialGradient id="paint0_radial_45_2" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(40.5306 5.53492) scale(29.8023 29.7967)">
                <stop stop-color="white"></stop>
                <stop offset="1" stop-color="white" stop-opacity="0"></stop>
              </radialGradient>
              <clipPath id="clip0_45_2">
                <rect width="30" height="30" fill="white" transform="translate(36 1)"></rect>
              </clipPath>
            </defs>
          </svg> Visit GO Store
        </a>
      </div>
    </div>
  `;

  // Bind documentation reading CTA buttons
  const navigateToFirstDoc = () => {
    const firstPage = wikiIndex.pages && wikiIndex.pages.length > 0 ? wikiIndex.pages[0] : null;
    if (firstPage) {
      window.location.hash = firstPage.file;
    } else {
      window.location.hash = 'how-to-contribute-to-lg-wiki.md';
    }
  };

  const heroDocsBtn = document.getElementById('hero-docs-btn');
  if (heroDocsBtn) {
    heroDocsBtn.addEventListener('click', navigateToFirstDoc);
  }

  const heroContributeBtn = document.getElementById('hero-contribute-btn');
  if (heroContributeBtn) {
    heroContributeBtn.addEventListener('click', () => {
      window.location.hash = 'how-to-contribute-to-lg-wiki.md';
    });
  }

  const homeDocsBtn = document.getElementById('home-docs-btn');
  if (homeDocsBtn) {
    homeDocsBtn.addEventListener('click', navigateToFirstDoc);
  }

  // Bind the contribute button
  const ctaBtn = document.getElementById('home-contribute-btn');
  if (ctaBtn) {
    ctaBtn.addEventListener('click', () => {
      window.location.hash = 'how-to-contribute-to-lg-wiki.md';
    });
  }

  _lastSentHeight = 0;
  sendIframeHeight();
}

/**
 * Builds the MDN-style doc category grid from wikiIndex.pages.
 * Reads the same data array as the sidebar; reuses the same navigation
 * (loadPage + hash) so behavior is identical to clicking a sidebar item.
 * Purely additive — does not modify any existing app logic.
 */
function _renderDocGrid() {
  const grid = document.getElementById('home-doc-grid');
  if (!grid) return;

  const pages = wikiIndex.pages || [];

  if (pages.length === 0) {
    grid.innerHTML = '<p class="home-doc-grid-empty">No articles found.</p>';
    return;
  }

  grid.innerHTML = '';
  pages.forEach(page => {
    const item = document.createElement('div');
    item.className = 'home-doc-item';
    item.setAttribute('role', 'listitem');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-label', page.title);

    const title = document.createElement('span');
    title.className = 'home-doc-item-title';
    title.textContent = page.title;
    item.appendChild(title);

    // Navigate exactly like the sidebar click handler
    const navigate = () => {
      window.location.hash = page.file;
      loadPage(page.file);
      // Collapse drawer on smaller screens (same as sidebar)
      if (window.innerWidth < 960) {
        drawer.classList.add('collapsed');
      }
    };

    item.addEventListener('click', navigate);
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navigate();
      }
    });

    grid.appendChild(item);
  });
}



// Parse markdown frontmatter
function parseMarkdown(rawContent) {
  let content = rawContent;
  let contributor = "Community";

  const match = rawContent.match(/^---\n([\s\S]*?)\n---/);
  if (match) {
    const frontmatter = match[1];
    const contributorMatch = frontmatter.match(/contributor:\s*(.+)/);
    if (contributorMatch) {
      contributor = contributorMatch[1].trim();
    }
    content = rawContent.slice(match[0].length).trim();
  }

  // Rewrite relative image paths to GitHub Raw URLs (images stored in content/images/)
  const rawBaseUrl = `https://raw.githubusercontent.com/${CONTENT_OWNER}/${CONTENT_REPO}/main`;
  content = content.replace(/!\[([^\]]*)\]\(\/?images\/([^)]+)\)/g, `![$1](${rawBaseUrl}/content/images/$2)`);

  return { content, contributor };
}

// Load a specific markdown page
async function loadPage(filename) {
  markdownContent.innerHTML = `
    <div class="custom-loader-wrapper">
      <section class="custom-loader-section">
        <h2 class="visually-hidden">Loading</h2>
        <progress id="progress" class="visually-hidden" max="100" value="0"></progress>
        <svg width="120" height="120" viewBox="0 0 250 250" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g clip-path="url(#clip0_289_154)">
            <path class="circle" d="M130.231 25.1387L135.453 25.5488L140.644 26.2324L145.792 27.1865L150.874 28.4062L155.902 29.8965L160.83 31.6416L165.672 33.6465L170.387 35.8945L174.999 38.3984L179.469 41.1387L183.781 44.1016L187.917 47.2754L191.91 50.6846L195.709 54.29L199.314 58.0889L202.724 62.082L205.897 66.2178L208.86 70.5303L211.601 75L214.104 79.6123L216.353 84.3271L218.357 89.1689L220.103 94.0967L221.593 99.125L222.812 104.207L223.767 109.355L224.45 114.546L224.86 119.768L224.998 125L224.86 130.231L224.45 135.453L223.767 140.644L222.812 145.792L221.593 150.874L220.103 155.902L218.357 160.83L216.353 165.672L214.104 170.387L211.601 174.999L208.86 179.469L205.897 183.781L202.724 187.917L199.314 191.91L195.709 195.709L191.91 199.314L187.917 202.724L183.781 205.897L179.469 208.86L174.999 211.601L170.387 214.104L165.672 216.353L160.83 218.357L155.902 220.103L150.874 221.593L145.792 222.812L140.644 223.767L135.453 224.45L130.231 224.86L125 224.998L119.768 224.86L114.546 224.45L109.355 223.767L104.207 222.812L99.125 221.593L94.0967 220.103L89.1689 218.357L84.3271 216.353L79.6123 214.104L75 211.601L70.5303 41.1387L75 38.3984L79.6123 35.8945L84.3271 33.6465L89.1689 31.6416L94.0967 29.8965L99.125 28.4062L104.207 27.1865L109.355 26.2324L114.546 25.5488L119.768 25.1387L125 25.001L130.231 25.1387Z" stroke-width="10" stroke-linecap="round" pathLength="1" />
            <path class="loader" d="M102.299 25.915C115.38 14.7676 134.62 14.7676 147.701 25.915L150.17 28.0186C157.377 34.1606 166.339 37.8727 175.778 38.626L179.011 38.8838C196.144 40.251 209.749 53.8564 211.116 70.9893L211.374 74.2217C212.127 83.6612 215.839 92.6227 221.981 99.8301L224.085 102.299C235.232 115.38 235.232 134.62 224.085 147.701L221.981 150.17C215.839 157.377 212.127 166.339 211.374 175.778L211.116 179.011C209.749 196.144 196.144 209.749 179.011 211.116L175.778 211.374C166.339 212.127 157.377 215.839 150.17 221.981L147.701 224.085C134.62 235.232 115.38 235.232 102.299 224.085L99.8301 221.981C92.6227 215.839 83.6612 212.127 74.2217 211.374L70.9893 211.116C53.8564 209.749 40.251 196.144 38.8838 179.011L38.626 175.778C37.8727 166.339 34.1606 157.377 28.0186 150.17L25.915 147.701C14.7676 134.62 14.7676 115.38 25.915 102.299L28.0186 99.8301C34.1606 92.6227 37.8727 83.6612 38.626 74.2217L38.8838 70.9893C40.251 53.8564 53.8564 40.251 70.9893 38.8838L74.2217 38.626C83.6612 37.8727 92.6227 34.1606 99.8301 28.0186L102.299 25.915Z" stroke-width="10" stroke-linecap="round" pathLength="1" />
          </g>
          <defs>
            <clipPath id="clip0_289_154">
              <rect width="250" height="250" fill="white" />
            </clipPath>
          </defs>
        </svg>
      </section>
    </div>
  `;
  const rawMarkdown = await github.fetchDoc(filename);
  
  if (rawMarkdown === null) {
    renderHome();
  } else {
    const { content, contributor } = parseMarkdown(rawMarkdown);
    
    // Find title from wikiIndex
    const pageData = wikiIndex.pages.find(p => p.file === filename);
    const title = pageData ? pageData.title : filename.replace('.md', '');

    const titleHtml = `<div class="dynamic-title">${title}</div>`;
    const markdownHtml = marked.parse(content);
    const creditHtml = `<div class="doc-credit">Credit : ${contributor}</div>`;

    markdownContent.innerHTML = titleHtml + markdownHtml + creditHtml;
    attachCopyButtons(markdownContent);
    
    // [DESIGN] Apply active nav state and build TOC (purely visual, no functional impact)
    _currentFile = filename;
    _updateActiveNav(filename);
    _buildTOC();
    _renderDocNavigation(filename);
    
    // Open sidebar automatically when reading a document (on desktop)
    if (window.innerWidth >= 960) {
      const drawerNode = document.getElementById('drawer');
      const toggleBtn = document.getElementById('menu-toggle');
      if (drawerNode) drawerNode.classList.remove('collapsed');
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
    }

    // Ensure we scroll to the top of the newly loaded document
    const contentArea = document.querySelector('.content-area');
    if (contentArea) contentArea.scrollTo(0, 0);

        _lastSentHeight = 0;
        sendIframeHeight();
  }
}

// Setup Event Listeners — unchanged
function setupEventListeners() {
  // Toggle Drawer
  menuToggle.addEventListener('click', () => {
    const isNowOpen = drawer.classList.toggle('collapsed');
    menuToggle.setAttribute('aria-expanded', String(!drawer.classList.contains('collapsed')));
    _lastSentHeight = 0;
    setTimeout(() => {
      sendIframeHeight();
    }, 200);
  });

  // --- MDN-Style Search Functionality ---

  const openSearch = () => {
    if (searchDialog) {
      searchDialog.classList.add('active');
      // Small delay to ensure dialog is rendered before focusing
      setTimeout(() => dialogSearchInput?.focus(), 100);
      renderSearchResults(''); // Show initial state
    }
  };

  const closeSearch = () => {
    if (searchDialog) {
      searchDialog.classList.remove('active');
      if (dialogSearchInput) dialogSearchInput.value = '';
    }
  };

  if (headerSearchBtn) headerSearchBtn.addEventListener('click', openSearch);
  if (closeSearchBtn) closeSearchBtn.addEventListener('click', closeSearch);

  // Close when clicking outside the modal content (on the backdrop)
  if (searchDialog) {
    searchDialog.addEventListener('click', (e) => {
      if (e.target === searchDialog) {
        closeSearch();
      }
    });
  }

  // Global Keyboard shortcut for search
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== dialogSearchInput && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      openSearch();
    }
    // Escape to close
    if (e.key === 'Escape') {
      closeSearch();
    }
  });

  // Hero search overlay click listener (attached dynamically since renderHome destroys/recreates it)
  document.addEventListener('click', (e) => {
    const heroSearchOverlay = e.target.closest('#hero-search-overlay');
    if (heroSearchOverlay) {
      openSearch();
    }
  });

  let searchCurrentFocus = -1;
  let typingTimeout;
  const mdnSearchHeader = document.getElementById('mdn-search-header');

  // Search input typing logic
  if (dialogSearchInput) {
    dialogSearchInput.addEventListener('input', (e) => {
      searchCurrentFocus = -1; // reset focus
      const query = e.target.value.trim().toLowerCase();
      renderSearchResults(query);
      
      // Typing animation
      if (mdnSearchHeader) {
        mdnSearchHeader.classList.add('is-typing');
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
          mdnSearchHeader.classList.remove('is-typing');
        }, 600); // Animates for 600ms after last keystroke
      }
    });

    dialogSearchInput.addEventListener('keydown', (e) => {
      const resultsContainer = searchDialogResults;
      if (!resultsContainer) return;
      
      const items = resultsContainer.querySelectorAll('.mdn-search-result-item');
      if (items.length === 0) return;

      if (e.key === 'ArrowDown') {
        searchCurrentFocus++;
        if (searchCurrentFocus >= items.length) searchCurrentFocus = 0;
        setSearchActiveFocus(items);
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        searchCurrentFocus--;
        if (searchCurrentFocus < 0) searchCurrentFocus = items.length - 1;
        setSearchActiveFocus(items);
        e.preventDefault();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (searchCurrentFocus > -1) {
          if (items[searchCurrentFocus]) items[searchCurrentFocus].click();
        } else {
          // Default to first item if none specifically focused
          if (items.length > 0) items[0].click();
        }
      }
    });
  }

  function setSearchActiveFocus(items) {
    items.forEach(item => item.classList.remove('active-focus'));
    if (searchCurrentFocus >= 0 && searchCurrentFocus < items.length) {
      const activeItem = items[searchCurrentFocus];
      activeItem.classList.add('active-focus');
      activeItem.scrollIntoView({ block: 'nearest' });
    }
  }
  
  function highlightText(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<span class="mdn-search-highlight">$1</span>');
  }

  // Render results in the dialog
  function renderSearchResults(query) {
    if (!searchDialogResults) return;
    
    if (!query) {
      searchDialogResults.innerHTML = '<div class="search-empty">Type to start searching...</div>';
      return;
    }

    const filtered = wikiIndex.pages.filter(page => 
      page.title.toLowerCase().includes(query) || page.file.toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
      searchDialogResults.innerHTML = '<div class="search-empty" style="color:#f28b82;">No results found.</div>';
      return;
    }

    const html = filtered.map(page => `
      <div class="mdn-search-result-item" data-file="${page.file}" tabindex="0" role="button">
        <div class="mdn-search-result-breadcrumb">Liquid Galaxy / ${highlightText(page.file.replace('.md',''), query)}</div>
        <div class="mdn-search-result-title">${highlightText(page.title, query)}</div>
      </div>
    `).join('');

    searchDialogResults.innerHTML = html;

    // Attach click listeners to new results
    const items = searchDialogResults.querySelectorAll('.mdn-search-result-item');
    items.forEach(item => {
      item.addEventListener('click', () => {
        window.location.hash = item.getAttribute('data-file');
        closeSearch();
      });
      // Keyboard enter to select
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          window.location.hash = item.getAttribute('data-file');
          closeSearch();
        }
      });
    });
  }

  // Open Contribute Dialog from global header
  const headerContributeBtn = document.getElementById('header-contribute-btn');
}

// Handle hash changes for back/forward navigation and logo click (href="#")
window.addEventListener('hashchange', () => {
  const hash = window.location.hash.replace('#', '');
  if (!hash) {
    // Empty hash = navigate home (e.g. user clicked the logo)
    renderHome();
  } else if (hash.endsWith('.md')) {
    // Only load a page when the hash is a markdown filename
    loadPage(hash);
  }

  _lastSentHeight = 0;
  sendIframeHeight();
  setTimeout(() => {
    _lastSentHeight = 0;
    sendIframeHeight();
  }, 200);
});


// ── [DESIGN] Active nav state ────────────────────────────────────────────────
/**
 * Marks the matching md-list-item as .active and sets aria-current.
 * Purely visual — no routing or fetch logic involved.
 */
function _updateActiveNav(filename) {
  const items = navList.querySelectorAll('md-list-item');
  items.forEach(item => {
    const isActive = item.dataset.file === filename;
    item.classList.toggle('active', isActive);
    if (isActive) {
      item.setAttribute('aria-current', 'page');
      setTimeout(() => {
        item.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 100);
    } else {
      item.removeAttribute('aria-current');
    }
  });
}


// ── [DESIGN] On This Page — TOC builder ────────────────────────────────────
/**
 * Reads h2/h3 headings from the rendered markdown, builds a TOC list,
 * and uses IntersectionObserver to highlight the current section.
 * Purely additive and visual — does not touch any existing app logic.
 */
function _buildTOC() {
  const tocSidebar = document.getElementById('toc-sidebar');
  const tocNav = document.getElementById('toc-nav');
  if (!tocSidebar || !tocNav) return;

  // Disconnect previous observer
  if (_tocObserver) {
    _tocObserver.disconnect();
    _tocObserver = null;
  }

  const headings = Array.from(markdownContent.querySelectorAll('h2, h3'));

  // Hide TOC if not enough headings to be useful
  if (headings.length < 2) {
    tocSidebar.style.display = 'none';
    return;
  }

  // Ensure each heading has an id for anchor linking
  headings.forEach(heading => {
    if (!heading.id) {
      heading.id = heading.textContent
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/^-+|-+$/g, '');
    }
  });

  // Build TOC markup
  tocNav.innerHTML = '<p class="toc-heading" aria-hidden="true">On this page</p>';
  const list = document.createElement('ul');
  list.className = 'toc-list';
  list.setAttribute('role', 'list');

  headings.forEach(heading => {
    const li = document.createElement('li');
    li.className = `toc-item toc-${heading.tagName.toLowerCase()}`;

    const a = document.createElement('a');
    a.href = `#${heading.id}`;
    a.textContent = heading.textContent;
    a.className = 'toc-link';

    li.appendChild(a);
    list.appendChild(li);
  });

  tocNav.appendChild(list);
  tocSidebar.style.display = '';

  // IntersectionObserver to highlight active section
  const contentArea = document.querySelector('.content-area');
  _tocObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        const link = tocNav.querySelector(`a[href="#${CSS.escape(entry.target.id)}"]`);
        if (!link) return;
        if (entry.isIntersecting) {
          // Remove active from all, set on this one
          tocNav.querySelectorAll('.toc-link').forEach(l => l.classList.remove('active'));
          link.classList.add('active');
        }
      });
    },
    {
      root: contentArea,
      rootMargin: '-10% 0px -70% 0px',
      threshold: 0,
    }
  );

  headings.forEach(h => _tocObserver.observe(h));
}


// ── [DESIGN] Previous / Next Document Navigation ───────────────────────────
/**
 * Renders previous and next document links at the bottom of the article.
 */
function _renderDocNavigation(filename) {
  const pages = wikiIndex.pages || [];
  if (pages.length === 0) return;

  const currentIndex = pages.findIndex(p => p.file === filename);
  if (currentIndex === -1) return;

  const prevPage = currentIndex > 0 ? pages[currentIndex - 1] : null;
  const nextPage = currentIndex < pages.length - 1 ? pages[currentIndex + 1] : null;

  if (!prevPage && !nextPage) return;

  const navContainer = document.createElement('div');
  navContainer.className = 'doc-navigation';

  if (prevPage) {
    const prevLink = document.createElement('a');
    prevLink.href = `#${prevPage.file}`;
    prevLink.className = 'doc-nav-link doc-nav-prev';
    prevLink.innerHTML = `
      <span class="doc-nav-label">Previous</span>
      <span class="doc-nav-title">« ${prevPage.title}</span>
    `;
    navContainer.appendChild(prevLink);
  } else {
    const emptyDiv = document.createElement('div');
    navContainer.appendChild(emptyDiv);
  }

  if (nextPage) {
    const nextLink = document.createElement('a');
    nextLink.href = `#${nextPage.file}`;
    nextLink.className = 'doc-nav-link doc-nav-next';
    nextLink.innerHTML = `
      <span class="doc-nav-label">Next</span>
      <span class="doc-nav-title">${nextPage.title} »</span>
    `;
    navContainer.appendChild(nextLink);
  }

  markdownContent.appendChild(navContainer);
}


// ── [IFRAME COMMUNICATION] Send Height & Scroll Height to Parent Window ─────
/**
 * Sends current height, scrollHeight, scrollTop and window metrics to parent window
 * via postMessage when embedded inside an iframe (matches GitHub Issue #1 spec).
 */
let _lastSentHeight = 0;

function sendIframeHeight() {
  if (window.parent && window.parent !== window) {
    const markdownNode = document.getElementById('markdown-content');
    if (!markdownNode) return;

    // #markdown-content is a flex child that gets stretched to sidebar height.
    // Break flex-stretching temporarily to measure true content height.
    const prevAlignSelf = markdownNode.style.alignSelf;
    markdownNode.style.alignSelf = 'flex-start';
    const markdownHeight = Math.max(markdownNode.offsetHeight, 100);
    markdownNode.style.alignSelf = prevAlignSelf;

    // Guard: ignore tiny <3px variations to break infinite ResizeObserver loop
    if (Math.abs(markdownHeight - _lastSentHeight) < 3) {
      return;
    }
    _lastSentHeight = markdownHeight;

    const contentArea = document.querySelector('.content-area');
    const scrollTop = contentArea ? contentArea.scrollTop : window.scrollY;
    const clientHeight = contentArea ? contentArea.clientHeight : window.innerHeight;

    const payload = {
      type: 'iframe-height', // exact type specified in GitHub Issue #1
      action: 'resize',
      height: markdownHeight,         // Pure markdown height (no menu/wrapper padding loop)
      scrollHeight: markdownHeight,   // Scroll height of markdown content
      markdownHeight: markdownHeight,
      scrollTop: scrollTop,
      clientHeight: clientHeight,
      offsetHeight: markdownHeight,
      windowHeight: window.innerHeight,
      docHeight: markdownHeight,
      docScrollHeight: markdownHeight
    };

    window.parent.postMessage(payload, '*');
  }
}

/**
 * Sets up listeners and observers to automatically notify parent window of height & scroll changes.
 * Implements load, resize, ResizeObserver, MutationObserver, and window message listener.
 */
function setupIframeMessaging() {
  sendIframeHeight();

  // Load and scroll listeners
  window.addEventListener('load', sendIframeHeight);
  window.addEventListener('scroll', sendIframeHeight, { passive: true });
  window.addEventListener('resize', sendIframeHeight, { passive: true });

  const contentArea = document.querySelector('.content-area');
  if (contentArea) {
    contentArea.addEventListener('scroll', sendIframeHeight, { passive: true });
  }

  // ResizeObserver for DOM / content changes (as in Issue #1)
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(() => {
      sendIframeHeight();
    });
    if (document.body) observer.observe(document.body);
    if (contentArea) observer.observe(contentArea);
    const mainContent = document.getElementById('main-content');
    if (mainContent) observer.observe(mainContent);
    const markdownNode = document.getElementById('markdown-content');
    if (markdownNode) observer.observe(markdownNode);
  }

  // Fallback MutationObserver for content changes (as in Issue #1)
  if ('MutationObserver' in window && document.body) {
    const mutationObserver = new MutationObserver(() => {
      sendIframeHeight();
    });
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    });
  }

  // Support direct ping/request from parent window
  window.addEventListener('message', (e) => {
    if (!e.data) return;
    if (
      e.data === 'getHeight' ||
      e.data === 'requestHeight' ||
      e.data.type === 'getHeight' ||
      e.data.type === 'requestHeight'
    ) {
      sendIframeHeight();
    }
  });
}


init();
