// Controllers/Archive/archiveController.js
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;
const db = require("../../Config/db");

const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads");

/** Map URL or relative upload path to a safe local path. */
function toLocalUploadPath(maybeUrlOrPath) {
  if (!maybeUrlOrPath) return null;

  try {
    if (/^https?:\/\//i.test(maybeUrlOrPath)) {
      const u = new URL(maybeUrlOrPath);
      if (!u.pathname.startsWith("/uploads/")) return null;
      const rel = u.pathname.replace(/^\/?uploads\/?/, "");
      return path.join(UPLOAD_ROOT, rel);
    }
  } catch (_) {}

  if (typeof maybeUrlOrPath === "string" && maybeUrlOrPath.startsWith("/uploads/")) {
    const rel = maybeUrlOrPath.replace(/^\/?uploads\/?/, "");
    return path.join(UPLOAD_ROOT, rel);
  }

  if (typeof maybeUrlOrPath === "string" && !path.isAbsolute(maybeUrlOrPath)) {
    return path.join(UPLOAD_ROOT, maybeUrlOrPath);
  }

  const normalized = path.normalize(maybeUrlOrPath);
  if (normalized.startsWith(UPLOAD_ROOT)) return normalized;
  return null;
}

async function removeFilesSafe(fileList = []) {
  const uniq = Array.from(new Set(fileList)).filter(Boolean);

  const tasks = uniq.map(async (raw) => {
    const local = toLocalUploadPath(raw);
    if (!local) return { file: raw, status: "skipped" };

    try {
      await fsp.unlink(local);
      return { file: raw, status: "deleted" };
    } catch (err) {
      if (err.code !== "ENOENT") {
        console.warn("[archive] unlink failed:", local, err.code || err.message);
      }
      return { file: raw, status: "not_found_or_error" };
    }
  });

  return Promise.allSettled(tasks);
}

/** GET /api/archive/crops – list archived crop items (soft-deleted). */
exports.getArchivedCrops = (req, res) => {
  const sql = `
    SELECT
      c.id,
      c.deleted_at,
      c.deleted_by,
      c.photos,
      c.note,
      ct.name AS crop_name,
      cv.name AS variety_name,
      f.first_name AS farmer_first_name,
      f.last_name  AS farmer_last_name,
      f.barangay   AS farmer_barangay,
      du.first_name AS deleter_first_name,
      du.last_name  AS deleter_last_name,
      du.email      AS deleter_email
    FROM tbl_crops c
    LEFT JOIN tbl_crop_types ct     ON ct.id = c.crop_type_id
    LEFT JOIN tbl_crop_varieties cv ON cv.id = c.variety_id
    LEFT JOIN tbl_farmers f         ON f.farmer_id = c.farmer_id
    LEFT JOIN tbl_users du          ON du.id = c.deleted_by
    WHERE c.is_deleted = 1
    ORDER BY c.deleted_at DESC
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error("getArchivedCrops error:", err);
      return res.status(500).json({ success: false, message: "DB error" });
    }

    const items = (rows || []).map((r) => {
      const owner = [r.farmer_first_name, r.farmer_last_name]
        .filter(Boolean)
        .join(" ")
        .trim();

      const archivedBy =
        r.deleter_first_name || r.deleter_last_name
          ? `${r.deleter_first_name || ""} ${r.deleter_last_name || ""}`.trim()
          : r.deleter_email || null;

      return {
        id: `C-${String(r.id).padStart(6, "0")}`,
        rawId: r.id,
        title: `Crop Entry – ${r.crop_name || "Unknown"}${
          r.variety_name ? ` (${r.variety_name})` : ""
        }`,
        module: "Crops",
        owner: owner || "—",
        barangay: r.farmer_barangay || "—",
        tags: ["Crop", r.crop_name].filter(Boolean),
        archivedAt: r.deleted_at,
        archivedBy: archivedBy || "—",
        reason: "Deleted from Crop Management",
        status: "Archived",

        // used by delete forever cleanup
        _photos: r.photos,
        _note: r.note,
      };
    });

    res.json({ success: true, items });
  });
};

/** POST /api/archive/crops/:id/restore – undo soft delete. */
exports.restoreCrop = (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ success: false, message: "Invalid crop id." });
  }

  const sql = `
    UPDATE tbl_crops
    SET is_deleted = 0,
        deleted_at = NULL,
        deleted_by = NULL
    WHERE id = ? AND is_deleted = 1
    LIMIT 1
  `;

  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("restoreCrop error:", err);
      return res.status(500).json({ success: false, message: "DB error" });
    }

    if (!result.affectedRows) {
      return res
        .status(404)
        .json({ success: false, message: "Not found or not archived" });
    }

    res.json({ success: true, message: "Crop restored." });
  });
};

/**
 * DELETE /api/archive/crops/:id – hard delete crop
 * FIX: delete tbl_crop_history first (FK), then intercrops, then crop.
 */
exports.deleteCropForever = (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ success: false, message: "Invalid crop id." });
  }

  // Fetch photos first (for cleanup after delete)
  db.query("SELECT photos FROM tbl_crops WHERE id = ? LIMIT 1", [id], (err, rows) => {
    if (err) {
      console.error("select crop before hard delete error:", err);
      return res.status(500).json({ success: false, message: "DB error" });
    }
    if (!rows || !rows.length) {
      return res.status(404).json({ success: false, message: "Crop not found" });
    }

    let photoList = [];
    try {
      const raw = rows[0].photos;
      if (raw) photoList = Array.isArray(raw) ? raw : JSON.parse(raw);
    } catch (_) {}

    // Begin transaction for safety
    db.beginTransaction((txErr) => {
      if (txErr) {
        console.error("beginTransaction error:", txErr);
        return res.status(500).json({ success: false, message: "DB error" });
      }

      // 1) DELETE HISTORY FIRST (FK constraint)
      db.query("DELETE FROM tbl_crop_history WHERE crop_id = ?", [id], (e0) => {
        if (e0) {
          console.error("delete crop history error:", e0);
          return db.rollback(() =>
            res.status(500).json({ success: false, message: "DB error" })
          );
        }

        // 2) delete intercrops link rows (safe even if none)
        db.query("DELETE FROM tbl_crop_intercrops WHERE crop_id = ?", [id], (e1) => {
          if (e1) {
            console.error("delete intercrops error:", e1);
            return db.rollback(() =>
              res.status(500).json({ success: false, message: "DB error" })
            );
          }

          // 3) delete the crop last
          db.query("DELETE FROM tbl_crops WHERE id = ? LIMIT 1", [id], async (e2, result) => {
            if (e2) {
              console.error("hard delete crop error:", e2);

              return db.rollback(() => {
                // FK-friendly response if still referenced somewhere else
                if (e2.code === "ER_ROW_IS_REFERENCED_2") {
                  return res.status(409).json({
                    success: false,
                    message:
                      "Cannot delete crop permanently because it is still referenced by other records.",
                    error: e2.code,
                  });
                }
                return res.status(500).json({ success: false, message: "DB error" });
              });
            }

            db.commit(async (cErr) => {
              if (cErr) {
                console.error("commit error:", cErr);
                return db.rollback(() =>
                  res.status(500).json({ success: false, message: "DB error" })
                );
              }

              // Remove files after commit (best effort)
              try {
                await removeFilesSafe(photoList);
              } catch (_) {}

              return res.json({ success: true, message: "Crop permanently deleted." });
            });
          });
        });
      });
    });
  });
};
