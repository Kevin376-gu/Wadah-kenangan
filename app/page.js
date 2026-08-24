"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  Lock,
  Unlock,
  Search,
  Plus,
  Upload,
  ArrowLeft,
  X,
  Image as ImageIcon,
  Film,
  KeyRound,
  ShieldCheck,
  LogOut,
} from "lucide-react";

const BUCKET = "vault-media";

export default function Home() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [screen, setScreen] = useState("dashboard");
  const [myVaults, setMyVaults] = useState([]);
  const [activeVault, setActiveVault] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingSession(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) loadMyVaults();
  }, [session]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = (msg, tone = "ok") => setToast({ msg, tone });

  const loadMyVaults = async () => {
    const { data, error } = await supabase.rpc("list_my_vaults");
    if (!error) setMyVaults(data || []);
  };

  if (checkingSession) {
    return <Shell><p style={{ textAlign: "center", color: "#8CA396" }}>Memuat…</p></Shell>;
  }

  if (!session) {
    return (
      <Shell>
        <AuthScreen onDone={() => {}} showToast={showToast} />
        {toast && <Toast msg={toast.msg} tone={toast.tone} />}
      </Shell>
    );
  }

  return (
    <Shell
      screen={screen}
      onBack={() => {
        setScreen("dashboard");
        loadMyVaults();
      }}
      onLogout={async () => {
        await supabase.auth.signOut();
        setScreen("dashboard");
      }}
    >
      {screen === "dashboard" && (
        <Dashboard
          userEmail={session.user.email}
          vaults={myVaults}
          onCreate={() => setScreen("create")}
          onSearch={() => setScreen("search")}
          onOpenOwn={(v) => {
            setActiveVault(v);
            setScreen("vault");
          }}
        />
      )}

      {screen === "create" && (
        <CreateVault
          onCancel={() => setScreen("dashboard")}
          onCreate={async (name, password) => {
            const { data, error } = await supabase.rpc("create_vault", {
              p_name: name,
              p_password: password,
            });
            if (error) {
              showToast(
                error.message.includes("duplicate") || error.message.includes("unique")
                  ? "Nama wadah sudah dipakai, coba nama lain."
                  : "Gagal membuat wadah: " + error.message,
                "error"
              );
              return;
            }
            setActiveVault({ id: data, name });
            showToast("Wadah berhasil dibuat.");
            setScreen("vault");
          }}
        />
      )}

      {screen === "search" && (
        <SearchVault
          onCancel={() => setScreen("dashboard")}
          onUnlock={async (name, password) => {
            const { data, error } = await supabase.rpc("unlock_vault", {
              p_name: name,
              p_password: password,
            });
            if (error || !data || data.length === 0) {
              showToast("Nama wadah atau kata sandi salah.", "error");
              return false;
            }
            setActiveVault(data[0]);
            setScreen("vault");
            return true;
          }}
        />
      )}

      {screen === "vault" && activeVault && (
        <VaultView
          vault={activeVault}
          userEmail={session.user.email}
          showToast={showToast}
        />
      )}

      {toast && <Toast msg={toast.msg} tone={toast.tone} />}
    </Shell>
  );
}

function Shell({ children, screen, onBack, onLogout }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #16221D 0%, #1B2A23 100%)",
        color: "#F3ECDC",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "32px 16px 60px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 480, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              border: "1.5px solid #C9A15B",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(201,161,91,0.08)",
            }}
          >
            <ShieldCheck size={18} color="#C9A15B" />
          </div>
          <div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600 }}>Wadah Kenangan</div>
            <div style={{ fontSize: 11, color: "#8CA396", marginTop: -2 }}>arsip foto &amp; video bersama</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {screen && screen !== "dashboard" && (
            <button onClick={onBack} style={ghostBtnSmall}>
              <ArrowLeft size={14} /> Kembali
            </button>
          )}
          {onLogout && screen === "dashboard" && (
            <button onClick={onLogout} style={ghostBtnSmall}>
              <LogOut size={14} /> Keluar
            </button>
          )}
        </div>
      </div>
      <div style={{ width: "100%", maxWidth: 480, marginTop: 28 }}>{children}</div>
    </div>
  );
}

const ghostBtnSmall = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  background: "transparent",
  border: "1px solid #3A4B42",
  color: "#F3ECDC",
  borderRadius: 8,
  padding: "7px 12px",
  fontSize: 12.5,
};

function Card({ children, style }) {
  return (
    <div
      style={{
        background: "#F3ECDC",
        color: "#1C2B26",
        borderRadius: 16,
        padding: 26,
        boxShadow: "0 20px 40px -18px rgba(0,0,0,0.5)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <label style={{ fontSize: 12, fontWeight: 600, color: "#4A5C52", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 }}>
      {children}
    </label>
  );
}

const inputStyle = {
  width: "100%",
  padding: "11px 13px",
  borderRadius: 9,
  border: "1.5px solid #DCD3BC",
  background: "#FBF8EF",
  fontSize: 14.5,
  outline: "none",
  color: "#1C2B26",
  boxSizing: "border-box",
};

const primaryBtn = {
  width: "100%",
  padding: "12px 16px",
  borderRadius: 9,
  border: "none",
  background: "#1C2B26",
  color: "#F3ECDC",
  fontSize: 14.5,
  fontWeight: 6
