import { useEffect, useMemo, useState } from "react";
import type { Movement, Receipt, StockLot, Material, AuxiliaryPart, Database } from "../types";
import { loadMaterials } from "../lib/materialsStorage";
import { loadAuxiliaryParts, loadAuxiliaryDb } from "../lib/auxiliaryStorage";
import { processRetCikis } from "../lib/storage";
import { IATFFormFooter } from "./IATFFormFooter";
import * as XLSX from "xlsx";
import { formatDateTR, toIsoDate } from "../lib/dateUtils";

interface Props {
  receipts: Receipt[];
  movements: Movement[];
  lots: StockLot[];
  onChanged: () => void;
}

export default function RetBolgesi({ receipts, movements, lots, onChanged }: Props) {
  const [activeTab, setActiveTab] = useState<"hammadde" | "yardimci" | "hareketler">("hammadde");
  const [search, setSearch] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [auxParts, setAuxParts] = useState<AuxiliaryPart[]>([]);
  const [auxDb, setAuxDb] = useState<Database>({ receipts: [], movements: [], lots: {} });

  // Modal State for Return / Scrap
  const [cikisModalOpen, setCikisModalOpen] = useState(false);
  const [selectedLotForCikis, setSelectedLotForCikis] = useState<any | null>(null);
  const [cikisForm, setCikisForm] = useState({
    miktar: "",
    islemTuru: "TEDARIKCIYE_IADE" as "TEDARIKCIYE_IADE" | "HURDA",
    aciklama: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    refreshAux();
  }, []);

  function refreshAux() {
    loadMaterials().then(setMaterials);
    loadAuxiliaryParts().then(setAuxParts);
    loadAuxiliaryDb().then(setAuxDb);
  }

  // Combine all rejected receipts
  const rejectedReceipts = useMemo(() => {
    // 1. Receipts from main db
    const mainList = receipts.filter((r) => r.durum === "REDDEDILDI");
    // 2. Receipts from aux db
    const auxList = (auxDb.receipts || []).filter((r) => r.durum === "REDDEDILDI");

    const combinedMap = new Map<string, Receipt>();
    mainList.forEach((r) => combinedMap.set(r.id || r.lotNo, r));
    auxList.forEach((r) => {
      const key = r.id || r.lotNo;
      if (!combinedMap.has(key)) {
        combinedMap.set(key, r);
      }
    });

    return Array.from(combinedMap.values());
  }, [receipts, auxDb.receipts]);

  // Reddedilen Hammaddeler Listesi
  const rejectedHammaddeList = useMemo(() => {
    return rejectedReceipts
      .filter((r) => {
        if (r.malzemeTipi === "YARDIMCI_PARCA") return false;
        const isAux = auxParts.some((p) => p.kod === r.malzemeKodu);
        return !isAux;
      })
      .map((r) => {
        const mat = materials.find((m) => m.kod === r.malzemeKodu);
        const lotInfo = lots.find((l) => l.lotNo === r.lotNo) || (auxDb.lots && auxDb.lots[r.lotNo]);
        const kalan = lotInfo ? lotInfo.kalanMiktar : r.gelenMiktar;
        return {
          id: r.id,
          lotNo: r.lotNo,
          malzemeKodu: r.malzemeKodu,
          malzemeAdi: mat?.cins || "Hammadde",
          firma: r.firma,
          irsaliyeNo: r.irsaliyeNo,
          gelenMiktar: r.gelenMiktar,
          kalanMiktar: kalan,
          birim: r.birim || "KG",
          girisTarihi: r.girisTarihi,
          kontrolTarihi: r.kontrolTarihi || r.girisTarihi,
          redNedeni: r.redNedeni || "Kalite Kontrol Red",
          kontrolEden: r.kontrolEden || "Giriş Kalite",
          depoLokasyonu: lotInfo?.depoLokasyonu || "Ret Karantina Deposu",
          tip: "HAMMADDE" as const,
        };
      });
  }, [rejectedReceipts, materials, auxParts, lots, auxDb.lots]);

  // Reddedilen Yardımcı Parçalar Listesi
  const rejectedYardimciList = useMemo(() => {
    return rejectedReceipts
      .filter((r) => {
        if (r.malzemeTipi === "YARDIMCI_PARCA") return true;
        const isAux = auxParts.some((p) => p.kod === r.malzemeKodu);
        return isAux;
      })
      .map((r) => {
        const part = auxParts.find((p) => p.kod === r.malzemeKodu);
        const lotInfo = lots.find((l) => l.lotNo === r.lotNo) || (auxDb.lots && auxDb.lots[r.lotNo]);
        const kalan = lotInfo ? lotInfo.kalanMiktar : r.gelenMiktar;
        return {
          id: r.id,
          lotNo: r.lotNo,
          malzemeKodu: r.malzemeKodu,
          malzemeAdi: part?.cins || "Yardımcı Parça",
          firma: r.firma,
          irsaliyeNo: r.irsaliyeNo,
          gelenMiktar: r.gelenMiktar,
          kalanMiktar: kalan,
          birim: r.birim || part?.birim || "ADET",
          girisTarihi: r.girisTarihi,
          kontrolTarihi: r.kontrolTarihi || r.girisTarihi,
          redNedeni: r.redNedeni || "Kalite Kontrol Red",
          kontrolEden: r.kontrolEden || "Giriş Kalite",
          depoLokasyonu: lotInfo?.depoLokasyonu || "Ret Karantina Deposu",
          tip: "YARDIMCI_PARCA" as const,
        };
      });
  }, [rejectedReceipts, auxParts, auxDb.lots, lots]);

  // Ret Bölgesi Stok Hareketleri
  const retMovements = useMemo(() => {
    const mainMovs = movements.filter((m) => m.tip === "RET" || m.tip === "RET_CIKIS" || (m.aciklama && m.aciklama.includes("RET")));
    const auxMovs = (auxDb.movements || []).filter((m) => m.tip === "RET" || m.tip === "RET_CIKIS" || (m.aciklama && m.aciklama.includes("RET")));

    const combined = [...mainMovs, ...auxMovs];
    // Remove duplicates by id
    const map = new Map<string, Movement>();
    combined.forEach((m) => map.set(m.id, m));

    return Array.from(map.values()).sort((a, b) => b.tarih.localeCompare(a.tarih));
  }, [movements, auxDb.movements]);

  // Filtering function
  const filterRows = <T extends { lotNo: string; malzemeKodu: string; firma?: string; redNedeni?: string; girisTarihi?: string; kontrolTarihi?: string }>(rows: T[]) => {
    return rows.filter((r) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        r.lotNo.toLowerCase().includes(q) ||
        r.malzemeKodu.toLowerCase().includes(q) ||
        (r.firma || "").toLowerCase().includes(q) ||
        (r.redNedeni || "").toLowerCase().includes(q);

      const itemDate = r.kontrolTarihi || r.girisTarihi || "";
      const matchStart = !dateStart || itemDate >= dateStart;
      const matchEnd = !dateEnd || itemDate <= dateEnd + "T23:59:59";

      return matchSearch && matchStart && matchEnd;
    });
  };

  const filteredHammadde = useMemo(() => filterRows(rejectedHammaddeList), [rejectedHammaddeList, search, dateStart, dateEnd]);
  const filteredYardimci = useMemo(() => filterRows(rejectedYardimciList), [rejectedYardimciList, search, dateStart, dateEnd]);

  const filteredMovements = useMemo(() => {
    return retMovements.filter((m) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        m.lotNo.toLowerCase().includes(q) ||
        m.malzemeKodu.toLowerCase().includes(q) ||
        (m.aciklama || "").toLowerCase().includes(q) ||
        (m.kullanici || "").toLowerCase().includes(q);

      const mDate = m.tarih ? m.tarih.slice(0, 10) : "";
      const matchStart = !dateStart || mDate >= dateStart;
      const matchEnd = !dateEnd || mDate <= dateEnd;

      return matchSearch && matchStart && matchEnd;
    });
  }, [retMovements, search, dateStart, dateEnd]);

  // KPI calculations
  const totalHammaddeMiktar = rejectedHammaddeList.reduce((sum, r) => sum + (r.kalanMiktar || 0), 0);
  const totalYardimciMiktar = rejectedYardimciList.reduce((sum, r) => sum + (r.kalanMiktar || 0), 0);
  const totalActiveLots = rejectedHammaddeList.filter((r) => r.kalanMiktar > 0).length + rejectedYardimciList.filter((r) => r.kalanMiktar > 0).length;

  function handleOpenCikis(item: any) {
    setSelectedLotForCikis(item);
    setCikisForm({
      miktar: String(item.kalanMiktar || item.gelenMiktar || 0),
      islemTuru: "TEDARIKCIYE_IADE",
      aciklama: `[Ret Karantina Bölgesi] Tedarikçi Firma İadesi: ${item.firma}`,
    });
    setError("");
    setMessage("");
    setCikisModalOpen(true);
  }

  async function handleCikisSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLotForCikis) return;
    const qty = Number(cikisForm.miktar);
    if (isNaN(qty) || qty <= 0) {
      setError("Lütfen geçerli bir çıkış miktarı girin.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await processRetCikis({
        lotNo: selectedLotForCikis.lotNo,
        miktar: qty,
        islemTuru: cikisForm.islemTuru,
        aciklama: cikisForm.aciklama,
      });
      setMessage("Karantina stok çıkışı başarıyla kaydedildi.");
      setCikisModalOpen(false);
      refreshAux();
      onChanged();
    } catch (err: any) {
      setError(err.message || "İşlem sırasında hata oluştu.");
    } finally {
      setBusy(false);
    }
  }

  function exportToExcel() {
    let exportData: any[] = [];
    let fileName = "Ret_Bolgesi_Stok_Raporu.xlsx";

    if (activeTab === "hammadde") {
      exportData = filteredHammadde.map((r) => ({
        "Tarih": new Date(r.kontrolTarihi).toLocaleDateString("tr-TR"),
        "Lot No": r.lotNo,
        "Hammadde Kodu": r.malzemeKodu,
        "Malzeme Cinsi": r.malzemeAdi,
        "Tedarikçi": r.firma,
        "Karantina Kalan Miktar (KG)": r.kalanMiktar,
        "İlk Giriş Miktarı": r.gelenMiktar,
        "Red Nedeni": r.redNedeni,
        "Kontrol Eden": r.kontrolEden,
        "İrsaliye No": r.irsaliyeNo,
        "Lokasyon": r.depoLokasyonu,
      }));
      fileName = "Reddedilen_Hammaddeler_Karantina.xlsx";
    } else if (activeTab === "yardimci") {
      exportData = filteredYardimci.map((r) => ({
        "Tarih": new Date(r.kontrolTarihi).toLocaleDateString("tr-TR"),
        "Lot No": r.lotNo,
        "Yardımcı Parça Kodu": r.malzemeKodu,
        "Parça Tanımı": r.malzemeAdi,
        "Tedarikçi": r.firma,
        "Karantina Kalan Miktar": `${r.kalanMiktar} ${r.birim}`,
        "İlk Giriş Miktarı": `${r.gelenMiktar} ${r.birim}`,
        "Red Nedeni": r.redNedeni,
        "Kontrol Eden": r.kontrolEden,
        "İrsaliye No": r.irsaliyeNo,
        "Lokasyon": r.depoLokasyonu,
      }));
      fileName = "Reddedilen_Yardimci_Parcalar_Karantina.xlsx";
    } else {
      exportData = filteredMovements.map((m) => ({
        "Tarih": new Date(m.tarih).toLocaleString("tr-TR"),
        "Tip": m.tip,
        "Lot No": m.lotNo,
        "Malzeme Kodu": m.malzemeKodu,
        "Miktar": m.miktar,
        "Açıklama / Red Nedeni": m.aciklama,
        "Kullanıcı": m.kullanici,
      }));
      fileName = "Ret_Bolgesi_Stok_Hareketleri.xlsx";
    }

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Ret Bölgesi");
    XLSX.writeFile(workbook, fileName);
  }

  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Üst Başlık & KPI Kartları */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 10, color: "var(--red-text, #ef4444)" }}>
            🚨 Ret Bölgesi & Karantina Stok Yönetimi
          </h2>
          <p className="muted" style={{ margin: "4px 0 0 0", fontSize: "0.9rem" }}>
            Giriş Kalite Kontrol tarafından RED verilen tüm Hammadde ve Yardımcı Parça stok hareketleri ve karantina lotları.
          </p>
        </div>
        <button className="btn-secondary no-print" onClick={exportToExcel} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          📊 Excel'e Aktar
        </button>
      </div>

      {/* KPI Kartları Row */}
      <div className="grid4" style={{ gap: 12 }}>
        <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", padding: 14, borderRadius: 10 }}>
          <div className="muted" style={{ fontSize: "0.82rem", fontWeight: 600 }}>🧪 KARANTİNADAKİ HAMMADDELER</div>
          <div style={{ fontSize: "1.6rem", fontWeight: "bold", color: "#ef4444", marginTop: 4 }}>
            {totalHammaddeMiktar.toLocaleString("tr-TR")} <span style={{ fontSize: "0.9rem", fontWeight: "normal" }}>KG</span>
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 2 }}>
            Total {rejectedHammaddeList.length} Lot Kaydı
          </div>
        </div>

        <div style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", padding: 14, borderRadius: 10 }}>
          <div className="muted" style={{ fontSize: "0.82rem", fontWeight: 600 }}>🔧 KARANTİNADAKİ YARDIMCI PARÇALAR</div>
          <div style={{ fontSize: "1.6rem", fontWeight: "bold", color: "#f59e0b", marginTop: 4 }}>
            {totalYardimciMiktar.toLocaleString("tr-TR")} <span style={{ fontSize: "0.9rem", fontWeight: "normal" }}>ADET</span>
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 2 }}>
            Total {rejectedYardimciList.length} Lot Kaydı
          </div>
        </div>

        <div style={{ background: "rgba(168, 85, 247, 0.1)", border: "1px solid rgba(168, 85, 247, 0.3)", padding: 14, borderRadius: 10 }}>
          <div className="muted" style={{ fontSize: "0.82rem", fontWeight: 600 }}>📦 AKTİF KARANTİNA LOT SAYISI</div>
          <div style={{ fontSize: "1.6rem", fontWeight: "bold", color: "#a855f7", marginTop: 4 }}>
            {totalActiveLots} <span style={{ fontSize: "0.9rem", fontWeight: "normal" }}>Lot</span>
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 2 }}>
            Depoda Bekleyen Redli Malzemeler
          </div>
        </div>

        <div style={{ background: "rgba(59, 130, 246, 0.1)", border: "1px solid rgba(59, 130, 246, 0.3)", padding: 14, borderRadius: 10 }}>
          <div className="muted" style={{ fontSize: "0.82rem", fontWeight: 600 }}>📜 TOPLAM RET STOK HAREKETLERİ</div>
          <div style={{ fontSize: "1.6rem", fontWeight: "bold", color: "#3b82f6", marginTop: 4 }}>
            {retMovements.length} <span style={{ fontSize: "0.9rem", fontWeight: "normal" }}>Hareket</span>
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 2 }}>
            Giriş & İade Hareket Kaydı
          </div>
        </div>
      </div>

      {/* Arama ve Tarih Filtreleme Barı */}
      <div className="no-print" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", background: "rgba(0,0,0,0.15)", padding: 12, borderRadius: 8 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Lot No, Kod, Firma veya Red Nedeni Ara..."
            style={{ width: "100%", padding: "8px 12px" }}
          />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Tarih Aralığı:</span>
          <input
            type="text"
            placeholder="GG/AA/YYYY"
            value={formatDateTR(dateStart)}
            onChange={(e) => setDateStart(toIsoDate(e.target.value))}
            style={{ padding: "6px 8px" }}
          />
          <span>—</span>
          <input
            type="text"
            placeholder="GG/AA/YYYY"
            value={formatDateTR(dateEnd)}
            onChange={(e) => setDateEnd(toIsoDate(e.target.value))}
            style={{ padding: "6px 8px" }}
          />
          {(search || dateStart || dateEnd) && (
            <button
              type="button"
              className="btn-secondary btn-small"
              onClick={() => {
                setSearch("");
                setDateStart("");
                setDateEnd("");
              }}
            >
              Filtreleri Temizle
            </button>
          )}
        </div>
      </div>

      {/* Sekmeler (Hammadde / Yardımcı Parça / Hareketler) */}
      <div className="no-print" style={{ display: "flex", gap: 10, borderBottom: "2px solid var(--panel-border, #334155)", paddingBottom: 8 }}>
        <button
          type="button"
          className={`btn-secondary ${activeTab === "hammadde" ? "btn-primary" : ""}`}
          onClick={() => setActiveTab("hammadde")}
          style={{ fontWeight: "bold", padding: "8px 16px" }}
        >
          🧪 Reddedilen Hammaddeler ({filteredHammadde.length})
        </button>
        <button
          type="button"
          className={`btn-secondary ${activeTab === "yardimci" ? "btn-primary" : ""}`}
          onClick={() => setActiveTab("yardimci")}
          style={{ fontWeight: "bold", padding: "8px 16px" }}
        >
          🔧 Reddedilen Yardımcı Parçalar ({filteredYardimci.length})
        </button>
        <button
          type="button"
          className={`btn-secondary ${activeTab === "hareketler" ? "btn-primary" : ""}`}
          onClick={() => setActiveTab("hareketler")}
          style={{ fontWeight: "bold", padding: "8px 16px" }}
        >
          📜 Ret Bölgesi Stok Hareketleri ({filteredMovements.length})
        </button>
      </div>

      {/* Mesaj / Hata gösterimi */}
      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {/* TAB 1: REDDEDİLEN HAMMADDELER */}
      {activeTab === "hammadde" && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Red Tarihi</th>
                <th>Lot No</th>
                <th>Hammadde Kodu & Cinsi</th>
                <th>Tedarikçi Firma</th>
                <th>İlk Miktar</th>
                <th>Karantina Kalan</th>
                <th>Lokasyon</th>
                <th>Red Nedeni / Açıklama</th>
                <th className="no-print">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filteredHammadde.length === 0 && (
                <tr>
                  <td colSpan={9} className="muted" style={{ textAlign: "center", padding: 24 }}>
                    Reddedilmiş hammadde kaydı bulunamadı.
                  </td>
                </tr>
              )}
              {filteredHammadde.map((r) => (
                <tr key={r.id || r.lotNo}>
                  <td>{formatDateTR(r.kontrolTarihi)}</td>
                  <td>
                    <strong>{r.lotNo}</strong>
                    <div style={{ fontSize: "0.78rem", color: "#ef4444", fontWeight: "bold" }}>🚨 RED</div>
                  </td>
                  <td>
                    <strong>{r.malzemeKodu}</strong>
                    {r.malzemeAdi && <div className="muted" style={{ fontSize: "0.85rem" }}>{r.malzemeAdi}</div>}
                  </td>
                  <td>{r.firma}</td>
                  <td>{r.gelenMiktar} {r.birim}</td>
                  <td>
                    <strong style={{ color: r.kalanMiktar > 0 ? "#ef4444" : "var(--muted)" }}>
                      {r.kalanMiktar} {r.birim}
                    </strong>
                  </td>
                  <td>
                    <span className="tag" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#f87171" }}>
                      📍 {r.depoLokasyonu}
                    </span>
                  </td>
                  <td style={{ maxWidth: 220 }}>
                    <div className="error-text" style={{ fontSize: "0.88rem", fontWeight: 600 }}>
                      {r.redNedeni}
                    </div>
                    <div className="muted" style={{ fontSize: "0.78rem" }}>
                      Kontrol: {r.kontrolEden} · İrsaliye: {r.irsaliyeNo}
                    </div>
                  </td>
                  <td className="no-print">
                    {r.kalanMiktar > 0 ? (
                      <button
                        type="button"
                        className="btn-secondary btn-small"
                        onClick={() => handleOpenCikis(r)}
                        style={{ border: "1px solid #ef4444", color: "#ef4444" }}
                      >
                        🚚 Tedarikçiye İade / Hurda
                      </button>
                    ) : (
                      <span className="muted" style={{ fontSize: "0.82rem" }}>İade/Hurda Edildi</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: REDDEDİLEN YARDIMCI PARÇALAR */}
      {activeTab === "yardimci" && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Red Tarihi</th>
                <th>Lot No</th>
                <th>Parça Kodu & Tanımı</th>
                <th>Tedarikçi Firma</th>
                <th>İlk Miktar</th>
                <th>Karantina Kalan</th>
                <th>Lokasyon</th>
                <th>Red Nedeni / Açıklama</th>
                <th className="no-print">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filteredYardimci.length === 0 && (
                <tr>
                  <td colSpan={9} className="muted" style={{ textAlign: "center", padding: 24 }}>
                    Reddedilmiş yardımcı parça kaydı bulunamadı.
                  </td>
                </tr>
              )}
              {filteredYardimci.map((r) => (
                <tr key={r.id || r.lotNo}>
                  <td>{formatDateTR(r.kontrolTarihi)}</td>
                  <td>
                    <strong>{r.lotNo}</strong>
                    <div style={{ fontSize: "0.78rem", color: "#f59e0b", fontWeight: "bold" }}>🚨 RED</div>
                  </td>
                  <td>
                    <strong>{r.malzemeKodu}</strong>
                    {r.malzemeAdi && <div className="muted" style={{ fontSize: "0.85rem" }}>{r.malzemeAdi}</div>}
                  </td>
                  <td>{r.firma}</td>
                  <td>{r.gelenMiktar} {r.birim}</td>
                  <td>
                    <strong style={{ color: r.kalanMiktar > 0 ? "#f59e0b" : "var(--muted)" }}>
                      {r.kalanMiktar} {r.birim}
                    </strong>
                  </td>
                  <td>
                    <span className="tag" style={{ background: "rgba(245, 158, 11, 0.2)", color: "#fbbf24" }}>
                      📍 {r.depoLokasyonu}
                    </span>
                  </td>
                  <td style={{ maxWidth: 220 }}>
                    <div className="error-text" style={{ fontSize: "0.88rem", fontWeight: 600 }}>
                      {r.redNedeni}
                    </div>
                    <div className="muted" style={{ fontSize: "0.78rem" }}>
                      Kontrol: {r.kontrolEden} · İrsaliye: {r.irsaliyeNo}
                    </div>
                  </td>
                  <td className="no-print">
                    {r.kalanMiktar > 0 ? (
                      <button
                        type="button"
                        className="btn-secondary btn-small"
                        onClick={() => handleOpenCikis(r)}
                        style={{ border: "1px solid #f59e0b", color: "#f59e0b" }}
                      >
                        🚚 Tedarikçiye İade / Hurda
                      </button>
                    ) : (
                      <span className="muted" style={{ fontSize: "0.82rem" }}>İade/Hurda Edildi</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: STOK HAREKETLERİ */}
      {activeTab === "hareketler" && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Hareket Tipi</th>
                <th>Tarih</th>
                <th>Lot No</th>
                <th>Malzeme Kodu</th>
                <th>Miktar</th>
                <th>Kullanıcı</th>
                <th>Açıklama / Detay</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovements.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted" style={{ textAlign: "center", padding: 24 }}>
                    Ret bölgesi stok hareketi bulunamadı.
                  </td>
                </tr>
              )}
              {filteredMovements.map((m) => (
                <tr key={m.id}>
                  <td>
                    {m.tip === "RET" ? (
                      <span className="tag" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.4)" }}>
                        🚨 RET KARANTİNA GİRİŞİ
                      </span>
                    ) : m.tip === "RET_CIKIS" ? (
                      <span className="tag" style={{ background: "rgba(168, 85, 247, 0.2)", color: "#c084fc", border: "1px solid rgba(168, 85, 247, 0.4)" }}>
                        🚚 RET KARANTİNA ÇIKIŞI
                      </span>
                    ) : (
                      <span className="tag-info">{m.tip}</span>
                    )}
                  </td>
                  <td>{formatDateTR(m.tarih)}</td>
                  <td><strong>{m.lotNo}</strong></td>
                  <td>{m.malzemeKodu}</td>
                  <td><strong>{m.miktar}</strong></td>
                  <td>{m.kullanici || "Giriş Kalite"}</td>
                  <td className="muted" style={{ fontSize: "0.88rem" }}>{m.aciklama || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tedarikçiye İade / Hurda Çıkış Modalı */}
      {cikisModalOpen && selectedLotForCikis && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, zIndex: 1200 }}>
          <div style={{ background: "var(--panel-bg)", padding: 20, borderRadius: 10, maxWidth: 520, width: "90%", margin: "80px auto" }}>
            <h3 style={{ marginTop: 0, color: "#ef4444" }}>
              🚨 Karantina Stok Çıkışı — Lot: {selectedLotForCikis.lotNo}
            </h3>
            <p className="muted" style={{ fontSize: "0.88rem" }}>
              Malzeme Kodu: <strong>{selectedLotForCikis.malzemeKodu}</strong> · Tedarikçi: {selectedLotForCikis.firma}
            </p>

            {error && <div className="alert alert-danger" style={{ marginBottom: 10 }}>{error}</div>}

            <form onSubmit={handleCikisSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
              <label>
                Çıkış Türü *
                <select
                  value={cikisForm.islemTuru}
                  onChange={(e) => setCikisForm({ ...cikisForm, islemTuru: e.target.value as any })}
                  style={{ width: "100%", marginTop: 4 }}
                >
                  <option value="TEDARIKCIYE_IADE">🚚 Tedarikçiye İade Çıkışı</option>
                  <option value="HURDA">🗑️ Hurda / İmha Çıkışı</option>
                </select>
              </label>

              <label>
                Çıkış Miktarı ({selectedLotForCikis.birim || "KG"}) *
                <input
                  type="number"
                  step="any"
                  max={selectedLotForCikis.kalanMiktar}
                  value={cikisForm.miktar}
                  onChange={(e) => setCikisForm({ ...cikisForm, miktar: e.target.value })}
                  required
                  style={{ width: "100%", marginTop: 4 }}
                />
                <span className="muted" style={{ fontSize: "0.8rem" }}>
                  Mevcut Karantina Stok: {selectedLotForCikis.kalanMiktar} {selectedLotForCikis.birim || "KG"}
                </span>
              </label>

              <label>
                Açıklama / İade İrsaliye No *
                <textarea
                  value={cikisForm.aciklama}
                  onChange={(e) => setCikisForm({ ...cikisForm, aciklama: e.target.value })}
                  placeholder="İade irsaliye numarası, kargo veya imha tutanağı notu..."
                  rows={3}
                  style={{ width: "100%", marginTop: 4 }}
                  required
                />
              </label>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setCikisModalOpen(false)}
                  disabled={busy}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ backgroundColor: "#ef4444" }}
                  disabled={busy}
                >
                  {busy ? "Kaydediliyor..." : "Çıkışı Onayla"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <IATFFormFooter formId="KAL_F09" defaultKodu="KAL/F09" defaultAdi="Ret Karantina Bölgesi Stok ve Uygunsuzluk Raporu" />
    </div>
  );
}
