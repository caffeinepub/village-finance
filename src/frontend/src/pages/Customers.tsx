import { Principal } from "@icp-sdk/core/principal";
import { useCallback, useEffect, useState } from "react";
import type { Customer, Village } from "../backend";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { useActor } from "../hooks/useActor";

export default function Customers() {
  const { actor } = useActor();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Customer | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    villageId: "",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!actor) return;
    Promise.all([actor.getAllCustomers(), actor.getAllVillages()])
      .then(([c, v]) => {
        setCustomers(c);
        setVillages(v);
      })
      .finally(() => setLoading(false));
  }, [actor]);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEdit(null);
    setForm({ name: "", phone: "", address: "", villageId: "" });
    setOpen(true);
  };
  const openEdit = (c: Customer) => {
    setEdit(c);
    setForm({
      name: c.name,
      phone: c.phone,
      address: c.address,
      villageId: c.villageId.toString(),
    });
    setOpen(true);
  };

  const save = async () => {
    if (!actor || !form.name || !form.villageId) return;
    setSaving(true);
    try {
      if (edit) {
        await actor.updateCustomer(
          edit.id,
          form.name,
          form.phone,
          form.address,
          BigInt(form.villageId),
        );
      } else {
        // Use anonymous principal for admin-created customers
        await actor.createCustomer(
          form.name,
          form.phone,
          form.address,
          BigInt(form.villageId),
          Principal.anonymous(),
        );
      }
      setOpen(false);
      load();
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: bigint) => {
    if (!actor || !confirm("Delete this customer?")) return;
    await actor.deleteCustomer(id);
    load();
  };

  const getVillage = (id: bigint) => villages.find((v) => v.id === id);

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search),
  );

  if (loading)
    return (
      <div
        data-ocid="customers.loading_state"
        className="text-center py-20 text-gray-400"
      >
        Loading...
      </div>
    );

  return (
    <div data-ocid="customers.section">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-gray-800">Customers</h2>
        <div className="flex gap-3">
          <Input
            data-ocid="customers.search.search_input"
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-60"
          />
          <Button
            data-ocid="customers.add.primary_button"
            onClick={openAdd}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            + Add Customer
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div
          data-ocid="customers.empty_state"
          className="text-center py-20 text-gray-400"
        >
          No customers found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c, i) => {
            const village = getVillage(c.villageId);
            return (
              <Card
                key={c.id.toString()}
                data-ocid={`customers.item.${i + 1}`}
                className="border-0 shadow-md overflow-hidden"
              >
                <div className="bg-gradient-to-r from-teal-500 to-cyan-600 p-4 text-white">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/30 rounded-full flex items-center justify-center font-bold text-lg">
                      {c.name[0]}
                    </div>
                    <div>
                      <div className="font-bold">{c.name}</div>
                      <div className="text-sm opacity-80">{c.phone}</div>
                    </div>
                  </div>
                </div>
                <CardContent className="p-4">
                  <div className="text-sm text-gray-600 mb-1">{c.address}</div>
                  {village && (
                    <div className="inline-block bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded">
                      {village.shortCode} - {village.name}
                    </div>
                  )}
                  <div className="flex gap-2 mt-3">
                    <Button
                      data-ocid={`customers.edit_button.${i + 1}`}
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(c)}
                      className="flex-1"
                    >
                      Edit
                    </Button>
                    <Button
                      data-ocid={`customers.delete_button.${i + 1}`}
                      variant="destructive"
                      size="sm"
                      onClick={() => del(c.id)}
                      className="flex-1"
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-ocid="customers.dialog">
          <DialogHeader>
            <DialogTitle>{edit ? "Edit Customer" : "Add Customer"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input
                data-ocid="customers.name.input"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Full name"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                data-ocid="customers.phone.input"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
                placeholder="Phone number"
              />
            </div>
            <div>
              <Label>Address</Label>
              <Input
                data-ocid="customers.address.input"
                value={form.address}
                onChange={(e) =>
                  setForm((f) => ({ ...f, address: e.target.value }))
                }
                placeholder="Village address"
              />
            </div>
            <div>
              <Label>Village</Label>
              <Select
                value={form.villageId}
                onValueChange={(v) => setForm((f) => ({ ...f, villageId: v }))}
              >
                <SelectTrigger data-ocid="customers.village.select">
                  <SelectValue placeholder="Select village" />
                </SelectTrigger>
                <SelectContent>
                  {villages.map((v) => (
                    <SelectItem key={v.id.toString()} value={v.id.toString()}>
                      {v.shortCode} - {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              data-ocid="customers.cancel.cancel_button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              data-ocid="customers.save.save_button"
              onClick={save}
              disabled={saving || !form.name || !form.villageId}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
