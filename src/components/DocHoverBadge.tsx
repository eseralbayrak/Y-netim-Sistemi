import { useState } from "react";
import type { DocFile } from "../types";
import PdfDocumentViewer from "./PdfDocumentViewer";

interface Props {
  doc: DocFile | undefined;
  label: string;
  onUpload: (file: File | null) => void;
  uploading?: boolean;
}

export default function DocHoverBadge({ doc, label, onUpload, uploading }: Props) {
  const [hover, setHover] = useState(false);
  const [fullView, setFullView] = useState(false);

  return (
    <div className="doc-badge-wrap">
      <div className="doc-badge-row">
        {label && <span className="doc-badge-label">{label}</span>}
        {doc ? (
          <a
            className="doc-badge-filename"
            href={doc.url}
            onClick={(event) => {
              event.preventDefault();
              setFullView(true);
            }}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            title="Önizlemek için üzerine gel, tam görüntülemek için tıkla"
          >
            📄 {doc.name}
          </a>
        ) : (
          <span className="muted">Yüklenmedi</span>
        )}
        <label className="btn-secondary btn-small doc-upload-btn">
          {uploading ? "Yükleniyor..." : doc ? "Değiştir" : "Yükle"}
          <input
            type="file"
            accept="application/pdf"
            disabled={uploading}
            style={{ display: "none" }}
            onChange={(e) => onUpload(e.target.files?.[0] || null)}
          />
        </label>
      </div>

      {hover && doc && (
        <div className="doc-hover-preview">
          <PdfDocumentViewer src={doc.url} title={doc.name} compact />
        </div>
      )}

      {fullView && doc && (
        <div className="pdf-modal-overlay" onClick={() => setFullView(false)}>
          <div className="pdf-modal" onClick={(event) => event.stopPropagation()}>
            <div className="pdf-modal-header">
              <strong>{doc.name}</strong>
              <div className="pdf-modal-actions">
                <a className="btn-secondary btn-small pdf-export-btn" href={doc.url} download={doc.name}>
                  PDF Olarak Dışa Aktar
                </a>
                <button type="button" className="btn-secondary btn-small pdf-close-btn" onClick={() => setFullView(false)}>Kapat</button>
              </div>
            </div>
            <PdfDocumentViewer src={doc.url} title={doc.name} />
          </div>
        </div>
      )}
    </div>
  );
}
