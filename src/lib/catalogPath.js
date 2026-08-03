/**
 * PDP path for a product or bundle. Bundles are scoped by the `bundle-*`
 * ProductCode convention (see server/src/sf/bundles.js), so a line item / cart
 * entry whose id starts with `bundle-` (or that carries `isBundle`) links to the
 * bundle PDP instead of the product PDP.
 *
 * Accepts an id string or an object with `{ id, isBundle }`.
 */
export function catalogPath(idOrItem) {
  const id = typeof idOrItem === 'string' ? idOrItem : idOrItem?.id
  const isBundle =
    (typeof idOrItem === 'object' && idOrItem?.isBundle) ||
    (typeof id === 'string' && id.startsWith('bundle-'))
  return isBundle ? `/bundles/${id}` : `/product/${id}`
}
