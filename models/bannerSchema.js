import mongoose from "mongoose";

const Schema = mongoose.Schema;

const bannerSchema = new Schema(
  {
    AdTitle: {
      type: String,
      required: true,
        trim: true,
    },
    AdImageUrl: {
      type: String,
      required: true,
        trim: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
        required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);
const Banner = mongoose.model("Banner", bannerSchema);
export default Banner;