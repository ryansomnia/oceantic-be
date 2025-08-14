const { json } = require('express');
const pool = require('../config/db'); // Import pool koneksi database
const axios = require('axios');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs/promises'); // Tambahkan modul fs/promises



const escape = (s) => {
  if (s === undefined || s === null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};
const buildHtmlFromEventBook = (eventBook, template) => {
  const { namaEvent, date, location, detailCompetition } = eventBook;
  const formattedDate = new Date(date).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const currentDate = new Date().toLocaleDateString("id-ID");

  const competitionHtml = (detailCompetition || [])
    .map((comp) => {
      const headerText = `Acara ${escape(comp.acara)} | ${escape(
        comp.jarak
      )} ${escape(comp.gaya)} - ${escape(comp.gender)} | Golongan: ${escape(
        comp.golongan
      )}`;

      const swimmersRows = (comp.detailSwimmer || [])
        .map((sw) => {
          return `
            <tr>
              <td class="cell small">${escape(sw.seri)}</td>
              <td class="cell small">${escape(sw.grup)}</td>
              <td class="cell small">${escape(sw.lint)}</td>
              <td class="cell name">${escape(sw.nama)}</td>
              <td class="cell small">${escape(sw.club)}</td>
              <td class="cell school">${escape(sw.qet)}</td>
              <td class="cell small">${escape(sw.hasil)}</td>
            </tr>
          `;
        })
        .join("");

      return `
        <div class="competition-section">
          <div class="competition-header">${headerText}</div>
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Seri</th>
                  <th>Grup</th>
                  <th>Lint</th>
                  <th>Nama</th>
                  <th>Asal Sekolah/Club</th>
                  <th>QET</th>
                  <th>Hasil</th>
                </tr>
              </thead>
              <tbody>
                ${swimmersRows || `<tr><td colspan="7" style="text-align:center;">Tidak ada peserta</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      `;
    })
    .join("");

  // Mengisi placeholder dalam template dengan data acara
  return template
    .replace('{{namaEvent}}', escape(namaEvent))
    .replace('{{formattedDate}}', escape(formattedDate))
    .replace('{{location}}', escape(location))
    .replace('{{competitionHtml}}', competitionHtml)
    .replace('{{currentDate}}', currentDate);
};

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
    return res.status(400).json({ 
      code:400,
      message: 'Bad Request',
    detail:`Judul, tanggal event, dan lokasi wajib diisi.`
    })}

  try {
    const [result] = await pool.execute(

      `INSERT INTO events (
      title, event_date, location, description,
       registration_start_date, registration_end_date, event_status,
        created_at, updated_at) 
         VALUES ('${title}', '${event_date}', '${location}', '${description}', '${registration_start_date}', '${registration_end_date}', '${event_status}', NOW(), NOW());`

      
    );

    res.status(201).json({
      code:201,
      message: 'Created',
      detail:`event  ${result.insertId} created`
    });
  } catch (error) {
    console.error('Error saat membuat event:', error);
    res.status(500).json({ 
      code:500,
      message: 'error',
      detail:`Terjadi kesalahan server saat membuat event: ${error.message}`});
  }
},
// 2. Fungsi untuk Mendapatkan Semua Event

 getAllEvents : async (req, res) => {
  console.log("hhhhh");
  
  try {
    const [rows] = await pool.execute('SELECT * FROM events ORDER BY event_date DESC ');
    res.status(200).json({code: 200, message: 'Success', data: rows });
  
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
    
    res.status(200).json({ code: 200, message: 'Success', data: rows });
   
  } catch (error) {
    console.error('Error saat mendapatkan semua event:', error);
    res.status(500).json({ code: 500, message: 'Terjadi kesalahan server.', detail: error });
  }
},

getEventBook: async (req, res) => {
  const { eventId } = req.body; // Ambil eventId dari body request

  // Validasi input awal
  if (!eventId) {
    return res.status(400).json({ 
      code: 400, 
      message: 'Event ID wajib disediakan.', 
      detail: null 
    });
  }

  try {
    // Panggil stored procedure GetEventBookData
    const [rows] = await pool.execute('CALL GetEventBookData(?)', [eventId]);

    // Hapus console.log yang bermasalah
    // console.log('====================================');
    // console.log(rows);
    // console.log(JSON.parse(rows.detailCompetition));
    // console.log('====================================');

    // Periksa apakah set hasil pertama ada dan tidak kosong
    if (rows && rows[0] && rows[0].length > 0) {
      const eventData = rows[0][0]; // Ambil baris pertama dari set hasil pertama

      // Periksa dan pastikan detailCompetition adalah array. 
      // Berdasarkan log Anda, ini sudah array, jadi kita tidak perlu JSON.parse.
      // Jika detailCompetition tidak ada atau null, kita default ke array kosong.
      if (!eventData.detailCompetition) {
        eventData.detailCompetition = [];
      }
      
      res.status(200).json({ 
        code: 200, 
        message: 'Data buku acara berhasil diambil.', 
        detail: eventData 
      });
    } else {
      res.status(404).json({ 
        code: 404, 
        message: 'Buku acara untuk event ini tidak ditemukan.', 
        detail: null 
      });
    }
  } catch (error) {
    console.error('Error in getEventBook controller:', error);
    res.status(500).json({ 
      code: 500, 
      message: 'Terjadi kesalahan server saat mengambil buku acara.', 
      detail: error.message 
    });
  }
},


// Fungsi utama untuk menghasilkan PDF

 
generateEventBookPdf :async (req, res) => {
  try {
    const { eventId } = req.body;
    if (!eventId) {
      return res
        .status(400)
        .json({ message: "eventId harus disediakan di body request." });
    }

    // Ambil data dari service kamu
    const apiResponse = await axios.post(
      "http://localhost:3025/oceantic/v1/getEventBook",
      { eventId }
    );

    const eventBook = apiResponse?.data?.detail;
    if (!eventBook) {
      return res
        .status(404)
        .json({ message: "Data buku acara tidak ditemukan." });
    }

    // Baca file template HTML secara asinkron
    const templatePath = path.join(__dirname, '..', 'templates', 'event-book-template.html');
    const htmlTemplate = await fs.readFile(templatePath, 'utf8');

    // Bangun HTML dengan template
    const htmlContent = buildHtmlFromEventBook(eventBook, htmlTemplate);

    // Generate PDF dengan Puppeteer
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" },
    });
    await browser.close();

    // Kirim PDF
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="buku_acara_${escape(eventBook.namaEvent)
        .replace(/\s+/g, "_")
        .toLowerCase()}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Gagal menghasilkan PDF:", error);
    res
      .status(500)
      .json({ message: "Terjadi kesalahan saat membuat PDF", error: error.message });
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
