/* =========================================================
   뮤지컬 관극 일지 - script.js
   브라우저의 localStorage에 데이터를 저장해서,
   버튼으로 추가한 내용이 다음에 다시 접속해도 남아있게 합니다.
   (단, localStorage는 "이 브라우저"에만 저장되므로
   다른 기기/브라우저에서는 보이지 않습니다.)

   구조: "관람 기록" 하나에 사진까지 한 번에 입력하면
   표 + 갤러리 + 캘린더 3곳에 자동으로 반영됩니다.
   (갤러리는 별도 데이터가 아니라 사진이 있는 관람 기록을 보여주는 화면입니다)
========================================================= */

// ---------- 공통 저장/불러오기 함수 ----------
function loadData(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function saveData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/* =========================================================
   0. 모달(팝업) 열기/닫기 공통 함수
========================================================= */
function openModal(id) {
  document.getElementById(id).hidden = false;
}

function closeModal(id) {
  document.getElementById(id).hidden = true;
}

document.getElementById("open-record-modal").addEventListener("click", function () {
  resetRecordModalState();
  document.getElementById("record-form").reset();
  openModal("record-modal");
});

document.getElementById("open-event-modal").addEventListener("click", function () {
  openModal("event-modal");
});

// ✕ 버튼 또는 모달 바깥(어두운 배경) 클릭 시 닫기
document.querySelectorAll(".modal-close").forEach((btn) => {
  btn.addEventListener("click", function () {
    closeModal(this.dataset.closeModal);
  });
});

document.querySelectorAll(".modal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

// Esc 키로 열려있는 모달 닫기
document.addEventListener("keydown", function (e) {
  if (e.key !== "Escape") return;
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    if (!overlay.hidden) closeModal(overlay.id);
  });
});

/* =========================================================
   1. 관람 기록 (표 + 갤러리의 원본 데이터)
========================================================= */
const RECORDS_KEY = "musicalRecords";
let records = loadData(RECORDS_KEY, []);

function starsFromRating(n) {
  const num = Number(n) || 0;
  return "★".repeat(num) + "☆".repeat(5 - num);
}

function renderRecords() {
  const body = document.getElementById("record-body");
  body.innerHTML = "";

  if (records.length === 0) {
    body.innerHTML = `
      <tr class="empty-row">
        <td colspan="7">아직 등록된 관람 기록이 없어요. 아래에서 첫 공연을 기록해보세요 🎭</td>
      </tr>`;
    return;
  }

  records.forEach((r, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.title}</td>
      <td>${r.date}</td>
      <td>${r.venue}</td>
      <td>${r.cast}</td>
      <td>${starsFromRating(r.rating)}</td>
      <td>${r.review}</td>
      <td class="actions-cell">
        <button class="btn-edit" data-index="${i}" title="수정">✎</button>
        <button class="btn-delete" data-index="${i}" title="삭제">✕</button>
      </td>
    `;
    body.appendChild(tr);
  });
}

// 갤러리는 별도 저장소 없이, "사진이 첨부된 관람 기록"만 걸러서 보여줍니다.
function renderGallery() {
  const grid = document.getElementById("gallery-grid");
  grid.innerHTML = "";

  const withPhotos = records
    .map((r, i) => ({ ...r, index: i }))
    .filter((r) => r.photo);

  if (withPhotos.length === 0) {
    grid.innerHTML = `
      <div class="empty-card">
        <span class="empty-icon">📷</span>
        <p>아직 추가된 사진이 없어요</p>
      </div>`;
    return;
  }

  withPhotos.forEach((r) => {
    const figure = document.createElement("figure");
    figure.innerHTML = `
      <button class="card-edit" data-index="${r.index}" title="수정">✎</button>
      <button class="card-delete" data-index="${r.index}" title="삭제">✕</button>
      <img src="${r.photo}" alt="${r.title}">
      <figcaption>${r.title}</figcaption>
    `;
    grid.appendChild(figure);
  });
}

function addRecord(record) {
  records.push(record);
  // 관람일이 최근인 순서로 정렬
  records.sort((a, b) => (a.date < b.date ? 1 : -1));
  saveData(RECORDS_KEY, records);
  renderRecords();
  renderGallery();

  // 관람 기록을 추가하면 같은 날짜/제목으로 캘린더에도 "관람일" 태그를 자동으로 추가
  addWatchEvent(record.date, record.title);
}

// 기존 기록을 새 내용으로 교체 (날짜·제목이 바뀌면 캘린더 태그도 지웠다가 다시 생성)
function updateRecordAt(idx, newRecord) {
  const old = records[idx];
  if (!old) return;
  records[idx] = newRecord;
  records.sort((a, b) => (a.date < b.date ? 1 : -1));
  saveData(RECORDS_KEY, records);
  renderRecords();
  renderGallery();

  removeWatchEvent(old.date, old.title);
  addWatchEvent(newRecord.date, newRecord.title);
}

// 현재 record-form이 "새로 추가" 모드인지 "수정" 모드인지 표시 (null = 추가)
let editingIndex = null;

function resetRecordModalState() {
  editingIndex = null;
  document.getElementById("record-modal-title").textContent = "+ 새 기록 추가";
  document.getElementById("record-submit-btn").textContent = "추가하기";
  document.getElementById("r-photo-preview").hidden = true;
  document.getElementById("r-remove-photo-wrap").hidden = true;
  document.getElementById("r-remove-photo").checked = false;
}

// 표의 ✎ 또는 갤러리 카드의 ✎ 버튼을 누르면 해당 기록 내용을 폼에 채워서 수정 모드로 엶
function openEditModal(idx) {
  const r = records[idx];
  if (!r) return;
  editingIndex = idx;

  document.getElementById("r-title").value = r.title;
  document.getElementById("r-date").value = r.date;
  document.getElementById("r-venue").value = r.venue || "";
  document.getElementById("r-cast").value = r.cast || "";
  document.getElementById("r-rating").value = r.rating;
  document.getElementById("r-review").value = r.review || "";
  document.getElementById("r-photo").value = ""; // 보안상 파일 입력은 미리 채울 수 없음

  const preview = document.getElementById("r-photo-preview");
  const removeWrap = document.getElementById("r-remove-photo-wrap");
  document.getElementById("r-remove-photo").checked = false;
  if (r.photo) {
    preview.src = r.photo;
    preview.hidden = false;
    removeWrap.hidden = false;
  } else {
    preview.hidden = true;
    removeWrap.hidden = true;
  }

  document.getElementById("record-modal-title").textContent = "기록 수정";
  document.getElementById("record-submit-btn").textContent = "수정하기";

  openModal("record-modal");
}

document.getElementById("record-form").addEventListener("submit", function (e) {
  e.preventDefault();

  const title = document.getElementById("r-title").value.trim();
  const date = document.getElementById("r-date").value;
  const venue = document.getElementById("r-venue").value.trim();
  const cast = document.getElementById("r-cast").value.trim();
  const rating = document.getElementById("r-rating").value;
  const review = document.getElementById("r-review").value.trim();
  const file = document.getElementById("r-photo").files[0];
  const removePhoto = document.getElementById("r-remove-photo").checked;

  if (!title || !date) return;

  const form = this;

  function finalize(newPhotoDataUrl) {
    let photo = null;
    if (newPhotoDataUrl) {
      photo = newPhotoDataUrl; // 새로 선택한 사진으로 교체
    } else if (editingIndex !== null && !removePhoto) {
      photo = records[editingIndex].photo; // 수정 중이고 사진을 새로 안 골랐으면 기존 사진 유지
    }

    const recordData = { title, date, venue, cast, rating, review, photo };

    if (editingIndex === null) {
      addRecord(recordData);
    } else {
      updateRecordAt(editingIndex, recordData);
    }

    form.reset();
    closeModal("record-modal");
    resetRecordModalState();
  }

  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => finalize(event.target.result);
    reader.readAsDataURL(file);
  } else {
    finalize(null);
  }
});

// 표/갤러리 공용 삭제: 둘 다 같은 records 배열을 보고 있으므로 하나로 처리
function deleteRecordAt(idx) {
  const removed = records[idx];
  if (!removed) return;
  records.splice(idx, 1);
  saveData(RECORDS_KEY, records);
  renderRecords();
  renderGallery();

  // 표/갤러리에서 지운 기록과 짝을 이루던 캘린더의 "관람일" 태그도 같이 제거
  removeWatchEvent(removed.date, removed.title);
}

document.getElementById("record-body").addEventListener("click", function (e) {
  if (e.target.classList.contains("btn-delete")) {
    deleteRecordAt(Number(e.target.dataset.index));
  } else if (e.target.classList.contains("btn-edit")) {
    openEditModal(Number(e.target.dataset.index));
  }
});

document.getElementById("gallery-grid").addEventListener("click", function (e) {
  if (e.target.classList.contains("card-delete")) {
    deleteRecordAt(Number(e.target.dataset.index));
  } else if (e.target.classList.contains("card-edit")) {
    openEditModal(Number(e.target.dataset.index));
  }
});

/* =========================================================
   2. 캘린더
========================================================= */
const EVENTS_KEY = "musicalEvents";
let events = loadData(EVENTS_KEY, {}); // { "2026-08-05": [{type, title}, ...] }

// 관람 기록을 추가할 때, 같은 날짜/제목으로 캘린더에도 "관람일" 태그를 자동 등록
function addWatchEvent(dateStr, title) {
  if (!dateStr || !title) return;
  if (!events[dateStr]) events[dateStr] = [];
  events[dateStr].push({ type: "watch", title: title });
  saveData(EVENTS_KEY, events);
  renderCalendar();
}

// 기록을 지울 때, 짝을 이루던 캘린더의 "관람일" 태그도 같이 제거
function removeWatchEvent(dateStr, title) {
  if (!dateStr || !events[dateStr]) return;
  const idx = events[dateStr].findIndex((ev) => ev.type === "watch" && ev.title === title);
  if (idx === -1) return;
  events[dateStr].splice(idx, 1);
  if (events[dateStr].length === 0) delete events[dateStr];
  saveData(EVENTS_KEY, events);
  renderCalendar();
}

const today = new Date();
let viewYear = today.getFullYear();
let viewMonth = today.getMonth(); // 0~11

function pad2(n) {
  return String(n).padStart(2, "0");
}

function dateKey(y, m, d) {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`;
}

function renderCalendar() {
  document.getElementById("calendar-title").textContent = `${viewYear}년 ${viewMonth + 1}월`;

  const grid = document.getElementById("calendar-grid");
  grid.innerHTML = "";

  ["일", "월", "화", "수", "목", "금", "토"].forEach((w) => {
    const li = document.createElement("li");
    li.className = "weekday";
    li.textContent = w;
    grid.appendChild(li);
  });

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const totalCells = firstWeekday + daysInMonth;
  const trailing = (7 - (totalCells % 7)) % 7;

  for (let i = 0; i < firstWeekday; i++) {
    const li = document.createElement("li");
    li.className = "empty";
    grid.appendChild(li);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const li = document.createElement("li");
    const key = dateKey(viewYear, viewMonth, d);
    const isToday =
      viewYear === today.getFullYear() &&
      viewMonth === today.getMonth() &&
      d === today.getDate();
    if (isToday) li.classList.add("today");

    let tagsHtml = "";
    (events[key] || []).forEach((ev, i) => {
      const cls = ev.type === "watch" ? "tag-watch" : "tag-ticket";
      tagsHtml += `<span class="tag ${cls}" data-date="${key}" data-index="${i}" title="클릭하면 삭제됩니다">${ev.title}</span>`;
    });

    li.innerHTML = `<span class="day-num">${d}</span>${tagsHtml}`;
    grid.appendChild(li);
  }

  for (let i = 0; i < trailing; i++) {
    const li = document.createElement("li");
    li.className = "empty";
    grid.appendChild(li);
  }
}

document.getElementById("prev-month").addEventListener("click", function () {
  viewMonth--;
  if (viewMonth < 0) {
    viewMonth = 11;
    viewYear--;
  }
  renderCalendar();
});

document.getElementById("next-month").addEventListener("click", function () {
  viewMonth++;
  if (viewMonth > 11) {
    viewMonth = 0;
    viewYear++;
  }
  renderCalendar();
});

// 이 폼은 이제 "티켓팅 날짜" 전용입니다. 관람일은 위 관람 기록 등록 시 자동으로 생깁니다.
document.getElementById("event-form").addEventListener("submit", function (e) {
  e.preventDefault();

  const dateVal = document.getElementById("e-date").value; // "YYYY-MM-DD"
  const title = document.getElementById("e-title").value.trim();
  if (!dateVal || !title) return;

  if (!events[dateVal]) events[dateVal] = [];
  events[dateVal].push({ type: "ticket", title: title });
  saveData(EVENTS_KEY, events);

  // 추가한 날짜가 보이도록 해당 월로 이동
  const [y, m] = dateVal.split("-").map(Number);
  viewYear = y;
  viewMonth = m - 1;

  renderCalendar();
  this.reset();
  closeModal("event-modal");
});

document.getElementById("calendar-grid").addEventListener("click", function (e) {
  if (!e.target.classList.contains("tag")) return;
  const key = e.target.dataset.date;
  const idx = Number(e.target.dataset.index);
  events[key].splice(idx, 1);
  if (events[key].length === 0) delete events[key];
  saveData(EVENTS_KEY, events);
  renderCalendar();
});

/* =========================================================
   3. 데이터 내보내기 / 불러오기 (백업 · 기기 이동용)
========================================================= */
document.getElementById("export-data-btn").addEventListener("click", function () {
  const backup = {
    records: records,
    events: events,
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const today = new Date().toISOString().slice(0, 10);

  const a = document.createElement("a");
  a.href = url;
  a.download = `뮤지컬_관극_일지_백업_${today}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

document.getElementById("import-data-btn").addEventListener("click", function () {
  document.getElementById("import-file-input").click();
});

document.getElementById("import-file-input").addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function () {
    let parsed;
    try {
      parsed = JSON.parse(reader.result);
    } catch (err) {
      alert("파일을 읽을 수 없어요. 올바른 백업 파일(.json)인지 확인해주세요.");
      e.target.value = "";
      return;
    }

    const validRecords = Array.isArray(parsed.records);
    const validEvents = parsed.events && typeof parsed.events === "object" && !Array.isArray(parsed.events);
    if (!validRecords || !validEvents) {
      alert("백업 파일 형식이 올바르지 않아요.");
      e.target.value = "";
      return;
    }

    const ok = confirm(
      "불러오기를 하면 지금 이 브라우저에 저장된 기록이 파일 내용으로 덮어써져요. 계속할까요?"
    );
    if (!ok) {
      e.target.value = "";
      return;
    }

    records = parsed.records;
    events = parsed.events;
    saveData(RECORDS_KEY, records);
    saveData(EVENTS_KEY, events);

    renderRecords();
    renderGallery();
    renderCalendar();
    e.target.value = "";
    alert("불러오기가 완료됐어요!");
  };
  reader.readAsText(file);
});

/* ---------- 초기 렌더링 ---------- */
renderRecords();
renderGallery();
renderCalendar();
