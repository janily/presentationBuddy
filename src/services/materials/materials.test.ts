import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateMaterialFile, buildMaterialPart, parseMaterialResponse } from './model';
import { createMaterial, readMaterial, removeMaterial, updateMaterial, resolveMaterials } from './store';
const result = { summary: '收入增长', sections: [{ title: '收入', content: '收入为 12 元', location: '第 1 页' }], facts: ['收入为 12 元'], tables: [], uncertainties: [], imageDescription: '' };
let dir: string;
afterEach(async () => { vi.unstubAllEnvs(); if (dir) await rm(dir, {recursive:true,force:true}); });
async function setup() { dir=await mkdtemp(path.join(tmpdir(),'material-test-'));vi.stubEnv('MATERIALS_DIR',dir); }
describe('original material input',()=>{
 it('sends PDF bytes directly with their MIME type',()=> { const bytes=Buffer.from('%PDF-1.4 fixture');expect(buildMaterialPart('application/pdf',bytes)).toEqual({inlineData:{mimeType:'application/pdf',data:bytes.toString('base64')}}); });
 it('sends markdown verbatim as text',()=>{expect(buildMaterialPart('text/markdown',Buffer.from('# 数据\n12'))).toEqual({text:'# 数据\n12'});});
 it('rejects spoofed PDF and oversized markdown',async()=>{await expect(validateMaterialFile('a.pdf',Buffer.from('not pdf'))).rejects.toThrow();await expect(validateMaterialFile('a.md',Buffer.alloc(1024*1024+1,65))).rejects.toThrow();});
 it('rejects empty and non UTF-8 markdown',async()=>{await expect(validateMaterialFile('a.md',Buffer.from(' '))).rejects.toThrow();await expect(validateMaterialFile('a.md',Buffer.from([255,254]))).rejects.toThrow();});
 it('validates JSON and rejects incomplete data',()=> {expect(parseMaterialResponse('```json\n'+JSON.stringify(result)+'\n```')).toEqual(result);expect(()=>parseMaterialResponse('{"summary":"ok"}')).toThrow();});
});
describe('private material store',()=>{
 it('enforces ownership and prevents deletion after use',async()=>{await setup();const m=await createMaterial('owner-a',randomUUID(),'notes.md',Buffer.from('# Facts'));await expect(readMaterial(m.id,'owner-b')).rejects.toThrow();await updateMaterial(m.id,{analysis:result});await resolveMaterials([m.id],'owner-a');await expect(removeMaterial(m.id,'owner-a')).rejects.toThrow();});
 it('does not accept unavailable sources or traversal ids',async()=>{await setup();const m=await createMaterial('a',randomUUID(),'notes.md',Buffer.from('facts'));await expect(resolveMaterials([m.id],'a')).rejects.toThrow();await expect(readMaterial('../secret','a')).rejects.toThrow();});
 it('rejects expired records',async()=>{await setup();const m=await createMaterial('a',randomUUID(),'notes.md',Buffer.from('facts'));await updateMaterial(m.id,{expiresAt:Date.now()-1});await expect(readMaterial(m.id,'a')).rejects.toThrow(/过期/);});
 it('enforces group quota even for concurrent uploads',async()=>{await setup();const group=randomUUID();const attempts=await Promise.allSettled(Array.from({length:6},()=>createMaterial('a',group,'x.md',Buffer.from('fact'))));expect(attempts.filter(x=>x.status==='fulfilled')).toHaveLength(5);});
});

describe('standalone image assets', () => {
 it('embeds only authorized image references as portable data URLs', async () => {
   await setup();
   const sharp = (await import('sharp')).default;
   const bytes = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#123456' } }).png().toBuffer();
   const material = await createMaterial('a', randomUUID(), 'chart.png', bytes);
   const { embedMaterialImages } = await import('./store');
   const output = await embedMaterialImages(`<img src="material:${material.id}" alt="chart">`, [material.id]);
   expect(output).toContain('data:image/webp;base64,');
   expect(output).not.toContain('material:');
   await expect(embedMaterialImages(`<img src="material:${material.id}">`, [])).rejects.toThrow(/未知/);
   await expect(embedMaterialImages('<img src="material:invented">', [])).rejects.toThrow();
 });
 it('keeps complete source facts and image asset IDs in resolved context', async () => {
   await setup();
   const material = await createMaterial('a', randomUUID(), 'notes.md', Buffer.from('facts'));
   await updateMaterial(material.id, { analysis: result });
   const context = JSON.parse(await resolveMaterials([material.id], 'a'));
   expect(context[0]).toMatchObject({ sourceId: material.id, fileName: 'notes.md', facts: ['收入为 12 元'] });
 });
});
