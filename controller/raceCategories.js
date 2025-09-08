const pool = require('../config/db'); // Import pool koneksi database secara langsung


let raceCategories = {
// Fungsi untuk membuat kategori perlombaan baru
 createRaceCategory : async (req, res) => {
  const { event_id, race_number, distance, swim_style, age_group_class, gender_category } = req.body;

  // Validasi input awal di controller
  if (!event_id || !race_number || !distance || !swim_style || !age_group_class || !gender_category) {
    return res.status(400).json({ code: 400, message: 'Semua field kategori perlombaan wajib diisi.', detail: null });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO race_categories (event_id, race_number, distance, swim_style, age_group_class, gender_category)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [event_id, race_number, distance, swim_style, age_group_class, gender_category]
    );

    res.status(201).json({ code: 201, message: 'Kategori perlombaan berhasil dibuat!', detail: { id: result.insertId } });

  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ code: 409, message: 'Kategori perlombaan dengan detail yang sama sudah ada untuk event ini.', detail: null });
    }
    console.error('Error in createRaceCategory controller:', error); // Log error asli
    res.status(500).json({ code: 500, message: 'Terjadi kesalahan server saat membuat kategori perlombaan.', detail: error.message });
  }
},

// Fungsi untuk mendapatkan kategori perlombaan berdasarkan ID
 getRaceCategoryById : async (req, res) => {
  const  {id}  = req.params;
  try {
    const [rows] = await pool.execute('SELECT * FROM race_categories WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ code: 404, message: 'Kategori perlombaan tidak ditemukan.', detail: null });
    }
    res.status(200).json({ code: 200, message: 'Kategori perlombaan ditemukan.', detail: rows[0] });
  } catch (error) {
    console.error('Error in getRaceCategoryById controller:', error);
    res.status(500).json({ code: 500, message: 'Terjadi kesalahan server saat mendapatkan kategori perlombaan.', detail: error.message });
  }
},


// Fungsi untuk mendapatkan semua kategori perlombaan berdasarkan Event ID
 getAllRaceCategoriesByEventId : async (req, res) => {
  const {id} = req.params; // Asumsi eventId diambil dari URL parameter
  try {
    const [rows] = await pool.execute('SELECT * FROM race_categories WHERE event_id = ?', [id]);
    res.status(200).json({ code: 200, message: 'Daftar kategori perlombaan berhasil diambil.', detail: rows });
  } catch (error) {
    console.error('Error in getAllRaceCategoriesByEventId controller:', error);
    res.status(500).json({ code: 500, message: 'Terjadi kesalahan server saat mendapatkan daftar kategori perlombaan.', detail: error.message });
  }
}, 
getAvailableRaces : async (req, res) => {
  try {
    const { eventId } = req.body;
    if (!eventId) {
      return res.status(400).json({ message: "eventId harus disediakan." });
    }

    // Ambil master swim_style dari categories (UI referensi)
    const [styles] = await pool.query(
      `SELECT value FROM categories WHERE eventId = ? AND categoryName = 'swim_style'`,
      [eventId]
    );

    // Ambil daftar race detail (distance, age group, gender, dll.)
    const [races] = await pool.query(
      `SELECT id AS race_category_id, race_number, distance, swim_style, age_group_class, gender_category 
       FROM race_categories WHERE event_id = ? ORDER BY race_number ASC`,
      [eventId]
    );

    // Gabungkan data biar enak dipakai UI
    const grouped = {};
    races.forEach(r => {
      const key = `${r.distance} - ${r.swim_style}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({
        race_category_id: r.race_category_id,
        age_group: r.age_group_class,
        gender: r.gender_category
      });
    });

    return res.status(200).json({
      code: 200,
      message: "success",
      swim_styles: styles.map(s => s.value), // untuk UI referensi dropdown
      races: grouped // untuk daftar race real yang akan diinsert ke swimmer_events
    });
  } catch (error) {
    console.error("Error getAvailableRaces:", error);
    return res.status(500).json({ message: "Terjadi kesalahan server" });
  }
},

// Fungsi untuk memperbarui kategori perlombaan
 updateRaceCategory : async (req, res) => {
const {id} = req.params;
  const updateData = req.body; // Data yang akan diupdate

  const { race_number, distance, swim_style, age_group_class, gender_category } = updateData;

  const fields = [];
  const values = [];

  if (race_number !== undefined) { fields.push('race_number = ?'); values.push(race_number); }
  if (distance !== undefined) { fields.push('distance = ?'); values.push(distance); }
  if (swim_style !== undefined) { fields.push('swim_style = ?'); values.push(swim_style); }
  if (age_group_class !== undefined) { fields.push('age_group_class = ?'); values.push(age_group_class); }
  if (gender_category !== undefined) { fields.push('gender_category = ?'); values.push(gender_category); }

  // Validasi dasar di controller jika diperlukan
  if (fields.length === 0) { // Cek setelah membangun fields, bukan hanya Object.keys(updateData)
    return res.status(400).json({ code: 400, message: 'Tidak ada data yang disediakan untuk diperbarui.', detail: null });
  }

  const query = `UPDATE race_categories SET ${fields.join(', ')} WHERE id = ?`;
  values.push(id);

  try {
    const [result] = await pool.execute(query, values);
    if (result.affectedRows === 0) {
      return res.status(404).json({ code: 404, message: 'Kategori perlombaan tidak ditemukan atau tidak ada perubahan.', detail: null });
    }
    res.status(200).json({ code: 200, message: 'Kategori perlombaan berhasil diperbarui.', detail: { affectedRows: result.affectedRows } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ code: 409, message: 'Kombinasi kategori perlombaan yang diperbarui sudah ada.', detail: null });
    }
    console.error('Error in updateRaceCategory controller:', error);
    res.status(500).json({ code: 500, message: 'Terjadi kesalahan server saat memperbarui kategori perlombaan.', detail: error.message });
  }
},

// Fungsi untuk menghapus kategori perlombaan
 deleteRaceCategory : async (req, res) => {
  const { id }  = req.params;
  try {
    const [result] = await pool.execute('DELETE FROM race_categories WHERE id = ?',[id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ code: 404, message: 'Kategori perlombaan tidak ditemukan.', detail: null });
    }
    res.status(200).json({ code: 200, message: 'Kategori perlombaan berhasil dihapus.', detail: { affectedRows: result.affectedRows } });
  } catch (error) {
    console.error('Error in deleteRaceCategory controller:', error);
    res.status(500).json({ code: 500, message: 'Terjadi kesalahan server saat menghapus kategori perlombaan.', detail: error.message });
  }
},
}

module.exports = raceCategories;
