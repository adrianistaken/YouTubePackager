export type VariantKey = 'A' | 'B' | 'C'

export type VideoPackage = {
  title: string
  channelName: string
  views: string
  publishTime: string
  duration: string
  avatar: string | null
  activeVariant: VariantKey
  thumbnails: Partial<Record<VariantKey, string>>
}

export type LayoutMode = 'desktop' | 'mobile'

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
