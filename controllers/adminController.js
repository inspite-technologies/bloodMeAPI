import Admin from "../models/adminSchema.js";
import generateToken from "../utils/generateToken.js";

const adminSignup = async (req, res) => {
  try {
    const { email, password } = req.body;
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: "Admin already exists" });
    }
    const newAdmin = new Admin({ email, password });
    await newAdmin.save();
    res.status(201).json({ message: "Admin registered successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ msg: "Email and password are required" });
    }

    const admin = await Admin.findOne({ email: email.trim() });

    if (!admin) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    const isMatch = await admin.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    return res.status(200).json({
      msg: "Login successful",
      token: generateToken(admin._id),
      userId: admin._id,
    });

  } catch (err) {
    console.error("Admin login error:", err);
    return res.status(500).json({ msg: "Internal server error" });
  }
};

export { adminSignup, adminLogin };
