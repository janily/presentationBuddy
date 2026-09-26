import { analyzeOriginalMaterial } from '@/src/services/materials/model';
import { materialBytes, materialDto, readMaterial, updateMaterial, withMaterialLock } from '@/src/services/materials/store';
import { materialError, materialOwner, requireSameOrigin } from '@/src/services/materials/http';
import type { MaterialEvent } from '@/src/types/materials';
export const runtime = 'nodejs';
export const maxDuration = 180;
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request);
    const owner = materialOwner(request);
    const { id } = await context.params;
    await readMaterial(id, owner);
    const controller = new AbortController();
    const forward = () => controller.abort();
    request.signal.addEventListener('abort', forward, { once: true });
    if (request.signal.aborted) controller.abort();
    let closed = false;
    const stream = new ReadableStream({
      async start(writer) {
        const emit = (event: MaterialEvent) => { if (!closed && !controller.signal.aborted) writer.enqueue(new TextEncoder().encode(JSON.stringify(event) + '\n')); };
        const timeout = setTimeout(() => controller.abort(new Error('资料读取超时，请重试或缩减文件')), 120000);
        const heartbeat = setInterval(() => emit({ type: 'progress', message: '模型正在读取原文件，可随时停止…' }), 5000);
        try {
          emit({ type: 'progress', message: '正在将原文件交给模型读取…' });
          const record = await withMaterialLock(`analysis:${id}`, async () => {
            controller.signal.throwIfAborted();
            const current = await readMaterial(id, owner);
            if (current.analysis) return current;
            const analysis = await analyzeOriginalMaterial(current.mimeType, await materialBytes(id), controller.signal);
            controller.signal.throwIfAborted();
            return updateMaterial(id, { analysis });
          });
          emit({ type: 'complete', attachment: materialDto(record) });
        } catch (error) {
          // A timeout is a user-visible failure; a disconnected client needs no event.
          if (!closed && !request.signal.aborted) writer.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'error', error: controller.signal.aborted ? '已停止或读取超时，请重试' : error instanceof Error ? error.message : '资料读取失败' }) + '\n'));
        } finally {
          clearInterval(heartbeat); clearTimeout(timeout);
          request.signal.removeEventListener('abort', forward);
          if (!closed) { closed = true; writer.close(); }
        }
      },
      cancel() { closed = true; controller.abort(); },
    });
    return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' } });
  } catch (error) { return materialError(error); }
}
