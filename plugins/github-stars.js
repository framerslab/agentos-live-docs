/**
 * @fileoverview The star badge on the home page. docusaurus.config.ts reads the repository's star
 * count from GitHub's API when the site builds and hands the page the badge through
 * `customFields`, so a visitor's browser never calls GitHub. When the read fails, the badge names
 * the repository and shows no count: a number written here goes stale (the fallback that stood
 * here said 268 while the repository had 678 stars).
 */

const LOOK = 'style=for-the-badge&logo=github&logoColor=white&labelColor=4f46e5';

/**
 * Reads a repository's star count from GitHub's API.
 *
 * @param {string} repo `owner/name`
 * @param {object} [options]
 * @param {string} [options.token] a GitHub token, sent as a bearer token when given
 * @param {string} [options.apiBase] the API's address, `https://api.github.com` unless a test sets it
 * @param {{ log: (message: string) => void, warn: (message: string) => void }} [options.log]
 * @returns {Promise<number | null>} the count, or null when the read fails or the answer holds no count
 */
async function fetchGithubStars(repo, { token, apiBase = 'https://api.github.com', log = console } = {}) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'agentos-live-docs-build',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  try {
    const res = await fetch(`${apiBase}/repos/${repo}`, { headers });
    if (!res.ok) {
      log.warn(`[stars] ${repo} fetch returned ${res.status}; the badge shows no count`);
      return null;
    }
    const data = await res.json();
    const stars = data && data.stargazers_count;
    if (!Number.isInteger(stars) || stars < 0) {
      log.warn(`[stars] ${repo} answered without a star count; the badge shows no count`);
      return null;
    }
    log.log(`[stars] ${repo}: ${stars}`);
    return stars;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    log.warn(`[stars] ${repo} fetch failed: ${reason}; the badge shows no count`);
    return null;
  }
}

/**
 * The home page's star badge: the count when the build read one, else the repository's name.
 *
 * @param {string} repo `owner/name`
 * @param {number | null} stars
 * @returns {{ src: string, alt: string }}
 */
function starsBadge(repo, stars) {
  if (Number.isInteger(stars) && stars >= 0) {
    return { src: `https://img.shields.io/badge/stars-${stars}-6366f1?${LOOK}`, alt: `GitHub stars: ${stars}` };
  }
  // shields.io reads a dash as the separator and an underscore as a space; doubled, each is literal.
  const name = encodeURIComponent(repo.replace(/-/g, '--').replace(/_/g, '__'));
  return { src: `https://img.shields.io/badge/GitHub-${name}-6366f1?${LOOK}`, alt: `${repo} on GitHub` };
}

module.exports = { fetchGithubStars, starsBadge };
