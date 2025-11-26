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

    console.log("Creating blood request with body:", req.body);

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
    console.log("Saved request:", savedRequest);

    // Find donors with same blood group & valid FCM token
    const donors = await User.find({ bloodType: bloodGroup, fcmToken: { $ne: null } });
    console.log("Matched donors:", donors);

    const tokens = donors.map(d => d.fcmToken).filter(Boolean);
    console.log("FCM tokens:", tokens);

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

      // Optional: log failed tokens
      response.responses.forEach((resp, idx) => {
        if (!resp.success) console.log("Failed token:", tokens[idx], resp.error);
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

// DONOR RESPONDS TO BLOOD REQUEST
const approveRespond = async (req, res) => {
  try {
    const donorId = req.user._id;
    const requestId = req.params.id;

    console.log("Donor responding:", donorId, "for request:", requestId);

    const donor = await User.findById(donorId);
    const request = await BloodRequest.findById(requestId);
    if (!request) return res.status(404).json({ msg: "Blood request not found" });

    const requester = await User.findById(request.requesterId);
    if (!requester.fcmToken) {
      console.log("Requester has no FCM token");
      return res.status(400).json({ msg: "Requester has no FCM token" });
    }

    console.log("Sending notification to requester:", requester.fcmToken);
    const message = {
      token: requester.fcmToken,
      notification: {
        title: "Donor Matched!",
        body: `Donor ${donor.name} (${donor.bloodType}) accepted your request.`,
      },
      data: {
        donorName: donor.name,
        donorPhone: donor.phoneNumber,
        donorBloodGroup: donor.bloodType,
        requestId,
      },
    };

    await admin.messaging().send(message);
    console.log("Notification sent to requester");

    res.json({ msg: "Respond approved & notification sent!" });

  } catch (err) {
    console.error("Error in approveRespond:", err);
    res.status(500).json({ error: err.message });
  }
};

// REQUESTER ACCEPTS DONOR
const acceptBloodRequest = async (req, res) => {
  try {
    const requestId = req.params.id;
    const { donorId, remarks } = req.body;
    const requesterId = req.user._id;

    console.log("Accepting donor:", donorId, "for request:", requestId);

    const request = await BloodRequest.findById(requestId);
    if (!request) return res.status(404).json({ msg: "Request not found" });

    if (request.requesterId.toString() !== requesterId.toString())
      return res.status(403).json({ msg: "You cannot accept donor for this request" });

    const acceptRecord = await AcceptRequest.create({
      requestId,
      donorId,
      remarks,
      status: "accepted",
    });
    console.log("Accept record created:", acceptRecord);

    await BloodRequest.findByIdAndUpdate(
      requestId,
      { status: "accepted", selectedDonor: donorId },
      { new: true }
    );

    const donor = await User.findById(donorId);
    if (donor?.fcmToken) {
      console.log("Sending notification to donor:", donor.fcmToken);
      await admin.messaging().send({
        token: donor.fcmToken,
        notification: {
          title: "Your Response Was Accepted",
          body: "The requester has selected you as donor.",
        },
        data: { requestId: requestId.toString() }
      });
      console.log("Notification sent to donor");
    }

    res.status(201).json({ msg: "Donor accepted successfully", data: acceptRecord });

  } catch (err) {
    console.error("Error in acceptBloodRequest:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
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
