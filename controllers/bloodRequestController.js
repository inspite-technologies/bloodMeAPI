import BloodRequest from "../models/bloodrequestSchema.js";
import User from "../models/userSchema.js";
import AcceptRequest from "../models/acceptRequestSchema.js";
import admin from "../config/firebase.js"; // your firebase admin init file

// CREATE BLOOD REQUEST AND NOTIFY DONORS
const bloodRequest = async (req, res) => {
  try {
    const {
      requesterId,
      bloodGroup,
      units,
      hospitalName,
      phoneNumber,
      notes,
      latitude,
      longitude,
      priority
    } = req.body;

    // Create new blood request
    const newRequest = new BloodRequest({
      requesterId,
      bloodGroup,
      units,
      hospitalName,
      phoneNumber,
      notes,
      location: {
        type: "Point",
        coordinates: [longitude, latitude],
      },
      priority: priority || "moderate",
    });

    const savedRequest = await newRequest.save();

    // Find donors with same blood group & valid FCM token
    const donors = await User.find({
      bloodGroup,
      fcmToken: { $ne: null }
    });

    const tokens = donors.map(d => d.fcmToken).filter(Boolean);

    if (tokens.length > 0) {
      const message = {
        notification: {
          title: "Urgent Blood Request",
          body: `${bloodGroup} blood needed at ${hospitalName}`,
        },
        tokens,
        data: {
          requestId: savedRequest._id.toString(),
        },
      };

      const response = await admin.messaging().sendMulticast(message);
      console.log(`Notifications sent: ${response.successCount}/${tokens.length}`);
      
      // Optional: remove invalid tokens
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.log("Failed token:", tokens[idx], resp.error);
        }
      });
    }

    res.status(201).json({
      msg: "Blood request created successfully",
      data: savedRequest,
    });

  } catch (error) {
    console.error("Error creating blood request:", error);
    res.status(500).json({ msg: "Server error", error: error.message });
  }
};

const approveRespond = async (req, res) => {
  try {
    const donorId = req.user._id;
    const requestId = req.params.id;

    const donor = await User.findById(donorId);
    const request = await BloodRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({ msg: "Blood request not found" });
    }

    if (!request.fcmToken) {
      return res.status(400).json({ msg: "Requester has no FCM token" });
    }

    const message = {
      token: request.fcmToken,
      notification: {
        title: "Donor Matched!",
        body: `Donor ${donor.name} (${donor.bloodGroup}) accepted your request.`,
      },
      data: {
        donorName: donor.name,
        donorPhone: donor.phone,
        donorBloodGroup: donor.bloodGroup,
        donorLocation: donor.location,
        requestId: requestId,
      },
    };

    await admin.messaging().send(message);

    return res.json({
      msg: "Respond approved & notification sent!"
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};



// ACCEPT BLOOD REQUEST AND NOTIFY REQUESTER
const acceptBloodRequest = async (req, res) => {
  try {
    const { requestId } = req.params.id;        // request id from URL parameter
    const { donorId, remarks } = req.body;   // donorId from body
    const requesterId = req.user._id;        // logged-in user (the person requesting blood)

    // Find the blood request
    const request = await BloodRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ msg: "Request not found" });
    }

    // Make sure only the requester can accept a donor
    if (request.requesterId.toString() !== requesterId.toString()) {
      return res.status(403).json({ msg: "You are not allowed to accept donor for this request" });
    }

    // Create an accepted record
    const acceptRecord = await AcceptRequest.create({
      requestId,
      donorId,
      remarks,
      status: "accepted"
    });

    // Update main BloodRequest status
    await BloodRequest.findByIdAndUpdate(
      requestId,
      { 
        status: "accepted", 
        selectedDonor: donorId 
      },
      { new: true }
    );

    // Send push notification to donor
    const donor = await User.findById(donorId);

    if (donor?.fcmToken) {
      await admin.messaging().send({
        token: donor.fcmToken,
        notification: {
          title: "Your Response Was Accepted",
          body: "The requester has selected you as donor.",
        },
        data: { requestId: requestId.toString() }
      });
    }

    res.status(201).json({
      msg: "Donor accepted successfully",
      data: acceptRecord
    });

  } catch (err) {
    console.error("Error accepting blood request:", err);
    res.status(500).json({
      msg: "Server error",
      error: err.message
    });
  }
};


const getAllAcceptedRequests = async (req, res) => {
  try {
    const userId = req.user._id;
    const acceptedRequests = await AcceptRequest.find({donorId:userId})
      .populate("requestId")
      .populate("donorId", "name bloodGroup phoneNumber email");
    res.status(200).json({
      msg: "Accepted requests fetched successfully",
      data: acceptedRequests,
    });
  }
  catch (err) {
    console.error("Error fetching accepted requests:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};

// REJECT BLOOD REQUEST
const rejectBloodRequest = async (req, res) => {
  try {
    const { requestId } = req.body;
    if (!requestId) return res.status(400).json({ msg: "Request ID is required" });

    const request = await BloodRequest.findById(requestId);
    if (!request) return res.status(404).json({ msg: "Blood request not found" });

    if (request.status === "accepted") {
      return res.status(400).json({ msg: "Cannot reject an accepted request" });
    }

    const updatedRequest = await BloodRequest.findByIdAndUpdate(
      requestId,
      { status: "rejected" },
      { new: true }
    );

    res.status(200).json({
      msg: "Blood request rejected successfully",
      data: updatedRequest,
    });

  } catch (err) {
    console.error("Error rejecting blood request:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};

// GET ALL ACTIVE BLOOD REQUESTS
const getAllBloodRequest = async (req, res) => {
  try {
    const requests = await BloodRequest.find({ isActive: true });
    res.status(200).json({ msg: "Active requests fetched", data: requests });
  } catch (err) {
    console.error("Error fetching blood requests:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};

// GET BLOOD REQUEST BY ID
const getBloodRequest = async (req, res) => {
  try {
    const request = await BloodRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ msg: "Request not found" });
    res.status(200).json({ msg: "Request fetched", data: request });
  } catch (err) {
    console.error("Error fetching request:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};

// GET USER BLOOD REQUEST HISTORY (ADMIN)
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    const history = await BloodRequest.find({ requesterId: user._id });
    res.status(200).json({ msg: "User history fetched", data: history });
  } catch (err) {
    console.error("Error fetching user history:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};

// GET LOGGED-IN USER BLOOD REQUEST HISTORY
const getHistory = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    const history = await BloodRequest.find({ requesterId: user._id });
    res.status(200).json({ msg: "User history fetched", data: history });
  } catch (err) {
    console.error("Error fetching history:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};

export {
  bloodRequest,
  approveRespond,
  acceptBloodRequest,
  getAllAcceptedRequests,
  rejectBloodRequest,
  getAllBloodRequest,
  getBloodRequest,
  getUserById,
  getHistory,
};
