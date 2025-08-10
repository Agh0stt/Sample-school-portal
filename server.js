const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const app = express();
const PORT = 3000;

app.use(express.json());

const studentsDir = path.join(__dirname, 'data', 'students');
const filesPath = path.join(__dirname, 'data', 'files.json');
const uploadsDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use('/uploads', express.static(uploadsDir));

function getStudentFilePath(admissionNo) {
  return path.join(studentsDir, `${admissionNo}.json`);
}
function readStudent(admissionNo) {
  const filePath = getStudentFilePath(admissionNo);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
function writeStudent(admissionNo, data) {
  const filePath = getStudentFilePath(admissionNo);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}
function readFiles() {
  if (!fs.existsSync(filesPath)) return [];
  return JSON.parse(fs.readFileSync(filesPath, 'utf8'));
}
function writeFiles(data) {
  fs.writeFileSync(filesPath, JSON.stringify(data, null, 2));
}

app.post('/api/login', (req, res) => {
  const { role, admissionNo, phone, username, password } = req.body;

  if (role === 'student') {
    const student = readStudent(admissionNo);
    if (student && student.phone === phone) {
      return res.json({ success: true, role: 'student', student });
    }
  }
  if (role === 'admin') {
    if (username === 'admin' && password === 'admin123') {
      return res.json({ success: true, role: 'admin' });
    }
  }
  res.status(401).json({ success: false, error: 'Invalid credentials' });
});

app.get('/api/student/:admissionNo', (req, res) => {
  const student = readStudent(req.params.admissionNo);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  res.json(student);
});

app.post('/api/student/update', (req, res) => {
  const { admissionNo, ...updates } = req.body;
  const student = readStudent(admissionNo);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const updated = { ...student, ...updates };
  writeStudent(admissionNo, updated);
  res.json({ success: true, student: updated });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  const { audience, admissionNo } = req.body;
  const files = readFiles();

  files.push({
    filename: req.file.originalname,
    path: `/uploads/${req.file.filename}`,
    audience,
    admissionNo: audience === 'private' ? admissionNo : null
  });

  writeFiles(files);
  res.json({ success: true, message: 'File uploaded successfully!' });
});

app.get('/api/files/:admissionNo', (req, res) => {
  const admissionNo = req.params.admissionNo;
  const files = readFiles();

  const visibleFiles = files.filter(
    f => f.audience === 'public' ||
    (f.audience === 'private' && f.admissionNo === admissionNo)
  );

  res.json(visibleFiles);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
