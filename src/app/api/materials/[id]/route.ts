import { removeMaterial } from '@/src/services/materials/store';
import { materialError, materialOwner, requireSameOrigin } from '@/src/services/materials/http';
export const runtime = 'nodejs';
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request);
    await removeMaterial((await context.params).id, materialOwner(request));
    return new Response(null, { status: 204 });
  } catch (error) { return materialError(error); }
}
