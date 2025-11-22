import express from 'express';
import {bloodRequest,acceptBloodRequest,rejectBloodRequest,getBloodRequest,getAllBloodRequest,getUserById,getHistory} from '../controllers/bloodRequestController.js'
import protect from '../middleWare/userMiddleWare.js';

const app = express.Router()
app.route('/').post(protect,bloodRequest).get(getAllBloodRequest)
app.route('/:id').get(getBloodRequest)
app.route('/accept').post(protect,acceptBloodRequest)
app.route('/reject').post(protect,rejectBloodRequest)
//admin
app.route("/history/:id").get(getUserById)
//user history
app.route("/history").get(protect,getHistory)

export default app
