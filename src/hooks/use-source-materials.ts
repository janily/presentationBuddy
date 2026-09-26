'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_MATERIAL_BYTES, MAX_MATERIAL_FILES, type MaterialAttachment, type MaterialEvent } from '@/src/types/materials';
export type MaterialItem = {
  key: string;
  file: File;
  attachment?: MaterialAttachment;
  status: 'uploading' | 'pending' | 'reading' | 'ready' | 'error';
  error?: string;
  sent: boolean;
};
async function responseError(response: Response) {
  const body = await response.json().catch(() => ({}));
  return new Error(body.error || `资料请求失败（${response.status}）`);
}
export function useSourceMaterials() {
  const [items, setItems] = useState<MaterialItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const itemsRef = useRef<MaterialItem[]>([]);
  const sourceIds = useRef<string[]>([]);
  const epoch = useRef(0);
  const group = useRef('');
  const requests = useRef(new Set<AbortController>());
  const uploadQueue = useRef<Promise<void>>(Promise.resolve());
  const update = useCallback((fn: (current: MaterialItem[]) => MaterialItem[]) => {
    itemsRef.current = fn(itemsRef.current);
    setItems(itemsRef.current);
  }, []);
  const patch = useCallback((key: string, change: Partial<MaterialItem>) => update(current => current.map(item => item.key === key ? { ...item, ...change } : item)), [update]);
  const upload = useCallback(async (item: MaterialItem, generation: number) => {
    if (generation !== epoch.current) return;
    const controller = new AbortController(); requests.current.add(controller);
    patch(item.key, { status: 'uploading', error: undefined });
    try {
      const form = new FormData(); form.append('file', item.file); form.append('groupId', group.current);
      const response = await fetch('/api/materials', { method: 'POST', body: form, signal: controller.signal });
      if (!response.ok) throw await responseError(response);
      const attachment = await response.json() as MaterialAttachment;
      if (generation !== epoch.current) {
        void fetch(`/api/materials/${attachment.id}`, { method: 'DELETE' }); return;
      }
      patch(item.key, { attachment, status: 'pending' });
    } catch (reason) {
      if (generation === epoch.current) patch(item.key, { status: 'error', error: controller.signal.aborted ? '上传已停止，请重试' : reason instanceof Error ? reason.message : '上传失败' });
    } finally { requests.current.delete(controller); }
  }, [patch]);
  const add = useCallback((files: File[]) => {
    setError(null);
    if (!files.length) return;
    if (itemsRef.current.length + files.length > MAX_MATERIAL_FILES || [...itemsRef.current.map(i => i.file), ...files].reduce((sum, f) => sum + f.size, 0) > MAX_MATERIAL_BYTES) {
      setError('每份文稿最多 5 个文件，总量不超过 10 MiB'); return;
    }
    if (files.some(f => !/\.(md|markdown|pdf|png|jpe?g|webp)$/i.test(f.name) || !f.size || (/\.(md|markdown)$/i.test(f.name) && f.size > 1024 * 1024))) {
      setError('请选择有效的 Markdown、PDF、PNG、JPEG 或 WebP；Markdown 不超过 1 MiB'); return;
    }
    if (!group.current) group.current = crypto.randomUUID();
    const generation = epoch.current;
    const additions: MaterialItem[] = files.map(file => ({ key: crypto.randomUUID(), file, status: 'uploading', sent: false }));
    update(current => [...current, ...additions]);
    // Serialize uploads so the initial HttpOnly session cookie is established once.
    for (const item of additions) uploadQueue.current = uploadQueue.current.then(() => upload(item, generation));
  }, [update, upload]);
  const read = useCallback(async (item: MaterialItem, generation: number) => {
    if (!item.attachment || generation !== epoch.current) return false;
    if (item.status === 'ready') return true;
    const controller = new AbortController(); requests.current.add(controller);
    patch(item.key, { status: 'reading', error: undefined });
    let complete = false;
    try {
      const response = await fetch(`/api/materials/${item.attachment.id}/analyze`, { method: 'POST', signal: controller.signal });
      if (!response.ok) throw await responseError(response);
      const reader = response.body?.getReader();
      if (!reader) throw new Error('资料读取连接中断');
      const decoder = new TextDecoder(); let pending = '';
      const consume = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line) as MaterialEvent;
        if (event.type === 'error') throw new Error(event.error);
        if (event.type === 'complete') complete = true;
      };
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) { pending += decoder.decode(); consume(pending); break; }
          pending += decoder.decode(chunk.value, { stream: true });
          const lines = pending.split('\n'); pending = lines.pop() || ''; lines.forEach(consume);
        }
      } finally { reader.releaseLock(); }
      controller.signal.throwIfAborted();
      if (!complete) throw new Error('资料未完整读取，请重试');
      if (generation !== epoch.current) return false;
      patch(item.key, { status: 'ready' }); return true;
    } catch (reason) {
      if (generation === epoch.current) patch(item.key, { status: 'error', error: controller.signal.aborted ? '读取已停止，请重试' : reason instanceof Error ? reason.message : '读取失败' });
      return false;
    } finally { requests.current.delete(controller); }
  }, [patch]);
  const prepare = useCallback(async (): Promise<MaterialAttachment[] | null> => {
    const generation = epoch.current;
    if (itemsRef.current.some(i => i.status === 'uploading' || i.status === 'reading')) return null;
    const pending = itemsRef.current.filter(i => !i.sent);
    if (pending.some(i => !i.attachment)) { setError('请重试或移除上传失败的附件'); return null; }
    setIsReading(true); setError(null);
    let success = true;
    for (let index = 0; index < pending.length; index += 2) {
      const results = await Promise.all(pending.slice(index, index + 2).map(item => read(item, generation)));
      if (results.some(ok => !ok)) { success = false; break; }
      if (generation !== epoch.current) return null;
    }
    if (generation !== epoch.current) return null;
    setIsReading(false);
    if (!success) { setError('部分资料未读取成功，请重试或移除后发送'); return null; }
    const ready = itemsRef.current.filter(i => !i.sent && i.status === 'ready');
    sourceIds.current = [...new Set([...sourceIds.current, ...ready.map(i => i.attachment!.id)])];
    update(current => current.map(i => i.status === 'ready' ? { ...i, sent: true } : i));
    return ready.map(i => i.attachment!);
  }, [read, update]);
  const retry = useCallback(async (key: string) => {
    const item = itemsRef.current.find(i => i.key === key);
    if (!item || item.sent || item.status !== 'error') return;
    if (item.attachment) await read(item, epoch.current);
    else await upload(item, epoch.current);
  }, [read, upload]);
  const remove = useCallback(async (key: string) => {
    const item = itemsRef.current.find(i => i.key === key);
    if (!item || item.sent || ['reading', 'uploading'].includes(item.status)) return;
    if (item.attachment) {
      const response = await fetch(`/api/materials/${item.attachment.id}`, { method: 'DELETE' }).catch(() => null);
      if (!response?.ok) { setError('移除失败，请重试'); return; }
    }
    update(current => current.filter(i => i.key !== key)); setError(null);
  }, [update]);
  const cancel = useCallback(() => { for (const request of requests.current) request.abort(); }, []);
  const reset = useCallback(() => {
    epoch.current++; cancel(); group.current = ''; sourceIds.current = [];
    update(() => []); setError(null); setIsReading(false);
  }, [cancel, update]);
  useEffect(() => () => { epoch.current++; cancel(); }, [cancel]);
  return { items, error, isReading, sourceIds, add, prepare, retry, remove, cancel, reset };
}
export type SourceMaterialsController = ReturnType<typeof useSourceMaterials>;
