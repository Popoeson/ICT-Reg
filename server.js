// server.js
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

// ====== Database Connection ======
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// ====== Cloudinary Setup ======
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

// Multer Storage for Cloudinary
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'school_uploads',
    allowed_formats: ['jpg', 'jpeg', 'png'],
  },
});
const upload = multer({ storage });

// ====== Student Schema ======
const RegstudentSchema = new mongoose.Schema({
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

  // Uploaded files (URLs from Cloudinary)
  fileOlevel: { type: String },
  fileJamb: { type: String },
  fileState: { type: String },
  fileBirth: { type: String },
  fileNin: { type: String },
  fileFee: { type: String },
}, { timestamps: true });
  
const Student = mongoose.model('RegStudent', RegstudentSchema);

// ====== Routes ======

// Upload single file to Cloudinary
app.post('/api/students/upload-single', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const url = req.file.path || req.file.url;
    res.json({ success: true, url });
  } catch (err) {
    console.error('❌ Upload error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== Register Student =====
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

      // ===== Required Fields Check =====
      const requiredFields = [
        'surname','firstname','phone','email','marital',
        'stateOrigin','lgaOrigin','address','lgaResidence',
        'department','regNo','nokSurname','nokFirstname',
        'nokPhone','nokMarital','nokRelation','nokAddress',
        'school'
      ];

      for (let field of requiredFields) {
        if (!body[field]) {
          return res.status(400).json({
            success: false,
            message: `Missing required field: ${field}`,
          });
        }
      }

      // ===== Duplicate Email or Phone Check =====
      const existing = await Student.findOne({
        $or: [{ email: body.email }, { phone: body.phone }],
      });
      if (existing)
        return res.status(400).json({
          success: false,
          message: "A student with this email or phone already exists.",
        });

      // ===== Parse O-Level Data =====
      const olevelArray =
        typeof body.olevel === "string"
          ? JSON.parse(body.olevel)
          : body.olevel || [];

      // ===== Process Uploaded Files =====
      const uploads = {};
      if (req.files) {
        for (const key in req.files) {
          const fileData = req.files[key][0];
          uploads[key] = fileData.path || fileData.url || "";
        }
      }

      // ===== Create Student Entry =====
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

      res.json({
        success: true,
        message: "✅ Student registered successfully",
        student,
      });
    } catch (error) {
      console.error("❌ Error registering student:", error);
      res.status(500).json({
        success: false,
        message: "Server error while registering student",
        error: error.message,
      });
    }
  }
);

// ======= Update Student Info Route =========
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
        return res.status(404).json({ success: false, message: "Student not found" });

      const body = req.body;

      // ✅ Parse O-Level safely
      let olevelArray = [];
      try {
        olevelArray =
          typeof body.olevel === "string"
            ? JSON.parse(body.olevel)
            : body.olevel || [];
      } catch {
        olevelArray = existingStudent.olevel;
      }

      // ✅ Handle uploaded files (preserve old URLs if no new upload)
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

      // ✅ Update all text fields if provided
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

      // ✅ Assign O-Level and files
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
// Search students by name or department
app.get('/api/students/search', async (req, res) => {
  try {
    const { q, department } = req.query;

    const filter = {};
    if (q) {
      const regex = new RegExp(q, 'i'); // case-insensitive search
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

// Delete student
app.delete('/api/students/:id', async (req, res) => {
  try {
    const studentId = req.params.id;
    const student = await Student.findByIdAndDelete(studentId);
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });

    res.json({ success: true, message: "Student deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ====== Fetch All Students ======
app.get('/api/students', async (req, res) => {
  try {
    const students = await Student.find().sort({ createdAt: -1 });
    res.json({ success: true, count: students.length, students });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ====== Server Start ======
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
