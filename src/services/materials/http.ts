import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
export const MATERIAL_COOKIE = 'pb-material-session';
export function materialSession(request: Request) {
  const value = request.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith(`${MATERIAL_COOKIE}=`))?.slice(MATERIAL_COOKIE.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export function materialOwner(request: Request) {
  const token = materialSession(request);
  return token ? createHash('sha256').update(token).digest('hex') : '';
}
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') throw new Error('不允许跨站上传或读取资料');
}
export function uploadSession(request: Request) {
  const token = materialSession(request) || randomBytes(32).toString('hex');
  return { token, owner: createHash('sha256').update(token).digest('hex') };
}
export function materialError(error: unknown, status = 400) {
  return NextResponse.json({ error: error instanceof Error ? error.message : '资料处理失败，请重试' }, { status });
}
