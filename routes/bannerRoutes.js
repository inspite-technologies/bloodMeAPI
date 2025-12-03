import express from 'express';
import { createBanner,fetchAllBanners } from '../controllers/bannerController.js';
import upload from '../config/multer.js';

const app = express.Router()

app.route('/').post(upload.single('AdImageUrl'), createBanner).get(fetchAllBanners);



export default app