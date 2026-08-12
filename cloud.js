import { firebaseConfig, firebaseSdkVersion } from './firebase-config.js';
const sdk = m => `https://www.gstatic.com/firebasejs/${firebaseSdkVersion}/${m}.js`;
let api=null;
export async function connectCloud(){
  const [appMod,authMod,fsMod]=await Promise.all([import(sdk('firebase-app')),import(sdk('firebase-auth')),import(sdk('firebase-firestore'))]);
  const app=appMod.initializeApp(firebaseConfig), auth=authMod.getAuth(app), db=fsMod.getFirestore(app);
  await authMod.setPersistence(auth,authMod.browserLocalPersistence);
  api={appMod,authMod,fsMod,auth,db}; return api;
}
export function onAuth(cb){ return api.authMod.onAuthStateChanged(api.auth,cb); }
export async function googleSignIn(){ return api.authMod.signInWithPopup(api.auth,new api.authMod.GoogleAuthProvider()); }
export async function emailSignIn(email,password){ return api.authMod.signInWithEmailAndPassword(api.auth,email,password); }
export async function emailCreate(email,password){ return api.authMod.createUserWithEmailAndPassword(api.auth,email,password); }
export async function signOutCloud(){ return api.authMod.signOut(api.auth); }
export async function loadCloudState(){
  const u=api.auth.currentUser;if(!u)return null;const ref=api.fsMod.doc(api.db,'players',u.uid);const snap=await api.fsMod.getDoc(ref);return snap.exists()?snap.data():null;
}
export async function saveCloudState(state){
  const u=api.auth.currentUser;if(!u)return;const ref=api.fsMod.doc(api.db,'players',u.uid);await api.fsMod.setDoc(ref,state,{merge:false});
}
