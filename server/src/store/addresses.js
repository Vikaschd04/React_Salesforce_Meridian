/**
 * Saved addresses — the seam between the routes and the data source, mirroring
 * store/wishlist.js. DATA_SOURCE=mock keeps addresses in an in-memory
 * Map<contactId, Address[]>; DATA_SOURCE=salesforce reads/writes real
 * Meridian_Address__c rows (see sf/addresses.js). Both enforce one default
 * address per shopper and return the same address shape.
 */
import { config } from '../config.js'
import { randomBytes } from 'node:crypto'
import * as sfAddresses from '../sf/addresses.js'

const useSalesforce = config.dataSource === 'salesforce'
const mockAddresses = new Map() // contactId -> Address[]

function mockGet(contactId) {
  return mockAddresses.get(contactId) || []
}
function mockPut(contactId, list) {
  mockAddresses.set(contactId, list)
}
// default first, then most-recent
function sortMock(list) {
  return [...list].sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
}

function mockCreate(contactId, address) {
  const list = mockGet(contactId)
  const isDefault = address.isDefault || list.length === 0
  const created = {
    id: `addr_${randomBytes(6).toString('hex')}`,
    label: address.label || '',
    name: address.name || '',
    street: address.street || '',
    city: address.city || '',
    stateCode: address.stateCode || '',
    postalCode: address.postalCode || '',
    countryCode: address.countryCode || '',
    isDefault,
  }
  const next = isDefault ? list.map((a) => ({ ...a, isDefault: false })) : [...list]
  next.push(created)
  mockPut(contactId, next)
}

function mockUpdate(contactId, id, patch) {
  let list = mockGet(contactId)
  if (!list.some((a) => a.id === id)) return
  list = list.map((a) => (a.id === id ? { ...a, ...patch } : a))
  if (patch.isDefault) list = list.map((a) => (a.id === id ? a : { ...a, isDefault: false }))
  mockPut(contactId, list)
}

function mockRemove(contactId, id) {
  mockPut(contactId, mockGet(contactId).filter((a) => a.id !== id))
}

/** The shopper's saved addresses, default first. */
export async function list(contactId) {
  if (useSalesforce) return sfAddresses.listForContact(contactId)
  return sortMock(mockGet(contactId))
}

export async function create(contactId, address) {
  if (useSalesforce) await sfAddresses.create(contactId, address)
  else mockCreate(contactId, address)
  return list(contactId)
}

export async function update(contactId, id, patch) {
  if (useSalesforce) await sfAddresses.update(contactId, id, patch)
  else mockUpdate(contactId, id, patch)
  return list(contactId)
}

export async function remove(contactId, id) {
  if (useSalesforce) await sfAddresses.remove(contactId, id)
  else mockRemove(contactId, id)
  return list(contactId)
}
