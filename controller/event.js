const { json } = require('express');
const pool = require('../config/db'); // Import pool koneksi database
const axios = require('axios');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs/promises'); 
const ExcelJS = require("exceljs");
require('dotenv').config(); // Memuat variabel lingkungan dari .env


// Fungsi ini tampaknya tidak digunakan di dalam modul event, tapi saya simpan agar kode lengkap
function assignLaneAndHeat(swimmers, lanesPerHeat = 8) {
  const heats = [];
  let currentHeat = [];
  let heatNumber = 1;

  swimmers.forEach((swimmer, index) => {
    // Tentukan lane (1 - lanesPerHeat)
    const lane = (index % lanesPerHeat) + 1;

    // Tambahkan data lane ke swimmer
    const swimmerWithLane = {
      ...swimmer,
      lane,
      heat: heatNumber,
    };

    currentHeat.push(swimmerWithLane);

    // Kalau heat sudah penuh -> push ke heats dan reset
    if (lane === lanesPerHeat || index === swimmers.length - 1) {
      heats.push({
        heatNumber,
        swimmers: currentHeat,
      });
      currentHeat = [];
      heatNumber++;
    }
  });

  return heats;
}

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
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW());`,
         [title, event_date, location, description, registration_start_date, registration_end_date, event_status]
      
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


    // Periksa apakah set hasil pertama ada dan tidak kosong
    if (rows && rows[0] && rows[0].length > 0) {
      const eventData = rows[0][0]; // Ambil baris pertama dari set hasil pertama

    
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

getStartList : async (req, res) => {
  try {
    const eventId = Number(req.params.event_id || req.query.event_id || req.body.event_id);
    if (!Number.isInteger(eventId)) {
      return res.status(400).json({ message: 'eventId tidak valid' });
    }

    // Ambil data dasar peserta per lomba
    const [rows] = await pool.execute(`
      SELECT 
        rc.id AS race_id,
        rc.race_number,
        rc.distance,
        rc.swim_style,
        rc.age_group_class,
        rc.gender_category,
        sr.full_name,
        sr.club_name,
        sr.id AS registration_id
      FROM swimmer_events se
      INNER JOIN swimmer_registrations sr ON se.registration_id = sr.id
      INNER JOIN race_categories rc ON se.race_category_id = rc.id
      WHERE sr.event_id = ? AND sr.payment_status IN ('Paid','Success')
      ORDER BY rc.race_number, sr.full_name
    `, [eventId]);

    if (!rows.length) {
      return res.status(200).json({ message: 'Belum ada peserta yang terdaftar.' });
    }

    // Grouping per race
    const startList = {};
    rows.forEach(row => {
      const raceKey = `Acara ${row.race_number} | ${row.distance} ${row.swim_style} ${row.age_group_class} ${row.gender_category}`;
      if (!startList[raceKey]) startList[raceKey] = [];
      startList[raceKey].push({
        registration_id: row.registration_id,
        full_name: row.full_name,
        club_name: row.club_name
      });
    });

    // Tambahkan pembagian ke Seri, Grup, Lintasan
    const formattedStartList = {};
    Object.keys(startList).forEach(raceKey => {
      const swimmers = startList[raceKey];
      const raceResult = [];

      let seriCounter = 1;
      const groupLabels = ['A', 'B', 'C', 'D', 'E', 'F']; // Grup maksimal 6, 4 orang per grup

      // Loop seri, tiap seri max 12 orang (sesuai logika existing)
      const MAX_SWIMMERS_PER_SERI = 9;
      const SWIMMERS_PER_GROUP = 4;

      for (let i = 0; i < swimmers.length; i += MAX_SWIMMERS_PER_SERI) {
        const seriSwimmers = swimmers.slice(i, i + MAX_SWIMMERS_PER_SERI);
        const currentSeriNumber = seriCounter;
        
        let groupIndex = 0;

        // Loop grup (4 orang per grup)
        for (let j = 0; j < seriSwimmers.length; j += SWIMMERS_PER_GROUP) {
          const groupSwimmers = seriSwimmers.slice(j, j + SWIMMERS_PER_GROUP);
          const currentGroupLabel = groupLabels[groupIndex] || "-";
          
          // Hitung offset lane: j=0 -> 0 (start lane 1), j=4 -> 4 (start lane 5), j=8 -> 8 (start lane 9)
          const laneOffset = j; 

          groupSwimmers.forEach((swimmer, laneIdx) => {
            raceResult.push({
              seri: currentSeriNumber,
              group: currentGroupLabel,
              // Lane (Lintasan) dihitung berurutan dari 1 sampai MAX_SWIMMERS_PER_SERI
              lane: laneIdx + 1 + laneOffset, 
              full_name: swimmer.full_name,
              club_name: swimmer.club_name,
              qet: '',   // kolom kosong untuk panitia
              hasil: ''  // kolom kosong untuk panitia
            });
          });

          groupIndex++;
        }

        seriCounter++;
      }

      formattedStartList[raceKey] = raceResult;
    });

    return res.status(200).json({
      code: 200,
      message: 'Start List berhasil di-generate.',
      event_id: eventId,
      startList: formattedStartList
    });

  } catch (err) {
    console.error('Error getStartList:', err);
    res.status(500).json({ message: 'Terjadi kesalahan server.', detail: err.message });
  }
},

// Algoritma baru 
// getStartList : async (req, res) => {
//   try {
//     const eventId = Number(req.params.event_id || req.query.event_id || req.body.event_id);
//     if (!Number.isInteger(eventId)) {
//       return res.status(400).json({ message: 'eventId tidak valid' });
//     }

//     // Ambil data dasar peserta per lomba
//     const [rows] = await pool.execute(`
//       SELECT 
//         rc.id AS race_id,
//         rc.race_number,
//         rc.distance,
//         rc.swim_style,
//         rc.age_group_class,
//         rc.gender_category,
//         sr.full_name,
//         sr.club_name,
//         sr.date_of_birth, -- Tambahkan kolom tanggal lahir
//         sr.id AS registration_id
//       FROM swimmer_events se
//       INNER JOIN swimmer_registrations sr ON se.registration_id = sr.id
//       INNER JOIN race_categories rc ON se.race_category_id = rc.id
//       WHERE sr.event_id = ? AND sr.payment_status IN ('Paid','Success')
//       ORDER BY rc.race_number, sr.full_name
//     `, [eventId]);

//     if (!rows.length) {
//       return res.status(200).json({ message: 'Belum ada peserta yang terdaftar.' });
//     }

//     // Grouping per race
//     const startList = {};
//     rows.forEach(row => {
//       const raceKey = `Acara ${row.race_number} | ${row.distance} ${row.swim_style} ${row.age_group_class} ${row.gender_category}`;
//       if (!startList[raceKey]) startList[raceKey] = [];
//       startList[raceKey].push({
//         registration_id: row.registration_id,
//         full_name: row.full_name,
//         club_name: row.club_name,
//         date_of_birth: row.date_of_birth, // Simpan tanggal lahir
//       });
//     });

//     // Tambahkan pembagian ke Seri, Grup, Lintasan dengan penyebaran klub
//     const formattedStartList = {};
//     Object.keys(startList).forEach(raceKey => {
//       let swimmers = startList[raceKey];

//       // **LANGKAH PENTING 1: PENGURUTAN UNTUK PENYEBARAN KLUB**
//       // Urutkan perenang. Strategi:
//       // 1. Urutkan berdasarkan tanggal lahir tertua ke termuda (descending date_of_birth = ascending age)
//       // 2. Kemudian, urutkan berdasarkan Club Name (untuk mengelompokkan klub)
//       swimmers.sort((a, b) => {
//         // Urutan 1: Tanggal Lahir (tertua (paling awal) duluan)
//         const dateA = new Date(a.date_of_birth);
//         const dateB = new Date(b.date_of_birth);
//         if (dateA.getTime() !== dateB.getTime()) {
//           return dateA.getTime() - dateB.getTime(); // Tertua duluan
//         }
//         // Urutan 2: Club Name (Alphabetical)
//         return a.club_name.localeCompare(b.club_name);
//       });
      
//       // **LANGKAH PENTING 2: ALGORITMA PENYEBARAN ZIG-ZAG**
//       // Ambil daftar perenang yang sudah diurutkan (misal: 120 perenang).
//       // Bagi perenang ini menjadi N blok, di mana N adalah jumlah Seri.
//       // Ambil perenang secara bergantian (misal: Swimmer 1, 11, 21, 31, ... lalu 2, 12, 22, 32, ...)
//       // Ini memastikan perenang dari klub yang sama/usia yang sama tersebar di Seri yang berbeda.
      
//       const MAX_SWIMMERS_PER_SERI = 12;
//       const numSeries = Math.ceil(swimmers.length / MAX_SWIMMERS_PER_SERI);
//       const dispersedSwimmers = [];

//       for (let i = 0; i < MAX_SWIMMERS_PER_SERI; i++) {
//           for (let s = 0; s < numSeries; s++) {
//               const index = i + s * MAX_SWIMMERS_PER_SERI;
//               if (index < swimmers.length) {
//                   dispersedSwimmers.push(swimmers[index]);
//               }
//           }
//       }
      
//       swimmers = dispersedSwimmers;
      
//       // **LANGKAH PENTING 3: PEMBAGIAN KE SERI, GRUP, LINTASAN (Seri sudah tersebar)**
      
//       const raceResult = [];
//       let seriCounter = 1;
//       const groupLabels = ['A', 'B', 'C', 'D', 'E', 'F']; 
//       const SWIMMERS_PER_GROUP = 4;

//       for (let i = 0; i < swimmers.length; i += MAX_SWIMMERS_PER_SERI) {
//         const seriSwimmers = swimmers.slice(i, i + MAX_SWIMMERS_PER_SERI);
//         const currentSeriNumber = seriCounter;
        
//         let groupIndex = 0;

//         // Loop grup (4 orang per grup)
//         for (let j = 0; j < seriSwimmers.length; j += SWIMMERS_PER_GROUP) {
//           const groupSwimmers = seriSwimmers.slice(j, j + SWIMMERS_PER_GROUP);
//           const currentGroupLabel = groupLabels[groupIndex] || "-";
          
//           // Hitung offset lane: j=0 -> 0 (start lane 1), j=4 -> 4 (start lane 5), j=8 -> 8 (start lane 9)
//           const laneOffset = j; 

//           groupSwimmers.forEach((swimmer, laneIdx) => {
//             raceResult.push({
//               seri: currentSeriNumber,
//               group: currentGroupLabel,
//               // Lane (Lintasan) dihitung berurutan dari 1 sampai MAX_SWIMMERS_PER_SERI
//               lane: laneIdx + 1 + laneOffset, 
//               full_name: swimmer.full_name,
//               club_name: swimmer.club_name,
//               qet: '',   // kolom kosong untuk panitia
//               hasil: ''  // kolom kosong untuk panitia
//             });
//           });

//           groupIndex++;
//         }

//         seriCounter++;
//       }

//       formattedStartList[raceKey] = raceResult;
//     });

//     return res.status(200).json({
//       code: 200,
//       message: 'Start List berhasil di-generate dengan penyebaran klub.',
//       event_id: eventId,
//       startList: formattedStartList
//     });

//   } catch (err) {
//     console.error('Error getStartList:', err);
//     res.status(500).json({ message: 'Terjadi kesalahan server.', detail: err.message });
//   }
// },
 generateEventBookPdf : async (req, res) => {
  try {
    const { eventId } = req.body;
    if (!eventId) {
      return res.status(400).json({ message: "eventId harus disediakan di body request." });
    }

    // Ambil data header event
    const [eventRows] = await pool.execute(
      "SELECT title, event_date, location FROM events WHERE id = ?",
      [eventId]
    );
    if (!eventRows.length) {
      return res.status(404).json({ message: "Event tidak ditemukan." });
    }
    const eventData = eventRows[0];

    // Ambil Start List lewat API internal
    const apiResponse = await axios.get(`${process.env.URL_API}/oceantic/v1/getStartList/${eventId}`);
    const startList = apiResponse?.data?.startList;

    if (!startList || Object.keys(startList).length === 0) {
      return res.status(404).json({ message: "Belum ada peserta yang terdaftar." });
    }

    // Bangun HTML
    let htmlContent = `
      <html>
      <head>
        <title>Buku Acara ${eventData.title}</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 12px; }
          h1, h3 { text-align: center; margin: 0; }
          h1 { font-size: 20px; margin-bottom: 5px;}
          h3 { font-size: 14px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
          th, td { 
            border: 1px solid #000; 
            padding: 6px; 
            text-align: center; 
            font-size: 11px; 
            vertical-align: top; 
          }
          th { background: #f2f2f2; }
          .race-title { 
            margin-top: 30px; 
            font-size: 14px; 
            font-weight: bold; 
            text-align: left; 
            padding-bottom: 5px; 
            border-bottom: 2px solid #000;
          }
          .seri-header {
            font-weight: bold; 
            margin-top: 10px; 
            margin-bottom: 5px; 
            background: #DDDDDD; 
            padding: 4px 6px; 
            text-align: left; 
            border: 1px solid #000;
          }
        </style>
      </head>
      <body>
        <h1>BUKU ACARA</h1>
        <h1>${eventData.title}</h1>
        <h3>${new Date(eventData.event_date).toLocaleDateString("id-ID")} - ${eventData.location}</h3>
    `;
    
    // Variabel untuk menampung semua konten tabel yang sudah diolah per Seri
    let tableContent = '';

    Object.entries(startList).forEach(([raceKey, swimmers]) => {
      // Judul Acara sebagai sub-heading
      tableContent += `<div class="race-title">${raceKey}</div>`;
      
      // Grouping per Seri dan Grup
      let structuredData = {};
      swimmers.forEach(swimmer => {
        const seriKey = swimmer.seri;
        const groupKey = swimmer.group;

        if (!structuredData[seriKey]) structuredData[seriKey] = {};
        if (!structuredData[seriKey][groupKey]) structuredData[seriKey][groupKey] = [];
        structuredData[seriKey][groupKey].push(swimmer);
      });

      // Render data Seri demi Seri (Seri sebagai header, bukan kolom)
      Object.entries(structuredData).forEach(([seri, groupMap]) => {
        // 1. Seri Header (Sub-header Acara)
        tableContent += `
          <div class="seri-header">
            Seri ${seri}
          </div>
        `;
        
        // 2. Table Start dengan 6 Kolom
        tableContent += `
            <table>
              <thead>
                <tr>
                  <th>Grup</th> <!-- Seri Dihapus dari Header -->
                  <th>Lint</th>
                  <th>Nama Perenang</th>
                  <th>Asal Club</th>
                  <th>QET</th>
                  <th>Hasil</th>
                </tr>
              </thead>
              <tbody>
        `;

        // 3. Group and Swimmer Rows
        Object.entries(groupMap).forEach(([group, swimmerList]) => {
          // Hitung rowspan untuk kolom Grup
          const groupRowspan = swimmerList.length;
          let groupPrinted = false;
          
          swimmerList.forEach((swimmer) => {
            tableContent += "<tr>";

            // Cetak Grup sekali dengan rowspan grup (Kolom A)
            if (!groupPrinted) {
              tableContent += `<td rowspan="${groupRowspan}" style="font-weight: bold; background: #F2F2F2; vertical-align: middle;">${group}</td>`;
              groupPrinted = true;
            }

            // Kolom lainnya (Lint, Nama, Klub, QET, Hasil)
            tableContent += `
              <td>${swimmer.lane || ""}</td>
              <td style="text-align: left;">${swimmer.full_name}</td>
              <td style="text-align: left;">${swimmer.club_name}</td>
              <td>${swimmer.qet || ""}</td>
              <td>${swimmer.hasil || ""}</td>
            `;
            tableContent += "</tr>";
          });
        });
        
        // 4. Table End
        tableContent += `</tbody></table>`;
      });
      
    });

    htmlContent += tableContent; // Gabungkan semua konten tabel dan Seri
    htmlContent += `</body></html>`;

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
      `attachment; filename="buku_acara_${eventData.title.replace(/\s+/g, "_").toLowerCase()}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Gagal menghasilkan PDF:", error);
    res.status(500).json({ message: "Terjadi kesalahan saat membuat PDF", error: error.message });
  }
},

 generateEventBookExcel : async (req, res) => {
  
  try {
    const { eventId } = req.body;
    if (!eventId) {
      return res.status(400).json({ message: "eventId harus disediakan." });
    }

    // Ambil data event
    const [eventRows] = await pool.execute(
      "SELECT title, event_date, location FROM events WHERE id = ?",
      [eventId]
    );
    if (!eventRows.length) {
      return res.status(404).json({ message: "Event tidak ditemukan." });
    }
    const eventData = eventRows[0];

    // Ambil startlist
    const apiResponse = await axios.get(
      `${process.env.URL_API}/oceantic/v1/getStartList/${eventId}`
    );
    const startList = apiResponse?.data?.startList;

    if (!startList || Object.keys(startList).length === 0) {
      return res.status(404).json({ message: "Belum ada peserta yang terdaftar." });
    }

    // Buat workbook & sheet
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Start List");

    // Total lebar kolom sekarang 6 (A-F), disesuaikan
    const MAX_COL = 'F';

    // Header event
    sheet.mergeCells(`A1:${MAX_COL}1`);
    sheet.getCell("A1").value = eventData.title;
    sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
    sheet.getCell("A1").font = { size: 16, bold: true };

    sheet.mergeCells(`A2:${MAX_COL}2`);
    sheet.getCell("A2").value = `${new Date(eventData.event_date).toLocaleDateString("id-ID")} - ${eventData.location}`;
    sheet.getCell("A2").alignment = { horizontal: "center" };

    let rowPointer = 4; // Baris awal data

    // Loop tiap race
    Object.entries(startList).forEach(([raceKey, swimmers]) => {
      // 1. Judul Race (Sesuai Gambar)
      sheet.mergeCells(`A${rowPointer}:${MAX_COL}${rowPointer}`);
      sheet.getCell(`A${rowPointer}`).value = raceKey;
      sheet.getCell(`A${rowPointer}`).font = { bold: true };
      sheet.getCell(`A${rowPointer}`).alignment = { horizontal: 'left' };
      rowPointer++;

      // 2. Data Population and Merging
      // Grouping per Seri dan Grup
      let structuredData = {};
      swimmers.forEach(swimmer => {
          const seriKey = swimmer.seri;
          const groupKey = swimmer.group;

          if (!structuredData[seriKey]) structuredData[seriKey] = {};
          if (!structuredData[seriKey][groupKey]) structuredData[seriKey][groupKey] = [];
          structuredData[seriKey][groupKey].push(swimmer);
      });

      // Render the structured data
      Object.entries(structuredData).forEach(([seri, groupMap]) => {
          // === NEW: Add Seri Header as sub-heading (Merge A:F) ===
          sheet.mergeCells(`A${rowPointer}:${MAX_COL}${rowPointer}`);
          sheet.getCell(`A${rowPointer}`).value = `Seri ${seri}`;
          sheet.getCell(`A${rowPointer}`).font = { bold: true, size: 12 };
          sheet.getCell(`A${rowPointer}`).alignment = { horizontal: 'left', vertical: 'middle' };
          sheet.getCell(`A${rowPointer}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDDDDD' } };
          
          rowPointer++;
          // ========================================================

          // 3. Header Utama (Hanya 6 kolom: Grup, Lint, Nama, Club, QET, Hasil)
          // Header ini diulang di setiap Seri sesuai format Excel di gambar
          const mainHeaderRow = sheet.addRow([
              "Grup", // A
              "Lint", // B
              "Nama Perenang", // C
              "Asal Club", // D
              "QET", // E
              "Hasil", // F
          ]);
          mainHeaderRow.font = { bold: true };
          mainHeaderRow.eachCell(cell => {
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
              cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6E6' } };
          });
          rowPointer++; 

          
          Object.entries(groupMap).forEach(([group, swimmerList]) => {
              // Find the start row for this group merge
              const groupStartRow = rowPointer; 

              swimmerList.forEach((swimmer) => {
                  const currentRow = sheet.addRow([
                      group,                   // A: Grup (for merging)
                      swimmer.lane || "",      // B: Lintasan
                      swimmer.full_name,       // C: Nama Perenang
                      swimmer.club_name,       // D: Asal Club
                      swimmer.qet || "",       // E: QET
                      swimmer.hasil || ""      // F: Hasil
                  ]);
                  
                  // Apply styling to data rows
                  currentRow.eachCell((cell, colNumber) => {
                      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                      // Kolom 2 sampai 6 (B:F) rata tengah
                      if (colNumber >= 2) cell.alignment = { horizontal: 'center' }; 
                      // Nama (C) dan Klub (D) rata kiri
                      if (colNumber === 3 || colNumber === 4) cell.alignment = { horizontal: 'left' };
                      // Kolom Grup (A) harus rata tengah vertikal
                      if (colNumber === 1) cell.alignment = { vertical: 'middle', horizontal: 'center' };
                  });

                  rowPointer++;
              });

              // Apply Merging for the Group (Column A)
              const groupEndRow = rowPointer - 1;
              if (groupStartRow !== groupEndRow) {
                  sheet.mergeCells(`A${groupStartRow}:A${groupEndRow}`);
              }
              // Set value dan style untuk Grup di sel awal
              sheet.getCell(`A${groupStartRow}`).value = group;
              sheet.getCell(`A${groupStartRow}`).font = { bold: true };
              sheet.getCell(`A${groupStartRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }; 
          });
      });
      
      rowPointer = sheet.lastRow.number + 2; // Beri jarak 1 baris antar race
    });

    // Autofit kolom (Disesuaikan untuk 6 kolom)
    sheet.columns.forEach(col => {
      let maxLength = 0;
      col.eachCell({ includeEmpty: true }, cell => {
        const length = cell.value ? cell.value.toString().length : 10;
        if (length > maxLength) maxLength = length;
      });
      // Beri batas min/max lebar untuk kolom tertentu
      const columnIndex = col.number;
      if (columnIndex === 3) { // Nama Perenang (Kolom C)
        col.width = maxLength < 30 ? 30 : maxLength;
      } else if (columnIndex === 4) { // Asal Club (Kolom D)
        col.width = maxLength < 20 ? 20 : maxLength;
      } else {
        col.width = maxLength < 10 ? 10 : maxLength + 2;
      }
      
    });

    // Kirim response Excel
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=startlist_${eventData.title.replace(/\s+/g, "_")}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error("Gagal generate Excel:", error);
    res.status(500).json({ message: "Terjadi kesalahan saat membuat Excel", error: error.message });
  }
},
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

    // Tambahkan updated_at
    fields.push('updated_at = NOW()');

    const query = `UPDATE events SET ${fields.join(', ')} WHERE id = ?`;
    values.push(id); // Tambahkan ID ke akhir array values

    const [result] = await pool.execute(query, values);

    if (result.affectedRows === 0) {
      // Cek apakah event ditemukan (ID valid) atau hanya tidak ada perubahan
      const [checkRows] = await pool.execute('SELECT id FROM events WHERE id = ?', [id]);
      if (checkRows.length === 0) {
        return res.status(404).json({ message: 'Event tidak ditemukan.' });
      } else {
        return res.status(200).json({ message: 'Event berhasil diperbarui, namun tidak ada data yang diubah.' });
      }
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
