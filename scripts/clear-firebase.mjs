import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  writeBatch, 
  doc 
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA58SHYzE3wjFFqg0X4iXcEN0UqjDSX5bE",
  authDomain: "incubator-ta.firebaseapp.com",
  projectId: "incubator-ta",
  storageBucket: "incubator-ta.firebasestorage.app",
  messagingSenderId: "727103641910",
  appId: "1:727103641910:web:feeecc3cc249eca15b3b97",
  measurementId: "G-B4M7D0KSQ0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function clearCollection(collName) {
  console.log(`Mengambil data dari koleksi '${collName}'...`);
  const collRef = collection(db, collName);
  const snapshot = await getDocs(collRef);
  
  const total = snapshot.size;
  console.log(`Ditemukan ${total} dokumen di '${collName}'.`);
  
  if (total === 0) {
    console.log(`Koleksi '${collName}' sudah kosong.`);
    return;
  }
  
  let deletedCount = 0;
  const docs = snapshot.docs;
  const CHUNK_SIZE = 400; // batas batch Firestore adalah 500
  
  for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
    const chunk = docs.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    
    for (const d of chunk) {
      batch.delete(doc(db, collName, d.id));
    }
    
    await batch.commit();
    deletedCount += chunk.length;
    console.log(`Berhasil menghapus ${deletedCount}/${total} dokumen...`);
  }
  
  console.log(`Selesai! Seluruh data di '${collName}' (${total} dokumen) telah dihapus.`);
}

async function run() {
  try {
    await clearCollection("sensor_data");
    process.exit(0);
  } catch (err) {
    console.error("Gagal menghapus data:", err);
    process.exit(1);
  }
}

run();
