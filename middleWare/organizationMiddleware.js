import AsyncHandler from "express-async-handler";
import jwt from "jsonwebtoken";
import Organization from "../models/organizationSchema.js";

const protectOrganization = AsyncHandler(async (req, res, next) => {
  try {
    const token = req.headers.token;
    console.log("Verification Key Used:", process.env.JWT_SECRET_KEY);

    if (!token) {
      return res.status(401).json({ msg: "No token provided" });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    console.log("Signing Key Used:", process.env.JWT_SECRET_KEY);

    const org = await Organization.findById(decoded.id);

    if (!org) {
      return res.status(401).json({ msg: "Organization not found" });
    }

    req.organization = org;
    next();
  } catch (error) {
    console.error("Organization auth error:", error);
    res.status(401).json({ msg: "Not authorized, invalid token" });
  }
});

export default protectOrganization;
