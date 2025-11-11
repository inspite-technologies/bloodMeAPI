import express from 'express';
import {organizationSignup,organizationLogin,fetchOrgDetails,updateOrgInfo} from '../controllers/organizationController.js'
import { userSignup } from '../controllers/userController.js';
import protectOrganization from '../middleWare/organizationMiddleware.js'

const app = express.Router()

app.route('/').post(organizationSignup)
app.route('/add-user').post(protectOrganization,userSignup)
app.route('/login').post(organizationLogin)
app.route('/profile').get(protectOrganization,fetchOrgDetails).put(protectOrganization,updateOrgInfo)

export default app

