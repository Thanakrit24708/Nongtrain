/* =========================================
   GLOBAL VARIABLES & CONFIG
   ========================================= */
let user = JSON.parse(localStorage.getItem("user")) || null;
let weights = JSON.parse(localStorage.getItem("weights")) || [];
let foods = JSON.parse(localStorage.getItem("foods")) || [];
let waterLog = JSON.parse(localStorage.getItem("waterLog")) || { date: "", count: 0 };
let exercises = JSON.parse(localStorage.getItem("exercises")) || []; // [New]
let shoppingList = JSON.parse(localStorage.getItem("shoppingList")) || []; // [New]
let fastingStartTime = localStorage.getItem("fastingStartTime") || null; // [New]
let chart = null;

// URL ของ Backend (ต้องตรงกับ port ที่รัน node server.js)
const API_BASE_URL = "http://localhost:3000";

/* =========================================
   HELPER: EXERCISE PLAN
   ========================================= */
function getExercisePlan(goal) {
   if (goal === "cut") {
       return { cardio: 40, weight: 20, desc: "เน้น Cardio เพื่อเบิร์นไขมันคู่กับเวท" };
   } else if (goal === "bulk") {
       return { cardio: 15, weight: 45, desc: "เน้น Weight Training สร้างกล้ามเนื้อ" };
   } else {
       return { cardio: 30, weight: 30, desc: "เดินทางสายกลาง เพื่อสุขภาพที่ดี" };
   }
}

/* =========================================
   INITIALIZATION
   ========================================= */
document.addEventListener("DOMContentLoaded", () => {
  // 1. เช็คว่าเคยมี User หรือยัง
  if (user) {
    initApp();
  } else {
    showTab("onboarding");
    nextStep(1);
  }

  // 2. Event Listener สำหรับแบบฟอร์มเริ่มต้น
  const setupForm = document.getElementById("setupForm");
  if (setupForm) {
    setupForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("setup-name").value;
      const gender = document.querySelector('input[name="gender"]:checked').value;
      const age = Number(document.getElementById("setup-age").value);
      const height = Number(document.getElementById("setup-height").value);
      const weight = Number(document.getElementById("setup-weight").value);
      
      const activity = Number(document.getElementById("setup-activity").value);
      const goal = document.getElementById("setup-goal").value;
      
      const targetWeight = Number(document.getElementById("setup-target-weight").value) || weight;
      const weeks = Number(document.getElementById("setup-weeks").value) || 12;

      // 1. Calculate BMR (Mifflin-St Jeor)
      let bmr;
      if (gender === 'male') {
        bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
      } else {
        bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
      }

      // 2. Calculate TDEE (Total Daily Energy Expenditure)
      let tdee = bmr * activity;

      // 3. Calculate Target Calories based on Goal & Timeline
      let targetCalories = tdee;
      let dailyDiff = 0;

      if (goal === "cut") {
        // คำนวณว่าต้องลดกี่กิโล
        const weightDiff = weight - targetWeight;
        if(weightDiff > 0) {
            // 1 kg ไขมัน ~= 7700 kcal
            const totalCalsToBurn = weightDiff * 7700;
            const days = weeks * 7;
            const deficitPerDay = totalCalsToBurn / days;
            
            // Limit safety: ไม่ควรลดเกิน 1000 kcal หรือกินต่ำกว่า BMR มากเกินไป
            dailyDiff = -deficitPerDay;
            if(dailyDiff < -1000) dailyDiff = -1000; // Cap at -1000 deficit
        } else {
            dailyDiff = -300; // Default mild deficit
        }
      } else if (goal === "bulk") {
         dailyDiff = 300; // Surplus
      }

      targetCalories = tdee + dailyDiff;

      // Safety Floor: ผู้ชายไม่ควรต่ำกว่า 1500, ผู้หญิง 1200
      let minCal = (gender === 'male') ? 1500 : 1200;
      if(targetCalories < minCal && goal === 'cut') {
          targetCalories = minCal; // บังคับไม่ให้ต่ำกว่าเกณฑ์สุขภาพ
      }

      // Macros Calculation
      let ratio = { p: 0.3, c: 0.4, f: 0.3 };
      if (goal === "cut") ratio = { p: 0.4, c: 0.35, f: 0.25 };
      if (goal === "bulk") ratio = { p: 0.3, c: 0.45, f: 0.25 };

      const macros = {
        protein: Math.round((targetCalories * ratio.p) / 4),
        carb: Math.round((targetCalories * ratio.c) / 4),
        fat: Math.round((targetCalories * ratio.f) / 9)
      };

      user = { 
          name, gender, age, height, weight, activity,
          goal, targetWeight, weeks,
          bmr: Math.round(bmr), 
          tdee: Math.round(tdee), 
          targetCalories: Math.round(targetCalories), 
          targetCalories: Math.round(targetCalories), 
          macros,
          exercisePlan: getExercisePlan(goal) 
      };
      
      localStorage.setItem("user", JSON.stringify(user));
      
      // Update Weights Array too
      weights.push({ date: new Date().toLocaleDateString("th-TH"), weight: weight });
      localStorage.setItem("weights", JSON.stringify(weights));

      initApp();
    });
  }
});

function initApp() {
  document.getElementById("onboarding").classList.add("hidden");
  const nav = document.getElementById("nav");
  if(nav) nav.classList.remove("hidden");
  
  showTab("home");

  document.getElementById("user-name").innerText = user.name;
  const goalMap = { cut: "ลดไขมัน", maintain: "รักษาน้ำหนัก", bulk: "เพิ่มน้ำหนัก" };
  document.getElementById("user-goal").innerText = goalMap[user.goal] || user.goal;

  renderFoodSearchList();
  checkWaterDate();
  updateDashboard();
  drawChart();
  renderProfile();
  
  // Backfill Exercise Plan if missing
  if(!user.exercisePlan) {
      user.exercisePlan = getExercisePlan(user.goal);
      localStorage.setItem("user", JSON.stringify(user));
  }
  
  // [New] Init Features
  updateFastingTimer();
  if(window.fastingInterval) clearInterval(window.fastingInterval);
  window.fastingInterval = setInterval(updateFastingTimer, 1000); // 1 sec tick
  
  // Load AI Food (delay slightly)
  setTimeout(loadAiFood, 1000);
}

/* =========================================
   NAVIGATION
   ========================================= */
function showTab(id) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".nav button").forEach(b => b.classList.remove("active"));
  
  const target = document.getElementById(id);
  if (target) target.classList.add("active");
  
  const btn = document.getElementById(`btn-${id}`);
  if (btn) btn.classList.add("active");

  const header = document.getElementById("main-header");
  if (header) {
    header.style.display = (id === 'account' || id === 'chat') ? 'none' : 'flex';
  }
  if (id === 'account') renderProfile();
}

function nextStep(step) {
  // Manual Validation for previous step
  const currentStep = step - 1;
  const currentStepEl = document.querySelector(`.onboarding-step[data-step="${currentStep}"]`);
  
  if (currentStepEl) {
    const inputs = currentStepEl.querySelectorAll("input[required], select[required]");
    for (let input of inputs) {
      if (!input.value.trim()) {
        alert("กรุณากรอกข้อมูลให้ครบถ้วนครับ");
        input.focus();
        return; // Stop here
      }
    }
  }

  document.querySelectorAll('.onboarding-step').forEach(s => s.classList.remove('active'));
  const target = document.querySelector(`.onboarding-step[data-step="${step}"]`);
  if (target) target.classList.add('active');
  const progress = (step / 6) * 100;
  const bar = document.getElementById('step-bar');
  if(bar) bar.style.width = `${progress}%`;
}

/* =========================================
   DASHBOARD & CORE LOGIC
   ========================================= */
function updateDashboard() {
  // Date
  const dateObj = new Date();
  const today = dateObj.toLocaleDateString("th-TH");
  document.getElementById("current-date").innerText = dateObj.toLocaleDateString("en-US", { weekday: 'short', day: 'numeric', month: 'short'});

  // 1. Calculate Food (In)
  const todayFoods = foods.filter(f => f.date === today);
  let totals = { cal: 0, p: 0, c: 0, f: 0 };
  todayFoods.forEach(f => {
    totals.cal += f.calories;
    totals.p += f.protein;
    totals.c += f.carb;
    totals.f += f.fat;
  });

  // 2. Calculate Exercise (Out) [New]
  const todayExercises = exercises.filter(e => e.date === today);
  const burned = todayExercises.reduce((sum, e) => sum + e.cal, 0);

  // 3. Net Calories
  const target = user.targetCalories;
  const eaten = totals.cal;
  // Formula: Remaining = Target - Eaten (Exercise doesn't increase quota based on user request)
  const remaining = Math.max(0, target - eaten);
  
  // UI Updates
  document.getElementById("val-cal-remain").innerText = remaining.toLocaleString();
  document.getElementById("val-target").innerText = target.toLocaleString(); 
  document.getElementById("val-eaten").innerText = eaten.toLocaleString();
  
  const elBurned = document.getElementById("val-burned");
  if(elBurned) elBurned.innerText = burned.toLocaleString();
  
  // Update Widget Text
  const textBurned = document.getElementById("text-burned");
  if(textBurned) textBurned.innerText = `${burned} kcal`;

  // Circular Progress
  // Base it on Eaten vs (Target + Burned)
  // const effectiveTarget = target + burned; // REMOVED: Burned doesn't increase quota
  const effectiveTarget = target; // Use base target for circle progress
  const percent = effectiveTarget > 0 ? (eaten / effectiveTarget) * 100 : 0;
  const degree = Math.min(360, percent * 3.6);
  const circle = document.getElementById("cal-circle");
  
  if (circle) {
    let color = "#10b981"; // Emerald
    if (percent > 100) color = "#ef4444"; 
    circle.style.background = `conic-gradient(${color} ${degree}deg, #e2e8f0 ${degree}deg)`;
  }

  // Macros Bars
  const setBar = (type, cur, max) => {
    const elVal = document.getElementById(`val-${type}`);
    const elBar = document.getElementById(`bar-${type}`);
    if(elVal) elVal.innerText = `${Math.round(cur)}/${max}g`;
    if(elBar) {
        const pct = Math.min(100, (cur/max)*100);
        elBar.style.width = `${pct}%`;
    }
  };
  setBar("p", totals.p, user.macros.protein);
  setBar("c", totals.c, user.macros.carb);
  setBar("f", totals.f, user.macros.fat);

  // History List
  const listContainer = document.getElementById("today-food-list");
  const countLabel = document.getElementById("history-count");
  if (listContainer) {
    if (todayFoods.length === 0) {
      listContainer.innerHTML = `<div class="empty-state">วันนี้ยังไม่ได้บันทึกอะไรเลย เริ่มกินกันเถอะ! 😋</div>`;
      if(countLabel) countLabel.innerText = "0 รายการ";
    } else {
      if(countLabel) countLabel.innerText = `${todayFoods.length} รายการ`;
      const html = todayFoods.slice().reverse().map(f => `
        <div class="food-item">
          <div class="food-item-info">
            <span class="food-name">${f.name}</span>
            <span class="food-cal">${f.calories.toLocaleString()} kcal</span>
            <span style="font-size:10px; color:#94a3b8;">P:${f.protein} C:${f.carb} F:${f.fat}</span>
          </div>
          <button class="delete-btn" onclick="deleteFood(${f.id})">
            <span class="material-icons-round">close</span>
          </button>
        </div>
      `).join("");
      listContainer.innerHTML = html;
    }
  }
}

/* =========================================
   FEATURE: EXERCISE TRACKER
   ========================================= */
function openExerciseModal() {
  const plan = user.exercisePlan || getExercisePlan(user.goal);
  const suggestionBox = document.getElementById("exercise-suggestion");
  if(suggestionBox) {
      suggestionBox.style.display = "block";
      suggestionBox.innerHTML = `
        <div style="font-weight:bold; color:#0369a1; margin-bottom:4px;">💡 แผนแนะนำวันนี้</div>
        <div style="color:#0c4a6e;">
          • Cardio: <b>${plan.cardio}</b> นาที<br>
          • Weight: <b>${plan.weight}</b> นาที<br>
          <span style="font-size:10px; color:#64748b; font-style:italic;">"${plan.desc}"</span>
        </div>
      `;
  }
  document.getElementById('exercise-modal').showModal();
}

function saveExercise() {
  const typeEl = document.getElementById('exercise-type');
  const durEl = document.getElementById('exercise-duration');
  const duration = Number(durEl.value);
  
  if(!duration || duration <= 0) return showAlert("ข้อมูลผิดพลาด", "ระบุเวลาให้ถูกต้องนะครับ", "❌");
  
  // Calorie estimates (METs - Metabolic Equivalent of Task)
  const mets = { 
    run: 11.5, walk: 3.8, cycle: 8.0, swim: 8.0, hiit: 11.0, rope: 12.0, dance: 6.0,
    badminton: 6.0, boxing: 10.0, basketball: 8.0, football: 9.0, tennis: 7.0,
    weight: 5.0, yoga: 3.0, pilates: 4.0,
    housework: 3.0, gardening: 4.0
  };
  const type = typeEl.value;
  const met = mets[type] || 5; // Default MET = 5 if unknown

  // Formula: MET * 3.5 * weight / 200 * duration
  const cal = Math.round((met * 3.5 * user.weight / 200) * duration);

  exercises.push({
    id: Date.now(),
    date: new Date().toLocaleDateString("th-TH"),
    type: type,
    name: typeEl.options[typeEl.selectedIndex].text, // Save display name
    duration: duration,
    cal: cal
  });
  
  localStorage.setItem("exercises", JSON.stringify(exercises));
  updateDashboard();
  
  durEl.value = "";
  document.getElementById('exercise-modal').close();
  
  // No success alert, just close and update dashboard
  // console.log("Exercise saved");
}

/* =========================================
   FEATURE: IF TIMER (16/8)
   ========================================= */
function openFastingModal() {
  document.getElementById('fasting-modal').showModal();
  updateFastingTimer();
}

function toggleFasting() {
  const btn = document.getElementById("fasting-btn-action");
  
  if (fastingStartTime) {
    // Stop Fasting
    // Stop Fasting
    showConfirm("หยุด Fasting?", "ต้องการหยุดจับเวลาหรอครับ?", () => {
      fastingStartTime = null;
      localStorage.removeItem("fastingStartTime");
      updateFastingTimer();
    });

  } else {
    // Start Fasting
    fastingStartTime = Date.now();
    localStorage.setItem("fastingStartTime", fastingStartTime);
    updateFastingTimer();
  }
}

function updateFastingTimer() {
  const timerEl = document.getElementById("fasting-timer");
  const labelEl = document.getElementById("fasting-label");
  const btn = document.getElementById("fasting-btn-action");
  const statusEl = document.getElementById("text-fasting-status");
  
  if (!timerEl) return;

  if (!fastingStartTime) {
    timerEl.innerText = "00:00:00";
    labelEl.innerText = "กดเริ่มเพื่อเริ่มนับเวลาอดอาหาร";
    if(btn) btn.innerText = "เริ่ม Fasting";
    if(statusEl) statusEl.innerText = "Ready";
  } else {
    const diff = Date.now() - parseInt(fastingStartTime);
    const seconds = Math.floor((diff / 1000) % 60);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const hours = Math.floor((diff / (1000 * 60 * 60)));
    
    // Check goal (e.g., 16 hours)
    const goalHours = 16;
    const isGoalReached = hours >= goalHours;
    
    timerEl.innerText = `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
    labelEl.innerText = isGoalReached ? "🎉 ครบเวลา Fasting แล้ว! ทานได้เลย" : "กำลัง Fasting... สู้ๆ!";
    if(btn) btn.innerText = "หยุด Fasting";
    if(statusEl) statusEl.innerText = `${hours} ชม.`;
  }
}

/* =========================================
   FEATURE: SHOPPING LIST
   ========================================= */
function toggleShoppingList() {
  const area = document.getElementById("shopping-list-area");
  area.classList.toggle("active");
  renderShoppingList();
}

function addToShoppingList(ingredientsText) {
  // Simple parser: split by comma or newline
  const items = ingredientsText.split(/,|\n/).map(s => s.trim()).filter(s => s.length > 2);
  
  items.forEach(item => {
    if(!shoppingList.find(x => x.name === item)) {
      shoppingList.push({ name: item, checked: false });
    }
  });
  localStorage.setItem("shoppingList", JSON.stringify(shoppingList));
  renderShoppingList();
  
  // Show modal
  const area = document.getElementById("shopping-list-area");
  area.classList.add("active");
}

function renderShoppingList() {
  const container = document.getElementById("shopping-list-items");
  if(!container) return;
  
  if(shoppingList.length === 0) {
    container.innerHTML = "<p style='color:#cbd5e1; font-size:13px;'>ยังไม่มีรายการของที่ต้องซื้อ</p>";
    return;
  }
  
  let html = "";
  shoppingList.forEach((item, index) => {
    html += `
      <div class="checklist-item">
        <input type="checkbox" ${item.checked ? "checked" : ""} onchange="toggleItemCheck(${index})">
        <span style="text-decoration: ${item.checked ? 'line-through' : 'none'}; color:${item.checked ? '#cbd5e1' : '#334155'}">${item.name}</span>
        <button onclick="removeShoppingItem(${index})" style="width:auto; padding:2px 6px; background:none; color:#ef4444; margin-left:auto; box-shadow:none;">x</button>
      </div>
    `;
  });
  container.innerHTML = html;
}

function toggleItemCheck(index) {
  shoppingList[index].checked = !shoppingList[index].checked;
  localStorage.setItem("shoppingList", JSON.stringify(shoppingList));
  renderShoppingList();
}

function removeShoppingItem(index) {
  shoppingList.splice(index, 1);
  localStorage.setItem("shoppingList", JSON.stringify(shoppingList));
  renderShoppingList();
}

/* =========================================
   WATER TRACKER
   ========================================= */
function updateWater(n) {
  waterLog.count = Math.max(0, waterLog.count + n);
  localStorage.setItem("waterLog", JSON.stringify(waterLog));
  document.getElementById("water-count").innerText = waterLog.count;
}

function checkWaterDate() {
  const today = new Date().toLocaleDateString("th-TH");
  if (waterLog.date !== today) {
    waterLog = { date: today, count: 0 };
    localStorage.setItem("waterLog", JSON.stringify(waterLog));
  }
  document.getElementById("water-count").innerText = waterLog.count;
}

/* =========================================
   FOOD MANAGEMENT
   ========================================= */
function renderFoodSearchList() {
  const datalist = document.getElementById("menu-list");
  // Check manual DB first (THAI_FOOD_DB), fallback to existing if present
  let db = (typeof THAI_FOOD_DB !== 'undefined') ? THAI_FOOD_DB : [];
  if (db.length === 0 && typeof thaiFoodDatabase !== 'undefined') db = thaiFoodDatabase;

  if (datalist) {
    let html = "";
    db.forEach(item => {
      html += `<option value="${item.name}">🔥 ${item.cal} kcal</option>`;
    });
    datalist.innerHTML = html;
  }
}

function autoFillFood() {
  const searchName = document.getElementById("food-search").value;
  // Check manual DB first (THAI_FOOD_DB), fallback to existing if present
  let db = (typeof THAI_FOOD_DB !== 'undefined') ? THAI_FOOD_DB : [];
  if (db.length === 0 && typeof thaiFoodDatabase !== 'undefined') db = thaiFoodDatabase;
  const item = db.find(f => f.name === searchName);
  
  if (item) {
    document.getElementById("food-name").value = item.name;
    document.getElementById("food-protein").value = item.p;
    document.getElementById("food-carb").value = item.c;
    document.getElementById("food-fat").value = item.f;
  }
}

function saveFood() {
  const name = document.getElementById("food-name").value || "อาหารทั่วไป";
  const p = Number(document.getElementById("food-protein").value);
  const c = Number(document.getElementById("food-carb").value);
  const f = Number(document.getElementById("food-fat").value);
  
  if(p < 0 || c < 0 || f < 0) return showAlert("ข้อมูลผิดพลาด", "ค่าสารอาหารห้ามติดลบครับ", "❌");

  let cal = (p * 4) + (c * 4) + (f * 9);
  if(cal === 0) return showAlert("เตือน!", "ระบุสารอาหารอย่างน้อย 1 อย่างครับ", "⚠️");

  const newFood = { 
    id: Date.now(),
    date: new Date().toLocaleDateString("th-TH"), 
    name: name,
    protein: p, carb: c, fat: f, calories: cal 
  };

  foods.push(newFood);
  localStorage.setItem("foods", JSON.stringify(foods));
  updateDashboard();
  
  document.getElementById("food-search").value = "";
  document.getElementById("food-name").value = "";
  document.getElementById("food-protein").value = "";
  document.getElementById("food-carb").value = "";
  document.getElementById("food-fat").value = "";
  
  showTab("home");
  
  // No success alert, just switch tab
  // console.log("Food saved");
}

function deleteFood(id) {
  showConfirm("ลบรายการ?", "ต้องการลบรายการนี้ใช่ไหม?", () => {
      foods = foods.filter(f => f.id !== id);
      localStorage.setItem("foods", JSON.stringify(foods));
      updateDashboard();
      showAlert("ลบสำเร็จ", "ลบรายการเรียบร้อยแล้ว", "🗑️");
  });
}

/* =========================================
   WEIGHT TRACKER & CHART
   ========================================= */
function saveWeight() {
  try {
    const input = document.getElementById("dailyWeight");
    const w = Number(input.value);
    
    if(!w || w <= 0 || w > 500) {
      alert("กรุณาระบุน้ำหนักที่ถูกต้อง");
      return;
    }
    
    user.weight = w; 
    localStorage.setItem("user", JSON.stringify(user));
    
    // Ensure weights is array
    if(!Array.isArray(weights)) weights = [];
    
    // Prevent duplicate entries for today? Optional, but let's just push for now
    weights.push({ date: new Date().toLocaleDateString("th-TH"), weight: w });
    localStorage.setItem("weights", JSON.stringify(weights));
    
    // Just redraw chart, no alert to prevent freezing
    drawChart();
    
    // Clear input
    input.value = "";

  } catch(e) {
    console.error("Save Weight Error:", e);
  }
}

function drawChart() {
  try {
    const ctxEl = document.getElementById("weightChart");
    if(!ctxEl || weights.length === 0) return;
    
    // Check if a chart instance already exists on this canvas
    // 1. Check global variable
    if (chart) {
      chart.destroy();
      chart = null;
    }
    
    // 2. Check Chart.js registry/instance on element (Safety)
    const existingChart = Chart.getChart(ctxEl);
    if (existingChart) {
      existingChart.destroy();
    }

    const ctx = ctxEl.getContext("2d");
    
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: weights.map(w => w.date.slice(0,5)),
        datasets: [{
          label: 'น้ำหนัก (kg)',
          data: weights.map(w => w.weight),
          borderColor: '#10b981',
          backgroundColor: gradient,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#10b981',
          pointBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: {display:false} },
        scales: {
          x: { grid: {display:false}, ticks: {font:{size:10}} },
          y: { grid: {color:'rgba(0,0,0,0.05)'}, ticks: {font:{size:10}} }
        }
      }
    });
  } catch(e) {
    console.error("Chart Error:", e);
  }
}

/* =========================================
   FEATURE: SETTINGS & NOTIFICATIONS
   ========================================= */
function openSettings() {
  alert("ระบบกำลังอัปเดตครับ (Coming Soon)");
}

function toggleNotifications(el) {
  const isEnabled = el.checked;
  localStorage.setItem("notifications", isEnabled);
  if(isEnabled) {
     if(Notification.permission !== "granted") {
         Notification.requestPermission().then(permission => {
             if(permission === "granted") {
                 showAlert("เปิดแจ้งเตือน", "เปิดการแจ้งเตือนเรียบร้อยแล้ว ✅");
             } else {
                 el.checked = false; // Revert
                 showAlert("สิทธิ์ไม่ผ่าน", "คุณต้องอนุญาตการแจ้งเตือนใน Browser ก่อนนะ", "⚠️");
             }
         });
     } else {
         showAlert("เปิดแจ้งเตือน", "เปิดการแจ้งเตือนเรียบร้อยแล้ว ✅");
     }
  }
}

function resetData() {
  showConfirm("ล้างข้อมูล?", "ข้อมูลทั้งหมดจะหายไป เริ่มต้นใหม่หมดเลยนะ?", () => {
      localStorage.clear();
      location.reload();
  });
}

function renderProfile() {
  if(!user) return;
  document.getElementById("profile-name").innerText = user.name;
  document.getElementById("profile-avatar").innerText = user.name.substring(0,2).toUpperCase();
  const goalMap = { cut: "Cutting Phase", maintain: "Maintain", bulk: "Bulking Phase" };
  document.getElementById("profile-goal-display").innerText = goalMap[user.goal] || user.goal;
  
  document.getElementById("profile-stats").innerText = `${user.weight}kg / ${user.height}cm / ${user.age}ปี`;
  
  // Calculate BMI
  const heightM = user.height / 100;
  const bmi = (user.weight / (heightM * heightM)).toFixed(1);
  let bmiText = "ปกติ";
  let bmiColor = "#10b981"; // green
  
  if(bmi < 18.5) { bmiText = "ผอมไปนิด"; bmiColor = "#f59e0b"; }
  else if(bmi >= 23 && bmi < 25) { bmiText = "ท้วม"; bmiColor = "#f59e0b"; }
  else if(bmi >= 25 && bmi < 30) { bmiText = "อ้วน"; bmiColor = "#ef4444"; }
  else if(bmi >= 30) { bmiText = "อ้วนมาก"; bmiColor = "#ef4444"; }

  const bmiEl = document.getElementById("profile-bmi");
  if(bmiEl) {
    bmiEl.innerHTML = `<span style="color:${bmiColor}; font-weight:bold;">${bmi} (${bmiText})</span>`;
  }

  document.getElementById("profile-calories").innerText = `TDEE: ${user.tdee} kcal`;
}

function logout() {
  if(confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
      localStorage.clear();
      location.reload();
  }
}

/* =========================================
   CUSTOM UTILS: ALERT & CONFIRM
   ========================================= */
let confirmCallback = null;

function closeModal() {
  const modal = document.getElementById("global-modal");
  if(modal) modal.close();
}

function confirmAction() {
    if(confirmCallback) confirmCallback();
    closeModal();
}

/* =========================================
   FEATURE: SAFE ALERT & POPUP
   ========================================= */
function showAlert(title, msg, icon="✨") {
  try {
      const modal = document.getElementById("global-modal");
      // Fallback if modal doesn't exist or if msg is simple string for alert compatibility (optional)
      if(!modal) {
          alert(`${title}\n${msg.replace(/<[^>]*>/g, '')}`);
          return;
      }
      
      document.getElementById("modal-icon").innerText = icon;
      document.getElementById("modal-title").innerText = title;
      // Use innerHTML to support rich text
      document.getElementById("modal-msg").innerHTML = msg;

      // Show only OK button
      const btnOk = document.getElementById("btn-ok");
      const btnCancel = document.getElementById("btn-cancel");
      const btnYes = document.getElementById("btn-yes");

      if(btnOk) btnOk.style.display = "inline-block";
      if(btnCancel) btnCancel.style.display = "none";
      if(btnYes) btnYes.style.display = "none";

      if (modal.open) {
        // If already open, just update content. No need to call showModal().
        return; 
      }
      
      modal.showModal();
  } catch(e) {
      console.error("Show Alert Error:", e);
      // Fallback to native alert
      alert(`${title}\n${msg.replace(/<[^>]*>/g, '')}`);
  }
}

/* =========================================
   FEATURE: STAT DETAILS (POPUP)
   ========================================= */
function showQuotaDetails() {
  const dateObj = new Date();
  const today = dateObj.toLocaleDateString("th-TH");
  const todayExercises = exercises.filter(e => e.date === today);
  const burned = todayExercises.reduce((sum, e) => sum + e.cal, 0);
  const base = user.targetCalories;
  
  // Calculate Eaten for display
  const todayFoods = foods.filter(f => f.date === today);
  const eaten = todayFoods.reduce((sum, f) => sum + f.calories, 0);
  
  const html = `
    <div style="text-align:center; padding:10px 0;">
        <div style="font-size:32px; font-weight:bold; color:var(--text-main); margin-bottom:5px;">
            ${(Math.max(0, base-eaten)).toLocaleString()} <span style="font-size:16px; color:#94a3b8;">kcal</span>
        </div>
        <div style="font-size:14px; color:#64748b; margin-bottom:15px;">โควต้าคงเหลือ (จากเป้าหมาย ${base})</div>
        
        <div style="background:#f8fafc; padding:15px; border-radius:12px; margin-top:10px;">
             <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                <span style="color:#64748b;">เป้าหมาย</span>
                <span style="font-weight:bold;">${base.toLocaleString()}</span>
            </div>
            <div style="display:flex; justify-content:space-between; color:#ef4444; margin-bottom:8px;">
                <span>- กินไปแล้ว</span>
                <span style="font-weight:bold;">${eaten.toLocaleString()}</span>
            </div>
             <hr style="margin:8px 0; border-top:1px dashed #cbd5e1;">
             <div style="display:flex; justify-content:space-between; color:#10b981;">
                <span>🔥 เบิร์นได้</span>
                <span style="font-weight:bold;">${burned.toLocaleString()}</span>
            </div>
            <div style="font-size:10px; color:#94a3b8; text-align:right; margin-top:2px;">(ไม่นำไปเพิ่มในโควต้า)</div>
        </div>
    </div>
  `;
  
  showAlert("📊 รายละเอียดโควต้า", html, "🎯");
}

function showInDetails() {
  const dateObj = new Date();
  const today = dateObj.toLocaleDateString("th-TH");
  const todayFoods = foods.filter(f => f.date === today);
  
  if(todayFoods.length === 0) return showAlert("ยังไม่เริ่มกิน", "วันนี้ยังไม่ได้บันทึกอะไรเลยนะ ไปหาอะไรอร่อยๆ กินกันเถอะ! 😋", "🍽️");
  
  let totals = { cal: 0, p: 0, c: 0, f: 0 };
  todayFoods.forEach(f => {
    totals.cal += f.calories;
    totals.p += f.protein;
    totals.c += f.carb;
    totals.f += f.fat;
  });
  
  const html = `
    <div style="text-align:center;">
        <div style="font-size:24px; font-weight:bold; color:var(--accent); margin-bottom:15px;">
            ${totals.cal.toLocaleString()} kcal
        </div>
        
        <div style="display:flex; justify-content:center; gap:15px;">
            <div class="macro-card-airy" style="width:80px;">
                <span style="color:#f43f5e; font-weight:bold;">Pro</span>
                <div>${totals.p}g</div>
            </div>
            <div class="macro-card-airy" style="width:80px;">
                <span style="color:#f59e0b; font-weight:bold;">Carb</span>
                <div>${totals.c}g</div>
            </div>
            <div class="macro-card-airy" style="width:80px;">
                <span style="color:#3b82f6; font-weight:bold;">Fat</span>
                <div>${totals.f}g</div>
            </div>
        </div>
        
        <p style="font-size:12px; color:#94a3b8; margin-top:15px;">เลื่อนดูรายการอาหารด้านล่างได้เลยครับ 👇</p>
    </div>
  `;
  
  showAlert("🍛 ข้อมูลรับเข้า", html, "😋");
}

function showOutDetails() {
  const dateObj = new Date();
  const today = dateObj.toLocaleDateString("th-TH");
  const todayExercises = exercises.filter(e => e.date === today);
  const burned = todayExercises.reduce((sum, e) => sum + e.cal, 0);

  if(todayExercises.length === 0) return showAlert("ยังไม่ออกกำลังกาย", "วันนี้ยังไม่ได้ขยับตัวเลย ลุกไปเบิร์นหน่อยมั้ย? 💪", "💤");
  
  const list = todayExercises.map(e => `
    <li style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f1f5f9;">
        <span>${e.name} (${e.duration} น.)</span>
        <span style="font-weight:bold; color:#ef4444;">${e.cal} kcal</span>
    </li>
  `).join("");
  
  const plan = user.exercisePlan || getExercisePlan(user.goal);

  const html = `
    <div style="text-align:left;">
        <div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:12px; padding:12px; margin-bottom:15px;">
            <div style="font-weight:bold; color:#0369a1; margin-bottom:4px; font-size:14px;">💡 แผนแนะนำ (${user.goal === 'cut' ? 'ลดไขมัน' : user.goal === 'bulk' ? 'เพิ่มกล้าม' : 'รักษาน้ำหนัก'})</div>
            <div style="font-size:12px; color:#0c4a6e;">
                • Cardio: <b>${plan.cardio}</b> นาที<br>
                • Weight: <b>${plan.weight}</b> นาที<br>
                <span style="color:#64748b; font-style:italic;">"${plan.desc}"</span>
            </div>
        </div>

        <div style="text-align:center; font-size:24px; font-weight:bold; color:var(--secondary); margin-bottom:15px;">
            ${burned.toLocaleString()} kcal
        </div>
        <ul style="list-style:none; padding:0; margin:0; font-size:14px;">
            ${list}
        </ul>
    </div>
  `;
  
  showAlert("🏃‍♂️ รายละเอียดการเบิร์น", html, "🔥");
}

function showConfirm(title, msg, onConfirm) {
  const modal = document.getElementById("global-modal");
  if(!modal) {
      if(confirm(msg)) onConfirm();
      return;
  }
  
  document.getElementById("modal-icon").innerText = "❓";
  document.getElementById("modal-title").innerText = title;
  document.getElementById("modal-msg").innerText = msg;
  
  confirmCallback = onConfirm;

  // Show Cancel/Yes
  const btnOk = document.getElementById("btn-ok");
  const btnCancel = document.getElementById("btn-cancel");
  const btnYes = document.getElementById("btn-yes");

  if(btnOk) btnOk.style.display = "none";
  if(btnCancel) btnCancel.style.display = "inline-block";
  if(btnYes) btnYes.style.display = "inline-block";
  
  if (!modal.open) {
    modal.showModal();
  }
}


/* =========================================
   FEATURE: EDIT PROFILE (REMOVED)
   ========================================= */
// Edit Profile feature has been removed as per user request.


/* =========================================
   AI API CONNECT
   ========================================= */
async function sendChat() {
  const input = document.getElementById("chat-msg");
  const msg = input.value.trim();
  if(!msg) return;
  
  addChat(msg, "user");
  input.value = "";
  const loadingId = addChat("...", "bot");

  try {
    const res = await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST", 
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ message: msg, user, weights, foods })
    });
    const data = await res.json();
    const loadingBox = document.getElementById("chat-history").lastChild;
    if(loadingBox.innerText === "...") loadingBox.remove();
    addChat(data.reply, "bot");
  } catch(e) {
    const loadingBox = document.getElementById("chat-history").lastChild;
    if(loadingBox.innerText === "...") loadingBox.remove();
    addChat("❌ เชื่อมต่อ Server ไม่ได้", "bot");
  }
}

function addChat(text, sender) {
  const box = document.getElementById("chat-history");
  if (!box) return;
  const div = document.createElement("div");
  div.className = `msg ${sender}`;
  div.innerText = text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  return div.id;
}

async function loadAiFood(forceRefresh = false) {
    const container = document.getElementById('ai-food-container');
    if(!container) return; 

    // 1. Check Cache
    // Use ISO Date (YYYY-MM-DD) to be locale-independent
    const today = new Date().toISOString().split('T')[0];
    const cached = localStorage.getItem("dailyMenu");
    
    if (!forceRefresh && cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.date === today && parsed.data.length > 0) {
          console.log("Using Cached Menu");
          // Add a small indicator that this is cached
          const header = document.querySelector('span[style*="✨ เมนูแนะนำวันนี้"]');
          if(header && !header.innerText.includes("Cached")) {
             header.innerHTML = "✨ เมนูแนะนำวันนี้ <span style='font-size:10px; color:#10b981; border:1px solid #10b981; padding:2px 4px; border-radius:4px;'>Cached</span>";
          }
          renderAiCards(parsed.data);
          return;
        }
      } catch(e) { localStorage.removeItem("dailyMenu"); }
    }
    
    // Reset Header if refreshing
    const header = document.querySelector('span[style*="✨ เมนูแนะนำวันนี้"]');
    if(header) header.innerText = "✨ เมนูแนะนำวันนี้";

    container.innerHTML = `
      <div style="min-width: 200px; height: 140px; background: rgba(255,255,255,0.5); border-radius: 12px; display:flex; align-items:center; justify-content:center; color:#64748b;">
        <span style="margin-right:8px;">⏳</span> กำลังคิดเมนู...
      </div>`;

    try {
      const savedUser = user || { name: 'User', goal: 'health' };
      const res = await fetch(`${API_BASE_URL}/api/recommend-food`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: savedUser })
      });

      const data = await res.json();
      container.innerHTML = ""; 

      if(data.recommendations && data.recommendations.length > 0) {
        // Save to Cache
        localStorage.setItem("dailyMenu", JSON.stringify({ date: today, data: data.recommendations }));
        renderAiCards(data.recommendations);
      } else if (data.error) {
        container.innerHTML = `<div style="padding:10px; color:#ef4444;">❌ Error: ${data.error}</div>`;
      } else {
        container.innerHTML = `<div style="padding:10px; color:#64748b;">AI ยังไม่พร้อม ลองกดเปลี่ยนเมนูใหม่นะ</div>`;
      }

    } catch (err) {
      console.error(err);
      container.innerHTML = `<div style="color:red; font-size:0.8rem; padding:10px;">❌ เชื่อมต่อ Server ไม่ได้</div>`;
    }
}

function renderAiCards(items) {
  const container = document.getElementById('ai-food-container');
  if(!container) return;
  container.innerHTML = "";
  
  const html = items.map(item => {
    const keyword = item.image_keyword || item.menu || "healthy food";
    // Generate a static seed from menu name for consistent images
    let seed = 0;
    for (let i = 0; i < keyword.length; i++) seed += keyword.charCodeAt(i);
    
    // Encode for Pollinations
    const encodedMenu = encodeURIComponent(keyword + " food realistic photography high resolution");
    const imgUrl = `https://image.pollinations.ai/prompt/${encodedMenu}?width=300&height=200&nologo=true&seed=${seed}`;
    const fallbackUrl = "https://placehold.co/300x200?text=No+Image";
    const googleImgUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(item.menu)}`;
    
    // Safety escapes for inline JS
    const safeMenu = (item.menu || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const safeHowto = (item.howto || '-').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/"/g, '&quot;');
    const safeIng = (item.ingredients || '-').replace(/'/g, "\\'");
    
    return `
      <div class="ai-card">
        <div style="position:relative;">
            <img src="${imgUrl}" onerror="this.onerror=null;this.src='${fallbackUrl}';" style="width:100%; height:120px; object-fit:cover; border-radius:12px; margin-bottom:10px;">
            <a href="${googleImgUrl}" target="_blank" style="position:absolute; bottom:15px; right:5px; background:rgba(0,0,0,0.6); color:white; font-size:10px; padding:2px 6px; border-radius:4px; text-decoration:none;">🔍 ดูรูป Google</a>
        </div>
        <div style="font-weight:bold; font-size:1rem; color:#333; margin-bottom:4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.menu}</div>
        
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <span style="font-size:0.8rem; color:#64748b;">${item.meal}</span>
          <span style="font-size:0.9rem; color:#10b981; font-weight:bold;">${item.calories} kcal</span>
        </div>
        
        <div style="display:flex; gap:5px;">
            <button onclick="showAlert('${safeMenu}', 'วิธีทำ:\\n${safeHowto}', '👨‍🍳')" style="flex:1; padding:8px; font-size:0.8rem; background:#f1f5f9; color:#334155; box-shadow:none;">วิธีทำ</button>
            <button onclick="addToShoppingList('${safeIng}')" style="flex:1; padding:8px; font-size:0.8rem; background:#3b82f6; box-shadow:none;">+ซื้อของ</button>
        </div>
      </div>
    `;
  }).join("");
  
  container.innerHTML = html;
}

/* =========================================
   THAI FOOD DATABASE (Manual)
   ========================================= */
const THAI_FOOD_DB = [
  { name: "ข้าวกะเพราหมูสับ+ไข่ดาว", cal: 630, p: 25, c: 60, f: 30 },
  { name: "ข้าวมันไก่ต้ม", cal: 585, p: 20, c: 75, f: 25 },
  { name: "ข้าวไข่เจียวหมูสับ", cal: 480, p: 15, c: 45, f: 28 },
  { name: "ส้มตำไทย", cal: 120, p: 5, c: 20, f: 2 },
  { name: "ไก่ย่าง (1 น่อง)", cal: 180, p: 22, c: 2, f: 10 },
  { name: "ข้าวเหนียว (1 ห่อ)", cal: 150, p: 3, c: 35, f: 1 },
  { name: "ต้มยำกุ้งน้ำข้น", cal: 180, p: 15, c: 10, f: 12 },
  { name: "ผัดไทยกุ้งสด", cal: 550, p: 18, c: 65, f: 25 },
  { name: "ราดหน้าหมู", cal: 420, p: 18, c: 50, f: 15 },
  { name: "ผัดซีอิ๊ว", cal: 679, p: 20, c: 70, f: 35 },
  { name: "ก๋วยเตี๋ยวเรือน้ำตก", cal: 350, p: 18, c: 45, f: 10 },
  { name: "สุกี้น้ำ (รวมมิตร)", cal: 300, p: 25, c: 35, f: 8 },
  { name: "ข้าวผัดหมูใส่ไข่", cal: 550, p: 18, c: 70, f: 22 },
  { name: "โจ๊กหมูใส่ไข่", cal: 250, p: 12, c: 35, f: 8 },
  { name: "น้ำพริกปลาทู+ผักต้ม", cal: 150, p: 20, c: 10, f: 3 },
  { name: "แกงเขียวหวานไก่+ขนมจีน", cal: 480, p: 18, c: 55, f: 22 },
  { name: "ไข่ต้ม (1 ฟอง)", cal: 75, p: 7, c: 0, f: 5 },
  { name: "อกไก่ปั่น/ต้ม (100g)", cal: 120, p: 23, c: 0, f: 2 },
  { name: "นมสดจืด (1 แก้ว)", cal: 130, p: 8, c: 12, f: 7 },
  { name: "กาแฟดำ/อเมริกาโน่", cal: 5, p: 0, c: 1, f: 0 },
  { name: "ชานมไข่มุก (หวานปกติ)", cal: 350, p: 2, c: 60, f: 12 },
  { name: "ลาเต้เย็น (หวานน้อย)", cal: 150, p: 5, c: 15, f: 8 }
];