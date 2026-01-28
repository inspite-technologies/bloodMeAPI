import express from "express";
import userRoutes from "./routes/userRoutes.js";
import requestRoutes from "./routes/requestRoutes.js";
import organizationRoutes from "./routes/organizationRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import bannerRoutes from './routes/bannerRoutes.js'
import ratingRoutes from './routes/ratingRoutes.js'
import cors from 'cors';

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",                        // Local Vite dev
      "http://localhost:3000",                        // Local CRA
      "https://blood-me-join-page.vercel.app",        // ADD THIS - Your Vercel app
      "https://bloodme.in",                           // Your production domain
      // Add any other frontend URLs you're using
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ❌ REMOVE THIS - Don't use "*" in production
// origin: "*" allows all origins but can cause issues with credentials

// Middleware
app.use(express.json());

// Routes
app.get("/", (req, res) => {
  res.send("Hello from app.js 👋");
});

app.get("/api/test", (req, res) => {
  res.json({ 
    message: "Backend is working!",
    timestamp: new Date(),
    status: "success"
  });
});

app.use("/api/user", userRoutes);
app.use("/api/request", requestRoutes);
app.use("/api/organization", organizationRoutes);
app.use("/api/admin", adminRoutes); 
app.use('/api/banner', bannerRoutes);
app.use('/api/ratings', ratingRoutes);

export default app;

