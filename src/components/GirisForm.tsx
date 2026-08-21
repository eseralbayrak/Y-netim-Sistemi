import { useCallback, useEffect, useMemo, useState } from "react";
import { loadMaterials, loadSuppliers, addSupplierIfNew } from "../lib/materialsStorage";
import { loadAuxiliaryParts, loadAuxiliarySuppliers, loadAuxiliaryDb, generateAuxiliaryLotNo } from "../lib/auxiliaryStorage";
import { addReceipt } from "../lib/storage";
import { loadOrders, updateOrder } from "../lib/ordersStorage";
import type { AuxiliaryPart, Material, PurchaseOrder, Receipt } from "../types";
import { IATFFormFooter } from "./IATFFormFooter";
import { formatDateTR, todayIso, toIsoDate } from "../lib/dateUtils";

interface Props {
  onCreated: () => void;
  prefillData?: {
    siparisNo?: string;
    firma?: string;
    malzemeKodu?: string;
    miktar?: number;
  } | null;
}

export default function GirisForm({ onCreated, prefillData }: Props) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [auxParts, setAuxParts] = useState<AuxiliaryPart[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [auxSuppliers, setAuxSuppliers] = useState<string[]>([]);
  const [openOrders, setOpenOrders] = useState<PurchaseOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");

  const [firma, setFirma] = useState("");
  const [malzemeKodu, setMalzemeKodu] = useState("");
  const [malzemeTipi, setMalzemeTipi] = useState<"HAMMADDE" | "YARDIMCI_PARCA">("HAMMADDE");
  const [birim, setBirim] = useState<string>("KG");
  const [siparisNo, setSiparisNo] = useState("");
  const [irsaliyeNo, setIrsaliyeNo] = useState("");
  const [lotNo, setLotNo] = useState("");
  const [gelenMiktar, setGelenMiktar] = useState("");
  const [girisTarihi, setGirisTarihi] = useState(
    todayIso()
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMaterials().then(setMaterials);
    loadAuxiliaryParts().then(setAuxParts);
    loadSuppliers().then(setSuppliers);
    loadAuxiliarySuppliers().then(setAuxSuppliers);
    loadOrders().then((orders) => {
      setOpenOrders(orders.filter((o) => o.durum === "GONDERILDI" || o.durum === "KISMI_GELDI"));
    });
  }, []);

  // Seçili Malzeme Tipine Özel Tedarikçiler
  const filteredSuppliers = useMemo(() => {
    const set = new Set<string>();
    if (malzemeTipi === "HAMMADDE") {
      suppliers.forEach((s) => set.add(s));
      materials.forEach((m) => {
        if (m.firma) set.add(m.firma);
      });
    } else {
      auxSuppliers.forEach((s) => set.add(s));
      auxParts.forEach((p) => {
        if (p.firma) set.add(p.firma);
      });
    }
    return Array.from(set).sort();
  }, [malzemeTipi, suppliers, auxSuppliers, materials, auxParts]);

  // Seçili Malzeme Tipine (ve varsa seçili firmaya) Özel Katalog
  const filteredCatalogItems = useMemo(() => {
    const supLower = firma ? firma.trim().toLowerCase() : "";
    if (malzemeTipi === "HAMMADDE") {
      let list = materials;
      if (supLower) {
        const matching = materials.filter((m) => m.firma && m.firma.trim().toLowerCase() === supLower);
        if (matching.length > 0) list = matching;
      }
      return list.map((m) => ({
        kod: m.kod,
        cins: m.cins,
        firma: m.firma,
        tip: "HAMMADDE" as const,
        birim: "KG",
        label: `${m.kod} - ${m.cins || "Cins Belirtilmedi"}${m.firma ? ` (${m.firma})` : ""}`,
      }));
    } else {
      let list = auxParts;
      if (supLower) {
        const matching = auxParts.filter((p) => p.firma && p.firma.trim().toLowerCase() === supLower);
        if (matching.length > 0) list = matching;
      }
      return list.map((p) => ({
        kod: p.kod,
        cins: p.cins,
        firma: p.firma,
        tip: "YARDIMCI_PARCA" as const,
        birim: p.birim || "ADET",
        label: `${p.kod} - ${p.cins || "Cins Belirtilmedi"}${p.firma ? ` (${p.firma})` : ""}`,
      }));
    }
  }, [malzemeTipi, firma, materials, auxParts]);

  // Tümü kapsayan katalog (kodu direkt yazınca veya aramada bulmak için)
  const allCatalogItems = useMemo(() => {
    const mats = materials.map((m) => ({
      kod: m.kod,
      cins: m.cins,
      firma: m.firma,
      tip: "HAMMADDE" as const,
      birim: "KG",
    }));
    const auxs = auxParts.map((p) => ({
      kod: p.kod,
      cins: p.cins,
      firma: p.firma,
      tip: "YARDIMCI_PARCA" as const,
      birim: p.birim || "ADET",
    }));
    return [...mats, ...auxs];
  }, [materials, auxParts]);

  const handleSelectMalzeme = useCallback((kod: string) => {
    setMalzemeKodu(kod);
    const found = allCatalogItems.find((c) => c.kod === kod);
    if (found) {
      setMalzemeTipi(found.tip);
      if (found.birim) setBirim(found.birim);
      if (found.firma && (!firma || firma === "")) {
        setFirma(found.firma);
      }
      if (found.tip === "YARDIMCI_PARCA") {
        loadAuxiliaryDb().then((db) => {
          const lots = Object.keys(db.lots || {});
          setLotNo(generateAuxiliaryLotNo(lots));
        }).catch(() => {
          setLotNo(generateAuxiliaryLotNo([]));
        });
      }
    }
  }, [allCatalogItems, firma]);

  const handleMalzemeTipiChange = (newType: "HAMMADDE" | "YARDIMCI_PARCA") => {
    setMalzemeTipi(newType);
    // Malzeme kodunun tipi uyuşmuyorsa temizle
    const currentItem = allCatalogItems.find((c) => c.kod === malzemeKodu);
    if (currentItem && currentItem.tip !== newType) {
      setMalzemeKodu("");
    }
    if (newType === "YARDIMCI_PARCA") {
      setBirim("ADET");
      handleGenerateYlpLot();
    } else {
      setBirim("KG");
    }
  };

  async function handleGenerateYlpLot() {
    try {
      const db = await loadAuxiliaryDb();
      const lots = Object.keys(db.lots || {});
      setLotNo(generateAuxiliaryLotNo(lots));
    } catch {
      setLotNo(generateAuxiliaryLotNo([]));
    }
  }

  useEffect(() => {
    if (prefillData) {
      if (prefillData.firma) setFirma(prefillData.firma);
      if (prefillData.malzemeKodu) {
        handleSelectMalzeme(prefillData.malzemeKodu);
      }
      if (prefillData.siparisNo) setSiparisNo(prefillData.siparisNo);
      if (prefillData.miktar) setGelenMiktar(String(prefillData.miktar));
    }
  }, [prefillData, handleSelectMalzeme]);

  function handleOrderSelect(orderId: string) {
    setSelectedOrderId(orderId);
    if (!orderId) return;
    const po = openOrders.find((o) => o.id === orderId);
    if (po) {
      setFirma(po.tedarikciFirma);
      setSiparisNo(po.siparisNo);
      if (po.kalemler && po.kalemler.length > 0) {
        const item = po.kalemler[0];
        handleSelectMalzeme(item.malzemeKodu);
        setGelenMiktar(String(item.miktar));
        if (item.birim) setBirim(item.birim);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!firma || !malzemeKodu || !lotNo || !gelenMiktar || !irsaliyeNo) {
      setError("Firma, malzeme/parça kodu, irsaliye no, lot no ve miktar zorunludur.");
      return;
    }

    const receipt: Omit<Receipt, "id" | "olusturmaTarihi"> = {
      firma,
      malzemeKodu,
      malzemeTipi,
      birim,
      siparisNo,
      irsaliyeNo,
      lotNo,
      gelenMiktar: parseFloat(gelenMiktar.replace(",", ".")),
      girisTarihi,
      ambalajKontrol: false,
      analizRaporuVar: false,
      coa: {},
      durum: "BEKLIYOR",
    };

    setSaving(true);
    try {
      await addReceipt(receipt);
      await addSupplierIfNew(firma);

      // Seçilen siparişi 'KISMI_GELDI' veya 'TAMAMLANDI' durumuna güncelleyelim
      if (selectedOrderId) {
        await updateOrder(selectedOrderId, { durum: "KISMI_GELDI" });
      }

      setFirma("");
      setMalzemeKodu("");
      setSiparisNo("");
      setIrsaliyeNo("");
      setLotNo("");
      setGelenMiktar("");
      setSelectedOrderId("");
      onCreated();
    } catch (err: any) {
      setError(err.message || "Kaydedilemedi, tekrar deneyin.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h2>Mal Kabul — Giriş Fişi</h2>
          <p className="muted" style={{ fontSize: "0.85rem", marginTop: 2 }}>
            Hammaddeler ve Yardımcı Parçalar için ortak mal kabul. Fiş oluşturulduğunda otomatik Kalite Kontrol onay ekranına düşer.
          </p>
        </div>

        {openOrders.length > 0 && (
          <div style={{ background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.3)", padding: "6px 12px", borderRadius: "8px", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>📦 Açık Satın Alma Siparişinden Doldur:</span>
            <select
              value={selectedOrderId}
              onChange={(e) => handleOrderSelect(e.target.value)}
              style={{ padding: "4px 8px", fontSize: "0.85rem", width: "auto" }}
            >
              <option value="">-- Sipariş Seçin --</option>
              {openOrders.map((po) => (
                <option key={po.id} value={po.id}>
                  {po.siparisNo} - {po.tedarikciFirma} ({po.kalemler[0]?.malzemeKodu || ""})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid2">
        <label style={{ gridColumn: "span 2" }}>
          Mal Mümeyyizlik / Malzeme Tipi *
          <div style={{ display: "flex", gap: "20px", marginTop: "6px" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer", fontWeight: "bold" }}>
              <input
                type="radio"
                name="malzemeTipi"
                value="HAMMADDE"
                checked={malzemeTipi === "HAMMADDE"}
                onChange={() => handleMalzemeTipiChange("HAMMADDE")}
              />
              🧪 Hammadde (Plastik / Katkı / Masterbatch)
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer", fontWeight: "bold" }}>
              <input
                type="radio"
                name="malzemeTipi"
                value="YARDIMCI_PARCA"
                checked={malzemeTipi === "YARDIMCI_PARCA"}
                onChange={() => handleMalzemeTipiChange("YARDIMCI_PARCA")}
              />
              🔧 Yardımcı Parça (Kutu, Etiket, Yay, Ambalaj vb.)
            </label>
          </div>
        </label>

        <label>
          Tedarikçi Firma Adı *
          <select
            value={filteredSuppliers.includes(firma) ? firma : (firma ? "__custom__" : "")}
            onChange={(e) => {
              if (e.target.value !== "__custom__") {
                setFirma(e.target.value);
              }
            }}
            style={{ marginBottom: "6px", display: "block", width: "100%" }}
          >
            <option value="">
              {malzemeTipi === "HAMMADDE" ? "-- Hammadde Tedarikçisi Seçin --" : "-- Yardımcı Parça Tedarikçisi Seçin --"}
            </option>
            {filteredSuppliers.map((s) => (
              <option key={s} value={s}>
                🏢 {s}
              </option>
            ))}
            {firma && !filteredSuppliers.includes(firma) && (
              <option value="__custom__">✏️ Özel: {firma}</option>
            )}
          </select>

          <input
            list="firma-list"
            value={firma}
            onChange={(e) => setFirma(e.target.value)}
            placeholder="Veya firma adını buraya yazın..."
          />
          <datalist id="firma-list">
            {filteredSuppliers.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>

        <label>
          {malzemeTipi === "HAMMADDE" ? "Hammadde Kodu *" : "Yardımcı Parça Kodu *"}
          <select
            value={malzemeKodu}
            onChange={(e) => handleSelectMalzeme(e.target.value)}
            style={{ marginBottom: "6px", display: "block", width: "100%" }}
          >
            <option value="">
              {malzemeTipi === "HAMMADDE" ? "-- Hammadde Tanımları Kataloğundan Seçin --" : "-- Yardımcı Parça Tanımları Kataloğundan Seçin --"}
            </option>
            {filteredCatalogItems.map((c) => (
              <option key={c.kod} value={c.kod}>
                {c.label}
              </option>
            ))}
          </select>

          <input
            list="malzeme-list"
            value={malzemeKodu}
            onChange={(e) => handleSelectMalzeme(e.target.value)}
            placeholder="Veya kodu elle girin..."
          />
          <datalist id="malzeme-list">
            {filteredCatalogItems.map((c) => (
              <option key={c.kod} value={c.kod}>
                {c.label}
              </option>
            ))}
          </datalist>
        </label>

        <label>
          Sipariş No
          <input value={siparisNo} onChange={(e) => setSiparisNo(e.target.value)} placeholder="ör: SIP-2025-001" />
        </label>

        <label>
          İrsaliye No *
          <input value={irsaliyeNo} onChange={(e) => setIrsaliyeNo(e.target.value)} placeholder="ör: IRS-2025-88" />
        </label>

        <label>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
            <span>Lot / Parti No *</span>
            {malzemeTipi === "YARDIMCI_PARCA" && (
              <button
                type="button"
                className="btn-small btn-secondary"
                style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                onClick={handleGenerateYlpLot}
                title="Otomatik Yardımcı Parça Lot Formatı (YLP26/2266) Üret"
              >
                🎲 Otomatik Lot Üret (YLP26/2266)
              </button>
            )}
          </div>
          <input
            value={lotNo}
            onChange={(e) => setLotNo(e.target.value)}
            placeholder={malzemeTipi === "YARDIMCI_PARCA" ? "ör: YLP26/2266" : "ör: LOT-2025-01"}
          />
        </label>

        <label>
          Gelen Miktar & Birim *
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              style={{ flex: 1 }}
              value={gelenMiktar}
              onChange={(e) => setGelenMiktar(e.target.value)}
              placeholder="ör: 500"
              inputMode="decimal"
            />
            <select
              value={birim}
              onChange={(e) => setBirim(e.target.value)}
              style={{ width: "100px" }}
            >
              <option value="KG">KG</option>
              <option value="TON">TON</option>
              <option value="ADET">ADET</option>
              <option value="METRE">METRE</option>
              <option value="PAKET">PAKET</option>
              <option value="KUTU">KUTU</option>
              <option value="SET">SET</option>
              <option value="LİTRE">LİTRE</option>
            </select>
          </div>
        </label>

        <label>
          Giriş Tarihi
          <input
            type="text"
            placeholder="GG/AA/YYYY"
            value={formatDateTR(girisTarihi)}
            onChange={(e) => setGirisTarihi(toIsoDate(e.target.value))}
          />
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      <button type="submit" className="btn-primary" disabled={saving}>
        {saving ? "Kaydediliyor..." : "Giriş Fişi Oluştur → Kalite Kontrole Gönder"}
      </button>

      <IATFFormFooter formId="DEP_F03" defaultKodu="DEP/F03" defaultAdi="Mal Kabul ve Giriş Fişi" />
    </form>
  );
}

