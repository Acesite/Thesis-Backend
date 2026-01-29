const db = require("../../Config/db");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");

const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads");

/** Map various URL/string shapes to a safe local file path under UPLOAD_ROOT. */
function toLocalUploadPath(maybeUrlOrPath) {
  if (!maybeUrlOrPath) return null;

  // Absolute URL (http://localhost:5000/uploads/xxx or https://.../uploads/xxx)
  try {
    if (/^https?:\/\//i.test(maybeUrlOrPath)) {
      const u = new URL(maybeUrlOrPath);
      if (!u.pathname.startsWith("/uploads/")) return null;
      const rel = u.pathname.replace(/^\/?uploads\/?/, "");
      return path.join(UPLOAD_ROOT, rel);
    }
  } catch (_) {}

  // Starts with /uploads/...
  if (typeof maybeUrlOrPath === "string" && maybeUrlOrPath.startsWith("/uploads/")) {
    const rel = maybeUrlOrPath.replace(/^\/?uploads\/?/, "");
    return path.join(UPLOAD_ROOT, rel);
  }

  // Bare relative like "crops/a.jpg" → put under /uploads
  if (typeof maybeUrlOrPath === "string" && !path.isAbsolute(maybeUrlOrPath)) {
    return path.join(UPLOAD_ROOT, maybeUrlOrPath);
  }

  // Only allow absolute paths that are inside UPLOAD_ROOT (safety)
  if (typeof maybeUrlOrPath === "string") {
    const normalized = path.normalize(maybeUrlOrPath);
    if (normalized.startsWith(UPLOAD_ROOT)) return normalized;
  }

  return null;
}

/** Best-effort removal; won’t fail the request if files are missing. */
async function removeFilesSafe(fileList = []) {
  const unique = Array.from(new Set(fileList)).filter(Boolean);
  const tasks = unique.map(async (raw) => {
    const local = toLocalUploadPath(raw);
    if (!local) return { file: raw, status: "skipped" };
    try {
      await fsp.unlink(local);
      return { file: raw, status: "deleted" };
    } catch (err) {
      if (err.code !== "ENOENT") {
        console.warn("[deleteCrop] unlink failed:", local, err.code || err.message);
      }
      return { file: raw, status: "not_found_or_error" };
    }
  });
  return Promise.allSettled(tasks);
}

/* ===================== helpers ===================== */
const first = (v) => (Array.isArray(v) ? v[0] : v);

const pickFirstDefined = (...vals) => {
  for (const v of vals) {
    const x = first(v);
    if (x !== undefined) return x;
  }
  return undefined;
};

const toNullableNumber = (v) => {
  v = first(v);
  if (v === undefined || v === null || v === "" || v === "null") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const toNullableText = (v) => {
  v = first(v);
  if (v === undefined || v === null || v === "" || v === "null") return null;
  return String(v);
};

const toBoolTinyInt = (v, defaultVal = null) => {
  v = first(v);
  if (v === undefined || v === null || v === "") return defaultVal;
  if (v === true || v === "true" || v === 1 || v === "1" || v === "yes") return 1;
  return 0;
};
/* ================================================ */

/* =============================== GET ALL CROPS =============================== */
exports.getAllCrops = (req, res) => {
  const sql = `
    SELECT
      c.*,

      ct.name AS crop_name,
      cv.name AS variety_name,

      f.first_name AS farmer_first_name,
      f.last_name AS farmer_last_name,
      f.mobile_number AS farmer_mobile,
      f.barangay AS farmer_barangay,
      f.full_address AS farmer_address,
      f.tenure_id AS farmer_tenure_id,

      tt.tenure_name AS tenure_name,

      u.first_name AS tagger_first_name,
      u.last_name  AS tagger_last_name,
      u.email      AS tagger_email,

      /* since tbl_crops has no crop_barangay column */
      f.barangay AS crop_barangay

    FROM tbl_crops c
    LEFT JOIN tbl_crop_types ct ON ct.id = c.crop_type_id
    LEFT JOIN tbl_crop_varieties cv ON cv.id = c.variety_id

    /* farmer join */
    LEFT JOIN tbl_farmers f ON f.farmer_id = c.farmer_id

    /* tenure name */
    LEFT JOIN tbl_land_tenure_types tt ON tt.tenure_id = f.tenure_id

    /* tagged by */
    LEFT JOIN tbl_users u ON u.id = c.admin_id

    WHERE (c.is_deleted = 0 OR c.is_deleted IS NULL)
    ORDER BY c.created_at DESC
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error("getAllCrops error:", err);
      return res.status(500).json({ success: false, message: "DB error" });
    }
    res.json(rows || []);
  });
};



/* =============================== GET CROP TYPES =============================== */
exports.getCropTypes = (req, res) => {
  const sql = `SELECT id, name FROM tbl_crop_types ORDER BY name ASC`;
  db.query(sql, (err, rows) => {
    if (err) {
      console.error("getCropTypes error:", err);
      return res.status(500).json({ success: false, message: "DB error" });
    }
    res.json(rows || []);
  });
};

/* =============================== GET CROP HISTORY BY FIELD =============================== */
/**
 * Frontend: GET /api/crops/:id/history
 * "same field" = same coordinates string
 * Includes est_farmgate_value_display so previous season shows value.
 */
exports.getCropHistoryByField = (req, res) => {
  const { id } = req.params;

  const findSql = `
    SELECT id, coordinates
    FROM tbl_crops
    WHERE id = ?
    LIMIT 1
  `;

  db.query(findSql, [id], (err, rows) => {
    if (err) {
      console.error("history find error:", err);
      return res.status(500).json({ success: false, message: "DB error" });
    }
    if (!rows || !rows.length) return res.json([]);

    const coords = rows[0].coordinates;
    if (!coords) return res.json([]);

    const sql = `
      SELECT
        c.id,
        c.farmer_id,
        c.crop_type_id,
        c.variety_id,
        c.planted_date,
        c.estimated_harvest,
        c.estimated_volume,
        c.estimated_hectares,
        c.avg_elevation_m,
        c.note,
        c.latitude,
        c.longitude,
        c.coordinates,
        c.photos,
        c.admin_id,

        c.ecosystem_id,
        c.cropping_system_id,
        c.is_intercropped,
        c.intercrop_id,
        c.intercrop_variety_id,

        c.is_harvested,
        c.harvested_date,

        c.created_at,

        /* ✅ the most important field for your compare card */
        c.est_farmgate_value_display,

        ct.name AS crop_name,
        cv.name AS variety_name

      FROM tbl_crops c
      LEFT JOIN tbl_crop_types ct ON ct.id = c.crop_type_id
      LEFT JOIN tbl_crop_varieties cv ON cv.id = c.variety_id

      WHERE (c.is_deleted = 0 OR c.is_deleted IS NULL)
        AND c.coordinates = ?

      ORDER BY COALESCE(c.planted_date, c.created_at) ASC, c.created_at ASC
    `;

    db.query(sql, [coords], (err2, rows2) => {
      if (err2) {
        console.error("history list error:", err2);
        return res.status(500).json({ success: false, message: "DB error" });
      }
      res.json(rows2 || []);
    });
  });
};

/* =============================== MARK HARVESTED =============================== */
/**
 * Frontend: PATCH /api/crops/:id/harvest
 * Body may contain { harvested_date: "YYYY-MM-DD" }
 */
exports.markHarvested = (req, res) => {
  const { id } = req.params;
  const harvested_date = toNullableText(req.body?.harvested_date);

  const sql = `
    UPDATE tbl_crops
    SET is_harvested = 1,
        harvested_date = COALESCE(?, harvested_date, CURDATE())
    WHERE id = ?
      AND (is_deleted = 0 OR is_deleted IS NULL)
    LIMIT 1
  `;

  db.query(sql, [harvested_date, id], (err, result) => {
    if (err) {
      console.error("markHarvested error:", err);
      return res.status(500).json({ success: false, message: "DB error" });
    }
    return res.json({
      success: true,
      affectedRows: result.affectedRows,
      message: "Marked as harvested",
    });
  });
};

/* =============================== UPDATE CROP =============================== */
/**
 * Frontend: PATCH /api/crops/:id
 * Supports snake_case + camelCase keys
 */
exports.updateCrop = (req, res) => {
  const { id } = req.params;
  const body = req.body || {};

  const farmer_id = pickFirstDefined(body.farmer_id, body.farmerId);
  const crop_type_id = pickFirstDefined(body.crop_type_id, body.cropTypeId);
  const variety_id = pickFirstDefined(body.variety_id, body.varietyId);

  const planted_date = pickFirstDefined(body.planted_date, body.plantedDate);
  const estimated_harvest = pickFirstDefined(body.estimated_harvest, body.estimatedHarvest);
  const estimated_volume = pickFirstDefined(body.estimated_volume, body.estimatedVolume);
  const estimated_hectares = pickFirstDefined(body.estimated_hectares, body.estimatedHectares);

  const avg_elevation_m = pickFirstDefined(body.avg_elevation_m, body.avgElevationM);
  const note = pickFirstDefined(body.note);

  const latitude = pickFirstDefined(body.latitude);
  const longitude = pickFirstDefined(body.longitude);
  const coordinates = pickFirstDefined(body.coordinates);

  const photos = pickFirstDefined(body.photos); // if you update images via JSON string

  // crop value display (est crop value)
  const est_farmgate_value_display = pickFirstDefined(
    body.est_farmgate_value_display,
    body.estFarmgateValueDisplay
  );

  // cropping system
  const ecosystem_id = pickFirstDefined(body.ecosystem_id, body.ecosystemId);
  const cropping_system_id = pickFirstDefined(body.cropping_system_id, body.croppingSystemId);
  const is_intercropped = pickFirstDefined(body.is_intercropped, body.isIntercropped);
  const intercrop_id = pickFirstDefined(body.intercrop_id, body.intercropId);
  const intercrop_variety_id = pickFirstDefined(body.intercrop_variety_id, body.intercropVarietyId);

  // harvested fields
  const is_harvested = pickFirstDefined(body.is_harvested, body.isHarvested);
  const harvested_date = pickFirstDefined(body.harvested_date, body.harvestedDate);

  const sets = [];
  const params = [];
  const push = (col, val) => {
    sets.push(`${col} = ?`);
    params.push(val);
  };

  if (farmer_id !== undefined) push("farmer_id", toNullableNumber(farmer_id));
  if (crop_type_id !== undefined) push("crop_type_id", toNullableNumber(crop_type_id));
  if (variety_id !== undefined) push("variety_id", toNullableNumber(variety_id));

  if (planted_date !== undefined) push("planted_date", toNullableText(planted_date));
  if (estimated_harvest !== undefined) push("estimated_harvest", toNullableText(estimated_harvest));
  if (estimated_volume !== undefined) push("estimated_volume", toNullableNumber(estimated_volume));
  if (estimated_hectares !== undefined) push("estimated_hectares", toNullableNumber(estimated_hectares));

  if (avg_elevation_m !== undefined) push("avg_elevation_m", toNullableNumber(avg_elevation_m));
  if (note !== undefined) push("note", toNullableText(note));

  if (latitude !== undefined) push("latitude", toNullableNumber(latitude));
  if (longitude !== undefined) push("longitude", toNullableNumber(longitude));
  if (coordinates !== undefined) push("coordinates", toNullableText(coordinates));

  if (photos !== undefined) push("photos", toNullableText(photos));

  if (ecosystem_id !== undefined) push("ecosystem_id", toNullableNumber(ecosystem_id));
  if (cropping_system_id !== undefined) push("cropping_system_id", toNullableNumber(cropping_system_id));
  if (is_intercropped !== undefined) push("is_intercropped", toBoolTinyInt(is_intercropped, 0));
  if (intercrop_id !== undefined) push("intercrop_id", toNullableNumber(intercrop_id));
  if (intercrop_variety_id !== undefined) push("intercrop_variety_id", toNullableNumber(intercrop_variety_id));

  if (is_harvested !== undefined) push("is_harvested", toBoolTinyInt(is_harvested, 0));
  if (harvested_date !== undefined) push("harvested_date", toNullableText(harvested_date));

  if (est_farmgate_value_display !== undefined) {
    const disp = toNullableText(est_farmgate_value_display);
    const normalized = (disp || "").replace(/\s+/g, " ").trim();
    const looksZero =
      normalized === "₱0" ||
      normalized === "₱0–₱0" ||
      normalized === "₱0 - ₱0" ||
      normalized === "₱0 – ₱0";
    push("est_farmgate_value_display", looksZero ? null : disp);
  }

  if (sets.length === 0) {
    return res.status(400).json({ success: false, message: "No fields to update" });
  }

  const sql = `
    UPDATE tbl_crops
    SET ${sets.join(", ")}
    WHERE id = ?
      AND (is_deleted = 0 OR is_deleted IS NULL)
    LIMIT 1
  `;
  params.push(id);

  db.query(sql, params, (err, result) => {
    if (err) {
      console.error("updateCrop error:", err);
      return res.status(500).json({ success: false, message: "DB error" });
    }
    return res.json({
      success: true,
      affectedRows: result.affectedRows,
      changedRows: result.changedRows,
      message: "Crop updated.",
    });
  });
};

/* =============================== DELETE CROP (soft) =============================== */
exports.deleteCrop = (req, res) => {
  const { id } = req.params;

  const incomingUserId =
    (req.user && req.user.id) ||
    req.headers["x-user-id"] ||
    (req.body && req.body.deleted_by) ||
    null;

  const deleterId = Number(incomingUserId);
  if (!Number.isInteger(deleterId) || deleterId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Missing or invalid deleter id. Please include X-User-Id header or body.deleted_by.",
    });
  }

  const verifySql = "SELECT 1 FROM tbl_users WHERE id = ? LIMIT 1";
  db.query(verifySql, [deleterId], (verifyErr, rows) => {
    if (verifyErr) {
      console.error("verify deleter error:", verifyErr);
      return res.status(500).json({ success: false, message: "DB error" });
    }
    if (!rows || !rows.length) {
      return res.status(400).json({ success: false, message: "Deleter user not found." });
    }

    const sql = `
      UPDATE tbl_crops
      SET is_deleted = 1,
          deleted_at = NOW(),
          deleted_by = ?
      WHERE id = ?
      LIMIT 1
    `;

    db.query(sql, [deleterId, id], (err) => {
      if (err) {
        console.error("Soft delete error:", err);
        return res.status(500).json({ success: false, message: "Error marking crop as deleted" });
      }

      // If you ever want to delete files physically:
      // const photos = JSON.parse(row.photos || "[]");
      // await removeFilesSafe(photos);

      return res.json({ success: true, message: "Crop marked as deleted." });
    });
  });
};

/* ================== UPDATE: farmer details (name + contact + tenure) ================== */
exports.updateFarmerName = (req, res) => {
  const { id } = req.params; // farmer_id
  const {
    first_name,
    last_name,
    mobile: mobile_number,
    address: full_address,
    tenure_id,
  } = req.body || {};

  if (!id) {
    return res.status(400).json({ success: false, message: "farmer_id is required" });
  }

  const sets = [];
  const params = [];
  const push = (col, val) => {
    sets.push(`${col} = ?`);
    params.push(val);
  };

  if (first_name !== undefined) push("first_name", (first_name || "").trim());
  if (last_name !== undefined) push("last_name", (last_name || "").trim());
  if (mobile_number !== undefined) push("mobile_number", (mobile_number || "").trim() || null);
  if (full_address !== undefined) push("full_address", (full_address || "").trim() || null);

  if (tenure_id !== undefined) {
    const t = String(tenure_id).trim();
    push("tenure_id", t === "" ? null : Number(t));
  }

  if (sets.length === 0) {
    return res.status(400).json({ success: false, message: "No fields to update" });
  }

  const sql = `
    UPDATE tbl_farmers
    SET ${sets.join(", ")}
    WHERE farmer_id = ?
    LIMIT 1
  `;
  params.push(id);

  db.query(sql, params, (err, result) => {
    if (err) {
      console.error("updateFarmer details error:", err);
      return res.status(500).json({ success: false, message: "DB error" });
    }
    return res.json({
      success: true,
      affectedRows: result.affectedRows,
      changedRows: result.changedRows,
      message: result.changedRows > 0 ? "Farmer updated." : "No changes applied.",
    });
  });
};
