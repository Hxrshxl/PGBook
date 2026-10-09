import Room from '@/lib/models/Room'
import Tenant from '@/lib/models/Tenant'
import { route, readJson, json, pick, assertObjectId, ApiError } from '@/lib/api'

async function findRoom(scope, id) {
  assertObjectId(id, 'Room')
  const room = await Room.findOne({ _id: id, ...scope.filter({ status: 'active' }, 'orgId') })
  if (!room) throw new ApiError(404, 'Room not found.')
  return room
}

const target = room => ({ kind: 'room', id: room._id.toString(), label: room.name })

export const PUT = route(async ({ request, params, org, scope, audit }) => {
  const room = await findRoom(scope, params.id)
  const body = await readJson(request)
  const before = { name: room.name, capacity: room.capacity, rent: room.rent }
  room.set(pick(body, ['name', 'floor', 'capacity', 'rent', 'notes']))

  const occupied = await Tenant.countDocuments({ roomId: room._id, status: 'active' })
  if (room.capacity < occupied) {
    throw new ApiError(409, `${occupied} tenant(s) live in ${before.name}, so it needs at least ${occupied} beds.`)
  }
  if (room.name !== before.name && await Room.exists({ propertyId: room.propertyId, name: room.name, status: 'active', _id: { $ne: room._id } })) {
    throw new ApiError(409, `There is already a room called ${room.name}.`)
  }
  await room.save()
  if (room.name !== before.name) {
    await Tenant.updateMany({ userId: org._id, roomId: room._id }, { $set: { room: room.name } })
  }
  const details = {}
  for (const k of ['name', 'capacity', 'rent']) if (before[k] !== room[k]) Object.assign(details, { [`${k}From`]: before[k], [`${k}To`]: room[k] })
  if (Object.keys(details).length) await audit('room.update', { target: target(room), details })
  return json(room)
}, { permission: 'rooms.manage' })

// Rooms are archived, not deleted, so past tenants keep their history.
export const DELETE = route(async ({ params, scope, audit }) => {
  const room = await findRoom(scope, params.id)
  if (await Tenant.exists({ roomId: room._id, status: 'active' })) {
    throw new ApiError(409, `Tenants still live in ${room.name}. Move or vacate them first.`)
  }
  room.status = 'archived'
  await room.save()
  await audit('room.archive', { target: target(room) })
  return json({ ok: true })
}, { permission: 'rooms.manage' })
