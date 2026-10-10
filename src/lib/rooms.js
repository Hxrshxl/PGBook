import mongoose from 'mongoose'
import Room from './models/Room.js'
import Tenant from './models/Tenant.js'
import { ApiError } from './api.js'

/**
 * Finds the room a tenant should go into and checks there is a free bed.
 * Accepts a roomId (normal UI path) or a room name; an unknown name creates
 * a single-bed room so quick entry keeps working.
 */
export async function resolveRoom({ orgId, property, roomId, roomName, rent = 0, excludeTenantId = null }) {
  let room
  if (roomId) {
    if (!mongoose.isValidObjectId(roomId)) throw new ApiError(400, 'Please choose a room.')
    room = await Room.findOne({ _id: roomId, orgId, propertyId: property._id, status: 'active' })
    if (!room) throw new ApiError(400, `That room is not in ${property.name}.`)
  } else {
    const name = typeof roomName === 'string' ? roomName.trim() : ''
    if (!name) throw new ApiError(400, 'Room is required.')
    room = await Room.findOne({ propertyId: property._id, name, status: 'active' })
    if (!room) room = await Room.create({ orgId, propertyId: property._id, name, capacity: 1, rent })
  }

  const occupied = await Tenant.countDocuments({ roomId: room._id, status: 'active', ...(excludeTenantId ? { _id: { $ne: excludeTenantId } } : {}) })
  if (occupied >= room.capacity) {
    throw new ApiError(409, `Room ${room.name} is full (${occupied} of ${room.capacity} beds). Increase its beds on the Rooms page or choose another room.`)
  }
  return room
}

export async function roomOccupancy(roomIds) {
  const rows = await Tenant.aggregate([
    { $match: { roomId: { $in: roomIds }, status: 'active' } },
    { $group: { _id: '$roomId', n: { $sum: 1 } } },
  ])
  return new Map(rows.map(r => [r._id.toString(), r.n]))
}
