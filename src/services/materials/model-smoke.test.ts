import { expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { analyzeOriginalMaterial } from './model';

// Explicit opt-in: uses synthetic fixtures only, incurs provider usage.
it.skipIf(process.env.RUN_MATERIAL_MODEL_SMOKE !== '1')('reads original Markdown, image, text PDF and scanned PDF through the configured gateway', async () => {
  process.loadEnvFile('.env');
  const image = await sharp(Buffer.from('<svg width="600" height="180"><rect width="600" height="180" fill="white"/><text x="20" y="100" font-size="45">SCAN_CODE 7319</text></svg>')).jpeg().toBuffer();
  function pdf(objects: string[]) {
    let doc = '%PDF-1.4\n'; const offsets = [0];
    objects.forEach((obj, i) => { offsets.push(Buffer.byteLength(doc, 'latin1')); doc += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
    const start = Buffer.byteLength(doc, 'latin1');
    doc += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.slice(1).map(x => `${String(x).padStart(10, '0')} 00000 n \n`).join('') + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
    return Buffer.from(doc, 'latin1');
  }
  const text = 'BT /F1 22 Tf 40 150 Td (PDF_CODE 4826) Tj ET';
  const textPdf = pdf(['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${text.length} >>\nstream\n${text}\nendstream`]);
  const cmd = 'q 600 0 0 180 0 0 cm /Im0 Do Q';
  const scannedPdf = pdf(['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 180] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>', `<< /Type /XObject /Subtype /Image /Width 600 /Height 180 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n${image.toString('latin1')}\nendstream`, `<< /Length ${cmd.length} >>\nstream\n${cmd}\nendstream`]);
  for (const [mime, bytes, code] of [
    ['text/markdown', Buffer.from('# Fixture\nMARKDOWN_CODE 1593'), '1593'],
    ['image/jpeg', image, '7319'],
    ['application/pdf', textPdf, '4826'],
    ['application/pdf', scannedPdf, '7319'],
  ] as const) {
    console.info('material.smoke_started', { mime, bytes: bytes.length, fixtureCode: code });
    const result = await analyzeOriginalMaterial(mime, bytes, AbortSignal.timeout(120000));
    console.info('material.smoke_completed', { mime, fixtureCode: code });
    expect(JSON.stringify(result)).toContain(code);
  }
}, 500000);

it.skipIf(process.env.RUN_MATERIAL_DECK_SMOKE !== '1')('retains uploaded facts through outline approval and embeds images in generated HTML', async () => {
  process.loadEnvFile('.env');
  const dir = await mkdtemp(path.join(tmpdir(), 'material-deck-smoke-'));
  const previous = { materials: process.env.MATERIALS_DIR, output: process.env.GENERATED_SLIDES_DIR };
  process.env.MATERIALS_DIR = path.join(dir, 'materials'); process.env.GENERATED_SLIDES_DIR = path.join(dir, 'decks');
  try {
    const { POST: upload } = await import('@/src/app/api/materials/route');
    const { POST: read } = await import('@/src/app/api/materials/[id]/analyze/route');
    const { POST: generate } = await import('@/src/app/api/analyze/route');
    const { NextRequest } = await import('next/server');
    const groupId = crypto.randomUUID(); let cookie = ''; const sourceIds: string[] = [];
    const png = await sharp(Buffer.from('<svg width="500" height="200"><rect width="500" height="200" fill="#154f44"/><text x="30" y="110" font-size="32" fill="white">Product: 40% to 52%</text></svg>')).png().toBuffer();
    for (const [name, data] of [
      ['notes.md', Buffer.from('# 测试季度复盘\n激活率从40%提升至52%，增加12个百分点。收入从100万元提升至120万元。下一季度目标待补充。受众产品团队，中文3页。请使用附带的产品示意图。')],
      ['product.png', png],
    ] as const) {
      const form = new FormData(); form.set('groupId', groupId); form.set('file', new File([new Uint8Array(data)], name));
      const response = await upload(new Request('http://localhost/api/materials', { method: 'POST', body: form, headers: { cookie } }));
      expect(response.status).toBe(200); cookie = response.headers.get('set-cookie')!.split(';')[0];
      const material = await response.json(); sourceIds.push(material.id);
      const analysis = await read(new Request(`http://localhost/api/materials/${material.id}/analyze`, { method: 'POST', headers: { cookie } }), { params: Promise.resolve({ id: material.id }) });
      expect(await analysis.text()).toContain('"type":"complete"');
    }
    function chunks(body: string) { return body.split('\n').filter(line => line.startsWith('data: {')).map(line => JSON.parse(line.slice(6))); }
    const started = await generate(new NextRequest('http://localhost/api/analyze', { method: 'POST', headers: { cookie }, body: JSON.stringify({ presentationBrief: { topic: '季度复盘', pageCount: 3, audience: '产品团队', requirements: '根据上传资料生成中文3页演示文稿，必须使用上传图片。保留数字和待补充项。', sourceIds } }) }));
    expect(started.status).toBe(200);
    const events = chunks(await started.text());
    const runId = events.find(e => e.type === 'data-workflowRunId')?.data;
    const outline = events.filter(e => e.type === 'data-presentationOutline' && e.data?.status === 'completed').at(-1)?.data?.outline;
    expect(outline?.slides).toHaveLength(3); expect(JSON.stringify(outline)).toContain('52');
    const completed = await generate(new NextRequest('http://localhost/api/analyze', { method: 'POST', headers: { cookie }, body: JSON.stringify({ workflowRunId: runId, approvedOutline: outline }) }));
    const finalEvents = chunks(await completed.text());
    const deck = finalEvents.filter(e => e.type === 'data-presentationHtml' && e.data?.status === 'completed').at(-1)?.data;
    expect(deck?.html).toContain('data:image/webp;base64,'); expect(deck?.html).not.toContain('material:');
    expect(deck?.html).toContain('52'); expect(deck?.htmlUrl).toContain('/api/preview/');
  } finally {
    if (previous.materials === undefined) delete process.env.MATERIALS_DIR; else process.env.MATERIALS_DIR = previous.materials;
    if (previous.output === undefined) delete process.env.GENERATED_SLIDES_DIR; else process.env.GENERATED_SLIDES_DIR = previous.output;
    await rm(dir, { recursive: true, force: true });
  }
}, 300000);
