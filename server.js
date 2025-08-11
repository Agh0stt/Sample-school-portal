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

/* ---------- LOGIN ---------- */
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

/* ---------- STUDENT CRUD ---------- */
app.get('/api/students', (req, res) => {
  if (!fs.existsSync(studentsDir)) return res.json([]);
  const files = fs.readdirSync(studentsDir);
  const students = files.map(f => JSON.parse(fs.readFileSync(path.join(studentsDir, f))));
  res.json(students);
});

app.get('/api/student/:admissionNo', (req, res) => {
  const student = readStudent(req.params.admissionNo);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  res.json(student);
});

app.post('/api/student/add', (req, res) => {
  const { admissionNo, name, class: className, phone } = req.body;
  if (readStudent(admissionNo)) {
    return res.status(400).json({ error: 'Admission number already exists' });
  }
  const newStudent = { admissionNo, name, class: className, phone, testResults: [], notices: [] };
  writeStudent(admissionNo, newStudent);
  res.json({ success: true, student: newStudent });
});

app.post('/api/student/update', (req, res) => {
  const { admissionNo, ...updates } = req.body;
  const student = readStudent(admissionNo);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const updated = { ...student, ...updates };
  writeStudent(admissionNo, updated);
  res.json({ success: true, student: updated });
});

app.delete('/api/student/:admissionNo', (req, res) => {
  const filePath = getStudentFilePath(req.params.admissionNo);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Student not found' });
  fs.unlinkSync(filePath);
  res.json({ success: true });
});

/* ---------- ANNOUNCEMENTS / NOTICES ---------- */
app.post('/api/announcement/all', (req, res) => {
  const { notice } = req.body;
  if (!fs.existsSync(studentsDir)) return res.json({ success: false, error: "No students" });
  const files = fs.readdirSync(studentsDir);
  files.forEach(file => {
    const student = JSON.parse(fs.readFileSync(path.join(studentsDir, file)));
    student.notices.push(notice);
    writeStudent(student.admissionNo, student);
  });
  res.json({ success: true, message: "Announcement added to all students" });
});

app.post('/api/student/:admissionNo/notice/edit', (req, res) => {
  const { index, newNotice } = req.body;
  const student = readStudent(req.params.admissionNo);
  if (!student || index < 0 || index >= student.notices.length) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  student.notices[index] = newNotice;
  writeStudent(req.params.admissionNo, student);
  res.json({ success: true });
});

app.post('/api/student/:admissionNo/notice/delete', (req, res) => {
  const { index } = req.body;
  const student = readStudent(req.params.admissionNo);
  if (!student || index < 0 || index >= student.notices.length) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  student.notices.splice(index, 1);
  writeStudent(req.params.admissionNo, student);
  res.json({ success: true });
});

/* ---------- FILES ---------- */
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

app.get('/api/files', (req, res) => {
  res.json(readFiles());
});

app.post('/api/file/delete', (req, res) => {
  const { filename } = req.body;
  const files = readFiles();
  const index = files.findIndex(f => f.filename === filename);
  if (index === -1) return res.status(404).json({ error: 'File not found' });
  const filePath = path.join(uploadsDir, path.basename(files[index].path));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  files.splice(index, 1);
  writeFiles(files);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
