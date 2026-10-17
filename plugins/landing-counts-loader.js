/**
 * @fileoverview A webpack loader for the documentation landing page. It passes the page on as it
 * is and makes the examples page one of the page's dependencies.
 *
 * remarkCookbookCounts (landing-counts.js) reads the examples page while the landing page
 * compiles, and webpack does not see that read. With the examples page among the landing page's
 * dependencies, a change to it compiles the landing page again: a running dev server rebuilds it,
 * and a build does not take it from webpack's persistent cache. landingCountsPlugin adds this
 * loader to the landing page alone.
 *
 * Options: `examplesPage`, the path of the examples page.
 */

module.exports = function landingCountsLoader(source, sourceMap, meta) {
  this.addDependency(this.getOptions().examplesPage);
  this.callback(null, source, sourceMap, meta);
};
