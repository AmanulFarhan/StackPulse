
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 1. Read token from HTTP-only cookie
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    // 2. Get JWT secret
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      console.error("JWT_SECRET is not configured");

      return res.status(500).json({
        message: "Internal server error",
      });
    }

    // 3. Verify JWT
    const decoded = jwt.verify(token, secret);

    if (
      typeof decoded === "string" ||
      typeof decoded.userId !== "string"
    ) {
      return res.status(401).json({
        message: "Invalid authentication token",
      });
    }

    // 4. Attach authenticated user to request
    req.user = {
      userId: decoded.userId,
    };

    // 5. Continue to the next middleware or route
    next();

  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired session",
    });
  }
};

export default authenticate;
