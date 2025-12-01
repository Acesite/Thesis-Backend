// Controllers/Crops/cropsController.js
const db = require("../../Config/db");
const path = require("path");
const fs = require("fs");

// ---------- helpers ----------
const toNullableInt = (v) => {
  if (Array.isArray(v)) v = v[0]; // handle multipart duplicates
  if (v === undefined || v === null || v === "" || v === "null") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const toNullableNumber = (v) => {
  if (v === undefined || v === null || v === "" || v === "null") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const STANDARD_MATURITY_DAYS = {
  1: 100, // Corn
  2: 110, // Rice
  3: 360, // Banana
  4: 365, // Sugarcane
  5: 300, // Cassava
  6: 60,  // Vegetables
};

// ---------- fixed labels + descriptions for intercropping ----------
const CROPPING_META = {
  monocrop: {
    label: "Monocrop",
    description:
      "Planting and managing only one crop species in a field at a time.",
  },
  intercrop: {
    label: "Intercropped (2 crops)",
    description:
      "Growing two different crops together in the same field and season, usually in alternating rows or patterns.",
  },
  relay: {
    label: "Relay intercropping",
    description:
      "Planting a second crop into a standing first crop so their growing periods overlap for a short time.",
  },
  strip: {
    label: "Strip intercropping",
    description:
      "Growing two or more crops in long, wide strips side by side in the same field, allowing separate management but interaction between strips.",
  },
  mixed: {
    label: "Mixed cropping / Polyculture",
    description:
      "Growing several crops mixed together in the same area at the same time without distinct rows or strips.",
  },
};

// numeric codes that match tbl_crops.cropping_system_id
const CROPPING_SYSTEM_IDS = {
  monocrop: 1,
  intercrop: 2,
  relay: 3,
  strip: 4,
  mixed: 5,
};

function addDaysToISO(dateStr, days) {
  if (!dateStr || !days) return null;
  const d = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + Number(days));
  return d.toISOString().slice(0, 10);
}

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

function mvFile(file, destPath) {
  return new Promise((resolve, reject) => {
    file.mv(destPath, (err) => (err ? reject(err) : resolve()));
  });
}

// ===================== LIST CROPS =====================
exports.getCrops = async (_req, res) => {
  try {
    const sql = `
      SELECT
        c.*,
        ct.name AS crop_name,
        cv.name AS variety_name,
        CONCAT(u.first_name, ' ', u.last_name) AS admin_name,
        f.first_name AS farmer_first_name,
        f.last_name  AS farmer_last_name,
        f.mobile_number AS farmer_mobile,
        f.barangay AS farmer_barangay,
        f.full_address AS farmer_address,

        -- secondary crop info from tbl_crop_intercrops
        ci.crop_type_id  AS intercrop_crop_type_id,
        ci.variety_id    AS intercrop_variety_id,
        ci.estimated_volume AS intercrop_estimated_volume,
        ci.cropping_system AS intercrop_cropping_system,
        ci.cropping_description AS intercrop_cropping_description,
        ct2.name AS intercrop_crop_name,
        cv2.name AS intercrop_variety_name,

        -- 🔹 tenure (tenure_id is on tbl_farmers)
        tt.tenure_id   AS tenure_id,
        tt.tenure_name AS tenure_name

      FROM tbl_crops c
      JOIN tbl_crop_types ct ON c.crop_type_id = ct.id
      LEFT JOIN tbl_crop_varieties cv ON c.variety_id = cv.id
      LEFT JOIN tbl_users u ON c.admin_id = u.id
      LEFT JOIN tbl_farmers f ON c.farmer_id = f.farmer_id

      LEFT JOIN tbl_crop_intercrops ci ON ci.crop_id = c.id
      LEFT JOIN tbl_crop_types ct2 ON ci.crop_type_id = ct2.id
      LEFT JOIN tbl_crop_varieties cv2 ON ci.variety_id = cv2.id

      LEFT JOIN tbl_land_tenure_types tt ON f.tenure_id = tt.tenure_id

      ORDER BY c.created_at DESC
    `;

    const [rows] = await db.promise().query(sql);
    res.status(200).json(rows);
  } catch (err) {
    console.error("getCrops error:", err);
    res.status(500).json({ error: "Database error" });
  }
};

// ===================== CROP BY ID =====================
exports.getCropById = async (req, res) => {
  try {
    const { id } = req.params;
    const sql = `
      SELECT
        c.*,
        ct.name AS crop_name,
        cv.name AS variety_name,
        CONCAT(u.first_name, ' ', u.last_name) AS admin_name,
        f.first_name AS farmer_first_name,
        f.last_name  AS farmer_last_name,
        f.mobile_number AS farmer_mobile,
        f.barangay AS farmer_barangay,
        f.full_address AS farmer_address,
        -- 🔹 tenure (from farmer)
        tt.tenure_id   AS tenure_id,
        tt.tenure_name AS tenure_name
      FROM tbl_crops c
      JOIN tbl_crop_types ct ON c.crop_type_id = ct.id
      LEFT JOIN tbl_crop_varieties cv ON c.variety_id = cv.id
      LEFT JOIN tbl_users u ON c.admin_id = u.id
      LEFT JOIN tbl_farmers f ON c.farmer_id = f.farmer_id
      LEFT JOIN tbl_land_tenure_types tt ON f.tenure_id = tt.tenure_id
      WHERE c.id = ?
      LIMIT 1
    `;
    const [rows] = await db.promise().query(sql, [id]);
    if (!rows.length) return res.status(404).json({ message: "Crop not found" });
    res.status(200).json(rows[0]);
  } catch (err) {
    console.error("getCropById error:", err);
    res.status(500).json({ error: "Database error" });
  }
};

// ===================== POLYGONS FOR MAP =====================
exports.getAllPolygons = async (_req, res) => {
  try {
    const sql = `
      SELECT
        c.*,
        ct.name AS crop_name, 
        cv.name AS variety_name,
        CONCAT(u.first_name, ' ', u.last_name) AS admin_name,
        f.first_name AS farmer_first_name,
        f.last_name  AS farmer_last_name,
        f.mobile_number AS farmer_mobile,
        f.barangay AS farmer_barangay,
        f.full_address AS farmer_address,

        ci.crop_type_id  AS intercrop_crop_type_id,
        ci.variety_id    AS intercrop_variety_id,
        ci.estimated_volume AS intercrop_estimated_volume,
        ci.cropping_system AS intercrop_cropping_system,
        ci.cropping_description AS intercrop_cropping_description,
        ct2.name AS intercrop_crop_name,
        cv2.name AS intercrop_variety_name,

        -- 🔹 tenure (from farmer)
        tt.tenure_name AS tenure_name,

        -- 👇 NEW: “effective” harvested flag
        CASE
          WHEN c.is_harvested = 1 THEN 1
          WHEN c.estimated_harvest IS NOT NULL
               AND c.estimated_harvest <= CURDATE() THEN 1
          ELSE 0
        END AS is_harvested_effective
      FROM tbl_crops c
      JOIN tbl_crop_types ct ON c.crop_type_id = ct.id
      LEFT JOIN tbl_crop_varieties cv ON c.variety_id = cv.id
      LEFT JOIN tbl_users u ON c.admin_id = u.id
      LEFT JOIN tbl_farmers f ON c.farmer_id = f.farmer_id
      LEFT JOIN tbl_crop_intercrops ci ON ci.crop_id = c.id
      LEFT JOIN tbl_crop_types ct2 ON ci.crop_type_id = ct2.id
      LEFT JOIN tbl_crop_varieties cv2 ON ci.variety_id = cv2.id
      LEFT JOIN tbl_land_tenure_types tt ON f.tenure_id = tt.tenure_id
      WHERE c.coordinates IS NOT NULL
    `;

    const [rows] = await db.promise().query(sql);

    const geojson = {
      type: "FeatureCollection",
      features: rows.map((row) => ({
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [JSON.parse(row.coordinates)],
        },
        properties: {
          id: row.id,
          crop_name: row.crop_name,
          variety_name: row.variety_name,
          tenure_name: row.tenure_name, // 🔹

          // dates for timeline filter
          planted_date: row.planted_date,
          estimated_harvest: row.estimated_harvest,
          harvested_date: row.harvested_date,

          // 👇 use effective flag here
          is_harvested: row.is_harvested_effective,
        },
      })),
    };

    res.json(geojson);
  } catch (err) {
    console.error("Fetch polygons error:", err);
    res.status(500).json({ error: "Database error" });
  }
};

// ===================== TAXONOMIES =====================
exports.getCropTypes = async (_req, res) => {
  try {
    const [rows] = await db.promise().query("SELECT * FROM tbl_crop_types");
    res.status(200).json(rows);
  } catch (err) {
    console.error("Failed to fetch crop types:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getCropVarietiesByType = async (req, res) => {
  try {
    const { crop_type_id } = req.params;
    const [rows] = await db
      .promise()
      .query("SELECT id, name FROM tbl_crop_varieties WHERE crop_type_id = ?", [
        crop_type_id,
      ]);
    res.status(200).json(rows);
  } catch (err) {
    console.error("Failed to fetch crop varieties:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ---------- get ecosystems by crop type ----------
exports.getEcosystemsByCropType = async (req, res) => {
  try {
    const { crop_type_id } = req.params;
    const [rows] = await db
      .promise()
      .query(
        "SELECT id, name, name_tagalog, description FROM tbl_ecosystems WHERE crop_type_id = ? ORDER BY id",
        [crop_type_id]
      );
    res.status(200).json(rows);
  } catch (err) {
    console.error("Failed to fetch ecosystems:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ---------- 🔹 tenure types ----------
exports.getTenureTypes = async (_req, res) => {
  try {
    // your table columns are tenure_id / tenure_name
    const [rows] = await db
      .promise()
      .query(
        "SELECT tenure_id AS id, tenure_name AS name, description FROM tbl_land_tenure_types ORDER BY tenure_id"
      );
    res.status(200).json(rows);
  } catch (err) {
    console.error("Failed to fetch tenure types:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.createCrop = async (req, res) => {
  try {
    const {
      crop_type_id,
      variety_id,
      ecosystem_id,

      // intercropping fields
      cropping_system,
      is_intercropped,
      intercrop_crop_type_id,
      intercrop_variety_id,
      intercrop_estimated_volume,

      plantedDate,
      estimatedVolume,
      estimatedHectares,
      note,
      coordinates,
      admin_id,

      // farmer
      farmer_first_name,
      farmer_last_name,
      farmer_mobile,
      farmer_barangay,
      farmer_address,
      full_address,

      // 🔹 elevation from frontend (any of these names)
      avg_elevation_m,
      avgElevationM,
      avgElevation,

      // 🔹 tenure from frontend (belongs to farmer)
      tenure_id,
    } = req.body;

    const ctId = toNullableInt(crop_type_id);
    if (!ctId) return res.status(400).json({ message: "crop_type_id is required" });
    if (!plantedDate)
      return res.status(400).json({ message: "plantedDate is required" });

    // ---------- coordinates ----------
    const parsedCoords =
      typeof coordinates === "string" ? JSON.parse(coordinates) : coordinates;

    if (!Array.isArray(parsedCoords) || !Array.isArray(parsedCoords[0])) {
      return res.status(400).json({ message: "Invalid coordinates format" });
    }
    const [lng, lat] = parsedCoords[0];
    if (![lng, lat].every((n) => typeof n === "number" && isFinite(n))) {
      return res.status(400).json({ message: "Invalid coordinate pair" });
    }
    const polygonString = JSON.stringify(parsedCoords);

    // ---------- computed harvest ----------
    const maturityDays = STANDARD_MATURITY_DAYS[ctId] || 0;
    const computedHarvest = addDaysToISO(plantedDate, maturityDays);

    // ---------- handle photos ----------
    const photoPaths = [];
    const photoFiles = req.files?.photos;

    if (photoFiles) {
      const files = Array.isArray(photoFiles) ? photoFiles : [photoFiles];
      const uploadDir = path.join(process.cwd(), "uploads", "crops");
      await ensureDir(uploadDir);

      for (const file of files) {
        const allowed = ["image/jpeg", "image/png", "image/webp"];
        if (!allowed.includes(file.mimetype)) {
          return res.status(400).json({ message: "Only JPG/PNG/WebP allowed" });
        }
        if (file.size > 10 * 1024 * 1024) {
          return res.status(400).json({ message: "Photo too large" });
        }

        const ext = path.extname(file.name).toLowerCase() || ".jpg";
        const base =
          path.basename(file.name, ext).replace(/[^a-z0-9_-]/gi, "") || "crop";

        const filename = `${Date.now()}_${base}${ext}`;
        const filePath = path.join(uploadDir, filename);

        await mvFile(file, filePath);
        photoPaths.push(`/uploads/crops/${filename}`);
      }
    }

    const vId = toNullableInt(variety_id);
    const ecoId = toNullableInt(ecosystem_id);

    // ---------- intercrop parse ----------
    const interCropCtId = toNullableInt(intercrop_crop_type_id);
    const interCropVarId = toNullableInt(intercrop_variety_id);
    const interCropEstVol = toNullableNumber(intercrop_estimated_volume);

    const isIntercroppedFlag = ["1", 1, true, "true", "yes", "on"].includes(
      is_intercropped
    )
      ? 1
      : 0;

    // ---------- cropping system ----------
    const croppingSystemKey = (
      cropping_system || (isIntercroppedFlag ? "intercrop" : "monocrop")
    ).toLowerCase();

    const croppingMeta = CROPPING_META[croppingSystemKey] || null;
    const croppingSystemId = CROPPING_SYSTEM_IDS[croppingSystemKey] || null;
    const croppingSystemLabel = croppingMeta
      ? croppingMeta.label
      : croppingSystemKey;
    const croppingDescription = croppingMeta ? croppingMeta.description : null;

    const adminIdNum =
      toNullableInt(admin_id) ?? (req.user && toNullableInt(req.user.id)) ?? null;

    const estVol = toNullableNumber(estimatedVolume);
    const estHa = toNullableNumber(estimatedHectares);

    // 🔹 elevation numeric value
    const avgElevationMVal = toNullableNumber(
      avg_elevation_m ?? avgElevationM ?? avgElevation
    );

    // 🔹 tenure numeric value (to be stored on tbl_farmers)
    const tenureIdVal = toNullableInt(tenure_id);

    // ---------- farmer upsert ----------
    let farmer_id = null;

    if (farmer_mobile) {
      const [existing] = await db
        .promise()
        .query(
          "SELECT farmer_id FROM tbl_farmers WHERE mobile_number = ? LIMIT 1",
          [farmer_mobile]
        );

      const finalAddress = full_address ?? farmer_address ?? null;

      if (existing.length) {
        farmer_id = existing[0].farmer_id;

        await db.promise().query(
          `
            UPDATE tbl_farmers
               SET first_name = COALESCE(?, first_name),
                   last_name  = COALESCE(?, last_name),
                   barangay   = COALESCE(?, barangay),
                   full_address = COALESCE(?, full_address),
                   tenure_id  = COALESCE(?, tenure_id)
             WHERE farmer_id = ?
          `,
          [
            farmer_first_name || null,
            farmer_last_name || null,
            farmer_barangay || null,
            finalAddress,
            tenureIdVal,
            farmer_id,
          ]
        );
      } else {
        const [ins] = await db
          .promise()
          .query(
            `
              INSERT INTO tbl_farmers
                (first_name, last_name, mobile_number, barangay, full_address, tenure_id, created_at)
              VALUES (?, ?, ?, ?, ?, ?, NOW())
            `,
            [
              farmer_first_name || null,
              farmer_last_name || null,
              farmer_mobile,
              farmer_barangay || null,
              finalAddress,
              tenureIdVal,
            ]
          );
        farmer_id = ins.insertId;
      }
    }

    // ---------- SAVE PRIMARY CROP ----------
    const sql = `
      INSERT INTO tbl_crops (
        farmer_id,
        crop_type_id,
        variety_id,
        ecosystem_id,
        cropping_system_id,
        is_intercropped,
        planted_date,
        estimated_harvest,
        estimated_volume,
        estimated_hectares,
        avg_elevation_m,
        note,
        latitude,
        longitude,
        coordinates,
        photos,
        admin_id,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const values = [
      farmer_id,
      ctId,
      vId,
      ecoId,
      croppingSystemId,
      isIntercroppedFlag,
      plantedDate || null,
      computedHarvest || null,
      estVol,
      estHa,
      avgElevationMVal,
      note || null,
      lat,
      lng,
      polygonString,
      JSON.stringify(photoPaths),
      adminIdNum,
    ];

    const [result] = await db.promise().query(sql, values);

    await db.promise().query(
      `
        INSERT INTO tbl_crop_history
          (crop_id, crop_type_id, variety_id, polygon_geojson, hectares, date_planted)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        result.insertId,
        ctId,
        vId,
        JSON.stringify(parsedCoords),
        estHa,
        plantedDate,
      ]
    );

    // ---------- SECONDARY CROP ----------
    if (isIntercroppedFlag && interCropCtId) {
      const [icResult] = await db.promise().query(
        `
          INSERT INTO tbl_crop_intercrops
            (crop_id, cropping_system, cropping_description, crop_type_id, variety_id, estimated_volume, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        `,
        [
          result.insertId,
          croppingSystemLabel,
          croppingDescription,
          interCropCtId,
          interCropVarId,
          interCropEstVol,
          note || null,
        ]
      );

      await db.promise().query(
        `
          UPDATE tbl_crops
             SET intercrop_id = ?, intercrop_variety_id = ?
           WHERE id = ?
        `,
        [icResult.insertId, interCropVarId, result.insertId]
      );
    }

    res.status(201).json({
      success: true,
      id: result.insertId,
      estimated_harvest: computedHarvest,
      photos: photoPaths,
    });
  } catch (err) {
    console.error("Insert error:", err);
    res
      .status(400)
      .json({ message: err.sqlMessage || err.message || "Server error" });
  }
};

// ===================== MARK CROP AS HARVESTED =====================
exports.markCropHarvested = async (req, res) => {
  try {
    const { id } = req.params;

    // safely read harvested_date even if req.body is undefined
    const { harvested_date: bodyHarvestedDate } = req.body || {};
    let harvested_date = bodyHarvestedDate;

    const cropId = Number(id);
    if (!Number.isFinite(cropId)) {
      return res.status(400).json({ message: "Invalid crop id" });
    }

    // default to today's date if not provided
    if (!harvested_date) {
      harvested_date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    }

    console.log("[markCropHarvested] Updating crop", {
      cropId,
      harvested_date,
      body: req.body,
    });

    const [result] = await db
      .promise()
      .query(
        `
        UPDATE tbl_crops
           SET is_harvested = 1,
               harvested_date = ?
         WHERE id = ?
      `,
        [harvested_date, cropId]
      );

    await db.promise().query(
      `
        UPDATE tbl_crop_history
        SET date_harvested = ?
        WHERE crop_id = ?
      `,
      [harvested_date, cropId]
    );

    if (result.affectedRows === 0) {
      console.warn("[markCropHarvested] No crop found with id:", cropId);
      return res.status(404).json({ message: "Crop not found" });
    }

    return res.status(200).json({
      success: true,
      id: cropId,
      harvested_date,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ message: err.sqlMessage || err.message || "Server error" });
  }
};

exports.getCropHistory = async (req, res) => {
  try {
    const { id } = req.params;

    // 1️⃣ Get the current crop's coordinates (same polygon = same field)
    const [currentRows] = await db
      .promise()
      .query(
        `
        SELECT coordinates
        FROM tbl_crops
        WHERE id = ?
        LIMIT 1
      `,
        [id]
      );

    if (!currentRows.length || !currentRows[0].coordinates) {
      // no coordinates → no history
      return res.status(200).json([]);
    }

    const polygonJson = currentRows[0].coordinates;

    // 2️⃣ Find all history rows with the same polygon, excluding this crop_id
    const [history] = await db
      .promise()
      .query(
        `
        SELECT
          h.id,
          h.crop_id,
          h.date_planted,
          h.date_harvested,
          h.hectares,
          h.polygon_geojson,

          c.estimated_volume,
          c.estimated_hectares,
          c.estimated_harvest,
          c.created_at,
          c.crop_type_id,
          c.variety_id,

          ct.name AS crop_name,
          cv.name AS variety_name
        FROM tbl_crop_history h
        JOIN tbl_crops c
          ON h.crop_id = c.id
        JOIN tbl_crop_types ct
          ON c.crop_type_id = ct.id
        LEFT JOIN tbl_crop_varieties cv
          ON c.variety_id = cv.id
        WHERE h.polygon_geojson = ?
          AND h.crop_id <> ?
        ORDER BY h.date_planted ASC, c.created_at ASC
      `,
        [polygonJson, id]
      );

    return res.status(200).json(history);
  } catch (err) {
    console.error("History fetch error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
