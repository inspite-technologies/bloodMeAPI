import express from 'express';
import { userSignup,userLogin,resetPassword,forgotPassword,verifyOtp,getAllUsers,getUserDetails,updateUserDetails,removeUserDetails,getNearbyEligibleDonors } from '../controllers/userController.js';
import protect from '../middleWare/userMiddleWare.js'
const app = express.Router()

app.route('/').post(userSignup).get(getAllUsers).put(protect,updateUserDetails)
app.route('/near-by').post(getNearbyEligibleDonors)
app.route('/verify').post(verifyOtp)
app.route("/forgot-password").post(forgotPassword);
app.route("/reset-password/:token").post(resetPassword)
app.route('/:id').get(getUserDetails).delete(removeUserDetails)
app.route('/update/:userId').put(protect,updateUserDetails)
app.route('/login').post(userLogin)


export default app