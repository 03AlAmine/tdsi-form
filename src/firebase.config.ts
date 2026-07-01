import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { environment } from './environments/environment';

const app = initializeApp(environment.firebase);

// ✅ ignoreUndefinedProperties: true — évite que addDoc()/setDoc()/updateDoc()
// lèvent une exception "Unsupported field value: undefined" quand un objet
// envoyé à Firestore contient une propriété undefined (ex: un champ de
// formulaire dynamique non rempli). Firestore omettra simplement ce champ
// au lieu de planter, ce qui correspond au comportement attendu par les
// formulaires de présence et autres formulaires optionnels de l'app.
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
export const auth = getAuth(app);
