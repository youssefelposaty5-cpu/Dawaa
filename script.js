/*********** Constants & Helpers ***********/
const PETTY_CASH = 250.0;
const LS_KEY = "dawaa_data_v1";
const SESSION_KEY = "dawaa_logged_in";
const ADMIN_DELETE_PASS = "elposaty2008";
const $ = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

const todayStr = () => {
  const d = new Date();
  const yyyy = d.getFullYear(), mm = String(d.getMonth()+1).padStart(2,"0"), dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
};
const round2 = n => Math.round((n+Number.EPSILON)*100)/100;

/*********** Theme ***********/
const themeBtn = $("#themeToggle");
themeBtn.addEventListener("click", ()=>{
  const dark = document.body.getAttribute("data-theme")==="dark";
  document.body.setAttribute("data-theme", dark ? "light" : "dark");
  themeBtn.innerHTML = dark ? `<i class="fa-solid fa-moon"></i>` : `<i class="fa-solid fa-sun"></i>`;
});

/*********** Reveal Animations ***********/
const io = new IntersectionObserver((entries)=>{
  entries.forEach(e=>{ if (e.isIntersecting) e.target.classList.add("in"); });
},{threshold:.08});
$$(".reveal").forEach(el=>io.observe(el));

/*********** Storage ***********/
function makeEmptyDay(day){
  return { invoices:[], locked:false, totals:{ cash:0, visa:0, returns:0, net:0, drawer: PETTY_CASH } };
}
function loadData(){
  const raw = localStorage.getItem(LS_KEY);
  if (raw){
    const data = JSON.parse(raw);
    const t = todayStr();
    if (!data.days[t]){ data.days[t]=makeEmptyDay(t); saveData(data); }
    return data;
  }
  const t = todayStr();
  const base = { current_day:t, days:{ [t]: makeEmptyDay(t) } };
  saveData(base);
  return base;
}
function saveData(d){ localStorage.setItem(LS_KEY, JSON.stringify(d)); }
function getDayData(date){
  const data = loadData();
  if (!data.days[date]){ data.days[date]=makeEmptyDay(date); saveData(data); }
  return [data, data.days[date]];
}

/*********** Totals ***********/
function calculateDayTotals(dayData){
  const inv = dayData.invoices||[];
  const sumCash   = inv.filter(i=>!i.is_return).reduce((s,i)=>s+(i.cash||0),0);
  const sumVisa   = inv.filter(i=>!i.is_return).reduce((s,i)=>s+(i.visa||0),0);
  const retCash   = inv.filter(i=> i.is_return).reduce((s,i)=>s+(i.cash||0),0);
  const retVisa   = inv.filter(i=> i.is_return).reduce((s,i)=>s+(i.visa||0),0);
  const returns   = retCash + retVisa;
  let net = (sumCash + sumVisa) - returns; if (net<0) net=0;
  let drawer = (sumCash - retCash) + PETTY_CASH; if (drawer < PETTY_CASH) drawer = PETTY_CASH;

  const total_invoices = inv.length;
  const return_count = inv.filter(i=>i.is_return).length;
  const sales_count  = total_invoices - return_count;

  return {
    cash:round2(sumCash), visa:round2(sumVisa), returns:round2(returns),
    net:round2(net), drawer:round2(drawer),
    total_invoices, return_count, sales_count, invoice_count:sales_count
  };
}
function updateDayTotals(date){
  const [data, day] = getDayData(date);
  const t = calculateDayTotals(day);
  day.totals = { cash:t.cash, visa:t.visa, returns:t.returns, net:t.net, drawer:t.drawer };
  saveData(data);
  return t;
}

/*********** Session ***********/
function isLoggedIn(){ return sessionStorage.getItem(SESSION_KEY)==="1"; }
function requireLoginView(){ isLoggedIn() ? showSection("cashierView") : showSection("loginView"); }

$("#loginForm").addEventListener("submit",(e)=>{
  e.preventDefault();
  const u = $("#loginUsername").value.trim();
  const p = $("#loginPassword").value.trim();
  if (u==="youssef" && p==="elposaty2008"){
    sessionStorage.setItem(SESSION_KEY,"1");
    $("#loginError").classList.add("hidden");
    showToast("تم تسجيل الدخول");
    showSection("cashierView");
  }else{
    $("#loginError").classList.remove("hidden");
  }
});
$("#logoutBtn").addEventListener("click", ()=>{ sessionStorage.removeItem(SESSION_KEY); showSection("loginView"); });

/*********** Navigation ***********/
$$(".navlink").forEach(b=>b.addEventListener("click",()=>{
  const target = b.dataset.target;
  if (!isLoggedIn()) return showSection("loginView");
  showSection(target);
}));
function showSection(id){
  ["loginView","cashierView","returnsView","historyView"].forEach(v=>{ const el=document.getElementById(v); if (el) el.classList.add("hidden"); });
  const view = document.getElementById(id); if (view) view.classList.remove("hidden");
  if (id==="cashierView") refreshCashierView();
  if (id==="returnsView") refreshReturnsView();
  if (id==="historyView") refreshHistoryView();
}

/*********** Toast ***********/
function showToast(msg, ok=true){
  const t = $("#toast");
  t.textContent = msg;
  t.style.background = ok ? "linear-gradient(135deg,#16a34a,#0ea5e9)" : "linear-gradient(135deg,#ef4444,#f59e0b)";
  t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"), 1600);
}

/*********** Cashier ***********/
let cart = [];

function refreshCashierView(){
  const date = todayStr();
  const [data, day] = getDayData(date);

  const locked = !!day.locked;
  $("#shiftLockedBanner").classList.toggle("hidden", !locked);
  ["addProductCard","completeCard"].forEach(id=>{
    const c = document.getElementById(id);
    if (c){ c.style.opacity = locked ? .45 : 1; c.style.pointerEvents = locked ? "none" : "auto"; }
  });
  $("#lockShift").classList.toggle("hidden", locked);
  $("#unlockShift").classList.toggle("hidden", !locked);

  const totals = updateDayTotals(date);
  $("#sumTotalInvoices").textContent = String(totals.total_invoices);
  $("#sumSalesCount").textContent = String(totals.sales_count);
  $("#sumReturnCount").textContent = String(totals.return_count);
  $("#sumCash").textContent = totals.cash.toFixed(2);
  $("#sumVisa").textContent = totals.visa.toFixed(2);
  $("#sumReturns").textContent = totals.returns.toFixed(2);
  $("#sumNet").textContent = totals.net.toFixed(2);
  $("#sumDrawer").textContent = totals.drawer.toFixed(2);

  cart = [];
  updateCartDisplay();
  $("#paymentMethod").value="cash";
  $("#paidAmount").value = $("#cashAmount").value = $("#visaAmount").value = "";
  $("#changeAmount").value = "0.00";
  togglePaymentFields();
}

$("#addProductForm").addEventListener("submit",(e)=>{
  e.preventDefault();
  const name = $("#productName").value.trim();
  const price = parseFloat($("#productPrice").value);
  const qty = parseInt($("#productQty").value);
  if (!name || !(price>0) || !(qty>0)) return;

  cart.push({name, price, qty});
  updateCartDisplay();
  e.target.reset(); $("#productName").focus();
});

function updateCartDisplay(){
  const tbody = $("#cartTable");
  if (cart.length===0){
    tbody.innerHTML = '<tr><td colspan="5" class="empty">السلة فارغة</td></tr>';
  }else{
    tbody.innerHTML = cart.map((it,idx)=>`
      <tr>
        <td>${it.name}</td>
        <td>${it.price.toFixed(2)}</td>
        <td>${it.qty}</td>
        <td>${(it.price*it.qty).toFixed(2)}</td>
        <td><button class="btn danger" onclick="removeFromCart(${idx})"><i class="fa-solid fa-trash"></i> حذف</button></td>
      </tr>
    `).join("");
  }
  const total = cart.reduce((s,i)=>s+i.price*i.qty,0);
  $("#cartTotal").textContent = total.toFixed(2);
  updatePaymentFields();
}
window.removeFromCart = (i)=>{ cart.splice(i,1); updateCartDisplay(); };

/* Payment fields */
$("#paymentMethod").addEventListener("change", togglePaymentFields);
function togglePaymentFields(){
  const m = $("#paymentMethod").value;
  $("#cashField").classList.toggle("hidden", m!=="mixed");
  $("#visaField").classList.toggle("hidden", m!=="mixed");
  $("#paidField").classList.toggle("hidden", m==="mixed");
  updatePaymentFields();
}
function updatePaymentFields(){
  const total = cart.reduce((s,i)=>s+i.price*i.qty,0);
  const m = $("#paymentMethod").value;
  if (m==="cash" || m==="visa"){ $("#paidAmount").value = total ? total.toFixed(2) : ""; $("#changeAmount").value="0.00"; }
  else { $("#paidAmount").value=""; $("#changeAmount").value="0.00"; }
}
$("#paidAmount").addEventListener("input", ()=>{
  const total = cart.reduce((s,i)=>s+i.price*i.qty,0);
  const paid = parseFloat($("#paidAmount").value)||0;
  $("#changeAmount").value = (paid-total).toFixed(2);
});
const recomputeMixed = ()=>{
  const total = cart.reduce((s,i)=>s+i.price*i.qty,0);
  const cash = parseFloat($("#cashAmount").value)||0;
  const visa = parseFloat($("#visaAmount").value)||0;
  $("#changeAmount").value = (cash+visa-total).toFixed(2);
};
$("#cashAmount")?.addEventListener("input", recomputeMixed);
$("#visaAmount")?.addEventListener("input", recomputeMixed);

/* Complete Sale */
$("#completeSale").addEventListener("click", ()=>{
  const date = todayStr();
  const [data, day] = getDayData(date);
  if (day.locked) return showToast("الشيفت مقفول", false);
  if (cart.length===0) return alert("السلة فارغة");

  const total = cart.reduce((s,i)=>s+i.price*i.qty,0);
  const m = $("#paymentMethod").value;
  let cash=0, visa=0;
  if (m==="cash")      cash = parseFloat($("#paidAmount").value)||0;
  else if (m==="visa") visa = parseFloat($("#paidAmount").value)||0;
  else { cash = parseFloat($("#cashAmount").value)||0; visa = parseFloat($("#visaAmount").value)||0; }

  if (cash+visa < total) return alert("المبلغ المدفوع أقل من المجموع الكلي");

  const invoice = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    time: new Date().toLocaleString("ar-EG"),
    items: cart.slice(),
    total: round2(total), cash: round2(cash), visa: round2(visa),
    is_return:false
  };
  day.invoices.push(invoice); saveData(data); updateDayTotals(date);
  showToast("تم إتمام البيع بنجاح ✅");

  // لا طباعة تلقائية — المستخدم يطبع من السجل
  cart = []; refreshCashierView();
});

/* Lock / Unlock */
$("#lockShift").addEventListener("click", ()=>{
  const [data, day] = getDayData(todayStr());
  if (confirm("هل أنت متأكد من قفل الشيفت؟")){ day.locked = true; saveData(data); refreshCashierView(); showToast("تم قفل الشيفت"); }
});
$("#unlockShift").addEventListener("click", ()=>{
  const [data, day] = getDayData(todayStr());
  if (confirm("هل أنت متأكد من فتح الشيفت؟")){ day.locked = false; saveData(data); refreshCashierView(); showToast("تم فتح الشيفت"); }
});

/*********** Export XLSX (styled array) ***********/
$("#exportToday").addEventListener("click", ()=> exportDayXLSX(todayStr()));
$("#exportAll").addEventListener("click", ()=> exportAllXLSX());

function exportDayXLSX(day){
  const [data, d] = getDayData(day);
  const t = calculateDayTotals(d);

  // Build rows exactly as requested
  const rows = [];
  rows.push(["التاريخ","إجمالي الكاش","إجمالي الفيزا","إجمالي المرتجعات","عدد المرتجعات","الصافي","المبلغ في الدرج"]);
  rows.push([formatDisplayDate(day), t.cash, t.visa, t.returns, t.return_count, t.net, t.drawer]);
  rows.push([]); // blank
  rows.push(["التفاصيل"]);
  rows.push([]); // blank
  rows.push(["الوقت","المنتجات","المجموع","الكاش","الفيزا","نوع العملية"]);
  for (const inv of d.invoices){
    const itemsStr = inv.items.map(i=>`${i.name} (${i.qty})`).join(", ");
    rows.push([inv.time, itemsStr, inv.total, (inv.cash||0), (inv.visa||0), inv.is_return ? "مرتجع" : "بيع"]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // set some column widths (wch) for better view
  ws['!cols'] = [{wch:16},{wch:30},{wch:12},{wch:12},{wch:12},{wch:12}];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `تقرير_${day}`);

  // write file (SheetJS will handle encoding)
  XLSX.writeFile(wb, `dawaa_${day}.xlsx`);
}

function exportAllXLSX(){
  const data = loadData();
  const rows = [];
  rows.push(["اليوم","الوقت","المنتجات","المجموع","الكاش","الفيزا","نوع العملية"]);
  const days = Object.keys(data.days).sort();
  for (const day of days){
    for (const inv of data.days[day].invoices){
      const itemsStr = inv.items.map(i=>`${i.name} (${i.qty})`).join(", ");
      rows.push([day, inv.time, itemsStr, inv.total, (inv.cash||0), (inv.visa||0), inv.is_return ? "مرتجع" : "بيع"]);
    }
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:14},{wch:18},{wch:30},{wch:12},{wch:12},{wch:12},{wch:12}];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, `تقرير_كامل`);
  XLSX.writeFile(wb, `dawaa_all.xlsx`);
}

/*********** Returns (add / edit / delete) ***********/
$("#addReturnBtn").addEventListener("click", ()=> openReturnModalForNew());
$$("[data-close='returnModal']").forEach(b=>b.addEventListener("click",()=>closeModal("returnModal")));

function openReturnModalForNew(){
  $("#returnEditId").value = "";
  $("#returnForm").reset();
  $("#returnCashField").classList.add("hidden");
  $("#returnVisaField").classList.add("hidden");
  openModal("returnModal");
}

$("#returnPayment").addEventListener("change", ()=>{
  const m = $("#returnPayment").value;
  $("#returnCashField").classList.toggle("hidden", m!=="mixed");
  $("#returnVisaField").classList.toggle("hidden", m!=="mixed");
});

$("#returnForm").addEventListener("submit",(e)=>{
  e.preventDefault();
  const date = todayStr();
  const [data, day] = getDayData(date);
  if (day.locked) return showToast("الشيفت مقفول", false);

  const editId = $("#returnEditId").value;
  const name = $("#returnName").value.trim();
  const price = parseFloat($("#returnPrice").value);
  const qty = parseInt($("#returnQty").value);
  const m = $("#returnPayment").value;
  const rtype = $("#returnType").value;
  if (!name || !(price>0) || !(qty>0)) return;

  let cash=0, visa=0;
  if (m==="cash") cash = round2(price*qty);
  else if (m==="visa") visa = round2(price*qty);
  else { cash = round2(parseFloat($("#returnCashAmount").value)||0); visa = round2(parseFloat($("#returnVisaAmount").value)||0); }

  if (editId){
    // update existing return invoice
    const invDayKey = todayStr(); // editing current day's return (we only allow editing within same displayed day)
    const invData = data.days[invDayKey].invoices.find(i=>i.id===editId);
    if (!invData) return showToast("المعرف غير موجود", false);
    invData.items = [{name, price, qty}];
    invData.total = round2(price*qty);
    invData.cash = cash; invData.visa = visa; invData.return_type = rtype; invData.is_return = true;
    saveData(data); updateDayTotals(invDayKey);
    showToast("تم تحديث المرتجع بنجاح ✅");
  } else {
    const invoice = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      time: new Date().toLocaleString("ar-EG"),
      items:[{name, price, qty}],
      total: round2(price*qty),
      cash, visa, is_return:true, return_type: rtype
    };
    day.invoices.push(invoice); saveData(data); updateDayTotals(date);
    showToast("تم إضافة المرتجع بنجاح");
  }

  $("#returnForm").reset(); closeModal("returnModal");
  refreshReturnsView(); refreshCashierView();
});

function refreshReturnsView(){
  const [, day] = getDayData(todayStr());
  const list = day.invoices.filter(i=>i.is_return);
  const tbody = $("#returnsTable");
  if (!list.length) return tbody.innerHTML = '<tr><td colspan="5" class="empty">لا توجد مرتجعات</td></tr>';
  tbody.innerHTML = list.map(inv=>`
    <tr>
      <td>${inv.time}</td>
      <td>${inv.items.map(i=>`${i.name} (${i.qty})`).join(", ")}</td>
      <td>${inv.total.toFixed(2)}</td>
      <td>${inv.return_type==="return"?"مرتجع":"استبدال"}</td>
      <td>
        <button class="btn primary" onclick='openReturnEdit("${inv.id}")'><i class="fa-solid fa-pen-to-square"></i> تعديل</button>
        <button class="btn danger" onclick='deleteReturn("${inv.id}")'><i class="fa-solid fa-trash"></i> حذف</button>
      </td>
    </tr>
  `).join("");
}

window.openReturnEdit = function(id){
  const [data, day] = getDayData(todayStr());
  const inv = day.invoices.find(i=>i.id===id && i.is_return);
  if (!inv) return showToast("لم يتم العثور على المرتجع", false);
  $("#returnEditId").value = inv.id;
  $("#returnName").value = inv.items[0]?.name || "";
  $("#returnPrice").value = inv.items[0]?.price || 0;
  $("#returnQty").value = inv.items[0]?.qty || 1;
  $("#returnType").value = inv.return_type || "return";
  if ((inv.cash || 0) > 0 && (inv.visa || 0) > 0) {
    $("#returnPayment").value = "mixed";
    $("#returnCashAmount").value = inv.cash || 0;
    $("#returnVisaAmount").value = inv.visa || 0;
    $("#returnCashField").classList.remove("hidden");
    $("#returnVisaField").classList.remove("hidden");
  } else if ((inv.cash || 0) > 0) {
    $("#returnPayment").value = "cash";
    $("#returnCashField").classList.add("hidden");
    $("#returnVisaField").classList.add("hidden");
  } else {
    $("#returnPayment").value = "visa";
    $("#returnCashField").classList.add("hidden");
    $("#returnVisaField").classList.add("hidden");
  }
  openModal("returnModal");
};

window.deleteReturn = function(id){
  if (!confirm("هل أنت متأكد من حذف هذا المرتجع؟")) return;
  const data = loadData();
  const dayKey = todayStr();
  const d = data.days[dayKey];
  d.invoices = d.invoices.filter(i=>i.id!==id);
  saveData(data); updateDayTotals(dayKey);
  showToast("تم حذف المرتجع"); refreshReturnsView(); refreshCashierView();
};

/*********** History ***********/
function refreshHistoryView(){
  const data = loadData();
  const days = Object.keys(data.days).sort().reverse();
  const wrap = $("#daysContainer");
  if (!days.length) return wrap.innerHTML = '<div class="card">لا توجد بيانات</div>';
  wrap.innerHTML = days.map(day=>{
    const d = data.days[day], t = calculateDayTotals(d);
    return `
      <div class="card glass day-card">
        <div class="card-head spread">
          <h3><i class="fa-regular fa-calendar"></i> ${day}</h3>
          <div class="actions">
            <button class="btn primary" onclick="viewDay('${day}')"><i class="fa-solid fa-eye"></i> عرض</button>
            <button class="btn success" onclick="exportDayXLSX('${day}')"><i class="fa-solid fa-file-export"></i> تصدير</button>
            <button class="btn danger" onclick="deleteDay('${day}')"><i class="fa-solid fa-trash"></i> حذف</button>
          </div>
        </div>
        <div class="stats" style="grid-template-columns:repeat(4,1fr)">
          <div class="stat"><div>إجمالي الفواتير</div><div class="num">${d.invoices.length}</div><div class="sub">بيع: ${d.invoices.filter(i=>!i.is_return).length} | مرتجع: ${d.invoices.filter(i=>i.is_return).length}</div></div>
          <div class="stat"><div>الكاش</div><div class="num">${t.cash.toFixed(2)}</div></div>
          <div class="stat"><div>الفيزا</div><div class="num">${t.visa.toFixed(2)}</div></div>
          <div class="stat"><div>الصافي</div><div class="num">${t.net.toFixed(2)}</div></div>
        </div>
      </div>
    `;
  }).join("");
}
window.viewDay = function(day){
  openModal("dayModal");
  const data = loadData(), d = data.days[day];
  const list = d.invoices.map(inv=>`
    <tr>
      <td>${inv.time}</td>
      <td>${inv.items.map(i=>`${i.name} (${i.qty})`).join(", ")}</td>
      <td>${inv.total.toFixed(2)}</td>
      <td>${(inv.cash||0).toFixed(2)}</td>
      <td>${(inv.visa||0).toFixed(2)}</td>
      <td>${inv.is_return?"مرتجع":"بيع"}</td>
      <td>
        <button class="btn primary" onclick='printInvoice(${JSON.stringify(inv)})'><i class="fa-solid fa-print"></i> طباعة</button>
        <button class="btn ghost" onclick="openEdit('${inv.id}','${day}')"><i class="fa-regular fa-pen-to-square"></i> تعديل</button>
        <button class="btn danger" onclick="deleteInvoice('${inv.id}','${day}')"><i class="fa-solid fa-trash"></i> حذف</button>
      </td>
    </tr>
  `).join("");
  $("#dayModalTitle").textContent = `فواتير ${day}`;
  $("#dayModalContent").innerHTML = `
    <div class="table-wrap soft-scroll">
      <table class="table">
        <thead><tr><th>الوقت</th><th>المنتجات</th><th>المجموع</th><th>الكاش</th><th>الفيزا</th><th>النوع</th><th>إجراءات</th></tr></thead>
        <tbody>${list || '<tr><td colspan="7" class="empty">لا توجد فواتير</td></tr>'}</tbody>
      </table>
    </div>`;
};
$$("[data-close='dayModal']").forEach(b=>b.addEventListener("click",()=>closeModal("dayModal")));

/* deleteDay with password prompt */
window.deleteDay = function(day){
  const pass = prompt("أدخل كلمة المرور لحذف هذا اليوم:");
  if (pass === null) return; // cancelled
  if (pass !== ADMIN_DELETE_PASS){ showToast("كلمة المرور غير صحيحة!", false); return; }
  if (!confirm("سيتم حذف كل الفواتير لذلك اليوم نهائياً. متابعة؟")) return;
  const data = loadData(); delete data.days[day]; saveData(data);
  showToast("تم حذف اليوم بنجاح");
  refreshHistoryView(); refreshCashierView();
};

window.deleteInvoice = function(id, day){
  if (!confirm("هل أنت متأكد من حذف هذه الفاتورة؟")) return;
  const data = loadData(); const d = data.days[day];
  d.invoices = d.invoices.filter(i=>i.id!==id);
  saveData(data); updateDayTotals(day);
  showToast("تم الحذف بنجاح"); viewDay(day); refreshCashierView();
};

/*********** Edit Invoice (works for sales & returns) ***********/
window.openEdit = function(id, day){
  const data = loadData(); const inv = data.days[day].invoices.find(i=>i.id===id); if (!inv) return;
  $("#editInvoiceId").value = inv.id; $("#editInvoiceDate").value = day;

  let method = "cash"; if ((inv.cash||0) > 0 && (inv.visa||0) > 0) method="mixed"; else if ((inv.visa||0) > 0) method="visa";
  $("#editPaymentMethod").value = method; toggleEditPaymentFields();
  $("#editCashAmount").value = inv.cash||0; $("#editVisaAmount").value = inv.visa||0; $("#editPaidAmount").value = (inv.cash||0)+(inv.visa||0);

  const cont = $("#editItemsContainer"); cont.innerHTML = "";
  inv.items.forEach((it)=> cont.appendChild(makeEditItemRow(it)));

  updateEditTotal(); openModal("editInvoiceModal");
};

$("#addEditItem").addEventListener("click", ()=>{ $("#editItemsContainer").appendChild(makeEditItemRow({name:"",price:0,qty:1})); updateEditTotal(); });

function makeEditItemRow(item){
  const wrap = document.createElement("div");
  wrap.className = "card soft";
  wrap.innerHTML = `
    <div class="grid-4">
      <div><label>اسم المنتج</label><input type="text" class="edit-item-name" value="${item.name||""}" /></div>
      <div><label>السعر</label><input type="number" step="0.01" class="edit-item-price" value="${item.price||0}" /></div>
      <div><label>الكمية</label><input type="number" min="1" class="edit-item-qty" value="${item.qty||1}" /></div>
      <div class="end"><button class="btn danger" onclick="removeEditItem(this)"><i class="fa-solid fa-trash"></i> حذف</button></div>
    </div>`;
  return wrap;
}
window.removeEditItem = (btn)=>{
  const cont = $("#editItemsContainer");
  if (cont.children.length<=1) return alert("يجب أن تحتوي الفاتورة على منتج واحد على الأقل");
  btn.closest(".card").remove(); updateEditTotal();
};

document.addEventListener("input",(e)=>{
  if (e.target.closest("#editInvoiceModal")){
    if (e.target.classList.contains("edit-item-name") || e.target.classList.contains("edit-item-price") || e.target.classList.contains("edit-item-qty")){
      updateEditTotal();
    }
  }
});
$("#editPaymentMethod").addEventListener("change", toggleEditPaymentFields);
["#editCashAmount","#editVisaAmount","#editPaidAmount"].forEach(sel=> $(sel).addEventListener("input", updateEditTotal));

function toggleEditPaymentFields(){
  const m = $("#editPaymentMethod").value;
  $("#editCashField").classList.toggle("hidden", m!=="mixed");
  $("#editVisaField").classList.toggle("hidden", m!=="mixed");
  $("#editPaidField").classList.toggle("hidden", m==="mixed");
}
function updateEditTotal(){
  const items = [...$$("#editItemsContainer .card")].map(div=>{
    const price = parseFloat(div.querySelector(".edit-item-price").value)||0;
    const qty   = parseInt(div.querySelector(".edit-item-qty").value)||0;
    return {price, qty};
  });
  const total = items.reduce((s,i)=>s+i.price*i.qty,0);
  $("#editTotal").textContent = total.toFixed(2);

  const m = $("#editPaymentMethod").value;
  const cash = parseFloat($("#editCashAmount").value)||0;
  const visa = parseFloat($("#editVisaAmount").value)||0;
  const paid = parseFloat($("#editPaidAmount").value)||0;
  const totalPaid = (m==="mixed")? (cash+visa) : paid;
  $("#editChange").value = (totalPaid-total).toFixed(2);
}

$("#saveEditInvoice").addEventListener("click", ()=>{
  const id = $("#editInvoiceId").value, day = $("#editInvoiceDate").value;
  const items = [];
  $$("#editItemsContainer .card").forEach(div=>{
    const name = div.querySelector(".edit-item-name").value.trim();
    const price = parseFloat(div.querySelector(".edit-item-price").value)||0;
    const qty = parseInt(div.querySelector(".edit-item-qty").value)||0;
    if (name && price>0 && qty>0) items.push({name, price, qty});
  });
  if (!items.length) return alert("يجب إضافة منتج واحد على الأقل");

  const m = $("#editPaymentMethod").value;
  let cash=0, visa=0;
  if (m==="cash") cash = parseFloat($("#editPaidAmount").value)||0;
  else if (m==="visa") visa = parseFloat($("#editPaidAmount").value)||0;
  else { cash = parseFloat($("#editCashAmount").value)||0; visa = parseFloat($("#editVisaAmount").value)||0; }

  const total = items.reduce((s,i)=>s+i.price*i.qty,0);
  if (cash+visa < total) return alert("المبلغ المدفوع أقل من المجموع الكلي");

  const data = loadData();
  const inv = data.days[day].invoices.find(i=>i.id===id); if (!inv) return;
  inv.items = items; inv.total = round2(total); inv.cash = round2(cash); inv.visa = round2(visa);
  saveData(data); updateDayTotals(day); showToast("تم تحديث الفاتورة بنجاح ✅");
  closeModal("editInvoiceModal"); viewDay(day); refreshCashierView();
});

/*********** Print (Elegant layout) ***********/
window.printInvoice = function(inv){
  const change = ((inv.cash||0)+(inv.visa||0) - inv.total);
  const html = `
<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"/>
<title>فاتورة - Dawaa</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
<style>
@page{size:80mm auto; margin:0}
body{margin:0; font-family:"Tajawal","Cairo",Arial,sans-serif}
.print-receipt{max-width:80mm; margin:0 auto; padding:10px; color:#000}
.print-receipt .header{text-align:center; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:10px}
.print-receipt .brand{font-weight:800; font-size:16px}
.print-receipt .meta{font-size:11px; color:#222}
.print-receipt .items{margin-top:6px; border-top:1px dashed #777; border-bottom:1px dashed #777; padding:6px 0}
.print-receipt .row{display:flex; justify-content:space-between; padding:4px 0}
.print-receipt .row .sub{font-size:10px; color:#444; margin-top:2px}
.print-receipt .total{font-weight:700; font-size:13px; margin-top:8px; padding-top:8px; border-top:2px solid #000}
.print-receipt .footer{text-align:center; margin-top:10px; padding-top:8px; border-top:1px solid #aaa; font-size:10px}
</style>
</head><body>
<div class="print-receipt">
  <div class="header">
    <div class="brand">صيدلية دواء — Dawaa Pharmacy</div>
    <div class="meta">${inv.time}</div>
  </div>

  <div class="items">
    ${inv.items.map(it=>`
      <div class="row">
        <div>
          <div>${it.name}</div>
          <div class="sub">${it.qty} × ${Number(it.price).toFixed(2)}</div>
        </div>
        <div>${(it.price*it.qty).toFixed(2)} جم</div>
      </div>`).join("")}
  </div>

  <div class="total">
    <div class="row"><span>المجموع:</span><span>${Number(inv.total).toFixed(2)} جم</span></div>
    ${(inv.cash||0)>0 ? `<div class="row"><span>كاش:</span><span>${Number(inv.cash).toFixed(2)} جم</span></div>` : ""}
    ${(inv.visa||0)>0 ? `<div class="row"><span>فيزا:</span><span>${Number(inv.visa).toFixed(2)} جم</span></div>` : ""}
    ${change>0 ? `<div class="row"><span>الباقي:</span><span>${change.toFixed(2)} جم</span></div>` : ""}
  </div>

  <div class="footer"><div>شكرًا لتعاملكم معنا</div></div>
</div>
<script>window.onload=()=>window.print()</script>
</body></html>`;
  const w = window.open("", "_blank"); w.document.write(html); w.document.close();
};

/*********** Modal helpers (lock background & strong overlay) ***********/
function openModal(id){
  document.body.style.overflow = "hidden";
  document.getElementById(id).classList.remove("hidden");
}
function closeModal(id){
  document.getElementById(id).classList.add("hidden");
  document.body.style.overflow = "";
}
document.addEventListener("click",(e)=>{
  const target = e.target.dataset?.close; if (target) closeModal(target);
});

/*********** Boot ***********/
document.addEventListener("DOMContentLoaded", ()=>{ requireLoginView(); refreshCashierView(); });

/*********** Utility: format ISO day to user-friendly (e.g., 11/7/2025) ***********/
function formatDisplayDate(iso){
  // iso is YYYY-MM-DD
  const [yyyy,mm,dd] = iso.split("-");
  return `${Number(dd)}/${Number(mm)}/${yyyy}`;
}
