export interface Confirmation {
  id: number;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  cancelable: boolean;
  destructive: boolean;
}

let nextId = 0;
const queue: Confirmation[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export function getConfirmation(): Confirmation | null { return queue[0] ?? null; }
export function subscribeConfirmation(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function dismissConfirmation(id: number) {
  if (queue[0]?.id !== id) return;
  queue.shift();
  notify();
}

/** Every app confirmation uses the same accessible, blurred popup. */
export function confirmAction(title: string, message: string, confirmLabel: string, onConfirm: () => void | Promise<void>): void {
  queue.push({ id: ++nextId, title, message, confirmLabel, onConfirm, cancelable: true, destructive: /^(clear|delete|reset)$/i.test(confirmLabel) });
  notify();
}

export function showMessage(title: string, message: string): void {
  queue.push({ id: ++nextId, title, message, confirmLabel: 'OK', onConfirm: () => {}, cancelable: false, destructive: false });
  notify();
}
