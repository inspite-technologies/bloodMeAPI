import express from "express";
import userRoutes from "./routes/userRoutes.js";
import requestRoutes from "./routes/requestRoutes.js";
import organizationRoutes from "./routes/organizationRoutes.js";
import cors from 'cors'
const app = express();

app.use(
  cors({
    origin: ["http://localhost:8080"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  })
);

// Middleware
app.use(express.json());

// Routes
app.get("/", (req, res) => {
  res.send("Hello from app.js 👋");
});

app.use("/user", userRoutes);
app.use("/request", requestRoutes);
app.use("/organization", organizationRoutes);

export default app;
