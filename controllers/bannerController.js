import Banner from "../models/bannerSchema.js";
import { supabase } from "../utils/supabase.js";

const createBanner = async (req, res) => {
  try {
    const { AdTitle, startDate, endDate } = req.body;

    // Check file
    if (!req.file) {
      return res.status(400).json({ msg: "AdImageUrl file is required" });
    }

    // Generate file path
    const fileName = `${Date.now()}-${req.file.originalname}`;
    const filePath = `banner/${fileName}`; // folder inside bucket

    // Upload to Supabase bucket "banner"
    const { data, error } = await supabase.storage
      .from("banner")
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
      });

    if (error) {
      return res.status(500).json({ msg: "Upload failed", error });
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from("banner")
      .getPublicUrl(filePath);

    const imageUrl = publicUrlData.publicUrl;

    // Save in DB
    const newBanner = new Banner({
      AdTitle,
      AdImageUrl: imageUrl,
      startDate,
      endDate,
    });

    await newBanner.save();

    res.status(201).json({
      msg: "Banner created successfully",
      data: newBanner,
    });
  } catch (error) {
    console.error("Error creating banner:", error);
    res.status(500).json({ msg: "Server error", error: error.message });
  }
};

const fetchAllBanners = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const banners = await Banner.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const total = await Banner.countDocuments();
    res.status(200).json({
      msg: "Banners fetched successfully",
      data: banners,
      page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
    });
  } catch (error) {
    console.error("Error fetching banners:", error);
    res.status(500).json({ msg: "Server error", error: error.message });
  }
}



export { createBanner ,fetchAllBanners};