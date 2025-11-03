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
import { Readable } from 'stream'; // for ES Modules
import * as xlsx from "xlsx";

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

const StudentProfile = mongoose.model("StudentProfile", studentProfileSchema);

// Documents upload schema

const DocumentSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true,
  },
  oLevelInputs: [
    {
      examYear: String,
      examType: String,
      examNumber: String,
      subject: String,
      grade: String,
    },
  ],
  jambInput: {
    regNo: String,
    score: String,
  },

  // Store all uploaded file URLs
  files: {
    oLevelUploads: { type: [String], default: [] }, // <-- New field for O'Level result images
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
const mongoose = require("mongoose");

const resultSchema = new mongoose.Schema({
  fullname: String,
  matricNo: String,
  department: String,
  level: String,
  courseCode: String,
  courseTitle: String,
  score: Number,
  grade: String,
  uploadedAt: { type: Date, default: Date.now },
});

const Result = mongoose.model("Result", resultSchema);

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

// 📦 Route: Upload all documents
app.post("/upload-documents", upload.any(), async (req, res) => {
  try {
    const { studentId, oLevelInputs, jambInput } = req.body;
    if (!studentId)
      return res.status(400).json({ success: false, message: "Student ID required." });

    // Parse the received JSON strings safely
    const oLevel = JSON.parse(oLevelInputs || "[]");
    const jamb = JSON.parse(jambInput || "{}");

    // Expected static file fields
    const expectedFiles = [
      "jambUpload", "jambAdmission", "applicationForm", "acceptanceForm",
      "guarantorForm", "codeOfConduct", "nd1First", "nd1Second",
      "nd2First", "nd2Second", "ict1", "ict2", "ict3", "ict4",
      "fee1", "fee2", "fee3", "fee4", "acceptanceFee",
      "stateOfOrigin", "nin", "deptFee"
    ];

    // Collect dynamic O'Level upload fields
    const oLevelFiles = req.files.filter(f => f.fieldname.startsWith("oLevelUpload"));

    const uploadedFiles = {};
    const fileMap = {};

    // Map all uploaded files
    for (const file of req.files) {
      fileMap[file.fieldname] = file;
    }

    // Upload all static files
    for (const field of expectedFiles) {
      if (fileMap[field]) {
        const uploaded = await cloudinary.uploader.upload(fileMap[field].path, {
          folder: "student_documents",
        });
        uploadedFiles[field] = uploaded.secure_url;
      }
    }

    // Upload O'Level files
    const oLevelUploads = [];
    for (const file of oLevelFiles) {
      const uploaded = await cloudinary.uploader.upload(file.path, {
        folder: "student_documents/olevel",
      });
      oLevelUploads.push(uploaded.secure_url);
    }

    // 🧠 Check if the student already has a document record
    let existingDoc = await Document.findOne({ studentId });

    if (existingDoc) {
      // Merge O'Level table data
      if (oLevel.length > 0) existingDoc.oLevelInputs = oLevel;

      // Merge JAMB data
      if (Object.keys(jamb).length > 0) existingDoc.jambInput = jamb;

      // Merge static files
      for (const field of expectedFiles) {
        if (uploadedFiles[field]) existingDoc.files[field] = uploadedFiles[field];
      }

      // Merge O'Level file URLs
      if (!existingDoc.files.oLevelUploads) existingDoc.files.oLevelUploads = [];
      if (oLevelUploads.length > 0) existingDoc.files.oLevelUploads.push(...oLevelUploads);

      await existingDoc.save();

      res.json({
        success: true,
        message: "Documents updated successfully",
        data: existingDoc,
      });
    } else {
      // Create new record
      const newFiles = { ...uploadedFiles };
      if (oLevelUploads.length > 0) newFiles.oLevelUploads = oLevelUploads;

      const newDoc = new Document({
        studentId,
        oLevelInputs: oLevel,
        jambInput: jamb,
        files: newFiles,
      });

      await newDoc.save();

      res.json({
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

//========= Upload Result Route =========
app.post("/api/upload-results", upload.single("file"), async (req, res) => {
  try {
    // If file is uploaded → handle Excel bulk upload
    if (req.file) {
      const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet);

      if (data.length === 0) {
        return res.status(400).json({ message: "Excel file is empty" });
      }

      const formattedResults = data.map((row) => ({
        fullname: row.Fullname || row.fullname || "",
        matricNo: row.MatricNo || row.matricNo || "",
        department: row.Department || row.department || "",
        level: row.Level || row.level || "",
        courseCode: row.CourseCode || row.courseCode || "",
        courseTitle: row.CourseTitle || row.courseTitle || "",
        score: Number(row.Score || row.score || 0),
        grade: row.Grade || row.grade || "",
      }));

      await Result.insertMany(formattedResults);
      return res.json({ message: "Results uploaded successfully (Excel)!" });
    }

    // Else, handle single result upload via JSON
    const {
      fullname,
      matricNo,
      department,
      level,
      courseCode,
      courseTitle,
      score,
      grade,
    } = req.body;

    if (!fullname || !matricNo || !courseCode || !score) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const newResult = new Result({
      fullname,
      matricNo,
      department,
      level,
      courseCode,
      courseTitle,
      score,
      grade,
    });

    await newResult.save();
    res.json({ message: "Single result uploaded successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error uploading results", error: err.message });
  }
});

// ===== Start server =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
