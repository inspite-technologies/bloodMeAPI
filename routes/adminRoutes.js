import express from 'express';
import { adminSignup,adminLogin } from '../controllers/adminController.js';


const app = express.Router()

app.route('/').post(adminSignup);
app.route('/login').post(adminLogin);



export default app

