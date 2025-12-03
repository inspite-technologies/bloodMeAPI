import express from 'express';
import { createBanner,fetchAllBanners,updateBanner,getEachBanner,deleteBanner } from '../controllers/bannerController.js';
import upload from '../config/multer.js';

const app = express.Router()

app.route('/').post(upload.single('AdImageUrl'), createBanner).get(fetchAllBanners);
app.route('/:id').put(upload.single('AdImageUrl'), updateBanner).get(getEachBanner).delete(deleteBanner)




export default app