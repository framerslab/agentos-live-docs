/**
 * @fileoverview The star badge on the home page. docusaurus.config.ts reads the repository's star
 * count from GitHub's API when the site builds and hands the page the badge through
 * `customFields`, so a visitor's browser never calls GitHub. If the read fails, the count falls
 * back to a hardcoded floor.
 */

const STAR_COUNT_FALLBACK = 268;
const LOOK = 'style=for-the-badge&logo=github&logoColor=white&labelColor=4f46e5';

/**
 * Reads a repository's star count from GitHub's API.
 *
 * @param {string} repo `owner/name`
 * @param {object} [options]
 * @param {string} [options.token] a GitHub token, sent as a bearer token when given
 * @param {string} [options.apiBase] the API's address, `https://api.github.com` unless a test sets it
 * @param {{ log: (message: string) => void, warn: (message: string) => void }} [options.log]
 * @returns {Promise<number>}
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
      log.warn(`[stars] ${repo} fetch returned ${res.status}; using fallback ${STAR_COUNT_FALLBACK}`);
      return STAR_COUNT_FALLBACK;
    }
    const data = await res.json();
    if (typeof data.stargazers_count !== 'number') {
      return STAR_COUNT_FALLBACK;
    }
    log.log(`[stars] ${repo}: ${data.stargazers_count}`);
    return data.stargazers_count;
  } catch (err) {
    log.warn(`[stars] ${repo} fetch failed: ${err.message}; using fallback`);
    return STAR_COUNT_FALLBACK;
  }
}

/**
 * The home page's star badge.
 *
 * @param {string} repo `owner/name`
 * @param {number} stars
 * @returns {{ src: string, alt: string }}
 */
function starsBadge(repo, stars) {
  return { src: `https://img.shields.io/badge/stars-${stars}-6366f1?${LOOK}`, alt: `GitHub stars: ${stars}` };
}

module.exports = { fetchGithubStars, starsBadge };
