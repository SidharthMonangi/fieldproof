'use client';
import { useRef } from 'react';
export function useModalFocus() {
  const origin = useRef<HTMLElement | null>(null);
  const rememberFocus = () => {
    origin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  };
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    if (origin.current?.isConnected && !origin.current.hasAttribute('disabled'))
      origin.current.focus();
    else {
      const heading = document.querySelector<HTMLElement>('h1');
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    }
  };
  return { rememberFocus, restoreFocus };
}
