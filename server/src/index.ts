import express from "express";
import "dotenv/config";
import cors from "cors"

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(express.json());
app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
}))

app.get("/api/health-check", (_req, res) => {
    res.json({
        "status": "ok",
        "service": "StackPulse API"
    })
})

app.listen(PORT, () => {
    console.log("Server listening on PORT: " + PORT)
});