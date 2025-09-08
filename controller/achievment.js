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

let achievment = {
  GetAchievmentById: async (req, res) => {
    try {
      const { id } = req.params; // Ambil ID kategori dari parameter URL

      const [rows] = await pool.query(
        `SELECT a.date, a.juara, e.full_name, e.club_name,
                d.swim_style, d.age_group_class, d.distance, d.gender_category
         FROM achievment a
         LEFT JOIN events b ON a.kode_event = b.id
         INNER JOIN swimmer_events c ON a.kode_race = c.id
         LEFT JOIN race_categories d ON c.race_category_id = d.id
         LEFT JOIN swimmer_registrations e ON e.id = a.kode_swimmer
         WHERE a.juara IS NOT NULL AND b.id = ?
         ORDER BY a.date DESC
         `,[id]
      );
  
      res.status(200).json({ code: 200, message: 'success', detail: rows});
    } catch (err) {
      console.error("Error fetching achievements:", err.message);
      res.status(500).json({ code: 500, message: 'error', error: err.message});
    }
  },

  getAllEventsList: async (req, res) => {
    try {
      const [rows] = await pool.query("SELECT id, title, location FROM events");
      res.json(rows);
    } catch (err) {
      console.error("Error fetching events:", err.message);
      res.status(500).json({ message: "Gagal mengambil data events", error: err.message });
    }
  },
  getAllSwimmersList: async (req, res) => {
    try {
      const [rows] = await pool.query("SELECT id, full_name, club_name FROM swimmer_registrations");
      res.status(200).json({ code: 200, message: 'success', detail: rows});
    } catch (err) {
      console.error("Error fetching swimmers:", err.message);
      res.status(500).json({ message: "Gagal mengambil data swimmers", error: err.message });
    }
  },
  getAllRacesList: async(req, res)=>{
    try {
      const [rows] = await pool.query(`
        SELECT rc.id, rc.swim_style, rc.distance, rc.age_group_class 
        FROM race_categories rc
      `);
      res.status(200).json({ code: 200, message: 'success', detail: rows});
  
    } catch (err) {
      console.error("Error fetching races:", err.message);
      res.status(500).json({ code: 500, message: 'error', error: err.message});
      }
  },
};
  
  module.exports = achievment;
