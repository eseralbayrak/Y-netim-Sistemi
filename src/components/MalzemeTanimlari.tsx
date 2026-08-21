import { useEffect, useMemo, useState } from "react";
import type { Material } from "../types";
import {
  loadMaterials,
  addMaterial,
  updateMaterial,
  deleteMaterial,
  nextSira,
  loadSuppliers,
} from "../lib/materialsStorage";
import { validatePdf, uploadDocument } from "../lib/fileUtils";
import {
  getMaterialSpecRange,
  parseTurkishNumber,
  formatSpecText,
  extractRangeFromString,
} from "../lib/specCheck";
import DocHoverBadge from "./DocHoverBadge";
import { IATFFormFooter } from "./IATFFormFooter";

interface QualityParamConfig {
  paramKey: "yogunluk" | "mfr" | "sertlik" | "vizkozite" | "katki" | "renkFarkiDE";
  label: string;
  unit: string;
  minKey: keyof Material;
  maxKey: keyof Material;
  legacyKey: keyof Material;
  singleMax?: boolean;
}

const QUALITY_PARAMS: QualityParamConfig[] = [
  {
    paramKey: "yogunluk",
    label: "Yoğunluk (Density)",
    unit: "g/cm³",
    minKey: "yogunlukMin",
    maxKey: "yogunlukMax",
    legacyKey: "yogunlukMinMax",
  },
  {
    paramKey: "mfr",
    label: "Erime Akış (MFR/MVR)",
    unit: "g/10min veya cm³/10min",
    minKey: "mfrMin",
    maxKey: "mfrMax",
    legacyKey: "mfrMinMax",
  },
  {
    paramKey: "sertlik",
    label: "Sertlik",
    unit: "Shore / Pa.s",
    minKey: "sertlikMin",
    maxKey: "sertlikMax",
    legacyKey: "sertlikMinMax",
  },
  {
    paramKey: "vizkozite",
    label: "Vizkozite",
    unit: "ml/g veya Pa.s",
    minKey: "vizkoziteMin",
    maxKey: "vizkoziteMax",
    legacyKey: "vizkoziteMinMax",
  },
  {
    paramKey: "katki",
    label: "Katkı / Ash",
    unit: "% wt",
    minKey: "katkiMin",
    maxKey: "katkiMax",
    legacyKey: "katkiMinMax",
  },
  {
    paramKey: "renkFarkiDE",
    label: "Renk Farkı ΔE",
    unit: "Tolerans",
    minKey: "renkFarkiDEMin",
    maxKey: "renkFarkiDEMax",
    legacyKey: "renkFarkiDE",
    singleMax: true,
  },
];

const emptyForm = (sira: number): Material => ({
  sira,
  firma: "",
  kod: "",
  cins: "",
  stokMiktari: null,
  minMiktar: null,
  stoklamaKosullari: null,
  yogunlukMin: null,
  yogunlukMax: null,
  mfrMin: null,
  mfrMax: null,
  sertlikMin: null,
  sertlikMax: null,
  vizkoziteMin: null,
  vizkoziteMax: null,
  katkiMin: null,
  katkiMax: null,
  renkFarkiDEMin: null,
  renkFarkiDEMax: null,
  yogunlukMinMax: null,
  mfrMinMax: null,
  sertlikMinMax: null,
  vizkoziteMinMax: null,
  katkiMinMax: null,
  renkFarkiDE: null,
  ambalajMiktariStandart: undefined,
});

export default function MalzemeTanimlari() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingKod, setEditingKod] = useState<string | null>(null);
  const [form, setForm] = useState<Material>(() => emptyForm(1));
  const [error, setError] = useState("");
  const [docError, setDocError] = useState("");
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [firmaSuggestionsOpen, setFirmaSuggestionsOpen] = useState(false);

  useEffect(() => {
    refresh();
    loadSuppliers().then(setSuppliers);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return materials;
    const q = search.toLowerCase();
    return materials.filter(
      (m) =>
        m.kod.toLowerCase().includes(q) ||
        (m.cins || "").toLowerCase().includes(q) ||
        (m.firma || "").toLowerCase().includes(q)
    );
  }, [materials, search]);

  const eksikAmbalajSayisi = materials.filter((m) => !m.ambalajMiktariStandart).length;

  function refresh() {
    loadMaterials().then(setMaterials);
  }

  async function openNewForm() {
    setForm(emptyForm(await nextSira()));
    setEditingKod(null);
    setError("");
    setFormOpen(true);
  }

  function openEditForm(m: Material) {
    const updatedForm: Material = { ...m };

    // Otomatik ayrıştırma: sayısal alanlar boşsa ama legacy string alanı varsa doldur
    QUALITY_PARAMS.forEach((qp) => {
      const minVal = updatedForm[qp.minKey] as number | null | undefined;
      const maxVal = updatedForm[qp.maxKey] as number | null | undefined;
      const legacyStr = updatedForm[qp.legacyKey] as string | null | undefined;

      if ((minVal === undefined || minVal === null) && (maxVal === undefined || maxVal === null) && legacyStr) {
        const extracted = extractRangeFromString(legacyStr);
        if (extracted.min !== undefined) (updatedForm as any)[qp.minKey] = extracted.min;
        if (extracted.max !== undefined) (updatedForm as any)[qp.maxKey] = extracted.max;
      }
    });

    setForm(updatedForm);
    setEditingKod(m.kod);
    setError("");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setError("");
  }

  function handleSpecNumberChange(key: keyof Material, valStr: string) {
    const num = valStr.trim() !== "" ? parseTurkishNumber(valStr) : null;
    setForm((prev) => ({
      ...prev,
      [key]: num !== undefined ? num : null,
    }));
  }

  async function handleSave() {
    setError("");
    if (!form.kod.trim()) {
      setError("Malzeme kodu zorunludur.");
      return;
    }

    // Min > Max doğrulama kontrolü
    for (const qp of QUALITY_PARAMS) {
      if (qp.singleMax) continue;
      const minVal = form[qp.minKey] as number | null | undefined;
      const maxVal = form[qp.maxKey] as number | null | undefined;

      if (minVal !== null && minVal !== undefined && maxVal !== null && maxVal !== undefined) {
        if (minVal > maxVal) {
          setError(`${qp.label}: Min değeri (${minVal}), Max değerinden (${maxVal}) büyük olamaz.`);
          return;
        }
      }
    }

    // Legacy metin alanlarını otomatik güncelleyelim (geriye dönük tam uyumluluk)
    const payload: Material = { ...form };
    QUALITY_PARAMS.forEach((qp) => {
      const minVal = payload[qp.minKey] as number | null | undefined;
      const maxVal = payload[qp.maxKey] as number | null | undefined;

      if (qp.singleMax) {
        if (maxVal !== null && maxVal !== undefined) {
          (payload as any)[qp.legacyKey] = `<${maxVal}`;
        }
      } else {
        if (minVal !== null && minVal !== undefined && maxVal !== null && maxVal !== undefined) {
          (payload as any)[qp.legacyKey] = `${minVal}-${maxVal}`;
        } else if (minVal !== null && minVal !== undefined) {
          (payload as any)[qp.legacyKey] = `>${minVal}`;
        } else if (maxVal !== null && maxVal !== undefined) {
          (payload as any)[qp.legacyKey] = `<${maxVal}`;
        }
      }
    });

    try {
      if (editingKod) {
        await updateMaterial(editingKod, payload);
      } else {
        await addMaterial(payload);
      }
      refresh();
      closeForm();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDelete(kod: string) {
    if (!window.confirm(`"${kod}" malzemesini silmek istediğine emin misin?`)) return;
    await deleteMaterial(kod);
    refresh();
  }

  async function handleInlineAmbalaj(kod: string, value: string) {
    const num = value.trim() ? parseFloat(value.replace(",", ".")) : undefined;
    await updateMaterial(kod, { ambalajMiktariStandart: num });
    refresh();
  }

  async function handleBulkSet25() {
    if (
      !window.confirm(
        `Ambalaj miktarı boş olan ${eksikAmbalajSayisi} malzeme için standart ambalaj 25 KG olarak ayarlanacak. Devam edilsin mi?`
      )
    )
      return;
    for (const m of materials) {
      if (!m.ambalajMiktariStandart) {
        await updateMaterial(m.kod, { ambalajMiktariStandart: 25 });
      }
    }
    refresh();
  }

  async function handleUploadDoc(kod: string, field: "tds" | "msds", file: File | null) {
    if (!file) return;
    setDocError("");
    const err = validatePdf(file);
    if (err) {
      setDocError(`${kod}: ${err}`);
      return;
    }
    setUploadingKey(`${kod}-${field}`);
    try {
      await uploadDocument(field, kod, file);
      refresh();
    } catch (e: any) {
      setDocError(`${kod}: ${e.message || "Dosya yüklenemedi, tekrar deneyin."}`);
    } finally {
      setUploadingKey(null);
    }
  }

  return (
    <div className="panel">
      <h2>Malzeme Tanımları</h2>
      <p className="muted">
        Yeni hammadde ekle, kalite min/max spec değerlerini düzenle ve her malzeme için standart ambalaj
        (çuval/big-bag) miktarını gir. Bu değerler Kalite Kontrol, Etiket Basım ve Depo Çıkışı ekranlarında
        otomatik kullanılır.
      </p>

      <div className="toolbar-row">
        <input
          className="scan-input"
          placeholder="Kod, cins veya firma ile ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn-primary" onClick={openNewForm}>
          + Yeni Malzeme Ekle
        </button>
      </div>

      {eksikAmbalajSayisi > 0 && (
        <div className="warning-banner">
          <span>
            {eksikAmbalajSayisi} malzemede standart ambalaj miktarı tanımlı değil. Çoğu ürün
            için 25 KG kullanıyorsan topluca ayarlayıp sadece istisnaları (20 KG, 15 KG vb.)
            düzeltebilirsin.
          </span>
          <button className="btn-secondary btn-small" onClick={handleBulkSet25}>
            Boş Olanları 25 KG Yap
          </button>
        </div>
      )}

      {formOpen && (
        <div className="card material-form">
          <h3 className="sub-heading" style={{ marginTop: 0 }}>
            {editingKod ? `Malzemeyi Düzenle — ${editingKod}` : "Yeni Malzeme"}
          </h3>

          <div className="grid2">
            <label>
              Malzeme Kodu *
              <input
                value={form.kod}
                disabled={!!editingKod}
                onChange={(e) => setForm({ ...form, kod: e.target.value })}
                placeholder="örn. ZYTEL® MT409 AHS NC"
              />
            </label>
            <label>
              Cins / Açıklama
              <input
                value={form.cins || ""}
                onChange={(e) => setForm({ ...form, cins: e.target.value })}
              />
            </label>
            <label>
              Firma
              <div className="suggestion-input-wrap">
                <input
                  value={form.firma || ""}
                  onFocus={() => setFirmaSuggestionsOpen(true)}
                  onBlur={() => window.setTimeout(() => setFirmaSuggestionsOpen(false), 150)}
                  onChange={(e) => {
                    setForm({ ...form, firma: e.target.value });
                    setFirmaSuggestionsOpen(true);
                  }}
                  placeholder="Dropdown listesinden seçin veya firma adını buraya yazın..."
                  autoComplete="off"
                />
                {firmaSuggestionsOpen && (
                  <div className="suggestion-list" role="listbox">
                    {suppliers
                      .filter((supplier) => supplier.toLocaleLowerCase("tr-TR").includes((form.firma || "").toLocaleLowerCase("tr-TR")))
                      .slice(0, 12)
                      .map((supplier) => (
                        <button
                          type="button"
                          className="suggestion-item"
                          key={supplier}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            setForm({ ...form, firma: supplier });
                            setFirmaSuggestionsOpen(false);
                          }}
                        >
                          🏢 {supplier}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </label>
            <label>
              Standart Ambalaj Miktarı (KG)
              <input
                value={form.ambalajMiktariStandart ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    ambalajMiktariStandart: e.target.value
                      ? parseFloat(e.target.value.replace(",", "."))
                      : undefined,
                  })
                }
                inputMode="decimal"
                placeholder="örn. 25"
              />
            </label>
          </div>

          <h3 className="sub-heading" style={{ marginTop: 20 }}>
            Kalite Spec Sınırları (Sayısal Min / Max)
          </h3>
          <p className="muted" style={{ fontSize: "0.85rem", marginBottom: 12 }}>
            Kalite Kontrol ekranındaki sayısal karşılaştırmalar bu Min ve Max değerlerine göre yapılır.
          </p>

          <div className="spec-inputs-grid">
            {QUALITY_PARAMS.map((qp) => {
              const minVal = (form[qp.minKey] as string | number | null | undefined) ?? "";
              const maxVal = (form[qp.maxKey] as string | number | null | undefined) ?? "";

              if (qp.singleMax) {
                return (
                  <div key={qp.paramKey} className="spec-field-box" style={{ background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "6px" }}>
                      {qp.label} <span className="muted">({qp.unit})</span>
                    </div>
                    <label style={{ fontSize: "0.8rem", color: "#aaa" }}>
                      Üst Sınır (Max ΔE):
                      <input
                        type="text"
                        inputMode="decimal"
                        value={maxVal}
                        onChange={(e) => handleSpecNumberChange(qp.maxKey, e.target.value)}
                        placeholder="örn. 1.5"
                        style={{ marginTop: "4px" }}
                      />
                    </label>
                  </div>
                );
              }

              return (
                <div key={qp.paramKey} className="spec-field-box" style={{ background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "6px" }}>
                    {qp.label} <span className="muted">({qp.unit})</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <label style={{ fontSize: "0.8rem", color: "#aaa" }}>
                      Min Sınır:
                      <input
                        type="text"
                        inputMode="decimal"
                        value={minVal}
                        onChange={(e) => handleSpecNumberChange(qp.minKey, e.target.value)}
                        placeholder="Min"
                        style={{ marginTop: "4px" }}
                      />
                    </label>
                    <label style={{ fontSize: "0.8rem", color: "#aaa" }}>
                      Max Sınır:
                      <input
                        type="text"
                        inputMode="decimal"
                        value={maxVal}
                        onChange={(e) => handleSpecNumberChange(qp.maxKey, e.target.value)}
                        placeholder="Max"
                        style={{ marginTop: "4px" }}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          {error && <p className="error" style={{ marginTop: 16 }}>{error}</p>}

          <div className="actions-row" style={{ marginTop: 20 }}>
            <button className="btn-primary" onClick={handleSave}>
              {editingKod ? "Kaydet" : "Malzemeyi Ekle"}
            </button>
            <button className="btn-secondary" onClick={closeForm} style={{ marginLeft: 8 }}>
              Vazgeç
            </button>
          </div>
        </div>
      )}

      {docError && <p className="error">{docError}</p>}

      <div className="table-scroll">
        <table className="data-table" style={{ marginTop: 18 }}>
          <thead>
            <tr>
              <th>Malzeme Kodu</th>
              <th>Cins</th>
              <th>Firma</th>
              <th>Ambalaj (KG)</th>
              <th>Kalite Spec Sınırları</th>
              <th>TDS</th>
              <th>MSDS</th>
              <th>Aksiyon</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="muted">
                  Kayıt bulunamadı.
                </td>
              </tr>
            )}
            {filtered.map((m) => {
              const specSummaries = QUALITY_PARAMS.map((qp) => {
                const range = getMaterialSpecRange(m, qp.paramKey);
                if (range.min === undefined && range.max === undefined) return null;
                return `${qp.label}: ${formatSpecText(range)}`;
              }).filter(Boolean);

              return (
                <tr key={m.kod}>
                  <td><strong>{m.kod}</strong></td>
                  <td className="muted">{m.cins || "—"}</td>
                  <td className="muted">{m.firma || "—"}</td>
                  <td>
                    <input
                      className="coa-input"
                      defaultValue={m.ambalajMiktariStandart ?? ""}
                      onBlur={(e) => handleInlineAmbalaj(m.kod, e.target.value)}
                      inputMode="decimal"
                      placeholder="—"
                    />
                  </td>
                  <td>
                    {specSummaries.length > 0 ? (
                      <div style={{ fontSize: "0.8rem", color: "#60a5fa", display: "flex", flexDirection: "column", gap: "2px" }}>
                        {specSummaries.map((s, idx) => (
                          <span key={idx}>{s}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="muted" style={{ fontSize: "0.8rem" }}>—</span>
                    )}
                  </td>
                  <td>
                    <DocHoverBadge
                      doc={m.tds}
                      label=""
                      uploading={uploadingKey === `${m.kod}-tds`}
                      onUpload={(file) => handleUploadDoc(m.kod, "tds", file)}
                    />
                  </td>
                  <td>
                    <DocHoverBadge
                      doc={m.msds}
                      label=""
                      uploading={uploadingKey === `${m.kod}-msds`}
                      onUpload={(file) => handleUploadDoc(m.kod, "msds", file)}
                    />
                  </td>
                  <td>
                    <button className="btn-secondary btn-small" onClick={() => openEditForm(m)}>
                      Düzenle
                    </button>
                    <button
                      className="btn-danger btn-small"
                      style={{ marginLeft: 6 }}
                      onClick={() => handleDelete(m.kod)}
                    >
                      Sil
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <IATFFormFooter formId="MLZ_F02" defaultKodu="MLZ/F02" defaultAdi="Malzeme Tanım ve Şartname Listesi" />
    </div>
  );
}
