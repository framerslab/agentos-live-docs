const http = require('node:http');
const test = require('node:test');
const assert = require('node:assert/strict');

const { fetchGithubStars, starsBadge } = require('./github-stars.js');

const REPO = 'framerslab/agentos';
const LOOK = 'style=for-the-badge&logo=github&logoColor=white&labelColor=4f46e5';
const quiet = { log() {}, warn() {} };

// A stand-in for GitHub's API on a local port. It answers every request with one status and body
// and records what it was asked.
async function withApi(status, body, run) {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push({ url: req.url, authorization: req.headers.authorization });
    res.writeHead(status, { 'content-type': 'application/json', connection: 'close' });
    res.end(typeof body === 'string' ? body : JSON.stringify(body));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    return await run(`http://127.0.0.1:${server.address().port}`, requests);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

test('the badge shows the star count GitHub answers', async () => {
  await withApi(200, { full_name: REPO, stargazers_count: 678 }, async (apiBase, requests) => {
    const stars = await fetchGithubStars(REPO, { token: 'a-token', apiBase, log: quiet });

    assert.equal(stars, 678);
    assert.deepEqual(requests, [{ url: `/repos/${REPO}`, authorization: 'Bearer a-token' }]);
    assert.deepEqual(starsBadge(REPO, stars), {
      src: `https://img.shields.io/badge/stars-678-6366f1?${LOOK}`,
      alt: 'GitHub stars: 678',
    });
  });
});

// A count the build could not read is never replaced by a number written in the source. The
// fallback that stood in for it said 268 while the repository had 678 stars.
const noCount = {
  src: `https://img.shields.io/badge/GitHub-framerslab%2Fagentos-6366f1?${LOOK}`,
  alt: 'framerslab/agentos on GitHub',
};

for (const [what, status, body] of [
  ['a rejected token (401)', 401, { message: 'Bad credentials' }],
  ['a rate limit (403)', 403, { message: 'API rate limit exceeded' }],
  ['an outage (503)', 503, 'Service Unavailable'],
  ['an answer with no count', 200, { full_name: REPO }],
  ['a body that is not JSON', 200, '<html>'],
]) {
  test(`after ${what} the badge names the repository and shows no count`, async () => {
    await withApi(status, body, async (apiBase) => {
      const stars = await fetchGithubStars(REPO, { apiBase, log: quiet });

      assert.equal(stars, null);
      assert.deepEqual(starsBadge(REPO, stars), noCount);
    });
  });
}

test('when the API cannot be reached the badge shows no count', async () => {
  // A port that was free a moment ago: nothing listens there, so the connection is refused.
  const port = await withApi(200, {}, async (apiBase) => Number(new URL(apiBase).port));
  const stars = await fetchGithubStars(REPO, { apiBase: `http://127.0.0.1:${port}`, log: quiet });

  assert.equal(stars, null);
  assert.deepEqual(starsBadge(REPO, stars), noCount);
});
