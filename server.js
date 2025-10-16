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

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'school_uploads',
    allowed_formats: ['jpg', 'jpeg', 'png']
  }
});
const upload = multer({ storage });

// ====== Student Schema ======
const RegstudentSchema = new mongoose.Schema({
  surname: String,
  firstname: String,
  middlename: String,
  phone: String,
  email: String,
  marital: String,
  disability: String,
  stateOrigin: String,
  lgaOrigin: String,
  address: String,
  lgaResidence: String,
  department: String,
  regNo: String,
  // Next of Kin
  nokSurname: String,
  nokFirstname: String,
  nokMiddlename: String,
  nokPhone: String,
  nokMarital: String,
  nokRelation: String,
  nokAddress: String,
  // Academic Info
  school: String,
  olevel: [
    {
      year: String,
      reg: String,
      subject: String,
      grade: String
    }
  ],
  // Uploaded files
  fileOlevel: String,
  fileJamb: String,
  fileState: String,
  fileBirth: String,
  fileNin: String,
  fileFee: String,
}, { timestamps: true });

const Student = mongoose.model('RegStudent', RegstudentSchema);

// ====== Routes ======

// Register student
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

      console.log("🟢 Incoming body:", req.body);
console.log("🟣 Incoming files:", req.files);
      
      const body = req.body;
      const uploads = {};

      // 🔍 Log the files to see Cloudinary response
      console.log("Uploaded files:", req.files);

      // ✅ Extract each uploaded image’s Cloudinary URL
      if (req.files) {
        for (const key in req.files) {
          const fileData = req.files[key][0];
          uploads[key] =
         //   fileData.path || fileData.url || fileData.secure_url || "";
            uploads[key] = fileData.path;
        }
      }

      // ✅ Parse O-Level data safely
      const olevelArray =
        typeof body.olevel === "string"
          ? JSON.parse(body.olevel)
          : body.olevel || [];

      // ✅ Create the new student entry
      const student = new Student({
        surname: body.surname,
        firstname: body.firstname,
        middlename: body.middlename,
        phone: body.phone,
        email: body.email,
        marital: body.marital,
        disability: body.disability,
        stateOrigin: body.stateOrigin,
        lgaOrigin: body.lgaOrigin,
        address: body.address,
        lgaResidence: body.lgaResidence,
        department: body.department,
        regNo: body.regNo,
        // Next of kin
        nokSurname: body.nokSurname,
        nokFirstname: body.nokFirstname,
        nokMiddlename: body.nokMiddlename,
        nokPhone: body.nokPhone,
        nokMarital: body.nokMarital,
        nokRelation: body.nokRelation,
        nokAddress: body.nokAddress,
        // Academic info
        school: body.school,
        olevel: olevelArray,
        // Uploaded file URLs from Cloudinary
        fileOlevel: uploads.fileOlevel,
        fileJamb: uploads.fileJamb,
        fileState: uploads.fileState,
        fileBirth: uploads.fileBirth,
        fileNin: uploads.fileNin,
        fileFee: uploads.fileFee,
      });

      // ✅ Save to MongoDB
      await student.save();

      res.status(201).json({
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

// ====== Check Duplicate Route ======
app.get('/api/students/check-duplicate', async (req, res) => {
  try {
    const { email, phone } = req.query;
    const exists = await Student.findOne({
      $or: [{ email }, { phone }]
    });
    res.json({ exists: !!exists });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});
// Fetch all students
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
