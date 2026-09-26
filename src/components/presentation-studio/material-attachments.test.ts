import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MaterialAttachments, SentAttachments } from './material-attachments';
import type { SourceMaterialsController } from '@/src/hooks/use-source-materials';
describe('attachment controls', () => {
  const file = new File(['facts'], '资料.md');
  const attachment = { id: 'test', name: file.name, mimeType: 'text/markdown', size: file.size, expiresAt: Date.now() + 1000 };
  function state(): SourceMaterialsController {
    return { items: [{ key: '1', file, status: 'error', attachment, sent: false, error: '模型未能读取' }], error: null, isReading: false, sourceIds: { current: [] }, add: vi.fn(), prepare: vi.fn(), retry: vi.fn(), remove: vi.fn(), cancel: vi.fn(), reset: vi.fn() };
  }
  it('shows failed files with recovery controls and accessible upload', () => {
    const html = renderToStaticMarkup(createElement(MaterialAttachments, { materials: state(), disabled: false }));
    expect(html).toContain('aria-label="上传资料"');
    expect(html).toContain('模型未能读取'); expect(html).toContain('重试读取'); expect(html).toContain('移除 资料.md');
  });
  it('does not offer deletion for sources already attached to a message', () => {
    const materials = state(); materials.items[0].sent = true;
    const html = renderToStaticMarkup(createElement(MaterialAttachments, { materials, disabled: false }));
    expect(html).toContain('已关联 1 份资料'); expect(html).not.toContain('移除 资料.md');
    expect(renderToStaticMarkup(createElement(SentAttachments, { attachments: [attachment] }))).toContain('资料.md');
  });
});
