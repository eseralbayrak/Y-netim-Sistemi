// GKYS Solo — Paylaşımlı Sunucu
// Node.js dışında bağımlılık gerektirmez (npm install ile sadece express kurulur).
// Çalıştırma (Linux/Mac): DATA_DIR=/gercek/data/yolu PORT=5173 node server.js
// Çalıştırma (Windows PowerShell): $env:DATA_DIR="D:\Data\GKYS"; $env:PORT="5173"; node server.js
// Windows'ta kolaylık için: start-server.bat dosyasına çift tıklayın (içindeki yolu düzenleyin)

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const https = require("https");

const PORT = Number(process.env.PORT || 3000);
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 3443);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const FRONTEND_DIST = path.join(__dirname, "..", "dist");
const CERT_DIR = path.join(__dirname, "..", "cert");
const CERT_KEY_FILE = path.join(CERT_DIR, "key.pem");
const CERT_CERT_FILE = path.join(CERT_DIR, "cert.pem");
const USE_HTTPS_ONLY = process.env.HTTPS === "true" || process.env.HTTPS === "1" || process.env.USE_HTTPS === "1";

// ---- Klasörleri hazırla ----
try {
  for (const dir of [
    DATA_DIR,
    UPLOADS_DIR,
    path.join(UPLOADS_DIR, "coa"),
    path.join(UPLOADS_DIR, "tds"),
    path.join(UPLOADS_DIR, "msds"),
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }
} catch (err) {
  console.error("\n=== HATA: Veri klasörü oluşturulamadı ===");
  console.error(`DATA_DIR olarak ayarlanan yol: ${DATA_DIR}`);
  console.error(
    "\nBu yol bu bilgisayarda mevcut değil (örn. D: diski yok ya da " +
      "\"Data\" paylaşımı bu yolda değil)."
  );
  console.error(
    "\nDüzeltmek için: start-server.bat (veya start-server.ps1) dosyasını " +
      "Not Defteri ile açıp DATA_DIR satırındaki yolu, bu bilgisayarda " +
      "GERÇEKTEN var olan bir klasörle değiştirin."
  );
  console.error(
    "Sunucudaki paylaşılan \"Data\" klasörünün gerçek yerel yolunu bulmak " +
      'için PowerShell\'de: Get-SmbShare | Format-Table Name, Path\n'
  );
  console.error(`Ayrıntı: ${err.message}\n`);
  process.exit(1);
}

const DB_FILE = path.join(DATA_DIR, "db.json");
const MATERIALS_FILE = path.join(DATA_DIR, "materials.json");
const SUPPLIERS_FILE = path.join(DATA_DIR, "suppliers.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const SUPPLIERS_DETAIL_FILE = path.join(DATA_DIR, "suppliers-detail.json");
const LABEL_SETTINGS_FILE = path.join(DATA_DIR, "label-settings.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const AUDIT_FILE = path.join(DATA_DIR, "audit-log.json");
const FORM_METADATA_FILE = path.join(DATA_DIR, "form-metadata.json");
const STORAGE_PATHS_FILE = path.join(DATA_DIR, "storage-paths.json");
const SECRET_FILE = path.join(DATA_DIR, ".secret");
const REMINDERS_FILE = path.join(DATA_DIR, "reminders.json");

const DEFAULT_STORAGE_PATHS = {
  msds: {
    id: "msds",
    label: "MSDS (Güvenlik Bilgi Formları)",
    path: "",
    defaultPath: "data/uploads/msds",
    description: "Hammadde ve kimyasallara ait Güvenlik Bilgi Formları (MSDS) PDF dosyaları",
  },
  tds: {
    id: "tds",
    label: "TDS (Teknik Bilgi Formları)",
    path: "",
    defaultPath: "data/uploads/tds",
    description: "Hammadde ve malzemelere ait Teknik Spekt ve Veri Sayfaları (TDS) PDF dosyaları",
  },
  coa: {
    id: "coa",
    label: "COA (Analiz Sertifikaları - Giriş Kalite)",
    path: "",
    defaultPath: "data/uploads/coa",
    description: "Tedarikçi Giriş Kalite partilerine ait Analiz Sertifikası (CoA) PDF dosyaları",
  },
  yardimciParca: {
    id: "yardimciParca",
    label: "Yardımcı Parça Rapor ve Dokümanları",
    path: "",
    defaultPath: "data/uploads/yardimciParca",
    description: "Civata, somun, koli, ambalaj ve yardımcı parçalara ait teknik çizim, TDS ve spekt belgeleri",
  },
  kaliteRaporlari: {
    id: "kaliteRaporlari",
    label: "Giriş Kalite Diğer Raporları (Final Kontrol / Kaplama)",
    path: "",
    defaultPath: "data/uploads/kaliteRaporlari",
    description: "Partilere ait Final Kontrol, Kaplama ve Malzeme Test Raporları",
  },
  genel: {
    id: "genel",
    label: "Genel Arşiv & Ek Dokümanlar",
    path: "",
    defaultPath: "data/uploads/genel",
    description: "Diğer ek belgeler, IATF dokümanları ve genel arşiv dosyaları",
  },
};

const AUXILIARY_PARTS_FILE = path.join(DATA_DIR, "auxiliary_parts.json");
const AUXILIARY_SUPPLIERS_FILE = path.join(DATA_DIR, "auxiliary_suppliers.json");
const AUXILIARY_DB_FILE = path.join(DATA_DIR, "auxiliary_db.json");

const SEMI_FINISHED_PARTS_FILE = path.join(DATA_DIR, "semi_finished_parts.json");
const SEMI_FINISHED_DB_FILE = path.join(DATA_DIR, "semi_finished_db.json");
const FINISHED_GOODS_FILE = path.join(DATA_DIR, "finished_goods.json");
const FINISHED_GOODS_DB_FILE = path.join(DATA_DIR, "finished_goods_db.json");

const DEFAULT_FORM_METADATA = [
  {
    id: "SAT_F09",
    formAdi: "Satın Alma Sipariş Formu",
    formKodu: "SAT/F09",
    yururlukTarihi: "08.03.2004",
    revTarihi: "28.09.2022",
    revNo: "03",
  },
  {
    id: "STK_F01",
    formAdi: "Hammadde Stok Takip Raporu",
    formKodu: "STK/F01",
    yururlukTarihi: "15.01.2010",
    revTarihi: "10.05.2023",
    revNo: "02",
  },
  {
    id: "GKT_F01",
    formAdi: "Giriş Kalite Kabul Fişi",
    formKodu: "GKT/F01",
    yururlukTarihi: "01.06.2012",
    revTarihi: "12.11.2023",
    revNo: "04",
  },
  {
    id: "MAL_F01",
    formAdi: "Malzeme Tanımları Formu",
    formKodu: "MAL/F01",
    yururlukTarihi: "05.04.2014",
    revTarihi: "18.01.2024",
    revNo: "01",
  },
  {
    id: "RAP_F01",
    formAdi: "Kalite Raporlama Formu",
    formKodu: "RAP/F01",
    yururlukTarihi: "20.02.2018",
    revTarihi: "15.08.2024",
    revNo: "02",
  },
  {
    id: "URT_F19",
    formAdi: "Parça ve Malzeme Tanıtım Etiketi",
    formKodu: "ÜRT/F 19",
    yururlukTarihi: "22.03.2002",
    revTarihi: "09.03.2011",
    revNo: "01",
  },
];

const SEED_MATERIALS = JSON.parse(
  fs.readFileSync(path.join(__dirname, "seed", "materials.json"), "utf-8")
);
let SEED_SUPPLIERS = [];
try {
  SEED_SUPPLIERS = JSON.parse(
    fs.readFileSync(path.join(__dirname, "seed", "suppliers.json"), "utf-8")
  );
} catch {
  SEED_SUPPLIERS = readJson(SUPPLIERS_FILE, []);
}

const DEFAULT_LABEL_SETTINGS = {
  widthMm: 100,
  heightMm: 50,
  headerText: "B.R. LEVENT PLASTİK",
  footerText: "GİRİŞ KALİTE ONAYLI — DEPO KULLANIMI İÇİNDİR",
};

// ---- Basit dosya tabanlı okuma/yazma (eşzamanlı erişim için kilitli yazım) ----
let writeQueue = Promise.resolve();
function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (e) {
    console.error(`Okuma hatası (${file}):`, e.message);
    return fallback;
  }
}

function renameWithRetry(source, destination, attempts = 5) {
  return new Promise((resolve, reject) => {
    const tryRename = (remaining) => {
      fs.rename(source, destination, (err) => {
        if (!err) return resolve();

        const canRetry = (err.code === "EPERM" || err.code === "EACCES") && remaining > 0;
        if (!canRetry) return reject(err);

        setTimeout(() => tryRename(remaining - 1), 75);
      });
    };

    tryRename(attempts);
  });
}

function writeJson(file, data) {
  const operation = writeQueue.catch(() => undefined).then(
    () =>
      new Promise((resolve, reject) => {
        const tmp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
        const serialized = JSON.stringify(data, null, 2);

        fs.writeFile(tmp, serialized, (writeError) => {
          if (writeError) return reject(writeError);

          renameWithRetry(tmp, file).then(resolve).catch((renameError) => {
            fs.unlink(tmp, () => reject(renameError));
          });
        });
      })
  );

  writeQueue = operation.catch((error) => {
    console.error(`Yazma hatası (${file}):`, error.message);
  });

  return operation;
}

function loadDb() {
  return readJson(DB_FILE, { receipts: [], movements: [], lots: {} });
}
function saveDb(db) {
  return writeJson(DB_FILE, db);
}

const MATERIAL_SPEC_FIELDS = [
  ["yogunlukMin", "yogunlukMax", "yogunlukMinMax"],
  ["mfrMin", "mfrMax", "mfrMinMax"],
  ["sertlikMin", "sertlikMax", "sertlikMinMax"],
  ["vizkoziteMin", "vizkoziteMax", "vizkoziteMinMax"],
  ["katkiMin", "katkiMax", "katkiMinMax"],
  ["renkFarkiDEMin", "renkFarkiDEMax", "renkFarkiDE"],
];

function parseLegacySpecRange(value) {
  if (value === null || value === undefined || String(value).trim() === "") return {};
  const text = String(value).trim().replace(/\s+/g, " ");
  const normalized = text.replace(/,/g, ".");
  const compareValue = normalized.match(/[<>]\s*(-?\d+(?:\.\d+)?)/);
  if (compareValue) {
    const number = Number(compareValue[1]);
    return text.includes(">") ? { min: number } : { max: number };
  }

  // Eski kayıtlardaki "13,-16,8" biçimi 13,0 - 16,8 anlamına gelir.
  const splitDecimalRange = text.match(/^\s*(-?\d+)\s*,\s*-?(\d+)\s*,\s*(\d+)\b/);
  if (splitDecimalRange) {
    return { min: Number(splitDecimalRange[1]), max: Number(`${splitDecimalRange[2]}.${splitDecimalRange[3]}`) };
  }

  const range = normalized.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };

  const numbers = normalized.match(/-?\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) || [];
  if (numbers.length >= 2) return { min: Math.min(...numbers), max: Math.max(...numbers) };
  if (numbers.length === 1) return { min: numbers[0], max: numbers[0] };
  return {};
}

function normalizeMaterialSpecs(list) {
  let changed = false;
  const normalized = list.map((material) => {
    const next = { ...material };
    for (const [minKey, maxKey, legacyKey] of MATERIAL_SPEC_FIELDS) {
      if (!next[legacyKey]) continue;

      const range = parseLegacySpecRange(next[legacyKey]);
      if (range.min !== undefined && next[minKey] !== range.min) {
        next[minKey] = range.min;
        changed = true;
      }
      if (range.max !== undefined && next[maxKey] !== range.max) {
        next[maxKey] = range.max;
        changed = true;
      }
    }
    return next;
  });
  return { normalized, changed };
}

function loadMaterials() {
  const existing = readJson(MATERIALS_FILE, null);
  if (existing) {
    const { normalized, changed } = normalizeMaterialSpecs(existing);
    if (changed) {
      writeJson(MATERIALS_FILE, normalized).catch((error) => {
        console.error("Malzeme spec dönüşümü kaydedilemedi:", error.message);
      });
    }
    return normalized;
  }
  writeJson(MATERIALS_FILE, SEED_MATERIALS);
  return SEED_MATERIALS;
}
function saveMaterials(list) {
  return writeJson(MATERIALS_FILE, list);
}
function loadSuppliers() {
  const existing = readJson(SUPPLIERS_FILE, null);
  if (existing) return existing;
  writeJson(SUPPLIERS_FILE, SEED_SUPPLIERS);
  return SEED_SUPPLIERS;
}
function saveSuppliers(list) {
  return writeJson(SUPPLIERS_FILE, list);
}
function loadOrders() {
  return readJson(ORDERS_FILE, []);
}
function saveOrders(list) {
  return writeJson(ORDERS_FILE, list);
}
function loadSuppliersDetail() {
  return readJson(SUPPLIERS_DETAIL_FILE, []);
}
function saveSuppliersDetail(list) {
  return writeJson(SUPPLIERS_DETAIL_FILE, list);
}
function loadLabelSettings() {
  return readJson(LABEL_SETTINGS_FILE, DEFAULT_LABEL_SETTINGS);
}
function saveLabelSettings(s) {
  return writeJson(LABEL_SETTINGS_FILE, s);
}
function loadFormMetadata() {
  const current = readJson(FORM_METADATA_FILE, DEFAULT_FORM_METADATA);
  if (!Array.isArray(current)) return DEFAULT_FORM_METADATA;
  const existingIds = new Set(current.map((item) => item.id));
  const missing = DEFAULT_FORM_METADATA.filter((item) => !existingIds.has(item.id));
  if (missing.length > 0) {
    const merged = [...current, ...missing];
    saveFormMetadata(merged);
    return merged;
  }
  return current;
}
function saveFormMetadata(data) {
  return writeJson(FORM_METADATA_FILE, data);
}

function loadStoragePaths() {
  const current = readJson(STORAGE_PATHS_FILE, {});
  const merged = {};
  for (const [k, def] of Object.entries(DEFAULT_STORAGE_PATHS)) {
    if (current && current[k]) {
      merged[k] = { ...def, ...current[k] };
    } else {
      merged[k] = { ...def };
    }
  }
  return merged;
}

function saveStoragePaths(data) {
  return writeJson(STORAGE_PATHS_FILE, data);
}

function resolveStorageDirectory(kind) {
  const paths = loadStoragePaths();
  const conf = paths[kind] || paths.genel || DEFAULT_STORAGE_PATHS[kind] || DEFAULT_STORAGE_PATHS.genel;
  let targetDir = "";
  if (conf && conf.path && conf.path.trim()) {
    targetDir = conf.path.trim();
  } else {
    targetDir = path.join(UPLOADS_DIR, kind || "genel");
  }
  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
  } catch (e) {
    console.error(`[STORAGE] Dizin oluşturulamadı (${targetDir}):`, e.message);
    targetDir = path.join(UPLOADS_DIR, kind || "genel");
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
  }
  return targetDir;
}

function getStorageDirectoryStats(kind) {
  const paths = loadStoragePaths();
  const conf = paths[kind] || DEFAULT_STORAGE_PATHS[kind];
  let dir = "";
  if (conf && conf.path && conf.path.trim()) {
    dir = conf.path.trim();
  } else {
    dir = path.join(UPLOADS_DIR, kind);
  }
  const exists = fs.existsSync(dir);
  let fileCount = 0;
  let totalSizeBytes = 0;
  if (exists) {
    try {
      const files = fs.readdirSync(dir);
      for (const f of files) {
        const full = path.join(dir, f);
        try {
          const st = fs.statSync(full);
          if (st.isFile()) {
            fileCount++;
            totalSizeBytes += st.size;
          }
        } catch {}
      }
    } catch {}
  }
  return {
    ...conf,
    resolvedPath: dir,
    exists,
    fileCount,
    totalSizeBytes,
  };
}

function loadReminders() {
  return readJson(REMINDERS_FILE, { snoozeUntil: null });
}
function saveReminders(data) {
  return writeJson(REMINDERS_FILE, data);
}

function loadAuxiliaryParts() {
  return readJson(AUXILIARY_PARTS_FILE, []);
}
function saveAuxiliaryParts(list) {
  return writeJson(AUXILIARY_PARTS_FILE, list);
}
function loadAuxiliarySuppliers() {
  const existing = readJson(AUXILIARY_SUPPLIERS_FILE, null);
  if (existing && existing.length > 0) return existing;
  const parts = loadAuxiliaryParts();
  const set = new Set();
  parts.forEach((p) => {
    if (p.firma && p.firma.trim()) set.add(p.firma.trim());
  });
  const list = Array.from(set).sort();
  if (list.length > 0) {
    saveAuxiliarySuppliers(list);
  }
  return list;
}
function saveAuxiliarySuppliers(list) {
  return writeJson(AUXILIARY_SUPPLIERS_FILE, list);
}
function loadAuxiliaryDb() {
  return readJson(AUXILIARY_DB_FILE, { receipts: [], movements: [], lots: {} });
}
function saveAuxiliaryDb(db) {
  return writeJson(AUXILIARY_DB_FILE, db);
}

function loadSemiFinishedParts() {
  return readJson(SEMI_FINISHED_PARTS_FILE, []);
}
function saveSemiFinishedParts(list) {
  return writeJson(SEMI_FINISHED_PARTS_FILE, list);
}
function loadSemiFinishedDb() {
  return readJson(SEMI_FINISHED_DB_FILE, { movements: [] });
}
function saveSemiFinishedDb(db) {
  return writeJson(SEMI_FINISHED_DB_FILE, db);
}

function loadFinishedGoods() {
  return readJson(FINISHED_GOODS_FILE, []);
}
function saveFinishedGoods(list) {
  return writeJson(FINISHED_GOODS_FILE, list);
}
function loadFinishedGoodsDb() {
  return readJson(FINISHED_GOODS_DB_FILE, { movements: [] });
}
function saveFinishedGoodsDb(db) {
  return writeJson(FINISHED_GOODS_DB_FILE, db);
}

function genId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
}
function safeFileName(s) {
  return String(s).replace(/[\\/:*?"<>|]/g, "_").trim();
}

// =================== Kullanıcı / Rol / Kimlik Doğrulama (Faz 0) ===================

const VALID_ROLES = [
  "Yönetici",
  "Giriş Kalite",
  "Depo",
  "Satın Alma",
  "Üretim",
  "Raporlama",
  "Misafir",
];

// ---- İmza anahtarı: ilk çalıştırmada üretilir, DATA_DIR içinde kalıcı tutulur ----
// (Sunucu yeniden başlasa da mevcut oturum token'ları geçerliliğini korur.)
function getSecret() {
  if (fs.existsSync(SECRET_FILE)) return fs.readFileSync(SECRET_FILE, "utf-8").trim();
  const secret = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(SECRET_FILE, secret);
  return secret;
}
const SECRET = getSecret();

// ---- Şifre hash'leme (scrypt + tuz, ekstra kütüphane gerekmez) ----
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  try {
    const [salt, hash] = String(stored).split(":");
    const check = crypto.scryptSync(String(password), salt, 64).toString("hex");
    const a = Buffer.from(hash, "hex");
    const b = Buffer.from(check, "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ---- Basit imzalı oturum token'ı (HMAC-SHA256), 12 saat geçerli ----
const SESSION_MS = 12 * 60 * 60 * 1000;
function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}
function verifyToken(token) {
  try {
    const [body, sig] = String(token).split(".");
    if (!body || !sig) return null;
    const expected = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function defaultUsers() {
  return [
    {
      id: genId("U"),
      username: "admin",
      passwordHash: hashPassword("admin123"),
      role: "Yönetici",
      active: true,
      createdAt: new Date().toISOString(),
    },
  ];
}
function loadUsers() {
  const existing = readJson(USERS_FILE, null);
  if (existing) return existing;
  const seeded = defaultUsers();
  writeJson(USERS_FILE, seeded);
  console.log("\n=== İlk kullanıcı otomatik oluşturuldu ===");
  console.log("Kullanıcı adı: admin   Şifre: admin123");
  console.log("Güvenlik için ilk girişten sonra Yönetim Paneli'nden şifreyi değiştirin.\n");
  return seeded;
}
function saveUsers(list) {
  return writeJson(USERS_FILE, list);
}
function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    permissions: u.permissions || null,
    active: u.active,
    createdAt: u.createdAt
  };
}

// ---- Audit log: sadece ekleme, hiçbir kayıt silinmez/değiştirilmez ----
function loadAudit() {
  return readJson(AUDIT_FILE, []);
}
function appendAudit(entry) {
  const list = loadAudit();
  list.unshift({ id: genId("LOG"), date: new Date().toISOString(), ...entry });
  return writeJson(AUDIT_FILE, list);
}

// ---- Middleware ----
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const payload = token && verifyToken(token);
  if (!payload) return fail(res, 401, "Oturum geçersiz veya süresi dolmuş. Lütfen tekrar giriş yapın.");
  req.user = payload;
  next();
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return fail(res, 401, "Giriş yapılmamış.");
    if (!roles.includes(req.user.role)) return fail(res, 403, "Bu işlem için yetkiniz yok.");
    next();
  };
}

// ---- Belge (PDF) kaydetme — base64 data URL'yi yapılandırılan gerçek klasöre yazar ----
function saveDocument(kind, key, dataUrl, originalName) {
  const match = /^data:application\/pdf;base64,(.+)$/.exec(dataUrl) ||
                /^data:image\/(png|jpeg|jpg);base64,(.+)$/.exec(dataUrl) ||
                /^data:application\/[^;]+;base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Sadece geçerli PDF veya belge dosyası kabul edilir.");
  
  const base64Data = match[2] || match[1];
  const buffer = Buffer.from(base64Data, "base64");
  if (buffer.length > 25 * 1024 * 1024) throw new Error("Dosya çok büyük (25MB üstü).");
  
  let ext = ".pdf";
  if (originalName && originalName.includes(".")) {
    ext = path.extname(originalName).toLowerCase() || ".pdf";
  }
  
  const filename = `${safeFileName(key)}${ext}`;
  const targetDir = resolveStorageDirectory(kind);
  const filePath = path.join(targetDir, filename);
  fs.writeFileSync(filePath, buffer);
  
  return {
    name: originalName || filename,
    url: `/uploads/${kind}/${encodeURIComponent(filename)}`,
    uploadedAt: new Date().toISOString(),
    storagePath: filePath,
  };
}

// =================== Express App ===================

const app = express();
app.set("trust proxy", true);
app.use(express.json({ limit: "25mb" }));

// Custom upload serving from configured storage paths
app.get("/uploads/:kind/:filename", (req, res, next) => {
  const { kind, filename } = req.params;
  const decoded = decodeURIComponent(filename);
  const clean = path.basename(decoded);
  
  // 1. Custom configured directory
  const customDir = resolveStorageDirectory(kind);
  const customPath = path.join(customDir, clean);
  if (fs.existsSync(customPath)) {
    res.type(path.extname(clean));
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.sendFile(customPath);
  }
  
  // 2. Default UPLOADS_DIR/kind
  const defaultPath = path.join(UPLOADS_DIR, kind, clean);
  if (fs.existsSync(defaultPath)) {
    res.type(path.extname(clean));
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.sendFile(defaultPath);
  }
  
  // 3. Fallback uploads root
  const rootPath = path.join(UPLOADS_DIR, clean);
  if (fs.existsSync(rootPath)) {
    res.type(path.extname(clean));
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.sendFile(rootPath);
  }
  
  res.status(404).json({ error: "Dosya bulunamadı." });
});

app.use("/uploads", express.static(UPLOADS_DIR));

function ok(res, data) {
  res.json(data);
}
function fail(res, status, message) {
  res.status(status).json({ error: message });
}

// ---- Giriş yapılması gereken tüm /api istekleri için kapı (login hariç) ----
function authGate(req, res, next) {
  if (!req.path.startsWith("/api/")) return next();
  if (req.path === "/api/auth/login") return next();
  // allow public access to reminders and missing-certificates endpoints
  if (req.path.startsWith("/api/reminders")) return next();
  if (req.path === "/api/missing-certificates") return next();
  return requireAuth(req, res, next);
}
app.use(authGate);

// ---- Kimlik doğrulama ----

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body || {};
  const users = loadUsers();
  const user = users.find((u) => u.username === username);
  if (!user || !user.active || !verifyPassword(password || "", user.passwordHash)) {
    appendAudit({
      entity: "auth",
      entityId: username || "?",
      action: "başarısız giriş denemesi",
      user: username || "?",
    });
    return fail(res, 401, "Kullanıcı adı veya şifre hatalı.");
  }
  const token = signToken({
    id: user.id,
    username: user.username,
    role: user.role,
    exp: Date.now() + SESSION_MS,
  });
  appendAudit({ entity: "auth", entityId: user.id, action: "giriş yapıldı", user: user.username });
  ok(res, { token, user: publicUser(user) });
});

app.get("/api/auth/me", (req, res) => {
  const users = loadUsers();
  const user = users.find((u) => u.id === req.user.id);
  if (!user || !user.active) return fail(res, 401, "Oturum geçersiz.");
  ok(res, publicUser(user));
});

// ---- Kullanıcı / Rol Yönetimi (Yönetim Paneli — sadece Yönetici) ----

app.get("/api/users", requireRole("Yönetici"), (req, res) => {
  ok(res, loadUsers().map(publicUser));
});

app.post("/api/users", requireRole("Yönetici"), (req, res) => {
  const { username, password, role, permissions, active } = req.body || {};
  if (!username || !password || !role) {
    return fail(res, 400, "Kullanıcı adı, şifre ve rol zorunludur.");
  }
  if (!VALID_ROLES.includes(role)) return fail(res, 400, "Geçersiz rol.");
  const users = loadUsers();
  if (users.some((u) => u.username.toLowerCase() === String(username).toLowerCase())) {
    return fail(res, 409, "Bu kullanıcı adı zaten kayıtlı.");
  }
  const newUser = {
    id: genId("U"),
    username,
    passwordHash: hashPassword(password),
    role,
    permissions: Array.isArray(permissions) ? permissions : undefined,
    active: active !== false,
    createdAt: new Date().toISOString(),
  };
  const updated = [...users, newUser];
  saveUsers(updated);
  appendAudit({
    entity: "user",
    entityId: newUser.id,
    action: "kullanıcı oluşturuldu",
    user: req.user ? req.user.username : "Sistem",
    note: `${username} (${role})`,
  });
  ok(res, updated.map(publicUser));
});

app.patch("/api/users/:id", requireRole("Yönetici"), (req, res) => {
  const users = loadUsers();
  const idx = users.findIndex((u) => u.id === req.params.id);
  if (idx === -1) return fail(res, 404, "Kullanıcı bulunamadı.");
  const current = users[idx];
  const patch = { ...req.body };
  if (patch.role && !VALID_ROLES.includes(patch.role)) return fail(res, 400, "Geçersiz rol.");
  if (patch.password) {
    patch.passwordHash = hashPassword(patch.password);
    delete patch.password;
  }
  if (patch.active === false && current.role === "Yönetici") {
    const otherActiveAdmins = users.filter(
      (u) => u.id !== current.id && u.role === "Yönetici" && u.active
    );
    if (otherActiveAdmins.length === 0) return fail(res, 400, "Son aktif Yönetici pasife alınamaz.");
  }
  users[idx] = { ...current, ...patch };
  saveUsers(users);
  appendAudit({
    entity: "user",
    entityId: current.id,
    action: "kullanıcı güncellendi",
    user: req.user ? req.user.username : "Sistem",
    note: current.username,
  });
  ok(res, users.map(publicUser));
});

app.delete("/api/users/:id", requireRole("Yönetici"), (req, res) => {
  const users = loadUsers();
  const target = users.find((u) => u.id === req.params.id);
  if (!target) return fail(res, 404, "Kullanıcı bulunamadı.");
  if (target.role === "Yönetici") {
    const otherActiveAdmins = users.filter(
      (u) => u.id !== target.id && u.role === "Yönetici" && u.active
    );
    if (otherActiveAdmins.length === 0) return fail(res, 400, "Son Yönetici silinemez.");
  }
  const updated = users.filter((u) => u.id !== req.params.id);
  saveUsers(updated);
  appendAudit({
    entity: "user",
    entityId: target.id,
    action: "kullanıcı silindi",
    user: req.user ? req.user.username : "Sistem",
    note: target.username,
  });
  ok(res, updated.map(publicUser));
});

// ---- Audit Log görüntüleme (sadece Yönetici) ----

app.get("/api/audit-log", requireRole("Yönetici"), (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
  ok(res, loadAudit().slice(0, limit));
});

// ---- DB (receipts/movements/lots) ----

app.get("/api/db", (req, res) => ok(res, loadDb()));

app.post("/api/receipts", (req, res) => {
  const db = loadDb();
  const receipt = { ...req.body, id: genId("GF"), olusturmaTarihi: new Date().toISOString() };
  db.receipts.unshift(receipt);
  saveDb(db);
  ok(res, receipt);
});

app.patch("/api/receipts/:id", (req, res) => {
  const db = loadDb();
  const idx = db.receipts.findIndex((r) => r.id === req.params.id);
  if (idx === -1) return fail(res, 404, "Giriş fişi bulunamadı.");
  const receipt = db.receipts[idx];

  if (req.body.durum === "REDDEDILDI") {
    processReceiptRejection(db, receipt, req.body, req.user);
  } else {
    const oldLotNo = receipt.lotNo;
    db.receipts[idx] = { ...receipt, ...req.body };
    const updated = db.receipts[idx];

    // Sync associated lot in db.lots if present
    if (oldLotNo && db.lots[oldLotNo]) {
      const lotObj = db.lots[oldLotNo];
      const newLotNo = updated.lotNo || oldLotNo;
      if (newLotNo !== oldLotNo) {
        delete db.lots[oldLotNo];
        db.lots[newLotNo] = {
          ...lotObj,
          lotNo: newLotNo,
          malzemeKodu: updated.malzemeKodu || lotObj.malzemeKodu,
          firma: updated.firma || lotObj.firma,
          gelenMiktar: updated.gelenMiktar !== undefined ? Number(updated.gelenMiktar) : lotObj.gelenMiktar,
          kalanMiktar: updated.gelenMiktar !== undefined ? Number(updated.gelenMiktar) : lotObj.kalanMiktar,
          irsaliyeNo: updated.irsaliyeNo || lotObj.irsaliyeNo,
          faturaNo: updated.faturaNo || lotObj.faturaNo,
        };
      } else {
        db.lots[oldLotNo] = {
          ...lotObj,
          malzemeKodu: updated.malzemeKodu || lotObj.malzemeKodu,
          firma: updated.firma || lotObj.firma,
          gelenMiktar: updated.gelenMiktar !== undefined ? Number(updated.gelenMiktar) : lotObj.gelenMiktar,
          irsaliyeNo: updated.irsaliyeNo || lotObj.irsaliyeNo,
          faturaNo: updated.faturaNo || lotObj.faturaNo,
        };
      }
    }
  }
  saveDb(db);
  ok(res, db.receipts[idx]);
});

app.delete("/api/receipts/:id", (req, res) => {
  const db = loadDb();
  const id = req.params.id;
  const idx = db.receipts.findIndex((r) => r.id === id);
  if (idx === -1) return fail(res, 404, "Giriş fişi / etiket kaydı bulunamadı.");
  const receipt = db.receipts[idx];
  db.receipts.splice(idx, 1);

  if (receipt.lotNo && db.lots[receipt.lotNo]) {
    delete db.lots[receipt.lotNo];
    db.movements = db.movements.filter((m) => m.lotNo !== receipt.lotNo);
  }

  saveDb(db);
  appendAudit({
    entity: "receipt",
    entityId: id,
    action: "etiket / giriş fişi silindi",
    user: req.user ? req.user.username : "sistem",
    note: `${receipt.malzemeKodu || ''} - Lot: ${receipt.lotNo || ''}`,
  });
  ok(res, { ok: true, id });
});

function processReceiptRejection(db, receipt, patchData, reqUser) {
  const { redNedeni, ambalajKontrol, analizRaporuVar, coa } = patchData || {};
  const now = new Date().toISOString();
  const reasonStr = redNedeni || receipt.redNedeni || "Kalite Red / Uygunsuzluk";

  receipt.durum = "REDDEDILDI";
  receipt.redNedeni = reasonStr;
  if (typeof ambalajKontrol === "boolean") receipt.ambalajKontrol = ambalajKontrol;
  if (typeof analizRaporuVar === "boolean") receipt.analizRaporuVar = analizRaporuVar;
  if (coa) receipt.coa = coa;
  receipt.kontrolTarihi = now;
  receipt.kontrolEden = reqUser ? reqUser.username : "Kalite Kontrol";

  const auxParts = loadAuxiliaryParts();
  const isAux = receipt.malzemeTipi === "YARDIMCI_PARCA" || auxParts.some((p) => p.kod === receipt.malzemeKodu);
  const malzemeTipi = isAux ? "YARDIMCI_PARCA" : "HAMMADDE";
  receipt.malzemeTipi = malzemeTipi;

  const miktar = Number(receipt.gelenMiktar || 0);

  // Karantina Stok Hareketi (Daha önce eklenmediyse)
  const existingMov = db.movements.find(
    (m) => m.tip === "RET" && m.lotNo === receipt.lotNo && m.malzemeKodu === receipt.malzemeKodu
  );

  if (!existingMov) {
    db.movements.unshift({
      id: genId("MV-RET"),
      tip: "RET",
      lotNo: receipt.lotNo,
      malzemeKodu: receipt.malzemeKodu,
      miktar,
      tarih: now,
      kullanici: reqUser ? reqUser.username : "Kalite Kontrol",
      aciklama: `[RET BÖLGESİ / KARANTİNA] ${isAux ? "Yardımcı Parça" : "Hammadde"} Red Nedeni: ${reasonStr} (Firma: ${receipt.firma || "-"})`,
    });
  }

  db.lots[receipt.lotNo] = {
    lotNo: receipt.lotNo,
    malzemeKodu: receipt.malzemeKodu,
    firma: receipt.firma || "Bilinmiyor",
    kalanMiktar: miktar,
    ilkGirisMiktari: miktar,
    girisTarihi: receipt.girisTarihi || now.slice(0, 10),
    depoLokasyonu: "Ret Karantina Deposu",
  };

  if (isAux) {
    const auxDb = loadAuxiliaryDb();
    const auxReceiptIdx = auxDb.receipts.findIndex((r) => r.id === receipt.id || r.lotNo === receipt.lotNo);
    if (auxReceiptIdx !== -1) {
      auxDb.receipts[auxReceiptIdx] = { ...receipt, durum: "REDDEDILDI" };
    } else {
      auxDb.receipts.unshift({
        id: receipt.id,
        malzemeKodu: receipt.malzemeKodu,
        firma: receipt.firma,
        irsaliyeNo: receipt.irsaliyeNo,
        lotNo: receipt.lotNo,
        gelenMiktar: miktar,
        girisTarihi: receipt.girisTarihi,
        durum: "REDDEDILDI",
        redNedeni: reasonStr,
      });
    }

    auxDb.lots[receipt.lotNo] = {
      lotNo: receipt.lotNo,
      malzemeKodu: receipt.malzemeKodu,
      firma: receipt.firma,
      kalanMiktar: miktar,
      ilkGirisMiktari: miktar,
      girisTarihi: receipt.girisTarihi || now.slice(0, 10),
      depoLokasyonu: "Ret Karantina Deposu",
    };

    const existingAuxMov = auxDb.movements.find(
      (m) => m.tip === "RET" && m.lotNo === receipt.lotNo && m.malzemeKodu === receipt.malzemeKodu
    );
    if (!existingAuxMov) {
      auxDb.movements.unshift({
        id: genId("YP-MOV-RET"),
        tip: "RET",
        lotNo: receipt.lotNo,
        malzemeKodu: receipt.malzemeKodu,
        miktar,
        tarih: now,
        kullanici: reqUser ? reqUser.username : "Kalite Kontrol",
        aciklama: `[RET BÖLGESİ / KARANTİNA] Red Nedeni: ${reasonStr}`,
      });
    }

    saveAuxiliaryDb(auxDb);
  }

  appendAudit({
    entity: "receipt",
    entityId: receipt.id,
    action: "kalite red - ret bölgesine aktarıldı",
    user: reqUser ? reqUser.username : "Sistem",
    note: `Lot ${receipt.lotNo}, Red Nedeni: ${reasonStr}`,
  });
}

app.post("/api/receipts/:id/reject", (req, res) => {
  const db = loadDb();
  const idx = db.receipts.findIndex((r) => r.id === req.params.id);
  if (idx === -1) return fail(res, 404, "Giriş fişi bulunamadı.");
  const receipt = db.receipts[idx];
  processReceiptRejection(db, receipt, req.body, req.user);
  saveDb(db);
  ok(res, db);
});

app.post("/api/ret-bolgesi/cikis", (req, res) => {
  const { lotNo, miktar, islemTuru, aciklama } = req.body;
  const db = loadDb();
  const auxDb = loadAuxiliaryDb();

  // Find or construct lot
  let lot = db.lots[lotNo] || (auxDb.lots && auxDb.lots[lotNo]);

  if (!lot) {
    const r = db.receipts.find((x) => x.lotNo === lotNo) || (auxDb.receipts && auxDb.receipts.find((x) => x.lotNo === lotNo));
    if (r) {
      lot = {
        lotNo: r.lotNo,
        malzemeKodu: r.malzemeKodu,
        firma: r.firma || "Bilinmiyor",
        kalanMiktar: Number(r.gelenMiktar || 0),
        ilkGirisMiktari: Number(r.gelenMiktar || 0),
        girisTarihi: r.girisTarihi || new Date().toISOString().slice(0, 10),
        depoLokasyonu: "Ret Karantina Deposu",
      };
    }
  }

  if (!lot) return fail(res, 404, `Lot bulunamadı: ${lotNo}`);

  const numMiktar = Number(miktar);
  if (isNaN(numMiktar) || numMiktar <= 0) return fail(res, 400, "Geçersiz miktar.");

  const currentKalan = typeof lot.kalanMiktar === "number" ? lot.kalanMiktar : Number(lot.gelenMiktar || 0);

  if (numMiktar > currentKalan) {
    return fail(res, 400, `Yetersiz karantina stok miktarı. Kalan: ${currentKalan}`);
  }

  const newKalan = Math.max(0, currentKalan - numMiktar);

  // Update in db.lots
  if (!db.lots[lotNo]) {
    db.lots[lotNo] = { ...lot, kalanMiktar: newKalan };
  } else {
    db.lots[lotNo].kalanMiktar = newKalan;
  }

  const auxParts = loadAuxiliaryParts();
  const isAux =
    auxParts.some((p) => p.kod === lot.malzemeKodu) ||
    db.receipts.some((r) => r.lotNo === lotNo && r.malzemeTipi === "YARDIMCI_PARCA") ||
    (auxDb.receipts && auxDb.receipts.some((r) => r.lotNo === lotNo));

  if (isAux || (auxDb.lots && auxDb.lots[lotNo])) {
    if (!auxDb.lots) auxDb.lots = {};
    if (!auxDb.lots[lotNo]) {
      auxDb.lots[lotNo] = { ...lot, kalanMiktar: newKalan };
    } else {
      auxDb.lots[lotNo].kalanMiktar = newKalan;
    }
  }

  const actionLabel = islemTuru === "TEDARIKCIYE_IADE" ? "Tedarikçiye İade" : "Hurda Çıkışı";
  const now = new Date().toISOString();

  const movement = {
    id: genId("MV-RET-OUT"),
    tip: "RET_CIKIS",
    lotNo,
    malzemeKodu: lot.malzemeKodu,
    miktar: numMiktar,
    tarih: now,
    kullanici: req.user ? req.user.username : "Kalite Kontrol",
    aciklama: `[RET BÖLGESİ ÇIKIŞ - ${actionLabel}] ${aciklama || ""}`,
  };
  db.movements.unshift(movement);

  if (isAux || (auxDb.lots && auxDb.lots[lotNo])) {
    if (!auxDb.movements) auxDb.movements = [];
    auxDb.movements.unshift({
      id: genId("YP-MOV-RET-OUT"),
      tip: "RET_CIKIS",
      lotNo,
      malzemeKodu: lot.malzemeKodu,
      miktar: numMiktar,
      tarih: now,
      kullanici: req.user ? req.user.username : "Kalite Kontrol",
      aciklama: `[RET BÖLGESİ ÇIKIŞ - ${actionLabel}] ${aciklama || ""}`,
    });
    saveAuxiliaryDb(auxDb);
  }

  saveDb(db);

  appendAudit({
    entity: "movement",
    entityId: movement.id,
    action: `ret bölgesi çıkışı (${actionLabel})`,
    user: req.user ? req.user.username : "Sistem",
    note: `Lot ${lotNo}, ${numMiktar} birim`,
  });

  ok(res, db);
});

app.post("/api/receipts/:id/approve", (req, res) => {
  const db = loadDb();
  const idx = db.receipts.findIndex((r) => r.id === req.params.id);
  if (idx === -1) return fail(res, 404, "Giriş fişi bulunamadı.");
  const receipt = db.receipts[idx];

  // Check if it is an Auxiliary Part (Yardımcı Parça)
  const auxParts = loadAuxiliaryParts();
  const isAux = receipt.malzemeTipi === "YARDIMCI_PARCA" || auxParts.some((p) => p.kod === receipt.malzemeKodu);

  if (isAux) {
    const auxDb = loadAuxiliaryDb();
    const miktar = Number(receipt.gelenMiktar || 0);
    auxDb.receipts.unshift({
      id: receipt.id,
      malzemeKodu: receipt.malzemeKodu,
      firma: receipt.firma,
      irsaliyeNo: receipt.irsaliyeNo,
      lotNo: receipt.lotNo,
      gelenMiktar: miktar,
      girisTarihi: receipt.girisTarihi,
      durum: "DEPODA",
    });

    const existingAuxLot = auxDb.lots[receipt.lotNo];
    if (existingAuxLot) {
      existingAuxLot.kalanMiktar += miktar;
      existingAuxLot.ilkGirisMiktari += miktar;
    } else {
      auxDb.lots[receipt.lotNo] = {
        lotNo: receipt.lotNo,
        malzemeKodu: receipt.malzemeKodu,
        firma: receipt.firma,
        kalanMiktar: miktar,
        ilkGirisMiktari: miktar,
        girisTarihi: receipt.girisTarihi || new Date().toISOString().slice(0, 10),
      };
    }

    auxDb.movements.unshift({
      id: genId("YP-MOV"),
      tip: "GIRIS",
      lotNo: receipt.lotNo,
      malzemeKodu: receipt.malzemeKodu,
      miktar,
      tarih: new Date().toISOString(),
      kullanici: req.user ? req.user.username : "Kalite Kontrol",
      aciklama: `Giriş fişi ${receipt.irsaliyeNo} - Kalite Onaylı`,
    });
    saveAuxiliaryDb(auxDb);

    const pIdx = auxParts.findIndex((p) => p.kod === receipt.malzemeKodu);
    if (pIdx !== -1) {
      auxParts[pIdx].stokMiktari = (auxParts[pIdx].stokMiktari || 0) + miktar;
      saveAuxiliaryParts(auxParts);
    }
  }

  const movement = {
    id: genId("MV"),
    tip: "GIRIS",
    lotNo: receipt.lotNo,
    malzemeKodu: receipt.malzemeKodu,
    miktar: receipt.gelenMiktar,
    tarih: new Date().toISOString(),
    aciklama: `Giriş fişi ${receipt.irsaliyeNo} - kalite onaylı`,
  };
  db.movements.unshift(movement);

  const existingLot = db.lots[receipt.lotNo];
  db.lots[receipt.lotNo] = {
    lotNo: receipt.lotNo,
    malzemeKodu: receipt.malzemeKodu,
    firma: receipt.firma,
    kalanMiktar: (existingLot?.kalanMiktar ?? 0) + receipt.gelenMiktar,
    ilkGirisMiktari: (existingLot?.ilkGirisMiktari ?? 0) + receipt.gelenMiktar,
    girisTarihi: receipt.girisTarihi,
    depoLokasyonu: existingLot?.depoLokasyonu,
  };

  db.receipts[idx] = { ...receipt, durum: "ONAYLANDI", kontrolTarihi: new Date().toISOString() };
  saveDb(db);
  appendAudit({
    entity: "receipt",
    entityId: receipt.id,
    action: "kalite onayı verildi",
    user: req.user ? req.user.username : "Sistem",
    note: `Lot ${receipt.lotNo}`,
  });
  ok(res, db);
});

app.post("/api/receipts/:id/label-printed", (req, res) => {
  const db = loadDb();
  const idx = db.receipts.findIndex((r) => r.id === req.params.id);
  if (idx === -1) return fail(res, 404, "Giriş fişi bulunamadı.");
  const { ambalajMiktari, etiketSayisi } = req.body || {};
  db.receipts[idx] = {
    ...db.receipts[idx],
    durum: "DEPODA",
    etiketBasimTarihi: new Date().toISOString(),
    ...(ambalajMiktari ? { ambalajMiktari } : {}),
    ...(etiketSayisi ? { etiketSayisi } : {}),
  };
  saveDb(db);
  ok(res, db.receipts[idx]);
});

app.post("/api/consume", (req, res) => {
  const { lotNo, miktar, kullanici } = req.body;
  const db = loadDb();
  const lot = db.lots[lotNo];
  if (!lot) return fail(res, 404, `Lot bulunamadı: ${lotNo}`);
  if (miktar > lot.kalanMiktar) {
    return fail(
      res,
      400,
      `Yetersiz stok. Lot kalan miktar: ${lot.kalanMiktar} kg, istenen: ${miktar} kg`
    );
  }
  const movement = {
    id: genId("MV"),
    tip: "CIKIS",
    lotNo,
    malzemeKodu: lot.malzemeKodu,
    miktar,
    tarih: new Date().toISOString(),
    kullanici,
  };
  db.movements.unshift(movement);
  db.lots[lotNo] = { ...lot, kalanMiktar: lot.kalanMiktar - miktar };
  saveDb(db);
  appendAudit({
    entity: "movement",
    entityId: movement.id,
    action: "depo çıkışı",
    user: req.user ? req.user.username : "Sistem",
    note: `Lot ${lotNo}, ${miktar} kg`,
  });
  ok(res, { db, movement });
});

app.post("/api/undo/:movementId", (req, res) => {
  const db = loadDb();
  const idx = db.movements.findIndex((m) => m.id === req.params.movementId);
  if (idx === -1) return fail(res, 404, "Hareket bulunamadı (belki zaten geri alındı).");
  const movement = db.movements[idx];
  if (movement.tip !== "CIKIS") return fail(res, 400, "Sadece çıkış hareketleri geri alınabilir.");
  db.movements.splice(idx, 1);
  const lot = db.lots[movement.lotNo];
  if (lot) db.lots[movement.lotNo] = { ...lot, kalanMiktar: lot.kalanMiktar + movement.miktar };
  saveDb(db);
  appendAudit({
    entity: "movement",
    entityId: movement.id,
    action: "depo çıkışı geri alındı",
    user: req.user ? req.user.username : "Sistem",
    note: `Lot ${movement.lotNo}, ${movement.miktar} kg`,
  });
  ok(res, db);
});

app.patch("/api/lots/:lotNo/location", (req, res) => {
  const db = loadDb();
  const lot = db.lots[req.params.lotNo];
  if (!lot) return fail(res, 404, "Lot bulunamadı.");
  db.lots[req.params.lotNo] = { ...lot, depoLokasyonu: req.body.depoLokasyonu };
  saveDb(db);
  ok(res, db.lots[req.params.lotNo]);
});

app.delete("/api/lots/:lotNo", requireRole("Yönetici", "Giriş Kalite"), (req, res) => {
  const db = loadDb();
  const lotNo = req.params.lotNo;
  if (!db.lots[lotNo]) return fail(res, 404, "Lot bulunamadı.");
  delete db.lots[lotNo];
  db.movements = db.movements.filter((m) => m.lotNo !== lotNo);
  saveDb(db);
  appendAudit({
    entity: "lot",
    entityId: lotNo,
    action: "hammadde lotu silindi",
    user: req.user ? req.user.username : "Sistem",
    note: `Lot ${lotNo} direkt silindi`,
  });
  ok(res, { ok: true, lotNo });
});

// ---- Malzemeler ----

app.get("/api/materials", (req, res) => ok(res, loadMaterials()));

app.post("/api/materials", (req, res) => {
  const list = loadMaterials();
  if (list.some((m) => m.kod === req.body.kod)) {
    return fail(res, 409, `Bu malzeme kodu zaten kayıtlı: ${req.body.kod}`);
  }
  const updated = [...list, req.body];
  saveMaterials(updated);
  appendAudit({
    entity: "material",
    entityId: req.body.kod,
    action: "malzeme oluşturuldu",
    user: req.user ? req.user.username : "Sistem",
  });
  ok(res, updated);
});

app.patch("/api/materials/:kod", (req, res) => {
  const list = loadMaterials();
  const idx = list.findIndex((m) => m.kod === req.params.kod);
  if (idx === -1) return fail(res, 404, "Malzeme bulunamadı.");
  if (req.body.kod && req.body.kod !== req.params.kod && list.some((m) => m.kod === req.body.kod)) {
    return fail(res, 409, `Bu malzeme kodu zaten kayıtlı: ${req.body.kod}`);
  }
  list[idx] = { ...list[idx], ...req.body };
  saveMaterials(list);
  appendAudit({
    entity: "material",
    entityId: req.params.kod,
    action: "malzeme güncellendi",
    user: req.user ? req.user.username : "Sistem",
  });
  ok(res, list);
});

app.patch("/api/materials/:kod/location", (req, res) => {
  const list = loadMaterials();
  const idx = list.findIndex((m) => m.kod === req.params.kod);
  if (idx === -1) return fail(res, 404, "Malzeme bulunamadı.");
  list[idx] = { ...list[idx], depoKodu: req.body.depoKodu };
  saveMaterials(list);
  ok(res, list);
});

// Malzeme silme kalıcı veri kaybına yol açabileceği için sadece Yönetici yapabilir.
app.delete("/api/materials/:kod", requireRole("Yönetici"), (req, res) => {
  const list = loadMaterials().filter((m) => m.kod !== req.params.kod);
  saveMaterials(list);
  appendAudit({
    entity: "material",
    entityId: req.params.kod,
    action: "malzeme silindi",
    user: req.user ? req.user.username : "Sistem",
  });
  ok(res, list);
});

// ---- Yardımcı Parçalar ----

app.get("/api/auxiliary-parts", (req, res) => ok(res, loadAuxiliaryParts()));

app.post("/api/auxiliary-parts", (req, res) => {
  const list = loadAuxiliaryParts();
  if (list.some((p) => p.kod === req.body.kod)) {
    return fail(res, 409, `Bu yardımcı parça kodu zaten kayıtlı: ${req.body.kod}`);
  }
  const updated = [...list, req.body];
  saveAuxiliaryParts(updated);
  appendAudit({
    entity: "auxiliary_part",
    entityId: req.body.kod,
    action: "yardımcı parça oluşturuldu",
    user: req.user ? req.user.username : "Sistem",
  });
  ok(res, updated);
});

app.patch("/api/auxiliary-parts/:kod", (req, res) => {
  const list = loadAuxiliaryParts();
  const idx = list.findIndex((p) => p.kod === req.params.kod);
  if (idx === -1) return fail(res, 404, "Yardımcı parça bulunamadı.");
  if (req.body.kod && req.body.kod !== req.params.kod && list.some((p) => p.kod === req.body.kod)) {
    return fail(res, 409, `Bu yardımcı parça kodu zaten kayıtlı: ${req.body.kod}`);
  }
  list[idx] = { ...list[idx], ...req.body };
  saveAuxiliaryParts(list);
  appendAudit({
    entity: "auxiliary_part",
    entityId: req.params.kod,
    action: "yardımcı parça güncellendi",
    user: req.user ? req.user.username : "Sistem",
  });
  ok(res, list);
});

app.patch("/api/auxiliary-parts/:kod/location", (req, res) => {
  const list = loadAuxiliaryParts();
  const idx = list.findIndex((p) => p.kod === req.params.kod);
  if (idx === -1) return fail(res, 404, "Yardımcı parça bulunamadı.");
  list[idx] = { ...list[idx], depoKodu: req.body.depoKodu };
  saveAuxiliaryParts(list);
  ok(res, list);
});

app.delete("/api/auxiliary-parts/:kod", requireRole("Yönetici", "Giriş Kalite"), (req, res) => {
  const list = loadAuxiliaryParts().filter((p) => p.kod !== req.params.kod);
  saveAuxiliaryParts(list);
  appendAudit({
    entity: "auxiliary_part",
    entityId: req.params.kod,
    action: "yardımcı parça silindi",
    user: req.user ? req.user.username : "Sistem",
  });
  ok(res, list);
});

// ---- Yarı Mamüller (Enjeksiyon Parçaları & Alt Montajlar) ----

app.get("/api/semi-finished-parts", (req, res) => ok(res, loadSemiFinishedParts()));

app.post("/api/semi-finished-parts", (req, res) => {
  const list = loadSemiFinishedParts();
  if (list.some((p) => p.kod === req.body.kod)) {
    return fail(res, 409, `Bu yarı mamül kodu zaten kayıtlı: ${req.body.kod}`);
  }
  const item = {
    ...req.body,
    stokMiktari: Number(req.body.stokMiktari || 0),
    olusturmaTarihi: new Date().toISOString(),
  };
  const updated = [...list, item];
  saveSemiFinishedParts(updated);
  appendAudit({
    entity: "semi_finished",
    entityId: req.body.kod,
    action: "yarı mamül tanımlandı",
    user: req.user ? req.user.username : "Sistem",
  });
  ok(res, updated);
});

app.patch("/api/semi-finished-parts/:kod", (req, res) => {
  const list = loadSemiFinishedParts();
  const idx = list.findIndex((p) => p.kod === req.params.kod);
  if (idx === -1) return fail(res, 404, "Yarı mamül bulunamadı.");
  list[idx] = { ...list[idx], ...req.body };
  saveSemiFinishedParts(list);
  ok(res, list);
});

app.patch("/api/semi-finished-parts/:kod/location", (req, res) => {
  const list = loadSemiFinishedParts();
  const idx = list.findIndex((p) => p.kod === req.params.kod);
  if (idx === -1) return fail(res, 404, "Yarı mamül bulunamadı.");
  list[idx] = { ...list[idx], depoKodu: req.body.depoKodu };
  saveSemiFinishedParts(list);
  ok(res, list);
});

app.delete("/api/semi-finished-parts/:kod", requireRole("Yönetici", "Giriş Kalite"), (req, res) => {
  const list = loadSemiFinishedParts().filter((p) => p.kod !== req.params.kod);
  saveSemiFinishedParts(list);
  ok(res, list);
});

app.get("/api/semi-finished-db", (req, res) => ok(res, loadSemiFinishedDb()));

app.post("/api/semi-finished-db/movements", (req, res) => {
  const { tip, kod, miktar, aciklama } = req.body;
  const numMiktar = Number(miktar || 0);
  if (numMiktar <= 0) return fail(res, 400, "Geçersiz miktar.");

  const list = loadSemiFinishedParts();
  const idx = list.findIndex((p) => p.kod === kod);
  if (idx === -1) return fail(res, 404, "Yarı mamül bulunamadı.");

  const current = Number(list[idx].stokMiktari || 0);
  if (tip === "CIKIS" && current < numMiktar) {
    return fail(res, 400, `Yetersiz stok! Mevcut: ${current}`);
  }

  const newStock = tip === "GIRIS" ? current + numMiktar : current - numMiktar;
  list[idx].stokMiktari = newStock;
  saveSemiFinishedParts(list);

  const db = loadSemiFinishedDb();
  db.movements.unshift({
    id: genId("YM-MOV"),
    tip,
    kod,
    miktar: numMiktar,
    tarih: new Date().toISOString(),
    aciklama,
  });
  saveSemiFinishedDb(db);
  ok(res, { ok: true, newStock });
});

// ---- Mamüller (Nihai Ürünler) ----

app.get("/api/finished-goods", (req, res) => ok(res, loadFinishedGoods()));

app.post("/api/finished-goods", (req, res) => {
  const list = loadFinishedGoods();
  if (list.some((g) => g.kod === req.body.kod)) {
    return fail(res, 409, `Bu mamül kodu zaten kayıtlı: ${req.body.kod}`);
  }
  const item = {
    ...req.body,
    stokMiktari: Number(req.body.stokMiktari || 0),
    olusturmaTarihi: new Date().toISOString(),
  };
  const updated = [...list, item];
  saveFinishedGoods(updated);
  appendAudit({
    entity: "finished_good",
    entityId: req.body.kod,
    action: "mamül tanımlandı",
    user: req.user ? req.user.username : "Sistem",
  });
  ok(res, updated);
});

app.patch("/api/finished-goods/:kod", (req, res) => {
  const list = loadFinishedGoods();
  const idx = list.findIndex((g) => g.kod === req.params.kod);
  if (idx === -1) return fail(res, 404, "Mamül bulunamadı.");
  list[idx] = { ...list[idx], ...req.body };
  saveFinishedGoods(list);
  ok(res, list);
});

app.patch("/api/finished-goods/:kod/location", (req, res) => {
  const list = loadFinishedGoods();
  const idx = list.findIndex((g) => g.kod === req.params.kod);
  if (idx === -1) return fail(res, 404, "Mamül bulunamadı.");
  list[idx] = { ...list[idx], depoKodu: req.body.depoKodu };
  saveFinishedGoods(list);
  ok(res, list);
});

app.delete("/api/finished-goods/:kod", requireRole("Yönetici", "Giriş Kalite"), (req, res) => {
  const list = loadFinishedGoods().filter((g) => g.kod !== req.params.kod);
  saveFinishedGoods(list);
  ok(res, list);
});

app.get("/api/finished-goods-db", (req, res) => ok(res, loadFinishedGoodsDb()));

app.post("/api/finished-goods-db/movements", (req, res) => {
  const { tip, kod, miktar, aciklama } = req.body;
  const numMiktar = Number(miktar || 0);
  if (numMiktar <= 0) return fail(res, 400, "Geçersiz miktar.");

  const list = loadFinishedGoods();
  const idx = list.findIndex((g) => g.kod === kod);
  if (idx === -1) return fail(res, 404, "Mamül bulunamadı.");

  const targetGood = list[idx];
  const current = Number(targetGood.stokMiktari || 0);
  if (tip === "CIKIS" && current < numMiktar) {
    return fail(res, 400, `Yetersiz mamül stoğu! Mevcut: ${current}`);
  }

  const newStock = tip === "GIRIS" ? current + numMiktar : current - numMiktar;
  list[idx].stokMiktari = newStock;
  saveFinishedGoods(list);

  // Reçete / BOM Otomatik Stok Düşümü (Nihai ürün stoktan çıkarken yarı mamül ve yardımcı parçalardan otomatik düşüm)
  const autoDeductedMsgs = [];
  if (tip === "CIKIS" && Array.isArray(targetGood.recete) && targetGood.recete.length > 0) {
    targetGood.recete.forEach((item) => {
      const reqQty = Number(item.miktar || 0) * numMiktar;
      if (reqQty <= 0) return;

      if (item.tip === "YARI_MAMUL") {
        const semiList = loadSemiFinishedParts();
        const semiIdx = semiList.findIndex((p) => p.kod === item.kod);
        if (semiIdx !== -1) {
          const curSemiStock = Number(semiList[semiIdx].stokMiktari || 0);
          semiList[semiIdx].stokMiktari = Math.max(0, curSemiStock - reqQty);
          saveSemiFinishedParts(semiList);

          const semiDb = loadSemiFinishedDb();
          semiDb.movements.unshift({
            id: genId("YM-MOV"),
            tip: "CIKIS",
            kod: item.kod,
            miktar: reqQty,
            tarih: new Date().toISOString(),
            aciklama: `[Otomatik Reçete Düşümü] ${kod} Mamül Çıkışı (${numMiktar} adet)`,
          });
          saveSemiFinishedDb(semiDb);
          autoDeductedMsgs.push(`${item.kod} Yarı Mamül (-${reqQty} adet)`);
        }
      } else if (item.tip === "YARDIMCI_PARCA") {
        const auxParts = loadAuxiliaryParts();
        const auxIdx = auxParts.findIndex((p) => p.kod === item.kod);
        if (auxIdx !== -1) {
          const curAuxStock = Number(auxParts[auxIdx].stokMiktari || 0);
          auxParts[auxIdx].stokMiktari = Math.max(0, curAuxStock - reqQty);
          saveAuxiliaryParts(auxParts);

          const auxDb = loadAuxiliaryDb();
          let remQty = reqQty;
          for (const lotKey in auxDb.lots) {
            const lot = auxDb.lots[lotKey];
            if (lot.malzemeKodu === item.kod && lot.kalanMiktar > 0 && remQty > 0) {
              const ded = Math.min(lot.kalanMiktar, remQty);
              lot.kalanMiktar -= ded;
              remQty -= ded;
            }
          }
          auxDb.movements.push({
            id: genId("YP-MOV"),
            tip: "CIKIS",
            lotNo: "REÇETE-OTOMATİK",
            malzemeKodu: item.kod,
            miktar: reqQty,
            tarih: new Date().toISOString(),
            kullanici: req.user ? req.user.username : "Sistem",
            aciklama: `[Otomatik Reçete Düşümü] ${kod} Mamül Çıkışı (${numMiktar} adet)`,
          });
          saveAuxiliaryDb(auxDb);
          autoDeductedMsgs.push(`${item.kod} Yardımcı Parça (-${reqQty} adet)`);
        }
      }
    });
  }

  const db = loadFinishedGoodsDb();
  let fullDesc = aciklama || "";
  if (autoDeductedMsgs.length > 0) {
    fullDesc += (fullDesc ? " | " : "") + `Otomatik Reçete Düşümleri: ${autoDeductedMsgs.join(", ")}`;
  }

  db.movements.unshift({
    id: genId("MAM-MOV"),
    tip,
    kod,
    miktar: numMiktar,
    tarih: new Date().toISOString(),
    aciklama: fullDesc,
  });
  saveFinishedGoodsDb(db);
  ok(res, { ok: true, newStock, autoDeducted: autoDeductedMsgs });
});

// ---- Yardımcı Parça Tedarikçileri ----

app.get("/api/auxiliary-suppliers", (req, res) => ok(res, loadAuxiliarySuppliers()));

app.post("/api/auxiliary-suppliers", (req, res) => {
  const name = (req.body.name || "").trim();
  if (!name) return ok(res, loadAuxiliarySuppliers());
  const list = loadAuxiliarySuppliers();
  if (!list.some((s) => s.toLowerCase() === name.toLowerCase())) {
    saveAuxiliarySuppliers([...list, name]);
  }
  ok(res, loadAuxiliarySuppliers());
});

app.put("/api/auxiliary-suppliers", (req, res) => {
  const list = Array.isArray(req.body) ? req.body.map((s) => String(s).trim()).filter(Boolean) : [];
  saveAuxiliarySuppliers(list);
  ok(res, list);
});

app.delete("/api/auxiliary-suppliers/:name", (req, res) => {
  const targetName = decodeURIComponent(req.params.name).toLowerCase();
  const list = loadAuxiliarySuppliers().filter((s) => s.toLowerCase() !== targetName);
  saveAuxiliarySuppliers(list);
  ok(res, list);
});

app.post("/api/auxiliary-suppliers/extract", (req, res) => {
  const parts = loadAuxiliaryParts();
  const set = new Set(loadAuxiliarySuppliers());
  parts.forEach((p) => {
    if (p.firma && p.firma.trim()) set.add(p.firma.trim());
  });
  const list = Array.from(set).sort();
  saveAuxiliarySuppliers(list);
  ok(res, list);
});

// ---- Yardımcı Parça Depo Stok Veritabanı ----

app.get("/api/auxiliary-db", (req, res) => ok(res, loadAuxiliaryDb()));

app.post("/api/auxiliary-db/receipts", (req, res) => {
  const db = loadAuxiliaryDb();
  const newReceipt = {
    ...req.body,
    id: req.body.id || genId("YP-RCP"),
    durum: req.body.durum || "DEPODA",
    olusturmaTarihi: new Date().toISOString(),
  };
  db.receipts.push(newReceipt);

  const miktar = Number(newReceipt.gelenMiktar || 0);
  if (newReceipt.lotNo && miktar > 0) {
    const existing = db.lots[newReceipt.lotNo];
    if (existing) {
      existing.kalanMiktar += miktar;
      existing.ilkGirisMiktari += miktar;
    } else {
      db.lots[newReceipt.lotNo] = {
        lotNo: newReceipt.lotNo,
        malzemeKodu: newReceipt.malzemeKodu,
        firma: newReceipt.firma,
        kalanMiktar: miktar,
        ilkGirisMiktari: miktar,
        girisTarihi: newReceipt.girisTarihi || new Date().toISOString().slice(0, 10),
      };
    }
    db.movements.push({
      id: genId("YP-MOV"),
      tip: "GIRIS",
      lotNo: newReceipt.lotNo,
      malzemeKodu: newReceipt.malzemeKodu,
      miktar,
      tarih: new Date().toISOString(),
      kullanici: req.user ? req.user.username : "Sistem",
      aciklama: `Giriş (İrsaliye: ${newReceipt.irsaliyeNo || "-"})`,
    });
  }

  const parts = loadAuxiliaryParts();
  const partIdx = parts.findIndex((p) => p.kod === newReceipt.malzemeKodu);
  if (partIdx !== -1) {
    parts[partIdx].stokMiktari = (parts[partIdx].stokMiktari || 0) + miktar;
    saveAuxiliaryParts(parts);
  }

  saveAuxiliaryDb(db);
  ok(res, db);
});

app.post("/api/auxiliary-db/movements", (req, res) => {
  const db = loadAuxiliaryDb();
  const { tip, lotNo, malzemeKodu, miktar, aciklama } = req.body;
  const numMiktar = Number(miktar);
  if (!lotNo || !malzemeKodu || isNaN(numMiktar) || numMiktar <= 0) {
    return fail(res, 400, "Geçersiz hareket bilgileri.");
  }

  const lot = db.lots[lotNo];
  if (tip === "CIKIS") {
    if (!lot || lot.kalanMiktar < numMiktar) {
      return fail(res, 400, `Yetersiz stok. Lot kalan: ${lot ? lot.kalanMiktar : 0}`);
    }
    lot.kalanMiktar -= numMiktar;
  } else if (tip === "GIRIS") {
    if (lot) {
      lot.kalanMiktar += numMiktar;
    } else {
      db.lots[lotNo] = {
        lotNo,
        malzemeKodu,
        firma: req.body.firma || "Bilinmiyor",
        kalanMiktar: numMiktar,
        ilkGirisMiktari: numMiktar,
        girisTarihi: new Date().toISOString().slice(0, 10),
      };
    }
  }

  const newMov = {
    id: genId("YP-MOV"),
    tip,
    lotNo,
    malzemeKodu,
    miktar: numMiktar,
    tarih: new Date().toISOString(),
    kullanici: req.user ? req.user.username : "Sistem",
    aciklama: aciklama || (tip === "CIKIS" ? "Stok Çıkışı" : "Stok Girişi"),
  };
  db.movements.push(newMov);

  const parts = loadAuxiliaryParts();
  const partIdx = parts.findIndex((p) => p.kod === malzemeKodu);
  if (partIdx !== -1) {
    const cur = parts[partIdx].stokMiktari || 0;
    parts[partIdx].stokMiktari = tip === "CIKIS" ? Math.max(0, cur - numMiktar) : cur + numMiktar;
    saveAuxiliaryParts(parts);
  }

  saveAuxiliaryDb(db);
  ok(res, db);
});

app.patch("/api/auxiliary-db/lots/:lotNo/location", (req, res) => {
  const db = loadAuxiliaryDb();
  const lot = db.lots[req.params.lotNo];
  if (!lot) return fail(res, 404, "Lot bulunamadı.");
  db.lots[req.params.lotNo] = { ...lot, depoLokasyonu: req.body.depoLokasyonu };
  saveAuxiliaryDb(db);
  ok(res, db.lots[req.params.lotNo]);
});

// ---- Firmalar ----

app.get("/api/suppliers", (req, res) => ok(res, loadSuppliers()));

app.post("/api/suppliers", (req, res) => {
  const name = (req.body.name || "").trim();
  if (!name) return ok(res, loadSuppliers());
  const list = loadSuppliers();
  if (!list.some((s) => s.toLowerCase() === name.toLowerCase())) {
    saveSuppliers([...list, name]);
  }
  ok(res, loadSuppliers());
});

// ---- Tedarikçi Detayları ----

app.get("/api/suppliers-detail", (req, res) => ok(res, loadSuppliersDetail()));

app.post("/api/suppliers-detail", (req, res) => {
  const list = loadSuppliersDetail();
  const newItem = { ...req.body, id: req.body.id || genId("SUP"), olusturmaTarihi: new Date().toISOString() };
  const updated = [newItem, ...list.filter((s) => s.id !== newItem.id)];
  saveSuppliersDetail(updated);

  // Ayrıca genel firmalar listesine de ekle
  if (newItem.unvan) {
    const suppliers = loadSuppliers();
    if (!suppliers.some((s) => s.toLowerCase() === newItem.unvan.toLowerCase())) {
      saveSuppliers([...suppliers, newItem.unvan]);
    }
  }

  appendAudit({
    entity: "supplier",
    entityId: newItem.id,
    action: "tedarikçi eklendi",
    user: req.user ? req.user.username : "sistem",
    note: newItem.unvan,
  });
  ok(res, updated);
});

app.patch("/api/suppliers-detail/:id", (req, res) => {
  const list = loadSuppliersDetail();
  const idx = list.findIndex((s) => s.id === req.params.id);
  if (idx === -1) return fail(res, 404, "Tedarikçi bulunamadı.");
  list[idx] = { ...list[idx], ...req.body };
  saveSuppliersDetail(list);
  ok(res, list[idx]);
});

app.delete("/api/suppliers-detail/:id", (req, res) => {
  const list = loadSuppliersDetail().filter((s) => s.id !== req.params.id);
  saveSuppliersDetail(list);
  ok(res, list);
});

// ---- Satın Alma Siparişleri ----

app.get("/api/orders", (req, res) => ok(res, loadOrders()));

app.post("/api/orders", (req, res) => {
  const list = loadOrders();
  const newOrder = {
    ...req.body,
    id: req.body.id || genId("PO"),
    olusturmaTarihi: new Date().toISOString(),
    olusturan: req.user ? req.user.username : "Satın Alma",
  };
  const updated = [newOrder, ...list];
  saveOrders(updated);
  appendAudit({
    entity: "order",
    entityId: newOrder.id,
    action: "sipariş oluşturuldu",
    user: req.user ? req.user.username : "sistem",
    note: `${newOrder.siparisNo} - ${newOrder.tedarikciFirma}`,
  });
  ok(res, newOrder);
});

app.patch("/api/orders/:id", (req, res) => {
  const targetId = req.params.id;
  const list = loadOrders();
  const idx = list.findIndex((o) => o.id === targetId || o.siparisNo === targetId);
  if (idx === -1) return fail(res, 404, "Sipariş bulunamadı.");
  list[idx] = { ...list[idx], ...req.body };
  saveOrders(list);
  appendAudit({
    entity: "order",
    entityId: targetId,
    action: "sipariş güncellendi",
    user: req.user ? req.user.username : "sistem",
    note: `${list[idx].siparisNo} (${list[idx].durum})`,
  });
  ok(res, list[idx]);
});

app.delete("/api/orders/:id", (req, res) => {
  const targetId = req.params.id;
  const list = loadOrders().filter((o) => o.id !== targetId && o.siparisNo !== targetId);
  saveOrders(list);
  appendAudit({
    entity: "order",
    entityId: targetId,
    action: "sipariş silindi",
    user: req.user ? req.user.username : "sistem",
  });
  ok(res, list);
});

// ---- Etiket ayarları ----

app.get("/api/label-settings", (req, res) => ok(res, loadLabelSettings()));
app.put("/api/label-settings", (req, res) => {
  saveLabelSettings(req.body);
  ok(res, req.body);
});

// ---- IATF 16949 Form ve Doküman Numaraları ----

app.get("/api/form-metadata", (req, res) => ok(res, loadFormMetadata()));

// ---- Reminder endpoints (persisted in DATA_DIR/reminders.json) ----
app.get("/api/reminders", (req, res) => {
  ok(res, loadReminders());
});

app.post("/api/reminders/snooze", async (req, res) => {
  const requestedUntil = req.body && req.body.until ? Number(req.body.until) : null;
  const until = requestedUntil && Number.isFinite(requestedUntil) ? requestedUntil : null;

  try {
    await saveReminders({ snoozeUntil: until });
    ok(res, { snoozeUntil: until });
  } catch (error) {
    console.error("Hatırlatıcı erteleme kaydedilemedi:", error);
    res.status(500).json({ error: "Hatırlatıcı erteleme kaydedilemedi" });
  }
});

app.get("/api/missing-certificates", (req, res) => {
  const db = loadDb();
  const receiptsByLot = new Map((db.receipts || []).map((r) => [r.lotNo, r]));
  const missing = Object.values(db.lots || {}).filter((lot) => {
    const receipt = receiptsByLot.get(lot.lotNo);
    return !receipt || !receipt.sertifikaNo || String(receipt.sertifikaNo).trim() === "";
  }).map((lot) => ({ lotNo: lot.lotNo, malzemeKodu: lot.malzemeKodu, firma: lot.firma, girisTarihi: lot.girisTarihi }));
  ok(res, missing);
});
app.put("/api/form-metadata", (req, res) => {
  saveFormMetadata(req.body);
  appendAudit({
    entity: "form_metadata",
    entityId: "all",
    action: "form kodları/revizyonları güncellendi",
    user: req.user ? req.user.username : "sistem",
  });
  ok(res, req.body);
});

// ---- Belgeler (CoA / TDS / MSDS) — gerçek PDF dosyası olarak diske yazılır ----

// ---- Belgeler (CoA / Final Kontrol / Malzeme / Kaplama / TDS / MSDS) — gerçek PDF dosyası olarak diske yazılır ----

app.post("/api/documents/receipt/:docKind/:receiptId", (req, res) => {
  const allowedKinds = ["coa", "finalKontrol", "malzemeRaporu", "kaplamaRaporu"];
  const { docKind, receiptId } = req.params;
  if (!allowedKinds.includes(docKind)) {
    return fail(res, 400, "Geçersiz parti belgesi türü.");
  }
  try {
    const db = loadDb();
    let idx = db.receipts.findIndex((r) => r.id === receiptId);
    let isAuxDb = false;
    let auxDb = null;

    if (idx === -1) {
      auxDb = loadAuxiliaryDb();
      idx = (auxDb.receipts || []).findIndex((r) => r.id === receiptId);
      if (idx !== -1) isAuxDb = true;
    }

    if (idx === -1) return fail(res, 404, "Giriş fişi bulunamadı.");

    const targetDb = isAuxDb ? auxDb : db;
    const receipt = targetDb.receipts[idx];
    const doc = saveDocument(docKind, `${receipt.lotNo}-${receipt.malzemeKodu}`, req.body.dataUrl, req.body.name);

    const existingDocs = receipt.documents || {};
    const updatedDocs = { ...existingDocs, [docKind]: doc };
    targetDb.receipts[idx] = { ...receipt, documents: updatedDocs };

    if (isAuxDb) {
      saveAuxiliaryDb(auxDb);
    } else {
      saveDb(db);
    }
    ok(res, doc);
  } catch (e) {
    fail(res, 400, e.message);
  }
});

app.post("/api/documents/coa/:receiptId", (req, res) => {
  try {
    const db = loadDb();
    const idx = db.receipts.findIndex((r) => r.id === req.params.receiptId);
    if (idx === -1) return fail(res, 404, "Giriş fişi bulunamadı.");
    const receipt = db.receipts[idx];
    const doc = saveDocument("coa", `${receipt.lotNo}-${receipt.malzemeKodu}`, req.body.dataUrl, req.body.name);
    db.receipts[idx] = { ...receipt, documents: { ...(receipt.documents || {}), coa: doc } };
    saveDb(db);
    ok(res, doc);
  } catch (e) {
    fail(res, 400, e.message);
  }
});

app.post("/api/documents/:kind/:kod", (req, res) => {
  if (req.params.kind !== "tds" && req.params.kind !== "msds") {
    return fail(res, 400, "Geçersiz belge türü.");
  }
  try {
    const list = loadMaterials();
    const idx = list.findIndex((m) => m.kod === req.params.kod);
    if (idx !== -1) {
      const doc = saveDocument(req.params.kind, req.params.kod, req.body.dataUrl, req.body.name);
      list[idx] = { ...list[idx], [req.params.kind]: doc };
      saveMaterials(list);
      return ok(res, doc);
    }

    // Ayrıca Yardımcı Parçalar listesine bak
    const auxParts = loadAuxiliaryParts();
    const auxIdx = auxParts.findIndex((p) => p.kod === req.params.kod);
    if (auxIdx !== -1) {
      const doc = saveDocument(req.params.kind, req.params.kod, req.body.dataUrl, req.body.name);
      auxParts[auxIdx] = { ...auxParts[auxIdx], [req.params.kind]: doc };
      saveAuxiliaryParts(auxParts);
      return ok(res, doc);
    }

    return fail(res, 404, "Malzeme veya yardımcı parça bulunamadı.");
  } catch (e) {
    fail(res, 400, e.message);
  }
});

// ---- Tam yedek indir / geri yükle ----

// ---- Dizin ve Belge Depolama Konumları & Otomatik Tarama / Eşleştirme API ----

function norm(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]/g, "");
}

function scanAndMatchDirectory(kind, customPathOverride) {
  const dirPath = customPathOverride && customPathOverride.trim()
    ? customPathOverride.trim()
    : resolveStorageDirectory(kind);

  const exists = fs.existsSync(dirPath);
  if (!exists) {
    return {
      kind,
      scannedPath: dirPath,
      exists: false,
      totalFiles: 0,
      matchedCount: 0,
      suggestedCount: 0,
      unmatchedCount: 0,
      alreadyAttachedCount: 0,
      files: [],
    };
  }

  const materials = loadMaterials();
  const auxParts = loadAuxiliaryParts();
  const db = loadDb();
  const auxDb = loadAuxiliaryDb();
  const allReceipts = [...(db.receipts || []), ...(auxDb.receipts || [])];

  const scannedFiles = [];
  const allowedExts = new Set([".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"]);

  function readDirRecursive(curDir, relBase = "") {
    try {
      const items = fs.readdirSync(curDir);
      for (const item of items) {
        const full = path.join(curDir, item);
        const rel = path.join(relBase, item);
        try {
          const st = fs.statSync(full);
          if (st.isDirectory()) {
            readDirRecursive(full, rel);
          } else if (st.isFile()) {
            const ext = path.extname(item).toLowerCase();
            if (allowedExts.has(ext)) {
              scannedFiles.push({
                filename: item,
                fullPath: full,
                relativePath: rel,
                sizeBytes: st.size,
                mtime: st.mtime.toISOString(),
                kind,
              });
            }
          }
        } catch {}
      }
    } catch {}
  }

  readDirRecursive(dirPath);

  let matchedCount = 0;
  let suggestedCount = 0;
  let unmatchedCount = 0;
  let alreadyAttachedCount = 0;

  const resultFiles = scannedFiles.map((f) => {
    const baseName = path.parse(f.filename).name;
    const nBase = norm(baseName);

    let isAlreadyAttached = false;
    materials.forEach((m) => {
      if ((m.tds && m.tds.url && m.tds.url.includes(encodeURIComponent(f.filename))) ||
          (m.msds && m.msds.url && m.msds.url.includes(encodeURIComponent(f.filename)))) {
        isAlreadyAttached = true;
      }
    });
    allReceipts.forEach((r) => {
      const d = r.documents || {};
      if ((d.coa && d.coa.url && d.coa.url.includes(encodeURIComponent(f.filename))) ||
          (d.finalKontrol && d.finalKontrol.url && d.finalKontrol.url.includes(encodeURIComponent(f.filename))) ||
          (d.malzemeRaporu && d.malzemeRaporu.url && d.malzemeRaporu.url.includes(encodeURIComponent(f.filename))) ||
          (d.kaplamaRaporu && d.kaplamaRaporu.url && d.kaplamaRaporu.url.includes(encodeURIComponent(f.filename)))) {
        isAlreadyAttached = true;
      }
    });
    auxParts.forEach((p) => {
      if ((p.tds && p.tds.url && p.tds.url.includes(encodeURIComponent(f.filename))) ||
          (p.msds && p.msds.url && p.msds.url.includes(encodeURIComponent(f.filename)))) {
        isAlreadyAttached = true;
      }
    });

    if (isAlreadyAttached) {
      alreadyAttachedCount++;
    }

    const possibleCandidates = [];

    // Parti ve Fiş Eşleştirmesi (COA / Kalite Raporları)
    if (kind === "coa" || kind === "kaliteRaporlari" || kind === "genel") {
      allReceipts.forEach((r) => {
        const nLot = norm(r.lotNo);
        const nIrsaliye = norm(r.irsaliyeNo);
        const nMatKod = norm(r.malzemeKodu);
        
        let score = 0;
        let matchReason = "";

        if (nLot && nBase.includes(nLot)) {
          score = 100;
          matchReason = `Lot No tam eşleşti (${r.lotNo})`;
        } else if (nIrsaliye && nBase.includes(nIrsaliye)) {
          score = 85;
          matchReason = `İrsaliye No eşleşti (${r.irsaliyeNo})`;
        } else if (nMatKod && nBase.includes(nMatKod)) {
          score = 60;
          matchReason = `Malzeme Kodu içeriyor (${r.malzemeKodu})`;
        }

        if (score > 0) {
          possibleCandidates.push({
            type: "receipt",
            id: r.id,
            code: r.lotNo || r.irsaliyeNo || r.id,
            name: `${r.malzemeKodu} · Lot: ${r.lotNo || "-"} · ${r.firma || ""}`,
            fieldName: kind === "coa" ? "coa" : "finalKontrol",
            confidenceScore: score,
            matchReason,
          });
        }
      });
    }

    // Hammadde Eşleştirmesi (TDS / MSDS)
    if (kind === "tds" || kind === "msds" || kind === "genel") {
      materials.forEach((m) => {
        const nKod = norm(m.kod);
        const nAd = norm(m.ad);
        const nTicari = norm(m.ticariUnvan);

        let score = 0;
        let matchReason = "";

        if (nKod && nBase.includes(nKod)) {
          score = 100;
          matchReason = `Hammadde Kodu tam eşleşti (${m.kod})`;
        } else if (nAd && (nBase.includes(nAd) || nAd.includes(nBase))) {
          score = 80;
          matchReason = `Malzeme Adı eşleşti (${m.ad})`;
        } else if (nTicari && nBase.includes(nTicari)) {
          score = 70;
          matchReason = `Ticari Unvan eşleşti (${m.ticariUnvan})`;
        }

        if (score > 0) {
          possibleCandidates.push({
            type: "material",
            id: m.kod,
            code: m.kod,
            name: `${m.ad || m.kod} (${m.kod})`,
            fieldName: kind === "msds" ? "msds" : "tds",
            confidenceScore: score,
            matchReason,
          });
        }
      });
    }

    // Yardımcı Parça Eşleştirmesi
    if (kind === "yardimciParca" || kind === "tds" || kind === "msds" || kind === "genel") {
      auxParts.forEach((p) => {
        const nKod = norm(p.kod);
        const nAd = norm(p.ad);

        let score = 0;
        let matchReason = "";

        if (nKod && nBase.includes(nKod)) {
          score = 100;
          matchReason = `Yardımcı Parça Kodu tam eşleşti (${p.kod})`;
        } else if (nAd && (nBase.includes(nAd) || nAd.includes(nBase))) {
          score = 80;
          matchReason = `Parça Adı eşleşti (${p.ad})`;
        }

        if (score > 0) {
          possibleCandidates.push({
            type: "auxiliaryPart",
            id: p.kod,
            code: p.kod,
            name: `${p.ad || p.kod} (${p.kod})`,
            fieldName: kind === "msds" ? "msds" : "tds",
            confidenceScore: score,
            matchReason,
          });
        }
      });
    }

    possibleCandidates.sort((a, b) => b.confidenceScore - a.confidenceScore);

    let matchStatus = "unmatched";
    let matchedEntity = undefined;

    if (possibleCandidates.length > 0) {
      matchedEntity = possibleCandidates[0];
      if (matchedEntity.confidenceScore >= 95) {
        matchStatus = "exact";
        matchedCount++;
      } else {
        matchStatus = "suggested";
        suggestedCount++;
      }
    } else {
      unmatchedCount++;
    }

    return {
      ...f,
      matchStatus,
      isAlreadyAttached,
      matchedEntity,
      possibleCandidates: possibleCandidates.slice(0, 5),
    };
  });

  return {
    kind,
    scannedPath: dirPath,
    exists: true,
    totalFiles: scannedFiles.length,
    matchedCount,
    suggestedCount,
    unmatchedCount,
    alreadyAttachedCount,
    files: resultFiles,
  };
}

app.get("/api/storage/paths", (req, res) => {
  const result = {};
  for (const k of Object.keys(DEFAULT_STORAGE_PATHS)) {
    result[k] = getStorageDirectoryStats(k);
  }
  ok(res, result);
});

app.put("/api/storage/paths", requireRole("Yönetici", "Giriş Kalite"), async (req, res) => {
  const incoming = req.body || {};
  const current = loadStoragePaths();
  const updated = {};

  for (const [k, def] of Object.entries(DEFAULT_STORAGE_PATHS)) {
    const inc = incoming[k] || {};
    const newPath = (typeof inc.path === "string") ? inc.path.trim() : (current[k] ? current[k].path : "");
    updated[k] = {
      ...def,
      path: newPath,
    };

    // Eğer bir yol belirtilmişse ve klasör yoksa oluşturmayı dene
    if (newPath) {
      try {
        if (!fs.existsSync(newPath)) {
          fs.mkdirSync(newPath, { recursive: true });
        }
      } catch (e) {
        console.warn(`[STORAGE] Dizin oluşturulamadı (${newPath}):`, e.message);
      }
    }
  }

  try {
    await saveStoragePaths(updated);
  } catch (e) {
    return fail(res, 500, `Belge konumları kaydedilemedi: ${e.message}`);
  }
  appendAudit({
    entity: "storage_paths",
    entityId: "all",
    action: "belge kayıt ve arşiv konumları güncellendi",
    user: req.user ? req.user.username : "Sistem",
  });

  const result = {};
  for (const k of Object.keys(DEFAULT_STORAGE_PATHS)) {
    result[k] = getStorageDirectoryStats(k);
  }
  ok(res, result);
});

app.post("/api/storage/create-directory", requireRole("Yönetici", "Giriş Kalite"), (req, res) => {
  const { dirPath } = req.body || {};
  if (!dirPath || !dirPath.trim()) return fail(res, 400, "Dizin yolu belirtilmedi.");
  try {
    const clean = dirPath.trim();
    if (!fs.existsSync(clean)) {
      fs.mkdirSync(clean, { recursive: true });
    }
    ok(res, { success: true, created: true, path: clean });
  } catch (e) {
    fail(res, 400, `Klasör oluşturulamadı: ${e.message}`);
  }
});

app.post("/api/storage/scan", requireRole("Yönetici", "Giriş Kalite", "Satın Alma", "Depo"), (req, res) => {
  const { kind, customPath } = req.body || {};
  if (kind && kind !== "all") {
    const result = scanAndMatchDirectory(kind, customPath);
    return ok(res, result);
  }

  // Scan all kinds
  const allResults = [];
  for (const k of Object.keys(DEFAULT_STORAGE_PATHS)) {
    allResults.push(scanAndMatchDirectory(k, customPath));
  }
  ok(res, {
    kind: "all",
    scannedPath: "Tüm Yapılandırılmış Konumlar",
    exists: true,
    totalFiles: allResults.reduce((sum, r) => sum + r.totalFiles, 0),
    matchedCount: allResults.reduce((sum, r) => sum + r.matchedCount, 0),
    suggestedCount: allResults.reduce((sum, r) => sum + r.suggestedCount, 0),
    unmatchedCount: allResults.reduce((sum, r) => sum + r.unmatchedCount, 0),
    alreadyAttachedCount: allResults.reduce((sum, r) => sum + r.alreadyAttachedCount, 0),
    files: allResults.flatMap((r) => r.files),
  });
});

app.post("/api/storage/reconcile", requireRole("Yönetici", "Giriş Kalite"), (req, res) => {
  const { matches } = req.body || {};
  if (!Array.isArray(matches) || matches.length === 0) {
    return fail(res, 400, "Eşleştirilecek dosya listesi belirtilmedi.");
  }

  const materials = loadMaterials();
  const auxParts = loadAuxiliaryParts();
  const db = loadDb();
  const auxDb = loadAuxiliaryDb();

  let attachedCount = 0;

  for (const item of matches) {
    const { filename, kind, targetType, targetId, fieldName } = item;
    if (!filename || !targetType || !targetId) continue;

    const docObj = {
      name: filename,
      url: `/uploads/${kind || "genel"}/${encodeURIComponent(filename)}`,
      uploadedAt: new Date().toISOString(),
    };

    if (targetType === "material") {
      const idx = materials.findIndex((m) => m.kod === targetId);
      if (idx !== -1) {
        const field = fieldName === "msds" ? "msds" : "tds";
        materials[idx] = { ...materials[idx], [field]: docObj };
        attachedCount++;
      }
    } else if (targetType === "auxiliaryPart") {
      const idx = auxParts.findIndex((p) => p.kod === targetId);
      if (idx !== -1) {
        const field = fieldName === "msds" ? "msds" : "tds";
        auxParts[idx] = { ...auxParts[idx], [field]: docObj };
        attachedCount++;
      }
    } else if (targetType === "receipt") {
      let rIdx = db.receipts.findIndex((r) => r.id === targetId || r.lotNo === targetId);
      if (rIdx !== -1) {
        const r = db.receipts[rIdx];
        const existingDocs = r.documents || {};
        const field = fieldName || (kind === "coa" ? "coa" : "finalKontrol");
        db.receipts[rIdx] = { ...r, documents: { ...existingDocs, [field]: docObj } };
        attachedCount++;
      } else {
        let aIdx = (auxDb.receipts || []).findIndex((r) => r.id === targetId || r.lotNo === targetId);
        if (aIdx !== -1) {
          const r = auxDb.receipts[aIdx];
          const existingDocs = r.documents || {};
          const field = fieldName || (kind === "coa" ? "coa" : "finalKontrol");
          auxDb.receipts[aIdx] = { ...r, documents: { ...existingDocs, [field]: docObj } };
          attachedCount++;
        }
      }
    }
  }

  saveMaterials(materials);
  saveAuxiliaryParts(auxParts);
  saveDb(db);
  saveAuxiliaryDb(auxDb);

  appendAudit({
    entity: "storage",
    entityId: "reconciliation",
    action: `${attachedCount} adet PDF belgesi sistem kayıtlarıyla otomatik eşleştirildi ve bağlandı`,
    user: req.user ? req.user.username : "Sistem",
  });

  ok(res, { success: true, attachedCount });
});

app.get("/api/backup", (req, res) => {
  ok(res, {
    version: 1,
    exportedAt: new Date().toISOString(),
    db: loadDb(),
    materials: loadMaterials(),
    suppliers: loadSuppliers(),
    labelSettings: loadLabelSettings(),
  });
});

// Geri yükleme tüm veriyi değiştirdiği için sadece Yönetici yapabilir.
app.post("/api/restore", requireRole("Yönetici"), (req, res) => {
  const payload = req.body;
  if (!payload || !payload.db || !payload.materials) return fail(res, 400, "Geçersiz yedek verisi.");
  saveDb(payload.db);
  saveMaterials(payload.materials);
  saveSuppliers(payload.suppliers || []);
  saveLabelSettings(payload.labelSettings || DEFAULT_LABEL_SETTINGS);
  appendAudit({
    entity: "system",
    entityId: "restore",
    action: "yedekten geri yüklendi",
    user: req.user ? req.user.username : "Sistem",
  });
  ok(res, { restored: true });
});

// ---- Frontend sunumu (Geliştirme modunda Vite middleware, üretim modunda static dist) ----
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: false,
        },
        appType: "spa",
      });
      app.use(vite.middlewares);

      // Dev SPA fallback
      app.use("*", async (req, res, next) => {
        if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) return next();
        try {
          const indexPath = path.join(process.cwd(), "index.html");
          let template = fs.readFileSync(indexPath, "utf-8");
          template = await vite.transformIndexHtml(req.originalUrl, template);
          res.status(200).set({ "Content-Type": "text/html" }).end(template);
        } catch (e) {
          if (vite && typeof vite.ssrFixStacktrace === "function") {
            vite.ssrFixStacktrace(e);
          }
          next(e);
        }
      });
    } catch (err) {
      console.error("Vite middleware başlatılamadı:", err);
    }
  } else {
    if (fs.existsSync(FRONTEND_DIST)) {
      app.use(express.static(FRONTEND_DIST));
      app.get("*", (req, res, next) => {
        if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) return next();
        res.sendFile(path.join(FRONTEND_DIST, "index.html"));
      });
    }
  }

  const httpsEnabled =
    (process.env.ENABLE_HTTPS === "true" || process.env.HTTPS === "true" || process.env.USE_HTTPS === "1") &&
    fs.existsSync(CERT_KEY_FILE) &&
    fs.existsSync(CERT_CERT_FILE);
  const startHttp = () => {
    if (httpsEnabled && !USE_HTTPS_ONLY) {
      app.use((req, res, next) => {
        if (!req.secure) {
          const host = req.hostname;
          const port = HTTPS_PORT === 443 ? "" : `:${HTTPS_PORT}`;
          return res.redirect(308, `https://${host}${port}${req.originalUrl}`);
        }
        next();
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      if (httpsEnabled && !USE_HTTPS_ONLY) {
        console.log(`GKYS Solo HTTP sunucusu çalışıyor: http://0.0.0.0:${PORT} (HTTPS'ye yönlendirme aktif)`);
      } else {
        console.log(`GKYS Solo sunucusu çalışıyor: http://0.0.0.0:${PORT}`);
      }
      console.log(`Veri klasörü: ${DATA_DIR}`);
    });
  };

  const startHttps = () => {
    if (!httpsEnabled) {
      console.warn("HTTPS sertifikası bulunamadı. HTTPS başlatılamıyor.");
      return;
    }

    const options = {
      key: fs.readFileSync(CERT_KEY_FILE),
      cert: fs.readFileSync(CERT_CERT_FILE),
    };

    https.createServer(options, app).listen(HTTPS_PORT, "0.0.0.0", () => {
      console.log(`GKYS Solo HTTPS sunucusu çalışıyor: https://0.0.0.0:${HTTPS_PORT}`);
      console.log(`Veri klasörü: ${DATA_DIR}`);
    });
  };

  if (USE_HTTPS_ONLY) {
    if (!httpsEnabled) {
      console.warn("HTTPS-only modu etkin ama sertifika dosyaları bulunamadı. HTTP sunucusu yedek olarak başlatılıyor.");
      startHttp();
    } else {
      startHttps();
    }
  } else {
    startHttp();
    startHttps();
  }
}

startServer();
