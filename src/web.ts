// The phone build's entry: the Chrome stand-ins first, then the Mac's own
// settings (Saved, Notes folder, folders allowed for comments, look), then the
// app itself, unchanged, and its phone layout.
import { seedFromMac } from './web-shim';

void seedFromMac().finally(() => { void import('./main'); void import('./phone-ui'); });
