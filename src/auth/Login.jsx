import { useState } from "react";
import { supabase } from "../supabase/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  /* ================= LOGIN ================= */
  const login = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) alert(error.message);
  };

  /* ================= SIGNUP ================= */
  const signup = async () => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    const user = data.user;

    // ✅ INSERT PROFILE AFTER SIGNUP
    if (user) {
      await supabase.from("profiles").insert({
        id: user.id,          // same as auth.uid
        name: fullName,       // 👈 REAL NAME
        avatar_url: null,
      });
    }
  };

  return (
    <div style={styles.container}>
      <h2>WhatsApp Clone</h2>

      <input
        placeholder="Full Name"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        style={styles.input}
      />

      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={styles.input}
      />

      <input
        placeholder="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={styles.input}
      />

      <div style={{ marginTop: 10 }}>
        <button onClick={login}>Login</button>
        <button onClick={signup} style={{ marginLeft: 10 }}>
          Signup
        </button>
      </div>
    </div>
  );
}

/* ================= STYLES ================= */
const styles = {
  container: {
    padding: 40,
    maxWidth: 400,
    margin: "auto",
  },
  input: {
    width: "100%",
    padding: 8,
    marginBottom: 10,
  },
};
