export type Role =
  | "Yönetici"
  | "Giriş Kalite"
  | "Depo"
  | "Satın Alma"
  | "Üretim"
  | "Raporlama"
  | "Misafir";

export interface AuthUser {
  id: string;
  username: string;
  role: Role;
  permissions?: string[];
  active: boolean;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  date: string;
  entity: string;
  entityId: string;
  action: string;
  user: string;
  note?: string;
}

export interface Material {
  sira: number;
  firma: string;
  kod: string;
  cins: string | null;
  stokMiktari: number | null;
  minMiktar: string | number | null;
  stoklamaKosullari: string | null;
  // Legacy string fields
  yogunlukMinMax?: string | null;
  mfrMinMax?: string | null;
  sertlikMinMax?: string | null;
  vizkoziteMinMax?: string | null;
  katkiMinMax?: string | null;
  renkFarkiDE?: string | null;

  // Structured numeric spec fields (Min - Max)
  yogunlukMin?: number | null;
  yogunlukMax?: number | null;
  mfrMin?: number | null;
  mfrMax?: number | null;
  sertlikMin?: number | null;
  sertlikMax?: number | null;
  vizkoziteMin?: number | null;
  vizkoziteMax?: number | null;
  katkiMin?: number | null;
  katkiMax?: number | null;
  renkFarkiDEMin?: number | null;
  renkFarkiDEMax?: number | null;
  ambalajMiktariStandart?: number; // bir ambalajın (çuval/big-bag) standart KG miktarı
  depoKodu?: string; // Düzenlenebilir Depo Kodu / Rafı (örn. "DEP-01 / A-12")
  tds?: DocFile;  // Teknik Bilgi Formu — ürün bazlı, lot bazlı değil
  msds?: DocFile; // Güvenlik Bilgi Formu — ürün bazlı, lot bazlı değil
}

// ---- Yardımcı Parça & Özel Kalite Spec Yapısı ----
export interface CustomQualitySpec {
  id: string;
  paramName: string; // örn: "Dış Çap", "Boyut", "Et Kalınlığı", "Sertlik", "Çekme Mukavemeti"
  unit?: string;     // örn: "mm", "g", "Shore A", "Nm", "Tolerans", "%"
  minValue?: number | null;
  maxValue?: number | null;
  targetValue?: string | number | null;
  description?: string;
}

export interface AuxiliaryPart {
  sira: number;
  firma: string;
  kod: string;
  cins: string | null;
  stokMiktari: number | null;
  minMiktar: string | number | null;
  stoklamaKosullari: string | null;
  depoKodu?: string; // Düzenlenebilir Depo Kodu / Rafı (örn. "YP-01 / A-03")
  ambalajMiktariStandart?: number; // bir kutu/ambalajdaki standart adet/miktar
  birim?: string; // "ADET", "KG", "METRE", "PAKET", "KUTU" vb.
  qualitySpecs?: CustomQualitySpec[]; // Her parçaya özel eklenebilir / düzenlenebilir kalite spec sınırları
  tds?: DocFile;  // Teknik Çizim / Bilgi Formu
  msds?: DocFile; // Kalite / Güvenlik Belgesi
}

// ---- Yarı Mamül (Enjeksiyon Parçaları & Alt Montajlar) ----
export interface SemiFinishedPart {
  sira?: number;
  id?: string;
  kod: string; // örn: "YM-PL-201"
  ad: string;  // örn: "Plastik Gövde Parçası (Siyah)"
  plastikKalipNo?: string; // Plastik Enjeksiyon Kalıp Kodu / No (örn. "KLP-12")
  bagliHammaddeKodu?: string; // Kullanılan Hammadde Granül Kodu (örn. "HMM-PA66-01")
  depoKodu?: string; // Düzenlenebilir Yarı Mamül Depo Kodu / Rafı (örn. "YM-01 / R-02")
  birim?: string; // "ADET", "TAKIM", "KG" vb.
  stokMiktari: number;
  minStokMiktari?: number;
  aciklama?: string;
  olusturmaTarihi?: string;
  tds?: DocFile;  // Teknik Çizim / Teknik Şartname
  msds?: DocFile; // Kalite Kontrol Talimatı
}

// ---- Mamül (Nihai Montajlı Ürünler) ----
export interface BomItem {
  tip: "YARI_MAMUL" | "YARDIMCI_PARCA";
  kod: string; // Parça Kodu (örn. YM-PL-201 veya YP-CIVATA-01)
  miktar: number; // 1 adet mamül üretimi/montajı için gerekli miktar
}

export interface FinishedGood {
  sira?: number;
  id?: string;
  kod: string; // örn: "MAM-501"
  ad: string;  // örn: "Tamamlanmış Montajlı Plastik Kutu"
  plastikKalipNo?: string; // Plastik Enjeksiyon Kalıp Kodu / No (örn. "KLP-12")
  depoKodu?: string; // Düzenlenebilir Mamül Depo Kodu / Rafı (örn. "M-01 / A-10")
  birim?: string; // "ADET", "KUTU", "PALET" vb.
  stokMiktari: number;
  minStokMiktari?: number;
  aciklama?: string;
  olusturmaTarihi?: string;
  tds?: DocFile;
  msds?: DocFile;
  recete?: BomItem[]; // Ürün Ağacı / Reçete (Mamül çıkışında otomatik düşecek yarı mamül ve yardımcı parçalar)
}

export interface CoaValues {
  yogunluk?: string;
  mfr?: string;
  sertlik?: string;
  viskozite?: string;
  katki?: string;
  renkFarkiDE?: string;
  [key: string]: string | undefined;
}

export type ReceiptStatus =
  | "BEKLIYOR"      // kalite kontrol bekliyor
  | "ONAYLANDI"     // kalite onayı verildi, etiket bekliyor
  | "REDDEDILDI"    // kalite red
  | "DEPODA";       // etiket basıldı, depoya teslim edildi

export interface StorageCategoryConfig {
  id: string;
  label: string;
  path: string; // custom path (e.g. "C:\\GKYS_Belgeler\\MSDS")
  defaultPath: string; // fallback relative (e.g. "data/uploads/msds")
  resolvedPath: string; // actual path on disk
  description: string;
  exists: boolean;
  fileCount: number;
  totalSizeBytes: number;
}

export type StoragePathsConfig = Record<string, StorageCategoryConfig>;

export interface ScannedFileItem {
  filename: string;
  fullPath: string;
  relativePath: string;
  sizeBytes: number;
  mtime: string;
  kind: string;
  matchStatus: "exact" | "suggested" | "unmatched";
  isAlreadyAttached: boolean;
  matchedEntity?: {
    type: "material" | "auxiliaryPart" | "receipt";
    id: string;
    code: string;
    name: string;
    fieldName: "msds" | "tds" | "coa" | "finalKontrol" | "malzemeRaporu" | "kaplamaRaporu";
    confidenceScore: number;
    matchReason: string;
  };
  possibleCandidates?: Array<{
    type: "material" | "auxiliaryPart" | "receipt";
    id: string;
    code: string;
    name: string;
    fieldName: string;
  }>;
}

export interface StorageScanResult {
  kind: string;
  scannedPath: string;
  exists: boolean;
  totalFiles: number;
  matchedCount: number;
  suggestedCount: number;
  unmatchedCount: number;
  alreadyAttachedCount: number;
  files: ScannedFileItem[];
}

export interface DocFile {
  name: string;
  url: string; // sunucudaki gerçek PDF dosyasının yolu (örn. /uploads/coa/xxx.pdf)
  uploadedAt: string;
  storagePath?: string; // sunucudaki gerçek disk yolu
}

export interface ReceiptDocuments {
  coa?: DocFile; // CoA / Analiz Sertifikası — her lotun kendine ait analiz raporu
  finalKontrol?: DocFile; // Final Kontrol Raporu — tedarikçi parti final denetimi
  malzemeRaporu?: DocFile; // Malzeme Test Raporu / Sertifikası
  kaplamaRaporu?: DocFile; // Kaplama / Yüzey İşlem Raporu
}

export interface Receipt {
  id: string;
  firma: string;
  malzemeKodu: string;
  siparisNo: string;
  irsaliyeNo: string;
  faturaNo?: string;
  lotNo: string;
  gelenMiktar: number;
  girisTarihi: string;
  ambalajKontrol: boolean;
  analizRaporuVar: boolean;
  coa: CoaValues;
  durum: ReceiptStatus;
  redNedeni?: string;
  kontrolEden?: string;
  kontrolTarihi?: string;
  etiketBasimTarihi?: string;
  ambalajMiktari?: number; // bir ambalajdaki (çuval/big-bag) KG miktarı
  etiketSayisi?: number;   // bu lot için basılan toplam etiket sayısı
  sertifikaNo?: string;
  sonKullanmaTarihi?: string;
  documents?: ReceiptDocuments;
  malzemeTipi?: "HAMMADDE" | "YARDIMCI_PARCA";
  birim?: string;
  olusturmaTarihi: string;
}

export type MovementType = "GIRIS" | "CIKIS" | "RET" | "RET_CIKIS";

export interface Movement {
  id: string;
  tip: MovementType;
  lotNo: string;
  malzemeKodu: string;
  miktar: number;
  tarih: string;
  kullanici?: string;
  hareketFisiNo?: string;
  aciklama?: string;
  malzemeTipi?: "HAMMADDE" | "YARDIMCI_PARCA";
  birim?: string;
}

export interface LabelSettings {
  widthMm: number;
  heightMm: number;
  headerText: string;
  footerText: string;
  fontSizePt: number;
  qrSizeMm: number;
  logoUrl?: string;
}

export interface StockLot {
  lotNo: string;
  malzemeKodu: string;
  firma: string;
  kalanMiktar: number;
  ilkGirisMiktari: number;
  girisTarihi: string;
  depoLokasyonu?: string;
}

export interface SupplierDetail {
  id: string;
  unvan: string;
  yetkili?: string;
  telefon?: string;
  eposta?: string;
  adres?: string;
  vergiDairesi?: string;
  vergiNo?: string;
  tedarikMalzemeleri?: string[]; // Malzeme kodları
  notlar?: string;
  olusturmaTarihi: string;
}

export type PurchaseOrderStatus =
  | "TASLAK"
  | "GONDERILDI"
  | "KISMI_GELDI"
  | "TAMAMLANDI"
  | "IPTAL";

export interface PurchaseOrderItem {
  id: string;
  malzemeKodu: string;
  malzemeCinsi?: string;
  miktar: number;
  birim: "KG" | "TON" | "ADET" | "METRE" | "PAKET" | "KUTU" | "SET" | "LİTRE" | string;
  birimFiyat: number;
  toplamFiyat: number;
  teslimAlinanMiktar: number;
}

export interface PurchaseOrder {
  id: string;
  siparisNo: string;
  siparisTuru?: "HAMMADDE" | "YARDIMCI_PARCA";
  tedarikciFirma: string;
  tedarikciId?: string;
  siparisTarihi: string;
  teslimTarihi: string;
  odemeKosullari: string;
  paraBirimi: "TRY" | "EUR" | "USD";
  kalemler: PurchaseOrderItem[];
  toplamTutar: number;
  durum: PurchaseOrderStatus;
  olusturan?: string;
  imzaGorseli?: string;
  logoGorseli?: string;
  notlar?: string;
  olusturmaTarihi: string;
}

export interface Database {
  receipts: Receipt[];
  movements: Movement[];
  lots: Record<string, StockLot>;
}

export interface LabelData {
  receipt: Receipt;
  paketAgirligi: number;
  seq: number;
  toplamPaket: number;
}