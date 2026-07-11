import { Router } from 'express'
import { config } from '../config.js'
import { getProducts } from '../store/catalog.js'
import { asyncHandler } from '../lib/errors.js'

const router = Router()

const STATIC_ROUTES = ['/', '/shop', '/about', '/contact']

const xmlEscape = (s) =>
  String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c])

// GET /sitemap.xml — static routes + one URL per product, from the live catalog.
router.get(
  '/sitemap.xml',
  asyncHandler(async (req, res) => {
    const base = (config.publicUrl || config.appOrigin || '').replace(/\/$/, '')
    let products = []
    try {
      products = await getProducts()
    } catch {
      products = [] // sitemap still serves the static routes if the catalog is down
    }
    const urls = [
      ...STATIC_ROUTES.map((p) => ({ loc: base + p })),
      ...products.map((p) => ({ loc: `${base}/product/${p.id}` })),
    ]
    const body =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      urls.map((u) => `  <url><loc>${xmlEscape(u.loc)}</loc></url>`).join('\n') +
      '\n</urlset>\n'
    res.set('Content-Type', 'application/xml')
    res.set('Cache-Control', 'public, max-age=3600')
    res.send(body)
  }),
)

export default router
