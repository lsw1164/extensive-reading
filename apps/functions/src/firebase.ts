import { App, cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { Firestore, getFirestore } from "firebase-admin/firestore";

let firestoreDb: Firestore | undefined;

const initFirebaseApp = (): App => {
  const apps = getApps();
  if (apps.length > 0) {
    return getApp();
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    return initializeApp({
      credential: cert(serviceAccount)
    });
  }

  return initializeApp();
};

export const getDb = (): Firestore => {
  if (!firestoreDb) {
    firestoreDb = getFirestore(initFirebaseApp());
    firestoreDb.settings({ ignoreUndefinedProperties: true });
  }

  return firestoreDb;
};
