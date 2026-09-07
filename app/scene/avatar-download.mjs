// Share transferred bytes, never a live VRM/GPU object, between world instances.
const downloads = new Map();
const MAX_READY_MODELS = 3;

export function avatarAsset(source) {
  const mobile = typeof navigator !== 'undefined' &&
    ((navigator.deviceMemory && navigator.deviceMemory <= 4) ||
     (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches));
  return mobile ? source.replace(/-web\.vrm$/, '-lite.vrm') : source;
}

// On actual world entry, not page load: overlap model transfer with scene JS.
export function preloadAvatar(source) {
  void downloadAvatar(source).catch(() => {}); // Scene owns error/retry UI.
}

/** @param {string} source @param {(value:{loaded:number,total:number,phase:'download'|'decode'|'ready'})=>void} onProgress */
export async function downloadAvatar(source, onProgress = () => {}) {
  source = avatarAsset(source);
  let entry = downloads.get(source);
  if (!entry) {
    entry = {listeners:new Set(), progress:{loaded:0,total:0,phase:'download'}, promise:null, ready:false};
    downloads.set(source, entry);
    const emit = value => { entry.progress = value; for (const listener of entry.listeners) listener(value); };
    entry.promise = (async () => {
      const abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(), 45000);
      try {
        let compressed = /-(mobile|web|lite)\.vrm$/.test(source) && typeof DecompressionStream !== 'undefined';
        let response = await fetch(compressed ? source + '.bin' : source, {signal:abort.signal});
        if (compressed && (response.status === 404 || response.status === 415)) {
          await response.body?.cancel();
          compressed = false;
          response = await fetch(source, {signal:abort.signal});
        }
        if (!response.ok) throw Error('人物下载失败，请重新选择角色重试');
        const total = Number(response.headers.get('content-length')) || 0;
        const reader = response.body?.getReader();
        if (!reader) throw Error('人物数据为空');
        const chunks = []; let loaded = 0;
        emit({loaded,total,phase:'download'});
        for (;;) {
          const {done,value} = await reader.read(); if (done) break;
          chunks.push(value); loaded += value.byteLength; emit({loaded,total,phase:'download'});
        }
        const bytes = new Uint8Array(loaded); let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.length; }
        chunks.length = 0;
        emit({loaded,total:loaded,phase:'decode'});
        const decoded = compressed ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer() : bytes.buffer;
        entry.ready = true;
        emit({loaded,total:loaded,phase:'ready'});
        const ready = [...downloads].filter(([,value]) => value.ready);
        for (const [key] of ready.slice(0,Math.max(0,ready.length-MAX_READY_MODELS))) downloads.delete(key);
        return decoded;
      } catch (error) {
        if (abort.signal.aborted) throw Error('人物下载超时，请检查网络后重试');
        throw error;
      } finally { clearTimeout(timeout); }
    })();
    entry.promise.catch(() => { if (downloads.get(source) === entry) downloads.delete(source); });
  } else { downloads.delete(source); downloads.set(source,entry); }
  entry.listeners.add(onProgress); onProgress(entry.progress);
  try { return await entry.promise; }
  finally { entry.listeners.delete(onProgress); if (source.startsWith('blob:')) downloads.delete(source); }
}
