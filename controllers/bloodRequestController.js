import BloodRequest from "../models/bloodrequestSchema.js";
import User from "../models/userSchema.js";
import AcceptRequest from "../models/acceptRequestSchema.js";

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

    // Create request
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

    // 🔥 Get all donors with same blood group
    const donors = await User.find({
      bloodGroup,
      fcmToken: { $ne: null }
    });

    // 🔥 Send push notification to each donor
    donors.forEach((user) => {
      admin.messaging().send({
        token: user.fcmToken,
        notification: {
          title: "Urgent Blood Request",
          body: `${bloodGroup} blood needed at ${hospitalName}`,
        },
        data: {
          requestId: savedRequest._id.toString(),
        }
      });
    });

    res.status(201).json({
      msg: "Blood request created successfully",
      data: savedRequest,
    });

  } catch (error) {
    console.error("Error creating blood request:", error);
    res.status(500).json({ msg: "Server error", error: error.message });
  }
};

const acceptBloodRequest = async (req, res) => {
  try {
    const { requestId, remarks } = req.body;
    const userId = req.user._id;

    const request = await BloodRequest.findById(requestId);
    const requester = await User.findById(request.requesterId);

    const acceptRequest = await AcceptRequest.create({
      requestId,
      donorId: userId,
      remarks,
    });

    await BloodRequest.findByIdAndUpdate(
      requestId,
      { status: "accepted", isActive: false },
      { new: true }
    );

    // 🔥 SEND NOTIFICATION TO REQUESTER
    if (requester.fcmToken) {
      await admin.messaging().send({
        token: requester.fcmToken,
        notification: {
          title: "Your Blood Request is Accepted",
          body: "A donor has accepted your blood request.",
        },
        data: {
          requestId: requestId.toString(),
        }
      });
    }

    res.status(201).json({
      msg: "Blood request accepted successfully",
      data: acceptRequest,
    });

  } catch (err) {
    console.error("Error accepting blood request:", err);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};


const rejectBloodRequest = async (req, res) => {
  try {
    const { requestId } = req.body;

    if (!requestId) {
      return res.status(400).json({ msg: "Request ID is required" });
    }

    const existingRequest = await BloodRequest.findById(requestId);
    if (!existingRequest) {
      return res.status(404).json({ msg: "Blood request not found" });
    }

    if (existingRequest.status === "accepted") {
      return res.status(400).json({
        msg: "Cannot reject a request that has already been accepted",
      });
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
    console.error("Error during rejecting the request:", err);
    res.status(500).json({
      msg: "Server error while rejecting the request",
      error: err.message,
    });
  }
};

// get all where active
const getAllBloodRequest = async (req, res) => {
  try {
    const getDetails = await BloodRequest.find({ isActive: true });
    return res.status(200).json({
      msg: "details fetched successfully",
      data: getDetails,
    });
  } catch (err) {
    console.error("error during fetching the data", err);
  }
};

// get by specific id of blood request 
const getBloodRequest = async (req, res) => {
  try {
    const id = req.params.id;
    const getDetails = await BloodRequest.findById(id);
    return res.status(200).json({
      msg: " single blood request details fetched successfully",
      data: getDetails,
    });
  } catch (err) {
    console.error("error during fetching the data", err);
  }
};


// get by certain user id
// const getBloodDetailsById = async (req, res) => {
//   try {
//     const id = req.params.id;
//     const fetchById = await BloodRequest.find({ _id: id });
//     if (!fetchById) {
//       return res.status(401).json({
//         msg: "invalid id or user not found",
//       });
//     }
//     return res.status(200).json({
//       msg: "user details fetched successfully",
//       data: fetchById,
//     });
//   } catch (err) {
//     console.error("error during fetching the data", err);
//   }
// };

const getUserById = async (req, res) => {
  // get details of the blood request of user history by admin view
  try {
    const userId = req.params.id;
    const fetchDetails = await User.findById(userId);
    if (!fetchDetails) {
      return res.status(400).json({
        msg: "invalid id",
      });
    }
    const getUserHistory = await BloodRequest.find({
      requesterId: fetchDetails.id,
    });
    if (!getUserHistory) {
      return res.status(400).json({
        msg: "data not found",
      });
    }
    return res.status(200).json({
      msg: "user data fetched successfully",
      data: getUserHistory,
    });
  } catch (err) {
    console.error("Error during fetching the data:", err);
  }
};

const getHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const getUserDonationHistory = await User.findById(userId);
    console.log("details...", getUserDonationHistory);

    if (!getUserDonationHistory) {
      return res.status(404).json("Invalid id or user not found");
    }
    const getDetails = await BloodRequest.find({
      requesterId: getUserDonationHistory.id,
    });
    console.log("SDADAFADF", getDetails);

    if (!getDetails) {
      return res.status(404).json("details not found");
    }
    return res.status(200).json({
      msg: "details fetched successfully",
      data: getDetails,
    });
  } catch (err) {
    console.error("error during fetched the details", err);
  }
};

export {
  bloodRequest,
  acceptBloodRequest,
  rejectBloodRequest,
  getAllBloodRequest,
  getBloodRequest,
  getUserById,
  getHistory,
};
