/**
 * Clipboard helpers shared by the share and press pages.
 *
 * Buttons with `data-copy-text` (and `data-copied-label`) stay hidden until we
 * know the browser can copy; the text is always visible next to them anyway.
 */

// A changed button label is not announced by screen readers; a status region is.
let status: HTMLElement | undefined;
function announce(message: string) {
  if (!status) {
    status = document.createElement('p');
    status.className = 'sr-only';
    status.setAttribute('role', 'status');
    document.body.append(status);
  }
  status.textContent = message;
}

/** Copy text and briefly show a confirmation on the button. */
export async function copyWithFeedback(button: HTMLElement, value: string, doneLabel: string) {
  try {
    await navigator.clipboard.writeText(value);
    const original = button.textContent;
    button.textContent = doneLabel;
    announce(doneLabel);
    setTimeout(() => {
      button.textContent = original;
      announce('');
    }, 2000);
  } catch {
    window.prompt('', value);
  }
}

export function initCopyButtons() {
  document.querySelectorAll<HTMLButtonElement>('[data-copy-text]').forEach((button) => {
    if (!navigator.clipboard || button.dataset.copyReady) return;
    button.dataset.copyReady = '1';
    button.hidden = false;
    button.addEventListener('click', () =>
      copyWithFeedback(button, button.dataset.copyText || '', button.dataset.copiedLabel || ''),
    );
  });
}
