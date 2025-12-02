import express from "express";
import userRoutes from "./routes/userRoutes.js";
import requestRoutes from "./routes/requestRoutes.js";
import organizationRoutes from "./routes/organizationRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import cors from 'cors';

const app = express();

// ✅ UPDATED: Allow all origins for development (mobile devices can access)
app.use(
  cors({
    origin: [
      "http://localhost:5173", // React (Vite)
      "http://localhost:3000", // If using React CRA
      "http://YOUR_IP:5173",   // React from other devices
      "http://YOUR_IP:8080",   // Flutter Web (if used)
      "*",                     // Allow all (mobile devices)
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  })
);

// For production, you can restrict it:
// app.use(
//   cors({
//     origin: ["http://localhost:8080", "http://192.168.1.100:3000"],
//     methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
//     credentials: true,
//   })
// );

// Middleware
app.use(express.json());

// Routes
app.get("/", (req, res) => {
  res.send("Hello from app.js 👋");
});

// ✅ NEW: Add a test route for Flutter to verify connection
app.get("/api/test", (req, res) => {
  res.json({ 
    message: "Backend is working!",
    timestamp: new Date(),
    status: "success"
  });
});

app.use("/user", userRoutes);
app.use("/request", requestRoutes);
app.use("/organization", organizationRoutes);
app.use("/admin", adminRoutes); 

export default app;
