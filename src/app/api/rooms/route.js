import Room from '@/lib/models/Room'
import { route, readJson, json, pick, ApiError } from '@/lib/api'

const ROOM_FIELDS = ['name', 'floor', 'capacity', 'rent', 'notes']

export const GET = route(async ({ scope }) => {
  const rooms = await Room.find(scope.filter({ status: 'active' }, 'orgId'))
  rooms.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  return json(rooms)
}, { permission: 'rooms.view' })

export const POST = route(async ({ request, org, scope, audit }) => {
  const body = await readJson(request)
  const property = await scope.defaultProperty(body.propertyId)
  const name = String(body.name ?? '').trim()
  if (name && await Room.exists({ propertyId: property._id, name, status: 'active' })) {
    throw new ApiError(409, `${property.name} already has a room called ${name}.`)
  }
  const room = await Room.create({ ...pick(body, ROOM_FIELDS), orgId: org._id, propertyId: property._id })
  await audit('room.create', { target: { kind: 'room', id: room._id.toString(), label: `${room.name} · ${property.name}` }, details: { capacity: room.capacity, rent: room.rent } })
  return json(room, 201)
}, { permission: 'rooms.manage' })
