import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import {
  getFirestore, collection, doc, setDoc, addDoc, query, orderBy,
  onSnapshot, serverTimestamp, getDoc
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = id => document.getElementById(id);
let currentRoom = null;
let unsubscribeMessages = null;
let unsubscribeMembers = null;

$("signupBtn").onclick = async () => {
  try {
    await createUserWithEmailAndPassword(auth, $("email").value, $("password").value);
    $("authStatus").textContent = "Account created.";
  } catch(e) { $("authStatus").textContent = e.message; }
};

$("loginBtn").onclick = async () => {
  try {
    await signInWithEmailAndPassword(auth, $("email").value, $("password").value);
  } catch(e) { $("authStatus").textContent = e.message; }
};

$("logoutBtn").onclick = () => signOut(auth);

onAuthStateChanged(auth, async user => {
  $("authView").classList.toggle("hidden", !!user);
  $("appView").classList.toggle("hidden", !user);
  if (user) $("userLabel").textContent = user.email;
});

$("createRoomBtn").onclick = async () => {
  if (!auth.currentUser) return;
  const id = Math.random().toString(36).slice(2, 8).toUpperCase();
  await setDoc(doc(db, "rooms", id), {
    ownerId: auth.currentUser.uid,
    createdAt: serverTimestamp()
  });
  $("roomId").value = id;
  await joinRoom(id);
};

$("joinRoomBtn").onclick = () => joinRoom($("roomId").value.trim().toUpperCase());

async function joinRoom(id) {
  if (!id || !auth.currentUser) return;
  const room = await getDoc(doc(db, "rooms", id));
  if (!room.exists()) {
    $("roomStatus").textContent = "Room not found.";
    return;
  }
  currentRoom = id;
  await setDoc(doc(db, "rooms", id, "members", auth.currentUser.uid), {
    email: auth.currentUser.email,
    joinedAt: serverTimestamp()
  });
  $("roomStatus").textContent = "Joined room: " + id;

  unsubscribeMessages?.();
  unsubscribeMembers?.();

  const mq = query(collection(db, "rooms", id, "messages"), orderBy("createdAt"));
  unsubscribeMessages = onSnapshot(mq, snap => {
    $("messages").innerHTML = "";
    snap.forEach(d => {
      const m = d.data();
      const el = document.createElement("div");
      el.className = "msg";
      el.innerHTML = `<b>${escapeHtml(m.email || "User")}</b>${escapeHtml(m.text || "")}`;
      $("messages").appendChild(el);
    });
    $("messages").scrollTop = $("messages").scrollHeight;
  });

  unsubscribeMembers = onSnapshot(collection(db, "rooms", id, "members"), snap => {
    $("members").innerHTML = "";
    snap.forEach(d => {
      const el = document.createElement("div");
      el.textContent = d.data().email || d.id;
      $("members").appendChild(el);
    });
  });
}

$("sendBtn").onclick = async () => {
  const text = $("messageInput").value.trim();
  if (!currentRoom || !text || !auth.currentUser) return;
  await addDoc(collection(db, "rooms", currentRoom, "messages"), {
    uid: auth.currentUser.uid,
    email: auth.currentUser.email,
    text,
    createdAt: serverTimestamp()
  });
  $("messageInput").value = "";
};

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}
