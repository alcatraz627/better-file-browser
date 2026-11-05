// Entry for plugins that work on ordinary websites rather than local files.
//
// This bundle runs in the page's own context, because that is the only place a
// site's map object can be reached. It has no extension privileges, and it loads
// on the hosts listed for it in manifest.json, so a new plugin adds its sites
// there as well as here. docs/site-plugins.md explains how to add one.

import { startMetro } from './site-metro';

interface SitePlugin {
  id: string;
  /** The page hosts this plugin runs on. */
  hosts: RegExp;
  start(): void;
}

const PLUGINS: SitePlugin[] = [
  { id: 'metro-map', hosts: /(^|\.)(booking\.com|airbnb\.[a-z.]+)$/i, start: startMetro },
];

for (const plugin of PLUGINS) {
  if (!plugin.hosts.test(location.hostname)) continue;
  try {
    plugin.start();
  } catch (err) {
    console.warn(`[bfb] ${plugin.id} could not start`, err);
  }
}
