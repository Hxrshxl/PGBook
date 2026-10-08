import Property from '@/lib/models/Property'
import Room from '@/lib/models/Room'
import { route, readJson, json } from '@/lib/api'
import { propertyInput } from '@/lib/propertyFields'
import { roomOccupancy } from '@/lib/rooms'

// Properties the signed-in user can access, with bed counts.
export const GET = route(async ({ scope }) => {
  const properties = await Property.find(scope.propertyQuery({ status: 'active' })).sort({ createdAt: 1 })
  const rooms = await Room.find({ propertyId: { $in: properties.map(p => p._id) }, status: 'active' }).select('propertyId capacity')
  const occupancy = await roomOccupancy(rooms.map(r => r._id))
  return json(properties.map(p => {
    const own = rooms.filter(r => String(r.propertyId) === String(p._id))
    const beds = own.reduce((s, r) => s + r.capacity, 0)
    return { ...p.toJSON(), rooms: own.length, beds: beds || p.totalBeds, occupiedBeds: own.reduce((s, r) => s + (occupancy.get(r._id.toString()) ?? 0), 0) }
  }))
}, { permission: 'settings.view' })

// Add another property (Multi-PG). Plan limits on property count arrive with billing (Phase 2).
export const POST = route(async ({ request, org, audit }) => {
  const body = await readJson(request)
  const property = await Property.create({ ownerName: org.name, ...propertyInput(body), orgId: org._id, status: 'active' })
  await audit('property.create', { target: { kind: 'property', id: property._id.toString(), label: property.name } })
  return json({ ...property.toJSON(), rooms: 0, beds: property.totalBeds, occupiedBeds: 0 }, 201)
}, { permission: 'properties.manage' })
