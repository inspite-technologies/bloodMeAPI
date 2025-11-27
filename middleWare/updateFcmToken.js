export const updateFcmToken = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    const fcmToken = req.body.fcmToken;  // 🔥 read from body

    if (userId && fcmToken) {
      await User.findByIdAndUpdate(userId, { fcmToken }, { new: true });
      console.log("🔥 FCM Token updated for user:", userId);
    }

    next();
  } catch (err) {
    console.error("Error updating FCM token:", err);
    next();
  }
};
