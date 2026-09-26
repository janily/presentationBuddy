export const MAX_MATERIAL_FILES = 5;
export const MAX_MATERIAL_BYTES = 10 * 1024 * 1024;
export const MATERIAL_ACCEPT = '.md,.markdown,.pdf,.png,.jpg,.jpeg,.webp';
export type MaterialAnalysis = {
  summary: string;
  sections: { title: string; content: string; location: string }[];
  facts: string[];
  tables: string[];
  uncertainties: string[];
  imageDescription: string;
};
export type MaterialAttachment = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  expiresAt: number;
};
export type MaterialEvent = { type: 'progress'; message: string } | { type: 'complete'; attachment: MaterialAttachment } | { type: 'error'; error: string };
