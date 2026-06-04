import { createUserWithEmailAndPassword, deleteUser, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "./firebase-config";
import { assertFundPassword, assertReferralCode } from "./utils/validators";

const completeRegistration = httpsCallable(functions, "completeRegistration");
const setFundPassword = httpsCallable(functions, "setFundPassword");

export async function registerNewUser({
  email,
  password,
  displayName = "",
  phone = "",
  invitationCode,
  fundPassword
}) {
  const referralCode = assertReferralCode(invitationCode);
  const secureFundPassword = assertFundPassword(fundPassword);
  const credential = await createUserWithEmailAndPassword(auth, email, password);

  try {
    if (displayName) {
      await updateProfile(credential.user, { displayName });
    }

    // The user document is created by Cloud Functions, not directly by the client.
    // This keeps `users/{uid}.balances`, `vipLevel`, and referral fields protected by security rules.
    await completeRegistration({
      referralCode,
      phone,
      displayName,
      authProvider: "email"
    });

    await setFundPassword({ fundPassword: secureFundPassword });
    return credential.user;
  } catch (error) {
    await deleteUser(credential.user).catch(() => {});
    throw error;
  }
}

export async function loginUser({ email, password }) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}
