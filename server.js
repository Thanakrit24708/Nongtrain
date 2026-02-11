import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors"; // 1. เพิ่มบรรทัดนี้

dotenv.config();
const app = express();

app.use(cors()); // 2. เพิ่มบรรทัดนี้ (สำคัญมาก! เพื่อให้หน้าเว็บคุยกับ Server ได้)
app.use(express.json());
app.use(express.static("public"));

// ==========================================
// API Chat
// ==========================================
app.post("/api/chat", async (req, res) => {
  console.log("----------------------------------------");
  console.log("🔵 1. เริ่มต้น Request Chat");
  
  try {
    const { message, user } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    // ใช้ Model ที่เสถียรและเร็ว (Gemini 1.5 Flash)
    const MODEL_NAME = "gemini-flash-latest"; 
    
    console.log(`🔵 2. กำลังยิงไปที่ Model: ${MODEL_NAME}`);

// ... ใน server.js    // Prompt สั่งให้ AI ส่งกลับเป็น JSON
    const prompt = `
      บทบาท: คุณคือโค้ชฟิตเนสชื่อ NONGTRAIN
      ผู้ใช้: ${user.name}, เป้าหมาย: ${user.goal}, น้ำหนัก: ${user.weight}, ความสูง: ${user.height}, อายุ: ${user.age}
      คำถาม: "${message}"
      ตอบสั้นๆ เป็นกันเอง ให้กำลังใจ:
    `;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await response.json();

    if (data.error) {
        console.error("Google Error:", data.error);
        return res.json({ reply: `❌ Error: ${data.error.message}` });
    }

    let replyText = "AI ไม่ตอบสนอง";
    if (data.candidates && data.candidates.length > 0) {
        const candidate = data.candidates[0];
        if (candidate.content && candidate.content.parts) {
            replyText = candidate.content.parts[0].text;
        }
    }

    console.log("✅ ส่งคำตอบกลับไปหน้าเว็บ:", replyText);
    res.json({ reply: replyText });

  } catch (error) {
    console.error("🔴 Server Crash:", error);
    res.status(500).json({ reply: "Server Error" });
  }
});

// ==========================================
// API Recommend Food
// ==========================================
app.post("/api/recommend-food", async (req, res) => {
  console.log("----------------------------------------");
  console.log("🥗 1. ขอเมนูอาหารแนะนำ");

  try {
    const { user } = req.body; 
    const apiKey = process.env.GEMINI_API_KEY;
    const MODEL_NAME = "gemini-flash-latest"; 

    const prompt = `
      บทบาท: นักโภชนาการส่วนตัว
      ผู้ใช้: ${user.name}, เป้าหมาย: ${user.goal}
      
      โจทย์: แนะนำอาหาร 3 มื้อ (เช้า, กลางวัน, เย็น) และ 1 ของว่าง สำหรับวันนี้
      เงื่อนไขสำคัญ: 
      1. ขอเมนูที่หาทานง่ายในไทย หรือทำง่ายๆ
      2. ตอบกลับมาเป็น JSON Format เท่านั้น ไม่ต้องมีคำนำ
      3. โครงสร้าง JSON ต้องเป็น Array ดังนี้:
      [
        { 
          "meal": "มื้อเช้า", 
          "menu": "ชื่อเมนู", 
          "calories": "จำนวนแคล", 
          "desc": "คำบรรยายสั้นๆ", 
          "image_keyword": "keyword ภาษาอังกฤษสำหรับค้นหารูป",
          "ingredients": "วัตถุดิบ1, วัตถุดิบ2, วัตถุดิบ3",
          "howto": "วิธีทำแบบย่อ..."
        }
      ]
    `;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await response.json();
    
    if (data.error) {
        console.error("Google Error:", data.error);
        return res.json({ recommendations: [], error: data.error.message });
    }
    
    let recommendations = [];
    if (data.candidates && data.candidates[0].content) {
        let text = data.candidates[0].content.parts[0].text;
        // ล้าง format markdown ออก เพื่อแปลงเป็น JSON
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();
        try {
            recommendations = JSON.parse(text);
        } catch (e) {
            console.log("Parse Error, sending raw text");
        }
    }

    res.json({ recommendations });

  } catch (error) {
    console.error("🔴 Error:", error);
    res.status(500).json({ reply: "Server Error" });
  }
});

app.listen(3000, () => console.log("🚀 Server Ready at http://localhost:3000"));