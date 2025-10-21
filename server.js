// ====== server.js ======
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import PDFDocument from "pdfkit";   // <-- ES module import
import fs from "fs";                // <-- ES module import
import path from "path";
import { fileURLToPath } from "url";

// dotenv.config();

// For __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

// ====== Database Connection ======
mongoose
  .connect(process.env.MONGO_URI)
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
  },
});
const upload = multer({ storage });

// ====== Student Schema ======
const RegstudentSchema = new mongoose.Schema(
  {
    surname: { type: String, required: true, trim: true },
    firstname: { type: String, required: true, trim: true },
    middlename: { type: String, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    marital: { type: String, required: true },
    disability: { type: String, default: "None" },
    stateOrigin: { type: String, required: true },
    lgaOrigin: { type: String, required: true },
    address: { type: String, required: true },
    lgaResidence: { type: String, required: true },
    department: { type: String, required: true },
    regNo: { type: String, required: true, unique: true, uppercase: true },

    // Next of Kin
    nokSurname: { type: String, required: true },
    nokFirstname: { type: String, required: true },
    nokMiddlename: { type: String },
    nokPhone: { type: String, required: true },
    nokMarital: { type: String, required: true },
    nokRelation: { type: String, required: true },
    nokAddress: { type: String, required: true },

    // Academic Info
    school: { type: String, required: true },
    olevel: [
      {
        year: String,
        reg: String,
        subject: String,
        grade: String,
      },
    ],

    // Uploaded files (URLs)
    fileOlevel: String,
    fileJamb: String,
    fileState: String,
    fileBirth: String,
    fileNin: String,
    fileFee: String,
  },
  { timestamps: true }
);

const Student = mongoose.model("RegStudent", RegstudentSchema);

// ====== Upload Single File ======
app.post("/api/students/upload-single", upload.any(), async (req, res) => {
  try {
    if (!req.files || !req.files.length) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    const fileData = req.files[0];
    const url = fileData.path || fileData.url;
    res.json({ success: true, url });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ====== Check Duplicate ======
app.get("/api/students/check-duplicate", async (req, res) => {
  try {
    const { email, phone } = req.query;
    const exists = await Student.findOne({
      $or: [{ email }, { phone }],
    });
    res.json({ exists: !!exists });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ====== Register Student ======
app.post(
  "/api/students/register",
  upload.fields([
    { name: "fileOlevel" },
    { name: "fileJamb" },
    { name: "fileState" },
    { name: "fileBirth" },
    { name: "fileNin" },
    { name: "fileFee" },
  ]),
  async (req, res) => {
    try {
      const body = req.body;

      // Required field check
      const requiredFields = [
        "surname",
        "firstname",
        "phone",
        "email",
        "marital",
        "stateOrigin",
        "lgaOrigin",
        "address",
        "lgaResidence",
        "department",
        "regNo",
        "nokSurname",
        "nokFirstname",
        "nokPhone",
        "nokMarital",
        "nokRelation",
        "nokAddress",
        "school",
      ];

      for (let field of requiredFields) {
        if (!body[field]) {
          return res.status(400).json({
            success: false,
            message: `Missing required field: ${field}`,
          });
        }
      }

      // Duplicate check
      const existing = await Student.findOne({
        $or: [{ email: body.email }, { phone: body.phone }],
      });
      if (existing)
        return res.status(400).json({
          success: false,
          message: "A student with this email or phone already exists.",
        });

      // Parse O-Level data
      const olevelArray =
        typeof body.olevel === "string"
          ? JSON.parse(body.olevel)
          : body.olevel || [];

      // Uploaded files
      const uploads = {};
      if (req.files) {
        for (const key in req.files) {
          const fileData = req.files[key][0];
          uploads[key] = fileData.path || fileData.url || "";
        }
      }

      // Create new student
      const student = new Student({
        ...body,
        olevel: olevelArray,
        fileOlevel: uploads.fileOlevel || "",
        fileJamb: uploads.fileJamb || "",
        fileState: uploads.fileState || "",
        fileBirth: uploads.fileBirth || "",
        fileNin: uploads.fileNin || "",
        fileFee: uploads.fileFee || "",
      });

      await student.save();
      res.json({ success: true, message: "Student registered successfully" });
    } catch (error) {
      console.error("❌ Registration error:", error);
      res
        .status(500)
        .json({ success: false, message: "Server error", error: error.message });
    }
  }
);

// ====== Update Student ======
app.put(
  "/api/students/:id",
  upload.fields([
    { name: "fileOlevel" },
    { name: "fileJamb" },
    { name: "fileState" },
    { name: "fileBirth" },
    { name: "fileNin" },
    { name: "fileFee" },
  ]),
  async (req, res) => {
    try {
      const studentId = req.params.id;
      const existingStudent = await Student.findById(studentId);
      if (!existingStudent)
        return res
          .status(404)
          .json({ success: false, message: "Student not found" });

      const body = req.body;

      // Parse O-Level
      let olevelArray = [];
      try {
        olevelArray =
          typeof body.olevel === "string"
            ? JSON.parse(body.olevel)
            : body.olevel || [];
      } catch {
        olevelArray = existingStudent.olevel;
      }

      // Handle file updates
      const uploads = {};
      const fileFields = [
        "fileOlevel",
        "fileJamb",
        "fileState",
        "fileBirth",
        "fileNin",
        "fileFee",
      ];

      fileFields.forEach((f) => {
        if (req.files && req.files[f]) {
          uploads[f] = req.files[f][0].path; // new file
        } else {
          uploads[f] = existingStudent[f]; // old URL
        }
      });

      // Update text fields
      const textFields = [
        "surname",
        "firstname",
        "middlename",
        "phone",
        "email",
        "marital",
        "disability",
        "stateOrigin",
        "lgaOrigin",
        "address",
        "lgaResidence",
        "department",
        "regNo",
        "nokSurname",
        "nokFirstname",
        "nokMiddlename",
        "nokPhone",
        "nokMarital",
        "nokRelation",
        "nokAddress",
        "school",
      ];

      textFields.forEach((f) => {
        existingStudent[f] = body[f] || existingStudent[f];
      });

      existingStudent.olevel = olevelArray;
      Object.assign(existingStudent, uploads);

      await existingStudent.save();

      res.json({
        success: true,
        message: "✅ Student updated successfully",
        student: existingStudent,
      });
    } catch (error) {
      console.error("❌ Error updating student:", error);
      res.status(500).json({
        success: false,
        message: "Server error while updating student",
        error: error.message,
      });
    }
  }
);

// ====== Search Students ======
app.get("/api/students/search", async (req, res) => {
  try {
    const { q, department } = req.query;
    const filter = {};
    if (q) {
      const regex = new RegExp(q, "i");
      filter.$or = [
        { surname: regex },
        { firstname: regex },
        { middlename: regex },
      ];
    }
    if (department) filter.department = department;

    const students = await Student.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: students.length, students });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ====== Delete Student ======
app.delete("/api/students/:id", async (req, res) => {
  try {
    const studentId = req.params.id;
    const student = await Student.findByIdAndDelete(studentId);
    if (!student)
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });

    res.json({ success: true, message: "Student deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ====== Fetch All Students ======
app.get("/api/students", async (req, res) => {
  try {
    const students = await Student.find().sort({ createdAt: -1 });
    res.json({ success: true, count: students.length, students });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

//====== Download Students Info (PDF) ==========
app.get("/api/students/:id/download", async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    const doc = new PDFDocument({ margin: 40 });
    const filePath = path.join(__dirname, `${student.regNo}.pdf`);

    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    // ========== HEADER ==========
    doc.fontSize(20).text("STUDENT REGISTRATION INFORMATION", { align: "center" });
    doc.moveDown();

    // ========== PERSONAL INFO ==========
    doc.fontSize(14).text("Personal Information", { underline: true });
    doc.fontSize(12);
    doc.text(`Surname: ${student.surname}`);
    doc.text(`Firstname: ${student.firstname}`);
    doc.text(`Middlename: ${student.middlename || "N/A"}`);
    doc.text(`Phone: ${student.phone}`);
    doc.text(`Email: ${student.email}`);
    doc.text(`Marital Status: ${student.marital}`);
    doc.text(`Disability: ${student.disability || "None"}`);
    doc.text(`State of Origin: ${student.stateOrigin}`);
    doc.text(`LGA of Origin: ${student.lgaOrigin}`);
    doc.text(`Address: ${student.address}`);
    doc.text(`LGA of Residence: ${student.lgaResidence}`);
    doc.text(`Department: ${student.department}`);
    doc.text(`Registration Number: ${student.regNo}`);
    doc.moveDown();

    // ========== NEXT OF KIN ==========
    doc.fontSize(14).text("Next of Kin Information", { underline: true });
    doc.fontSize(12);
    doc.text(`Surname: ${student.nokSurname}`);
    doc.text(`Firstname: ${student.nokFirstname}`);
    doc.text(`Middlename: ${student.nokMiddlename || "N/A"}`);
    doc.text(`Phone: ${student.nokPhone}`);
    doc.text(`Marital Status: ${student.nokMarital}`);
    doc.text(`Relationship: ${student.nokRelation}`);
    doc.text(`Address: ${student.nokAddress}`);
    doc.moveDown();

    // ========== ACADEMIC INFO ==========
    doc.fontSize(14).text("Academic Information", { underline: true });
    doc.fontSize(12);
    doc.text(`School: ${student.school}`);
    doc.moveDown();

    if (student.olevel && student.olevel.length > 0) {
      doc.fontSize(12).text("O'Level Results:");
      student.olevel.forEach((item, i) => {
        doc.text(`${i + 1}. Subject: ${item.subject}, Grade: ${item.grade}, Year: ${item.year}, Reg: ${item.reg}`);
      });
    } else {
      doc.text("No O'Level result provided.");
    }
    doc.moveDown();

    // ========== UPLOADED FILES ==========
    doc.fontSize(14).text("Uploaded Documents", { underline: true });
    doc.fontSize(12);
    const fileFields = [
      { label: "O'Level", key: "fileOlevel" },
      { label: "JAMB", key: "fileJamb" },
      { label: "State of Origin", key: "fileState" },
      { label: "Birth Certificate", key: "fileBirth" },
      { label: "NIN", key: "fileNin" },
      { label: "Fee Receipt", key: "fileFee" },
    ];

    fileFields.forEach(f => {
      if (student[f.key]) {
        doc.text(`${f.label}: ${student[f.key]}`, { link: student[f.key], underline: true });
      } else {
        doc.text(`${f.label}: Not uploaded`);
      }
    });

    doc.end();

    writeStream.on("finish", () => {
      res.download(filePath, `${student.regNo}.pdf`, err => {
        if (err) console.error(err);
        fs.unlinkSync(filePath); // delete temp file after download
      });
    });

  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).json({ message: "Error generating PDF" });
  }
});

// ====== Start Server ======
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
