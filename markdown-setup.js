import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';

// Configure highlight.js for syntax highlighting
marked.use(markedHighlight({
  langPrefix: 'hljs language-',
  highlight(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
    return hljs.highlight(code, { language }).value;
  }
}));

// Configure custom image renderer for zooming
const renderer = new marked.Renderer();
renderer.image = function(tokenOrHref, titleStr, textStr) {
  // marked v12+ uses a single token object
  const href = typeof tokenOrHref === 'object' ? tokenOrHref.href : tokenOrHref;
  const title = typeof tokenOrHref === 'object' ? tokenOrHref.title : titleStr;
  const text = typeof tokenOrHref === 'object' ? tokenOrHref.text : textStr;

  return `<span class="zoomable-image-wrapper">
            <img src="${href}" alt="${text}" title="${title || ''}">
            <span class="material-icons zoom-icon">zoom_in</span>
          </span>`;
};
marked.use({ renderer });

// Inject Lightbox globally
if (!document.getElementById('global-lightbox')) {
  const lightbox = document.createElement('div');
  lightbox.id = 'global-lightbox';
  lightbox.className = 'lightbox';
  lightbox.innerHTML = `<img id="global-lightbox-img" src="" alt="Zoomed Image">`;
  document.body.appendChild(lightbox);

  document.body.addEventListener('click', (e) => {
    const wrapper = e.target.closest('.zoomable-image-wrapper');
    if (wrapper) {
      const img = wrapper.querySelector('img');
      const full = document.getElementById('global-lightbox-img');
      full.src = img.src;
      // transform-origin is relative to the target's own box, so subtract its offset
      const t = img.getBoundingClientRect();
      const f = full.getBoundingClientRect();
      full.style.transformOrigin =
        `${t.left + t.width / 2 - f.left}px ${t.top + t.height / 2 - f.top}px`;
      lightbox.classList.add('active');
    }
    
    // Close lightbox if clicked outside the image
    if (e.target.id === 'global-lightbox' || e.target.id === 'global-lightbox-img') {
      document.getElementById('global-lightbox').classList.remove('active');
    }
  });
}

// Attach Copy Buttons to Code Blocks
export function attachCopyButtons(container) {
  const codeBlocks = container.querySelectorAll('pre');
  codeBlocks.forEach(pre => {
    if (pre.parentElement.classList.contains('code-block-wrapper')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper';
    const codeEl = pre.querySelector('code');
    const langMatch = codeEl && codeEl.className.match(/language-([\w-]+)/);
    if (langMatch && langMatch[1] !== 'plaintext' && langMatch[1] !== 'undefined') {
      wrapper.dataset.lang = langMatch[1];
    }
    pre.parentNode.insertBefore(wrapper, pre);
    
    const btn = document.createElement('button');
    btn.className = 'copy-code-btn';
    btn.title = 'Copy code';
    btn.innerHTML = '<span class="material-icons">content_copy</span>';
    
    btn.addEventListener('click', async () => {
      const code = pre.textContent;
      try {
        await navigator.clipboard.writeText(code);
        btn.innerHTML = '<span class="material-icons">check</span>';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.innerHTML = '<span class="material-icons">content_copy</span>';
          btn.classList.remove('copied');
        }, 2000);
      } catch (err) {
        console.error('Failed to copy', err);
      }
    });
    
    wrapper.appendChild(pre);
    wrapper.appendChild(btn);
  });
}

export { marked };
