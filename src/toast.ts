// One short message at the bottom of the page, optionally with a single
// action such as undo. The explorer and the file page each mount one.
export interface ToastAction { label: string; run: () => void }
export type Toast = (msg: string, ms?: number, action?: ToastAction) => void;

export function makeToast(el: HTMLElement): Toast {
  let tid: ReturnType<typeof setTimeout> | undefined;
  return (msg, ms = 2400, action) => {
    el.textContent = msg;
    if (action) {
      const btn = document.createElement('button');
      btn.className = 'fe-toast-act';
      btn.textContent = action.label;
      btn.addEventListener('click', () => { action.run(); el.classList.remove('show'); });
      el.append(' · ', btn);
      ms = Math.max(ms, 6000);
    }
    el.classList.toggle('act', !!action);
    el.classList.add('show');
    clearTimeout(tid);
    tid = setTimeout(() => el.classList.remove('show'), ms);
  };
}
