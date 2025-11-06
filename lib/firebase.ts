// lib/firebase.js
import { initializeApp,getApps,getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDMEgdIWVbwRBmo6mvqFbY4Mjbl5OgHBfs",
    authDomain: "tamfuyin-project.firebaseapp.com",
    projectId: "tamfuyin-project",
    storageBucket: "tamfuyin-project.firebasestorage.app",
    messagingSenderId: "148865347259",
    appId: "1:148865347259:web:8932f739908fa3565c839e",
    measurementId: "G-GLKYCP75EH"
};

const app = getApps().length ? getApp(): initializeApp(firebaseConfig);
export const db = getFirestore(app);