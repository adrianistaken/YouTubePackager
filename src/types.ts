export const VARIANT_KEYS = ['A', 'B', 'C', 'D', 'E'] as const

export type VariantKey = (typeof VARIANT_KEYS)[number]

export type VideoPackage = {
  title: string
  channelName: string
  channelUrl: string
  views: string
  publishTime: string
  duration: string
  avatar: string | null
  activeVariant: VariantKey
  thumbnails: Partial<Record<VariantKey, string>>
}

export type LayoutMode = 'desktop' | 'mobile'

export type WorkspaceState = {
  packageData: VideoPackage
  previewMode: LayoutMode
  placementStep: number
}

export type FeedVideo = {
  id: string
  title: string
  channelName: string
  views: string
  publishTime: string
  duration: string
  thumbnail: string | null
  avatar: string | null
  accent: string
}
