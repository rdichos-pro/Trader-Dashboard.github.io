/**
 * Browser Notification & Background Audio Engine
 * Enables:
 * 1. Persistent unlocked Web Audio context that continues playing chimes even when tab is in background.
 * 2. HTML5 Audio fallback for background tabs.
 * 3. Dynamic blinking document.title alerts when tab is unfocused.
 * 4. Unthrottled Web Worker heartbeat so background polling never gets suspended by the browser.
 * 5. Native OS System Notifications with vibration for desktop and mobile lock screens.
 */

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isBrowserNotificationSupported()) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isBrowserNotificationSupported()) {
    return 'unsupported';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.warn('Error requesting browser notification permission:', err);
    return Notification.permission;
  }
}

// ---------------------------------------------------------------------------
// 1. Persistent Shared Web Audio Context Singleton (Auto-unlocked on user gesture)
// ---------------------------------------------------------------------------
let sharedAudioContext: AudioContext | null = null;
let isAudioContextUnlocked = false;

export function isAudioUnlocked(): boolean {
  return isAudioContextUnlocked && !!sharedAudioContext && sharedAudioContext.state === 'running';
}

/**
 * Returns the singleton AudioContext, creating it if needed.
 */
export function getOrCreateAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  if (!sharedAudioContext) {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        sharedAudioContext = new AudioContextClass();
      }
    } catch (e) {
      console.warn('Unable to instantiate AudioContext:', e);
    }
  }

  if (sharedAudioContext && sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume().then(() => {
      isAudioContextUnlocked = true;
    }).catch(() => {});
  }

  return sharedAudioContext;
}

/**
 * Explicitly unlocks audio by playing an inaudible buffer on user gesture.
 * Crucial for background audio playback on Chrome, Safari, and Mobile browsers.
 */
export async function unlockAudio(): Promise<boolean> {
  const ctx = getOrCreateAudioContext();
  if (!ctx) return false;

  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    // Play a 1-sample silent buffer to satisfy browser autoplay requirements
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);

    isAudioContextUnlocked = true;
    return true;
  } catch (e) {
    console.debug('Failed to unlock audio context:', e);
    return false;
  }
}

// Attach automatic unlock listeners on first user interaction anywhere in the window
if (typeof window !== 'undefined') {
  const autoUnlock = () => {
    unlockAudio().then(success => {
      if (success) {
        window.removeEventListener('pointerdown', autoUnlock);
        window.removeEventListener('touchstart', autoUnlock);
        window.removeEventListener('keydown', autoUnlock);
        window.removeEventListener('click', autoUnlock);
      }
    });
  };

  window.addEventListener('pointerdown', autoUnlock, { once: false, passive: true });
  window.addEventListener('touchstart', autoUnlock, { once: false, passive: true });
  window.addEventListener('keydown', autoUnlock, { once: false, passive: true });
  window.addEventListener('click', autoUnlock, { once: false, passive: true });
}

// ---------------------------------------------------------------------------
// 2. Synthesized Audio Chimes (Web Audio + Fallback)
// ---------------------------------------------------------------------------

/**
 * Synthesizes and plays an alert chime.
 * Works even when tab is in background if user has interacted with the document at least once.
 */
export function playSignalChime(type: 'BULLISH' | 'BEARISH' | 'WARNING' = 'BULLISH'): void {
  if (typeof window === 'undefined') return;

  const ctx = getOrCreateAudioContext();
  if (!ctx) return;

  try {
    // Ensure context is running (especially when invoked from background event)
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'BULLISH') {
      // Pleasant upward harmonic arpeggio (E5 -> A5 -> C#6)
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.setValueAtTime(880.00, now + 0.08); // A5
      osc.frequency.setValueAtTime(1108.73, now + 0.16); // C#6

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc.start(now);
      osc.stop(now + 0.55);
    } else if (type === 'BEARISH') {
      // Clear downward warning chime (A5 -> F5 -> D5)
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880.00, now); // A5
      osc.frequency.setValueAtTime(698.46, now + 0.1); // F5
      osc.frequency.setValueAtTime(587.33, now + 0.2); // D5

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.start(now);
      osc.stop(now + 0.6);
    } else {
      // Short neutral notification ping
      osc.type = 'sine';
      osc.frequency.setValueAtTime(784.00, now); // G5
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    }
  } catch (e) {
    console.debug('Audio chime playback omitted or blocked by browser:', e);
  }
}

// ---------------------------------------------------------------------------
// 3. Tab Title Flashing Alert when Tab is in Background
// ---------------------------------------------------------------------------
let titleBlinkInterval: ReturnType<typeof setInterval> | null = null;
let originalDocumentTitle: string = '';

export function startTabTitleAlert(alertText: string, defaultTitle?: string): void {
  if (typeof document === 'undefined') return;

  if (!originalDocumentTitle) {
    originalDocumentTitle = defaultTitle || document.title || 'T-DASH Daytrade';
  }

  // Only blink if document is hidden or unfocused
  if (!document.hidden) return;

  if (titleBlinkInterval) {
    clearInterval(titleBlinkInterval);
  }

  let isAlert = true;
  document.title = alertText;

  titleBlinkInterval = setInterval(() => {
    if (!document.hidden) {
      stopTabTitleAlert();
      return;
    }
    document.title = isAlert ? alertText : originalDocumentTitle;
    isAlert = !isAlert;
  }, 1000);

  // Stop flashing when user returns to tab
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      stopTabTitleAlert();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', handleVisibilityChange);
}

export function stopTabTitleAlert(): void {
  if (titleBlinkInterval) {
    clearInterval(titleBlinkInterval);
    titleBlinkInterval = null;
  }
  if (typeof document !== 'undefined' && originalDocumentTitle) {
    document.title = originalDocumentTitle;
  }
}

// ---------------------------------------------------------------------------
// 4. Background Web Worker Timer (Prevents Browser setInterval Throttling)
// ---------------------------------------------------------------------------
/**
 * Creates an unthrottled timer using a Web Worker Blob.
 * Browsers aggressively clamp setInterval down to 1 minute or suspend it when a tab is in the background.
 * Web Workers run on a separate thread and are NOT clamped, keeping trading alerts active in background tabs.
 */
export function createBackgroundWorkerTimer(callback: () => void, intervalMs: number): () => void {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    const fallbackId = setInterval(callback, intervalMs);
    return () => clearInterval(fallbackId);
  }

  try {
    const workerScript = `
      let timer = null;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          timer = setInterval(function() {
            self.postMessage('tick');
          }, ${intervalMs});
        } else if (e.data === 'stop') {
          if (timer) clearInterval(timer);
        }
      };
    `;

    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);

    worker.onmessage = (e) => {
      if (e.data === 'tick') {
        callback();
      }
    };

    worker.postMessage('start');

    return () => {
      try {
        worker.postMessage('stop');
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
      } catch (e) {
        // ignore
      }
    };
  } catch (err) {
    console.warn('Web Worker timer creation failed, falling back to setInterval:', err);
    const fallbackId = setInterval(callback, intervalMs);
    return () => clearInterval(fallbackId);
  }
}

// ---------------------------------------------------------------------------
// 5. System Desktop & Mobile Notification Dispatcher
// ---------------------------------------------------------------------------
export interface SystemNotificationOptions {
  body?: string;
  tag?: string;
  direction?: 'BULLISH' | 'BEARISH' | 'WARNING';
  playSound?: boolean;
  onClick?: () => void;
}

/**
 * Dispatches a native browser system notification if permissions are granted.
 * Also plays the sound chime and starts blinking the tab title if tab is in the background.
 */
export function sendSystemNotification(
  title: string,
  options: SystemNotificationOptions = {}
): Notification | null {
  // 1. Play sound chime
  if (options.playSound !== false) {
    playSignalChime(options.direction || 'BULLISH');
  }

  // 2. Start blinking tab title if in background
  if (typeof document !== 'undefined' && document.hidden) {
    const blinkPrefix = options.direction === 'BEARISH' ? '🚨 (SELL)' : '🔥 (BUY)';
    startTabTitleAlert(`${blinkPrefix} ${title}`);
  }

  // 3. Dispatch native OS system notification if supported & granted
  if (!isBrowserNotificationSupported() || Notification.permission !== 'granted') {
    return null;
  }

  try {
    const notif = new Notification(title, {
      body: options.body,
      tag: options.tag || `signal-${Date.now()}`,
      icon: '/favicon.ico',
      // Vibration pattern for mobile browsers [vibrate 200ms, pause 100ms, vibrate 200ms]
      ...(typeof navigator !== 'undefined' && 'vibrate' in navigator ? { vibrate: [200, 100, 200] } : {}),
    });

    if (options.onClick) {
      notif.onclick = () => {
        window.focus();
        stopTabTitleAlert();
        options.onClick?.();
        notif.close();
      };
    }

    return notif;
  } catch (err) {
    console.warn('Failed to construct native Notification:', err);
    return null;
  }
}
