import express from 'express';
import {bloodRequest,approveRespond,acceptBloodRequest,getAllRequestByStatus,rejectBloodRequest,getBloodRequest,getAllBloodRequest,getUserById,getHistory} from '../controllers/bloodRequestController.js'
import protect from '../middleWare/userMiddleWare.js';
import { updateFcmToken } from "../middleWare/updateFcmToken.js";

const app = express.Router()
app.route('/').post(protect,updateFcmToken,bloodRequest).get(protect,getAllBloodRequest);
app.route('/accept').post(protect,acceptBloodRequest).get(protect, getAllRequestByStatus);
app.route('/reject').post(protect, rejectBloodRequest);
app.route('/approve/:id').post(protect,updateFcmToken,approveRespond);
app.route('/accept/:id').post(protect,updateFcmToken,acceptBloodRequest);

// MOVE THIS TO LAST
app.route('/:id').get(getBloodRequest);

// Admin
app.route("/history/:id").get(getUserById);
app.route("/history").get(protect, getHistory);


export default app
