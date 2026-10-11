// Only one tab edits the world at a time. Two tabs saving the same article within the
// same debounce window silently lost one tab's text (each save writes the whole
// article), so the first tab holds a Web Lock and later tabs wait until the user takes
// over or the editing tab closes. Waiting tabs still show the world, kept current by
// RxDB's cross-tab change events.
//
// Takeover: the new tab steals the lock; the old tab sees its lock request end, writes
// its pending edits and says so on a BroadcastChannel; the new tab starts editing after
// that message (or a timeout, if the old tab is gone or frozen).

export type TabRole = 'active' | 'waiting';

export const LOCK_NAME = 'gaea-forge-editor';
const CHANNEL_NAME = 'gaea-forge-tabs';
export const HANDOFF_TIMEOUT_MS = 2000;

type Options = {
  onRoleChange: (role: TabRole) => void;
  // Called when another tab takes over; resolve once pending edits are written
  onLoseLock: () => Promise<void> | void;
  locks?: LockManager;
  createChannel?: () => BroadcastChannel | null;
};

export class TabLock {
  private release: (() => void) | null = null; // lets go of the held lock
  private queued: AbortController | null = null; // cancels the request waiting in line
  private channel: BroadcastChannel | null;
  private disposed = false;
  private readonly locks: LockManager;

  constructor(private readonly options: Options & { locks: LockManager }) {
    this.locks = options.locks;
    this.channel = (options.createChannel ?? defaultChannel)();
  }

  // Take the lock if it's free, otherwise wait in line for it
  start() {
    this.locks
      .request(LOCK_NAME, { ifAvailable: true }, (lock) => {
        if (this.disposed) return undefined;
        if (!lock) {
          this.waitInLine();
          return undefined;
        }
        return this.hold(true);
      })
      .catch((e) => this.onHeldRequestEnded(e));
  }

  // Make this the editing tab, once the previous one has saved
  async takeOver() {
    const handedOver = this.waitForHandoff();
    this.queued?.abort();
    this.queued = null;
    await new Promise<void>((granted) => {
      this.locks
        .request(LOCK_NAME, { steal: true }, () => {
          granted();
          return this.hold(false);
        })
        .catch((e) => this.onHeldRequestEnded(e));
    });
    await handedOver;
    if (!this.disposed && this.release) this.options.onRoleChange('active');
  }

  dispose() {
    this.disposed = true;
    this.queued?.abort();
    this.release?.();
    this.channel?.close();
    this.channel = null;
  }

  // Keep the lock until released or stolen
  private hold(announce: boolean) {
    if (announce) this.options.onRoleChange('active');
    return new Promise<void>((resolve) => {
      this.release = () => {
        this.release = null;
        resolve();
      };
    });
  }

  private waitInLine() {
    const controller = new AbortController();
    this.queued = controller;
    this.options.onRoleChange('waiting');
    this.locks
      .request(LOCK_NAME, { signal: controller.signal }, () => {
        if (this.disposed) return undefined;
        this.queued = null;
        return this.hold(true);
      })
      .catch((e) => {
        if (controller.signal.aborted) return; // we left the line ourselves
        this.onHeldRequestEnded(e);
      });
  }

  // A held lock's request only fails when another tab steals it
  private onHeldRequestEnded(error: unknown) {
    if (this.disposed) return;
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      console.error('Tab lock failed:', error);
      return;
    }
    this.release = null;
    this.waitInLine();
    Promise.resolve(this.options.onLoseLock())
      .catch((e) => console.error('Saving before handing over failed:', e))
      .finally(() => this.channel?.postMessage({ type: 'released' }));
  }

  private waitForHandoff() {
    return new Promise<void>((resolve) => {
      const channel = this.channel;
      const done = () => {
        clearTimeout(timer);
        channel?.removeEventListener('message', onMessage);
        resolve();
      };
      const onMessage = (e: MessageEvent) => e.data?.type === 'released' && done();
      const timer = setTimeout(done, HANDOFF_TIMEOUT_MS);
      channel?.addEventListener('message', onMessage);
    });
  }
}

const defaultChannel = () => (typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null);
