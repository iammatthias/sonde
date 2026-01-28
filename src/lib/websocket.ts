// Shared WebSocket utilities for real-time streams

export interface WebSocketOptions {
  onMessage: (data: unknown) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  binaryType?: "blob" | "arraybuffer";
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
}

export interface WebSocketController {
  connect: () => void;
  disconnect: () => void;
  isConnected: () => boolean;
  getRetryCount: () => number;
}

/** Maximum events to keep in buffer to prevent memory issues */
export const MAX_EVENTS = 500;

/** Default reconnection settings */
const DEFAULT_MAX_RETRIES = 10;
const DEFAULT_INITIAL_DELAY = 1000;
const DEFAULT_MAX_DELAY = 30000;

/**
 * Creates a WebSocket connection with automatic reconnection using exponential backoff.
 * Returns a controller object to manage the connection.
 */
export function createReconnectingWebSocket(
  url: string,
  options: WebSocketOptions,
): WebSocketController {
  let socket: WebSocket | null = null;
  let retryCount = 0;
  let retryTimeout: ReturnType<typeof setTimeout> | null = null;
  let intentionalClose = false;

  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const initialDelay = options.initialDelay ?? DEFAULT_INITIAL_DELAY;
  const maxDelay = options.maxDelay ?? DEFAULT_MAX_DELAY;

  function calculateDelay(): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (capped)
    const delay = Math.min(initialDelay * Math.pow(2, retryCount), maxDelay);
    return delay;
  }

  function connect() {
    if (
      socket?.readyState === WebSocket.OPEN ||
      socket?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    intentionalClose = false;

    try {
      socket = new WebSocket(url);

      if (options.binaryType) {
        socket.binaryType = options.binaryType;
      }

      socket.onopen = () => {
        retryCount = 0;
        options.onOpen?.();
      };

      socket.onclose = () => {
        options.onClose?.();

        if (!intentionalClose && retryCount < maxRetries) {
          const delay = calculateDelay();
          retryCount++;
          retryTimeout = setTimeout(connect, delay);
        }
      };

      socket.onerror = (event) => {
        options.onError?.(event);
      };

      socket.onmessage = (event) => {
        options.onMessage(event.data);
      };
    } catch (error) {
      console.error("WebSocket connection error:", error);
      options.onError?.(error as Event);
    }
  }

  function disconnect() {
    intentionalClose = true;

    if (retryTimeout) {
      clearTimeout(retryTimeout);
      retryTimeout = null;
    }

    if (socket) {
      socket.close();
      socket = null;
    }

    retryCount = 0;
  }

  function isConnected(): boolean {
    return socket?.readyState === WebSocket.OPEN;
  }

  function getRetryCount(): number {
    return retryCount;
  }

  return {
    connect,
    disconnect,
    isConnected,
    getRetryCount,
  };
}

/**
 * High-performance circular buffer for storing events.
 * Uses a ring buffer implementation for O(1) push operations.
 * When the buffer is full, oldest events are overwritten.
 */
export class EventBuffer<T> {
  private buffer: (T | undefined)[];
  private head: number = 0; // Next write position
  private tail: number = 0; // Oldest item position
  private count: number = 0;
  private maxSize: number;

  constructor(maxSize: number = MAX_EVENTS) {
    this.maxSize = maxSize;
    this.buffer = new Array(maxSize);
  }

  push(event: T): void {
    this.buffer[this.head] = event;
    this.head = (this.head + 1) % this.maxSize;

    if (this.count < this.maxSize) {
      this.count++;
    } else {
      // Buffer is full, move tail forward (overwriting oldest)
      this.tail = (this.tail + 1) % this.maxSize;
    }
  }

  pushMany(events: T[]): void {
    for (const event of events) {
      this.push(event);
    }
  }

  getAll(): T[] {
    if (this.count === 0) return [];

    const result: T[] = new Array(this.count);
    for (let i = 0; i < this.count; i++) {
      const index = (this.tail + i) % this.maxSize;
      result[i] = this.buffer[index] as T;
    }
    return result;
  }

  /** Get only the most recent N items (more efficient than getAll for UI) */
  getRecent(n: number): T[] {
    const actualN = Math.min(n, this.count);
    if (actualN === 0) return [];

    const result: T[] = new Array(actualN);
    const startIndex = this.count - actualN;
    for (let i = 0; i < actualN; i++) {
      const bufferIndex = (this.tail + startIndex + i) % this.maxSize;
      result[i] = this.buffer[bufferIndex] as T;
    }
    return result;
  }

  clear(): void {
    this.buffer = new Array(this.maxSize);
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }

  get length(): number {
    return this.count;
  }

  /** Check if buffer is at capacity (for backpressure signals) */
  get isFull(): boolean {
    return this.count >= this.maxSize;
  }

  /** Get fill percentage (for backpressure monitoring) */
  get fillPercentage(): number {
    return this.count / this.maxSize;
  }

  setMaxSize(size: number): void {
    if (size === this.maxSize) return;

    const items = this.getAll();
    this.maxSize = size;
    this.buffer = new Array(size);
    this.head = 0;
    this.tail = 0;
    this.count = 0;

    // Re-add items, oldest first (will drop oldest if new size is smaller)
    const startIndex = Math.max(0, items.length - size);
    for (let i = startIndex; i < items.length; i++) {
      this.push(items[i]);
    }
  }
}

// Re-export from consolidated format utilities
export { formatBytesPerSecond } from "./format";

/**
 * Format events per second for display
 */
export function formatEventsPerSecond(eventsPerSecond: number): string {
  if (eventsPerSecond < 1) {
    return `${(eventsPerSecond * 60).toFixed(1)}/min`;
  }
  return `${eventsPerSecond.toFixed(1)}/s`;
}
