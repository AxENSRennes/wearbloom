import AsyncStorage from "@react-native-async-storage/async-storage";
import { afterEach, describe, expect, test } from "bun:test";

import {
  getHiddenStockGarmentIds,
  getShowStockGarments,
  hideStockGarment,
  setShowStockGarments,
  unhideAllStockGarments,
  unhideStockGarment,
} from "./stockGarmentPreferences";

describe("stockGarmentPreferences", () => {
  afterEach(async () => {
    await AsyncStorage.clear();
  });

  describe("getHiddenStockGarmentIds", () => {
    test("returns empty array when not set", async () => {
      const result = await getHiddenStockGarmentIds();
      expect(result).toEqual([]);
    });

    test("returns stored IDs", async () => {
      await AsyncStorage.setItem(
        "hidden_stock_garments",
        JSON.stringify(["id-1", "id-2"]),
      );
      const result = await getHiddenStockGarmentIds();
      expect(result).toEqual(["id-1", "id-2"]);
    });
  });

  describe("hideStockGarment", () => {
    test("adds garment ID to hidden list", async () => {
      await hideStockGarment("garment-1");
      const result = await getHiddenStockGarmentIds();
      expect(result).toEqual(["garment-1"]);
    });

    test("does not duplicate IDs", async () => {
      await hideStockGarment("garment-1");
      await hideStockGarment("garment-1");
      const result = await getHiddenStockGarmentIds();
      expect(result).toEqual(["garment-1"]);
    });

    test("adds multiple garments", async () => {
      await hideStockGarment("garment-1");
      await hideStockGarment("garment-2");
      const result = await getHiddenStockGarmentIds();
      expect(result).toEqual(["garment-1", "garment-2"]);
    });
  });

  describe("unhideStockGarment", () => {
    test("removes garment ID from hidden list", async () => {
      await hideStockGarment("garment-1");
      await hideStockGarment("garment-2");
      await unhideStockGarment("garment-1");
      const result = await getHiddenStockGarmentIds();
      expect(result).toEqual(["garment-2"]);
    });

    test("does nothing if ID not in list", async () => {
      await hideStockGarment("garment-1");
      await unhideStockGarment("garment-999");
      const result = await getHiddenStockGarmentIds();
      expect(result).toEqual(["garment-1"]);
    });
  });

  describe("unhideAllStockGarments", () => {
    test("clears entire hidden list", async () => {
      await hideStockGarment("garment-1");
      await hideStockGarment("garment-2");
      await unhideAllStockGarments();
      const result = await getHiddenStockGarmentIds();
      expect(result).toEqual([]);
    });
  });

  describe("getShowStockGarments", () => {
    test("defaults to true when not set", async () => {
      const result = await getShowStockGarments();
      expect(result).toBe(true);
    });

    test("returns stored value", async () => {
      await setShowStockGarments(false);
      const result = await getShowStockGarments();
      expect(result).toBe(false);
    });
  });

  describe("setShowStockGarments", () => {
    test("stores true", async () => {
      await setShowStockGarments(true);
      const result = await getShowStockGarments();
      expect(result).toBe(true);
    });

    test("stores false", async () => {
      await setShowStockGarments(false);
      const result = await getShowStockGarments();
      expect(result).toBe(false);
    });
  });
});
