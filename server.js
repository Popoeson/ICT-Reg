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
const studentSchema = new mongoose.Schema({
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

const Student = mongoose.model('Student', studentSchema);

// ====== Routes ======

// Register student
app.post('/api/students/register', upload.fields([
  { name: 'fileOlevel' },
  { name: 'fileJamb' },
  { name: 'fileState' },
  { name: 'fileBirth' },
  { name: 'fileNin' },
  { name: 'fileFee' }
]), async (req, res) => {
  try {
    const body = req.body;
    const uploads = {};

    // Map uploaded images to Cloudinary URLs
    if (req.files) {
      for (const key in req.files) {
        uploads[key] = req.files[key][0].path;
      }
    }

    const student = new Student({
      ...body,
      ...uploads,
      olevel: JSON.parse(body.olevel || '[]')
    });

    await student.save();
    res.status(201).json({ success: true, message: 'Student registered successfully', student });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
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
