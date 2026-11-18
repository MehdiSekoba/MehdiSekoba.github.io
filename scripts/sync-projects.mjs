const owner = 'MehdiSekoba';
const token = process.env.GITHUB_TOKEN;
const config = JSON.parse(await (await import('node:fs/promises')).readFile('portfolio.config.json', 'utf8'));
const headers = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  ...(token ? { Authorization: `Bearer ${token}` } : {})
};
async function api(url, accept = headers.Accept) {
  const res = await fetch(url, { headers: { ...headers, Accept: accept } });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${url}`);
  return res;
}
function firstReadmeImage(markdown, repo, branch) {
  const patterns = [
    /!\[[^\]]*\]\((https?:\/\/[^\s)]+|[^\s)]+)(?:\s+[^)]*)?\)/i,
    /<img[^>]+src=["']([^"']+)["']/i
  ];
  for (const pattern of patterns) {
    const match = markdown.match(pattern);
    if (!match) continue;
    let url = match[1].replace(/&amp;/g, '&');
    if (/shields\.io|badge|license/i.test(url)) continue;
    if (url.startsWith('//')) return `https:${url}`;
    if (url.startsWith('http')) return url;
    url = url.replace(/^\.\//, '').replace(/^\//, '');
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${url}`;
  }
  return `https://opengraph.githubassets.com/1/${owner}/${repo}`;
}
const reposRes = await api(`https://api.github.com/users/${owner}/repos?per_page=100&type=owner&sort=updated`);
const repos = await reposRes.json();
const includeNames = new Set(config.include_repositories || []);
const excluded = new Set(config.exclude_repositories || []);
const selected = [];
for (const repo of repos) {
  if (repo.private || repo.fork || repo.archived || excluded.has(repo.name)) continue;
  let topics = [];
  try {
    const topicRes = await api(`https://api.github.com/repos/${owner}/${repo.name}/topics`);
    topics = (await topicRes.json()).names || [];
  } catch { /* A missing topics endpoint must not block known featured repos. */ }
  if (!includeNames.has(repo.name) && !topics.includes(config.include_topic || 'portfolio')) continue;
  let readme = '';
  try {
    const readmeRes = await api(`https://api.github.com/repos/${owner}/${repo.name}/readme`, 'application/vnd.github.raw+json');
    readme = await readmeRes.text();
  } catch { /* README is optional. */ }
  const description = (repo.description || readme.match(/^#?\s*.*\n+([^\n#][^\n]+)/m)?.[1] || 'Open-source Android project.').trim();
  selected.push({
    name: repo.name,
    full_name: repo.full_name,
    description,
    url: repo.html_url,
    image: firstReadmeImage(readme, repo.name, repo.default_branch),
    language: repo.language || 'Open Source',
    topics: topics.slice(0, 5),
    stars: repo.stargazers_count,
    updated_at: repo.updated_at,
    created_at: repo.created_at,
  });
}
selected.sort((a, b) => {
  return new Date(b.created_at) - new Date(a.created_at);
});
const fs = await import('node:fs/promises');
await fs.writeFile('projects.json', JSON.stringify(selected, null, 2) + '\n');
console.log(`Synced ${selected.length} portfolio repositories.`);
