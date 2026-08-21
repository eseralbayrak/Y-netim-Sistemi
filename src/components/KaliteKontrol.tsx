import { useEffect, useState } from "react";
import type { Receipt, CoaValues, Material, AuxiliaryPart, ReceiptDocuments } from "../types";
import { findMaterial } from "../lib/materialsStorage";
import { loadAuxiliaryParts } from "../lib/auxiliaryStorage";
import { updateReceipt, approveReceiptAndStock, rejectReceiptAndStock } from "../lib/storage";
import { getMaterialSpecRange, checkValueWithRange, formatSpecText } from "../lib/specCheck";
import { IATFFormFooter } from "./IATFFormFooter";
import DocHoverBadge from "./DocHoverBadge";
import { uploadReceiptDocument, validatePdf } from "../lib/fileUtils";
import { formatDateTR } from "../lib/dateUtils";

interface Props {
  receipts: Receipt[];
  onChanged: () => void;
}

const FIELD_DEFS: {
  key: keyof CoaValues;
  paramKey: "yogunluk" | "mfr" | "sertlik" | "vizkozite" | "katki" | "renkFarkiDE";
  label: string;
}[] = [
  { key: "yogunluk", paramKey: "yogunluk", label: "Yoğunluk (Density)" },
  { key: "mfr", paramKey: "mfr", label: "Erime Akış (MFR/MVR)" },
  { key: "sertlik", paramKey: "sertlik", label: "Sertlik" },
  { key: "viskozite", paramKey: "vizkozite", label: "Vizkozite" },
  { key: "katki", paramKey: "katki", label: "Katkı (Ash)" },
  { key: "renkFarkiDE", paramKey: "renkFarkiDE", label: "Renk Farkı ΔE" },
];

function ReceiptCard({ receipt, onChanged }: { receipt: Receipt; onChanged: () => void; key?: React.Key }) {
  const [material, setMaterial] = useState<Material | undefined>(undefined);
  const [auxPart, setAuxPart] = useState<AuxiliaryPart | undefined>(undefined);
  const [coa, setCoa] = useState<CoaValues>(receipt.coa || {});
  const [ambalajKontrol, setAmbalajKontrol] = useState(receipt.ambalajKontrol);
  const [analizRaporuVar, setAnalizRaporuVar] = useState(receipt.analizRaporuVar);
  const [receiptDocs, setReceiptDocs] = useState<ReceiptDocuments>(receipt.documents || {});
  const [uploadingKind, setUploadingKind] = useState<string | null>(null);
  const [redNedeni, setRedNedeni] = useState("");
  const [showRedInput, setShowRedInput] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleUploadDoc(
    docKind: "coa" | "finalKontrol" | "malzemeRaporu" | "kaplamaRaporu",
    file: File | null
  ) {
    if (!file) return;
    const err = validatePdf(file);
    if (err) {
      alert(err);
      return;
    }
    setUploadingKind(docKind);
    try {
      const doc = await uploadReceiptDocument(docKind, receipt.id, file);
      const updated = { ...receiptDocs, [docKind]: doc };
      setReceiptDocs(updated);
      onChanged();
    } catch (e: any) {
      alert(e.message || "Yükleme hatası");
    } finally {
      setUploadingKind(null);
    }
  }

  useEffect(() => {
    findMaterial(receipt.malzemeKodu).then((mat) => {
      if (mat) {
        setMaterial(mat);
      } else {
        loadAuxiliaryParts().then((parts) => {
          const found = parts.find((p) => p.kod === receipt.malzemeKodu);
          if (found) setAuxPart(found);
        });
      }
    });
  }, [receipt.malzemeKodu]);

  const isAuxPart = receipt.malzemeTipi === "YARDIMCI_PARCA" || !!auxPart;

  function saveCoaField(key: keyof CoaValues, value: string) {
    const updated = { ...coa, [key]: value };
    setCoa(updated);
    updateReceipt(receipt.id, { coa: updated }).catch(() => {});
  }

  const results = FIELD_DEFS.map((f) => {
    const range = getMaterialSpecRange(material, f.paramKey);
    const specText = formatSpecText(range);
    const r = checkValueWithRange(range, coa[f.key]);
    return { ...f, specText, range, ...r };
  });

  const auxResults = (auxPart?.qualitySpecs || []).map((sp) => {
    const range = { min: sp.minValue ?? undefined, max: sp.maxValue ?? undefined };
    const valKey = sp.id || sp.paramName;
    const specText = formatSpecText(range) + (sp.unit ? ` ${sp.unit}` : "");
    const r = checkValueWithRange(range, coa[valKey]);
    return { spec: sp, valKey, range, specText, ...r };
  });

  const anyNg = isAuxPart
    ? auxResults.some((r) => r.result === "NG")
    : results.some((r) => r.result === "NG");
  const canApprove = ambalajKontrol && (isAuxPart || analizRaporuVar);

  async function handleApprove() {
    setBusy(true);
    try {
      await updateReceipt(receipt.id, { ambalajKontrol, analizRaporuVar, coa });
      await approveReceiptAndStock(receipt.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!redNedeni.trim()) {
      setShowRedInput(true);
      return;
    }
    setBusy(true);
    try {
      await rejectReceiptAndStock(receipt.id, {
        redNedeni,
        ambalajKontrol,
        analizRaporuVar,
        coa,
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`card ${anyNg ? "card-warning" : ""}`}>
      <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <strong>{receipt.malzemeKodu}</strong>
          {material?.cins && <span className="muted"> — {material.cins}</span>}
          {auxPart?.cins && <span className="muted"> — {auxPart.cins}</span>}
          <div className="muted" style={{ fontSize: "0.85rem" }}>Tedarikçi: {receipt.firma}</div>
        </div>
        <div>
          {isAuxPart ? (
            <span className="tag" style={{ backgroundColor: "rgba(245, 158, 11, 0.18)", color: "#fbbf24", border: "1px solid rgba(245, 158, 11, 0.4)", fontWeight: "bold" }}>
              🔧 Yardımcı Parça
            </span>
          ) : (
            <span className="tag" style={{ backgroundColor: "rgba(59, 130, 246, 0.18)", color: "#60a5fa", border: "1px solid rgba(59, 130, 246, 0.4)", fontWeight: "bold" }}>
              🧪 Hammadde
            </span>
          )}
        </div>
      </div>

      <div className="card-meta" style={{ margin: "8px 0", fontSize: "0.88rem" }}>
        Lot No: <strong>{receipt.lotNo}</strong> · İrsaliye No: {receipt.irsaliyeNo} · Miktar:{" "}
        <strong>{receipt.gelenMiktar} {receipt.birim || auxPart?.birim || "kg"}</strong> · Giriş Tarihi: {formatDateTR(receipt.girisTarihi)}
      </div>

      {/* Kontrol Tik Kutucukları */}
      <div className="checks-row" style={{ display: "flex", flexDirection: "column", gap: 10, margin: "12px 0", padding: 14, background: "rgba(0, 0, 0, 0.25)", border: "1px solid var(--panel-border, #334155)", borderRadius: 8 }}>
        {/* Checkbox 1: İrsaliye / Ambalaj & Miktar Kontrolü */}
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: "0.88rem", fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={ambalajKontrol}
            onChange={(e) => {
              setAmbalajKontrol(e.target.checked);
              updateReceipt(receipt.id, { ambalajKontrol: e.target.checked }).catch(() => {});
            }}
            style={{ width: 18, height: 18, cursor: "pointer" }}
          />
          <span>📦 İrsaliye / Ambalaj, Görsel Kontrol ve Miktar Doğrulaması OK</span>
        </label>

        {/* Checkbox 2: Sertifika / CoA Durumu */}
        {isAuxPart ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: "0.88rem", fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={analizRaporuVar}
                onChange={(e) => {
                  setAnalizRaporuVar(e.target.checked);
                  updateReceipt(receipt.id, { analizRaporuVar: e.target.checked }).catch(() => {});
                }}
                style={{ width: 18, height: 18, cursor: "pointer" }}
              />
              <span>📜 Yardımcı Parça Kalite / Standart Sertifikası Gönderildi</span>
            </label>

            <div style={{ paddingLeft: 28 }}>
              {analizRaporuVar ? (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.35)", color: "#34d399", padding: "4px 10px", borderRadius: 6, fontSize: "0.8rem", fontWeight: 600 }}>
                  ✅ Sertifika Mevcut / Yüklenecek (Aşağıdaki Tedarikçi Belgeleri alanından PDF ekleyebilirsiniz)
                </div>
              ) : (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(245, 158, 11, 0.15)", border: "1px solid rgba(245, 158, 11, 0.35)", color: "#fbbf24", padding: "4px 10px", borderRadius: 6, fontSize: "0.8rem", fontWeight: 600 }}>
                  ⚠️ Sertifika Gönderilmedi (Sertifikasız Teslimat Onayı)
                </div>
              )}
            </div>
          </div>
        ) : (
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: "0.88rem", fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={analizRaporuVar}
              onChange={(e) => {
                setAnalizRaporuVar(e.target.checked);
                updateReceipt(receipt.id, { analizRaporuVar: e.target.checked }).catch(() => {});
              }}
              style={{ width: 18, height: 18, cursor: "pointer" }}
            />
            <span>🧪 Analiz Raporu (CoA) / Kalite Sertifikası Mevcut</span>
          </label>
        )}
      </div>

      {/* İçerik: Yardımcı Parça vs Hammadde */}
      {isAuxPart ? (
        <div style={{ background: "rgba(0, 0, 0, 0.25)", padding: 14, borderRadius: 8, margin: "10px 0", border: "1px solid var(--panel-border, #334155)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
            <div>
              <h4 style={{ margin: 0, fontSize: "0.92rem", color: "var(--accent, #3b82f6)" }}>
                📏 Yardımcı Parça Ölçüm & Spesifikasyon Kontrolü
              </h4>
              <p className="muted" style={{ fontSize: "0.82rem", margin: "2px 0 0 0" }}>
                Sistem Tanımları'nda kayıtlı olan parçaya özel teknik spesifikasyon ve tolerans değerleri için ölçümleri giriniz.
              </p>
            </div>
            {auxPart?.qualitySpecs && auxPart.qualitySpecs.length > 0 && (
              <span className="tag" style={{ backgroundColor: "rgba(59, 130, 246, 0.18)", color: "#60a5fa", border: "1px solid rgba(59, 130, 246, 0.4)", fontSize: "0.78rem" }}>
                {auxPart.qualitySpecs.length} Parametre Tanımlı
              </span>
            )}
          </div>

          {auxPart?.qualitySpecs && auxPart.qualitySpecs.length > 0 ? (
            <div className="table-scroll" style={{ marginTop: 10 }}>
              <table className="coa-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Ölçüm / Kontrol Parametresi</th>
                    <th style={{ textAlign: "left" }}>Spec / Tolerans Sınırı</th>
                    <th style={{ width: 180 }}>Ölçülen Değer</th>
                    <th style={{ width: 130, textAlign: "center" }}>Kalite Sonucu</th>
                  </tr>
                </thead>
                <tbody>
                  {auxResults.map((item) => (
                    <tr key={item.spec.id}>
                      <td>
                        <strong style={{ fontSize: "0.88rem", color: "var(--fg-main, #f8fafc)" }}>{item.spec.paramName}</strong>
                        {item.spec.description && (
                          <div className="muted" style={{ fontSize: "0.76rem", marginTop: 2 }}>
                            {item.spec.description}
                          </div>
                        )}
                      </td>
                      <td className="muted" style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                        {item.specText || "—"}
                      </td>
                      <td>
                        <input
                          className="coa-input"
                          type="text"
                          placeholder="Ölçülen değer..."
                          value={coa[item.valKey] || ""}
                          onChange={(e) => saveCoaField(item.valKey, e.target.value)}
                          style={{ width: "100%", padding: "4px 8px" }}
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {item.result === "OK" && (
                          <span className="tag-ok" style={{ display: "inline-block" }}>
                            ✅ OK
                          </span>
                        )}
                        {item.result === "NG" && (
                          <span className="tag-ng" style={{ display: "inline-block" }}>
                            ❌ NG (Dışı)
                          </span>
                        )}
                        {!item.result && item.hasSpec && (
                          <span className="muted" style={{ fontSize: "0.78rem" }}>
                            — Bekliyor
                          </span>
                        )}
                        {!item.hasSpec && (
                          <span
                            className={coa[item.valKey] ? "tag-ok" : "muted"}
                            style={{ fontSize: "0.78rem" }}
                          >
                            {coa[item.valKey] ? "✅ Kontrol Edildi" : "— Serbest"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ marginTop: 10, background: "rgba(255, 255, 255, 0.03)", padding: 12, borderRadius: 6, border: "1px dashed var(--panel-border, #334155)" }}>
              <div style={{ fontSize: "0.85rem", color: "#fbbf24", marginBottom: 6, fontWeight: 600 }}>
                💡 Bu yardımcı parça için henüz özel teknik spec tanımlanmamış.
              </div>
              <p className="muted" style={{ fontSize: "0.8rem", margin: "0 0 10px 0" }}>
                Sistem Tanımları → Yardımcı Parça Tanımları ekranından bu parçaya özel boyut, sertlik, et kalınlığı vb. tolerans sınırları tanımlayabilirsiniz.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, display: "block", marginBottom: 4 }}>
                    Görsel / Fiziksel Boyut Kontrolü:
                  </label>
                  <input
                    className="coa-input"
                    type="text"
                    placeholder="Örn: Görsel uygun, çap 12mm"
                    value={coa["genelBoyutKontrol"] || ""}
                    onChange={(e) => saveCoaField("genelBoyutKontrol", e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, display: "block", marginBottom: 4 }}>
                    Yüzey / Ambalaj & Çapak Notu:
                  </label>
                  <input
                    className="coa-input"
                    type="text"
                    placeholder="Örn: Çapak yok, ambalaj sağlam"
                    value={coa["yuzeyKontrolNotu"] || ""}
                    onChange={(e) => saveCoaField("yuzeyKontrolNotu", e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="table-scroll">
          <table className="coa-table">
            <thead>
              <tr>
                <th>Parametre</th>
                <th>Spec (Min-Max)</th>
                <th>Ölçülen Değer</th>
                <th>Sonuç</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.key}>
                  <td>{r.label}</td>
                  <td className="muted">{r.specText || "—"}</td>
                  <td>
                    {r.hasSpec ? (
                      <input
                        className="coa-input"
                        value={coa[r.key] || ""}
                        onChange={(e) => saveCoaField(r.key, e.target.value)}
                      />
                    ) : (
                      <span className="muted">spec yok</span>
                    )}
                  </td>
                  <td>
                    {r.result && (
                      <span className={r.result === "OK" ? "tag-ok" : "tag-ng"}>{r.result}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Parti / Sevkiyat Belgeleri (Final Kontrol, Malzeme Raporu, Kaplama Raporu, CoA) */}
      <div style={{ background: "rgba(0, 0, 0, 0.25)", padding: 14, borderRadius: 8, margin: "12px 0", border: "1px solid var(--panel-border, #334155)" }}>
        <h4 style={{ margin: "0 0 4px 0", fontSize: "0.9rem", color: "var(--accent, #3b82f6)" }}>
          📂 Tedarikçi Sevkiyat & Parti Belgeleri (PDF)
        </h4>
        <p className="muted" style={{ fontSize: "0.82rem", margin: "0 0 12px 0" }}>
          {isAuxPart
            ? "Yardımcı parça sevkiyatına ait Kalite Sertifikası, Final Kontrol Raporu, Malzeme Raporu veya Kaplama Raporu belgelerini yükleyebilirsiniz."
            : "Bu partiye/lota ait Analiz Sertifikası (CoA) ve test belgelerini yükleyebilirsiniz."}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <DocHoverBadge
            doc={receiptDocs.finalKontrol}
            label="Final Kontrol Raporu"
            uploading={uploadingKind === "finalKontrol"}
            onUpload={(f) => handleUploadDoc("finalKontrol", f)}
          />
          <DocHoverBadge
            doc={receiptDocs.malzemeRaporu}
            label="Malzeme Raporu"
            uploading={uploadingKind === "malzemeRaporu"}
            onUpload={(f) => handleUploadDoc("malzemeRaporu", f)}
          />
          <DocHoverBadge
            doc={receiptDocs.kaplamaRaporu}
            label="Kaplama Raporu"
            uploading={uploadingKind === "kaplamaRaporu"}
            onUpload={(f) => handleUploadDoc("kaplamaRaporu", f)}
          />
          <DocHoverBadge
            doc={receiptDocs.coa}
            label={isAuxPart ? "Kalite / Standart Sertifikası" : "CoA / Analiz Raporu"}
            uploading={uploadingKind === "coa"}
            onUpload={(f) => handleUploadDoc("coa", f)}
          />
        </div>
      </div>

      {anyNg && (
        <p className="warning-text">
          ⚠ Bir veya daha fazla parametre spec dışında. Onaylamadan önce kontrol edin.
        </p>
      )}

      <div className="actions-row" style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button
          className="btn-primary"
          disabled={!canApprove || busy}
          onClick={handleApprove}
          title={!canApprove ? "Ambalaj ve irsaliye kontrolü onaylanmalı" : ""}
        >
          Kalite Onayı Ver → Stoğa & Etiket Kuyruğuna Ekle
        </button>
        <button className="btn-danger" disabled={busy} onClick={handleReject}>
          Reddet
        </button>
      </div>

      {showRedInput && (
        <div className="red-reason" style={{ marginTop: 10 }}>
          <input
            placeholder="Red nedeni yazın..."
            value={redNedeni}
            onChange={(e) => setRedNedeni(e.target.value)}
            autoFocus
          />
          <button className="btn-danger" disabled={busy} onClick={handleReject}>
            Reddi Onayla
          </button>
        </div>
      )}
    </div>
  );
}

export default function KaliteKontrol({ receipts, onChanged }: Props) {
  const pending = receipts.filter((r) => r.durum === "BEKLIYOR");

  if (pending.length === 0) {
    return (
      <div className="panel">
        <h2>Kalite Kontrol</h2>
        <p className="muted">Kontrol bekleyen giriş fişi (Hammadde veya Yardımcı Parça) bulunmuyor.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>Kalite Kontrol — Bekleyen {pending.length} Kayıt</h2>
      <p className="muted" style={{ fontSize: "0.85rem", marginTop: -8, marginBottom: 16 }}>
        Mal kabulden girişi yapılan tüm hammaddeler ve yardımcı parçalar kalite kontrol onayına düşmektedir.
      </p>
      <div className="cards-list">
        {pending.map((r) => (
          <ReceiptCard key={r.id} receipt={r} onChanged={onChanged} />
        ))}
      </div>
      <IATFFormFooter formId="KAL_F04" defaultKodu="KAL/F04" defaultAdi="Giriş Kalite Kontrol Fişi" />
    </div>
  );
}

