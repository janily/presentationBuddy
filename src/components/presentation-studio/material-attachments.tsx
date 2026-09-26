'use client';
import { FileText, LoaderCircle, Paperclip, X } from 'lucide-react';
import type { SourceMaterialsController } from '@/src/hooks/use-source-materials';
import { MATERIAL_ACCEPT, type MaterialAttachment } from '@/src/types/materials';

export function SentAttachments({ attachments }: { attachments?: MaterialAttachment[] }) {
  if (!attachments?.length) return null;
  return <div className="mb-2 flex flex-wrap gap-2">{attachments.map(file => <div key={file.id} className="max-w-full rounded-lg border border-current/20 px-2 py-1 text-xs">
    {file.mimeType.startsWith('image/') && (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`/api/materials/${file.id}/preview`} alt={file.name} className="mb-1 max-h-28 max-w-full rounded object-contain" />
    )}
    <span className="block truncate" title={file.name}>📎 {file.name}</span>
  </div>)}</div>;
}
export function MaterialAttachments({ materials, disabled }: { materials: SourceMaterialsController; disabled: boolean }) {
  const pending = materials.items.filter(item => !item.sent);
  const sentCount = materials.items.filter(item => item.sent).length;
  return <div className="space-y-2">
    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
      <label className={`inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[var(--border-light)] px-2 py-1.5 hover:text-[var(--accent-terracotta)] ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
        <Paperclip className="h-4 w-4" />上传资料
        <input type="file" multiple accept={MATERIAL_ACCEPT} disabled={disabled} className="sr-only" aria-label="上传资料" onChange={event => { materials.add(Array.from(event.target.files || [])); event.target.value = ''; }} />
      </label>
      <span>MD / PDF / 图片 · 最多 5 个，共 10 MiB</span>
    </div>
    {sentCount > 0 && <p className="text-xs text-[var(--text-muted)]">本次文稿已关联 {sentCount} 份资料</p>}
    {pending.length > 0 && <ul className="max-h-52 space-y-2 overflow-y-auto" aria-label="待发送附件">{pending.map(item => <li key={item.key} className="flex items-start gap-2 rounded-xl border border-[var(--border-light)] bg-[var(--bg-card)] p-2">
      {item.attachment?.mimeType.startsWith('image/')
        // Private previews require the browser session cookie, not Next image optimization.
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={`/api/materials/${item.attachment.id}/preview`} alt={item.file.name} className="h-10 w-10 rounded object-cover" />
        : <FileText className="mt-1 h-5 w-5 shrink-0 text-[var(--text-muted)]" />}
      <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium" title={item.file.name}>{item.file.name}</p>
        <p className="text-xs text-[var(--text-muted)]" aria-live="polite">{Math.ceil(item.file.size / 1024)} KB · {{ uploading: '上传中', pending: '待发送', reading: '模型读取中', ready: '已就绪', error: '失败' }[item.status]}</p>
        {item.error && <p className="mt-1 text-xs text-red-700">{item.error}</p>}
        {item.status === 'error' && <button type="button" disabled={disabled} className="mt-1 text-xs underline" onClick={() => void materials.retry(item.key)}>重试读取</button>}
      </div>
      {['uploading', 'reading'].includes(item.status) ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <button type="button" disabled={disabled} onClick={() => void materials.remove(item.key)} aria-label={`移除 ${item.file.name}`} className="rounded p-1 hover:bg-black/5"><X className="h-4 w-4" /></button>}
    </li>)}</ul>}
    {materials.error && <p role="alert" className="text-xs text-red-700">{materials.error}</p>}
    {pending.length > 0 && <p className="text-xs text-[var(--text-muted)]">发送后由模型读取原文件；扫描 PDF 也可上传。</p>}
  </div>;
}
