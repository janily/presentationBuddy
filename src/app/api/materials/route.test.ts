import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { POST } from './route';
import { POST as analyze } from './[id]/analyze/route';
import { DELETE } from './[id]/route';
import { readMaterial, resolveMaterials } from '@/src/services/materials/store';
import { materialOwner } from '@/src/services/materials/http';
const { model } = vi.hoisted(() => ({ model: vi.fn() }));
vi.mock('@/src/services/materials/model', async original => ({ ...await original<object>(), analyzeOriginalMaterial: model }));
let dir: string;
beforeEach(async () => { dir = await mkdtemp(path.join(tmpdir(), 'materials-route-')); vi.stubEnv('MATERIALS_DIR', dir); model.mockReset(); });
afterEach(async () => { vi.unstubAllEnvs(); await rm(dir, { recursive: true, force: true }); });
async function upload(name = 'notes.md', content = '# Revenue\n12') {
 const form = new FormData(); form.set('file', new File([content], name)); form.set('groupId', randomUUID());
 const response = await POST(new Request('http://localhost/api/materials', { method: 'POST', body: form }));
 return { response, file: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] || '' };
}
function req(cookie: string) { return new Request('http://localhost/api/materials/x/analyze', { method: 'POST', headers: { cookie } }); }
describe('material HTTP lifecycle', () => {
 it('uploads privately, streams a validated reading and reuses it without another model call', async () => {
   const { response, file, cookie } = await upload(); expect(response.status).toBe(200); expect(cookie).toContain('pb-material-session=');
   model.mockResolvedValue({ summary: 'Revenue 12', sections: [], facts: ['Revenue 12'], tables: [], uncertainties: [], imageDescription: '' });
   const context = { params: Promise.resolve({ id: file.id }) };
   expect(await (await analyze(req(cookie), context)).text()).toContain('"type":"complete"');
   expect(await (await analyze(req(cookie), context)).text()).toContain('"type":"complete"');
   expect(model).toHaveBeenCalledTimes(1);
   expect((await readMaterial(file.id, materialOwner(req(cookie)))).analysis?.facts).toEqual(['Revenue 12']);
   const denied = await analyze(req(''), context); expect(denied.status).toBe(400);
   await resolveMaterials([file.id], materialOwner(req(cookie)));
   expect((await DELETE(req(cookie), context)).status).toBe(400);
 });
 it('keeps a failed file retryable', async () => {
   const { file, cookie } = await upload(); model.mockRejectedValueOnce(new Error('模型未能读取文件'));
   const response = await analyze(req(cookie), { params: Promise.resolve({ id: file.id }) });
   expect(await response.text()).toContain('"type":"error"');
   expect((await readMaterial(file.id, materialOwner(req(cookie)))).analysis).toBeUndefined();
 });
 it('does not publish a model result that arrives after cancellation', async () => {
   const { file, cookie } = await upload();
   let finish!: (value: unknown) => void;
   let started!: () => void;
   const entered = new Promise<void>(resolve => { started = resolve; });
   model.mockImplementation(() => { started(); return new Promise(resolve => { finish = resolve; }); });
   const abort = new AbortController();
   const response = await analyze(new Request('http://localhost/api/materials/x/analyze', { method: 'POST', headers: { cookie }, signal: abort.signal }), { params: Promise.resolve({ id: file.id }) });
   const body = response.text();
   await entered;
   abort.abort();
   finish({ summary: 'late result', sections: [], facts: [], tables: [], uncertainties: [], imageDescription: '' });
   expect(await body).not.toContain('"type":"complete"');
   expect((await readMaterial(file.id, materialOwner(req(cookie)))).analysis).toBeUndefined();
 });
 it('rejects forged file types, body limits and cross-site uploads', async () => {
   expect((await upload('x.pdf', 'fake pdf')).response.status).toBe(400);
   expect((await POST(new Request('http://localhost/api/materials', { method: 'POST', headers: { 'content-length': String(12 * 1024 * 1024) } }))).status).toBe(413);
   expect((await POST(new Request('http://localhost/api/materials', { method: 'POST', headers: { origin: 'http://evil.test' } }))).status).toBe(400);
 });
});
