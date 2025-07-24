// controller/event.js
const pool = require('../config/db'); // Import pool koneksi database

// 1. Fungsi untuk Membuat Event Baru
// INSERT INTO `oceantic`.`events` (`title`, `event_date`, `location`, `description`, `registration_start_date`, `registration_end_date`, `event_status`, `created_at`, `updated_at`) VALUES ('AKUATIK JAKARTA TIMUR Sprint SWIMMING terbuka 2025\nAKUATIK JAKARTA TIMUR Sprint SWIMMING terbuka 2025\n', '2025-08-15', 'Jakarta Timur', 'Dalam semangat kemerdekaan dan sportivitas, Akuatik Jakarta Timur dengan bangga mempersembahkan Kejuaraan Akuatik Jakarta Timur Terbuka 2025. Acara ini diselenggarakan untuk memperingati 80 tahun Kemerdekaan Republik Indonesia sekaligus menjadi ajang pengembangan prestasi dan bakat para atlet muda di bidang olahraga akuatik.', '2025-07-05', '2025-08-05', 'open', '2025-07-21', '2025-07-21');


let event = {
 createEvent : async (req, res) => {
  const {
    title,
    event_date,
    location,
    description,
    registration_start_date,
    registration_end_date,
    event_status
  } = req.body;

  // Validasi input dasar
  if (!title || !event_date || !location) {
    return res.status(400).json({ message: 'Judul, tanggal event, dan lokasi wajib diisi.' });
  }

  try {
    const [result] = await pool.execute(

      `INSERT INTO events (
      title, event_date, location, description,
       registration_start_date, registration_end_date, event_status,
        created_at, updated_at) 
         VALUES ('${title}', '${event_date}', '${location}', '${description}', '${registration_start_date}', '${registration_end_date}', '${event_status}', NOW(), NOW());`

      
    );

    res.status(201).json({
      message: 'Event berhasil dibuat!',
      eventId: result.insertId
    });
  } catch (error) {
    console.error('Error saat membuat event:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server saat membuat event.' });
  }
},
// 2. Fungsi untuk Mendapatkan Semua Event

 getAllEvents : async (req, res) => {
  console.log("hhhhh");
  
  try {
    const [rows] = await pool.execute('SELECT * FROM events ORDER BY event_date DESC ');
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error saat mendapatkan semua event:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
},

getAllEventsOpen : async (req, res) => {
  console.log('====================================');
  console.log('getAllEventsOpen');
  console.log('====================================');
  try {
    const [rows] = await pool.execute("SELECT * FROM events WHERE event_status = 'Open for Registration'  ORDER BY event_date DESC");
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error saat mendapatkan semua event:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
},

// 3. Fungsi untuk Mendapatkan Event berdasarkan ID
 getEventById : async (req, res) => {
  console.log("c");

  const { id } = req.params; // Ambil ID dari parameter URL

  try {
    const [rows] = await pool.execute('SELECT * FROM events WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Event tidak ditemukan.' });
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Error saat mendapatkan event berdasarkan ID:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
},

// 4. Fungsi untuk Memperbarui Event
 updateEvent : async (req, res) => {
  console.log("b");

  const { id } = req.params; // Ambil ID dari parameter URL
  const {
    title,
    event_date,
    location,
    description,
    category_info,
    registration_start_date,
    registration_end_date,
    event_status
  } = req.body;

  try {
    // Bangun query UPDATE secara dinamis
    const fields = [];
    const values = [];

    if (title !== undefined) { fields.push('title = ?'); values.push(title); }
    if (event_date !== undefined) { fields.push('event_date = ?'); values.push(event_date); }
    if (location !== undefined) { fields.push('location = ?'); values.push(location); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }
    if (category_info !== undefined) { fields.push('category_info = ?'); values.push(category_info); }
    if (registration_start_date !== undefined) { fields.push('registration_start_date = ?'); values.push(registration_start_date); }
    if (registration_end_date !== undefined) { fields.push('registration_end_date = ?'); values.push(registration_end_date); }
    if (event_status !== undefined) { fields.push('event_status = ?'); values.push(event_status); }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'Tidak ada data yang disediakan untuk diperbarui.' });
    }

    const query = `UPDATE events SET ${fields.join(', ')} WHERE id = ?`;
    values.push(id); // Tambahkan ID ke akhir array values

    const [result] = await pool.execute(query, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Event tidak ditemukan atau tidak ada perubahan.' });
    }

    res.status(200).json({ message: 'Event berhasil diperbarui.' });
  } catch (error) {
    console.error('Error saat memperbarui event:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server saat memperbarui event.' });
  }
},

// 5. Fungsi untuk Menghapus Event
 deleteEvent : async (req, res) => {
  console.log("a");
  
  const { id } = req.params; // Ambil ID dari parameter URL

  try {
    const [result] = await pool.execute('DELETE FROM events WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Event tidak ditemukan.' });
    }

    res.status(200).json({ message: 'Event berhasil dihapus.' });
  } catch (error) {
    console.error('Error saat menghapus event:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server saat menghapus event.' });
  }
}

}


module.exports = event;
