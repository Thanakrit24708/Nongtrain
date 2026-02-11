import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
console.log("🔑 Checking API Key:", apiKey ? "Found" : "Not Found");

async function checkModels() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.models) {
      console.log("\n✅ รายชื่อ Model ที่คุณใช้ได้:");
      // กรองเอาเฉพาะตัวที่ชื่อว่า gemini และใช้ generateContent ได้
      const available = data.models.filter(m => 
        m.name.includes("gemini") && 
        m.supportedGenerationMethods.includes("generateContent")
      );
      
      available.forEach(m => {
        console.log(`👉 ${m.name.replace("models/", "")}`);
      });
      
      console.log("\n(ให้เลือกชื่อใดชื่อหนึ่งด้านบน ไปใส่ใน server.js)");
    } else {
      console.log("❌ Error:", data);
    }
  } catch (error) {
    console.error("Connection Error:", error);
  }
}

checkModels();