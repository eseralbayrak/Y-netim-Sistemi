import { useState, useEffect } from "react";
import { type FormMetadata, loadAllFormMetadata, saveFormMetadataItem, deleteFormMetadataItem } from "../lib/formMetadata";
import { formatDateTR } from "../lib/dateUtils";

export function FormMetadataManager() {
  const [list, setList] = useState<FormMetadata[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormMetadata | null>(null);
  const [message, setMessage] = useState("");

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFormAdi, setNewFormAdi] = useState("");
  const [newFormKodu, setNewFormKodu] = useState("");
  const [newYururlukTarihi, setNewYururlukTarihi] = useState("");
  const [newRevTarihi, setNewRevTarihi] = useState("");
  const [newRevNo, setNewRevNo] = useState("01");

  // Delete confirm modal state
  const [itemToDelete, setItemToDelete] = useState<FormMetadata | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshList = async () => {
    const data = await loadAllFormMetadata();
    setList(data);
  };

  useEffect(() => {
    refreshList();
  }, []);

  const handleStartEdit = (item: FormMetadata) => {
    setEditingId(item.id);
    setEditForm({ ...item });
  };

  const handleSave = async () => {
    if (!editForm) return;
    setBusy(true);
    await saveFormMetadataItem(editForm);
    setEditingId(null);
    setEditForm(null);
    setMessage("Form metadata bilgisi başarıyla güncellendi.");
    setTimeout(() => setMessage(""), 3000);
    setBusy(false);
    await refreshList();
  };

  const handleAddNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFormAdi.trim() || !newFormKodu.trim()) return;
    setBusy(true);

    const generatedId =
      newFormKodu.trim().replace(/[^a-zA-Z0-9]/g, "_").toUpperCase() + "_" + Date.now().toString().slice(-4);

    const newItem: FormMetadata = {
      id: generatedId,
      formAdi: newFormAdi.trim(),
      formKodu: newFormKodu.trim(),
      yururlukTarihi: newYururlukTarihi.trim() || new Date().toLocaleDateString("tr-TR"),
      revTarihi: newRevTarihi.trim() || new Date().toLocaleDateString("tr-TR"),
      revNo: newRevNo.trim() || "01",
    };

    await saveFormMetadataItem(newItem);
    setNewFormAdi("");
    setNewFormKodu("");
    setNewYururlukTarihi("");
    setNewRevTarihi("");
    setNewRevNo("01");
    setShowAddForm(false);
    setMessage(`"${newItem.formKodu} - ${newItem.formAdi}" başarıyla eklendi.`);
    setTimeout(() => setMessage(""), 3500);
    setBusy(false);
    await refreshList();
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    setBusy(true);
    await deleteFormMetadataItem(itemToDelete.id);
    setMessage(`"${itemToDelete.formKodu}" form ve doküman kaydı silindi.`);
    setItemToDelete(null);
    setTimeout(() => setMessage(""), 3500);
    setBusy(false);
    await refreshList();
  };

  return (
    <div style={{ marginTop: "4px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <p className="muted" style={{ margin: "0", fontSize: "0.85rem" }}>
            Sistemdeki tüm çıktı, rapor ve belgelerin alt bilgi (Footer) form kodlarını, yürürlük ve revizyon tarihlerini yönetin.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary btn-small"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? "✕ İptal" : "➕ Yeni Form / Doküman Ekle"}
        </button>
      </div>

      {message && (
        <div style={{ padding: "8px 12px", background: "#10b98122", color: "#34d399", border: "1px solid #10b981", borderRadius: "6px", margin: "12px 0", fontSize: "0.85rem" }}>
          ✅ {message}
        </div>
      )}

      {/* Yeni Form / Doküman Ekleme Formu */}
      {showAddForm && (
        <form
          onSubmit={handleAddNew}
          style={{
            marginTop: 14,
            padding: 14,
            background: "rgba(0, 0, 0, 0.25)",
            border: "1px solid var(--panel-border, #334155)",
            borderRadius: 8,
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--accent)" }}>
            📋 Yeni IATF 16949 Form & Doküman Tanımlama
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 0.8fr", gap: 10 }}>
            <label>
              <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>Form / Doküman Adı *</span>
              <input
                type="text"
                placeholder="ör: Üretim Takip Formu"
                value={newFormAdi}
                onChange={(e) => setNewFormAdi(e.target.value)}
                style={{ width: "100%", padding: "6px 8px", marginTop: 2 }}
                required
              />
            </label>
            <label>
              <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>Form Kodu *</span>
              <input
                type="text"
                placeholder="ör: URE/F01"
                value={newFormKodu}
                onChange={(e) => setNewFormKodu(e.target.value)}
                style={{ width: "100%", padding: "6px 8px", marginTop: 2 }}
                required
              />
            </label>
            <label>
              <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>Yürürlük Tarihi</span>
              <input
                type="text"
                placeholder="01.01.2025"
                value={newYururlukTarihi}
                onChange={(e) => setNewYururlukTarihi(e.target.value)}
                style={{ width: "100%", padding: "6px 8px", marginTop: 2 }}
              />
            </label>
            <label>
              <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>Revizyon Tarihi</span>
              <input
                type="text"
                placeholder="01.01.2026"
                value={newRevTarihi}
                onChange={(e) => setNewRevTarihi(e.target.value)}
                style={{ width: "100%", padding: "6px 8px", marginTop: 2 }}
              />
            </label>
            <label>
              <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>Rev. No</span>
              <input
                type="text"
                placeholder="01"
                value={newRevNo}
                onChange={(e) => setNewRevNo(e.target.value)}
                style={{ width: "100%", padding: "6px 8px", marginTop: 2 }}
              />
            </label>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" className="btn-secondary btn-small" onClick={() => setShowAddForm(false)}>
              İptal
            </button>
            <button type="submit" className="btn-primary btn-small" disabled={busy}>
              💾 Formu Kaydet
            </button>
          </div>
        </form>
      )}

      {/* Tablo Listeleme */}
      <div style={{ marginTop: "16px", overflowX: "auto" }}>
        <table className="table" style={{ width: "100%", fontSize: "0.85rem" }}>
          <thead>
            <tr>
              <th>Form / Doküman Adı</th>
              <th>Form Kodu</th>
              <th>Yürürlük Tarihi</th>
              <th>Revizyon Tarihi</th>
              <th>Rev. No</th>
              <th style={{ width: "150px", textAlign: "right" }}>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {list.map((item) => {
              const isEditingThis = editingId === item.id;
              if (isEditingThis && editForm) {
                return (
                  <tr key={item.id} style={{ background: "rgba(59, 130, 246, 0.1)" }}>
                    <td>
                      <input
                        value={editForm.formAdi}
                        onChange={(e) => setEditForm({ ...editForm, formAdi: e.target.value })}
                        style={{ width: "100%", padding: "4px" }}
                      />
                    </td>
                    <td>
                      <input
                        value={editForm.formKodu}
                        onChange={(e) => setEditForm({ ...editForm, formKodu: e.target.value })}
                        style={{ width: "100%", padding: "4px" }}
                      />
                    </td>
                    <td>
                      <input
                        value={editForm.yururlukTarihi}
                        onChange={(e) => setEditForm({ ...editForm, yururlukTarihi: e.target.value })}
                        style={{ width: "100%", padding: "4px" }}
                      />
                    </td>
                    <td>
                      <input
                        value={editForm.revTarihi}
                        onChange={(e) => setEditForm({ ...editForm, revTarihi: e.target.value })}
                        style={{ width: "100%", padding: "4px" }}
                      />
                    </td>
                    <td>
                      <input
                        value={editForm.revNo}
                        onChange={(e) => setEditForm({ ...editForm, revNo: e.target.value })}
                        style={{ width: "100%", padding: "4px" }}
                      />
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className="btn-primary btn-small" onClick={handleSave} style={{ marginRight: "4px" }} disabled={busy}>
                        💾 Kaydet
                      </button>
                      <button className="btn-secondary btn-small" onClick={() => setEditingId(null)}>
                        ✖
                      </button>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={item.id}>
                  <td style={{ fontWeight: "600" }}>{item.formAdi}</td>
                  <td>
                    <span style={{ background: "#3b82f622", color: "#60a5fa", padding: "2px 6px", borderRadius: "4px", fontFamily: "monospace" }}>
                      {item.formKodu}
                    </span>
                  </td>
                  <td>{formatDateTR(item.yururlukTarihi)}</td>
                  <td>{formatDateTR(item.revTarihi)}</td>
                  <td>{item.revNo}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      className="btn-secondary btn-small"
                      onClick={() => handleStartEdit(item)}
                      style={{ marginRight: 6 }}
                    >
                      ✏️ Düzenle
                    </button>
                    <button
                      className="btn-danger btn-small"
                      onClick={() => setItemToDelete(item)}
                    >
                      🗑️ Sil
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Silme Onay Modalı (Sistem Arka Plan Teması İle Uyumlu Pop-Up) */}
      {itemToDelete && (
        <div className="modal-overlay" onClick={() => setItemToDelete(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: 460 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>⚠️ Form / Doküman Silme Onayı</h3>
              <button type="button" className="close-btn" onClick={() => setItemToDelete(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ padding: "20px 22px" }}>
              <p style={{ margin: "0 0 12px 0", fontSize: "0.95rem" }}>
                <strong>"{itemToDelete.formKodu} — {itemToDelete.formAdi}"</strong> form kaydını silmek istediğinize emin misiniz?
              </p>
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: 8,
                  padding: 12,
                  color: "#f87171",
                  fontSize: "0.85rem",
                }}
              >
                <strong>Uyarı:</strong> Bu işlem form tanımını listeden kaldıracaktır. Rapor ve alt bilgi şablonlarında varsayılan kodlar geçerli olabilir.
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setItemToDelete(null)}
              >
                İptal
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleDeleteConfirm}
                disabled={busy}
              >
                🗑️ Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

