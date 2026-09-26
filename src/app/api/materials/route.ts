import { NextResponse } from 'next/server';
import { MAX_MATERIAL_BYTES } from '@/src/types/materials';
import { createMaterial, materialDto } from '@/src/services/materials/store';
import { MATERIAL_COOKIE, materialError, requireSameOrigin, uploadSession } from '@/src/services/materials/http';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    // Limit the actual stream too: Content-Length is optional and untrusted.
    const max = MAX_MATERIAL_BYTES + 64 * 1024;
    if (Number(request.headers.get('content-length')) > max) return materialError(new Error('文件超过 10 MiB'), 413);
    const reader = request.body?.getReader();
    if (!reader) throw new Error('没有收到文件');
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > max) { await reader.cancel(); return materialError(new Error('文件超过 10 MiB'), 413); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const form = await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': request.headers.get('content-type') || '' } }).formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new Error('请选择文件');
    const session = uploadSession(request);
    const record = await createMaterial(session.owner, String(form.get('groupId') || ''), file.name, Buffer.from(await file.arrayBuffer()));
    const response = NextResponse.json(materialDto(record));
    response.cookies.set(MATERIAL_COOKIE, session.token, { httpOnly: true, sameSite: 'strict', secure: new URL(request.url).protocol === 'https:', path: '/', maxAge: 86400 });
    return response;
  } catch (error) { return materialError(error); }
}
