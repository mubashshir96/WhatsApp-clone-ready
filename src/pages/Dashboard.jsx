import { useEffect, useState } from "react";
import { supabase } from "../supabase/client";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [users, setUsers] = useState([]);
  const [me, setMe] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    // 🔐 current logged-in user
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return;

    setMe(auth.user);

    // ✅ profiles table se users lao (ID nahi, NAME)
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, avatar_url");

    if (!error && data) {
      // apna khud ka profile hata do
      setUsers(data.filter((u) => u.id !== auth.user.id));
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate("/"); // login page
  };

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <div style={styles.header}>
        <h3 style={{ margin: 0 }}>Chats</h3>
        <button onClick={logout} style={styles.logoutBtn}>
          Logout
        </button>
      </div>

      {/* USER LIST */}
      <div style={styles.list}>
        {users.map((u) => (
          <div
            key={u.id}
            style={styles.user}
            onClick={() => navigate(`/chat/${u.id}`)}
          >
            <img
              src={
                u.avatar_url ||
                `https://ui-avatars.com/api/?name=${u.name}&background=0D8ABC&color=fff`
              }
              alt="avatar"
              style={styles.avatar}
            />

            <div>
              <div style={styles.name}>{u.name}</div>
              <div style={styles.sub}>Tap to chat</div>
            </div>
          </div>
        ))}

        {users.length === 0 && (
          <div style={{ padding: 20, color: "#777" }}>
            No users found
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= STYLES ================= */
const styles = {
  container: {
    height: "100vh",
    background: "#f0f2f5",
    padding: 12,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  logoutBtn: {
    background: "#d9534f",
    color: "#fff",
    border: "none",
    padding: "6px 12px",
    borderRadius: 6,
    cursor: "pointer",
  },
  list: {
    background: "#fff",
    borderRadius: 8,
    overflow: "hidden",
  },
  user: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 12,
    cursor: "pointer",
    borderBottom: "1px solid #eee",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: "50%",
    objectFit: "cover",
  },
  name: {
    fontWeight: "bold",
  },
  sub: {
    fontSize: 12,
    color: "#777",
  },
};
