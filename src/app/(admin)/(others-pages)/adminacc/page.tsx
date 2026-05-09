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
      const res = await fetch("/api/accounts", { credentials: "include" });
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
        credentials: "include",
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
      const res = await fetch(`/api/accounts/${id}`, { method: "DELETE", credentials: "include" });
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
        credentials: "include",
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

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
            Akun Pengguna
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Kelola akun pengguna admin dengan mudah
          </p>
        </div>

        <button
          onClick={() => setShowCreate((s) => !s)}
          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-theme-xs transition hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-white/90 dark:hover:bg-white/10"
        >
          {showCreate ? "Batal" : "Tambah Akun"}
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <h3 className="mb-4 text-base font-semibold text-gray-800 dark:text-white/90">
            Tambah Akun Baru
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Nama
              </label>
              <input
                value={newAccount.name}
                onChange={(e) =>
                  setNewAccount({ ...newAccount, name: e.target.value })
                }
                placeholder="Masukkan nama"
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-white/10 dark:text-white/90"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>
              <input
                value={newAccount.password}
                onChange={(e) =>
                  setNewAccount({ ...newAccount, password: e.target.value })
                }
                placeholder="Masukkan password"
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-white/10 dark:text-white/90"
              />
            </div>
          </div>

          <div className="mt-5">
            <button
              onClick={createAccountHandler}
              className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600"
            >
              Buat Akun
            </button>
          </div>
        </div>
      )}

      {/* Loading & Error */}
      {loading && (
        <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          Memuat...
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/20 dark:bg-red-500/10">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/5">
        <div className="max-w-full overflow-x-auto">
          <div className="min-w-[700px]">
            <table className="w-full">
              <thead className="border-b border-gray-100 dark:border-white/5">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Nama
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Password
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Aksi
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {accounts.map((a) => (
                  <tr key={String(a.id)}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-600 dark:bg-brand-500/20 dark:text-brand-400">
                          {a.name?.charAt(0).toUpperCase()}
                        </div>

                        <div>
                          <span className="block text-sm font-medium text-gray-800 dark:text-white/90">
                            {a.name}
                          </span>

                          <span className="block text-xs text-gray-500 dark:text-gray-400">
                            Admin Account
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {a.password}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEdit(a)}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:text-white/90 dark:hover:bg-white/10"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => deleteAccount(a.id)}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-500/20 dark:hover:bg-red-500/10"
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {accounts.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400"
                    >
                      Tidak ada akun
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Form */}
      {editing && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
          <h3 className="mb-4 text-base font-semibold text-gray-800 dark:text-white/90">
            Edit Akun
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Nama
              </label>

              <input
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing!, name: e.target.value })
                }
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-white/10 dark:text-white/90"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>

              <input
                value={editing.password}
                onChange={(e) =>
                  setEditing({ ...editing!, password: e.target.value })
                }
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2 text-sm text-gray-800 outline-none transition focus:border-brand-500 dark:border-white/10 dark:text-white/90"
              />
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              disabled={saving}
              onClick={saveEdit}
              className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600 disabled:opacity-70"
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </button>

            <button
              onClick={cancelEdit}
              className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:text-white/90 dark:hover:bg-white/10"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
