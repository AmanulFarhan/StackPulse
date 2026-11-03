import express from "express";
import "dotenv/config";
import cors from "cors"
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pool from "./config/database.js";
import authRoutes from "./routes/auth.js";
import githubRoutes from "./routes/githubRoutes.js"
import collectionsRoutes from "./routes/collectionsRoutes.js"
import comparisonsRoutes from "./routes/comparisonsRoutes.js"

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(helmet())
app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
}))
app.use(express.json());
app.use(cookieParser());
app.use("/api/auth", authRoutes);
app.use("/api/github", githubRoutes);
app.use("/api/collections", collectionsRoutes);
app.use("/api/comparisons", comparisonsRoutes);

app.get("/api/health-check", (_req, res) => {
    res.json({
        "status": "ok",
        "service": "StackPulse API"
    })
})

app.get("/api/db-check", async (_req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");

        res.json({
            status: "success",
            message: "Database connected successfully!!!",
            databaseTime: result.rows[0].now,
        });
    } catch(error) {
        console.error("Database connected failed", error);

        res.status(500).json({
            status: "error",
            message: "Data connection failed",
        });
    }
});

app.listen(PORT, () => {
    console.log("Server listening on PORT: " + PORT)
});
