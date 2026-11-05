// Whether the folder listing is what the main pane is showing right now. Home,
// file pages and decision pages all replace it, while the listing stays mounted
// underneath. Anything that belongs to the listing (its views, its keys) asks here.
//
// The stylesheet alone decides, on #fe-listing, so the list of pages that replace
// the listing lives in one place and a new listing part cannot be left out of it.
//
// The answer depends only on #fe's classes, and asking the stylesheet forces a style
// pass, so it is kept until they change.
let askedFor: string | null = null, answer = false;
export function listingShown(): boolean {
  const fe = document.getElementById('fe'), listing = document.getElementById('fe-listing');
  if (!fe || !listing) return false;
  if (fe.className !== askedFor) {
    askedFor = fe.className;
    answer = getComputedStyle(listing).display !== 'none';
  }
  return answer;
}
