import express from 'express';
import { createBanner } from '../controllers/bannerController.js';
import upload from '../config/multer.js';

const app = express.Router()

app.route('/').post(upload.single('AdImageUrl'), createBanner);


export default app