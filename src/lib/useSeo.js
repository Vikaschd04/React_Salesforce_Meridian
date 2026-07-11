import { useEffect } from 'react'

/**
 * Per-route SEO. Sets document.title and upserts the description / Open Graph /
 * Twitter meta + canonical link so each route is share- and crawler-friendly.
 * Dependency-free (no react-helmet); values are overwritten on each navigation.
 */
const SITE_NAME = 'Meridian'
const DEFAULT_DESC =
  'Single-origin coffee, roasted to its coordinates. Traceable beans from named farms, shipped fresh.'

function upsertMeta(attr, key, content) {
  if (content == null) return
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export default function useSeo({ title, description = DEFAULT_DESC, image, type = 'website' } = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} · ${SITE_NAME}` : `${SITE_NAME} — Single-Origin Coffee`
    document.title = fullTitle

    const origin = window.location.origin
    const url = window.location.href.split('#')[0]
    const absImage = image ? (image.startsWith('http') ? image : origin + image) : null

    upsertMeta('name', 'description', description)
    upsertMeta('property', 'og:site_name', SITE_NAME)
    upsertMeta('property', 'og:title', fullTitle)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:type', type)
    upsertMeta('property', 'og:url', url)
    upsertMeta('property', 'og:image', absImage)
    upsertMeta('name', 'twitter:card', absImage ? 'summary_large_image' : 'summary')
    upsertMeta('name', 'twitter:title', fullTitle)
    upsertMeta('name', 'twitter:description', description)
    upsertMeta('name', 'twitter:image', absImage)
    upsertLink('canonical', url.split('?')[0])
  }, [title, description, image, type])
}
