
const owner = 'MehdiSekoba';
const token = process.env.GITHUB_TOKEN;

const config = JSON.parse(
  await (
    await import('node:fs/promises')
  ).readFile('portfolio.config.json', 'utf8')
);

const headers = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  ...(token ? { Authorization: `Bearer ${token}` } : {})
};

// --------------------------------------------------
// GitHub API
// --------------------------------------------------

async function api(url, accept = headers.Accept) {
  const res = await fetch(url, {
    headers: {
      ...headers,
      Accept: accept
    }
  });

  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${url}`);
  }

  return res;
}

// --------------------------------------------------
// Image helpers
// --------------------------------------------------

function normalizeImageUrl(url, repo, branch) {
  url = url.replace(/&amp;/g, '&').trim();

  if (url.startsWith('//')) {
    return `https:${url}`;
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  url = url.replace(/^\.\//, '').replace(/^\//, '');

  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${url}`;
}

function isUsefulImage(path) {
  if (!/\.(png|jpe?g|webp|gif|avif)$/i.test(path)) {
    return false;
  }

  return !/(badge|license|shield|social-preview|avatar)/i.test(path);
}

// --------------------------------------------------
// Extract images from README
// --------------------------------------------------

function readmeImages(markdown, repo, branch) {
  const images = [];

  const patterns = [
    /!\[[^\]]*\]\((https?:\/\/[^\s)]+|[^)\s]+)(?:\s+[^)]*)?\)/gi,
    /<img[^>]+src=["']([^"']+)["']/gi
  ];

  for (const pattern of patterns) {
    for (const match of markdown.matchAll(pattern)) {
      const raw = match[1];

      if (!isUsefulImage(raw)) {
        continue;
      }

      images.push(
        normalizeImageUrl(raw, repo, branch)
      );
    }
  }

  return [...new Set(images)];
}

// --------------------------------------------------
// Extract images from repository folders
// --------------------------------------------------

async function repositoryImages(repo, branch) {
  try {
    const response = await api(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
    );

    const result = await response.json();
    const tree = result.tree || [];

    const preferredFolders = [
      'art/',
      'assets/',
      'screenshots/',
      'images/',
      'demo/'
    ];

    const files = tree
      .filter(item =>
        item.type === 'blob' &&
        isUsefulImage(item.path)
      )
      .sort((a, b) => {
        const score = path => {
          const lower = path.toLowerCase();

          const index = preferredFolders.findIndex(folder =>
            lower.startsWith(folder)
          );

          return index === -1 ? 999 : index;
        };

        return score(a.path) - score(b.path);
      });

    return files.map(file =>
      `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file.path}`
    );

  } catch (error) {
    console.warn(
      `Could not scan images for ${repo}:`,
      error.message
    );

    return [];
  }
}

// --------------------------------------------------
// Fetch repositories
// --------------------------------------------------

const reposRes = await api(
  `https://api.github.com/users/${owner}/repos?per_page=100&type=owner&sort=updated`
);

const repos = await reposRes.json();

const includeNames = new Set(
  config.include_repositories || []
);

const excluded = new Set(
  config.exclude_repositories || []
);

const selected = [];

// --------------------------------------------------
// Process repositories
// --------------------------------------------------

for (const repo of repos) {

  if (
    repo.private ||
    repo.fork ||
    repo.archived ||
    excluded.has(repo.name)
  ) {
    continue;
  }

  // Topics
  let topics = [];

  try {
    const topicRes = await api(
      `https://api.github.com/repos/${owner}/${repo.name}/topics`
    );

    topics = (await topicRes.json()).names || [];

  } catch {
    // A missing topics endpoint must not block known featured repos.
  }

  // Filter repositories
  if (
    !includeNames.has(repo.name) &&
    !topics.includes(config.include_topic || 'portfolio')
  ) {
    continue;
  }

  // README
  let readme = '';

  try {
    const readmeRes = await api(
      `https://api.github.com/repos/${owner}/${repo.name}/readme`,
      'application/vnd.github.raw+json'
    );

    readme = await readmeRes.text();

  } catch {
    // README is optional.
  }

  // Description
  const description = (
    repo.description ||
    readme.match(/^#?\s*.*\n+([^\n#][^\n]+)/m)?.[1] ||
    'Open-source Android project.'
  ).trim();

  // ------------------------------------------------
  // Collect images
  // ------------------------------------------------

  const imagesFromReadme = readmeImages(
    readme,
    repo.name,
    repo.default_branch
  );

  const imagesFromFolders = await repositoryImages(
    repo.name,
    repo.default_branch
  );

  // README images have higher priority
  const images = [
    ...new Set([
      ...imagesFromReadme,
      ...imagesFromFolders
    ])
  ];

  // ------------------------------------------------
  // Save repository data
  // ------------------------------------------------

  selected.push({
    name: repo.name,
    full_name: repo.full_name,
    description,
    url: repo.html_url,

    image:
      images[0] ||
      `https://opengraph.githubassets.com/1/${owner}/${repo.name}`,

    images,

    language: repo.language || 'Open Source',
    topics: topics.slice(0, 5),
    stars: repo.stargazers_count,
    updated_at: repo.updated_at,
    created_at: repo.created_at
  });

  console.log(
    `${repo.name}: ${images.length} images found`
  );
}

// --------------------------------------------------
// Sort: newest repository first
// --------------------------------------------------

selected.sort((a, b) => {
  return new Date(b.created_at) - new Date(a.created_at);
});

// --------------------------------------------------
// Save projects.json
// --------------------------------------------------

const fs = await import('node:fs/promises');

await fs.writeFile(
  'projects.json',
  JSON.stringify(selected, null, 2) + '\n'
);

console.log(
  `Synced ${selected.length} portfolio repositories.`
);
