// Entry for the tools bfb adds to every ordinary website: Lights (dark mode)
// and Marks (your comments and pins). It runs in the extension's isolated world
// from document_start, so Lights can take over before the first paint, and it
// answers the right-click menu and keyboard shortcuts sent by the background.

import { setLightsMode, startLights, toggleLights, LIGHTS_MODES, type LightsMode, onLightsChange } from './site-lights';
import { commentOnSelection, contextPoint, pinAt, startMarks, startPinDrop } from './site-marks';
import { togglePanel } from './site-tools-panel';
import { syncTheme } from './site-tools-overlay';

// Only the top page: an embedded frame would get its own panel and pins.
if (window === window.top && !(window as unknown as { __bfbSiteTools?: boolean }).__bfbSiteTools) {
  (window as unknown as { __bfbSiteTools?: boolean }).__bfbSiteTools = true;
  void startLights();
  onLightsChange(syncTheme);
  const marks = () => void startMarks();
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', marks, { once: true });
  else marks();

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg?.type !== 'bfb-site-tools') return;
    switch (msg.action) {
      case 'lights-toggle': void toggleLights(); break;
      case 'lights-set':
        if (LIGHTS_MODES.includes(msg.mode)) void setLightsMode(msg.mode as LightsMode, msg.scope === 'default' ? 'default' : 'site');
        break;
      // One key for both: words selected make a comment, otherwise a pin is dropped.
      case 'mark':
        if (getSelection()?.isCollapsed === false) commentOnSelection(); else startPinDrop();
        break;
      case 'comment': commentOnSelection(); break;
      case 'pin-here': { const p = contextPoint(); pinAt(p.x, p.y); break; }
      case 'panel': togglePanel(); break;
    }
    reply({ ok: true });
  });
}
