// The message a list shows in place of rows: while it loads, when there is
// nothing in it, when a filter hides everything, or when it could not be
// read. Every list uses this one part so the four cases read the same
// everywhere (docs/system/empty-state.md).
import { esc } from './utils';

/// Why a list has no rows to show.
export type ListState = 'loading' | 'empty' | 'filtered' | 'failed';

/// A button under the message. `a` is the action name the list's own click
/// handler reads from `data-a`; `id` is for lists that wire buttons by id.
export interface EmptyAction { label: string; title: string; a?: string; id?: string; icon?: string }

export interface EmptyOpts {
  /// A second, quieter line: what to do next, or the error's own words.
  hint?: string;
  /// The hint as markup, for a hint that shows a key.
  hintHtml?: string;
  /// A large icon above the text; panels use it, lists inside menus do not.
  icon?: string;
  actions?: EmptyAction[];
  /// Inline sits in a list among rows (a menu, the sidebar, a tree level);
  /// the default is centered in the space the list would fill.
  inline?: boolean;
  /// How deep in the tree this empty level sits, for its indent.
  indent?: number;
}

export function emptyHtml(state: ListState, text: string, o: EmptyOpts = {}): string {
  const hint = o.hintHtml ?? (o.hint ? esc(o.hint) : '');
  const acts = (o.actions ?? []).map(a =>
    `<button type="button" class="btn" data-size="sm" data-variant="outline"${a.id ? ` id="${a.id}"` : ''}${a.a ? ` data-a="${a.a}"` : ''} title="${esc(a.title)}">${a.icon ?? ''}<span>${esc(a.label)}</span></button>`).join('');
  return `<div class="empty" data-state="${state}"${o.inline ? ' data-inline' : ' role="status"'}${o.indent !== undefined ? ` data-indent style="--depth:${o.indent}"` : ''}>`
    + (o.icon ? `<span class="empty-ico">${o.icon}</span>` : '')
    + `<p class="empty-t">${esc(text)}</p>`
    + (hint ? `<p class="empty-h">${hint}</p>` : '')
    + (acts ? `<div class="empty-a">${acts}</div>` : '')
    + `</div>`;
}

/// The one action a filtered-empty list offers: drop the filter.
export const CLEAR: EmptyAction = { a: 'clear', label: 'Clear filter', title: 'Show everything again' };
