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
import { Readable } from "stream";
import xlsx from "xlsx";

dotenv.config();

// For __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());

// ====== CORS ======
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
export const upload = multer({ storage });

// ====== Multer Storage for Excel Uploads (in memory) ======
const excelStorage = multer.memoryStorage();
export const uploadExcel = multer({ storage: excelStorage });

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

// Student Profile Setup
const studentProfileSchema = new mongoose.Schema({
  surname: String,
  firstname: String,
  middlename: String,
  phone: String,
  dob: String,
  email: String,
  department: String,
  regNo: { type: String, unique: true },
  matricNo: { type: String, unique: true }, // ✅ Added field
  level: String,
  stateOrigin: String,
  lgaOrigin: String,
  address: String,
  nokSurname: String,
  nokFirstname: String,
  nokPhone: String,
  nokRelation: String,
  passport: String, // Cloudinary image URL
}, { timestamps: true });
  verified: { type: Boolean, default: false };

const StudentProfile = mongoose.model("StudentProfile", studentProfileSchema);

// ====== Document Upload Schema ======
const DocumentSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true,
  },

  matricNumber: {
    type: String,
    required: false, // Optional, can be filled later
    trim: true,
  },

  // Updated O'Level structure
  oLevelData: [
    {
      examType: String,       // e.g. WAEC, NECO
      serialNumber: String,   // exam serial number
      pin: String,            // pin or token
    },
  ],

  // JAMB info
  jambInfo: {
    jambRegNo: String,
    jambScore: String,
  },

  // Uploaded file URLs
  files: {
    oLevelUploads: { type: [String], default: [] },
    jambUpload: String,
    jambAdmission: String,
    applicationForm: String,
    acceptanceForm: String,
    guarantorForm: String,
    codeOfConduct: String,
    nd1First: String,
    nd1Second: String,
    nd2First: String,
    nd2Second: String,
    ict1: String,
    ict2: String,
    ict3: String,
    ict4: String,
    fee1: String,
    fee2: String,
    fee3: String,
    fee4: String,
    acceptanceFee: String,
    stateOfOrigin: String,
    nin: String,
    deptFee: String,
  },

  uploadedAt: {
    type: Date,
    default: Date.now,
  },
});

const Document = mongoose.model("DocumentUpload", DocumentSchema);

//========== Courses Schema =========
const courseSchema = new mongoose.Schema({
  level: { type: String, required: true },        // ND1, ND2
  department: { type: String, required: true },   // Computer Science etc
  semester: { type: Number, required: true },     // 1 or 2
  courses: [
    {
      code: { type: String, required: true },
      title: { type: String, required: true },
      unit: { type: Number, required: true },
      lecturer: { type: String, required: true }
    }
  ],
  createdAt: { type: Date, default: Date.now }
});

const CourseCollection = mongoose.model('CourseCollection', courseSchema);

// ====== Admin Schema ======
const adminSchema = new mongoose.Schema({
  fullname: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  department: { type: String, required: true },
  password: { type: String, required: true },
  passport: { type: String, required: true },
  role: {
    type: String,
    enum: ["Super Admin", "Admin"],
    default: "Admin"
  },
  dateRegistered: { type: Date, default: Date.now },
});

const Admin = mongoose.model("Admin", adminSchema);

//==== Result Schema=========

const resultSchema = new mongoose.Schema({
  fullname: String,
  matricNo: String,
  department: String,
  level: String,
  courseCode: String,
  courseTitle: String,
  semester: String,
  score: Number,
  grade: String,
  uploadedAt: { type: Date, default: Date.now },
});

const Result = mongoose.model("Result", resultSchema);

// ====== O'level Schema
const oLevelSchema = new mongoose.Schema({
  matricNumber: {
    type: String,
    required: true,
    trim: true,
    uppercase: true, // normalize to capital letters (e.g. COS/023035)
  },
  olevelData: [
    {
      examType: { type: String, required: true },
      serialNumber: { type: String, required: true },
      pin: { type: String, required: true },
      fileUrl: { type: String, required: true },
    },
  ],
  uploadedAt: { type: Date, default: Date.now },
});

const Olevel = mongoose.model("Olevel", oLevelSchema);

// ================== ACCESS PIN SCHEMA ================

// === CoursePin Schema ===
const CoursePinSchema = new mongoose.Schema({
  courseCode: { type: String, required: true },
  courseTitle: { type: String, required: true },
  pin: { type: String, required: true, unique: true },
  used: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const CoursePin = mongoose.model("CoursePin", CoursePinSchema);

// === Course Registration Schema ===
const CourseRegistrationSchema = new mongoose.Schema({
  matricNumber: { type: String, required: true },
  studentName: { type: String },
  department: { type: String, required: true },
  level: { type: String, required: true },
  courseCode: { type: String, required: true },
  courseTitle: { type: String, required: true },
  pinUsed: { type: String, required: true },
  registeredAt: { type: Date, default: Date.now }
});

const CourseRegistration = mongoose.model("CourseRegistration", CourseRegistrationSchema);

//======= Payment Schema ========
const PaymentSchema = new mongoose.Schema({
  matricNumber: { type: String, required: true },
  studentName: { type: String, required: true },
  department: { type: String, required: true },
  level: { type: String, required: true }, // added level
  receiptNo: { type: String, required: true },
  amount: { type: Number, required: true },
  paymentType: { 
    type: String, 
    enum: ["Part Payment", "Balance Payment", "Full Payment"], 
    required: true 
  },
  semester: { 
    type: String, 
    enum: ["First Semester", "Second Semester"], 
    required: true 
  },
  systemPaymentId: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now }
});

const Payment = mongoose.model("Payment", PaymentSchema);

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

// ======== Universal Login (Student + Admin + Super Admin) ========
app.post("/api/universal-login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1️⃣ Check students
    const student = await Student.findOne({ email });
    if (student) {
      if (student.password !== password) {
        return res.status(401).json({ message: "Incorrect password" });
      }
      return res.json({ role: "student", user: student });
    }

    // 2️⃣ Check admins
    const admin = await Admin.findOne({ email });
    if (admin) {
      if (admin.password !== password) {
        return res.status(401).json({ message: "Incorrect password" });
      }
      return res.json({ role: admin.role, user: admin });
    }

    res.status(404).json({ message: "No account found with this email" });
  } catch (err) {
    console.error("❌ Universal login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// ====== 📦 Route: Upload all documents ======
app.post("/upload-documents", upload.any(), async (req, res) => {
  try {
    const { studentId, matricNumber, olevelData, jambRegNo, jambScore } = req.body;

    if (!studentId) {
      return res.status(400).json({ success: false, message: "Student ID required." });
    }

    // Parse O’Level JSON (sent from frontend)
    const parsedOlevel = JSON.parse(olevelData || "[]");

    // Define all expected file fields
    const expectedFiles = [
      "jambUpload", "jambAdmission", "applicationForm", "acceptanceForm",
      "guarantorForm", "codeOfConduct", "nd1First", "nd1Second",
      "nd2First", "nd2Second", "ict1", "ict2", "ict3", "ict4",
      "fee1", "fee2", "fee3", "fee4", "acceptanceFee",
      "stateOfOrigin", "nin", "deptFee"
    ];

    // Map files for upload
    const uploadedFiles = {};
    const fileMap = {};
    for (const file of req.files) fileMap[file.fieldname] = file;

    // Upload each file to Cloudinary if available
    for (const field of expectedFiles) {
      if (fileMap[field]) {
        const uploaded = await cloudinary.uploader.upload(fileMap[field].path, {
          folder: "student_documents",
        });
        uploadedFiles[field] = uploaded.secure_url;
      }
    }

    // Check if document record already exists for this student
    let existingDoc = await Document.findOne({ studentId });

    if (existingDoc) {
      // ✅ Update existing document
      if (parsedOlevel.length > 0) existingDoc.oLevelData = parsedOlevel;
      // Merge JAMB info safely (preserve if not provided)
if (jambRegNo || jambScore) {
  existingDoc.jambInfo.jambRegNo = jambRegNo || existingDoc.jambInfo.jambRegNo;
  existingDoc.jambInfo.jambScore = jambScore || existingDoc.jambInfo.jambScore;
}
      if (matricNumber) existingDoc.matricNumber = matricNumber;

      // Merge uploaded files
      for (const field of expectedFiles) {
        if (uploadedFiles[field]) existingDoc.files[field] = uploadedFiles[field];
      }

      await existingDoc.save();

      return res.json({
        success: true,
        message: "Documents updated successfully",
        data: existingDoc,
      });
    } else {
      // ✅ Create a new document record
      const newDoc = new Document({
        studentId,
        matricNumber,
        oLevelData: parsedOlevel,
        jambInfo: { jambRegNo, jambScore },
        files: uploadedFiles,
      });

      await newDoc.save();

      return res.json({
        success: true,
        message: "Documents uploaded successfully",
        data: newDoc,
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Error uploading documents",
      error: err.message,
    });
  }
});

//======== Fetch Uploaded Documents =======
app.get("/api/documents/:studentId", async (req, res) => {
  try {
    const doc = await Document.findOne({ studentId: req.params.studentId });
    if (!doc) return res.json({ success: false, message: "No record found" });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Profile Update Route
app.post("/api/profile/update", upload.single("passport"), async (req, res) => {
  try {
    const body = req.body;
    const studentId = body.studentId;

    if (!studentId) {
      return res.status(400).json({ success: false, message: "Missing studentId" });
    }

    // Fetch student
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    // Passport URL
    let passportUrl = student.passport;
    if (req.file) {
      passportUrl = req.file.path || req.file.secure_url;
    }

    // 🔹 Only set regNo if provided, otherwise generate one
    let regNo = body.regNo;
    if (!regNo) {
      const prefix = (body.department || "STD").split(" ").map(w => w[0]).join("").substring(0,3).toUpperCase();
      const random = Math.floor(10000 + Math.random() * 90000);
      regNo = `Reg/${prefix}/${random}`;
    }
     const matricNo = body.matricNo || student.matricNo; // fallback to existing

    // Update or create profile
    const updatedProfile = await StudentProfile.findOneAndUpdate(
      { email: student.email },
      {
        $set: {
          surname: body.surname || student.surname,
          firstname: body.firstname || student.firstname,
          middlename: body.middlename || student.middlename,
          phone: body.phone || student.phone,
          email: student.email, 
          dob: body.dob,
          department: body.department || "",
          matricNo: matricNo,
          regNo: regNo,
          level: body.level || "",
          stateOrigin: body.stateOrigin || "",
          lgaOrigin: body.lgaOrigin || "",
          address: body.address || "",
          nokSurname: body.nokSurname || "",
          nokFirstname: body.nokFirstname || "",
          nokPhone: body.nokPhone || "",
          nokRelation: body.nokRelation || "",
          passport: passportUrl,
        },
      },
      { new: true, upsert: true } // create if not exists
    );

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: updatedProfile,
    });

  } catch (err) {
    console.error("Error updating profile:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// ✅ Get Student Profile by RegNo
app.get("/api/profile/:regNo", async (req, res) => {
  try {
    const student = await StudentProfile.findOne({ regNo: req.params.regNo });
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });
    res.json({ success: true, data: student });
  } catch (err) {
    console.error("Error fetching profile:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ Optional: Get Profile by Reg No (for prefill)
app.get("/api/profile/:regNo", async (req, res) => {
  try {
    const student = await StudentProfile.findOne({ regNo: req.params.regNo });
    if (!student) return res.status(404).json({ success: false, message: "Profile not found" });
    res.json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

// ✅ Admin route: list students with profile fields merged
app.get("/api/students", async (req, res) => {
  try {
    const { q = "", department = "", level = "", page = 1, limit = 50 } = req.query;
    const perPage = Math.max(1, parseInt(limit, 10));
    const skip = (Math.max(1, parseInt(page, 10)) - 1) * perPage;

    // Step 1: fetch all students (no search at DB level)
    const students = await Student.find({}).sort({ createdAt: -1 }).lean();

    // Step 2: merge with profile
    const mergedStudents = await Promise.all(
      students.map(async s => {
        const profile = await StudentProfile.findOne({ email: s.email }).lean();
        return {
          ...profile,
          ...s,
          fullname: [s.surname, s.firstname, s.middlename].filter(Boolean).join(" "),
          matricNo: s.matricNo || profile?.matricNo || "N/A",
          department: s.department || profile?.department || "N/A",
          level: s.level || profile?.level || "N/A",
          passport: s.passport || profile?.passport || null
        };
      })
    );

    // Step 3: apply search & filters AFTER merging
    let filteredStudents = mergedStudents;

    if (q) {
      const regex = new RegExp(q.trim(), "i");
      filteredStudents = filteredStudents.filter(
        s =>
          regex.test(s.fullname || "") ||
          regex.test(s.matricNo || "") ||
          regex.test(s.email || "") ||
          regex.test(s.phone || "")
      );
    }

    if (department) {
      const dep = department.trim().toLowerCase();
      filteredStudents = filteredStudents.filter(s => (s.department || "").trim().toLowerCase() === dep);
    }

    if (level) {
      const lev = level.trim().toLowerCase();
      filteredStudents = filteredStudents.filter(s => (s.level || "").trim().toLowerCase() === lev);
    }

    const total = filteredStudents.length;
    const paginatedStudents = filteredStudents.slice(skip, skip + perPage);

    res.json({
      success: true,
      data: paginatedStudents,
      total,
      currentPage: parseInt(page, 10),
      totalPages: Math.ceil(total / perPage)
    });
  } catch (err) {
    console.error("❌ Error listing students:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get combined student + profile (merge all fields)
app.get("/api/students/:id", async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    // Find matching profile by email
    const profile = await StudentProfile.findOne({ email: student.email });

    // Combine both, with Student fields taking priority if duplicated
    const fullStudentData = {
      ...profile?.toObject(), // merge all profile fields first
      ...student.toObject(),  // then overwrite with Student fields if overlap
    };

    res.json({ success: true, student: fullStudentData });
  } catch (err) {
    console.error("❌ get student + profile error:", err);
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

// POST route to save courses
app.post('/api/courses', async (req, res) => {
  try {
    const { level, department, semester, courses } = req.body;

    if (!level || !department || !semester || !courses || !courses.length) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const newEntry = new CourseCollection({ level, department, semester, courses });
    await newEntry.save();

    return res.json({ success: true, message: 'Courses saved successfully.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// Optional: GET route to fetch courses
app.get('/api/courses', async (req, res) => {
  try {
    const allCourses = await CourseCollection.find().sort({ createdAt: -1 });
    res.json({ success: true, data: allCourses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// DELETE a specific course from a document
app.delete('/api/courses/:docId/:courseId', async (req, res) => {
  const { docId, courseId } = req.params;

  try {
    // Pull the specific course from the courses array
    const updatedDoc = await CourseCollection.findByIdAndUpdate(
      docId,
      { $pull: { courses: { _id: courseId } } },
      { new: true }
    );

    if (!updatedDoc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    res.json({ success: true, message: 'Course deleted successfully', data: updatedDoc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==≠====== Admin Registration =========
// ✅ Admin Registration (Super Admin Only)
app.post("/api/admins/register", upload.single("passport"), async (req, res) => {
  try {
    const { fullname, email, phone, department, password, role } = req.body;

    // ✅ Basic validation
    if (!fullname || !email || !phone || !password || !role) {
      return res.status(400).json({ message: "All required fields must be filled." });
    }

    // ✅ Check if admin already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: "Email already registered." });
    }

    // ✅ Upload passport to Cloudinary
    let passportUrl = "";
    if (req.file) {
      const uploaded = await cloudinary.uploader.upload(req.file.path, {
        folder: "admin_passports",
      });
      passportUrl = uploaded.secure_url;
    } else {
      return res.status(400).json({ message: "Passport image is required." });
    }

    // ✅ Department logic (hidden if Super Admin)
    const finalDepartment = role === "Super Admin" ? "N/A" : department || "N/A";

    // ✅ Create new admin
    const newAdmin = new Admin({
      fullname,
      email,
      phone,
      department: finalDepartment,
      password, // (no hashing yet)
      role,
      passport: passportUrl,
    });

    await newAdmin.save();

    res.status(201).json({
      success: true,
      message: `${role} registered successfully.`,
      admin: newAdmin,
    });
  } catch (err) {
    console.error("❌ Admin registration error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ========= Upload Result Route (Updated for Nested Courses) =========
app.post("/api/upload-results", uploadExcel.single("file"), async (req, res) => {
  try {
    // ✅ CASE 1: BULK UPLOAD (Excel file)
    if (req.file) {
      const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(sheet);

      if (rows.length === 0) {
        return res.status(400).json({ message: "Excel file is empty" });
      }

      const formattedResults = [];

      for (const row of rows) {
        const rawLevel = (row["Level"] || row["level"] || "").toString().trim().toUpperCase();
        const rawDept = (row["Department"] || row["department"] || "").trim();
        const level = rawLevel.replace(/\s+/g, " ");
        const score = Number(row["Score"] || row["score"] || 0);

        // Auto-grade if not provided
        let grade = row["Grade"] || row["grade"] || "";
        if (!grade) {
          if (score >= 70) grade = "A";
          else if (score >= 60) grade = "B";
          else if (score >= 50) grade = "C";
          else if (score >= 45) grade = "D";
          else if (score >= 40) grade = "E";
          else grade = "F";
        }

        const courseCode =
          (row["Course Code"] || row["CourseCode"] || row["courseCode"] || "").trim();

        // ✅ Find course title from nested structure
        const courseDoc = await CourseCollection.findOne({
          "courses.code": { $regex: `^${courseCode}$`, $options: "i" },
        });

        if (!courseDoc) {
          return res
            .status(400)
            .json({ message: `❌ Invalid course code found: ${courseCode}` });
        }

        // Extract course title from nested array
        const matchedCourse = courseDoc.courses.find(
          (c) => c.code.toLowerCase() === courseCode.toLowerCase()
        );

        formattedResults.push({
          fullname: row["Name"] || row["Fullname"] || row["fullname"] || "",
          matricNo: row["Matric Number"] || row["MatricNo"] || row["matricNo"] || "",
          department: rawDept,
          level,
          semester: row["Semester"] || row["semester"] || "",
          courseCode,
          courseTitle: matchedCourse ? matchedCourse.title : "",
          score,
          grade,
          uploadedAt: new Date(),
        });
      }

      await Result.insertMany(formattedResults);
      return res.json({
        message: "✅ Bulk results uploaded successfully!",
        count: formattedResults.length,
      });
    }

    // ✅ CASE 2: SINGLE UPLOAD (Manual JSON)
    const {
      fullname,
      matricNo,
      department,
      level,
      courseCode,
      semester,
      score,
      grade,
    } = req.body;

    if (!fullname || !matricNo || !courseCode || !score) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const numericScore = Number(score);

    // ✅ Find course inside nested array
    const courseDoc = await CourseCollection.findOne({
      "courses.code": { $regex: `^${courseCode}$`, $options: "i" },
    });

    if (!courseDoc) {
      return res.status(400).json({ message: `❌ Invalid course code: ${courseCode}` });
    }

    // Extract course title
    const matchedCourse = courseDoc.courses.find(
      (c) => c.code.toLowerCase() === courseCode.toLowerCase()
    );

    // Auto-determine grade if missing
    let finalGrade = grade;
    if (!finalGrade || finalGrade.trim() === "") {
      if (numericScore >= 70) finalGrade = "A";
      else if (numericScore >= 60) finalGrade = "B";
      else if (numericScore >= 50) finalGrade = "C";
      else if (numericScore >= 45) finalGrade = "D";
      else if (numericScore >= 40) finalGrade = "E";
      else finalGrade = "F";
    }

    const newResult = new Result({
      fullname,
      matricNo,
      department,
      level,
      courseCode,
      courseTitle: matchedCourse ? matchedCourse.title : "",
      semester,
      score: numericScore,
      grade: finalGrade,
      uploadedAt: new Date(),
    });

    await newResult.save();
    res.json({ message: "✅ Single result uploaded successfully!" });

  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({
      message: "Error uploading results",
      error: err.message,
    });
  }
});

// ====== Fetch Result Route (robust version) =======
app.get("/api/results", async (req, res) => {
  try {
    const { matricNo, department, level, semester } = req.query;
    const query = {};

    // Optional filters
    if (matricNo) query.matricNo = matricNo.trim();
    if (department) query.department = department.trim();
    if (level) query.level = level.trim();
    if (semester) query.semester = semester.trim();

    const results = await Result.find(query).sort({ uploadedAt: -1 });
    res.json({ results });
  } catch (err) {
    res.status(500).json({
      message: "Error fetching results",
      error: err.message,
    });
  }
});


// ===== Upload Olevel Route ========

// 🔹 Upload O’Level(s)
app.post("/api/olevel/upload", upload.array("files"), async (req, res) => {
  try {
    const { matricNumber, olevelData } = req.body;

    if (!matricNumber || !olevelData)
      return res.status(400).json({ success: false, message: "Missing fields" });

    // Parse O'Level JSON data
    const parsedData = typeof olevelData === "string" ? JSON.parse(olevelData) : olevelData;

    // Use file paths or URLs depending on your upload middleware
    const files = req.files || [];

    parsedData.forEach((entry, index) => {
      entry.fileUrl = files[index] ? files[index].path : ""; // or files[index].secure_url if Cloudinary
    });

    const newRecord = new Olevel({
      matricNumber: matricNumber.toUpperCase(), // normalize
      olevelData: parsedData,
    });

    await newRecord.save();
    res.json({ success: true, message: "O'Level uploaded successfully!", data: newRecord });
  } catch (err) {
    console.error("Upload Error:", err);
    res.status(500).json({ success: false, message: "Server Error", error: err.message });
  }
});

// 🔹 Fetch all O'Level records
app.get("/api/olevel", async (req, res) => {
  try {
    const records = await Olevel.find().sort({ uploadedAt: -1 });
    res.json({ success: true, records });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error fetching O'Level records" });
  }
});

// 🔸 Search O’Level by Matric or Name (if linked later)
app.get("/api/olevel/search", async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.json({ success: true, data: [] });

    const results = await Olevel.find({
      matricNumber: { $regex: new RegExp(query, "i") },
    });
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: "Search failed", error: err.message });
  }
});

// ✅ Fetch all O’Level records by matric number
app.get("/api/olevel/:matricNumber", async (req, res) => {
  try {
    const { matricNumber } = req.params;

    if (!matricNumber || matricNumber.trim() === "") {
      return res.status(400).json({ success: false, message: "Matric number required" });
    }

    // Use find() instead of findOne() to get all uploads
    const records = await Olevel.find({ matricNumber: matricNumber.toUpperCase() });

    if (!records || records.length === 0) {
      return res.status(404).json({ success: false, message: "O’Level record not found" });
    }

    res.json({ success: true, record: records }); // return array of records
  } catch (err) {
    console.error("Error fetching O’Level by matric:", err);
    res.status(500).json({
      success: false,
      message: "Server error while fetching O’Level",
      error: err.message
    });
  }
});

// ================== ACCESS PIN ROUTES ==================
// === Generate course registration pins ===
app.post("/api/course-pins/generate", async (req, res) => {
  try {
    const { courseCode, courseTitle, amount } = req.body;
    if (!courseCode || !courseTitle) {
      return res.status(400).json({ success: false, message: "Course and title required" });
    }

    const count = parseInt(amount) || 1;
    const pins = [];

    for (let i = 0; i < count; i++) {
      const random = Math.floor(1000 + Math.random() * 9000);
      const prefix = courseCode.split(" ")[0].toUpperCase();
      const pinCode = `REG/${prefix}/${random}`;
      pins.push({ courseCode, courseTitle, pin: pinCode });
    }

    await CoursePin.insertMany(pins);

    const generatedPins = pins.map((p) => p.pin);

    res.json({
      success: true,
      message: `${count} pin(s) generated successfully.`,
      generatedPins, // frontend uses this
    });
  } catch (err) {
    console.error("Error generating course pins:", err);
    res.status(500).json({ success: false, message: "Server error generating pins" });
  }
});

// === Fetch all pins (with search/filter) ===
app.get("/api/course-pins", async (req, res) => {
  try {
    const { courseCode, used } = req.query;
    const query = {};

    if (courseCode) {
      query.courseCode = { $regex: new RegExp(courseCode, "i") };
    }

    if (used === "true") query.used = true;
    if (used === "false") query.used = false;

    const pins = await CoursePin.find(query).sort({ createdAt: -1 });
    res.json({ success: true, data: pins });
  } catch (err) {
    console.error("Error fetching course pins:", err);
    res.status(500).json({ success: false, message: "Error fetching course pins" });
  }
});

// === Mark pin as used ===
app.post("/api/course-pins/use", async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ success: false, message: "Pin required" });

    const record = await CoursePin.findOne({ pin });
    if (!record) return res.status(404).json({ success: false, message: "Pin not found" });
    if (record.used) return res.json({ success: false, message: "Pin already marked as used" });

    record.used = true;
    await record.save();

    res.json({ success: true, message: "Pin marked as used." });
  } catch (err) {
    console.error("Error marking pin used:", err);
    res.status(500).json({ success: false, message: "Server error marking pin used" });
  }
});

// === Delete all course pins ===
app.delete("/api/course-pins/delete-all", async (req, res) => {
  try {
    console.log("🧨 Delete-all endpoint hit");
    const result = await CoursePin.deleteMany({});
    console.log("✅ Delete result:", result);
    res.json({
      success: true,
      message: `All pins deleted successfully (${result.deletedCount} removed)`
    });
  } catch (err) {
    console.error("❌ Error deleting all pins:", err);
    res.status(500).json({
      success: false,
      message: "Error deleting all pins",
      error: err.message
    });
  }
});

// Delete single pin (keep this BELOW)
app.delete("/api/course-pins/:id", async (req, res) => {
  try {
    await CoursePin.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Pin deleted successfully" });
  } catch {
    res.status(500).json({ success: false, message: "Error deleting pin" });
  }
});


// === UNIFIED COURSE REGISTRATION FETCH (courses + registered) ===
app.get("/api/course-registration/:matric", async (req, res) => {
  try {
    const { matric } = req.params;

    // Fetch student first
    const student = await Student.findOne({ matricNumber: matric });
    if (!student) {
      return res.json({ success: false, message: "Student not found" });
    }

    const department = student.department;
    const level = student.level;

    // Fetch courses for student’s dept + level
    const courseDoc = await Course.findOne({ department, level });

    // Fetch registration records
    const regDocs = await CourseRegistration.find({ matricNumber: matric });

    res.json({
      success: true,
      courses: courseDoc ? courseDoc.courses : [],
      registered: regDocs
    });

  } catch (err) {
    console.error("❌ Error fetching course registration:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// === FETCH STUDENT REGISTERED COURSES ===
app.get("/api/registered-courses", async (req, res) => {
  try {
    const { matric } = req.query;
    if (!matric) {
      return res.status(400).json({ success: false, message: "Matric number required" });
    }

    const regs = await CourseRegistration.find({ matricNumber: matric });
    res.json({ success: true, data: regs });
  } catch (err) {
    console.error("❌ Error fetching registrations:", err);
    res.status(500).json({ success: false, message: "Server error fetching registrations" });
  }
});

// === REGISTER A COURSE ===
app.post("/api/course-register", async (req, res) => {
  try {
    const { matricNumber, studentName, department, level, courseCode, courseTitle, pin } = req.body;

    if (!matricNumber || !department || !level || !courseCode || !pin) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Check if course already registered by student
    const already = await CourseRegistration.findOne({ matricNumber, courseCode });
    if (already) {
      return res.json({ success: false, message: "Course already registered" });
    }

    // Validate pin
    const validPin = await CoursePin.findOne({ pin, courseCode, used: false });
    if (!validPin) {
      return res.json({ success: false, message: "Invalid or already used pin" });
    }

    // Register the course
    const newReg = new CourseRegistration({
      matricNumber,
      studentName,
      department,
      level,
      courseCode,
      courseTitle,
      pinUsed: pin
    });

    await newReg.save();

    // Mark pin as used
    validPin.used = true;
    await validPin.save();

    res.json({ success: true, message: "Course registered successfully" });
  } catch (err) {
    console.error("❌ Error registering course:", err);
    res.status(500).json({ success: false, message: "Server error registering course" });
  }
});

// ==========================
// ADMIN — GET ALL REGISTERED COURSES (SIMPLE VERSION)
// ==========================
app.get("/api/admin/all-registered-courses", async (req, res) => {
  try {
    const all = await CourseRegistration.find().sort({ registeredAt: -1 }).lean();

    res.json({
      success: true,
      data: all.map(item => ({
        id: item._id,
        matricNumber: item.matricNumber,
        studentName: item.studentName,
        department: item.department,
        level: item.level,
        courseCode: item.courseCode,
        courseTitle: item.courseTitle,
        semester: item.semester || "",
        registeredAt: item.registeredAt
      }))
    });

  } catch (err) {
    console.error("ADMIN LOAD ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load registered courses",
      error: err.message
    });
  }
});

// DELETE all course registrations
app.delete("/api/course-registrations", async (req, res) => {
  try {
    const result = await CourseRegistration.deleteMany({}); // deletes all documents

    res.json({
      success: true,
      message: `All registrations deleted successfully (${result.deletedCount} records).`
    });
  } catch (err) {
    console.error("DELETE ALL REGISTRATIONS ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete all registrations",
      error: err.message
    });
  }
});

// DELETE a single course registration
app.delete("/api/course-registrations/:id", async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ success: false, message: "Registration ID is required" });
  }

  try {
    const deleted = await CourseRegistration.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Registration not found" });
    }

    res.json({ success: true, message: "Registration deleted successfully" });
  } catch (err) {
    console.error("DELETE REGISTRATION ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete registration",
      error: err.message
    });
  }
});

// ==================== PAYMENT ROUTES ====================

// Create a new payment
app.post("/api/payments", async (req, res) => {
  try {
    const { matricNumber, studentName, department, level, receiptNo, amount, paymentType, semester, systemPaymentId } = req.body;

    if (!matricNumber || !studentName || !department || !receiptNo || !amount || !paymentType || !systemPaymentId) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const existing = await Payment.findOne({ systemPaymentId });
    if (existing) return res.status(400).json({ success: false, message: "Payment ID already exists" });

 const payment = new Payment({ matricNumber, studentName, department, level, receiptNo, amount, paymentType, semester, systemPaymentId });

      await payment.save();

    res.json({ success: true, message: "Payment recorded successfully", data: payment });

  } catch (err) {
    console.error("CREATE PAYMENT ERROR:", err);
    res.status(500).json({ success: false, message: "Failed to save payment", error: err.message });
  }
});

// Get all payments
app.get("/api/payments", async (req, res) => {
  try {
    const payments = await Payment.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: payments });
  } catch (err) {
    console.error("GET PAYMENTS ERROR:", err);
    res.status(500).json({ success: false, message: "Failed to fetch payments", error: err.message });
  }
});

// Get payments by matric number
app.get("/api/payments/:matricNumber", async (req, res) => {
  try {
    const payments = await Payment.find({ matricNumber: req.params.matricNumber }).sort({ createdAt: -1 }).lean();
    if (!payments.length) return res.status(404).json({ success: false, message: "No payments found" });
    res.json({ success: true, data: payments });
  } catch (err) {
    console.error("GET PAYMENT BY MATRIC ERROR:", err);
    res.status(500).json({ success: false, message: "Failed to fetch payments", error: err.message });
  }
});

// Fetch student by matric number (for payment page)
app.get("/api/students/matric/:matricNumber", async (req, res) => {
  try {
    const student = await StudentProfile.findOne({ matricNo: req.params.matricNumber }).lean();
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });

    const studentName = `${student.firstname || ''} ${student.middlename || ''} ${student.surname || ''}`.trim();
    
    res.json({ 
      success: true, 
      studentName, 
      department: student.department,
      level: student.level || "" // <-- add this
    });
  } catch (err) {
    console.error("GET STUDENT + PROFILE ERROR:", err);
    res.status(500).json({ success: false, message: "Failed to fetch student", error: err.message });
  }
});

// VERIFY STUDENT PROFILE
app.put("/api/students/verify/:id", async (req, res) => {
  try {
    const student = await StudentProfile.findByIdAndUpdate(
      req.params.id,
      { verified: true },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    res.json({ success: true, message: "Student verified successfully", student });
  } catch (err) {
    console.error("VERIFY STUDENT ERROR:", err);
    res.status(500).json({ success: false, message: "Failed to verify student" });
  }
});

// ===== Start server =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
