import { afterEach, describe, expect, it, vi } from 'vitest';
import { HANDOFF_TIMEOUT_MS, TabLock, TabRole } from './tabLock';

// A minimal in-memory Web Locks manager (one lock name, FIFO queue, ifAvailable, steal, signal)
class FakeLocks {
  private holder: { reject: (e: unknown) => void; done: Promise<unknown> } | null = null;
  private queue: { run: () => void; signal?: AbortSignal }[] = [];

  request(_name: string, options: LockOptions, callback: (lock: Lock | null) => unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const grant = () => {
        const result = Promise.resolve(callback({ name: _name, mode: 'exclusive' } as Lock));
        const entry = { reject, done: result };
        this.holder = entry;
        result.then((v) => {
          if (this.holder === entry) {
            this.holder = null;
            this.next();
          }
          resolve(v);
        });
      };
      if (options.steal) {
        this.holder?.reject(new DOMException('stolen', 'AbortError'));
        this.holder = null;
        grant();
      } else if (!this.holder) grant();
      else if (options.ifAvailable) resolve(callback(null));
      else {
        const waiting = { run: grant, signal: options.signal };
        this.queue.push(waiting);
        options.signal?.addEventListener('abort', () => {
          this.queue = this.queue.filter((q) => q !== waiting);
          reject(new DOMException('aborted', 'AbortError'));
        });
      }
    });
  }

  private next() {
    const waiting = this.queue.shift();
    waiting?.run();
  }
}

// Two "tabs" sharing the fake locks and a fake BroadcastChannel
function makeTabs() {
  const locks = new FakeLocks() as unknown as LockManager;
  const listeners = new Set<(e: MessageEvent) => void>();
  const createChannel = () => {
    const own = new Set<(e: MessageEvent) => void>();
    return {
      postMessage: (data: unknown) => listeners.forEach((l) => !own.has(l) && l({ data } as MessageEvent)),
      addEventListener: (_: string, l: (e: MessageEvent) => void) => (own.add(l), listeners.add(l)),
      removeEventListener: (_: string, l: (e: MessageEvent) => void) => (own.delete(l), listeners.delete(l)),
      close: () => own.forEach((l) => listeners.delete(l)),
    } as unknown as BroadcastChannel;
  };
  const tab = (onLoseLock: () => Promise<void> | void = () => {}) => {
    const roles: TabRole[] = [];
    const lock = new TabLock({ locks, createChannel, onRoleChange: (r) => roles.push(r), onLoseLock });
    lock.start();
    return { lock, roles, role: () => roles[roles.length - 1] };
  };
  return { tab };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('TabLock', () => {
  afterEach(() => vi.useRealTimers());

  it('lets the first tab edit and makes later tabs wait', async () => {
    const { tab } = makeTabs();
    const one = tab();
    await flush();
    const two = tab();
    await flush();
    expect(one.role()).toBe('active');
    expect(two.role()).toBe('waiting');
  });

  it('hands over after the old tab saves, and the old tab waits again', async () => {
    const { tab } = makeTabs();
    const order: string[] = [];
    const one = tab(async () => {
      await flush();
      order.push('one saved');
    });
    await flush();
    const two = tab();
    await flush();
    await two.lock.takeOver();
    order.push('two active');
    expect(order).toEqual(['one saved', 'two active']);
    expect(two.role()).toBe('active');
    expect(one.role()).toBe('waiting');
  });

  it('gives the lock to the waiting tab when the editing tab goes away', async () => {
    const { tab } = makeTabs();
    const one = tab();
    await flush();
    const two = tab();
    await flush();
    one.lock.dispose();
    await flush();
    expect(two.role()).toBe('active');
  });

  it("doesn't wait forever for a tab that never answers", async () => {
    const { tab } = makeTabs();
    tab(() => new Promise(() => {})); // never finishes saving
    await flush();
    const two = tab();
    await flush();
    vi.useFakeTimers();
    const takeover = two.lock.takeOver();
    await vi.advanceTimersByTimeAsync(HANDOFF_TIMEOUT_MS);
    await takeover;
    expect(two.role()).toBe('active');
  });
});
