// controller/category.js
const pool = require('../config/db'); // Menggunakan jalur yang Anda berikan

// Fungsi untuk Membuat Kategori Baru
let category = {
 createCategory : async (req, res) => {
  const {
    eventId,
    categoryName,
    value
  } = req.body;

  // Validasi input dasar
  if (!eventId || !categoryName || !value) {
    return res.status(400).json({ message: 'eventId, categoryName, dan value wajib diisi.' });
  }

  try {
    // Menggunakan prepared statement untuk mencegah SQL injection
    const [result] = await pool.execute(
      'INSERT INTO categories (eventId, categoryName, value) VALUES (?, ?, ?)',
      [eventId, categoryName, value]
    );

    res.status(201).json({
      message: 'Kategori berhasil dibuat!',
      categoryId: result.insertId // Mengembalikan ID kategori yang baru dibuat
    });
  } catch (error) {
    console.error('Error saat membuat kategori:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server saat membuat kategori.' });
  }
},

// Fungsi untuk Mendapatkan Kategori Event berdasarkan eventId dan categoryName (gunakan ini jika Anda butuh filter spesifik)
 getCategoryEventByName : async (req, res) => {
    const {
        eventId,
        categoryName
      } = req.body; // Biasanya parameter filter diambil dari query params atau path params, bukan body untuk GET

    // Validasi input
    if (!eventId || !categoryName) {
        return res.status(400).json({ message: 'eventId dan categoryName wajib diisi.' });
    }

  try {
    // Menggunakan prepared statement untuk mencegah SQL injection
    const [rows] = await pool.execute(
      'SELECT categoryName, value FROM categories WHERE eventId = ? AND categoryName = ?',
      [eventId, categoryName]
    );
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error saat mendapatkan kategori:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
},

// Fungsi untuk mendapatkan semua kategori berdasarkan Event ID (ini yang dibutuhkan frontend)
 getCategoriesByEventId : async (req, res) => {
  const { id } = req.params; // Ambil eventId dari parameter URL, namanya 'id'

  try {
    const [rows] = await pool.execute('SELECT * FROM categories WHERE eventId = ?', [id]); // Perhatikan nama kolom 'eventId'
    res.status(200).json({ code: 200, message: 'success', data: rows });

    // res.status(200).json(rows);
  } catch (error) {
    console.error('Error saat mendapatkan kategori berdasarkan Event ID:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
},


// Fungsi BARU: Memperbarui Kategori berdasarkan ID
 updateCategory : async (req, res) => {
    const { id } = req.params; // Ambil ID kategori dari parameter URL
    const { categoryName, value } = req.body; // Ambil data yang akan diperbarui dari body

    // Validasi dasar: setidaknya satu field harus disediakan untuk diperbarui
    if (!categoryName && !value) {
        return res.status(400).json({ message: 'Tidak ada data yang disediakan untuk diperbarui.' });
    }

    try {
        const fields = [];
        const values = [];

        if (categoryName !== undefined) {
            fields.push('categoryName = ?');
            values.push(categoryName);
        }
        if (value !== undefined) {
            fields.push('value = ?');
            values.push(value);
        }

        // Jika tidak ada field yang valid untuk diperbarui
        if (fields.length === 0) {
            return res.status(400).json({ message: 'Tidak ada data valid untuk diperbarui.' });
        }

        const query = `UPDATE categories SET ${fields.join(', ')} WHERE id = ?`;
        values.push(id); // Tambahkan ID ke akhir array values

        const [result] = await pool.execute(query, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Kategori tidak ditemukan atau tidak ada perubahan.' });
        }

        res.status(200).json({ message: 'Kategori berhasil diperbarui.' });
    } catch (error) {
        console.error('Error saat memperbarui kategori:', error);
        res.status(500).json({ message: 'Terjadi kesalahan server saat memperbarui kategori.' });
    }
},

// Fungsi BARU: Menghapus Kategori berdasarkan ID
 deleteCategory : async (req, res) => {
    const { id } = req.params; // Ambil ID kategori dari parameter URL

    try {
        const [result] = await pool.execute('DELETE FROM categories WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Kategori tidak ditemukan.' });
        }

        res.status(200).json({ message: 'Kategori berhasil dihapus.' });
    } catch (error) {
        console.error('Error saat menghapus kategori:', error);
        res.status(500).json({ message: 'Terjadi kesalahan server saat menghapus kategori.' });
    }
}
}

module.exports = category;
