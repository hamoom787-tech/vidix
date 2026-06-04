import { createUserWithEmailAndPassword, deleteUser, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "./firebase-config";
import { apiRequest } from "./api/backend-client";
import { assertFundPassword, assertReferralCode } from "./utils/validators";

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

    await apiRequest("/auth/complete-registration", {
      body: {
      referralCode,
      phone,
      displayName,
        fundPassword: secureFundPassword,
        authProvider: "email"
      }
    });

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
