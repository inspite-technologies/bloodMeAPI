import User from "../models/userSchema.js";
import generateToken from "../utils/generateToken.js";
import { sendOtpMail } from "./sendOtp.js";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
import BloodRequest from "../models/bloodrequestSchema.js";
import AcceptRequest from "../models/acceptRequestSchema.js";
import mongoose from "mongoose";

const otpExpiryMap = new Map();

const userSignup = async (req, res) => {
  try {
    const {
      name,
      email,
      dateOfBirth,
      gender,
      password,
      phoneNumber,
      bloodType,
      height,
      weight,
    } = req.body;

    const isExist = await User.findOne({ email });
    if (isExist) {
      return res.status(400).json({ msg: "User already exists" });
    }

    const organizationId = req.organization ? req.organization._id : null;

    const userType = organizationId ? "organization" : "individual";

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000);
    const expiryTime = Date.now() + 10 * 60 * 1000; // 5 minutes expiry
    otpExpiryMap.set(email, expiryTime);

    const newUser = await User.create({
      name,
      email,
      dateOfBirth,
      gender,
      phoneNumber,
      password,
      bloodType,
      otp,
      userType,
      organizationId,
      height,
      weight,
    });

    await sendOtpMail(email, otp);

    res.status(201).json({
      msg: `User created. OTP sent to ${email} for verification.`,
      userId: newUser._id,
      type: userType,
      underOrganization: Boolean(organizationId),
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Signup failed", details: err.message });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { email, otp, fcmToken } = req.body;
    console.log("request body:", req.body);
    console.log("Received OTP verification request:", { email, otp, fcmToken });

    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ msg: "User not found" });

    // Check expiry from Map
    const expiryTime = otpExpiryMap.get(email);
    if (!expiryTime || Date.now() > expiryTime) {
      // OTP expired — delete user from DB
      await User.deleteOne({ email });
      otpExpiryMap.delete(email);

      return res.status(400).json({
        msg: "OTP expired. Your registration has been removed. Please sign up again.",
      });
    }

    // Check OTP match
    if (user.otp === Number(otp)) {
      if (fcmToken) {
        user.fcmToken = fcmToken;
      }
      user.isVerified = true;
      user.otp = null;

      console.log("Before update:", {
        otp: user.otp,
        fcmToken: user.fcmToken,
      });

      await user.save();
      otpExpiryMap.delete(email);

      return res.status(200).json({
        msg: "Email verified successfully",
        fcmSaved: fcmToken ? true : false,
      });
    }

    return res.status(400).json({ msg: "Invalid OTP" });
  } catch (err) {
    console.error("OTP verification error:", err);
    return res.status(500).json({
      msg: "Server Error",
      error: err.message,
    });
  }
};

const userLogin = async (req, res) => {
  const { email, password, fcmToken } = req.body;

  try {
    const existUser = await User.findOne({ email });

    if (!existUser) {
      return res.status(400).json({ msg: "User not found" });
    }

    if (existUser.isVerified === false) {
      return res
        .status(400)
        .json({ msg: "Please verify your email before login" });
    }

    const isMatch = await existUser.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Incorrect password" });
    }

    // 🔥 Save/Update FCM Token
    if (fcmToken) {
      console.log("Received fcmToken:", fcmToken);
      existUser.fcmToken = fcmToken;
      await existUser.save();
      console.log("Updated user:", existUser);
    }

    return res.status(200).json({
      msg: "Login successful",
      token: generateToken(existUser._id),
      userId: existUser._id,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ msg: "Internal server error" });
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    //  Check if user exists
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: "User not found" });

    //  Create JWT token (valid for 10 minutes)
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "10m" }
    );

    // Create reset link with token
    const resetLink = `http://localhost:3000/reset-password/${token}`;

    //  Send email with Nodemailer
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // app password
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset Request",
      html: `
        <p>Click the link below to reset your password (valid for 10 minutes):</p>
        <a href="${resetLink}">${resetLink}</a>
      `,
    };

    await transporter.sendMail(mailOptions);
    return res.status(200).json({ msg: "Reset link sent to your email" });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ msg: "Error sending email" });
  }
};

const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    //  Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    //  Find user by decoded ID
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    //  Update password (your pre-save hook hashes it)
    user.password = password;
    await user.save();

    return res.status(200).json({ msg: "Password reset successful" });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(400).json({ msg: "Invalid or expired token" });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const getUserDetails = await User.find();
    return res.status(200).json({
      msg: "details fetched successfully",
      getUserDetails,
    });
  } catch (err) {
    console.error("error during fetching the users", err);
    res.status(400).json({
      msg: err,
    });
  }
};

const getUserDetails = async (req, res) => {
  try {
    const userId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ msg: "Invalid user ID" });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }
    const donationRecords = await AcceptRequest.find({ donorId: user._id });
    const donationCount = donationRecords.length;
    const latestDonation = await AcceptRequest.findOne({
      donorId: user._id,
    }).sort({ createdAt: -1 });
    let lastDonationTime = "No donations yet";
    if (latestDonation) {
      const diffMs = Date.now() - new Date(latestDonation.createdAt);
      const diffMinutes = Math.floor(diffMs / (1000 * 60));

      if (diffMinutes < 60) {
        lastDonationTime = `${diffMinutes} minutes ago`;
      } else if (diffMinutes < 1440) {
        const diffHours = Math.floor(diffMinutes / 60);
        lastDonationTime = `${diffHours} hours ago`;
      } else if (diffMinutes < 10080) {
        const diffDays = Math.floor(diffMinutes / 1440);
        lastDonationTime = `${diffDays} days ago`;
      } else {
        const diffWeeks = Math.floor(diffMinutes / 10080);
        lastDonationTime = `${diffWeeks} weeks ago`;
      }
    }

    return res.status(200).json({
      msg: "User data fetched successfully",
      data: {
        user,
        totalDonations: donationCount,
        lastDonation: lastDonationTime,
      },
    });
  } catch (err) {
    console.error("Error during fetching user details:", err);
    return res.status(500).json({
      msg: "Internal Server Error",
      error: err.message,
    });
  }
};

const getNearbyEligibleDonors = async (req, res) => {
  try {
    const userId = req.user._id;
    const { latitude, longitude, bloodGroup, radius = 5000 } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ msg: "Location coordinates are required" });
    }

    // Find users of same blood group nearby (geospatial query)
    const nearbyUsers = await User.find({
      bloodGroup,
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [longitude, latitude] },
          $maxDistance: radius, // meters
        },
      },
    });

    // Check which users are eligible to donate again (haven’t donated recently)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const eligibleDonors = [];

    for (const user of nearbyUsers) {
      // Check last completed donation for this user
      const lastDonation = await AcceptRequest.findOne({
        donationId: user._id,
        status: "completed",
      }).sort({ updatedAt: -1 });

      if (!lastDonation || new Date(lastDonation.updatedAt) < ninetyDaysAgo) {
        eligibleDonors.push(user);
      }
    }

    if (eligibleDonors.length === 0) {
      return res.status(404).json({ msg: "No eligible donors found nearby" });
    }

    return res.status(200).json({
      msg: "Nearby eligible donors fetched successfully",
      count: eligibleDonors.length,
      data: eligibleDonors,
    });
  } catch (err) {
    console.error("Error fetching nearby eligible donors:", err);
    return res.status(500).json({
      msg: "Internal Server Error",
      error: err.message,
    });
  }
};

const leaveOrg = async (req, res) => {
  try {
    const id = req.user._id;

    console.log("id is in leave", id);

    const isExist = await User.findByIdAndUpdate(
      id,
      { organizationId: null, userType: "individual" },
      { new: true }
    );
    if (isExist) {
      return res.status(200).json({
        msg: "user leave the organization successfully",
      });
    }
    return res.status(400).json({
      msg: "error during leaving org",
    });
  } catch (err) {
    console.error("Error fetching nearby eligible donors:", err);
    return res.status(500).json({
      msg: "Internal Server Error",
      error: err.message,
    });
  }
};

//if exist user or any user in db

export {
  userSignup,
  userLogin,
  verifyOtp,
  getAllUsers,
  getUserDetails,
  getNearbyEligibleDonors,
  forgotPassword,
  resetPassword,
  leaveOrg,
};
