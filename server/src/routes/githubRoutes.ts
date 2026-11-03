import { Router } from "express";
import {
    compareDevelopers,
    searchDevelopers,
    getDeveloperProfile,
    getDeveloperRepositories
} from "../services/githubService.js"
import { z } from "zod";
import { getDeveloperCommitAnalytics } from "../services/activityService.js";
import { GitHubApiError } from "../services/githubService.js";

const router = Router()

const compareRequestSchema = z.object({
  usernames: z.array(
    z.string().trim()
      .regex(/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i, "Invalid GitHub username")
      .refine((username) => !username.includes("--"), "Invalid GitHub username"),
  ).min(2, "Select at least two developers").max(4, "You can compare up to four developers"),
  refresh: z.boolean().optional().default(false),
}).strict().refine(
  ({ usernames }) => new Set(usernames.map((username) => username.toLowerCase())).size === usernames.length,
  { message: "Each GitHub username can only be selected once", path: ["usernames"] },
);

const usernameParamSchema = z.string().regex(/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i).refine((username) => !username.includes("--"));

router.post("/compare", async (req, res) => {
  const parsed = compareRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid comparison request",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const usernames = parsed.data.usernames.map((username) => username.toLowerCase());
    const comparisons = await compareDevelopers(usernames, parsed.data.refresh);
    return res.status(200).json({ comparisons });
  } catch (error) {
    console.error("GitHub comparison error:", error);
    return res.status(500).json({ message: "Could not compare GitHub developers" });
  }
});

router.get("/:username/activity", async (req, res) => {
  const parsedUsername = usernameParamSchema.safeParse(req.params.username);
  if (!parsedUsername.success) {
    return res.status(400).json({ message: "Invalid GitHub username" });
  }

  try {
    const refresh = req.query.refresh === "true" || req.query.refresh === "1";
    const analytics = await getDeveloperCommitAnalytics(parsedUsername.data, refresh);
    return res.status(200).json(analytics);
  } catch (error) {
    if (error instanceof GitHubApiError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("GitHub commit activity analytics error:", error);
    return res.status(500).json({ message: "Could not load commit activity analytics" });
  }
});

router.get("/search", async (req, res) => {
    try {
        const query = req.query.q;

        if (typeof query !== "string" || !query.trim()) {
            return res.status(400).json({
                message: "Search query is required!",
            });
        }

        const result = await searchDevelopers(query.trim());
        console.log(result)
        return res.status(200).json(result);
    } catch(error) {
        console.error("GitHub developer search error:", error);

        return res.status(500).json({
            message:
                error instanceof Error
                ? error.message
                : "Failed to search developers",
            });
    }
});

// Get developer profile
router.get("/:username", async (req, res) => {
  try {
    const profile = await getDeveloperProfile(req.params.username);

    return res.status(200).json(profile);
  } catch (error) {
    console.error("GitHub profile error:", error);

    return res.status(500).json({
      message: error instanceof Error ? error.message : "Failed to fetch profile",
    });
  }
});

// Get developer repositories
router.get("/:username/repos", async (req, res) => {
  try {
    const repositories = await getDeveloperRepositories(
      req.params.username
    );

    return res.status(200).json(repositories);
  } catch (error) {
    console.error("GitHub repositories error:", error);

    return res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch repositories",
    });
  }
});

export default router;
