import { materialBytes, readMaterial } from '@/src/services/materials/store';
import { materialError, materialOwner } from '@/src/services/materials/http';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const record = await readMaterial((await context.params).id, materialOwner(request));
    if (!record.mimeType.startsWith('image/')) throw new Error('该附件没有图片预览');
    return new Response(new Uint8Array(await materialBytes(record.id, true)), { headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return materialError(error, 404); }
}
