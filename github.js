import { Octokit } from 'https://esm.sh/octokit';

// ── Public read-only content repo (no token required) ────────────────────────
const CONTENT_OWNER = 'LiquidGalaxyLAB';
const CONTENT_REPO  = 'lg-wiki-content';
const RAW_BASE      = `https://raw.githubusercontent.com/${CONTENT_OWNER}/${CONTENT_REPO}/main`;

export class GitHubService {
  constructor(owner, repo) {
    this.owner = owner;
    this.repo = repo;
    this.token = localStorage.getItem('github_token') || '';
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('github_token', token);
  }

  getOctokit() {
    return new Octokit({ auth: this.token });
  }

  /**
   * Fetches the wiki index from the public lg-wiki-content repo.
   * index.json lives at the repo root (not under content/).
   * No authentication required.
   */
  async fetchIndex() {
    try {
      const res = await fetch(`${RAW_BASE}/index.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.warn('Could not fetch index.json:', e.message);
    }
    return { pages: [] };
  }

  /**
   * Fetches a specific markdown file from the public lg-wiki-content repo.
   * Files live under content/<filename>.
   * No authentication required.
   */
  async fetchDoc(filename) {
    try {
      const res = await fetch(`${RAW_BASE}/content/${filename}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      console.warn(`Could not fetch ${filename}:`, e.message);
    }
    return null;
  }

  async submitPR(title, filename, markdownContent, pendingImages, contributorEmail) {
    if (!this.token) throw new Error("GitHub token is required to submit a PR.");
    
    const octokit = new Octokit({ auth: this.token });
    
    // 1. Get reference to main branch
    const { data: refData } = await octokit.rest.git.getRef({
      owner: this.owner,
      repo: this.repo,
      ref: "heads/main",
    }).catch(() => octokit.rest.git.getRef({
      owner: this.owner,
      repo: this.repo,
      ref: 'heads/master',
    }));
    const baseSha = refData.object.sha;

    // 2. Create new branch
    const branchName = `contrib-${Date.now()}`;
    await octokit.rest.git.createRef({
      owner: this.owner,
      repo: this.repo,
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    });

    let modifiedMarkdown = `---
title: ${title}
contributor: ${contributorEmail}
date: ${new Date().toISOString()}
---

${markdownContent}
`;

    // 3. Process all blob URLs inside the markdown
    const blobRegex = /!\[([^\]]*)\]\((blob:[^\)]+)\)/g;
    let match;
    const uploads = [];
    
    // Gather all blob matches that exist in pendingImages
    while ((match = blobRegex.exec(modifiedMarkdown)) !== null) {
      const blobUrl = match[2];
      const fileObj = pendingImages[blobUrl];
      if (fileObj) {
        uploads.push({ blobUrl, fileObj });
      }
    }

    // Upload each image and replace the blob URL in the markdown
    for (const upload of uploads) {
      const { blobUrl, fileObj } = upload;
      const imagePath = `content/images/${Date.now()}-${fileObj.name}`;
      
      // Convert raw File to Base64 for GitHub API
      const base64Image = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(fileObj);
      });

      // Upload image file
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path: imagePath,
        message: `Upload image ${fileObj.name}`,
        content: base64Image,
        branch: branchName,
      });

      // Replace the local blob URL with the final permanent path (relative to content/ dir)
      modifiedMarkdown = modifiedMarkdown.replace(blobUrl, `images/${imagePath.split('/').pop()}`);
    }

    // 4. Upload markdown file
    let fileSha = undefined;
    try {
      const existing = await octokit.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: `content/${filename}`,
        ref: branchName
      });
      if ("sha" in existing.data) {
        fileSha = existing.data.sha;
      }
    } catch (e) {}

    await octokit.rest.repos.createOrUpdateFileContents({
      owner: this.owner,
      repo: this.repo,
      path: `content/${filename}`,
      message: `Update ${filename}`,
      content: btoa(unescape(encodeURIComponent(modifiedMarkdown))),
      branch: branchName,
      sha: fileSha
    });

    // 4.5 Update index.json
    let indexData = { pages: [] };
    let indexSha = undefined;
    try {
      const existingIndex = await octokit.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: "content/index.json",
        ref: branchName
      });
      if ("content" in existingIndex.data) {
        indexSha = existingIndex.data.sha;
        indexData = JSON.parse(decodeURIComponent(escape(atob(existingIndex.data.content))));
      }
    } catch (e) {}

    // Migration for older JSONs
    if (indexData.categories) {
      indexData.pages = indexData.categories.flatMap(c => c.pages || []);
      delete indexData.categories;
    }
    if (!indexData.pages) {
      indexData.pages = [];
    }

    const id = filename.replace(/\.md$/, '');
    const existingPageIndex = indexData.pages.findIndex(p => p.file === filename || p.id === id);
    if (existingPageIndex !== -1) {
      indexData.pages[existingPageIndex].title = title;
      indexData.pages[existingPageIndex].id = id;
    } else {
      indexData.pages.push({ id, title, file: filename });
    }

    await octokit.rest.repos.createOrUpdateFileContents({
      owner: this.owner,
      repo: this.repo,
      path: "content/index.json",
      message: `Update index.json for ${title}`,
      content: btoa(unescape(encodeURIComponent(JSON.stringify(indexData, null, 2)))),
      branch: branchName,
      sha: indexSha
    });

    // 5. Create Pull Request
    const { data: prData } = await octokit.rest.pulls.create({
      owner: this.owner,
      repo: this.repo,
      title: `New Document: ${title}`,
      head: branchName,
      base: refData.ref.replace('refs/heads/', ''),
      body: `**Contributor:** ${contributorEmail}\n\nThis PR automatically adds the Markdown file and updates \`index.json\`. Merge to publish.`,
    });

    return prData.html_url;
  }
}
