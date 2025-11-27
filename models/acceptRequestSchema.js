import mongoose from "mongoose";

const acceptRequestSchema = new mongoose.Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BloodRequest",
      required: true,
    },
    donorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
    remarks: {
      type: String,
      default: "",
    },

    // NEW FIELD: Save distance
    distanceInKm: {
      type: Number,
      default: null,
    },

    // NEW FIELD: save action (approved/accepted/completed)
    status: {
      type: String,
      enum: ["approved", "accepted", "completed"],
      default: "approved",
    },
  },
  { timestamps: true }
);


const AcceptRequest = mongoose.model("AcceptRequest", acceptRequestSchema);
export default AcceptRequest;
