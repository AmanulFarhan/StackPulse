import { Router } from "express";
import { z } from "zod";
import pool from "../config/database.js";
import authenticate from "../middleware/authMiddleware.js";

const router = Router();

const repositorySchema = z.object({
    github_repo_id: z.number().int().positive(),
    owner_login: z.string().trim().min(1).max(255),
    repo_name: z.string().trim().min(1).max(255),
    full_name: z.string().trim().min(1).max(512),
    html_url: z.string().url().refine((value) => {
        const url = new URL(value);
        return url.protocol === "https:" && url.hostname === "github.com";
    }, "Repository URL must point to github.com"),
    description: z.string().max(10000).nullable().optional(),
    stars: z.number().int().nonnegative().default(0),
    forks: z.number().int().nonnegative().default(0),
    language: z.string().max(100).nullable().optional(),
    github_updated_at: z.string().datetime().nullable().optional(),
    note: z.string().max(5000).nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(50)).max(30).default([]),
}).strict();

const updateSchema = z.object({
    note: z.string().max(5000).nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
}).strict().refine((value) => value.note !== undefined || value.tags !== undefined, {
    message: "Provide a note or tags to update",
});
const collectionIdSchema = z.string().uuid();

router.use(authenticate);

router.post("/", async (req, res) => {
    const parsed = repositorySchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            message: "Invalid repository data",
            errors: parsed.error.flatten().fieldErrors,
        });
    }

    const repository = parsed.data;
    const userId = req.user!.userId;

    try {
        const result = await pool.query(
            `INSERT INTO saved_repositories (
                user_id, github_repo_id, owner_login, repo_name, full_name,
                html_url, description, stars, forks, language,
                github_updated_at, note, tags
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING id, github_repo_id, owner_login, repo_name,
                full_name, html_url, description, stars, forks, language,
                github_updated_at, note, tags, created_at`,
            [
                userId,
                repository.github_repo_id,
                repository.owner_login,
                repository.repo_name,
                repository.full_name,
                repository.html_url,
                repository.description ?? null,
                repository.stars,
                repository.forks,
                repository.language ?? null,
                repository.github_updated_at ?? null,
                repository.note ?? null,
                repository.tags,
            ],
        );

        return res.status(201).json({
            message: "Repository saved",
            repository: result.rows[0],
        });
    } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
            return res.status(409).json({ message: "Repository is already saved" });
        }
        console.error("Save repository error:", error);
        return res.status(500).json({ message: "Could not save repository" });
    }
});

router.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, github_repo_id, owner_login, repo_name, full_name,
                html_url, description, stars, forks, language,
                github_updated_at, note, tags, created_at
            FROM saved_repositories
            WHERE user_id = $1
            ORDER BY created_at DESC`,
            [req.user!.userId],
        );
        return res.status(200).json({ repositories: result.rows });
    } catch (error) {
        console.error("Fetch saved repositories error:", error);
        return res.status(500).json({ message: "Could not fetch saved repositories" });
    }
});

router.patch("/:id", async (req, res) => {
    const parsedId = collectionIdSchema.safeParse(req.params.id);
    if (!parsedId.success) {
        return res.status(404).json({ message: "Saved repository not found" });
    }
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            message: "Invalid collection update",
            errors: parsed.error.flatten().fieldErrors,
        });
    }

    const { note, tags } = parsed.data;
    try {
        const result = await pool.query(
            `UPDATE saved_repositories
            SET note = CASE WHEN $3::boolean THEN $4::text ELSE note END,
                tags = CASE WHEN $5::boolean THEN $6::text[] ELSE tags END
            WHERE id = $1 AND user_id = $2
            RETURNING id, github_repo_id, owner_login, repo_name, full_name,
                html_url, description, stars, forks, language,
                github_updated_at, note, tags, created_at`,
            [parsedId.data, req.user!.userId, note !== undefined, note ?? null, tags !== undefined, tags ?? null],
        );

        if (!result.rows[0]) {
            return res.status(404).json({ message: "Saved repository not found" });
        }
        return res.status(200).json({ message: "Repository updated", repository: result.rows[0] });
    } catch (error) {
        if (error instanceof Error && error.message.includes("invalid input syntax for type uuid")) {
            return res.status(404).json({ message: "Saved repository not found" });
        }
        console.error("Update saved repository error:", error);
        return res.status(500).json({ message: "Could not update saved repository" });
    }
});

router.delete("/:id", async (req, res) => {
    const parsedId = collectionIdSchema.safeParse(req.params.id);
    if (!parsedId.success) {
        return res.status(404).json({ message: "Saved repository not found" });
    }
    try {
        const result = await pool.query(
            "DELETE FROM saved_repositories WHERE id = $1 AND user_id = $2 RETURNING id",
            [parsedId.data, req.user!.userId],
        );
        if (!result.rows[0]) {
            return res.status(404).json({ message: "Saved repository not found" });
        }
        return res.status(200).json({ message: "Repository removed", id: result.rows[0].id });
    } catch (error) {
        if (error instanceof Error && error.message.includes("invalid input syntax for type uuid")) {
            return res.status(404).json({ message: "Saved repository not found" });
        }
        console.error("Delete saved repository error:", error);
        return res.status(500).json({ message: "Could not remove saved repository" });
    }
});

export default router;
