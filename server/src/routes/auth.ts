import { Router } from "express";
import bcrypt from "bcrypt"
import pool from "../config/database.js";
import jwt from "jsonwebtoken";
import authenticate from "../middleware/authMiddleware.js";


const router = Router();

router.get("/profile", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, username, email FROM users WHERE id = $1",
      [req.user!.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.json({ user: result.rows[0] });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

router.get("/me", async (req, res) => {
    const token = req.cookies?.token;
    const secret = process.env.JWT_SECRET;
    
    if (!token || !secret) {
        return res.status(401).json({
            message: "Not Signed In",
        });
    }

    try {
        const decoded = jwt.verify(token, secret);

        if (typeof decoded === "string" || !decoded.userId) {
            return res.status(401).json({
                message: "Invalid Session",
            });
        }

        const result = await pool.query(
            "SELECT id, username, email FROM users WHERE id = $1",
            [decoded.userId],
        );

        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({
                message: "User not found",
            });
        }

        return res.json({ user });

    } catch {
        return res.status(401).json({ message: "Invalid session" });
    }


});

router.post("/logout", (_req, res) => {
    res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
    });
    return res.json({ message: "Logged out" });
});

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email.trim() || !password || typeof email !== "string" || typeof password !== "string") {
            return res.status(400).json({
                message: "Email and Password are required",
            });
        }

        const result = await pool.query(
            "SELECT id, username, email, password_hash FROM users WHERE email = $1",
            [email.trim().toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        const user = result.rows[0]

        const isPasswordValid = await bcrypt.compare(
            password, user.password_hash
        )

        if (!isPasswordValid) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        const secret = process.env.JWT_SECRET;

        if (!secret) {
            throw new Error("Jwt Secret not configured");
        }

        const token = jwt.sign(
            { userId: user.id },
            secret,
            { expiresIn: "1d" }
        );

        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 24 * 60 * 60 * 1000,
            path: "/",
        });

        return res.status(200).json({
            message: "Successfully logged in!",
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
            },
        });

    } catch (error) {
        console.log("Login Error: ", error);
        res.status(500).json({
            message: "Internal Server Error",
        });
    }
});

router.post("/register", async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        if (!username.trim() || !email.trim() || !password) {
            return res.status(400).json({
                message: "All fields are required",
            });
        }

        if (typeof username !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                message: "Invalid input",
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                message: "Password must be atleast 8 characters"
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const result = await pool.query(
            `INSERT INTO users (username, email, password_hash)
            VALUES ($1, $2, $3)
            RETURNING id, username, email, created_at`,
            [username.trim(), email.trim().toLowerCase(), passwordHash]
        );

        console.log("User Registration Successful");

        res.status(201).json({
            message: "Registration Successfull",
            user: result.rows[0],
        });


    } catch (error: any) {
        if (error.code === "23505") {
            return res.status(409).json({
                message: "Email already registered",
            });
        }

        console.log("Registration error: ", error);

        return res.status(500).json({
            message: "Internal Server Error",
        });
    }
});

export default router;
