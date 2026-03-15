import { useCallback, useEffect, useState } from "react";
import {
  type BalanceTransaction,
  Variant_adjustment_collection_disbursal,
} from "../backend";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useActor } from "../hooks/useActor";
import { formatDate, formatRupees } from "../utils/format";

export default function Ledger() {
  const { actor } = useActor();
  const [transactions, setTransactions] = useState<BalanceTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjAmount, setAdjAmount] = useState("");
  const [adjDesc, setAdjDesc] = useState("");
  const [adjAdd, setAdjAdd] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!actor) return;
    actor
      .getAllTransactions()
      .then((t) => {
        const sorted = [...t].sort((a, b) => Number(b.date) - Number(a.date));
        setTransactions(sorted);
      })
      .finally(() => setLoading(false));
  }, [actor]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = transactions.filter((t) => {
    const ms = Number(t.date) / 1_000_000;
    if (fromDate && ms < new Date(fromDate).getTime()) return false;
    if (toDate && ms > new Date(`${toDate}T23:59:59`).getTime()) return false;
    return true;
  });

  const typeColor = (type: Variant_adjustment_collection_disbursal) => {
    if (type === Variant_adjustment_collection_disbursal.disbursal)
      return "bg-red-100 text-red-700";
    if (type === Variant_adjustment_collection_disbursal.collection)
      return "bg-green-100 text-green-700";
    return "bg-blue-100 text-blue-700";
  };

  const adjust = async () => {
    if (!actor || !adjAmount || !adjDesc) return;
    setSaving(true);
    try {
      await actor.balanceAdjustment(
        BigInt(Math.round(Number.parseFloat(adjAmount) * 100)),
        adjDesc,
        adjAdd,
      );
      setAdjOpen(false);
      setAdjAmount("");
      setAdjDesc("");
      load();
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div
        data-ocid="ledger.loading_state"
        className="text-center py-20 text-gray-400"
      >
        Loading ledger...
      </div>
    );

  return (
    <div data-ocid="ledger.section">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-gray-800">Ledger Report</h2>
        <Button
          data-ocid="ledger.adjust.primary_button"
          onClick={() => setAdjOpen(true)}
          variant="outline"
        >
          Balance Adjustment
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="pt-4 flex gap-4 flex-wrap">
          <div>
            <Label>From Date</Label>
            <Input
              data-ocid="ledger.from.input"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div>
            <Label>To Date</Label>
            <Input
              data-ocid="ledger.to.input"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          {(fromDate || toDate) && (
            <div className="flex items-end">
              <Button
                data-ocid="ledger.clear_filter.secondary_button"
                variant="ghost"
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                }}
              >
                Clear
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <div
          data-ocid="ledger.empty_state"
          className="text-center py-20 text-gray-400"
        >
          No transactions found.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t, i) => (
            <Card
              key={t.id.toString()}
              data-ocid={`ledger.item.${i + 1}`}
              className="border-0 shadow-sm"
            >
              <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="font-medium">{t.description}</div>
                  <div className="text-xs text-gray-500">
                    {formatDate(t.date)} · Ref: {t.referenceId}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={typeColor(t.type)}>{t.type}</Badge>
                  <span
                    className={`font-bold text-lg ${
                      t.type ===
                      Variant_adjustment_collection_disbursal.disbursal
                        ? "text-red-600"
                        : "text-green-600"
                    }`}
                  >
                    {t.type ===
                    Variant_adjustment_collection_disbursal.disbursal
                      ? "-"
                      : "+"}
                    {formatRupees(t.amount)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Adjustment Dialog */}
      <Dialog open={adjOpen} onOpenChange={setAdjOpen}>
        <DialogContent data-ocid="ledger.adjust.dialog">
          <DialogHeader>
            <DialogTitle>Balance Adjustment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-3">
              <Button
                data-ocid="ledger.add.toggle"
                variant={adjAdd ? "default" : "outline"}
                onClick={() => setAdjAdd(true)}
                className="flex-1"
              >
                Add Cash
              </Button>
              <Button
                data-ocid="ledger.remove.toggle"
                variant={!adjAdd ? "default" : "outline"}
                onClick={() => setAdjAdd(false)}
                className="flex-1"
              >
                Remove Cash
              </Button>
            </div>
            <div>
              <Label>Amount (₹)</Label>
              <Input
                data-ocid="ledger.adj_amount.input"
                type="number"
                value={adjAmount}
                onChange={(e) => setAdjAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                data-ocid="ledger.adj_desc.input"
                value={adjDesc}
                onChange={(e) => setAdjDesc(e.target.value)}
                placeholder="Reason for adjustment"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              data-ocid="ledger.adj_cancel.cancel_button"
              variant="outline"
              onClick={() => setAdjOpen(false)}
            >
              Cancel
            </Button>
            <Button
              data-ocid="ledger.adj_save.save_button"
              onClick={adjust}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
