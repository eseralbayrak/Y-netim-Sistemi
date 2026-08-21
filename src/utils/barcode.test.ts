import test from "node:test";
import assert from "node:assert/strict";

import { buildBarcodeValue, normalizeBarcodeToken } from "./barcode.ts";

test("barcode contains only the lot number", () => {
  const label = {
    receipt: {
      lotNo: "DENEME1645",
      irsaliyeNo: "20261525",
      siparisNo: "26/H-001",
    },
  } as any;

  const barcode = buildBarcodeValue(label);
  const receiptValue = normalizeBarcodeToken(label.receipt.lotNo);
  const scannedValue = normalizeBarcodeToken("DENEME1645");

  assert.equal(barcode, "DENEME1645");
  assert.equal(barcode.includes("20261525"), false);
  assert.equal(barcode.includes("26_H-001"), false);
  assert.equal(receiptValue, scannedValue);
});
