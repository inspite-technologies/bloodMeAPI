import bcrypt from "bcrypt";
import mongoose from "mongoose";

const Schema = mongoose.Schema;

const organizationSchema = new Schema(
  {
    orgName: {
      type: String,
      required: true,
      trim: true,
    },
    organizationType:{
      type:String,
      required:true,
      enum:['Hospital','Blood Bank','NGO','Medical College']
    },
    licenseNo:{
      type:String,
      required:true,
      unique:true
    },
    contactPerson:{
      type:String,
      required:true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    city:{
      type:String,
      required:true
    },
    state:{
      type:String,
      required:true
    },
    pincode:{
      type:Number,
      required:true
    },
    password: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

organizationSchema.index({ location: "2dsphere" });

organizationSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

organizationSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const Organization = mongoose.model("Organization", organizationSchema);
export default Organization;
