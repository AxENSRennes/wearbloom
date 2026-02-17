import { useCallback, useEffect, useState } from "react";

import {
  getHiddenStockGarmentIds,
  getShowStockGarments,
  hideStockGarment,
  setShowStockGarments,
  unhideAllStockGarments,
  unhideStockGarment,
} from "~/utils/stockGarmentPreferences";

export function useStockGarmentPreferences() {
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [showStock, setShowStock] = useState(true);

  useEffect(() => {
    void getHiddenStockGarmentIds().then(setHiddenIds);
    void getShowStockGarments().then(setShowStock);
  }, []);

  const hideGarment = useCallback(async (id: string) => {
    await hideStockGarment(id);
    setHiddenIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const unhideGarment = useCallback(async (id: string) => {
    await unhideStockGarment(id);
    setHiddenIds((prev) => prev.filter((i) => i !== id));
  }, []);

  const toggleShowStock = useCallback(() => {
    setShowStock((prev) => {
      const next = !prev;
      void setShowStockGarments(next);
      return next;
    });
  }, []);

  const unhideAll = useCallback(async () => {
    await unhideAllStockGarments();
    setHiddenIds([]);
  }, []);

  return { hiddenIds, showStock, hideGarment, unhideGarment, toggleShowStock, unhideAll };
}
