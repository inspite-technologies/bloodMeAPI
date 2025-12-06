import Star from "../models/starSchema.js";

const submitRating = async (req, res) => {
    try {
        const userId = req.user._id
        const {  stars, comment } = req.body;

        if (!stars) return res.status(400).json({ message: 'Stars are required' });

        // Optional: one rating per user
        if (userId) {
            const existing = await Star.findOne({ userId });
            if (existing) {
                existing.stars = stars;
                existing.comment = comment;
                await existing.save();
                return res.json({ message: 'Rating updated', rating: existing });
            }
        }

        const rating = new Star({ userId, stars, comment });
        await rating.save();
        res.status(201).json({ message: 'Rating submitted', rating });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
};

// Get all ratings and average
const getRatings = async (req, res) => {
    try {
        const userId = req.user._id;

        // find rating of that specific user
        const rating = await Star.findOne({ userId });

        if (!rating) {
            return res.json({
                message: "No rating found for this user"
            });
        }

        res.json({
            stars: rating.stars,
            comment: rating.comment
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
};


export {submitRating,getRatings}