import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase/client";
import { useParams } from "react-router-dom";

/* ================= ENCRYPTION ================= */
const SECRET_KEY = "whatsapp-clone-secret";

const encryptText = async (text) => {
  const enc = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET_KEY),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode("salt"), iterations: 1000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(text)
  );

  return { iv: Array.from(iv), data: Array.from(new Uint8Array(encrypted)) };
};

const decryptText = async (payload) => {
  if (!payload?.data) return "";

  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET_KEY),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode("salt"), iterations: 1000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(payload.iv) },
    key,
    new Uint8Array(payload.data)
  );

  return dec.decode(decrypted);
};

/* ================= COMPONENT ================= */
export default function Chat() {
  const { userId } = useParams();

  /* ---------- STATES ---------- */
  const [me, setMe] = useState(null);
  const [chatId, setChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [decrypted, setDecrypted] = useState({});
  const [text, setText] = useState("");

  /* ---------- CALL ---------- */
  const [inCall, setInCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callType, setCallType] = useState("audio");

  /* ---------- STATUS ---------- */
  const [statuses, setStatuses] = useState([]);
  const [viewStatus, setViewStatus] = useState(null);
  const statusInputRef = useRef(null);

  /* ---------- REFS ---------- */
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteVideoRef = useRef(null);

  /* ---------- NOTIFICATION ---------- */
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  const notify = (title, body) => {
    if (Notification.permission === "granted") {
      new Notification(title, { body });
    }
  };

  /* ---------- INIT ---------- */
  useEffect(() => {
    init();
  }, [userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const init = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data?.user) return;
    setMe(data.user);

    const orFilter =
      `and(user1.eq.${data.user.id},user2.eq.${userId}),` +
      `and(user1.eq.${userId},user2.eq.${data.user.id})`;

    const { data: chats } = await supabase
      .from("chats")
      .select("*")
      .or(orFilter)
      .limit(1);

    let cid = chats?.[0]?.id;
    if (!cid) {
      const { data: c } = await supabase
        .from("chats")
        .insert({ user1: data.user.id, user2: userId })
        .select()
        .single();
      cid = c.id;
    }

    setChatId(cid);
    loadMessages(cid);
    loadStatus();
    subscribeMessages(cid);
    subscribeCalls(cid);
  };

  /* ---------- MESSAGES ---------- */
  const loadMessages = async (cid) => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", cid)
      .order("created_at");
    setMessages(data || []);
  };

  const subscribeMessages = (cid) => {
    supabase
      .channel("msg-" + cid)
      .on(
        "postgres_changes",
        { event: "INSERT", table: "messages", filter: `chat_id=eq.${cid}` },
        (p) => {
          setMessages((m) => [...m, p.new]);
          notify("New Message", "You received a message");
        }
      )
      .subscribe();
  };

  /* ---------- DECRYPT ---------- */
  useEffect(() => {
  messages.forEach(async (m) => {
    let payload = m.content;

    // 🔹 string JSON → object
    if (typeof payload === "string" && payload.startsWith("{")) {
      try {
        payload = JSON.parse(payload);
      } catch {
        return;
      }
    }

    if (typeof payload === "object" && payload?.iv) {
      const plain = await decryptText(payload);
      setDecrypted((d) => ({ ...d, [m.id]: plain }));
    }
  });
}, [messages]);


  const getMessageText = (m) => {
  if (!m.content) return "";

  // 🔹 encrypted JSON string detect
  if (typeof m.content === "string" && m.content.startsWith("{")) {
    try {
      const parsed = JSON.parse(m.content);
      return decrypted[m.id] || "🔐 Decrypting...";
    } catch {
      return m.content;
    }
  }

  // 🔹 normal text
  if (typeof m.content === "string") return m.content;

  // 🔹 object (rare case)
  if (typeof m.content === "object") {
    return decrypted[m.id] || "🔐 Decrypting...";
  }

  return "";
};


  /* ---------- SEND MESSAGE ---------- */
  const sendMessage = async () => {
    if (!text.trim()) return;
    const encrypted = await encryptText(text);

    await supabase.from("messages").insert({
      chat_id: chatId,
      sender_id: me.id,
      content: encrypted,
    });

    setText("");
  };

  /* ---------- FILE ---------- */
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const path = `${chatId}/${Date.now()}-${file.name}`;
    await supabase.storage.from("chat-files").upload(path, file);
    const { data } = supabase.storage.from("chat-files").getPublicUrl(path);

    await supabase.from("messages").insert({
      chat_id: chatId,
      sender_id: me.id,
      file_url: data.publicUrl,
      file_name: file.name,
      file_type: file.type,
    });
  };

  /* ---------- CALL ---------- */
  const startCall = async (type) => {
    setCallType(type);
    setInCall(true);

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === "video",
    });

    localStreamRef.current = stream;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pcRef.current = pc;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    pc.ontrack = (e) => {
      remoteVideoRef.current.srcObject = e.streams[0];
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await supabase.from("call_signals").insert({
      chat_id: chatId,
      sender_id: me.id,
      receiver_id: userId,
      type: "offer",
      data: { ...offer, callType: type },
    });
  };

  const subscribeCalls = (cid) => {
    supabase
      .channel("calls-" + cid)
      .on(
        "postgres_changes",
        { event: "INSERT", table: "call_signals", filter: `chat_id=eq.${cid}` },
        async ({ new: s }) => {
          if (s.sender_id === me.id) return;

          if (s.type === "offer") {
            setIncomingCall(s);
            setCallType(s.data.callType);
            notify("Incoming Call", "Tap to answer");
          }

          if (s.type === "answer") {
            await pcRef.current?.setRemoteDescription(s.data);
          }

          if (s.type === "end") endCall(false);
        }
      )
      .subscribe();
  };

  const acceptCall = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callType === "video",
    });

    localStreamRef.current = stream;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pcRef.current = pc;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    pc.ontrack = (e) => {
      remoteVideoRef.current.srcObject = e.streams[0];
    };

    await pc.setRemoteDescription(incomingCall.data);
    const ans = await pc.createAnswer();
    await pc.setLocalDescription(ans);

    await supabase.from("call_signals").insert({
      chat_id: chatId,
      sender_id: me.id,
      receiver_id: incomingCall.sender_id,
      type: "answer",
      data: ans,
    });

    setIncomingCall(null);
    setInCall(true);
  };

  const endCall = async (notifyOther = true) => {
    pcRef.current?.close();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    setInCall(false);

    if (notifyOther) {
      await supabase.from("call_signals").insert({
        chat_id: chatId,
        sender_id: me.id,
        receiver_id: userId,
        type: "end",
      });
    }
  };

  /* ---------- STATUS ---------- */
  const loadStatus = async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("status")
      .select("*")
      .gte("created_at", since);
    setStatuses(data || []);
  };

  const uploadStatus = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const path = `status/${me.id}-${Date.now()}`;
    await supabase.storage.from("chat-files").upload(path, file);
    const { data } = supabase.storage.from("chat-files").getPublicUrl(path);

    await supabase.from("status").insert({
      user_id: me.id,
      content: data.publicUrl,
    });

    loadStatus();
  };

  /* ---------- UI ---------- */
  return (
    <div style={styles.container}>
      <div style={styles.statusBar}>
        <button onClick={() => statusInputRef.current.click()}>➕ My Status</button>
        <input type="file" hidden ref={statusInputRef} onChange={uploadStatus} />
        {statuses.map((s) => (
          <img key={s.id} src={s.content} style={styles.statusImg} />
        ))}
      </div>

      <div style={styles.header}>
        <span>Chat</span>
        <div>
          <button onClick={() => startCall("audio")}>📞</button>
          <button onClick={() => startCall("video")}>🎥</button>
        </div>
      </div>

      <div style={styles.messages}>
        {messages.map((m) => {
          const isMe = m.sender_id === me?.id;
          return (
            <div
              key={m.id}
              style={{
                ...styles.bubble,
                alignSelf: isMe ? "flex-end" : "flex-start",
                background: isMe ? "#dcf8c6" : "#fff",
              }}
            >
              {m.file_url ? (
                m.file_type?.startsWith("image") ? (
                  <img src={m.file_url} style={{ maxWidth: 220, borderRadius: 8 }} />
                ) : (
                  <a href={m.file_url} target="_blank" rel="noreferrer">
                    📎 {m.file_name}
                  </a>
                )
              ) : (
                <span>{getMessageText(m)}</span>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div style={styles.inputBar}>
        <button onClick={() => fileInputRef.current.click()}>📎</button>
        <input type="file" hidden ref={fileInputRef} onChange={handleFileUpload} />
        <input value={text} onChange={(e) => setText(e.target.value)} />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}

/* ================= STYLES ================= */
const styles = {
  container: { height: "100vh", display: "flex", flexDirection: "column", background: "#ece5dd" },
  header: { background: "#075E54", color: "#fff", padding: 10, display: "flex", justifyContent: "space-between" },
  statusBar: { padding: 8, background: "#f0f0f0", display: "flex", gap: 8 },
  statusImg: { width: 45, height: 45, borderRadius: "50%", border: "2px solid green" },
  messages: { flex: 1, padding: 10, display: "flex", flexDirection: "column", gap: 6, overflowY: "auto" },
  bubble: { padding: "8px 12px", borderRadius: 10, maxWidth: "70%" },
  inputBar: { display: "flex", gap: 6, padding: 8, background: "#fff" },
};
