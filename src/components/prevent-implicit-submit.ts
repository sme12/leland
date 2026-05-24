import type { KeyboardEvent } from 'react';

export function preventImplicitSubmit(event: KeyboardEvent<HTMLFormElement>) {
  if (
    event.key !== 'Enter' ||
    event.defaultPrevented ||
    event.nativeEvent.isComposing
  ) {
    return;
  }

  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (!event.currentTarget.contains(target) || allowsEnterKey(target)) {
    return;
  }

  event.preventDefault();
}

function allowsEnterKey(target: HTMLElement) {
  if (target instanceof HTMLTextAreaElement || target.isContentEditable) {
    return true;
  }

  if (target instanceof HTMLSelectElement) {
    return true;
  }

  if (target instanceof HTMLButtonElement) {
    return true;
  }

  if (target instanceof HTMLInputElement) {
    return ['button', 'reset', 'submit'].includes(target.type);
  }

  return false;
}
