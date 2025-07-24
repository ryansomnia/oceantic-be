// controller/article.js
const pool = require('../config/db'); // Import pool koneksi database
const path = require('path'); // Untuk manipulasi path file
const fs = require('fs/promises'); // Untuk operasi file sistem berbasis Promise

// Pastikan direktori uploads ada
const UPLOADS_DIR = path.join(__dirname, '../public/uploads');

// Fungsi pembantu untuk memastikan direktori ada
const ensureUploadsDir = async () => {
  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
  } catch (error) {
    console.error('Gagal membuat direktori uploads:', error);
  }
};
ensureUploadsDir(); // Panggil saat controller dimuat

// 1. Fungsi untuk Upload/Membuat Artikel Baru
const createArticle = async (req, res) => {
  const { title, content, category, user_id } = req.body; // user_id bisa dari req.user.id setelah JWT
  let image_url = null;

  // Validasi input dasar
  if (!title || !content || !category) {
    return res.status(400).json({ message: 'Judul, konten, dan kategori wajib diisi.' });
  }

  // Penanganan upload gambar
  if (req.files && req.files.image) {
    const image = req.files.image;
    const fileName = `${Date.now()}-${image.name}`;
    const uploadPath = path.join(UPLOADS_DIR, fileName);

    try {
      await image.mv(uploadPath); // Pindahkan file ke direktori uploads
      image_url = `/uploads/${fileName}`; // Simpan path relatif
    } catch (err) {
      console.error('Error saat mengupload gambar:', err);
      return res.status(500).json({ message: 'Gagal mengupload gambar.' });
    }
  }

  try {
    const [result] = await pool.execute(
      'INSERT INTO articles (title, content, image_url, category, user_id) VALUES (?, ?, ?, ?, ?)',
      [title, content, image_url, category, user_id || req.user.id] // Gunakan user_id dari JWT jika tidak disediakan di body
    );

    res.status(201).json({
      message: 'Artikel berhasil dibuat!',
      articleId: result.insertId,
      image_url: image_url
    });
  } catch (error) {
    console.error('Error saat membuat artikel:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server saat membuat artikel.' });
  }
};

// 2. Fungsi untuk Mendapatkan Artikel berdasarkan Kategori
const getArticlesByCategory = async (req, res) => {
  const { category } = req.params; // Ambil kategori dari parameter URL

  try {
    const [rows] = await pool.execute('SELECT * FROM articles WHERE category = ?', [category]);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error saat mendapatkan artikel berdasarkan kategori:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

// 3. Fungsi untuk Mendapatkan Artikel berdasarkan ID
const getArticleById = async (req, res) => {
  const { id } = req.params; // Ambil ID dari parameter URL

  try {
    const [rows] = await pool.execute('SELECT * FROM articles WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Artikel tidak ditemukan.' });
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Error saat mendapatkan artikel berdasarkan ID:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

// 4. Fungsi untuk Memperbarui Artikel
const updateArticle = async (req, res) => {
  const { id } = req.params; // Ambil ID dari parameter URL
  const { title, content, category } = req.body;
  let image_url = req.body.image_url_existing; // Jika ada gambar lama yang dipertahankan
  let old_image_path = null;

  // Validasi dasar
  if (!title && !content && !category && (!req.files || !req.files.image)) {
    return res.status(400).json({ message: 'Tidak ada data yang disediakan untuk diperbarui.' });
  }

  try {
    // Ambil path gambar lama jika ada, untuk dihapus nanti
    const [existingArticle] = await pool.execute('SELECT image_url FROM articles WHERE id = ?', [id]);
    if (existingArticle.length > 0 && existingArticle[0].image_url) {
      old_image_path = path.join(__dirname, '../public', existingArticle[0].image_url);
    }

    // Penanganan upload gambar baru (jika ada)
    if (req.files && req.files.image) {
      const image = req.files.image;
      const fileName = `${Date.now()}-${image.name}`;
      const uploadPath = path.join(UPLOADS_DIR, fileName);

      try {
        await image.mv(uploadPath);
        image_url = `/uploads/${fileName}`; // Update image_url dengan yang baru
        // Hapus gambar lama jika ada dan gambar baru berhasil diupload
        if (old_image_path && (await fs.stat(old_image_path).catch(() => null))) {
          await fs.unlink(old_image_path);
        }
      } catch (err) {
        console.error('Error saat mengupload gambar baru:', err);
        return res.status(500).json({ message: 'Gagal mengupload gambar baru.' });
      }
    } else if (req.body.remove_image === 'true' && old_image_path) {
      // Jika ada permintaan untuk menghapus gambar tanpa upload baru
      if (await fs.stat(old_image_path).catch(() => null)) {
        await fs.unlink(old_image_path);
      }
      image_url = null; // Set image_url di DB menjadi NULL
    }

    // Bangun query UPDATE secara dinamis
    const fields = [];
    const values = [];

    if (title !== undefined) { fields.push('title = ?'); values.push(title); }
    if (content !== undefined) { fields.push('content = ?'); values.push(content); }
    if (category !== undefined) { fields.push('category = ?'); values.push(category); }
    // Hanya tambahkan image_url jika ada perubahan atau permintaan penghapusan
    if (req.files && req.files.image || req.body.remove_image === 'true') {
        fields.push('image_url = ?'); values.push(image_url);
    } else if (image_url !== undefined) { // Jika image_url_existing dikirim tanpa upload baru
        fields.push('image_url = ?'); values.push(image_url);
    }


    if (fields.length === 0) {
      return res.status(400).json({ message: 'Tidak ada data yang valid untuk diperbarui.' });
    }

    const query = `UPDATE articles SET ${fields.join(', ')} WHERE id = ?`;
    values.push(id);

    const [result] = await pool.execute(query, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Artikel tidak ditemukan atau tidak ada perubahan.' });
    }

    res.status(200).json({ message: 'Artikel berhasil diperbarui.' });
  } catch (error) {
    console.error('Error saat memperbarui artikel:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server saat memperbarui artikel.' });
  }
};

// 5. Fungsi untuk Menghapus Artikel
const deleteArticle = async (req, res) => {
  const { id } = req.params; // Ambil ID dari parameter URL
  let image_url_to_delete = null;

  try {
    // Dapatkan path gambar sebelum menghapus artikel
    const [rows] = await pool.execute('SELECT image_url FROM articles WHERE id = ?', [id]);
    if (rows.length > 0 && rows[0].image_url) {
      image_url_to_delete = path.join(__dirname, '../public', rows[0].image_url);
    }

    // Hapus artikel dari database
    const [result] = await pool.execute('DELETE FROM articles WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Artikel tidak ditemukan.' });
    }

    // Hapus file gambar dari server jika ada
    if (image_url_to_delete) {
      try {
        // Cek apakah file ada sebelum menghapus
        if (await fs.stat(image_url_to_delete).catch(() => null)) {
          await fs.unlink(image_url_to_delete);
          console.log(`Gambar lama dihapus: ${image_url_to_delete}`);
        }
      } catch (fileError) {
        console.error('Gagal menghapus file gambar:', fileError);
        // Lanjutkan tanpa menghentikan response, karena artikel sudah dihapus dari DB
      }
    }

    res.status(200).json({ message: 'Artikel berhasil dihapus.' });
  } catch (error) {
    console.error('Error saat menghapus artikel:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server saat menghapus artikel.' });
  }
};

module.exports = {
  createArticle,
  getArticlesByCategory,
  getArticleById,
  updateArticle,
  deleteArticle,
};
