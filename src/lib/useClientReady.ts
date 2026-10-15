import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
let ready = false;

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  const timer = window.setTimeout(() => {
    if (ready) return;
    ready = true;
    listeners.forEach((fn) => fn());
  }, 0);
  return () => {
    window.clearTimeout(timer);
    listeners.delete(onStoreChange);
  };
}

export function useClientReady() {
  return useSyncExternalStore(subscribe, () => ready, () => false);
}
