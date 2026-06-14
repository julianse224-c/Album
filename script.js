/* =========================================================
   NUESTRO ÁLBUM — lógica
   Usa Firebase (Firestore + Storage) para que las fotos y
   notas se guarden compartidas y se vean desde cualquier
   celular, sin tocar este código nunca más.

   👉 Sigue INSTRUCCIONES.md para crear tu proyecto gratuito
      de Firebase y pegar tus datos abajo, en firebaseConfig.
   ========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  deleteDoc,
  doc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// =========================================================
// 1) PEGA AQUÍ TU CONFIGURACIÓN DE FIREBASE
//    (la obtienes en la consola de Firebase, ver INSTRUCCIONES.md)
// =========================================================
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const entriesRef = collection(db, "entries");

// =========================================================
// Referencias al DOM
// =========================================================
const form = document.getElementById("uploadForm");
const photoInput = document.getElementById("photoInput");
const fileLabel = document.getElementById("fileLabel");
const previewImg = document.getElementById("previewImg");
const noteInput = document.getElementById("noteInput");
const dateInput = document.getElementById("dateInput");
const specialInput = document.getElementById("specialInput");
const submitBtn = document.getElementById("submitBtn");
const submitText = submitBtn.querySelector(".btn-submit__text");
const submitSpinner = submitBtn.querySelector(".btn-submit__spinner");
const uploadStatus = document.getElementById("uploadStatus");

const galleryGrid = document.getElementById("galleryGrid");
const emptyMessage = document.getElementById("emptyMessage");
const specialsSection = document.getElementById("specialsSection");
const specialsTrack = document.getElementById("specialsTrack");
const counter = document.getElementById("counter");

const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImg");
const lightboxDate = document.getElementById("lightboxDate");
const lightboxNote = document.getElementById("lightboxNote");
const lightboxDelete = document.getElementById("lightboxDelete");
const lightboxClose = document.getElementById("lightboxClose");

// Fecha de hoy como valor por defecto en el formulario
dateInput.valueAsDate = new Date();

// =========================================================
// Previsualización de la foto elegida
// =========================================================
photoInput.addEventListener("change", () => {
  const file = photoInput.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  previewImg.src = url;
  previewImg.hidden = false;
  fileLabel.hidden = true;
});

// =========================================================
// Comprimir imagen antes de subirla (más rápido y liviano)
// =========================================================
function compressImage(file, maxDimension = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => (img.src = e.target.result);
    reader.onerror = reject;

    img.onload = () => {
      let { width, height } = img;

      if (width > height && width > maxDimension) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else if (height > maxDimension) {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo comprimir la imagen"))),
        "image/jpeg",
        quality
      );
    };

    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// =========================================================
// Subir nueva página del álbum
// =========================================================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const file = photoInput.files[0];
  const note = noteInput.value.trim();
  const date = dateInput.value;
  const special = specialInput.checked;

  if (!file || !note || !date) return;

  setLoading(true);
  setStatus("Subiendo tu recuerdo...", false);

  try {
    const compressedBlob = await compressImage(file);

    const filePath = `photos/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
    const storageRef = ref(storage, filePath);
    await uploadBytes(storageRef, compressedBlob, { contentType: "image/jpeg" });
    const url = await getDownloadURL(storageRef);

    await addDoc(entriesRef, {
      url,
      storagePath: filePath,
      note,
      date,
      special,
      createdAt: serverTimestamp(),
    });

    setStatus("¡Página guardada! 💌", false);
    resetForm();
  } catch (err) {
    console.error(err);
    setStatus("Ups, algo falló al subir la foto. Intenta de nuevo.", true);
  } finally {
    setLoading(false);
  }
});

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitSpinner.hidden = !isLoading;
  submitText.textContent = isLoading ? "Guardando..." : "Guardar en el álbum";
}

function setStatus(message, isError) {
  uploadStatus.textContent = message;
  uploadStatus.classList.toggle("error", isError);
}

function resetForm() {
  form.reset();
  dateInput.valueAsDate = new Date();
  previewImg.hidden = true;
  previewImg.src = "";
  fileLabel.hidden = false;
  setTimeout(() => setStatus("", false), 4000);
}

// =========================================================
// Escuchar el álbum en tiempo real y renderizarlo
// =========================================================
const albumQuery = query(entriesRef, orderBy("date", "desc"));

onSnapshot(
  albumQuery,
  (snapshot) => {
    const entries = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderGallery(entries);
    renderSpecials(entries);
    renderCounter(entries.length);
  },
  (err) => {
    console.error(err);
    emptyMessage.textContent =
      "No se pudo conectar con el álbum. Revisa la configuración de Firebase en script.js.";
    emptyMessage.hidden = false;
  }
);

function renderCounter(total) {
  if (total === 0) {
    counter.textContent = "Cada foto, una página más de nuestra historia.";
  } else if (total === 1) {
    counter.textContent = "1 recuerdo guardado... ¡el primero de muchos!";
  } else {
    counter.textContent = `${total} recuerdos guardados juntos 🤍`;
  }
}

function renderGallery(entries) {
  galleryGrid.innerHTML = "";
  emptyMessage.hidden = entries.length > 0;

  entries.forEach((entry) => {
    const card = document.createElement("article");
    card.className = "polaroid";
    card.innerHTML = `
      ${entry.special ? '<span class="polaroid__special">✨</span>' : ""}
      <img class="polaroid__photo" src="${entry.url}" alt="" loading="lazy" />
      <p class="polaroid__date">${formatDate(entry.date)}</p>
      <p class="polaroid__note">${escapeHtml(entry.note)}</p>
    `;
    card.addEventListener("click", () => openLightbox(entry));
    galleryGrid.appendChild(card);
  });
}

function renderSpecials(entries) {
  const specials = entries.filter((e) => e.special);
  specialsSection.hidden = specials.length === 0;
  specialsTrack.innerHTML = "";

  specials.forEach((entry) => {
    const card = document.createElement("div");
    card.className = "special-card";
    card.innerHTML = `
      <img src="${entry.url}" alt="" loading="lazy" />
      <span class="special-card__badge">✨</span>
    `;
    card.addEventListener("click", () => openLightbox(entry));
    specialsTrack.appendChild(card);
  });
}

// =========================================================
// Lightbox (ver y eliminar una página)
// =========================================================
let activeEntry = null;

function openLightbox(entry) {
  activeEntry = entry;
  lightboxImg.src = entry.url;
  lightboxDate.textContent = formatDate(entry.date);
  lightboxNote.textContent = entry.note;
  lightbox.hidden = false;
}

function closeLightbox() {
  lightbox.hidden = true;
  activeEntry = null;
}

lightboxClose.addEventListener("click", closeLightbox);
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) closeLightbox();
});

lightboxDelete.addEventListener("click", async () => {
  if (!activeEntry) return;
  const ok = confirm("¿Eliminar esta página del álbum? No se puede deshacer.");
  if (!ok) return;

  try {
    await deleteDoc(doc(db, "entries", activeEntry.id));
    if (activeEntry.storagePath) {
      await deleteObject(ref(storage, activeEntry.storagePath)).catch(() => {});
    }
    closeLightbox();
  } catch (err) {
    console.error(err);
    alert("No se pudo eliminar. Intenta de nuevo.");
  }
});

// =========================================================
// Utilidades
// =========================================================
function formatDate(isoDate) {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-");
  const months = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic",
  ];
  return `${day} ${months[parseInt(month, 10) - 1]} ${year}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}