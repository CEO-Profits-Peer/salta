export interface Capabilities { cores: number; memoryGB: number | null; webWorkers: boolean; indexedDB: boolean; webgpu: boolean; heapMB: number | null; backend: 'browser-worker' }
/** Capability detection. The only backend implemented today is the browser worker; WebGPU/WASM are detected, never required. */
export function detectCapabilities(): Capabilities {
  const nav = navigator as Navigator & { deviceMemory?: number; gpu?: unknown };
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  return { cores: nav.hardwareConcurrency || 2, memoryGB: nav.deviceMemory ?? null, webWorkers: typeof Worker !== 'undefined', indexedDB: typeof indexedDB !== 'undefined', webgpu: 'gpu' in nav, heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null, backend: 'browser-worker' };
}
