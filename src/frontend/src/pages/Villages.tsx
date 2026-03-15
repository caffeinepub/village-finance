import { useCallback, useEffect, useState } from "react";
import type { Village } from "../backend";
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

const COLORS = [
  "from-blue-500 to-cyan-500",
  "from-purple-500 to-pink-500",
  "from-orange-500 to-red-500",
  "from-green-500 to-teal-500",
  "from-yellow-500 to-orange-500",
  "from-indigo-500 to-purple-500",
];

export default function Villages() {
  const { actor } = useActor();
  const [villages, setVillages] = useState<Village[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editVillage, setEditVillage] = useState<Village | null>(null);
  const [name, setName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!actor) return;
    actor
      .getAllVillages()
      .then(setVillages)
      .finally(() => setLoading(false));
  }, [actor]);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditVillage(null);
    setName("");
    setShortCode("");
    setOpen(true);
  };
  const openEdit = (v: Village) => {
    setEditVillage(v);
    setName(v.name);
    setShortCode(v.shortCode);
    setOpen(true);
  };

  const save = async () => {
    if (!actor || !name || shortCode.length !== 3) return;
    setSaving(true);
    try {
      if (editVillage) {
        await actor.updateVillage(
          editVillage.id,
          name,
          shortCode.toUpperCase(),
        );
      } else {
        await actor.createVillage(name, shortCode.toUpperCase());
      }
      setOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: bigint) => {
    if (!actor || !confirm("Delete this village?")) return;
    await actor.deleteVillage(id);
    load();
  };

  if (loading)
    return (
      <div
        data-ocid="villages.loading_state"
        className="text-center py-20 text-gray-400"
      >
        Loading...
      </div>
    );

  return (
    <div data-ocid="villages.section">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Villages</h2>
        <Button
          data-ocid="villages.add.primary_button"
          onClick={openAdd}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          + Add Village
        </Button>
      </div>

      {villages.length === 0 ? (
        <div
          data-ocid="villages.empty_state"
          className="text-center py-20 text-gray-400"
        >
          No villages yet. Add your first village!
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {villages.map((v, i) => (
            <Card
              key={v.id.toString()}
              data-ocid={`villages.item.${i + 1}`}
              className="overflow-hidden border-0 shadow-md"
            >
              <div
                className={`bg-gradient-to-br ${COLORS[i % COLORS.length]} p-4 text-white`}
              >
                <div className="text-3xl font-black">{v.shortCode}</div>
                <div className="text-lg font-semibold mt-1">{v.name}</div>
              </div>
              <CardContent className="p-3 flex gap-2">
                <Button
                  data-ocid={`villages.edit_button.${i + 1}`}
                  variant="outline"
                  size="sm"
                  onClick={() => openEdit(v)}
                  className="flex-1"
                >
                  Edit
                </Button>
                <Button
                  data-ocid={`villages.delete_button.${i + 1}`}
                  variant="destructive"
                  size="sm"
                  onClick={() => del(v.id)}
                  className="flex-1"
                >
                  Delete
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-ocid="villages.dialog">
          <DialogHeader>
            <DialogTitle>
              {editVillage ? "Edit Village" : "Add Village"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Village Name</Label>
              <Input
                data-ocid="villages.name.input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Birpur"
              />
            </div>
            <div>
              <Label>Short Code (3 letters)</Label>
              <Input
                data-ocid="villages.code.input"
                value={shortCode}
                onChange={(e) =>
                  setShortCode(e.target.value.slice(0, 3).toUpperCase())
                }
                placeholder="e.g. BRP"
                maxLength={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              data-ocid="villages.cancel.cancel_button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              data-ocid="villages.save.save_button"
              onClick={save}
              disabled={saving || !name || shortCode.length !== 3}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
