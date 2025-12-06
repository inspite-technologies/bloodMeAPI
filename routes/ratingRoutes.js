import express from 'express'
import { submitRating,getRatings } from '../controllers/ratingController.js'
import protect from '../middleWare/userMiddleWare.js'

const app = express.Router()

app.route('/').post(protect,submitRating).get(protect,getRatings)

export default app

