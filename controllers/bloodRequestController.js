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

    // Validate required fields
    if (!bloodGroup || !units || !hospitalName || !phoneNumber) {
      return res.status(400).json({
        msg: "Please fill all required fields: bloodGroup, units, hospitalName, phoneNumber"
      });
    }

    // Validate requesterId 
    if (!requesterId) {
      return res.status(400).json({
        msg: "Requester ID is required",
      });
    }

    // Validate lat / long
    if (!latitude || !longitude) {
      return res.status(400).json({
        msg: "Latitude and Longitude are required"
      });
    }

    // Prepare new request object
    const newRequest = new BloodRequest({
      requesterId,
      bloodGroup,
      units,
      hospitalName,
      phoneNumber,
      notes,
      location: {
        type: "Point",
        coordinates: [longitude, latitude], // IMPORTANT ORDER
      },
      priority: priority || "moderate",
    });

    const savedRequest = await newRequest.save();

    res.status(201).json({
      msg: "Blood request created successfully",
      data: savedRequest,
    });

  } catch (error) {
    console.error("Error creating blood request:", error);
    res.status(500).json({
      msg: "Server error while creating blood request",
      error: error.message,
    });
  }
};

const acceptBloodRequest = async (req, res) => {
  try {
    const { requestId, remarks } = req.body;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    const isExist = await AcceptRequest.findOne({ requestId });
    if (isExist) {
      return res
        .status(400)
        .json({ msg: "This blood request has already been accepted" });
    }
    const acceptanceData = {
      requestId,
      donorId: user._id,
      remarks: remarks || "",
    };

    if (user.userType === "organization_user" && user.organizationId) {
      acceptanceData.organizationId = user.organizationId;
    }

    const acceptRequest = await AcceptRequest.create(acceptanceData);

    const updatedRequest = await BloodRequest.findByIdAndUpdate(
      requestId,
      { status: "accepted", isActive: false },
      { new: true }
    );

    if (!updatedRequest) {
      return res.status(404).json({ msg: "Blood request not found" });
    }

    await User.findByIdAndUpdate(
      userId,
      { $inc: { donationCount: 1 } },
      { new: true }
    );

    res.status(201).json({
      msg: "Blood request accepted successfully",
      data: {
        accepted: acceptRequest,
        updatedRequest,
      },
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
    const { latitude, longitude } = req.body; // user calling the API

    if (!latitude || !longitude) {
      return res.status(400).json({ msg: "User location is required" });
    }

    // Step 1: Fetch Active Blood Requests + Full User Details
    const requests = await BloodRequest.find({ isActive: true })
      .populate("requestedBy"); // Get full user details

    if (!requests.length) {
      return res.status(404).json({ msg: "No active blood requests found" });
    }

    // Step 2: Add Distance + Requester Full Detail
    const finalResult = requests.map((reqItem) => {
      const requester = reqItem.requestedBy;

      if (!requester || !requester.location) {
        return {
          ...reqItem._doc,
          requesterDetails: null,
          distance: null,
        };
      }

      const [reqLon, reqLat] = requester.location.coordinates;

      const distance = calculateDistance(
        latitude,
        longitude,
        reqLat,
        reqLon
      );

      return {
        ...reqItem._doc,
        requesterDetails: requester, // FULL DETAILS OF PERSON WHO MADE THE REQUEST
        distance: distance,
      };
    });

    return res.status(200).json({
      msg: "Blood requests fetched successfully",
      count: finalResult.length,
      data: finalResult,
    });

  } catch (err) {
    console.error("Error in blood request fetch:", err);
    return res.status(500).json({
      msg: "Internal Server Error",
      error: err.message,
    });
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
