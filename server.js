// ===== server.js =====
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import PDFDocument from "pdfkit";
import axios from "axios";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

// For __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());

// CORS — restrict to your frontend domain or allow all during dev
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "https://ict-reg.vercel.app",
  })
);

// ====== Database Connection ======
const MONGO = process.env.MONGO_URI || process.env.MONGO || "";
mongoose
  .connect(MONGO, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// ====== Cloudinary Setup ======
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

// ====== Multer Storage (Cloudinary) ======
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "school_uploads",
    allowed_formats: ["jpg", "jpeg", "png", "pdf"],
    transformation: [{ width: 600, height: 600, crop: "limit" }],
  },
});
const upload = multer({ storage });

// ====== Schemas & Models ======
const studentSchema = new mongoose.Schema({
  surname: { type: String, required: true, trim: true },
  firstname: { type: String, required: true, trim: true },
  middlename: { type: String, trim: true, default: "" },
  phone: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  password: { type: String, required: true, trim: true }, // 🔹 Added
  passport: { type: String, required: true },
  dateRegistered: { type: Date, default: Date.now },
});

const Student = mongoose.model("Student", studentSchema);

/* Full profile schema (optional detailed records) */
const profileSchema = new mongoose.Schema(
  {
    surname: { type: String, required: true, trim: true },
    firstname: { type: String, required: true, trim: true },
    middlename: { type: String, trim: true },
    phone: { type: String, required: true, trim: true, unique: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    marital: { type: String, required: true },
    disability: { type: String, default: "None" },
    stateOrigin: { type: String, required: true },
    lgaOrigin: { type: String, required: true },
    address: { type: String, required: true },
    lgaResidence: { type: String, required: true },
    department: { type: String, required: true },
    regNo: { type: String, required: true, unique: true, uppercase: true },
    nokSurname: { type: String, required: true },
    nokFirstname: { type: String, required: true },
    nokMiddlename: { type: String },
    nokPhone: { type: String, required: true },
    nokMarital: { type: String, required: true },
    nokRelation: { type: String, required: true },
    nokAddress: { type: String, required: true },
    school: { type: String, required: true },
    olevel: [
      {
        year: String,
        reg: String,
        subject: String,
        grade: String,
      },
    ],
    fileOlevel: String,
    fileJamb: String,
    fileState: String,
    fileBirth: String,
    fileNin: String,
    fileFee: String,
    passport: String,
    documents: [
      {
        label: String,
        url: String,
      },
    ],
  },
  { timestamps: true }
);

const Profile = mongoose.model("Profile", profileSchema);

// ====== Utility Functions ======
function normalizeEmail(email = "") {
  return String(email || "").trim().toLowerCase();
}
function normalizePhone(phone = "") {
  return String(phone || "").trim();
}
function isValidPhone(phone = "") {
  // Nigerian-like 11-digit check (adjust if you want other formats)
  return /^\d{11}$/.test(phone);
}
function isValidEmail(email = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ====== Routes ======

// Health check
app.get("/api/health", (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// Upload single file (returns Cloudinary URL)
app.post("/api/students/upload-single", upload.any(), async (req, res) => {
  try {
    if (!req.files || !req.files.length) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    const fileData = req.files[0];
    const url = fileData.path || fileData.url || fileData.secure_url || fileData.location || null;
    if (!url) return res.status(500).json({ success: false, message: "Could not get uploaded file URL" });
    res.json({ success: true, url });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Check duplicate by email or phone (query params: ?email=...&phone=...)
app.get("/api/students/check-duplicate", async (req, res) => {
  try {
    const { email, phone } = req.query;
    if (!email && !phone) return res.json({ exists: false });
    const q = { $or: [] };
    if (email) q.$or.push({ email: normalizeEmail(email) });
    if (phone) q.$or.push({ phone: normalizePhone(phone) });
    const exists = q.$or.length ? await Student.findOne(q) : null;
    res.json({ exists: !!exists });
  } catch (err) {
    console.error("❌ check-duplicate error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Register Student (with passport upload)

app.post("/api/students/register", upload.single("passport"), async (req, res) => {
  try {
    const { surname, firstname, middlename, phone, email, password, confirmPassword } = req.body;

    if (!surname || !firstname || !phone || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: "All required fields must be provided" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const trimmedEmail = normalizeEmail(email);
    const trimmedPhone = normalizePhone(phone);

    if (!isValidPhone(trimmedPhone)) {
      return res.status(400).json({ message: "Invalid phone format (expected 11 digits)" });
    }

    if (!isValidEmail(trimmedEmail)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Duplicate check
    const dup = await Student.findOne({
      $or: [{ email: trimmedEmail }, { phone: trimmedPhone }],
    });
    if (dup) {
      return res.status(409).json({ message: "Student with this email or phone already exists" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Please upload a passport image" });
    }

    const passportUrl = req.file.path || req.file.secure_url || req.file.url || "";
    if (!passportUrl) {
      return res.status(500).json({ message: "Uploaded file URL not available" });
    }

    const newStudent = new Student({
      surname: String(surname).trim(),
      firstname: String(firstname).trim(),
      middlename: middlename ? String(middlename).trim() : "",
      phone: trimmedPhone,
      email: trimmedEmail,
      password: password.trim(), // 🔹 Added
      passport: passportUrl,
    });

    await newStudent.save();

    return res.status(201).json({
      message: "Registration successful",
      student: {
        _id: newStudent._id,
        surname: newStudent.surname,
        firstname: newStudent.firstname,
        email: newStudent.email,
        passport: newStudent.passport,
      },
    });
  } catch (error) {
    console.error("❌ Registration error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Create or update detailed profile
app.post("/api/students/profile", async (req, res) => {
  try {
    const payload = req.body;
    if (!payload.email || !payload.phone || !payload.regNo) {
      return res.status(400).json({ message: "email, phone and regNo are required" });
    }

    const email = normalizeEmail(payload.email);
    const phone = normalizePhone(payload.phone);

    // Upsert by regNo
    const profile = await Profile.findOneAndUpdate(
      { regNo: payload.regNo.toUpperCase() },
      {
        ...payload,
        email,
        phone,
        regNo: payload.regNo.toUpperCase(),
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, profile });
  } catch (err) {
    console.error("❌ profile error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// List students (supports search ?q= & pagination ?page=&limit=)
app.get("/api/students", async (req, res) => {
  try {
    const { q = "", page = 1, limit = 50 } = req.query;
    const search = q.trim();
    const query = {};

    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [{ surname: regex }, { firstname: regex }, { email: regex }, { phone: regex }];
    }

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.max(1, parseInt(limit, 10));
    const docs = await Student.find(query).sort({ dateRegistered: -1 }).skip(skip).limit(parseInt(limit, 10));
    const total = await Student.countDocuments(query);
    res.json({ success: true, data: docs, total });
  } catch (err) {
    console.error("❌ list students error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get single student
app.get("/api/students/:id", async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json({ success: true, student });
  } catch (err) {
    console.error("❌ get student error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete student
app.delete("/api/students/:id", async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });
    // Note: This does not delete the Cloudinary image. If you want to remove Cloudinary resource,
    // store the public_id in the DB and call cloudinary.uploader.destroy(public_id)
    res.json({ success: true, message: "Student deleted", student });
  } catch (err) {
    console.error("❌ delete student error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Export all students to PDF including passport thumbnails
app.get("/api/students/export/pdf", async (req, res) => {
  try {
    const students = await Student.find({}).sort({ dateRegistered: -1 });

    // Setup PDF
    const doc = new PDFDocument({ margin: 40, size: "A4" });

    // Stream the PDF to response
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="students_${Date.now()}.pdf"`);

    doc.fontSize(20).text("Registered Students", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
    doc.moveDown(1);

    const startX = doc.x;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidths = { img: 60, name: pageWidth * 0.45, contact: pageWidth * 0.45 - 10 };

    let y = doc.y;

    // Table header
    doc.fontSize(11).text("Photo", startX, y);
    doc.text("Name", startX + colWidths.img + 10, y);
    doc.text("Contact", startX + colWidths.img + 10 + colWidths.name, y);
    y += 18;
    doc.moveTo(startX, y - 4).lineTo(startX + pageWidth, y - 4).strokeOpacity(0.08).stroke();
    y += 4;

    // Helper to fetch image buffer
    async function fetchImageBuffer(url) {
      try {
        if (!url) return null;
        const resp = await axios.get(url, { responseType: "arraybuffer", timeout: 10000 });
        return Buffer.from(resp.data, "binary");
      } catch (err) {
        // If image download fails, return null and continue
        console.warn("Image fetch failed for", url, err.message);
        return null;
      }
    }

    for (const s of students) {
      // Ensure a page break when nearing bottom
      if (y > doc.page.height - doc.page.margins.bottom - 90) {
        doc.addPage();
        y = doc.y;
      }

      // Draw passport thumbnail (if available)
      const imgBuf = await fetchImageBuffer(s.passport);
      if (imgBuf) {
        try {
          doc.image(imgBuf, startX, y, { fit: [60, 60], align: "center", valign: "center" });
        } catch (imgErr) {
          // ignore image error
        }
      } else {
        // placeholder rectangle
        doc.rect(startX, y, 60, 60).strokeOpacity(0.06).stroke();
        doc.fontSize(8).text("No Image", startX + 6, y + 24);
      }

      // Name
      const fullName = `${s.surname} ${s.firstname} ${s.middlename || ""}`.replace(/\s+/g, " ").trim();
      doc.fontSize(11).text(fullName, startX + colWidths.img + 10, y, { width: colWidths.name });

      // Contact (email + phone + reg date)
      const contactText = `Email: ${s.email}\nPhone: ${s.phone}\nRegistered: ${new Date(s.dateRegistered).toLocaleDateString()}`;
      doc.fontSize(10).text(contactText, startX + colWidths.img + 10 + colWidths.name, y, {
        width: colWidths.contact,
      });

      y += 70;
      doc.moveTo(startX, y - 10).lineTo(startX + pageWidth, y - 10).strokeOpacity(0.03).stroke();
    }

    doc.end();
    doc.pipe(res);
  } catch (err) {
    console.error("❌ export/pdf error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== Start server =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));