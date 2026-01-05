import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "./supabase/client";
import Login from "./auth/Login";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";

export default function App() {
  const [user, setUser] = useState(null);

  /* ================= AUTH STATE ================= */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user || null);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  /* ================= ONLINE / LAST SEEN ================= */
  useEffect(() => {
    if (!user) return;

    const setOnlineStatus = async (online) => {
      await supabase.from("profiles").upsert({
        id: user.id,
        is_online: online,
        last_seen: online ? null : new Date(),
      });
    };

    // 🟢 User online
    setOnlineStatus(true);

    // 🔴 On tab close / refresh
    const handleUnload = () => {
      setOnlineStatus(false);
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      setOnlineStatus(false);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [user]);

  /* ================= ROUTING ================= */
  if (!user) return <Login />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/chat/:userId" element={<Chat />} />
      </Routes>
    </BrowserRouter>
  );
}
