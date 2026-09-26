import { mkdir, readFile, writeFile, rename, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { MAX_MATERIAL_BYTES, MAX_MATERIAL_FILES, type MaterialAttachment, type MaterialAnalysis } from '@/src/types/materials';
import { validateMaterialFile } from './model';

export type StoredMaterial = MaterialAttachment & { owner: string; groupId: string; pinned: boolean; analysis?: MaterialAnalysis };
const TTL = 24 * 60 * 60 * 1000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const shared = globalThis as typeof globalThis & { __materialLocks?: Map<string, Promise<unknown>> };
const locks = shared.__materialLocks ??= new Map<string, Promise<unknown>>();
let cleanupAt = 0;
export function materialRoot() { return process.env.MATERIALS_DIR || path.join(tmpdir(), 'presentation-buddy-materials'); }
function recordDir(id: string) { if (!uuid.test(id)) throw new Error('资料不存在'); return path.join(materialRoot(), id); }
export function materialDto(record: StoredMaterial): MaterialAttachment {
  const { id, name, mimeType, size, expiresAt } = record;
  return { id, name, mimeType, size, expiresAt };
}
export async function withMaterialLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  const running = previous.catch(() => {}).then(fn);
  locks.set(key, running);
  try { return await running; } finally { if (locks.get(key) === running) locks.delete(key); }
}
async function cleanup() {
  if (Date.now() < cleanupAt) return;
  cleanupAt = Date.now() + 60000;
  // Run bindings intentionally remain as expired tombstones: deleting them would
  // make an old protected workflow indistinguishable from a source-free run.
  for (const entry of await readdir(materialRoot(), { withFileTypes: true })) {
    if (!entry.isDirectory() || !uuid.test(entry.name)) continue;
    const dir = recordDir(entry.name);
    try {
      const record = JSON.parse(await readFile(path.join(dir, 'record.json'), 'utf8')) as StoredMaterial;
      if (record.expiresAt < Date.now()) await rm(dir, { recursive: true, force: true });
    } catch {
      // Only remove abandoned partial uploads, never an upload currently being written.
      const info = await stat(dir).catch(() => null);
      if (info && info.mtimeMs < Date.now() - TTL) await rm(dir, { recursive: true, force: true });
    }
  }
}
export async function readMaterialInternal(id: string): Promise<StoredMaterial> {
  const dir = recordDir(id);
  let record: StoredMaterial;
  try { record = JSON.parse(await readFile(path.join(dir, 'record.json'), 'utf8')); }
  catch { throw new Error('资料不存在或已过期，请重新上传'); }
  if (record.expiresAt <= Date.now()) throw new Error('资料已过期，请重新上传');
  return record;
}
export async function readMaterial(id: string, owner: string) {
  const record = await readMaterialInternal(id);
  if (!owner || record.owner !== owner) throw new Error('资料不存在或无权访问');
  return record;
}
export async function updateMaterial(id: string, patch: Partial<Pick<StoredMaterial, 'analysis' | 'pinned' | 'expiresAt'>>) {
  return withMaterialLock(id, async () => {
    const record = await readMaterialInternal(id);
    const updated = { ...record, ...patch };
    const temp = path.join(recordDir(id), `${randomUUID()}.json`);
    await writeFile(temp, JSON.stringify(updated), { mode: 0o600 });
    await rename(temp, path.join(recordDir(id), 'record.json'));
    return updated;
  });
}
export async function createMaterial(owner: string, groupId: string, filename: string, bytes: Buffer) {
  if (!uuid.test(groupId)) throw new Error('无效的资料分组');
  const mimeType = await validateMaterialFile(filename, bytes);
  await mkdir(materialRoot(), { recursive: true, mode: 0o700 });
  await cleanup();
  return withMaterialLock(`${owner}:${groupId}`, async () => {
    const records: StoredMaterial[] = [];
    for (const entry of await readdir(materialRoot())) {
      if (!uuid.test(entry)) continue;
      const item = await readMaterialInternal(entry).catch(() => null);
      if (item?.owner === owner && item.groupId === groupId) records.push(item);
    }
    if (records.length >= MAX_MATERIAL_FILES || records.reduce((sum, item) => sum + item.size, bytes.length) > MAX_MATERIAL_BYTES) {
      throw new Error('每份文稿最多 5 个文件，资料总量不能超过 10 MiB');
    }
    const id = randomUUID();
    const record: StoredMaterial = { id, owner, groupId, name: path.basename(filename).slice(0, 180), size: bytes.length, mimeType, expiresAt: Date.now() + TTL, pinned: false };
    const dir = recordDir(id);
    await mkdir(dir, { mode: 0o700 });
    try {
      await writeFile(path.join(dir, 'original'), bytes, { mode: 0o600 });
      if (mimeType.startsWith('image/')) {
        const preview = await sharp(bytes, { limitInputPixels: 40_000_000 }).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
        await writeFile(path.join(dir, 'preview.webp'), preview, { mode: 0o600 });
      }
      await writeFile(path.join(dir, 'record.json'), JSON.stringify(record), { mode: 0o600 });
      return record;
    } catch (error) { await rm(dir, { recursive: true, force: true }); throw error; }
  });
}
export function materialBytes(id: string, preview = false) { return readFile(path.join(recordDir(id), preview ? 'preview.webp' : 'original')); }
export async function removeMaterial(id: string, owner: string) {
  return withMaterialLock(id, async () => {
    const record = await readMaterial(id, owner);
    if (record.pinned) throw new Error('已发送的资料不能删除，请重新开始以更换资料');
    await rm(recordDir(id), { recursive: true, force: true });
  });
}
export async function resolveMaterials(ids: string[], owner: string) {
  if (!ids.length) return '';
  if (new Set(ids).size !== ids.length || ids.length > MAX_MATERIAL_FILES) throw new Error('资料数量无效');
  const records = await Promise.all(ids.map(id => readMaterial(id, owner)));
  if (records.reduce((sum, r) => sum + r.size, 0) > MAX_MATERIAL_BYTES) throw new Error('资料总量超过 10 MiB');
  if (records.some(r => !r.analysis)) throw new Error('请先完成所有附件的读取');
  const context = JSON.stringify(records.map(r => ({ sourceId: r.id, fileName: r.name, imageAsset: r.mimeType.startsWith('image/') ? `material:${r.id}` : undefined, ...r.analysis })));
  if (context.length > 80000) throw new Error('资料内容超过生成预算，请减少文件或拆分文稿');
  await Promise.all(ids.map(id => updateMaterial(id, { pinned: true })));
  return context;
}

// Called only inside workflows after the HTTP boundary has verified source ownership.
export async function embedMaterialImages(html: string, ids: string[]) {
  const references = [...html.matchAll(/material:([a-zA-Z0-9-]+)/g)].map(match => match[1]);
  let output = html;
  for (const id of new Set(references)) {
    if (!ids.includes(id)) throw new Error('生成结果引用了未知图片素材');
    const material = await readMaterialInternal(id);
    if (!material.mimeType.startsWith('image/')) throw new Error('生成结果将文档误用为图片');
    const bytes = await materialBytes(id, true);
    output = output.replaceAll(`material:${id}`, `data:image/webp;base64,${bytes.toString('base64')}`);
  }
  if (output.includes('material:')) throw new Error('生成结果包含无效的素材引用');
  return output;
}

export async function bindMaterialRun(runId: string, owner: string, ids: string[]) {
  if (!ids.length) return;
  const { createHash } = await import('node:crypto');
  const dir = path.join(materialRoot(), 'runs');
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await writeFile(path.join(dir, createHash('sha256').update(runId).digest('hex') + '.json'), JSON.stringify({ owner, ids, expiresAt: Date.now() + TTL }), { mode: 0o600 });
}
export async function verifyMaterialRun(runId: string, owner: string) {
  const { createHash } = await import('node:crypto');
  let binding: { owner: string; ids: string[]; expiresAt: number };
  try { binding = JSON.parse(await readFile(path.join(materialRoot(), 'runs', createHash('sha256').update(runId).digest('hex') + '.json'), 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
  if (binding.owner !== owner || binding.expiresAt <= Date.now()) throw new Error('资料会话无效或已过期，请重新上传');
  await resolveMaterials(binding.ids, owner);
}
