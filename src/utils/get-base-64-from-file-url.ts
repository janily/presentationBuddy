export async function getBase64FromFileUrl(fileUrl: string): Promise<string> {
  const response = await fetch(fileUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);

  return fileBuffer.toString("base64");
}
