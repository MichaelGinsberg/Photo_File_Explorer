import { pipeline } from '@xenova/transformers'
import type { PhotoData } from '../types'

// ─── Model lifecycle ──────────────────────────────────────────────────────────
// The MobileNet-v2 model (~14 MB) is downloaded from HuggingFace on first use
// and cached in the browser's Cache API (persists between app restarts).
// All inference runs locally — no image data ever leaves the machine.

export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error'

let _status: ModelStatus = 'idle'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _classifier: any = null

export function getModelStatus(): ModelStatus {
  return _status
}

async function getClassifier() {
  if (_classifier) return _classifier
  _status = 'loading'
  try {
    _classifier = await pipeline('image-classification', 'Xenova/mobilenet-v2')
    _status = 'ready'
    return _classifier
  } catch (err) {
    _status = 'error'
    throw err
  }
}

// ─── Label cleanup ────────────────────────────────────────────────────────────

function cleanLabel(raw: string): string {
  // Strip ImageNet synset ID: "n02099601 golden retriever" → "golden retriever"
  const withoutId = raw.replace(/^n\d{8}\s+/, '')
  // Use only the first synonym when multiple are comma-separated
  return withoutId.split(',')[0].trim().toLowerCase()
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns up to 8 tag suggestions for the given image.
 *
 * Two signals are blended:
 *   1. ML labels  — top MobileNet-v2 predictions for the image itself.
 *   2. Similarity — tags from other photos in the library whose existing tags
 *      overlap with the detected labels, ranked by how often they appear.
 *
 * Already-applied tags are excluded from the output.
 */
export async function suggestTags(
  imageUrl: string | undefined,
  photoData: Record<string, PhotoData>,
  currentPhotoPath: string,
  existingTags: string[]
): Promise<string[]> {
  // ── Step 1: Classify the image ─────────────────────────────────────────────
  const detectedLabels: string[] = []

  if (imageUrl) {
    try {
      const classifier = await getClassifier()
      const results: Array<{ label: string; score: number }> = await classifier(imageUrl, { topk: 8 })
      for (const r of results) {
        if (r.score >= 0.04) {
          const label = cleanLabel(r.label)
          if (label.length > 1 && !detectedLabels.includes(label)) {
            detectedLabels.push(label)
          }
        }
      }
    } catch {
      // RAW files, network errors, or decode failures — skip ML detection
    }
  }

  // ── Step 2: Find similar photos via tag–label word overlap ─────────────────
  // Extract individual words from detected labels (skip very short words)
  const labelWords = detectedLabels
    .flatMap(l => l.split(/\s+/))
    .filter(w => w.length > 2)

  const tagFreq: Record<string, number> = {}

  if (labelWords.length > 0) {
    for (const [path, data] of Object.entries(photoData)) {
      if (path === currentPhotoPath || !data.tags?.length) continue

      // A photo is "similar" if any of its tags share a word with a detected label
      const isRelevant = data.tags.some(tag => {
        const t = tag.toLowerCase()
        return labelWords.some(word => t.includes(word) || word.includes(t))
      })

      if (isRelevant) {
        for (const tag of data.tags) {
          tagFreq[tag] = (tagFreq[tag] || 0) + 1
        }
      }
    }
  }

  // ── Step 3: Merge and rank ─────────────────────────────────────────────────
  const fromSimilar = Object.entries(tagFreq)
    .sort(([, a], [, b]) => b - a)
    .map(([tag]) => tag)
    .filter(tag => !detectedLabels.includes(tag))

  return [...detectedLabels, ...fromSimilar]
    .filter(tag => !existingTags.includes(tag))
    .slice(0, 8)
}
