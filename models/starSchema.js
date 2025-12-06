import mongoose from "mongoose";

const Schema = mongoose.Schema;

const starSchema = new Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  stars: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

const Star = mongoose.model("Star", starSchema);
export default Star;
