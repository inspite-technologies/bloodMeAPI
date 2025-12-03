import mongoose from "mongoose";

const Schema = mongoose.Schema;

const bloodRequestSchema = new Schema(
  {
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    bloodGroup: {
      type: String,
      required: true,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
    },
    units: {
      type: Number,
      required: true,
      min: 1,
    },
    patientName: {
      type: String,
      required: true,
    },
    hospitalAddress: {
      type: String,
      required: true,
    },
    hospitalName: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    notes: {
      type: String,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: false,
        //true
      },
    },
    status: {
      type: String,
      enum: ["pending", "responded", "accepted", "completed", "rejected"],
      default: "pending",
    },
    priority: {
      type: String,
      enum: ["critical", "moderate", "urgent"],
      default: "moderate",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

bloodRequestSchema.index({ location: "2dsphere" });

const BloodRequest = mongoose.model("BloodRequest", bloodRequestSchema);
export default BloodRequest;
