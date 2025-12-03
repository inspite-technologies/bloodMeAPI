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
    } = req.body;

    

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
    console.log("Organization ID:", id);

    // Fetch organization details
    const getOrgDetails = await Organization.findById(id);
    if (!getOrgDetails) {
      return res.status(404).json({
        msg: "Invalid ID or data not found",
      });
    }

    // Count how many users have this organizationId
    const userCount = await User.countDocuments({ organizationId: id });

    return res.status(200).json({
      msg: "Details fetched successfully",
      data: {
        organization: getOrgDetails,
        totalUsers: userCount,
      },
    });

  } catch (err) {
    console.error("Error during fetching the data", err);
    return res.status(500).json({
      msg: "Internal Server Error",
      error: err.message,
    });
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

    // ORGANIZATION UPDATING MEMBER
    if (req.organization) {
      const loggedInOrgId = req.organization._id;
      targetUserId = req.params.id;

      const targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ msg: "User not found" });
      }

      // Allow updating user even if they don't have orgId yet
      // (before joining)
      if (
        targetUser.organizationId &&
        targetUser.organizationId.toString() !== loggedInOrgId.toString()
      ) {
        return res.status(403).json({
          msg: "You are not authorized to update this user",
        });
      }
    }

    // NORMAL USER UPDATING THEIR PROFILE
    else if (req.user) {
      targetUserId = req.user._id;
    }

    // REMOVE RESTRICTED FIELDS
    const blocked = [
      "userType",
      "organizationId",
      "_id",
      "otp",
      "isVerified",
    ];

    const updates = { ...req.body };
    blocked.forEach((key) => delete updates[key]);

    // STATUS LOGIC
    if (req.body.status === "completed") {
      updates.isActive = false;
      updates.status = "completed";
    }

    // FIXED LOCATION LOGIC
    if ("latitude" in req.body && "longitude" in req.body) {
      updates.location = {
        type: "Point",
        coordinates: [
          Number(req.body.longitude),
          Number(req.body.latitude),
        ],
      };
    }

    const updatedUser = await User.findByIdAndUpdate(
      targetUserId,
      updates,
      { new: true }
    );

    return res.status(200).json({
      msg: "User updated successfully",
      data: updatedUser,
    });
  } catch (err) {
    console.error("Error updating user details:", err);
    res.status(500).json({ msg: err.message });
  }
};


const organizationLink = async (req, res) => {
  try {
    const orgId = req.body.orgId;
    
    const organization = await Organization.findById(orgId);
    if (!organization) {
      return res.status(404).json({ msg: "Organization not found" });
    }

    // Generate shareable link with orgId as query parameter
    const joinLink = `${process.env.FRONTEND_URL}/join-organization?orgId=${orgId}`;

    return res.status(200).json({
      message: "Organization join link created successfully",
      link: joinLink,
      orgId: orgId,
      orgName: organization.orgName,
    });
  } catch (err) {
    console.error("Error creating organization link:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};

const getAllOrganizations = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const organizations = await Organization.find()
      .skip(skip)
      .limit(limit);
    const total = await Organization.countDocuments();
    res.status(200).json({
      msg: "Organizations fetched successfully",
      data: organizations,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("Error fetching organizations:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};


export {
  organizationSignup,
  organizationLogin,
  fetchOrgDetails,
  updateOrgInfo,
  getAllUsers,
  removeUserDetails,
  updateUserDetails,
  organizationLink,
  getAllOrganizations
};
