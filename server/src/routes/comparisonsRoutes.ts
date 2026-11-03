import { Router } from "express";
import type { PoolClient } from "pg";
import { z } from "zod";
import pool from "../config/database.js";
import authenticate from "../middleware/authMiddleware.js";

const router = Router();

const usernamesSchema = z.array(
    z.string().trim()
        .regex(/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i, "Invalid GitHub username")
        .refine((username) => !username.includes("--"), "Invalid GitHub username"),
).min(2, "A saved comparison needs at least two developers")
    .max(4, "A saved comparison can include at most four developers")
    .refine(
        (usernames) => new Set(usernames.map((username) => username.toLowerCase())).size === usernames.length,
        "A developer can only appear once in a comparison",
    );

const createSchema = z.object({
    name: z.string().trim().min(1).max(150),
    usernames: usernamesSchema,
}).strict();

const renameSchema = z.object({
    name: z.string().trim().min(1).max(150),
}).strict();

const idSchema = z.string().uuid();

type ComparisonRecord = {
    id: string;
    name: string;
    created_at: Date | string;
    updated_at: Date | string;
    developers: { id: string; github_username: string; position: number }[];
};

const selectFields = `
    SELECT sc.id, sc.name, sc.created_at, sc.updated_at,
        COALESCE(
            json_agg(
                json_build_object(
                    'id', cd.id,
                    'github_username', cd.github_username,
                    'position', cd.position
                ) ORDER BY cd.position
            ) FILTER (WHERE cd.id IS NOT NULL),
            '[]'::json
        ) AS developers
    FROM saved_comparisons sc
    LEFT JOIN comparison_developers cd ON cd.comparison_id = sc.id`;

router.use(authenticate);

router.post("/", async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            message: "Invalid saved comparison",
            errors: parsed.error.flatten().fieldErrors,
        });
    }

    let client: PoolClient | null = null;
    try {
        client = await pool.connect();
        await client.query("BEGIN");
        const inserted = await client.query<{ id: string }>(
            "INSERT INTO saved_comparisons (user_id, name) VALUES ($1, $2) RETURNING id",
            [req.user!.userId, parsed.data.name],
        );
        const comparisonId = inserted.rows[0]?.id;
        if (!comparisonId) throw new Error("Comparison insert returned no ID");

        for (const [index, username] of parsed.data.usernames.entries()) {
            await client.query(
                "INSERT INTO comparison_developers (comparison_id, github_username, position) VALUES ($1, $2, $3)",
                [comparisonId, username, index + 1],
            );
        }

        const comparison = await client.query<ComparisonRecord>(
            `${selectFields}
            WHERE sc.id = $1 AND sc.user_id = $2
            GROUP BY sc.id`,
            [comparisonId, req.user!.userId],
        );
        await client.query("COMMIT");
        return res.status(201).json({
            message: "Comparison saved",
            comparison: comparison.rows[0],
        });
    } catch (error) {
        if (client) await client.query("ROLLBACK").catch(() => undefined);
        console.error("Save comparison error:", error);
        return res.status(500).json({ message: "Could not save comparison" });
    } finally {
        client?.release();
    }
});

router.get("/", async (req, res) => {
    try {
        const result = await pool.query<ComparisonRecord>(
            `${selectFields}
            WHERE sc.user_id = $1
            GROUP BY sc.id
            ORDER BY sc.updated_at DESC, sc.created_at DESC`,
            [req.user!.userId],
        );
        return res.status(200).json({ comparisons: result.rows });
    } catch (error) {
        console.error("Fetch comparisons error:", error);
        return res.status(500).json({ message: "Could not fetch saved comparisons" });
    }
});

router.get("/:id", async (req, res) => {
    const parsedId = idSchema.safeParse(req.params.id);
    if (!parsedId.success) {
        return res.status(404).json({ message: "Saved comparison not found" });
    }
    try {
        const result = await pool.query<ComparisonRecord>(
            `${selectFields}
            WHERE sc.id = $1 AND sc.user_id = $2
            GROUP BY sc.id`,
            [parsedId.data, req.user!.userId],
        );
        if (!result.rows[0]) {
            return res.status(404).json({ message: "Saved comparison not found" });
        }
        return res.status(200).json({ comparison: result.rows[0] });
    } catch (error) {
        console.error("Fetch comparison error:", error);
        return res.status(500).json({ message: "Could not fetch saved comparison" });
    }
});

router.patch("/:id", async (req, res) => {
    const parsedId = idSchema.safeParse(req.params.id);
    if (!parsedId.success) {
        return res.status(404).json({ message: "Saved comparison not found" });
    }
    const parsedBody = renameSchema.safeParse(req.body);
    if (!parsedBody.success) {
        return res.status(400).json({
            message: "Invalid comparison name",
            errors: parsedBody.error.flatten().fieldErrors,
        });
    }

    try {
        const updated = await pool.query(
            `UPDATE saved_comparisons
            SET name = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 AND user_id = $3
            RETURNING id`,
            [parsedBody.data.name, parsedId.data, req.user!.userId],
        );
        if (!updated.rows[0]) {
            return res.status(404).json({ message: "Saved comparison not found" });
        }
        const result = await pool.query<ComparisonRecord>(
            `${selectFields}
            WHERE sc.id = $1 AND sc.user_id = $2
            GROUP BY sc.id`,
            [parsedId.data, req.user!.userId],
        );
        return res.status(200).json({
            message: "Comparison renamed",
            comparison: result.rows[0],
        });
    } catch (error) {
        console.error("Rename comparison error:", error);
        return res.status(500).json({ message: "Could not rename comparison" });
    }
});

router.delete("/:id", async (req, res) => {
    const parsedId = idSchema.safeParse(req.params.id);
    if (!parsedId.success) {
        return res.status(404).json({ message: "Saved comparison not found" });
    }
    try {
        const result = await pool.query(
            "DELETE FROM saved_comparisons WHERE id = $1 AND user_id = $2 RETURNING id",
            [parsedId.data, req.user!.userId],
        );
        if (!result.rows[0]) {
            return res.status(404).json({ message: "Saved comparison not found" });
        }
        return res.status(200).json({ message: "Comparison deleted", id: result.rows[0].id });
    } catch (error) {
        console.error("Delete comparison error:", error);
        return res.status(500).json({ message: "Could not delete comparison" });
    }
});

export default router;
