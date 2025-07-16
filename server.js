const express = require('express');
const app = express();

// Middleware untuk parsing JSON body
app.use(express.json());

// Contoh rute
app.get('/', (req, res) => {
  res.send('Selamat datang di OCEANETIC API!');
});

app.get('/api/data', (req, res) => {
  res.json({ message: 'Ini adalah data dari API Anda.' });
});

// Contoh rute login (sesuai yang Anda gunakan di frontend)
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  // Logika autentikasi dummy atau nyata Anda di sini
  if (username === 'ryansomnia' && password === 'lzhyto2371') {
    res.status(200).json({ message: 'Login berhasil!', token: 'dummy_token_123' });
  } else {
    res.status(401).json({ message: 'Username atau password salah.' });
  }
});

// Contoh rute register (sesuai yang Anda gunakan di frontend)
app.post('/api/register', (req, res) => {
  const { username, password, fullname, email, nohp, gender, role } = req.body;
  // Logika registrasi dummy atau nyata Anda di sini
  // Misalnya, simpan ke database
  console.log('User registered:', { username, fullname, email });
  res.status(201).json({ message: 'Registrasi berhasil!' });
});


// Jangan panggil app.listen() di sini jika Anda mendeploy ke Vercel!
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(`Server berjalan di port ${PORT}`);
// });

// Penting: Ekspor instance aplikasi Express
module.exports = app;