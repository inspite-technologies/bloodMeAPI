import BloodRequest from "../models/bloodrequestSchema.js";
import User from "../models/userSchema.js";
import AcceptRequest from "../models/acceptRequestSchema.js";
import admin from "../config/firebase.js"; // your firebase admin init file

// CREATE BLOOD REQUEST AND NOTIFY DONORS
const bloodRequest = async (req, res) => {
  try {
    console.log("Creating blood request with body:", req.body);

    const {
      requesterId,
      bloodGroup,
      units,
      hospitalName,
      phoneNumber,
      notes,
      location,
      priority,
    } = req.body;

    // Extract latitude & longitude from Flutter GeoJSON
    const longitude = location?.coordinates?.[0];
    const latitude = location?.coordinates?.[1];

    if (!longitude || !latitude) {
      return res.status(400).json({
        msg: "Invalid location format. Expecting { location: { type: 'Point', coordinates: [lng, lat] } }",
      });
    }

    // Create new request
    const newRequest = new BloodRequest({
      requesterId,
      bloodGroup,
      units,
      hospitalName,
      phoneNumber,
      notes,
      location: {
        type: "Point",
        coordinates: [longitude, latitude], // correct GeoJSON
      },
      priority: priority || "moderate",
      status: "pending",
      isActive: true,
    });

    const savedRequest = await newRequest.save();
    console.log("Saved request:", savedRequest);

    // Get eligible donors (same blood group, valid FCM token, not requester)
    const donors = await User.find({
      bloodType: bloodGroup,
      fcmToken: { $ne: null },
      _id: { $ne: requesterId },
    });

    console.log("Found donors:", donors.length);

    // Send notification to each donor
    for (const donor of donors) {
      if (!donor.fcmToken) continue;

      const message = {
        token: donor.fcmToken,
        notification: {
          title: "Urgent Blood Request",
          body: `${bloodGroup} blood needed at ${hospitalName}`,
        },
        data: {
          requestId: savedRequest._id.toString(),
        },
      };

      try {
        const response = await admin.messaging().send(message);
        console.log("Notification sent to:", donor.fcmToken, "Response:", response);
      } catch (err) {
        console.error("Failed to send to:", donor.fcmToken, "Error:", err);

        if (err.code === "messaging/registration-token-not-registered") {
          await User.findByIdAndUpdate(donor._id, { $unset: { fcmToken: "" } });
          console.log("Removed invalid token for user:", donor._id);
        }
      }
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
// -------------------------
// Donor respond
// -------------------------
const approveRespond = async (req, res) => {
  try {
    const donorId = req.user._id;
    const requestId = req.params.id;

    // Donor live location from frontend
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ msg: "Donor live location missing" });
    }

    const donorLat = parseFloat(latitude);
    const donorLng = parseFloat(longitude);

    // Donor & Request data
    const donor = await User.findById(donorId);
    const request = await BloodRequest.findById(requestId);

    if (!request)
      return res.status(404).json({ msg: "Blood request not found" });

    // Request location
    if (!request.location?.coordinates) {
      return res.status(400).json({
        msg: "Request location missing",
      });
    }

    const [reqLng, reqLat] = request.location.coordinates;

    // Distance calculation
    const toRad = (v) => (v * Math.PI) / 180;

    function haversineDistance(lat1, lon1, lat2, lon2) {
      const R = 6371;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lat2 - lon1);

      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) *
          Math.cos(toRad(lat2)) *
          Math.sin(dLon / 2) ** 2;

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }

    const distanceInKm = parseFloat(
      haversineDistance(donorLat, donorLng, reqLat, reqLng).toFixed(2)
    );

    // Save Accept Request
    const saveAccept = await AcceptRequest.create({
      requestId,
      donorId,
      organizationId: donor.organizationId || null,
      remarks: "Donor approved",
      distanceInKm,
      status: "approved",
    });

    // Update request
    request.status = "responded";
    request.distanceFromDonor = distanceInKm;
    await request.save();

    // Notify requester
    const requester = await User.findById(request.requesterId);
    if (!requester || !requester.fcmToken) {
      return res.status(400).json({ msg: "Requester has no FCM token" });
    }

    const message = {
      token: requester.fcmToken,
      notification: {
        title: "Donor Matched!",
        body: `Donor ${donor.name} approved your request. Distance: ${distanceInKm} km`,
      },
      data: {
        donorName: donor.name,
        donorPhone: donor.phoneNumber,
        donorBloodGroup: donor.bloodType,
        requestId,
        distance: distanceInKm.toString(),
      },
    };

    await admin.messaging().send(message);

    res.json({
      msg: "Response saved, status updated & notification sent!",
      savedResponse: saveAccept,
      distance: `${distanceInKm} km`,
      updatedStatus: request.status,
    });
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
      return res
        .status(403)
        .json({ msg: "You cannot accept donor for this request" });

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
        data: { requestId: requestId.toString() },
      });
      console.log("Notification sent to donor");
    }

    res
      .status(201)
      .json({ msg: "Donor accepted successfully", data: acceptRecord });
  } catch (err) {
    console.error("Error in acceptBloodRequest:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};

const getAllRequestByStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status } = req.query;  // 👈 get status from query

    // ---------------------------
    //  Validation
    // ---------------------------
    const allowedStatus = ["approved", "accepted", "completed"];

    if (status && !allowedStatus.includes(status)) {
      return res.status(400).json({
        msg: "Invalid status value. Allowed: approved, accepted, completed",
      });
    }

    // ---------------------------
    //  Build filter query
    // ---------------------------
    const filter = { donorId: userId };

    if (status) {
      filter.status = status;  // add status if provided
    }

    // ---------------------------
    //  Fetch data
    // ---------------------------
    const acceptedRequests = await AcceptRequest.find(filter)
      .populate("requestId", "bloodGroup units hospitalName phoneNumber notes")
      .populate("donorId", "name bloodType phoneNumber email");

    res.status(200).json({
      msg: "Accepted requests fetched successfully",
      statusFilter: status || "all",
      count: acceptedRequests.length,
      data: acceptedRequests,
    });

  } catch (err) {
    console.error("Error fetching accepted requests:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};


// REJECT BLOOD REQUEST
const rejectBloodRequest = async (req, res) => {
  try {
    const { requestId } = req.body;
    if (!requestId)
      return res.status(400).json({ msg: "Request ID is required" });

    const request = await BloodRequest.findById(requestId);
    if (!request)
      return res.status(404).json({ msg: "Blood request not found" });

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
    const userId = req.user._id;

    const requests = await BloodRequest.find({
      isActive: true,
      requesterId: { $ne: userId },
      status: "pending",   // 🔥 Only show pending requests
    });

    res.status(200).json({ msg: "Pending requests fetched", data: requests });
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
  getAllRequestByStatus,
  rejectBloodRequest,
  getAllBloodRequest,
  getBloodRequest,
  getUserById,
  getHistory,
};
