import { Loader2, Phone, Trash2, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useActor } from "../hooks/useActor";
import type { ExtendedBackend } from "../types";

export default function AgentsTab() {
  const { actor: rawActor } = useActor();
  const actor = rawActor as ExtendedBackend | null;
  const [agents, setAgents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deletePhone, setDeletePhone] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadAgents = useCallback(async () => {
    if (!actor) return;
    setLoading(true);
    try {
      const list = await actor.getAllAgents();
      setAgents(list);
    } catch {
      toast.error("Failed to load agents");
    } finally {
      setLoading(false);
    }
  }, [actor]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const handleAdd = async () => {
    if (!actor || !newPhone.trim()) return;
    setAdding(true);
    try {
      await actor.addAgent(newPhone.trim());
      toast.success(`Agent ${newPhone.trim()} added successfully`);
      setNewPhone("");
      setDialogOpen(false);
      await loadAgents();
    } catch {
      toast.error("Failed to add agent");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (phone: string) => {
    if (!actor) return;
    setDeleting(true);
    try {
      await actor.removeAgent(phone);
      toast.success(`Agent ${phone} removed`);
      setDeletePhone(null);
      await loadAgents();
    } catch {
      toast.error("Failed to remove agent");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div data-ocid="agents.section">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Agents</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              data-ocid="agents.add.open_modal_button"
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add Agent
            </Button>
          </DialogTrigger>
          <DialogContent data-ocid="agents.add.dialog">
            <DialogHeader>
              <DialogTitle>Add Agent / Staff Member</DialogTitle>
              <DialogDescription>
                Enter the phone number of the staff member. They can use this
                number to log in as an agent.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>Phone Number</Label>
                <Input
                  data-ocid="agents.add.phone.input"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="Enter agent phone number"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                data-ocid="agents.add.cancel_button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                data-ocid="agents.add.submit_button"
                onClick={handleAdd}
                disabled={adding || !newPhone.trim()}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {adding && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Add Agent
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div
          data-ocid="agents.loading_state"
          className="text-center py-20 text-gray-400"
        >
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
          Loading agents...
        </div>
      ) : agents.length === 0 ? (
        <div
          data-ocid="agents.empty_state"
          className="text-center py-20 text-gray-400"
        >
          <Phone className="w-16 h-16 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No agents registered yet</p>
          <p className="text-sm">
            Add agent phone numbers so staff can access the panel.
          </p>
        </div>
      ) : (
        <div
          data-ocid="agents.list"
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
        >
          {agents.map((phone, i) => (
            <Card
              key={phone}
              data-ocid={`agents.item.${i + 1}`}
              className="border-0 shadow-md overflow-hidden"
            >
              <div className="h-2 bg-gradient-to-r from-teal-500 to-emerald-500" />
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Phone className="w-4 h-4 text-teal-600" />
                  <span className="font-mono">{phone}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Dialog
                  open={deletePhone === phone}
                  onOpenChange={(open) => !open && setDeletePhone(null)}
                >
                  <DialogTrigger asChild>
                    <Button
                      data-ocid={`agents.delete_button.${i + 1}`}
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200 hover:bg-red-50 w-full"
                      onClick={() => setDeletePhone(phone)}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Remove Agent
                    </Button>
                  </DialogTrigger>
                  <DialogContent data-ocid="agents.delete.dialog">
                    <DialogHeader>
                      <DialogTitle>Remove Agent</DialogTitle>
                      <DialogDescription>
                        Remove{" "}
                        <span className="font-mono font-bold">{phone}</span>{" "}
                        from the agent list? They will no longer be able to
                        access the staff panel.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button
                        data-ocid="agents.delete.cancel_button"
                        variant="outline"
                        onClick={() => setDeletePhone(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        data-ocid="agents.delete.confirm_button"
                        variant="destructive"
                        disabled={deleting}
                        onClick={() => handleDelete(phone)}
                      >
                        {deleting && (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        )}
                        Remove
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
