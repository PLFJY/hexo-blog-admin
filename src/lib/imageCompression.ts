export const IMAGE_COMPRESSION_THRESHOLD_BYTES = 500 * 1024
export const MAX_IMAGE_DIMENSION = 2560
export const WEBP_QUALITIES = [0.92, 0.88, 0.84, 0.8] as const

export type CompressibleImageMime =
  | 'image/png'
  | 'image/jpeg'
  | 'image/jpg'
  | 'image/webp'

export type ImageCompressionResult = {
  file: File
  compressed: boolean
  originalSize: number
  compressedSize: number
  originalFilename: string
  finalFilename: string
  message?: string
}

const compressibleMimes = new Set<string>(['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])

export function isCompressibleImage(file: File): boolean {
  return compressibleMimes.has(file.type.toLowerCase())
}

export function toWebpFilename(filename: string): string {
  const normalized = filename.trim() || 'image'
  const withoutExtension = normalized.replace(/\.[^./\\]+$/, '')
  return `${withoutExtension || 'image'}.webp`
}

export async function compressImageToWebp(
  file: File,
  options?: {
    maxDimension?: number
    qualities?: number[]
  },
): Promise<ImageCompressionResult> {
  if (!isCompressibleImage(file)) {
    throw new Error(`Unsupported image type for browser compression: ${file.type || 'unknown'}`)
  }

  const decoded = await decodeImage(file)
  try {
    const maxDimension = options?.maxDimension ?? MAX_IMAGE_DIMENSION
    const scale = Math.min(1, maxDimension / Math.max(decoded.width, decoded.height))
    const width = Math.max(1, Math.round(decoded.width * scale))
    const height = Math.max(1, Math.round(decoded.height * scale))
    const canvas = createCanvas(width, height)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D context is not available.')
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.clearRect(0, 0, width, height)
    context.drawImage(decoded.source, 0, 0, width, height)

    const qualities = options?.qualities?.length ? options.qualities : [...WEBP_QUALITIES]
    let selected: Blob | null = null
    for (const quality of qualities) {
      const blob = await canvasToBlob(canvas, 'image/webp', quality)
      if (!selected || blob.size < selected.size) selected = blob
      if (blob.size <= IMAGE_COMPRESSION_THRESHOLD_BYTES) break
    }
    if (!selected) throw new Error('Browser WebP encoding returned an empty result.')

    const finalFilename = toWebpFilename(file.name)
    return {
      file: new File([selected], finalFilename, { type: 'image/webp', lastModified: Date.now() }),
      compressed: true,
      originalSize: file.size,
      compressedSize: selected.size,
      originalFilename: file.name,
      finalFilename,
    }
  } finally {
    decoded.cleanup()
  }
}

async function decodeImage(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; cleanup: () => void }> {
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(file)
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      }
    } catch {
      // Fall through to HTMLImageElement for formats the browser can display but not bitmap-decode.
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('Failed to decode image in browser.'))
      element.src = url
    })
    return {
      source: image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      cleanup: () => URL.revokeObjectURL(url),
    }
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}

function createCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
  if ('OffscreenCanvas' in window) return new OffscreenCanvas(width, height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function canvasToBlob(canvas: HTMLCanvasElement | OffscreenCanvas, type: string, quality: number): Promise<Blob> {
  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type, quality })
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Browser WebP encoding failed.'))
    }, type, quality)
  })
}
