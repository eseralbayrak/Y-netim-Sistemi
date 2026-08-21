import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import type { AuxiliaryPart, Material, PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus, SupplierDetail } from "../types";
import { loadMaterials } from "../lib/materialsStorage";
import { loadAuxiliaryParts, loadAuxiliarySuppliers } from "../lib/auxiliaryStorage";
import { IATFFormFooter } from "./IATFFormFooter";
import { addDaysIso, formatDateTR, todayIso, toIsoDate } from "../lib/dateUtils";
import {
  loadOrders,
  addOrder,
  updateOrder,
  deleteOrder,
  nextPoNumber,
  loadSupplierDetails,
  saveSupplierDetail,
  deleteSupplierDetail,
} from "../lib/ordersStorage";

interface Props {
  onStartReception?: (po: { siparisNo: string; firma: string; malzemeKodu: string; miktar?: number }) => void;
}

const STATUS_LABELS: Record<PurchaseOrderStatus, { label: string; class: string }> = {
  TASLAK: { label: "Taslak", class: "tag-info" },
  GONDERILDI: { label: "Sipariş Gönderildi", class: "tag-ok" },
  KISMI_GELDI: { label: "Kısmi Teslim Edildi", class: "tag-info" },
  TAMAMLANDI: { label: "Tamamlandı", class: "tag-ok" },
  IPTAL: { label: "İptal Edildi", class: "tag-ng" },
};

const MONTH_NAMES: { value: string; label: string }[] = [
  { value: "01", label: "Ocak" },
  { value: "02", label: "Şubat" },
  { value: "03", label: "Mart" },
  { value: "04", label: "Nisan" },
  { value: "05", label: "Mayıs" },
  { value: "06", label: "Haziran" },
  { value: "07", label: "Temmuz" },
  { value: "08", label: "Ağustos" },
  { value: "09", label: "Eylül" },
  { value: "10", label: "Ekim" },
  { value: "11", label: "Kasım" },
  { value: "12", label: "Aralık" },
];

export default function SatinAlma({ onStartReception }: Props) {
  const [subTab, setSubTab] = useState<"siparisler" | "tedarikciler">("siparisler");
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierDetail[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [auxParts, setAuxParts] = useState<AuxiliaryPart[]>([]);
  const [auxSuppliers, setAuxSuppliers] = useState<string[]>([]);

  // Filters for orders
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [yearFilter, setYearFilter] = useState<string>("ALL");
  const [monthFilter, setMonthFilter] = useState<string>("ALL");
  const [supplierFilter, setSupplierFilter] = useState<string>("ALL");
  const [materialFilter, setMaterialFilter] = useState<string>("ALL");

  // Order Form Modal State
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [orderForm, setOrderForm] = useState<{
    siparisNo: string;
    siparisTuru: "HAMMADDE" | "YARDIMCI_PARCA";
    tedarikciFirma: string;
    siparisTarihi: string;
    teslimTarihi: string;
    odemeKosullari: string;
    paraBirimi: "TRY" | "EUR" | "USD";
    kalemler: PurchaseOrderItem[];
    notlar: string;
    logoGorseli?: string;
    imzaGorseli?: string;
  }>({
    siparisNo: "",
    siparisTuru: "HAMMADDE",
    tedarikciFirma: "",
    siparisTarihi: todayIso(),
    teslimTarihi: addDaysIso(7),
    odemeKosullari: "30 Gün Vadeli",
    paraBirimi: "TRY",
    kalemler: [],
    notlar: "",
    logoGorseli: "",
    imzaGorseli: "",
  });

  // Supplier Form State
  const [supModalOpen, setSupModalOpen] = useState(false);
  const [editingSupId, setEditingSupId] = useState<string | null>(null);
  const [supForm, setSupForm] = useState<Omit<SupplierDetail, "id" | "olusturmaTarihi">>({
    unvan: "",
    yetkili: "",
    telefon: "",
    eposta: "",
    adres: "",
    vergiDairesi: "",
    vergiNo: "",
    tedarikMalzemeleri: [],
    notlar: "",
  });

  // Purchase Order Document View Modal & Printing
  const [viewPo, setViewPo] = useState<PurchaseOrder | null>(null);
  const poPrintRef = useRef<HTMLDivElement | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; no: string; type: "order" | "supplier" } | null>(null);
  const [deliveryCalendarOpen, setDeliveryCalendarOpen] = useState(false);
  const [deliveryCalendarMonth, setDeliveryCalendarMonth] = useState(() => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });

  const deliveryCalendarDays = useMemo(() => {
    const year = deliveryCalendarMonth.getFullYear();
    const month = deliveryCalendarMonth.getMonth();
    const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: firstDayOffset + daysInMonth }, (_, index) => {
      if (index < firstDayOffset) return null;
      const day = index - firstDayOffset + 1;
      return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    });
  }, [deliveryCalendarMonth]);

  function openDeliveryCalendar() {
    const selectedDate = orderForm.teslimTarihi ? new Date(`${orderForm.teslimTarihi}T00:00:00`) : new Date();
    setDeliveryCalendarMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    setDeliveryCalendarOpen(true);
  }

  function selectDeliveryDate(date: string) {
    setOrderForm((previous) => ({ ...previous, teslimTarihi: date }));
    setDeliveryCalendarOpen(false);
  }

  async function updateViewPoImage(targetField: "logoGorseli" | "imzaGorseli", dataUrl: string) {
    if (!viewPo) return;
    const updatedPo = { ...viewPo, [targetField]: dataUrl };
    setViewPo(updatedPo);
    await updateOrder(viewPo.id, { [targetField]: dataUrl });
    if (targetField === "logoGorseli") {
      localStorage.setItem("gkys_po_default_logo", dataUrl);
    } else {
      localStorage.setItem("gkys_po_default_signature", dataUrl);
    }
    refreshData();
  }

  const [error, setError] = useState("");

  useEffect(() => {
    refreshData();
  }, []);

  function refreshData() {
    loadOrders().then(setOrders);
    loadSupplierDetails().then(setSuppliers);
    loadMaterials().then(setMaterials);
    loadAuxiliaryParts().then(setAuxParts);
    loadAuxiliarySuppliers().then(setAuxSuppliers);
  }

  // Auto-extracted lists for filter dropdowns
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    orders.forEach((o) => {
      if (o.siparisTarihi) {
        years.add(o.siparisTarihi.slice(0, 4));
      }
    });
    return Array.from(years).sort().reverse();
  }, [orders]);

  const availableSuppliersFilter = useMemo(() => {
    const sups = new Set<string>();
    suppliers.forEach((s) => sups.add(s.unvan));
    auxSuppliers.forEach((s) => sups.add(s));
    orders.forEach((o) => sups.add(o.tedarikciFirma));
    materials.forEach((m) => {
      if (m.firma) sups.add(m.firma);
    });
    auxParts.forEach((p) => {
      if (p.firma) sups.add(p.firma);
    });
    return Array.from(sups).sort();
  }, [suppliers, auxSuppliers, orders, materials, auxParts]);

  const availableMaterialsFilter = useMemo(() => {
    const mats = new Set<string>();
    materials.forEach((m) => mats.add(m.kod));
    auxParts.forEach((p) => mats.add(p.kod));
    orders.forEach((o) => (o.kalemler || []).forEach((k) => mats.add(k.malzemeKodu)));
    return Array.from(mats).sort();
  }, [materials, auxParts, orders]);

  // Sipariş Türüne (Hammadde / Yardımcı Parça) Özel Tedarikçi Listesi
  const availableOrderSuppliers = useMemo(() => {
    const set = new Set<string>();
    if (orderForm.siparisTuru === "HAMMADDE") {
      suppliers.forEach((s) => set.add(s.unvan));
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
  }, [orderForm.siparisTuru, suppliers, auxSuppliers, materials, auxParts]);

  // Sipariş Türüne (ve seçili tedarikçiye) Özel Malzeme / Parça Listesi
  const availableOrderCatalogItems = useMemo(() => {
    const isHammadde = orderForm.siparisTuru === "HAMMADDE";
    const supLower = orderForm.tedarikciFirma ? orderForm.tedarikciFirma.trim().toLowerCase() : "";

    if (isHammadde) {
      let items = materials.map((m) => ({
        kod: m.kod,
        cins: m.cins || "",
        firma: m.firma || "",
        tip: "HAMMADDE" as const,
        birim: "KG",
      }));
      if (supLower) {
        const matching = items.filter((i) => i.firma && i.firma.trim().toLowerCase() === supLower);
        if (matching.length > 0) items = matching;
      }
      return items;
    } else {
      let items = auxParts.map((p) => ({
        kod: p.kod,
        cins: p.cins || "",
        firma: p.firma || "",
        tip: "YARDIMCI_PARCA" as const,
        birim: p.birim || "ADET",
      }));
      if (supLower) {
        const matching = items.filter((i) => i.firma && i.firma.trim().toLowerCase() === supLower);
        if (matching.length > 0) items = matching;
      }
      return items;
    }
  }, [orderForm.siparisTuru, orderForm.tedarikciFirma, materials, auxParts]);

  function handleImageUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    targetField: "logoGorseli" | "imzaGorseli",
    saveCallback: (val: string) => void
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("Görsel boyutu maksimum 2MB olmalıdır.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        saveCallback(dataUrl);
        if (targetField === "logoGorseli") {
          localStorage.setItem("gkys_po_default_logo", dataUrl);
        } else if (targetField === "imzaGorseli") {
          localStorage.setItem("gkys_po_default_signature", dataUrl);
        }
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSiparisTuruChange(newType: "HAMMADDE" | "YARDIMCI_PARCA") {
    const set = new Set<string>();
    if (newType === "HAMMADDE") {
      suppliers.forEach((s) => set.add(s.unvan));
      materials.forEach((m) => {
        if (m.firma) set.add(m.firma);
      });
    } else {
      auxSuppliers.forEach((s) => set.add(s));
      auxParts.forEach((p) => {
        if (p.firma) set.add(p.firma);
      });
    }
    const newSuppliers = Array.from(set).sort();

    let newSupplier = orderForm.tedarikciFirma;
    if (!newSuppliers.includes(newSupplier)) {
      newSupplier = newSuppliers.length > 0 ? newSuppliers[0] : "";
    }

    let catalogList: { kod: string; cins: string; firma: string; birim: string }[] = [];
    if (newType === "HAMMADDE") {
      catalogList = materials.map((m) => ({ kod: m.kod, cins: m.cins || "", firma: m.firma || "", birim: "KG" }));
    } else {
      catalogList = auxParts.map((p) => ({ kod: p.kod, cins: p.cins || "", firma: p.firma || "", birim: p.birim || "ADET" }));
    }

    const supLower = newSupplier.trim().toLowerCase();
    const matchingForSup = catalogList.filter((item) => !supLower || !item.firma || item.firma.toLowerCase() === supLower);
    const firstItem = matchingForSup.length > 0 ? matchingForSup[0] : (catalogList.length > 0 ? catalogList[0] : null);

    const autoPo = await nextPoNumber(newSupplier);

    setOrderForm((prev) => ({
      ...prev,
      siparisTuru: newType,
      siparisNo: editingOrderId ? prev.siparisNo : autoPo,
      tedarikciFirma: newSupplier,
      kalemler: [
        {
          id: `ITEM-1`,
          malzemeKodu: firstItem ? firstItem.kod : "",
          malzemeCinsi: firstItem ? firstItem.cins : "",
          miktar: newType === "HAMMADDE" ? 1000 : 100,
          birim: firstItem ? firstItem.birim : (newType === "HAMMADDE" ? "KG" : "ADET"),
          birimFiyat: 0,
          toplamFiyat: 0,
          teslimAlinanMiktar: 0,
        },
      ],
    }));
  }

  async function openNewOrderForm() {
    refreshData();
    const initialType: "HAMMADDE" | "YARDIMCI_PARCA" = "HAMMADDE";
    const initialSupplier = suppliers.length > 0 ? suppliers[0].unvan : "";

    const initialSupLower = initialSupplier.toLowerCase();
    const filteredForSup = materials.filter(
      (m) => !initialSupplier || !m.firma || m.firma.toLowerCase() === initialSupLower
    );
    const firstMat = filteredForSup.length > 0 ? filteredForSup[0] : (materials.length > 0 ? materials[0] : null);

    let selectedSupplier = initialSupplier;
    if (firstMat && firstMat.firma) {
      selectedSupplier = firstMat.firma;
    }

    const autoPo = await nextPoNumber(selectedSupplier);

    const savedLogo = localStorage.getItem("gkys_po_default_logo") || "";
    const savedSignature = localStorage.getItem("gkys_po_default_signature") || "";

    setOrderForm({
      siparisNo: autoPo,
      siparisTuru: initialType,
      tedarikciFirma: selectedSupplier,
      siparisTarihi: todayIso(),
      teslimTarihi: addDaysIso(7),
      odemeKosullari: "30 Gün Vadeli",
      paraBirimi: "TRY",
      kalemler: [
        {
          id: `ITEM-1`,
          malzemeKodu: firstMat ? firstMat.kod : "",
          malzemeCinsi: firstMat ? firstMat.cins || "" : "",
          miktar: 1000,
          birim: "KG",
          birimFiyat: 0,
          toplamFiyat: 0,
          teslimAlinanMiktar: 0,
        },
      ],
      notlar: "Ürünler B.R. Levent Plastik Fabrika Depo adresine teslim edilecektir. Ambalajlar temiz ve etiketli olmalıdır.",
      logoGorseli: savedLogo,
      imzaGorseli: savedSignature,
    });
    setEditingOrderId(null);
    setError("");
    setOrderModalOpen(true);
  }

  function openEditOrderForm(po: PurchaseOrder) {
    refreshData();
    const savedLogo = localStorage.getItem("gkys_po_default_logo") || "";
    const savedSignature = localStorage.getItem("gkys_po_default_signature") || "";

    let determinedType: "HAMMADDE" | "YARDIMCI_PARCA" = po.siparisTuru || "HAMMADDE";
    if (!po.siparisTuru && po.kalemler && po.kalemler.length > 0) {
      const code = po.kalemler[0].malzemeKodu;
      const isAux = auxParts.some((p) => p.kod === code);
      if (isAux) determinedType = "YARDIMCI_PARCA";
    }

    setOrderForm({
      siparisNo: po.siparisNo,
      siparisTuru: determinedType,
      tedarikciFirma: po.tedarikciFirma,
      siparisTarihi: po.siparisTarihi,
      teslimTarihi: po.teslimTarihi,
      odemeKosullari: po.odemeKosullari,
      paraBirimi: po.paraBirimi,
      kalemler: po.kalemler.map((k) => ({ ...k })),
      notlar: po.notlar || "",
      logoGorseli: po.logoGorseli || savedLogo,
      imzaGorseli: po.imzaGorseli || savedSignature,
    });
    setEditingOrderId(po.id);
    setError("");
    setOrderModalOpen(true);
  }

  async function handleSupplierChange(newSupplier: string) {
    setOrderForm((prev) => {
      const newSupLower = newSupplier.trim().toLowerCase();
      const isHammadde = prev.siparisTuru === "HAMMADDE";

      const validItems = isHammadde
        ? materials.filter((m) => !m.firma || m.firma.trim().toLowerCase() === newSupLower)
        : auxParts.filter((p) => !p.firma || p.firma.trim().toLowerCase() === newSupLower);

      const updatedKalemler = prev.kalemler.map((item) => {
        const isValid = validItems.some((i) => i.kod === item.malzemeKodu);
        if (!isValid && validItems.length > 0) {
          const firstVal = validItems[0];
          return {
            ...item,
            malzemeKodu: firstVal.kod,
            malzemeCinsi: firstVal.cins || "",
          };
        }
        return item;
      });

      return {
        ...prev,
        tedarikciFirma: newSupplier,
        kalemler: updatedKalemler,
      };
    });

    if (!editingOrderId) {
      const autoPo = await nextPoNumber(newSupplier);
      setOrderForm((prev) => ({ ...prev, siparisNo: autoPo }));
    }
  }

  function handleAddOrderItem() {
    const firstMat = availableOrderCatalogItems[0];

    setOrderForm((prev) => ({
      ...prev,
      kalemler: [
        ...prev.kalemler,
        {
          id: `ITEM-${Date.now()}`,
          malzemeKodu: firstMat ? firstMat.kod : "",
          malzemeCinsi: firstMat ? firstMat.cins || "" : "",
          miktar: prev.siparisTuru === "HAMMADDE" ? 1000 : 100,
          birim: firstMat ? firstMat.birim : (prev.siparisTuru === "HAMMADDE" ? "KG" : "ADET"),
          birimFiyat: 0,
          toplamFiyat: 0,
          teslimAlinanMiktar: 0,
        },
      ],
    }));
  }

  function handleRemoveOrderItem(id: string) {
    setOrderForm((prev) => ({
      ...prev,
      kalemler: prev.kalemler.filter((k) => k.id !== id),
    }));
  }

  function handleOrderItemChange(id: string, field: keyof PurchaseOrderItem, val: any) {
    setOrderForm((prev) => {
      let updatedSupplier = prev.tedarikciFirma;

      const updated = prev.kalemler.map((item) => {
        if (item.id !== id) return item;

        const newItem = { ...item, [field]: val };

        if (field === "malzemeKodu") {
          const catItem = availableOrderCatalogItems.find((c) => c.kod === val);
          if (catItem) {
            newItem.malzemeCinsi = catItem.cins || "";
            if (catItem.birim) newItem.birim = catItem.birim;
            if (catItem.firma && (!prev.tedarikciFirma || prev.kalemler.length === 1)) {
              updatedSupplier = catItem.firma;
            }
          }
        }

        if (field === "miktar" || field === "birimFiyat") {
          const qty = field === "miktar" ? (val === "" ? 0 : parseFloat(val) || 0) : newItem.miktar;
          const price = field === "birimFiyat" ? (val === "" ? 0 : parseFloat(val) || 0) : newItem.birimFiyat;
          newItem.toplamFiyat = qty * price;
        }

        return newItem;
      });

      if (updatedSupplier !== prev.tedarikciFirma && !editingOrderId) {
        nextPoNumber(updatedSupplier).then((autoPo) => {
          setOrderForm((f) => ({ ...f, siparisNo: autoPo, tedarikciFirma: updatedSupplier }));
        });
      }

      return { ...prev, tedarikciFirma: updatedSupplier, kalemler: updated };
    });
  }

  const orderFormTotalCost = useMemo(() => {
    return orderForm.kalemler.reduce((acc, curr) => acc + (curr.toplamFiyat || 0), 0);
  }, [orderForm.kalemler]);

  async function handleSaveOrder() {
    setError("");
    if (!orderForm.siparisNo.trim() || !orderForm.tedarikciFirma.trim()) {
      setError("Sipariş No ve Tedarikçi Firma alanları zorunludur.");
      return;
    }
    if (orderForm.kalemler.length === 0) {
      setError("Siparişte en az 1 kalem bulunmalıdır.");
      return;
    }

    try {
      const payload: Omit<PurchaseOrder, "id" | "olusturmaTarihi"> = {
        siparisNo: orderForm.siparisNo,
        siparisTuru: orderForm.siparisTuru,
        tedarikciFirma: orderForm.tedarikciFirma,
        siparisTarihi: orderForm.siparisTarihi,
        teslimTarihi: orderForm.teslimTarihi,
        odemeKosullari: orderForm.odemeKosullari,
        paraBirimi: orderForm.paraBirimi,
        kalemler: orderForm.kalemler,
        toplamTutar: orderFormTotalCost,
        durum: editingOrderId
          ? orders.find((o) => o.id === editingOrderId)?.durum || "GONDERILDI"
          : "GONDERILDI",
        notlar: orderForm.notlar,
        logoGorseli: orderForm.logoGorseli,
        imzaGorseli: orderForm.imzaGorseli,
      };

      if (editingOrderId) {
        await updateOrder(editingOrderId, payload);
      } else {
        await addOrder(payload);
      }
      refreshData();
      setOrderModalOpen(false);
    } catch (err: any) {
      setError(err.message || "Sipariş kaydedilemedi.");
    }
  }

  async function handleStatusChange(id: string, newStatus: PurchaseOrderStatus) {
    await updateOrder(id, { durum: newStatus });
    refreshData();
  }

  function handleDeleteOrder(id: string, no: string) {
    const targetId = id || no;
    if (!targetId) return;
    setDeleteConfirm({ id: targetId, no: no || id, type: "order" });
  }

  function handleDeleteSupplier(id: string, unvan: string) {
    if (!id) return;
    setDeleteConfirm({ id, no: unvan, type: "supplier" });
  }

  async function executeDelete() {
    if (!deleteConfirm) return;
    const { id, no, type } = deleteConfirm;
    setDeleteConfirm(null);
    try {
      if (type === "order") {
        await deleteOrder(id);
        if (viewPo && (viewPo.id === id || viewPo.siparisNo === no)) {
          setViewPo(null);
        }
      } else if (type === "supplier") {
        await deleteSupplierDetail(id);
      }
      refreshData();
    } catch (err: any) {
      alert("Silme işlemi sırasında hata oluştu: " + (err?.message || "Bilinmeyen hata"));
    }
  }

  // Supplier Management Handlers
  function openNewSupplierForm() {
    setSupForm({
      unvan: "",
      yetkili: "",
      telefon: "",
      eposta: "",
      adres: "",
      vergiDairesi: "",
      vergiNo: "",
      tedarikMalzemeleri: [],
      notlar: "",
    });
    setEditingSupId(null);
    setError("");
    setSupModalOpen(true);
  }

  function openEditSupplierForm(s: SupplierDetail) {
    setSupForm({
      unvan: s.unvan,
      yetkili: s.yetkili || "",
      telefon: s.telefon || "",
      eposta: s.eposta || "",
      adres: s.adres || "",
      vergiDairesi: s.vergiDairesi || "",
      vergiNo: s.vergiNo || "",
      tedarikMalzemeleri: s.tedarikMalzemeleri || [],
      notlar: s.notlar || "",
    });
    setEditingSupId(s.id);
    setError("");
    setSupModalOpen(true);
  }

  async function handleSaveSupplier() {
    setError("");
    if (!supForm.unvan.trim()) {
      setError("Firma ünvanı zorunludur.");
      return;
    }
    try {
      await saveSupplierDetail({ ...supForm, id: editingSupId || undefined });
      refreshData();
      setSupModalOpen(false);
    } catch (err: any) {
      setError(err.message || "Tedarikçi kaydedilemedi.");
    }
  }

  // Export PDF function
  async function handleExportPdf() {
    if (!poPrintRef.current || !viewPo) return;
    setPdfGenerating(true);
    try {
      const canvas = await html2canvas(poPrintRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${viewPo.siparisNo.replace(/[/\\?%*:|"<>]/g, "_")}_SiparisMektubu.pdf`);
    } catch (err) {
      console.error("PDF oluşturma hatası:", err);
      alert("PDF oluşturulurken bir hata oluştu.");
    } finally {
      setPdfGenerating(false);
    }
  }

  const isFilterActive =
    search.trim() !== "" ||
    statusFilter !== "ALL" ||
    yearFilter !== "ALL" ||
    monthFilter !== "ALL" ||
    supplierFilter !== "ALL" ||
    materialFilter !== "ALL";

  function clearAllFilters() {
    setSearch("");
    setStatusFilter("ALL");
    setYearFilter("ALL");
    setMonthFilter("ALL");
    setSupplierFilter("ALL");
    setMaterialFilter("ALL");
  }

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== "ALL" && o.durum !== statusFilter) return false;

      if (yearFilter !== "ALL") {
        const poYear = o.siparisTarihi ? o.siparisTarihi.slice(0, 4) : "";
        if (poYear !== yearFilter) return false;
      }

      if (monthFilter !== "ALL") {
        const poMonth = o.siparisTarihi ? o.siparisTarihi.slice(5, 7) : "";
        if (poMonth !== monthFilter) return false;
      }

      if (supplierFilter !== "ALL") {
        if (o.tedarikciFirma !== supplierFilter) return false;
      }

      if (materialFilter !== "ALL") {
        const hasMat = (o.kalemler || []).some((k) => k.malzemeKodu === materialFilter);
        if (!hasMat) return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchNo = o.siparisNo.toLowerCase().includes(q);
        const matchSup = o.tedarikciFirma.toLowerCase().includes(q);
        const matchMat = (o.kalemler || []).some(
          (k) => k.malzemeKodu.toLowerCase().includes(q) || (k.malzemeCinsi || "").toLowerCase().includes(q)
        );
        if (!matchNo && !matchSup && !matchMat) return false;
      }

      return true;
    });
  }, [orders, search, statusFilter, yearFilter, monthFilter, supplierFilter, materialFilter]);

  const filteredSuppliers = useMemo(() => {
    if (!search.trim()) return suppliers;
    const q = search.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.unvan.toLowerCase().includes(q) ||
        (s.yetkili || "").toLowerCase().includes(q) ||
        (s.telefon || "").includes(q)
    );
  }, [suppliers, search]);

  const activePoCount = orders.filter((o) => o.durum === "GONDERILDI" || o.durum === "KISMI_GELDI").length;

  const viewPoHasPricing = useMemo(() => {
    if (!viewPo) return false;
    return (viewPo.kalemler || []).some((k) => (k.birimFiyat || 0) > 0);
  }, [viewPo]);

  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h2>Satın Alma & Tedarikçi Yönetimi</h2>
          <p className="muted" style={{ margin: 0 }}>
            Hammadde satın alma sipariş mektupları (Purchase Orders) oluşturun, tedarikçi iletişim bilgilerini yönetin ve mal kabul hareketlerini takip edin.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            className={`btn-secondary ${subTab === "siparisler" ? "btn-primary" : ""}`}
            onClick={() => setSubTab("siparisler")}
          >
            📋 Sipariş Mektupları ({orders.length})
            {activePoCount > 0 && <span className="badge">{activePoCount}</span>}
          </button>
          <button
            className={`btn-secondary ${subTab === "tedarikciler" ? "btn-primary" : ""}`}
            onClick={() => setSubTab("tedarikciler")}
          >
            🏢 Tedarikçi Rehberi ({suppliers.length})
          </button>
        </div>
      </div>

      <hr style={{ borderColor: "rgba(255,255,255,0.08)", margin: "16px 0" }} />

      {/* ================= SECTION 1: SATIN ALMA SİPARİŞLERİ ================= */}
      {subTab === "siparisler" && (
        <>
          {/* SEARCH & FILTERS ROW */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div className="toolbar-row" style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
              <input
                className="scan-input"
                placeholder="Sipariş No, Firma veya Malzeme kodu ile ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ flex: 1, minWidth: "240px" }}
              />

              <button className="btn-primary" onClick={openNewOrderForm}>
                + Yeni Sipariş Mektubu Oluştur
              </button>
            </div>

            {/* DETAILED FILTERS (Ay, Yıl, Firma, Malzeme, Durum) */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", background: "rgba(255,255,255,0.02)", padding: "10px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#9ca3af", marginRight: "4px" }}>🔍 Filtreler:</span>

              {/* Yıl Filtresi */}
              <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} style={{ width: "auto", fontSize: "0.85rem", padding: "4px 8px" }}>
                <option value="ALL">Tüm Yıllar</option>
                {availableYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              {/* Ay Filtresi */}
              <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} style={{ width: "auto", fontSize: "0.85rem", padding: "4px 8px" }}>
                <option value="ALL">Tüm Aylar</option>
                {MONTH_NAMES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>

              {/* Firma Filtresi */}
              <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} style={{ width: "auto", fontSize: "0.85rem", padding: "4px 8px", maxWidth: "200px" }}>
                <option value="ALL">Tüm Tedarikçiler</option>
                {availableSuppliersFilter.map((sup) => (
                  <option key={sup} value={sup}>{sup}</option>
                ))}
              </select>

              {/* Malzeme Filtresi */}
              <select value={materialFilter} onChange={(e) => setMaterialFilter(e.target.value)} style={{ width: "auto", fontSize: "0.85rem", padding: "4px 8px", maxWidth: "200px" }}>
                <option value="ALL">Tüm Malzemeler</option>
                {availableMaterialsFilter.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>

              {/* Durum Filtresi */}
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: "auto", fontSize: "0.85rem", padding: "4px 8px" }}>
                <option value="ALL">Tüm Durumlar</option>
                <option value="TASLAK">Taslaklar</option>
                <option value="GONDERILDI">Sipariş Gönderildi (Bekleyen)</option>
                <option value="KISMI_GELDI">Kısmi Teslim Edilenler</option>
                <option value="TAMAMLANDI">Tamamlananlar</option>
                <option value="IPTAL">İptal Edilenler</option>
              </select>

              {isFilterActive && (
                <button className="btn-secondary btn-small" onClick={clearAllFilters} style={{ marginLeft: "auto", fontSize: "0.8rem", color: "#f87171" }}>
                  ✕ Filtreleri Temizle
                </button>
              )}
            </div>
          </div>

          {/* ORDERS TABLE */}
          <div className="table-scroll" style={{ marginTop: 16 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Sipariş No</th>
                  <th>Tedarikçi Firma</th>
                  <th>Sipariş Tarihi</th>
                  <th>Teslim Tarihi</th>
                  <th>Sipariş Kalemleri</th>
                  <th>Toplam Tutar</th>
                  <th>Durum</th>
                  <th>Aksiyonlar</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={8} className="muted" style={{ textAlign: "center", padding: "24px" }}>
                      Aramanıza veya filtrenize uygun satın alma siparişi bulunamadı.
                    </td>
                  </tr>
                )}
                {filteredOrders.map((po) => {
                  const statusInfo = STATUS_LABELS[po.durum] || { label: po.durum, class: "tag-info" };
                  const hasPrice = (po.kalemler || []).some((k) => (k.birimFiyat || 0) > 0);

                  return (
                    <tr key={po.id}>
                      <td>
                        <strong>{po.siparisNo}</strong>
                      </td>
                      <td>{po.tedarikciFirma}</td>
                      <td>{formatDateTR(po.siparisTarihi)}</td>
                      <td className="muted">{formatDateTR(po.teslimTarihi)}</td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "0.85rem" }}>
                          {(po.kalemler || []).map((item, i) => (
                            <span key={i}>
                              • <strong>{item.malzemeKodu}</strong> ({item.miktar} {item.birim})
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        {hasPrice ? (
                          <strong>
                            {po.toplamTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {po.paraBirimi}
                          </strong>
                        ) : (
                          <span className="muted" style={{ fontStyle: "italic" }}>— (Fiyatsız)</span>
                        )}
                      </td>
                      <td>
                        <select
                          className={`badge ${statusInfo.class}`}
                          value={po.durum}
                          onChange={(e) => handleStatusChange(po.id, e.target.value as PurchaseOrderStatus)}
                          style={{
                            background: "rgba(0,0,0,0.3)",
                            border: "1px solid rgba(255,255,255,0.15)",
                            color: "#fff",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontSize: "0.8rem",
                            cursor: "pointer",
                          }}
                        >
                          <option value="TASLAK">Taslak</option>
                          <option value="GONDERILDI">Sipariş Gönderildi</option>
                          <option value="KISMI_GELDI">Kısmi Teslim</option>
                          <option value="TAMAMLANDI">Tamamlandı</option>
                          <option value="IPTAL">İptal Edildi</option>
                        </select>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          <button
                            className="btn-secondary btn-small"
                            onClick={() => setViewPo(po)}
                            title="Sipariş Mektubunu Görüntüle, Yazdır veya PDF İndir"
                          >
                            📄 Mektup / PO
                          </button>

                          {onStartReception && (po.durum === "GONDERILDI" || po.durum === "KISMI_GELDI") && (
                            <button
                              className="btn-primary btn-small"
                              onClick={() => {
                                const item = (po.kalemler && po.kalemler[0]) || undefined;
                                onStartReception({
                                  siparisNo: po.siparisNo,
                                  firma: po.tedarikciFirma,
                                  malzemeKodu: item ? item.malzemeKodu : "",
                                  miktar: item ? item.miktar : undefined,
                                });
                              }}
                              title="Bu siparişi Giriş Kalite / Mal Kabul ekranına aktar"
                            >
                              📥 Mal Kabul Et
                            </button>
                          )}

                          <button
                            className="btn-secondary btn-small"
                            onClick={() => openEditOrderForm(po)}
                          >
                            Düzenle
                          </button>

                          <button
                            className="btn-danger btn-small"
                            onClick={() => handleDeleteOrder(po.id || po.siparisNo, po.siparisNo)}
                          >
                            Sil
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ================= SECTION 2: TEDARİKÇİ YÖNETİMİ ================= */}
      {subTab === "tedarikciler" && (
        <>
          <div className="toolbar-row" style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
            <input
              className="scan-input"
              placeholder="Firma adı, yetkili veya telefon ile ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1, minWidth: "280px" }}
            />
            <button className="btn-primary" onClick={openNewSupplierForm}>
              + Yeni Tedarikçi Firma Ekle
            </button>
          </div>

          <div className="table-scroll" style={{ marginTop: 16 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Firma Ünvanı</th>
                  <th>İletişim Kişisi</th>
                  <th>Telefon</th>
                  <th>E-posta</th>
                  <th>Vergi Dairesi / No</th>
                  <th>Adres</th>
                  <th>Aksiyonlar</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted" style={{ textAlign: "center", padding: "24px" }}>
                      Kayıtlı tedarikçi firma bulunmuyor.
                    </td>
                  </tr>
                )}
                {filteredSuppliers.map((sup) => (
                  <tr key={sup.id}>
                    <td>
                      <strong>{sup.unvan}</strong>
                    </td>
                    <td>{sup.yetkili || "—"}</td>
                    <td>{sup.telefon ? <a href={`tel:${sup.telefon}`} style={{ color: "#60a5fa" }}>{sup.telefon}</a> : "—"}</td>
                    <td>{sup.eposta ? <a href={`mailto:${sup.eposta}`} style={{ color: "#60a5fa" }}>{sup.eposta}</a> : "—"}</td>
                    <td className="muted">
                      {sup.vergiDairesi || sup.vergiNo ? `${sup.vergiDairesi || ""} / ${sup.vergiNo || ""}` : "—"}
                    </td>
                    <td className="muted" style={{ maxWidth: "200px" }}>{sup.adres || "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button className="btn-secondary btn-small" onClick={() => openEditSupplierForm(sup)}>
                          Düzenle
                        </button>
                        <button className="btn-danger btn-small" onClick={() => handleDeleteSupplier(sup.id, sup.unvan)}>
                          Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ================= ORDER EDIT/CREATE MODAL ================= */}
      {orderModalOpen && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "16px" }}>
          <div className="card" style={{ width: "100%", maxWidth: "820px", maxHeight: "90vh", overflowY: "auto", background: "#18202c", border: "1px solid rgba(255,255,255,0.15)", padding: "20px" }}>
            <h3 style={{ marginTop: 0 }}>{editingOrderId ? `Siparişi Düzenle — ${orderForm.siparisNo}` : "Yeni Satın Alma Siparişi Mektubu"}</h3>

            <div className="grid2" style={{ gap: "12px" }}>
              <label style={{ gridColumn: "span 2" }}>
                Sipariş Kategorisi / Türü *
                <div style={{ display: "flex", gap: "20px", marginTop: "6px" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer", fontWeight: "bold" }}>
                    <input
                      type="radio"
                      name="poSiparisTuru"
                      value="HAMMADDE"
                      checked={orderForm.siparisTuru === "HAMMADDE"}
                      onChange={() => handleSiparisTuruChange("HAMMADDE")}
                    />
                    🧪 Hammadde Siparişi
                  </label>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer", fontWeight: "bold" }}>
                    <input
                      type="radio"
                      name="poSiparisTuru"
                      value="YARDIMCI_PARCA"
                      checked={orderForm.siparisTuru === "YARDIMCI_PARCA"}
                      onChange={() => handleSiparisTuruChange("YARDIMCI_PARCA")}
                    />
                    🔧 Yardımcı Parça Siparişi
                  </label>
                </div>
              </label>

              <label>
                Sipariş Mektubu No *
                <input
                  value={orderForm.siparisNo}
                  onChange={(e) => setOrderForm({ ...orderForm, siparisNo: e.target.value })}
                  placeholder="örn. 26/H-012 veya 26/K-012"
                />
                <span className="muted" style={{ fontSize: "0.75rem", display: "block", marginTop: "2px" }}>
                  * Kirpart siparişleri '26/K-...' diğerleri '26/H-...' formatında otomatik oluşturulur.
                </span>
              </label>

              <label>
                Tedarikçi Firma *
                <select
                  value={availableOrderSuppliers.includes(orderForm.tedarikciFirma) ? orderForm.tedarikciFirma : (orderForm.tedarikciFirma ? "__custom__" : "")}
                  onChange={(e) => {
                    if (e.target.value !== "__custom__" && e.target.value !== "") {
                      handleSupplierChange(e.target.value);
                    }
                  }}
                  style={{ marginBottom: "6px", display: "block", width: "100%" }}
                >
                  <option value="">
                    {orderForm.siparisTuru === "HAMMADDE" ? "-- Hammadde Tedarikçisi Seçin --" : "-- Yardımcı Parça Tedarikçisi Seçin --"}
                  </option>
                  {availableOrderSuppliers.map((s) => (
                    <option key={s} value={s}>
                      🏢 {s}
                    </option>
                  ))}
                  {orderForm.tedarikciFirma && !availableOrderSuppliers.includes(orderForm.tedarikciFirma) && (
                    <option value="__custom__">✏️ Özel: {orderForm.tedarikciFirma}</option>
                  )}
                </select>

                <input
                  list="po-supplier-list"
                  value={orderForm.tedarikciFirma}
                  onChange={(e) => handleSupplierChange(e.target.value)}
                  placeholder="Veya firma adını buraya yazın..."
                />
                <datalist id="po-supplier-list">
                  {availableOrderSuppliers.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </label>

              <label>
                Sipariş Tarihi
                <input
                  type="text"
                  placeholder="GG/AA/YYYY"
                  value={formatDateTR(orderForm.siparisTarihi)}
                  onChange={(e) => setOrderForm({ ...orderForm, siparisTarihi: toIsoDate(e.target.value) })}
                />
              </label>

              <label>
                Tahmini Teslim Tarihi
                <div className="delivery-date-picker">
                  <button
                    type="button"
                    className="delivery-date-trigger"
                    onClick={openDeliveryCalendar}
                    aria-haspopup="dialog"
                    aria-expanded={deliveryCalendarOpen}
                  >
                    <span>{formatDateTR(orderForm.teslimTarihi)}</span>
                    <Calendar size={17} aria-hidden="true" />
                  </button>

                  {deliveryCalendarOpen && (
                    <div className="delivery-calendar" role="dialog" aria-label="Tahmini teslim tarihi seçimi">
                      <div className="delivery-calendar-header">
                        <button
                          type="button"
                          className="calendar-nav-button"
                          onClick={() => setDeliveryCalendarMonth(new Date(deliveryCalendarMonth.getFullYear(), deliveryCalendarMonth.getMonth() - 1, 1))}
                          aria-label="Önceki ay"
                        >
                          <ChevronLeft size={17} aria-hidden="true" />
                        </button>
                        <strong>
                          {deliveryCalendarMonth.toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}
                        </strong>
                        <button
                          type="button"
                          className="calendar-nav-button"
                          onClick={() => setDeliveryCalendarMonth(new Date(deliveryCalendarMonth.getFullYear(), deliveryCalendarMonth.getMonth() + 1, 1))}
                          aria-label="Sonraki ay"
                        >
                          <ChevronRight size={17} aria-hidden="true" />
                        </button>
                      </div>
                      <div className="delivery-calendar-weekdays" aria-hidden="true">
                        {['P', 'S', 'Ç', 'P', 'C', 'C', 'P'].map((day, index) => (
                          <span key={`${day}-${index}`}>{day}</span>
                        ))}
                      </div>
                      <div className="delivery-calendar-days">
                        {deliveryCalendarDays.map((date, index) => (
                          date ? (
                            <button
                              key={date}
                              type="button"
                              className={`calendar-day${date === orderForm.teslimTarihi ? " selected" : ""}${date === todayIso() ? " today" : ""}`}
                              onClick={() => selectDeliveryDate(date)}
                            >
                              {Number(date.slice(-2))}
                            </button>
                          ) : <span key={`empty-${index}`} aria-hidden="true" />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </label>
            </div>

            <h4 style={{ marginTop: 20, marginBottom: 8 }}>Sipariş Kalemleri (Hammadde Detayları)</h4>

            {orderForm.kalemler.map((item, index) => (
              <div
                key={item.id}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "8px",
                  padding: "12px",
                  marginBottom: "10px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <strong style={{ fontSize: "0.9rem" }}>Kalem #{index + 1}</strong>
                  {orderForm.kalemler.length > 1 && (
                    <button
                      type="button"
                      className="btn-danger btn-small"
                      onClick={() => handleRemoveOrderItem(item.id)}
                    >
                      Kaldır
                    </button>
                  )}
                </div>

                <div className="grid2" style={{ gap: "10px" }}>
                  <label>
                    {orderForm.siparisTuru === "HAMMADDE" ? "Hammadde Kodu *" : "Yardımcı Parça Kodu *"}
                    <select
                      value={
                        availableOrderCatalogItems.some((m) => m.kod === item.malzemeKodu)
                          ? item.malzemeKodu
                          : item.malzemeKodu
                          ? "__custom__"
                          : ""
                      }
                      onChange={(e) => {
                        if (e.target.value !== "__custom__" && e.target.value !== "") {
                          handleOrderItemChange(item.id, "malzemeKodu", e.target.value);
                        }
                      }}
                      style={{ marginBottom: "6px", display: "block", width: "100%" }}
                    >
                      <option value="">
                        {orderForm.siparisTuru === "HAMMADDE" ? "-- Hammadde Tanım Seçin --" : "-- Yardımcı Parça Tanım Seçin --"}
                      </option>
                      {availableOrderCatalogItems.map((m) => (
                        <option key={m.kod} value={m.kod}>
                          📦 {m.kod} — {m.cins} {m.firma ? `(${m.firma})` : ""}
                        </option>
                      ))}
                      {item.malzemeKodu &&
                        !availableOrderCatalogItems.some((m) => m.kod === item.malzemeKodu) && (
                          <option value="__custom__">✏️ Özel Kodu: {item.malzemeKodu}</option>
                        )}
                    </select>

                    <input
                      list={`mat-list-${item.id}`}
                      value={item.malzemeKodu}
                      onChange={(e) => handleOrderItemChange(item.id, "malzemeKodu", e.target.value)}
                      placeholder="Veya kodu elle yazın..."
                    />
                    <datalist id={`mat-list-${item.id}`}>
                      {availableOrderCatalogItems.map((m) => (
                        <option key={m.kod} value={m.kod}>
                          {m.cins} {m.firma ? `(${m.firma})` : ""}
                        </option>
                      ))}
                    </datalist>
                  </label>

                  <label>
                    Cins / Tanım
                    <input
                      value={item.malzemeCinsi || ""}
                      onChange={(e) => handleOrderItemChange(item.id, "malzemeCinsi", e.target.value)}
                    />
                  </label>

                  <label>
                    Miktar
                    <div style={{ display: "flex", gap: "4px" }}>
                      <input
                        type="number"
                        value={item.miktar || ""}
                        onChange={(e) => handleOrderItemChange(item.id, "miktar", e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <select
                        value={item.birim}
                        onChange={(e) => handleOrderItemChange(item.id, "birim", e.target.value)}
                        style={{ width: "95px" }}
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

                </div>
              </div>
            ))}

            <button type="button" className="btn-secondary btn-small" onClick={handleAddOrderItem} style={{ marginBottom: 16 }}>
              + Başka Kalem Ekle
            </button>

            {/* MEKTUP GÖRSEL AYARLARI (YETKİLİ İMZA) */}
            <div style={{ marginTop: "16px", padding: "12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px" }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: "0.95rem", color: "#60a5fa" }}>✍️ Mektup Görselleri (Yetkili İmza / Kaşe)</h4>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "0.85rem", fontWeight: "600" }}>Yetkili İmza / Kaşe (JPEG / PNG)</label>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                  {orderForm.imzaGorseli ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <img src={orderForm.imzaGorseli} alt="İmza" style={{ maxHeight: "40px", maxWidth: "120px", objectFit: "contain", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "4px", background: "#fff", padding: "2px" }} />
                      <button
                        type="button"
                        className="btn-danger btn-small"
                        onClick={() => setOrderForm((prev) => ({ ...prev, imzaGorseli: "" }))}
                      >
                        Sil
                      </button>
                    </div>
                  ) : (
                    <span className="muted" style={{ fontSize: "0.8rem" }}>İmza eklenmedi</span>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    style={{ fontSize: "0.8rem", width: "auto" }}
                    onChange={(e) =>
                      handleImageUpload(e, "imzaGorseli", (val) =>
                        setOrderForm((prev) => ({ ...prev, imzaGorseli: val }))
                      )
                    }
                  />
                </div>
              </div>
            </div>

            <label style={{ marginTop: 16, display: "block" }}>
              Sipariş Notları & Teslim Koşulları
              <textarea
                value={orderForm.notlar}
                onChange={(e) => setOrderForm({ ...orderForm, notlar: e.target.value })}
                rows={3}
                style={{ width: "100%", background: "#10151c", color: "#fff", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px", padding: "8px", marginTop: "4px" }}
              />
            </label>

            {error && <p className="error" style={{ marginTop: 12 }}>{error}</p>}

            <div className="actions-row" style={{ marginTop: 20 }}>
              <button className="btn-primary" onClick={handleSaveOrder}>
                {editingOrderId ? "Siparişi Güncelle" : "Sipariş Mektubunu Kaydet & Gönder"}
              </button>
              <button className="btn-secondary" onClick={() => setOrderModalOpen(false)}>
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= SUPPLIER EDIT/CREATE MODAL ================= */}
      {supModalOpen && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "16px" }}>
          <div className="card" style={{ width: "100%", maxWidth: "600px", background: "#18202c", border: "1px solid rgba(255,255,255,0.15)", padding: "20px" }}>
            <h3 style={{ marginTop: 0 }}>{editingSupId ? "Tedarikçi Firmayı Düzenle" : "Yeni Tedarikçi Firma Ekle"}</h3>

            <div className="grid2" style={{ gap: "10px" }}>
              <label>
                Firma Ünvanı *
                <input
                  value={supForm.unvan}
                  onChange={(e) => setSupForm({ ...supForm, unvan: e.target.value })}
                  placeholder="örn. DuPont Türkiye A.Ş."
                />
              </label>

              <label>
                Yetkili Kişi
                <input
                  value={supForm.yetkili}
                  onChange={(e) => setSupForm({ ...supForm, yetkili: e.target.value })}
                  placeholder="örn. Ahmet Yılmaz"
                />
              </label>

              <label>
                Telefon
                <input
                  value={supForm.telefon}
                  onChange={(e) => setSupForm({ ...supForm, telefon: e.target.value })}
                  placeholder="örn. 0212 555 0011"
                />
              </label>

              <label>
                E-posta Adresi
                <input
                  type="email"
                  value={supForm.eposta}
                  onChange={(e) => setSupForm({ ...supForm, eposta: e.target.value })}
                  placeholder="siparis@firma.com"
                />
              </label>

              <label>
                Vergi Dairesi
                <input
                  value={supForm.vergiDairesi}
                  onChange={(e) => setSupForm({ ...supForm, vergiDairesi: e.target.value })}
                />
              </label>

              <label>
                Vergi Numarası
                <input
                  value={supForm.vergiNo}
                  onChange={(e) => setSupForm({ ...supForm, vergiNo: e.target.value })}
                />
              </label>
            </div>

            <label style={{ marginTop: 10, display: "block" }}>
              Firma Adresi
              <textarea
                value={supForm.adres}
                onChange={(e) => setSupForm({ ...supForm, adres: e.target.value })}
                rows={2}
                style={{ width: "100%", background: "#10151c", color: "#fff", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "6px", padding: "8px", marginTop: "4px" }}
              />
            </label>

            {error && <p className="error" style={{ marginTop: 12 }}>{error}</p>}

            <div className="actions-row" style={{ marginTop: 20 }}>
              <button className="btn-primary" onClick={handleSaveSupplier}>
                Kaydet
              </button>
              <button className="btn-secondary" onClick={() => setSupModalOpen(false)}>
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= PURCHASE ORDER FORM / MEKTUP DISPLAY & PRINT MODAL ================= */}
      {viewPo && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1100, padding: "16px" }}>
          <div style={{ width: "100%", maxWidth: "800px", maxHeight: "95vh", overflowY: "auto", background: "#fff", color: "#000", borderRadius: "8px", padding: "30px", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>

            {/* Action Bar (Screen Only) */}
            <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, borderBottom: "1px solid #ccc", paddingBottom: 12, flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <button className="btn-primary" onClick={() => window.print()}>
                  🖨️ Yazdır
                </button>
                <button
                  className="btn-secondary"
                  disabled={pdfGenerating}
                  onClick={handleExportPdf}
                  style={{ background: "#2563eb", color: "#fff" }}
                >
                  {pdfGenerating ? "⏳ PDF Hazırlanıyor..." : "📄 PDF Dışarı Aktar"}
                </button>

                <label className="btn-secondary" style={{ background: "#374151", color: "#fff", cursor: "pointer", fontSize: "0.85rem", padding: "6px 12px", borderRadius: "6px" }}>
                  ✍️ İmza / Kaşe Yükle
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) =>
                      handleImageUpload(e, "imzaGorseli", (val) => updateViewPoImage("imzaGorseli", val))
                    }
                  />
                </label>
                <button
                  className="btn-danger"
                  onClick={() => handleDeleteOrder(viewPo.id || viewPo.siparisNo, viewPo.siparisNo)}
                  style={{ background: "#ef4444", color: "#fff", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
                >
                  🗑️ Siparişi Sil
                </button>
              </div>

              <button className="btn-secondary" onClick={() => setViewPo(null)} style={{ background: "#e5e7eb", color: "#111" }}>
                Kapat ✕
              </button>
            </div>

            {/* PRINTABLE PURCHASE ORDER LETTER BODY */}
            <div className="po-printable-sheet" ref={poPrintRef} style={{ background: "#fff", padding: "10px" }}>
              {/* HEADER */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #000", paddingBottom: "12px", marginBottom: "20px" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: "18px", color: "#000", fontWeight: "bold" }}>
                    B.R. LEVENT PLASTİK
                  </h2>
                  <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#444" }}>
                    Kayapa San. Beyaz Cad. No: 8, Nilüfer / BURSA
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#444" }}>
                    Tel: +90 552 311 25 76 · E-posta: satinalma@brleventplastik.net
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <h3 style={{ margin: 0, fontSize: "16px", color: "#1d4ed8", fontWeight: "bold" }}>
                    SATIN ALMA SİPARİŞİ
                  </h3>
                  <p style={{ margin: "4px 0 0", fontSize: "14px", fontWeight: "bold" }}>
                    NO: {viewPo.siparisNo}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: "12px" }}>
                    Tarih: {formatDateTR(viewPo.siparisTarihi)}
                  </p>
                </div>
              </div>

              {/* SUPPLIER & DELIVERY DETAILS GRID */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                <div style={{ border: "1px solid #ccc", padding: "12px", borderRadius: "4px" }}>
                  <h4 style={{ margin: "0 0 6px", fontSize: "12px", color: "#666", textTransform: "uppercase" }}>TEDARİKÇİ FİRMA</h4>
                  <div style={{ fontWeight: "bold", fontSize: "14px", marginBottom: "4px" }}>{viewPo.tedarikciFirma}</div>
                  <div style={{ fontSize: "12px", color: "#333" }}>Ödeme Koşulu: {viewPo.odemeKosullari}</div>
                </div>

                <div style={{ border: "1px solid #ccc", padding: "12px", borderRadius: "4px" }}>
                  <h4 style={{ margin: "0 0 6px", fontSize: "12px", color: "#666", textTransform: "uppercase" }}>TESLİMAT BİLGİLERİ</h4>
                  <div style={{ fontSize: "12px", color: "#333" }}><strong>Teslim Adresi:</strong> B.R. Levent Plastik Fabrika Deposu</div>
                  <div style={{ fontSize: "12px", color: "#333", marginTop: "2px" }}><strong>Tahmini Teslimat:</strong> {formatDateTR(viewPo.teslimTarihi)}</div>
                </div>
              </div>

              {/* ITEMS TABLE */}
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#f3f4f6", borderBottom: "2px solid #374151" }}>
                    <th style={{ padding: "8px", textAlign: "left", border: "1px solid #d1d5db" }}>#</th>
                    <th style={{ padding: "8px", textAlign: "left", border: "1px solid #d1d5db" }}>Malzeme Kodu</th>
                    <th style={{ padding: "8px", textAlign: "left", border: "1px solid #d1d5db" }}>Cins / Tanım</th>
                    <th style={{ padding: "8px", textAlign: "right", border: "1px solid #d1d5db" }}>Miktar</th>
                    {viewPoHasPricing && <th style={{ padding: "8px", textAlign: "right", border: "1px solid #d1d5db" }}>Birim Fiyat</th>}
                    {viewPoHasPricing && <th style={{ padding: "8px", textAlign: "right", border: "1px solid #d1d5db" }}>Toplam Tutar</th>}
                  </tr>
                </thead>
                <tbody>
                  {viewPo.kalemler.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #e5e7eb" }}>
                      <td style={{ padding: "8px", border: "1px solid #d1d5db" }}>{idx + 1}</td>
                      <td style={{ padding: "8px", fontWeight: "bold", border: "1px solid #d1d5db" }}>{item.malzemeKodu}</td>
                      <td style={{ padding: "8px", border: "1px solid #d1d5db" }}>{item.malzemeCinsi || "—"}</td>
                      <td style={{ padding: "8px", textAlign: "right", border: "1px solid #d1d5db" }}>
                        {item.miktar} {item.birim}
                      </td>
                      {viewPoHasPricing && (
                        <td style={{ padding: "8px", textAlign: "right", border: "1px solid #d1d5db" }}>
                          {(item.birimFiyat || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {viewPo.paraBirimi}
                        </td>
                      )}
                      {viewPoHasPricing && (
                        <td style={{ padding: "8px", textAlign: "right", fontWeight: "bold", border: "1px solid #d1d5db" }}>
                          {(item.toplamFiyat || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {viewPo.paraBirimi}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* TOTAL COST SUMMARY (ONLY IF PRICING IS PRESENT) */}
              {viewPoHasPricing && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "20px" }}>
                  <div style={{ width: "260px", border: "2px solid #000", padding: "10px", background: "#f9fafb" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", fontWeight: "bold" }}>
                      <span>GENEL TOPLAM:</span>
                      <span>{viewPo.toplamTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {viewPo.paraBirimi}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* NOTES & TERMS */}
              {viewPo.notlar && (
                <div style={{ border: "1px solid #e5e7eb", padding: "10px", borderRadius: "4px", marginBottom: "30px", fontSize: "12px", background: "#fafafa" }}>
                  <strong>Şartlar & Notlar:</strong>
                  <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap", color: "#333" }}>{viewPo.notlar}</p>
                </div>
              )}

              {/* SIGNATURE AREA */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px", marginTop: "40px", fontSize: "12px", textAlign: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ fontWeight: "bold", marginBottom: "8px" }}>SİPARİŞİ VEREN (B.R. LEVENT PLASTİK)</div>
                  <div style={{ minHeight: "70px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "4px" }}>
                    {(viewPo.imzaGorseli || localStorage.getItem("gkys_po_default_signature")) ? (
                      <img
                        src={viewPo.imzaGorseli || localStorage.getItem("gkys_po_default_signature")!}
                        alt="İmza"
                        style={{ maxHeight: "65px", maxWidth: "200px", objectFit: "contain" }}
                      />
                    ) : (
                      <span style={{ color: "#888", fontStyle: "italic", fontSize: "11px" }}>[Yetkili İmza / Kaşe]</span>
                    )}
                  </div>
                  <div style={{ borderTop: "1px dashed #000", width: "80%", paddingTop: "4px", fontWeight: "600" }}>
                    Satın Alma Departmanı / Onay
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ fontWeight: "bold", marginBottom: "8px" }}>TEDARİKÇİ ONAYI</div>
                  <div style={{ minHeight: "70px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "4px" }}>
                    <span style={{ color: "#888", fontStyle: "italic", fontSize: "11px" }}>[Tedarikçi Kaşe / İmza]</span>
                  </div>
                  <div style={{ borderTop: "1px dashed #000", width: "80%", paddingTop: "4px", fontWeight: "600" }}>
                    Firma Yetkilisi İmza / Tarih
                  </div>
                </div>
              </div>

              {/* IATF 16949 Standard Form Footer */}
              <IATFFormFooter formId="SAT_F09" defaultKodu="SAT/F09" defaultAdi="Satın Alma Sipariş Formu" />
            </div>
          </div>
        </div>
      )}

      {/* SİLME ONAY MODALI */}
      {deleteConfirm && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0, 0, 0, 0.65)" }}>
          <div style={{ background: "var(--panel-bg, #1e293b)", color: "var(--panel-text, #f8fafc)", padding: 24, borderRadius: 12, maxWidth: 440, width: "90%", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)", border: "1px solid var(--panel-border, #334155)" }}>
            <h3 style={{ marginTop: 0, color: "#ef4444", display: "flex", alignItems: "center", gap: 8 }}>
              ⚠️ Silme Onayı
            </h3>
            <p style={{ margin: "16px 0 24px 0", fontSize: "0.95rem", lineHeight: 1.5 }}>
              <strong>"{deleteConfirm.no}"</strong> {deleteConfirm.type === "order" ? "numaralı satın alma siparişini" : "isimli tedarikçi kaydını"} silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDeleteConfirm(null)}
                style={{ padding: "8px 16px" }}
              >
                İptal
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={executeDelete}
                style={{ backgroundColor: "#ef4444", borderColor: "#ef4444", padding: "8px 16px", fontWeight: "bold" }}
              >
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
