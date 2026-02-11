/* สูตรคำนวณพื้นฐาน (แบบจำนวนเต็ม ไม่มีทศนิยม) */

function calcBMR(weight, height, age) {
  // สูตร Mifflin-St Jeor (ใช้ Math.round ปัดเศษ)
  return Math.round(10 * weight + 6.25 * height - 5 * age + 5);
}

function calcTDEE(bmr) {
  // Activity Level ปานกลาง * 1.55 แล้วปัดเศษ
  return Math.round(bmr * 1.55);
}

function calcTargetCalories(tdee, goal) {
  let target = tdee;
  if (goal === 'cut') target = tdee - 500;
  if (goal === 'bulk') target = tdee + 500;
  
  // ปัดเศษเพื่อความชัวร์
  return Math.round(target);
}

function calcMacros(weight, calories) {
  // Protein: 2g ต่อน้ำหนักตัว
  const protein = weight * 2; 
  
  // Fat: 30% ของแคลอรี่รวม (หาร 9 kcal/g)
  const fat = (calories * 0.30) / 9;
  
  // Carb: พลังงานที่เหลือ (หาร 4 kcal/g)
  const carb = (calories - (protein * 4) - (fat * 9)) / 4;
  
  // ส่งค่ากลับแบบปัดเศษทั้งหมด
  return { 
    protein: Math.round(protein), 
    carb: Math.round(carb), 
    fat: Math.round(fat) 
  };
}