const mimeExtensions: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
}

export async function readImagesFromClipboard(): Promise<File[]> {
  if (!navigator.clipboard || typeof navigator.clipboard.read !== 'function') {
    throw new Error('CLIPBOARD_READ_UNSUPPORTED')
  }

  const items = await navigator.clipboard.read()
  const files: File[] = []
  for (const item of items) {
    const imageType = item.types.find((type) => type.startsWith('image/'))
    if (!imageType) continue
    const blob = await item.getType(imageType)
    files.push(blobToClipboardFile(blob, imageType))
  }
  return files
}

export function extractImageFilesFromPasteEvent(event: ClipboardEvent): File[] {
  const items = Array.from(event.clipboardData?.items ?? [])
  return items
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => {
      const file = item.getAsFile()
      return file ? ensureClipboardFilename(file, item.type) : null
    })
    .filter((file): file is File => Boolean(file))
}

function ensureClipboardFilename(file: File, mime: string): File {
  if (file.name && file.name !== 'image.png') return file
  return new File([file], createClipboardFilename(mime || file.type), { type: file.type || mime, lastModified: Date.now() })
}

function blobToClipboardFile(blob: Blob, mime: string): File {
  return new File([blob], createClipboardFilename(mime || blob.type), { type: blob.type || mime, lastModified: Date.now() })
}

function createClipboardFilename(mime: string): string {
  const date = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  return `clipboard-${stamp}.${mimeExtensions[mime.toLowerCase()] ?? 'png'}`
}
