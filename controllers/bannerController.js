import Banner from "../models/bannerSchema.js";
import { supabase } from "../utils/supabase.js";

// Helper function to sanitize filename
const sanitizeFileName = (filename) => {
  // Remove special characters and spaces, replace with hyphens
  return filename
    .replace(/[^\w\s.-]/g, "") // Remove special chars except word chars, spaces, dots, hyphens
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/--+/g, "-") // Replace multiple hyphens with single
    .toLowerCase(); // Convert to lowercase
};

// CREATE
const createBanner = async (req, res) => {
  try {
    const { AdTitle, startDate, endDate, isActive } = req.body;
    if (!req.file)
      return res.status(400).json({ msg: "AdImageUrl file is required" });

    // ✅ Sanitize the filename
    const originalName = req.file.originalname;
    const sanitizedName = sanitizeFileName(originalName);
    const fileName = `${Date.now()}-${sanitizedName}`;

    const { error } = await supabase.storage
      .from("banner")
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
      });

    if (error) return res.status(500).json({ msg: "Upload failed", error });

    const { data: publicUrlData } = supabase.storage
      .from("banner")
      .getPublicUrl(fileName);

    const newBanner = new Banner({
      AdTitle,
      AdImageUrl: publicUrlData.publicUrl,
      startDate,
      endDate,
      isActive,
    });

    await newBanner.save();
    res
      .status(201)
      .json({ msg: "Banner created successfully", data: newBanner });
  } catch (err) {
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};

// UPDATE
const updateBanner = async (req, res) => {
  try {
    const id = req.params.id;
    const banner = await Banner.findById(id);
    if (!banner) return res.status(404).json({ msg: "Banner not found" });

    let updatedFields = { ...req.body };

    if (req.file) {
      // ✅ Sanitize the filename
      const originalName = req.file.originalname;
      const sanitizedName = sanitizeFileName(originalName);
      const fileName = `${Date.now()}-${sanitizedName}`;

      const { error } = await supabase.storage
        .from("banner")
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
        });

      if (error) return res.status(500).json({ msg: "Upload failed", error });

      const { data: publicUrlData } = supabase.storage
        .from("banner")
        .getPublicUrl(fileName);

      updatedFields.AdImageUrl = publicUrlData.publicUrl;

      // Delete old image
      if (banner.AdImageUrl) {
        try {
          const urlParts = banner.AdImageUrl.split("/banner/");
          if (urlParts[1]) {
            // ✅ Decode the filename from URL
            const oldFileName = decodeURIComponent(urlParts[1]);

            const { error: deleteError } = await supabase.storage
              .from("banner")
              .remove([oldFileName]);

            if (deleteError) {
              console.error("Failed to delete old image:", deleteError);
            }
          }
        } catch (deleteErr) {
          console.error("Error deleting old image:", deleteErr);
        }
      }
    }

    const updatedBanner = await Banner.findByIdAndUpdate(id, updatedFields, {
      new: true,
    });
    res
      .status(200)
      .json({ msg: "Banner updated successfully", data: updatedBanner });
  } catch (err) {
    res
      .status(500)
      .json({ msg: "Failed to update banner", error: err.message });
  }
};

// FETCH ALL WITH PAGINATION
const fetchAllBanners = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Step 1: Fetch banners
    let banners = await Banner.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Step 2: AUTO-EXPIRE BLOCK
    const now = new Date();
    const updateOps = [];

    banners.forEach((banner) => {
      const hasExpired = new Date(banner.endDate) < now;

      // Only update if it's expired AND still active
      if (hasExpired && banner.isActive === true) {
        updateOps.push(
          Banner.updateOne(
            { _id: banner._id },
            { $set: { isActive: false } }
          )
        );
      }
    });

    // Step 3: Apply DB updates if needed
    if (updateOps.length > 0) {
      await Promise.all(updateOps);

      // Step 4: Re-fetch updated banners after expiry update
      banners = await Banner.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
    }

    // Step 5: Count total docs
    const total = await Banner.countDocuments();

    // Step 6: Respond to client
    res.status(200).json({
      msg: "Banners fetched successfully",
      data: banners,
      page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
    });

  } catch (err) {
    console.error("Banner fetch error:", err.message);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
};

const getEachBanner = async (req, res) => {
  try {
    const id = req.params.id;
    const banner = await Banner.findById(id);
    if (!banner) return res.status(404).json({ msg: "Banner not found" });

    res.status(200).json({ msg: "Banner fetched successfully", data: banner });
  } catch (err) {
    res.status(500).json({ msg: "Failed to fetch banner", error: err.message });
  }
};

const deleteBanner = async (req, res) => {
  try {
    const id = req.params.id;
    const banner = await Banner.findByIdAndDelete(id);
    res.status(200).json({
      msg: "banner deleted successfully",
    });
  } catch (err) {
    res
      .status(500)
      .json({ msg: "Failed to delete banner", error: err.message });
  }
};

export { createBanner, fetchAllBanners, updateBanner, getEachBanner,deleteBanner };
