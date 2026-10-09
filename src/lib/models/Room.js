import mongoose from 'mongoose'

// A room in a property. Capacity is the number of beds; occupancy is counted
// from active tenants assigned to the room.
const roomSchema = new mongoose.Schema({
  orgId:      { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User', index: true },
  propertyId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Property' },
  name:       { type: String, required: [true, 'Room name is required.'], trim: true, maxlength: [20, 'Room name is too long.'] },
  floor:      { type: String, default: '', trim: true, maxlength: [20, 'Floor is too long.'] },
  capacity:   { type: Number, required: true, min: [1, 'A room needs at least 1 bed.'], max: [20, 'A room can have at most 20 beds.'] },
  rent:       { type: Number, default: 0, min: [0, 'Rent cannot be negative.'], max: [10000000, 'Rent is too large.'] }, // default rent per bed
  notes:      { type: String, default: '', trim: true, maxlength: [300, 'Notes are too long.'] },
  status:     { type: String, enum: ['active', 'archived'], default: 'active' },
}, { timestamps: true })

roomSchema.index({ propertyId: 1, name: 1 })

roomSchema.set('toJSON', {
  transform: (_, ret) => {
    ret.id = ret._id.toString()
    ret.orgId = ret.orgId?.toString()
    ret.propertyId = ret.propertyId?.toString()
    delete ret._id
    delete ret.__v
    return ret
  },
})

export default mongoose.models.Room ?? mongoose.model('Room', roomSchema)
