"use client";

import React, { useEffect, useState } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";

type Account = {
  id: string | number;
  name?: string;
  password?: string;
  role?: string;
};

export default function AdminAccPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Account | null>(null);
  const [saving, setSaving] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newAccount, setNewAccount] = useState({ name: "", password: "" });

  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/accounts");
      if (!res.ok) throw new Error("Gagal mengambil data");
      const data = await res.json();
      setAccounts(data || []);
    } catch (e: any) {
      setError(e.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(acc: Account) {
    setEditing({ ...acc });
  }

  function cancelEdit() {
    setEditing(null);
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/accounts/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      if (!res.ok) throw new Error("Gagal menyimpan");
      const updated = await res.json();
      setAccounts((prev) => prev.map((p) => (String(p.id) === String(updated.id) ? updated : p)));
      setEditing(null);
    } catch (e: any) {
      alert(e.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount(id: string | number) {
    if (!confirm("Hapus akun ini?")) return;
    try {
      const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus");
      setAccounts((prev) => prev.filter((p) => String(p.id) !== String(id)));
    } catch (e: any) {
      alert(e.message || "Gagal menghapus");
    }
  }

  async function createAccountHandler() {
    if (!newAccount.name || !newAccount.password) {
      alert("Nama dan password diperlukan");
      return;
    }
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAccount),
      });
      if (!res.ok) throw new Error("Gagal membuat akun");
      const created = await res.json();
      setAccounts((prev) => [created, ...prev]);
      setNewAccount({ name: "", password: "" });
      setShowCreate(false);
    } catch (e: any) {
      alert(e.message || "Gagal membuat akun");
    }
  }

  return (
    <div className="p-6">
      <PageBreadcrumb pageTitle="Admin Accounts" />

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium">Akun Pengguna</h2>
        <button onClick={() => setShowCreate((s) => !s)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm hover:bg-gray-50">
          {showCreate ? "Batal" : "Tambah Akun"}
        </button>
      </div>

      {showCreate && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input value={newAccount.name} onChange={(e)=>setNewAccount({...newAccount,name:e.target.value})} placeholder="Nama" className="border p-2" />
            <input value={newAccount.password} onChange={(e)=>setNewAccount({...newAccount,password:e.target.value})} placeholder="Password" className="border p-2" />
          </div>
          <div className="mt-3">
            <button onClick={createAccountHandler} className="rounded bg-brand-500 px-3 py-2 text-white">Buat Akun</button>
          </div>
        </div>
      )}

      {loading && <div>Memuat...</div>}
      {error && <div className="text-red-600">{error}</div>}

      <div className="overflow-x-auto bg-white rounded border border-gray-200">
        <table className="w-full table-auto">
          <thead>
            <tr className="text-left text-sm text-gray-600">
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">Password</th>
              <th className="px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={String(a.id)} className="border-t">
                <td className="px-4 py-3">{a.name}</td>
                <td className="px-4 py-3">{a.password}</td>
                <td className="px-4 py-3">
                  <button onClick={() => startEdit(a)} className="mr-2 rounded border px-2 py-1 text-sm">Edit</button>
                  <button onClick={() => deleteAccount(a.id)} className="rounded border px-2 py-1 text-sm">Hapus</button>
                </td>
              </tr>
            ))}
            {accounts.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">Tidak ada akun</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="mt-6 rounded border border-gray-200 bg-white p-4">
          <h3 className="mb-2 font-medium">Edit Akun</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input value={editing.name} onChange={(e)=>setEditing({...editing!,name:e.target.value})} className="border p-2" />
            <input value={editing.password} onChange={(e)=>setEditing({...editing!,password:e.target.value})} className="border p-2" />
          </div>
          <div className="mt-3">
            <button disabled={saving} onClick={saveEdit} className="mr-2 rounded bg-brand-500 px-3 py-2 text-white">{saving?"Menyimpan...":"Simpan"}</button>
            <button onClick={cancelEdit} className="rounded border px-3 py-2">Batal</button>
          </div>
        </div>
      )}
    </div>
  );
}
