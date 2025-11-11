import Organization from "../models/organizationSchema.js";
import protect from "../middleWare/userMiddleWare.js";
import generateToken from "../utils/generateToken.js";

const organizationSignup = async (req, res) => {
  try {
    const { name, email, phone, address, password, location } = req.body;

    const orgExists = await Organization.findOne({ email });
    if (orgExists) {
      return res.status(400).json({ msg: "Organization already exists" });
    }

    const newOrg = new Organization({
      name,
      email,
      phone,
      address,
      password,
      location,
    });

    await newOrg.save();

    const token = generateToken(newOrg._id);

    res.status(201).json({
      msg: "Organization registered successfully",
      token,
      data: newOrg,
    });
  } catch (error) {
    console.error("Error during organization signup:", error);
    res.status(500).json({ msg: "Server error", error: error.message });
  }
};

const organizationLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const org = await Organization.findOne({ email });
    if (!org) {
      return res.status(404).json({ msg: "Organization not found" });
    }

    const isMatch = await org.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ msg: "Invalid credentials" });
    }

    const token = generateToken(org._id);

    res.status(200).json({
      msg: "Login successful",
      token,
      data: org,
    });
  } catch (error) {
    console.error("Error during organization login:", error);
    res.status(500).json({ msg: "Server error", error: error.message });
  }
};

const fetchOrgDetails = async (req, res) => {
  try {
    const id = req.organization._id;
    const getOrgDetails = await Organization.findById(id);
    if (!getOrgDetails) {
      return res.status(404).json({
        msg: "invalid id or data not found",
      });
    }
    return res.status(200).json({
      msg: "details fetched successfully",
      data: getOrgDetails,
    });
  } catch (err) {
    console.error("error during fetching the data", err);
  }
};

const updateOrgInfo = async (req, res) => {
  try {
    const id = req.organization._id;
    const updateDetails = await Organization.findByIdAndUpdate(id,req.body,{new:true});
    if (!updateDetails) {
      return res.status(404).json({
        msg: "invalid id or data not found",
      });
    }
    return res.status(200).json({
      msg: "org data updated successfully",
      data: updateDetails,
    });
  } catch (err) {
    console.error("error during updating the details");
  }
};



export {
  organizationSignup,
  organizationLogin,
  fetchOrgDetails,
  updateOrgInfo,
};
