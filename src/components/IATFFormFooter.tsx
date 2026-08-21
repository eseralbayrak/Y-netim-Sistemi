import React, { useState, useEffect } from "react";
import { type FormMetadata, loadFormMetadataItem, saveFormMetadataItem } from "../lib/formMetadata";
import { getStoredUser } from "../lib/auth";

interface Props {
  formId: string; // e.g. "SAT_F09", "STK_F01", "GKT_F01", "MAL_F01", "RAP_F01"
  defaultKodu?: string;
  defaultAdi?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function IATFFormFooter({ formId, defaultKodu, defaultAdi, className, style }: Props) {
  const [meta, setMeta] = useState<FormMetadata | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<FormMetadata | null>(null);

  const currentUser = getStoredUser();
  const isAdmin = currentUser?.role === "Yönetici";

  useEffect(() => {
    loadFormMetadataItem(formId, defaultKodu, defaultAdi).then(setMeta);
  }, [formId, defaultKodu, defaultAdi]);

  if (!meta) return null;

  const handleSave = async () => {
    if (!editForm) return;
    await saveFormMetadataItem(editForm);
    setMeta(editForm);
    setIsEditing(false);
  };

  return (
    <div className={`iatf-form-footer-wrapper ${className || ""}`} style={{ marginTop: "24px", ...style }}>
      {/* Visual Box Matching IATF 16949 Standard Footer */}
      <div
        style={{
          border: "1px solid #10151c",
          background: "#ffffff",
          color: "#000000",
          fontSize: "12px",
          fontWeight: "600",
          fontFamily: "sans-serif",
          padding: "0",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 1.2fr 1fr 1fr",
            textAlign: "center",
            lineHeight: "28px",
          }}
        >
          <div style={{ borderRight: "1px solid #000000", padding: "0 8px", whiteSpace: "nowrap" }}>
            <span style={{ fontWeight: "700" }}>Yürürlük Tarihi:</span> {meta.yururlukTarihi}
          </div>
          <div style={{ borderRight: "1px solid #000000", padding: "0 8px", whiteSpace: "nowrap" }}>
            <span style={{ fontWeight: "700" }}>Rev. Tarihi:</span> {meta.revTarihi}
          </div>
          <div style={{ borderRight: "1px solid #000000", padding: "0 8px", whiteSpace: "nowrap" }}>
            <span style={{ fontWeight: "700" }}>Rev. No:</span> {meta.revNo}
          </div>
          <div style={{ padding: "0 8px", fontWeight: "800", color: "#000000", whiteSpace: "nowrap" }}>
            {meta.formKodu}
          </div>
        </div>
      </div>

      {/* Admin Quick Form Edit Control (Screen Only, Hidden in Print) */}
      {isAdmin && (
        <div className="no-print" style={{ marginTop: "6px", textAlign: "right" }}>
          {!isEditing ? (
            <button
              type="button"
              className="btn-secondary btn-small"
              onClick={() => {
                setEditForm({ ...meta });
                setIsEditing(true);
              }}
              style={{ fontSize: "0.75rem", padding: "2px 8px", opacity: 0.85 }}
            >
              ✏️ Form No & Revizyon Bilgisini Düzenle ({meta.formKodu})
            </button>
          ) : (
            <div
              style={{
                background: "#1e293b",
                color: "#f8fafc",
                padding: "12px",
                borderRadius: "6px",
                marginTop: "8px",
                textAlign: "left",
                fontSize: "0.85rem",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <h5 style={{ margin: 0, color: "#60a5fa" }}>
                  ⚙️ IATF 16949 Form Bilgisi Düzenle ({meta.formAdi})
                </h5>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "8px" }}>
                <label style={{ display: "flex", flexDirection: "column", fontSize: "0.75rem", color: "#cbd5e1" }}>
                  Form Kodu
                  <input
                    value={editForm?.formKodu || ""}
                    onChange={(e) => editForm && setEditForm({ ...editForm, formKodu: e.target.value })}
                    style={{ padding: "4px 8px", marginTop: "2px", fontSize: "0.8rem", background: "#0f172a", color: "#fff", border: "1px solid #334155", borderRadius: "4px" }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", fontSize: "0.75rem", color: "#cbd5e1" }}>
                  Yürürlük Tarihi
                  <input
                    value={editForm?.yururlukTarihi || ""}
                    onChange={(e) => editForm && setEditForm({ ...editForm, yururlukTarihi: e.target.value })}
                    style={{ padding: "4px 8px", marginTop: "2px", fontSize: "0.8rem", background: "#0f172a", color: "#fff", border: "1px solid #334155", borderRadius: "4px" }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", fontSize: "0.75rem", color: "#cbd5e1" }}>
                  Revizyon Tarihi
                  <input
                    value={editForm?.revTarihi || ""}
                    onChange={(e) => editForm && setEditForm({ ...editForm, revTarihi: e.target.value })}
                    style={{ padding: "4px 8px", marginTop: "2px", fontSize: "0.8rem", background: "#0f172a", color: "#fff", border: "1px solid #334155", borderRadius: "4px" }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", fontSize: "0.75rem", color: "#cbd5e1" }}>
                  Revizyon No
                  <input
                    value={editForm?.revNo || ""}
                    onChange={(e) => editForm && setEditForm({ ...editForm, revNo: e.target.value })}
                    style={{ padding: "4px 8px", marginTop: "2px", fontSize: "0.8rem", background: "#0f172a", color: "#fff", border: "1px solid #334155", borderRadius: "4px" }}
                  />
                </label>
              </div>
              <div style={{ marginTop: "10px", display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <button type="button" className="btn-secondary btn-small" onClick={() => setIsEditing(false)}>
                  İptal
                </button>
                <button type="button" className="btn-primary btn-small" onClick={handleSave}>
                  💾 Kaydet
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
