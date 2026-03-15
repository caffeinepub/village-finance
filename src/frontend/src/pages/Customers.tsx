import { Principal } from "@icp-sdk/core/principal";
import { FileText, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Village } from "../backend";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
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
import type { CustomerFull } from "../types";

interface UploadedDoc {
  name: string;
  url: string;
  type: string;
  size: number;
}

function maskAadhar(aadhar: string): string {
  if (!aadhar || aadhar.length < 4) return aadhar || "--";
  const digits = aadhar.replace(/\D/g, "");
  const last4 = digits.slice(-4);
  return `XXXX-XXXX-${last4}`;
}

export default function Customers() {
  const { actor } = useActor();
  const [customers, setCustomers] = useState<CustomerFull[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<CustomerFull | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    aadharNo: "",
    villageId: "",
  });
  const [saving, setSaving] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerFull | null>(null);

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
    setForm({ name: "", phone: "", address: "", aadharNo: "", villageId: "" });
    setDocs([]);
    setPhoneError("");
    setOpen(true);
  };

  const openEdit = (c: CustomerFull) => {
    setEdit(c);
    setForm({
      name: c.name,
      phone: c.phone,
      address: c.address,
      aadharNo: c.aadharNo || "",
      villageId: c.villageId.toString(),
    });
    setDocs([]);
    setPhoneError("");
    setOpen(true);
  };

  const handlePhoneChange = (value: string) => {
    setForm((f) => ({ ...f, phone: value }));
    if (phoneError) setPhoneError("");
    // Inline duplicate check
    if (value) {
      const duplicate = customers.find(
        (c) => c.phone === value && (!edit || c.id !== edit.id),
      );
      if (duplicate) {
        setPhoneError(
          "This mobile number is already registered to another customer.",
        );
      }
    }
  };

  const save = async () => {
    if (!actor || !form.name || !form.villageId) return;

    // Frontend duplicate check before backend call
    const duplicate = customers.find(
      (c) => c.phone === form.phone && (!edit || c.id !== edit.id),
    );
    if (duplicate) {
      setPhoneError(
        "This mobile number is already registered to another customer.",
      );
      return;
    }

    setSaving(true);
    try {
      if (edit) {
        await actor.updateCustomer(
          edit.id,
          form.name,
          form.phone,
          form.address,
          form.aadharNo,
          BigInt(form.villageId),
        );
      } else {
        await actor.createCustomer(
          form.name,
          form.phone,
          form.address,
          form.aadharNo,
          BigInt(form.villageId),
          Principal.anonymous(),
        );
      }
      setOpen(false);
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (
        msg.toLowerCase().includes("mobile number already exists") ||
        msg.toLowerCase().includes("mobile number")
      ) {
        setPhoneError(
          "This mobile number is already registered to another customer.",
        );
      } else {
        alert(`Error saving customer: ${msg}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!actor || !deleteTarget) return;
    await actor.deleteCustomer(deleteTarget.id);
    setDeleteTarget(null);
    load();
  };

  const getVillage = (id: bigint) => villages.find((v) => v.id === id);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newDocs: UploadedDoc[] = [];
    for (const file of files) {
      const url = URL.createObjectURL(file);
      newDocs.push({ name: file.name, url, type: file.type, size: file.size });
    }
    setDocs((prev) => [...prev, ...newDocs]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeDoc = (name: string) => {
    setDocs((prev) => {
      const doc = prev.find((d) => d.name === name);
      if (doc) URL.revokeObjectURL(doc.url);
      return prev.filter((d) => d.name !== name);
    });
  };

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
                  {c.aadharNo && (
                    <div className="text-xs text-gray-500 mb-1">
                      Aadhar: {maskAadhar(c.aadharNo)}
                    </div>
                  )}
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
                      onClick={() => setDeleteTarget(c)}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent data-ocid="customers.delete.dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the customer record for{" "}
              <strong>{deleteTarget?.name}</strong>. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-ocid="customers.delete_confirm.cancel_button">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              data-ocid="customers.delete_confirm.confirm_button"
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          data-ocid="customers.dialog"
          className="max-h-[90vh] overflow-y-auto"
        >
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
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="Phone number"
                className={
                  phoneError ? "border-red-500 focus-visible:ring-red-500" : ""
                }
              />
              {phoneError && (
                <p
                  data-ocid="customers.phone.error_state"
                  className="text-red-500 text-xs mt-1"
                >
                  {phoneError}
                </p>
              )}
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
              <Label>Aadhar No (optional)</Label>
              <Input
                data-ocid="customers.aadhar.input"
                value={form.aadharNo}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
                  setForm((f) => ({ ...f, aadharNo: digits }));
                }}
                placeholder="12-digit Aadhar number"
                inputMode="numeric"
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
            <div>
              <Label>Customer Documents</Label>
              <button
                type="button"
                data-ocid="customers.docs.upload_button"
                className="mt-1 w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-indigo-400 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mx-auto h-6 w-6 text-gray-400 mb-1" />
                <p className="text-sm text-gray-500">
                  Click to upload PDFs or images
                </p>
                <p className="text-xs text-gray-400">PDF, JPG, PNG supported</p>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              {docs.length > 0 && (
                <div className="mt-2 space-y-2">
                  {docs.map((doc) => (
                    <div
                      key={doc.name}
                      className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-indigo-500 shrink-0" />
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-indigo-600 hover:underline truncate"
                        >
                          {doc.name}
                        </a>
                        <span className="text-xs text-gray-400 shrink-0">
                          ({(doc.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeDoc(doc.name)}
                        className="text-red-400 hover:text-red-600 shrink-0 ml-2"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
              disabled={saving || !form.name || !form.villageId || !!phoneError}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
