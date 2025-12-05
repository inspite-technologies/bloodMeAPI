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
      patientName,
      hospitalAddress,
      hospitalName,
      phoneNumber,
      notes,
      location,
      priority,
    } = req.body;

    const longitude = location?.coordinates?.[0];
    const latitude = location?.coordinates?.[1];

    if (!longitude || !latitude) {
      return res.status(400).json({
        msg: "Invalid location format. Expecting { location: { type: 'Point', coordinates: [lng, lat] } }",
      });
    }

    const newRequest = new BloodRequest({
      requesterId,
      bloodGroup,
      units,
      patientName,
      hospitalAddress,
      hospitalName,
      phoneNumber,
      notes,
      location: {
        type: "Point",
        coordinates: [longitude, latitude],
      },
      priority: priority || "moderate",
      status: "pending",
      isActive: true,
    });

    const savedRequest = await newRequest.save();
    console.log("Saved request:", savedRequest);

    const donors = await User.find({
      bloodType: bloodGroup,
      fcmToken: { $ne: null },
      _id: { $ne: requesterId },
    });

    console.log("Found donors:", donors.length);

    // ✅ FIXED: Send complete request data in notification
    for (const donor of donors) {
      if (!donor.fcmToken) continue;

      const message = {
        token: donor.fcmToken,
        notification: {
          title: "Urgent Blood Request",
          body: `${bloodGroup} blood needed at ${hospitalName}`,
        },
        data: {
          // ✅ Send ALL required fields
          requestId: savedRequest._id.toString(),
          type: "blood_request",
          bloodGroup: bloodGroup,
          bloodType: bloodGroup, // Flutter uses both names
          units: units.toString(),
          unitsNeeded: units.toString(),
          hospitalName: hospitalName,
          hospital: hospitalName,
          phoneNumber: phoneNumber || "",
          contactNumber: phoneNumber || "",
          hospitalAddress: `${latitude}, ${longitude}`, // or get actual address
          urgency: priority || "normal",
          notes: notes || "",
          // Add timestamp for sorting
          timestamp: new Date().toISOString(),
        },
      };

      try {
        const response = await admin.messaging().send(message);
        console.log(
          "Notification sent to:",
          donor.fcmToken,
          "Response:",
          response
        );
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

    // Get donor details
    const donor = await User.findById(donorId).select(
      "name phoneNumber bloodType organizationId"
    );

    const request = await BloodRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ msg: "Blood request not found" });
    }

    // Create/update AcceptRequest
    let saveAccept = await AcceptRequest.findOneAndUpdate(
      { requestId, donorId },
      {
        organizationId: donor.organizationId || null,
        status: "approved",
      },
      { new: true, upsert: true }
    );

    saveAccept = await saveAccept.populate(
      "donorId",
      "name phoneNumber bloodType"
    );

    // Send FCM Notification
    const requester = await User.findById(request.requesterId);

    if (requester?.fcmToken) {
      const message = {
        token: requester.fcmToken,
        notification: {
          title: "Donation Completed",
          body: "The donor has confirmed your blood request is completed.",
        },
        data: {
          donorName: saveAccept.donorId.name,
          donorPhone: saveAccept.donorId.phoneNumber,
          donorBloodGroup: saveAccept.donorId.bloodType,
          requestId,
        },
      };

      try {
        await admin.messaging().send(message);
        console.log("Notification sent successfully");
      } catch (error) {
        console.error("FCM Error:", error);

        // HANDLE INVALID TOKEN
        if (error.code === "messaging/registration-token-not-registered") {
          console.log("Invalid FCM token detected. Removing from DB...");

          await User.findByIdAndUpdate(requester._id, {
            $set: { fcmToken: null },
          });

          console.log("Old FCM token removed successfully.");
        }
      }
    }

    res.json({
      msg: "Donor confirmed donation & notification sent!",
      savedResponse: saveAccept,
      bloodRequestStatus: request.status,
    });

  } catch (err) {
    console.error("Error in approveRespond:", err);
    res.status(500).json({ error: err.message });
  }
};

const acceptBloodRequest = async (req, res) => {
  try {
    const requestId = req.params.id;
    const { donorId } = req.body;
    const requesterId = req.user._id;

    // Find the blood request
    const request = await BloodRequest.findById(requestId);
    if (!request) return res.status(404).json({ msg: "Request not found" });

    // Only the requester can mark the donation as completed
    if (request.requesterId.toString() !== requesterId.toString()) {
      return res.status(403).json({ msg: "You cannot complete this donation" });
    }

    // Update AcceptRequest record
    const acceptRecord = await AcceptRequest.findOneAndUpdate(
      { requestId, donorId },
      { status: "completed" },
      { new: true, upsert: true } // create if it doesn't exist
    );

    // Update BloodRequest status
    request.status = "completed";
    request.selectedDonor = donorId;
    await request.save();

    // Update donor's donation count and latest donation date
    const donor = await User.findById(donorId);
    if (donor) {
      donor.donationCount = (donor.donationCount || 0) + 1;

      // Set latest donation date to 2 days ago
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      donor.latestDonationDate = twoDaysAgo;

      await donor.save();

      // Send notification to donor
      if (donor.fcmToken) {
        await admin.messaging().send({
          token: donor.fcmToken,
          notification: {
            title: "Donation Completed",
            body: "The blood donation has been completed successfully.",
          },
          data: { requestId: requestId.toString() },
        });
      }
    }

    res.status(200).json({
      msg: "Donation completed successfully",
      acceptRecord,
      updatedBloodRequest: request,
    });
  } catch (err) {
    console.error("Error in acceptBloodRequest:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};

// REJECT BLOOD REQUEST
const rejectBloodRequest = async (req, res) => {
  try {
    const { requestId, donorId } = req.body;

    if (!requestId || !donorId)
      return res.status(400).json({ msg: "Request ID and Donor ID are required" });

    // Update the AcceptRequest only
    const updatedAccept = await AcceptRequest.findOneAndUpdate(
      { requestId, donorId },
      { status: "rejected" },
      { new: true, upsert: true } // upsert: create record if it doesn't exist
    );

    // Send notification to donor (optional)
    const donor = await User.findById(donorId);
    if (donor?.fcmToken) {
      await admin.messaging().send({
        token: donor.fcmToken,
        notification: {
          title: "Blood Donation Rejected",
          body: `Your offer to donate for this request was rejected.`,
        },
        data: { requestId: requestId.toString() },
      });
    }

    res.status(200).json({
      msg: "Donor response updated successfully",
      data: updatedAccept,
    });
  } catch (err) {
    console.error("Error updating donor response:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};


const getAllRequestByStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status } = req.query; // 👈 get status from query

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
      filter.status = status; // add status if provided
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

// GET ALL ACTIVE BLOOD REQUESTS
const getAllBloodRequest = async (req, res) => {
  try {
    const userId = req.user._id;
    const userLat = parseFloat(req.query.lat);
    const userLng = parseFloat(req.query.lng);

    if (!userLat || !userLng) {
      return res.status(400).json({ msg: "Latitude & Longitude required" });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Update user location
    await User.findByIdAndUpdate(userId, {
      location: {
        type: "Point",
        coordinates: [userLng, userLat],
      },
    });

    // Fetch blood requests with distance and latest first
    const requests = await BloodRequest.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: [userLng, userLat] },
          distanceField: "distance",
          spherical: true,
          query: {
            isActive: true,
            requesterId: { $ne: userId },
            status: "pending",
          },
        },
      },
      { $sort: { createdAt: -1 } }, // latest first
      { $skip: skip },
      { $limit: limit },
    ]);

    const total = await BloodRequest.countDocuments({
      isActive: true,
      requesterId: { $ne: userId },
      status: "pending",
    });

    res.status(200).json({
      msg: "Requests fetched",
      data: requests,
      page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      hasMore: page * limit < total,
    });
  } catch (error) {
    res.status(500).json({ msg: "Server error", error: error.message });
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

    const history = await BloodRequest.find({ donationId: user._id });
    res.status(200).json({ msg: "User history fetched", data: history });
  } catch (err) {
    console.error("Error fetching user history:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};

// GET LOGGED-IN USER BLOOD REQUEST HISTORY
const getHistory = async (req, res) => {
  try {
    const userId = req.user._id;

    // Validate user
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    // Always fetch only completed history
    const filter = { 
      donorId: userId, 
      status: "completed" 
    };

    const history = await AcceptRequest.find(filter)
      .populate({
        path: "requestId",
        select: "hospitalName patientName hospitalAddress createdAt units",
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      msg: "Completed history fetched successfully",
      statusFilter: "completed",
      count: history.length,
      data: history,
    });
  } catch (err) {
    console.error("Error fetching history:", err);
    res.status(500).json({
      msg: "Server error",
      error: err.message,
    });
  }
};


const getDonorsList = async (req, res) => {
  try {
    const requestId = req.params.id;
    const donors = await AcceptRequest.find({ requestId })
      .populate("donorId", "name bloodType phoneNumber email")
      .select("donorId remarks distanceInKm status createdAt");
    res.status(200).json({
      msg: "Donors list fetched successfully",
      count: donors.length,
      data: donors,
    });
  } catch (err) {
    console.error("Error fetching donors list:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};

const getBloodUnits = async (req,res) =>{
  try{
    const unitsCount = await BloodRequest.countDocuments({status:'completed'})
    res.status(200).json({
      msg:"count fetched successfully",
      count:unitsCount
    })
  }catch (err) {
    console.error("Error fetching donors list:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
}

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
  getDonorsList,
  getBloodUnits
};

//if the donation completed by the user update the donationCount in user schema and also the latest donation date which 2 days ago from today// Also update the request status to completed
