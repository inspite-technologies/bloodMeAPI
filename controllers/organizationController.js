import Organization from "../models/organizationSchema.js";
import protect from "../middleWare/userMiddleWare.js";
import generateToken from "../utils/generateToken.js";
import User from '../models/userSchema.js'

const organizationSignup = async (req, res) => {
  try {
    const {
      orgName,
      organizationType,
      licenseNo,
      contactPerson,
      email,
      phone,
      address,
      city,
      state,
      pincode,
      password,
      location,
    } = req.body;

    if (!location || !location.lat || !location.lng) {
      return res.status(400).json({ msg: "Location must include lat and lng" });
    }

    const newOrg = new Organization({
      orgName,
      organizationType,
      licenseNo,
      contactPerson,
      email,
      phone,
      address,
      city,
      state,
      pincode,
      password,
      location: {
        type: "Point",          
        coordinates: [location.lng, location.lat], 
      },
    });

    await newOrg.save();


    res.status(201).json({
      msg: "Organization registered successfully",
      data: newOrg,
    });

  } catch (error) {
    console.error("Error during organization signup:", error);
    res.status(500).json({ msg: "Server error", error: error.message });
  }
};


const organizationLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const org = await Organization.findOne({ email });
    if (!org) {
      return res.status(404).json({ msg: "Organization not found" });
    }

    const isMatch = await org.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ msg: "Invalid credentials" });
    }

    const token = generateToken(org._id);

    res.status(200).json({
      msg: "Login successful",
      token,
      data: org,
    });
  } catch (error) {
    console.error("Error during organization login:", error);
    res.status(500).json({ msg: "Server error", error: error.message });
  }
};

const fetchOrgDetails = async (req, res) => {
  try {
    const id = req.organization._id;
    console.log("sadasads",id);
    
    const getOrgDetails = await Organization.findById(id);
    if (!getOrgDetails) {
      return res.status(404).json({
        msg: "invalid id or data not found",
      });
    }
    return res.status(200).json({
      msg: "details fetched successfully",
      data: getOrgDetails,
    });
  } catch (err) {
    console.error("error during fetching the data", err);
  }
};

const updateOrgInfo = async (req, res) => {
  try {
    const id = req.organization._id;
    const updateDetails = await Organization.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (!updateDetails) {
      return res.status(404).json({
        msg: "invalid id or data not found",
      });
    }
    return res.status(200).json({
      msg: "org data updated successfully",
      data: updateDetails,
    });
  } catch (err) {
    console.error("error during updating the details");
  }
};

const getAllUsers = async (req, res) => {
  try {
    const orgId = req.organization._id; // from middleware

    const users = await User.find({
      userType: "organization",
      organizationId: orgId,
    });

    return res.status(200).json({
      msg: "Users fetched successfully",
      users,
    });
  } catch (err) {
    console.error("Error during fetching users", err);
    res.status(500).json({
      msg: err.message,
    });
  }
};
const removeUserDetails = async (req, res) => {
  try {
    const id = req.params.id;
    const deleteUser = await User.findByIdAndDelete(id);
    if (!deleteUser) {
      return res.status(400).json({
        msg: "invalid user id",
      });
    }
    return res.status(200).json({
      msg: "user details removed successfully",
    });
  } catch (err) {
    console.error("error during deleting user", err);
    return res.status(500).json({
      msg: "Internal Server Error",
      error: err.message,
    });
  }
};

const updateUserDetails = async (req, res) => {
  try {
    let targetUserId;

    // Case 1: Organization updating another user
    if (req.organization) {
      const loggedInOrgId = req.organization._id;
      targetUserId = req.params.id;

      const targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ msg: "User not found" });
      }

      if (
        !targetUser.organizationId ||
        targetUser.organizationId.toString() !== loggedInOrgId.toString()
      ) {
        return res
          .status(403)
          .json({ msg: "You are not authorized to update this user" });
      }
    }
    // Case 2: Normal user updating their own profile
    else if (req.user) {
      targetUserId = req.user._id;
    }

    const blocked = ["userType", "organizationId", "_id", "otp", "isVerified"];
    const updates = { ...req.body };
    blocked.forEach((key) => delete updates[key]);

    //  Handle status: completed → set isActive to false
    if (req.body.status === "completed") {
      updates.isActive = false;
      updates.status = "completed";
    } else if (req.body.status) {
      // Allow other status values (e.g., "pending", "in-progress")
      updates.status = req.body.status;
    }

    //  Handle latitude & longitude for location
    if (req.body.latitude && req.body.longitude) {
      updates.location = {
        type: "Point",
        coordinates: [req.body.longitude, req.body.latitude], // GeoJSON format
      };

      // Remove from body to avoid storing as separate fields
      delete updates.latitude;
      delete updates.longitude;
    }

    const updatedUser = await User.findByIdAndUpdate(targetUserId, updates, {
      new: true,
    });

    return res.status(200).json({
      msg: "User updated successfully",
      data: updatedUser,
    });
  } catch (err) {
    console.error("Error updating user details:", err);
    res.status(500).json({ msg: err.message });
  }
};

export {
  organizationSignup,
  organizationLogin,
  fetchOrgDetails,
  updateOrgInfo,
  getAllUsers,
  removeUserDetails,
  updateUserDetails
};
