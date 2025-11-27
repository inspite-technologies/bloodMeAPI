import express from 'express';
import {bloodRequest,approveRespond,acceptBloodRequest,getAllAcceptedRequests,rejectBloodRequest,getBloodRequest,getAllBloodRequest,getUserById,getHistory} from '../controllers/bloodRequestController.js'
import protect from '../middleWare/userMiddleWare.js';

const app = express.Router()
app.route('/').post(protect, bloodRequest).get(protect,getAllBloodRequest);
app.route('/accept').post(protect, acceptBloodRequest).get(protect, getAllAcceptedRequests);
app.route('/reject').post(protect, rejectBloodRequest);
app.route('/approve/:id').post(protect, approveRespond);
app.route('/accept/:id').post(protect, acceptBloodRequest);

// MOVE THIS TO LAST
app.route('/:id').get(getBloodRequest);

// Admin
app.route("/history/:id").get(getUserById);
app.route("/history").get(protect, getHistory);


export default app
