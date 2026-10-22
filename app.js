'use strict';
/* E-Watch – giám sát môi trường bằng camera + AI chạy trên trình duyệt, liên thông bằng WebRTC (PeerJS). */

const $ = id => document.getElementById(id);
const video = $('video'), overlay = $('overlay'), octx = overlay.getContext('2d');
const W = 80, H = 60, N = W * H;
const work = document.createElement('canvas'); work.width = W; work.height = H;
const wctx = work.getContext('2d', { willReadFrequently: true });
const crop = document.createElement('canvas'); crop.width = 40; crop.height = 40;
const cctx = crop.getContext('2d', { willReadFrequently: true });

const VN = { person:'Người', bird:'Chim', cat:'Mèo', dog:'Chó', horse:'Ngựa', sheep:'Cừu', cow:'Bò', elephant:'Voi',
  bear:'Gấu', zebra:'Ngựa vằn', giraffe:'Hươu cao cổ', 'potted plant':'Cây cảnh', car:'Ô tô', truck:'Xe tải',
  bus:'Xe buýt', motorcycle:'Xe máy', bicycle:'Xe đạp' };
const ANIMALS = new Set(['bird','cat','dog','horse','sheep','cow','elephant','bear','zebra','giraffe']);
const VEHICLES = new Set(['car','truck','bus','motorcycle','bicycle']);
const LEVELS = new Set(['info','warn','danger']);
const COOLDOWN = { info: 60000, warn: 25000, danger: 15000 };

const S = {
  model: null, stream: null, running: false, wake: null,
  peer: null, conns: new Map(), isHost: false, room: null,
  tracks: [], nextId: 0, prev: null, baseline: null, hist: [],
  lastTerrain: 0, lastPlant: 0, fireStreak: 0, lastAlert: {}, audio: null, gps: null
};

/* ---------- Tiện ích ---------- */
const deviceName = () => ($('devName').value.trim() || 'Thiết bị ' + (S.peer?.id || '').slice(-4)).slice(0, 30);
const setStatus = t => { $('hud').textContent = t; };
try { $('devName').value = localStorage.getItem('ew_name') || ''; } catch {}
$('devName').addEventListener('change', () => { try { localStorage.setItem('ew_name', $('devName').value); } catch {} });
$('sens').oninput = e => $('sensVal').textContent = e.target.value;
$('crowd').oninput = e => $('crowdVal').textContent = e.target.value;

/* ---------- Cảnh báo ---------- */
function beep(level) {
  try {
    S.audio = S.audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = S.audio.createOscillator(), g = S.audio.createGain();
    o.frequency.value = level === 'danger' ? 880 : 560; o.type = 'square';
    g.gain.value = 0.08; o.connect(g); g.connect(S.audio.destination);
    o.start(); o.stop(S.audio.currentTime + (level === 'danger' ? 0.7 : 0.25));
  } catch {}
}

function addFeed(a) {
  const feed = $('feed');
  if (feed.firstChild && !feed.firstChild.dataset.real) feed.innerHTML = '';
  const li = document.createElement('li'); li.className = 'lv-' + a.level; li.dataset.real = '1';
  const meta = document.createElement('div'); meta.className = 'meta';
  meta.textContent = `${new Date(a.ts).toLocaleTimeString('vi-VN')} · ${a.from}${a.loc ? ' · ' + a.loc : ''}${a.remote ? ' (từ xa)' : ''}`;
  const body = document.createElement('div'); body.textContent = a.text;   // textContent: chống chèn mã từ máy khác
  li.append(meta, body); feed.prepend(li);
  while (feed.children.length > 100) feed.lastChild.remove();
}

function present(a) {
  addFeed(a);
  if (a.level !== 'info') {
    beep(a.level);
    if (navigator.vibrate) navigator.vibrate(a.level === 'danger' ? [300, 100, 300, 100, 600] : [200]);
    document.body.classList.remove('alarm'); void document.body.offsetWidth; document.body.classList.add('alarm');
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification((a.level === 'danger' ? '🚨 ' : '⚠️ ') + a.from, { body: a.text, tag: a.type }); } catch {}
    }
  }
}

function raise(type, level, text, force = false) {
  const key = type + level, now = Date.now();
  if (!force && S.lastAlert[key] && now - S.lastAlert[key] < COOLDOWN[level]) return;
  S.lastAlert[key] = now;
  const a = { type, level, text, from: deviceName(), ts: now,
    loc: ($('useGps').checked && S.gps) ? `${S.gps.latitude.toFixed(5)},${S.gps.longitude.toFixed(5)}` : '' };
  present(a);
  broadcast({ t: 'alert', a });
}

function sanitize(a) {
  if (!a || typeof a !== 'object') return null;
  return { type: String(a.type || '').slice(0, 20), level: LEVELS.has(a.level) ? a.level : 'info',
    text: String(a.text || '').slice(0, 300), from: String(a.from || 'Không rõ').slice(0, 30),
    ts: Number.isFinite(a.ts) ? a.ts : Date.now(), loc: String(a.loc || '').slice(0, 40), remote: true };
}

/* ---------- Kết nối liên thông (WebRTC qua PeerJS) ---------- */
function broadcast(msg) { for (const c of S.conns.values()) if (c.open) c.send(msg); }
function updateNet() {
  const n = S.conns.size + (S.peer ? 1 : 0);
  $('peerCount').textContent = S.peer ? n : 0;
  const b = $('netBadge');
  b.className = 'badge ' + (S.room ? 'on' : 'off');
  b.textContent = S.room ? `Phòng ${S.room} · ${n} máy` : 'Chưa kết nối';
}
function leave() {
  for (const c of S.conns.values()) try { c.close(); } catch {}
  S.conns.clear(); if (S.peer) try { S.peer.destroy(); } catch {}
  S.peer = null; S.room = null; S.isHost = false; updateNet();
}
function setupConn(conn) {
  conn.on('open', () => { S.conns.set(conn.peer, conn); updateNet();
    present({ type: 'net', level: 'info', text: 'Có thiết bị mới kết nối vào phòng.', from: 'Hệ thống', ts: Date.now(), loc: '' }); });
  conn.on('data', d => {
    if (!d || d.t !== 'alert') return;
    const a = sanitize(d.a); if (!a) return;
    present(a);
    if (S.isHost) for (const c of S.conns.values()) if (c !== conn && c.open) c.send({ t: 'alert', a: d.a }); // host chuyển tiếp
  });
  const drop = () => { S.conns.delete(conn.peer); updateNet(); };
  conn.on('close', drop); conn.on('error', drop);
}
function createRoom() {
  leave();
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  const peer = new Peer('ewatch-' + code);
  S.peer = peer; S.isHost = true;
  peer.on('open', () => { S.room = code; updateNet();
    $('roomInfo').textContent = `Mã phòng của bạn: ${code} — gửi mã này cho các máy khác.`; });
  peer.on('connection', setupConn);
  peer.on('error', e => { if (e.type === 'unavailable-id') createRoom(); else $('roomInfo').textContent = 'Lỗi kết nối: ' + e.type; });
}
function joinRoom() {
  const code = $('joinCode').value.trim().toUpperCase();
  if (code.length < 4) { $('roomInfo').textContent = 'Hãy nhập mã phòng.'; return; }
  leave();
  const peer = new Peer(); S.peer = peer;
  peer.on('open', () => {
    const c = peer.connect('ewatch-' + code, { reliable: true });
    setupConn(c); S.room = code; updateNet();
    $('roomInfo').textContent = 'Đang vào phòng ' + code + '…';
  });
  peer.on('error', e => { $('roomInfo').textContent = e.type === 'peer-unavailable' ? 'Không tìm thấy phòng này.' : 'Lỗi kết nối: ' + e.type; if (e.type === 'peer-unavailable') leave(); });
}
$('btnCreate').onclick = createRoom;
$('btnJoin').onclick = joinRoom;

/* ---------- Camera + AI ---------- */
async function start() {
  if (!navigator.mediaDevices?.getUserMedia) { alert('Trình duyệt không hỗ trợ camera (cần HTTPS).'); return; }
  $('btnStart').disabled = true;
  try {
    setStatus('Đang xin quyền camera…');
    S.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: $('facing').value, width: { ideal: 640 } }, audio: false });
    video.srcObject = S.stream; await video.play();
    if (!S.model) { setStatus('Đang tải mô hình AI (lần đầu hơi lâu)…'); S.model = await cocoSsd.load({ base: 'lite_mobilenet_v2' }); }
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    if ($('useGps').checked && navigator.geolocation) navigator.geolocation.getCurrentPosition(p => S.gps = p.coords, () => {});
    try { S.wake = await navigator.wakeLock?.request('screen'); } catch {}
    S.running = true; S.prev = null; S.baseline = null; S.hist = []; S.tracks = [];
    $('btnStop').disabled = false; setStatus('Đang giám sát…');
    present({ type: 'sys', level: 'info', text: 'Bắt đầu giám sát.', from: deviceName(), ts: Date.now(), loc: '' });
    loop();
  } catch (e) { setStatus('Lỗi: ' + e.message); $('btnStart').disabled = false; }
}
function stop() {
  S.running = false; S.stream?.getTracks().forEach(t => t.stop()); S.stream = null;
  try { S.wake?.release(); } catch {}
  octx.clearRect(0, 0, overlay.width, overlay.height);
  $('btnStart').disabled = false; $('btnStop').disabled = true; setStatus('Đã dừng');
}
$('btnStart').onclick = start; $('btnStop').onclick = stop;
$('btnBase').onclick = () => { S.baseline = null; S.hist = []; };
$('btnTest').onclick = () => raise('test', 'warn', 'Đây là cảnh báo thử nghiệm.', true);
document.addEventListener('visibilitychange', async () => {   // lấy lại wake lock khi quay lại tab
  if (S.running && document.visibilityState === 'visible') try { S.wake = await navigator.wakeLock?.request('screen'); } catch {}
});

async function loop() {
  if (!S.running) return;
  const t0 = performance.now();
  try {
    const preds = await S.model.detect(video, 15, 0.5);
    drawBoxes(preds); analyzeObjects(preds, Date.now()); analyzeFrame(preds);
  } catch (e) { console.error(e); }
  setTimeout(loop, Math.max(50, 500 - (performance.now() - t0)));
}

function drawBoxes(preds) {
  overlay.width = video.videoWidth; overlay.height = video.videoHeight;
  octx.lineWidth = Math.max(2, overlay.width / 200); octx.font = `${Math.max(12, overlay.width / 40)}px sans-serif`;
  let p = 0, a = 0, pl = 0, v = 0;
  for (const d of preds) {
    if (!VN[d.class]) continue;
    const isP = d.class === 'person', isA = ANIMALS.has(d.class), isV = VEHICLES.has(d.class), isPl = d.class === 'potted plant';
    if (isP) p++; else if (isA) a++; else if (isV) v++; else if (isPl) pl++;
    const col = isP ? '#3b82f6' : isA ? '#f59e0b' : isPl ? '#22c55e' : '#a78bfa';
    const [x, y, w, h] = d.bbox; octx.strokeStyle = col; octx.strokeRect(x, y, w, h);
    const label = `${VN[d.class]} ${Math.round(d.score * 100)}%`;
    octx.fillStyle = col; octx.fillRect(x, y - 18, octx.measureText(label).width + 8, 18);
    octx.fillStyle = '#000'; octx.fillText(label, x + 4, y - 4);
  }
  $('sPerson').textContent = p; $('sAnimal').textContent = a; $('sPlant').textContent = pl; $('sVehicle').textContent = v;
  S.counts = { p, a, pl, v };
}

/* ---------- Phân tích đối tượng & dự đoán xu hướng ---------- */
function analyzeObjects(preds, now) {
  const fw = video.videoWidth, fh = video.videoHeight, used = new Set(), cur = [];
  for (const d of preds) {
    if (!VN[d.class] || d.class === 'potted plant') continue;
    const [x, y, w, h] = d.bbox, cx = x + w / 2, cy = y + h / 2;
    let best = null, bd = fw * 0.2;
    for (const t of S.tracks) { if (t.cls !== d.class || used.has(t)) continue;
      const dist = Math.hypot(t.cx - cx, t.cy - cy); if (dist < bd) { bd = dist; best = t; } }
    const t = best || { id: ++S.nextId, cls: d.class, hist: [] };
    used.add(t); Object.assign(t, { cx, cy, w, h, seen: now });
    t.hist.push({ t: now, w, h }); t.hist = t.hist.filter(e => now - e.t < 2500); cur.push(t);
  }
  S.tracks = [...cur, ...S.tracks.filter(t => !used.has(t) && now - t.seen < 1000)];
  for (const t of cur) {
    const o = t.hist[0]; if (now - o.t < 800) continue;
    if (t.cls === 'person' && o.h / o.w > 1.3 && t.h / t.w < 0.9)
      raise('fall', 'danger', 'Nghi có người bị ngã / nằm xuống đột ngột.');
    const growth = (t.w * t.h) / (o.w * o.h);
    if (growth > 1.7 && (t.w * t.h) / (fw * fh) > 0.04)
      raise('approach', 'warn', `${VN[t.cls]} đang tiến lại gần camera rất nhanh.`);
  }
  const c = S.counts || {};
  if (c.p >= +$('crowd').value) raise('crowd', 'warn', `Phát hiện đông người (${c.p} người trong khung hình).`);
  if ($('guard').checked && c.p > 0) raise('guard', 'danger', `Chế độ canh gác: có ${c.p} người xuất hiện.`);
  if (c.a > 0) raise('animal', 'info', `Phát hiện ${c.a} động vật trong khung hình.`);
  if (now - S.lastPlant > 10000) { S.lastPlant = now; for (const d of preds) if (d.class === 'potted plant') plantCheck(d.bbox); }
}

function plantCheck([x, y, w, h]) {
  try {
    cctx.drawImage(video, x, y, w, h, 0, 0, 40, 40);
    const px = cctx.getImageData(0, 0, 40, 40).data; let green = 0, yb = 0;
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i], g = px[i + 1], b = px[i + 2];
      if (g > r * 1.05 && g > b * 1.1) green++; else if (r > 90 && r > g * 0.85 && g > b * 1.15) yb++;
    }
    const veg = green + yb;
    if (veg > 400 && yb / veg > 0.45) raise('plant', 'info', 'Cây có dấu hiệu úa vàng / khô – nên kiểm tra tưới nước, ánh sáng.');
  } catch {}
}

/* ---------- Phân tích biến động khung hình (địa hình, lửa, che camera) ---------- */
function grab() {
  wctx.drawImage(video, 0, 0, W, H);
  const d = wctx.getImageData(0, 0, W, H).data, g = new Float32Array(N); let sum = 0, fire = 0;
  for (let i = 0, j = 0; i < N; i++, j += 4) {
    const r = d[j], gg = d[j + 1], b = d[j + 2];
    g[i] = 0.299 * r + 0.587 * gg + 0.114 * b; sum += g[i];
    if (r > 200 && gg > 90 && gg < 200 && b < 90 && r > gg && gg > b) fire++;
  }
  return { g, mean: sum / N, fire: fire / N };
}
function diff(a, b) {            // tỉ lệ điểm ảnh thay đổi, đã bù chênh lệch sáng toàn cục
  const shift = a.mean - b.mean; let n = 0;
  for (let i = 0; i < N; i++) if (Math.abs(a.g[i] - b.g[i] - shift) > 28) n++;
  return n / N;
}
function analyzeFrame() {
  const cur = grab(), now = Date.now(), sens = +$('sens').value;
  if (cur.mean < 8) raise('blocked', 'warn', 'Camera bị che hoặc không đủ ánh sáng.');
  if ($('fire').checked) {
    S.fireStreak = cur.fire > 0.03 ? S.fireStreak + 1 : 0;
    if (S.fireStreak >= 3) raise('fire', 'danger', 'Nghi có lửa / vật phát sáng màu cam-đỏ trong khung hình (cần xác nhận bằng mắt).');
  }
  if (S.prev) {
    const f = diff(cur, S.prev); $('sChange').textContent = Math.round(f * 100) + '%';
    if (f > 0.4) raise('shake', 'warn', 'Biến động mạnh đột ngột toàn khung hình (rung lắc, vật đổ hoặc bị che).');
  }
  S.prev = cur;
  if ($('terrain').checked) {
    if (!S.baseline) { S.baseline = cur; S.hist = []; return; }
    if (now - S.lastTerrain < 2000) return; S.lastTerrain = now;
    const f = diff(cur, S.baseline); S.hist.push(f); if (S.hist.length > 8) S.hist.shift();
    const thr = 0.22 - 0.018 * sens, h = S.hist.slice(-3), pct = Math.round(f * 100);
    if (f > thr * 1.8) raise('terrain', 'danger', `Địa hình/khung cảnh thay đổi lớn (${pct}% so với mốc) – nguy cơ sạt lở, đổ, dịch chuyển. Cần kiểm tra ngay.`);
    else if (f > thr && h.length === 3 && h[0] <= h[1] + 0.005 && h[1] <= h[2] + 0.005 && h[2] > h[0])
      raise('terrain', 'warn', `Khung cảnh đang biến đổi tăng dần (${pct}% so với mốc) – có dấu hiệu dịch chuyển bất thường.`);
  }
}
