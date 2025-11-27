import User from "../models/userSchema.js";

export const updateFcmToken = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    const fcmToken = req.headers["fcm-token"];

    if (userId && fcmToken) {
      await User.findByIdAndUpdate(
        userId,
        { fcmToken },
        { new: true }
      );
      console.log("FCM Token updated for user:", userId);
    }

    next();
  } catch (err) {
    console.error("Error updating FCM token:", err);
    next();
  }
};
