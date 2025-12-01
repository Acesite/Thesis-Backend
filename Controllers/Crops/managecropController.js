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
  if (maybeUrlOrPath.startsWith("/uploads/")) {
    const rel = maybeUrlOrPath.replace(/^\/?uploads\/?/, "");
    return path.join(UPLOAD_ROOT, rel);
  }

  // Bare relative like "crops/a.jpg" → put under /uploads
  if (!path.isAbsolute(maybeUrlOrPath)) {
    return path.join(UPLOAD_ROOT, maybeUrlOrPath);
  }

  // Only allow absolute paths that are inside UPLOAD_ROOT (safety)
  const normalized = path.normalize(maybeUrlOrPath);
  if (normalized.startsWith(UPLOAD_ROOT)) return normalized;

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
      // Ignore ENOENT; log others for debugging
      if (err.code !== "ENOENT") {
        console.warn("[deleteCrop] unlink failed:", local, err.code || err.message);
      }
      return { file: raw, status: "not_found_or_error" };
    }
  });
  return Promise.allSettled(tasks);
}

exports.getAllCrops = (req, res) => {
  const sql = `
    SELECT
      /* crop */
      c.id,
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
      c.created_at,
      c.farmer_id,
      c.admin_id,
      c.photos,
      c.is_harvested,
      c.harvested_date,

      /* cropping system flags (from tbl_crops) */
      c.cropping_system_id,
      c.is_intercropped,

      /* secondary crop (from tbl_crop_intercrops) */
      ci.crop_type_id          AS intercrop_crop_type_id,
      ci.variety_id            AS intercrop_variety_id,
      ci.estimated_volume      AS intercrop_estimated_volume,
      ci.cropping_system       AS intercrop_cropping_system,
      ci.cropping_description  AS intercrop_cropping_description,
      ct2.name                 AS intercrop_crop_name,
      cv2.name                 AS intercrop_variety_name,

      /* map barangay from farmer (since crops table has none) */
      f.barangay               AS crop_barangay,

      /* type & variety labels (primary crop) */
      ct.name                  AS crop_name,
      cv.name                  AS variety_name,

      /* farmer details */
      f.farmer_id              AS farmer_pk,
      f.first_name             AS farmer_first_name,
      f.last_name              AS farmer_last_name,
      f.mobile_number          AS farmer_mobile,
      f.barangay               AS farmer_barangay,
      f.full_address           AS farmer_address,
      f.tenure_id              AS farmer_tenure_id,

      /* 🔹 tenure label */
      tt.tenure_name           AS tenure_name,

      /* tagged by (admin/user who created it) */
      u.first_name             AS tagger_first_name,
      u.last_name              AS tagger_last_name,
      u.email                  AS tagger_email

    FROM tbl_crops c
    LEFT JOIN tbl_crop_types      ct  ON ct.id  = c.crop_type_id
    LEFT JOIN tbl_crop_varieties  cv  ON cv.id  = c.variety_id

    LEFT JOIN tbl_crop_intercrops ci  ON ci.crop_id = c.id
    LEFT JOIN tbl_crop_types      ct2 ON ct2.id = ci.crop_type_id
    LEFT JOIN tbl_crop_varieties  cv2 ON cv2.id = ci.variety_id

    LEFT JOIN tbl_farmers         f   ON f.farmer_id = c.farmer_id
    LEFT JOIN tbl_land_tenure_types tt ON tt.tenure_id = f.tenure_id   /* 👈 NEW JOIN */
    LEFT JOIN tbl_users           u   ON u.id = c.admin_id

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


/* ================== UPDATE: crop record + intercrop ================== */
exports.updateCrop = (req, res) => {
  const { id } = req.params;
  const {
    crop_type_id,
    variety_id,
    planted_date,
    estimated_harvest,
    estimated_volume,
    estimated_hectares,
    note,
    latitude,
    longitude,
    farmer_id, // optional switch to another farmer

    // NEW: cropping + intercropping fields coming from the modal
    is_intercropped,
    cropping_system_id,
    intercrop_crop_type_id,
    intercrop_variety_id,
    intercrop_estimated_volume,
    intercrop_cropping_system,
    intercrop_cropping_description,
  } = req.body;

  console.log("[updateCrop] id:", id, "payload:", req.body);

  const sets = [];
  const params = [];
  const push = (col, val) => {
    sets.push(`${col} = ?`);
    params.push(val);
  };

  // --- primary crop columns ---
  if (crop_type_id !== undefined)       push("crop_type_id",       crop_type_id || null);
  if (variety_id !== undefined)         push("variety_id",         variety_id || null);
  if (planted_date !== undefined)       push("planted_date",       planted_date || null);
  if (estimated_harvest !== undefined)  push("estimated_harvest",  estimated_harvest || null);
  if (estimated_volume !== undefined)   push("estimated_volume",   estimated_volume || null);
  if (estimated_hectares !== undefined) push("estimated_hectares", estimated_hectares || null);
  if (note !== undefined)               push("note",               note || null);
  if (latitude !== undefined)           push("latitude",           latitude || null);
  if (longitude !== undefined)          push("longitude",          longitude || null);

  if (cropping_system_id !== undefined)
    push("cropping_system_id", cropping_system_id || null);

  if (is_intercropped !== undefined)
    push("is_intercropped", Number(is_intercropped) ? 1 : 0);

  const wantsFarmerUpdate = farmer_id !== undefined;
  const numericFarmerId = Number(farmer_id);

  // --- secondary crop payload (tbl_crop_intercrops) ---
  const wantIntercropRow =
    Number(is_intercropped) === 1 ||
    intercrop_crop_type_id !== undefined ||
    intercrop_variety_id !== undefined ||
    intercrop_estimated_volume !== undefined ||
    intercrop_cropping_system !== undefined ||
    intercrop_cropping_description !== undefined;

  const intercropData = {
    crop_type_id:
      intercrop_crop_type_id === undefined || intercrop_crop_type_id === ""
        ? null
        : intercrop_crop_type_id,
    variety_id:
      intercrop_variety_id === undefined || intercrop_variety_id === ""
        ? null
        : intercrop_variety_id,
    estimated_volume:
      intercrop_estimated_volume === undefined ||
      intercrop_estimated_volume === ""
        ? null
        : intercrop_estimated_volume,
    cropping_system:
      intercrop_cropping_system === undefined ||
      intercrop_cropping_system === ""
        ? null
        : intercrop_cropping_system,
    cropping_description:
      intercrop_cropping_description === undefined ||
      intercrop_cropping_description === ""
        ? null
        : intercrop_cropping_description,
  };

  // run UPDATE tbl_crops (or no-op if nothing to change)
  const runCropUpdate = (cb) => {
    if (sets.length === 0) {
      // nothing for tbl_crops, still maybe want to update intercrop row
      return cb(null, { affectedRows: 0, changedRows: 0 });
    }

    const sql = `
      UPDATE tbl_crops
      SET ${sets.join(", ")}
      WHERE id = ?
      LIMIT 1
    `;
    params.push(id);

    db.query(sql, params, (err, result) => {
      if (err) return cb(err);
      cb(null, result);
    });
  };

  // upsert / delete in tbl_crop_intercrops
  const upsertIntercrop = (cb) => {
    if (!wantIntercropRow) {
      // remove any existing secondary crop if user unchecked intercropping
      return db.query(
        "DELETE FROM tbl_crop_intercrops WHERE crop_id = ?",
        [id],
        (err) => {
          if (err) {
            console.error("[updateCrop] delete intercrop error:", err);
          }
          cb();
        }
      );
    }

    // there SHOULD be some secondary data; upsert it
    db.query(
      "SELECT id FROM tbl_crop_intercrops WHERE crop_id = ? LIMIT 1",
      [id],
      (err, rows) => {
        if (err) {
          console.error("[updateCrop] select intercrop error:", err);
          return cb(); // don't block main update response
        }

        // strip undefined keys
        const clean = {};
        Object.entries(intercropData).forEach(([k, v]) => {
          if (v !== undefined) clean[k] = v;
        });

        if (rows && rows.length) {
          // UPDATE existing secondary crop
          db.query(
            "UPDATE tbl_crop_intercrops SET ? WHERE id = ?",
            [clean, rows[0].id],
            (err2) => {
              if (err2) {
                console.error("[updateCrop] update intercrop error:", err2);
              }
              cb();
            }
          );
        } else {
          // INSERT new secondary crop
          db.query(
            "INSERT INTO tbl_crop_intercrops SET ?",
            [{ crop_id: id, ...clean }],
            (err2) => {
              if (err2) {
                console.error("[updateCrop] insert intercrop error:", err2);
              }
              cb();
            }
          );
        }
      }
    );
  };

  const finish = () => {
    runCropUpdate((err, result) => {
      if (err) {
        console.error("updateCrop error:", err);
        return res.status(500).json({ success: false, message: "DB error" });
      }

      upsertIntercrop(() => {
        return res.json({
          success: true,
          affectedRows: result.affectedRows,
          changedRows: result.changedRows,
          message: "Crop updated.",
        });
      });
    });
  };

  // --- farmer linking logic stays as before ---
  if (!wantsFarmerUpdate) {
    return finish();
  }

  if (!Number.isInteger(numericFarmerId) || numericFarmerId <= 0) {
    console.log("[updateCrop] invalid farmer_id:", farmer_id);
    return res
      .status(400)
      .json({ success: false, message: "Invalid farmer_id. Pick from the dropdown." });
  }

  db.query(
    "SELECT 1 FROM tbl_farmers WHERE farmer_id = ? LIMIT 1",
    [numericFarmerId],
    (err, rows) => {
      if (err) {
        console.error("farmer lookup error:", err);
        return res.status(500).json({ success: false, message: "DB error" });
      }
      if (!rows || rows.length === 0) {
        console.log("[updateCrop] farmer not found:", numericFarmerId);
        return res
          .status(400)
          .json({ success: false, message: "Farmer not found" });
      }
      push("farmer_id", numericFarmerId);
      return finish();
    }
  );
};

exports.deleteCrop = async (req, res) => {
  const { id } = req.params;

  // 1) Mark the crop as deleted (soft delete) in tbl_crops
  const sqlUpdate = "UPDATE tbl_crops SET is_deleted = 1, deleted_at = NOW() WHERE id = ?";
  db.query(sqlUpdate, [id], (err, result) => {
    if (err) {
      console.error("Soft delete error:", err);
      return res.status(500).json({ success: false, message: "Error marking crop as deleted" });
    }

    return res.json({
      success: true,
      message: "Crop marked as deleted. It will no longer appear in the active list, but historical data is preserved."
    });
  });
};


/* ================== UPDATE: farmer name (convenience) ================== */
exports.updateFarmerName = (req, res) => {
  const { id } = req.params; // farmer_id
  const { first_name, last_name } = req.body;

  if (!id) {
    return res.status(400).json({ success: false, message: "farmer_id is required" });
  }

  const sets = [];
  const params = [];
  const push = (col, val) => { sets.push(`${col} = ?`); params.push(val); };

  if (first_name !== undefined) push("first_name", (first_name || "").trim());
  if (last_name  !== undefined) push("last_name",  (last_name  || "").trim());

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
      console.error("updateFarmerName error:", err);
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
