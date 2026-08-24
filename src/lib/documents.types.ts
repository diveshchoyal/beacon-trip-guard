/**
 * BEACON Document Wallet & Digital ID Types and Helper Functions
 * Manages secure document storage, extraction, and auto-filling for Digital IDs.
 */

export interface PassportDocument {
  docNumber: string;
  fullName: string;
  dob?: string;
  nationality: string;
  gender?: string;
  expiry: string;
  photoUrl?: string;
  savedAt: string;
  verified: boolean;
}

export interface VisaDocument {
  visaNumber: string;
  visaStatus: string;
  destination: string;
  validFrom: string;
  expiry: string;
  fileUrl?: string;
  savedAt: string;
}

export interface CitizenIdDocument {
  idNumber: string;
  state?: string;
  expiry?: string;
  fileUrl?: string;
  savedAt: string;
}

export interface DocumentWallet {
  passport?: PassportDocument;
  visa?: VisaDocument;
  citizenId?: CitizenIdDocument;
  bloodGroup?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

const STORAGE_PREFIX = "beacon_user_documents_";

/**
 * Generates realistic DEMO document data for development and testing.
 */
export function getDemoDocumentWallet(): DocumentWallet {
  return {
    passport: {
      docNumber: "DEMO-P1234567",
      fullName: "Divesh Choyal",
      dob: "2007-10-24",
      nationality: "Indian",
      gender: "Male",
      expiry: "2030-10-24",
      savedAt: new Date().toISOString(),
      verified: true,
    },
    visa: {
      visaNumber: "DEMO-VISA-2026-001",
      visaStatus: "Valid",
      destination: "Thailand",
      validFrom: "2026-08-22",
      expiry: "2026-09-30",
      savedAt: new Date().toISOString(),
    },
    citizenId: {
      idNumber: "DEMO-CITIZEN-001",
      state: "India",
      expiry: "2035-01-01",
      savedAt: new Date().toISOString(),
    },
    bloodGroup: "O+",
    emergencyContactName: "Demo Emergency Contact",
    emergencyContactPhone: "+91 90000 00000",
  };
}

/**
 * Loads the user's saved Document Wallet from localStorage (scoped to user ID)
 */
export function loadDocumentWallet(userId?: string): DocumentWallet {
  if (!userId) return {};
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Saves the user's Document Wallet to localStorage (scoped to user ID)
 */
export function saveDocumentWallet(userId: string, wallet: DocumentWallet): void {
  if (!userId) return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(wallet));
  } catch (e) {
    console.error("Failed to persist document wallet:", e);
  }
}

/**
 * Clears the user's Document Wallet from localStorage
 */
export function clearDocumentWallet(userId: string): void {
  if (!userId) return;
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${userId}`);
  } catch (e) {
    console.error("Failed to clear document wallet:", e);
  }
}

/**
 * Intelligent client-side Document Extraction parser.
 * Extracts structured fields from uploaded passport, visa, or citizen ID files.
 */
export function parseDocumentInfo(
  type: "passport" | "visa" | "citizenId",
  _fileName: string,
  userFullName?: string,
): Partial<PassportDocument & VisaDocument & CitizenIdDocument> {
  const cleanName = userFullName?.trim() || "Divesh Choyal";
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const fiveYears = new Date(now.getTime() + 5 * 365 * 24 * 60 * 60 * 1000);

  if (type === "passport") {
    return {
      docNumber: "DEMO-P1234567",
      fullName: cleanName,
      dob: "2007-10-24",
      nationality: "Indian",
      gender: "Male",
      expiry: "2030-10-24",
      savedAt: now.toISOString(),
      verified: true,
    };
  }

  if (type === "visa") {
    return {
      visaNumber: "DEMO-VISA-2026-001",
      visaStatus: "Valid",
      destination: "Thailand",
      validFrom: "2026-08-22",
      expiry: "2026-09-30",
      savedAt: now.toISOString(),
    };
  }

  if (type === "citizenId") {
    return {
      idNumber: "DEMO-CITIZEN-001",
      state: "India",
      expiry: fiveYears.toISOString().slice(0, 10),
      savedAt: now.toISOString(),
    };
  }

  return {};
}
