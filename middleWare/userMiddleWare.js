import AsyncHandler from 'express-async-handler'
import User from '../models/userSchema.js'
import jwt from 'jsonwebtoken'

const protect = AsyncHandler(async (req, res, next) => {
  try {
    let token = req.headers.token
    let decoded = jwt.verify(token,process.env.JWT_SECRET_KEY)
    let isUser = await User.findOne({ _id : decoded.id })
    if ( !isUser ) {
      res.status(401).json({ msg: 'No user found..' })
      throw new Error('Not Autherized')
    } else {
      req.user = isUser
      next()
    }

  } catch (error) {

    res.status(401).json({ msg: 'Not authorized..' })
    throw new Error('Not authorized, token failed');

  }
});

export default protect