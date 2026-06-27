import {
  collection,
  doc,
  setDoc,
  addDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  getDocs,
  query,
  where,
  writeBatch,
  deleteField,
  DocumentData,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import { getCycleBounds, getCycleId, getCycleTitle } from "./cycle-utils";
import { EncryptedPayload, decryptForUser, encryptForUser, hasEncryptedPayload } from "./crypto";

export interface TransactionData {
  id?: string;
  userId: string;
  transactionName: string;
  amount: number;
  deposit: number;
  owner: string;
  transactionDate: Date;
  cycleId: string;
  deleted?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  encryptedPayload?: EncryptedPayload;
}

export interface StatementCycleData {
  id: string;
  userId: string;
  startDate: Date;
  endDate: Date;
  title: string;
  year: number;
  status: "OPEN" | "CLOSED";
  createdAt?: Timestamp;
  encryptedPayload?: EncryptedPayload;
}

interface EncryptedTransactionPayload {
  transactionName: string;
  amount: number;
  deposit: number;
  owner: string;
  transactionDate: string;
}

interface EncryptedStatementPayload {
  startDate: string;
  endDate: string;
  title: string;
  year: number;
  status: "OPEN" | "CLOSED";
}

function toDate(value: unknown) {
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (value && typeof value === "object" && "seconds" in value) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  if (typeof value === "string") return new Date(value);
  return new Date();
}

async function encryptTransactionPayload(userId: string, data: Omit<TransactionData, "userId" | "cycleId">) {
  return encryptForUser<EncryptedTransactionPayload>(userId, {
    transactionName: data.transactionName,
    amount: Number(data.amount),
    deposit: Number(data.deposit) || 0,
    owner: data.owner,
    transactionDate: data.transactionDate.toISOString(),
  });
}

async function encryptStatementPayload(userId: string, data: Omit<StatementCycleData, "userId" | "id" | "createdAt">) {
  return encryptForUser<EncryptedStatementPayload>(userId, {
    startDate: data.startDate.toISOString(),
    endDate: data.endDate.toISOString(),
    title: data.title,
    year: data.year,
    status: data.status,
  });
}

export async function decryptTransactionDoc(
  data: DocumentData,
  fallbackId?: string
): Promise<TransactionData> {
  if (hasEncryptedPayload(data)) {
    const encryptedDoc = data as DocumentData & { encryptedPayload: EncryptedPayload };
    const payload = await decryptForUser<EncryptedTransactionPayload>(encryptedDoc.userId, encryptedDoc.encryptedPayload);
    return {
      id: encryptedDoc.id || fallbackId,
      userId: encryptedDoc.userId,
      transactionName: payload.transactionName,
      amount: Number(payload.amount),
      deposit: Number(payload.deposit) || 0,
      owner: payload.owner,
      transactionDate: toDate(payload.transactionDate),
      cycleId: encryptedDoc.cycleId,
      deleted: encryptedDoc.deleted,
      createdAt: encryptedDoc.createdAt,
      updatedAt: encryptedDoc.updatedAt,
      encryptedPayload: encryptedDoc.encryptedPayload,
    };
  }

  return {
    id: data.id || fallbackId,
    userId: data.userId,
    transactionName: data.transactionName,
    amount: Number(data.amount),
    deposit: Number(data.deposit) || 0,
    owner: data.owner,
    transactionDate: toDate(data.transactionDate),
    cycleId: data.cycleId,
    deleted: data.deleted,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function decryptStatementCycleDoc(
  data: DocumentData,
  fallbackId?: string
): Promise<StatementCycleData> {
  if (hasEncryptedPayload(data)) {
    const encryptedDoc = data as DocumentData & { encryptedPayload: EncryptedPayload };
    const payload = await decryptForUser<EncryptedStatementPayload>(encryptedDoc.userId, encryptedDoc.encryptedPayload);
    return {
      id: encryptedDoc.id || fallbackId,
      userId: encryptedDoc.userId,
      startDate: toDate(payload.startDate),
      endDate: toDate(payload.endDate),
      title: payload.title,
      year: Number(payload.year),
      status: payload.status,
      createdAt: encryptedDoc.createdAt,
      encryptedPayload: encryptedDoc.encryptedPayload,
    };
  }

  return {
    id: data.id || fallbackId,
    userId: data.userId,
    startDate: toDate(data.startDate),
    endDate: toDate(data.endDate),
    title: data.title,
    year: Number(data.year),
    status: data.status,
    createdAt: data.createdAt,
  };
}

function deleteTransactionPlainFields() {
  return {
    transactionName: deleteField(),
    amount: deleteField(),
    deposit: deleteField(),
    owner: deleteField(),
    transactionDate: deleteField(),
  };
}

function deleteStatementPlainFields() {
  return {
    startDate: deleteField(),
    endDate: deleteField(),
    title: deleteField(),
    year: deleteField(),
    status: deleteField(),
  };
}

async function migrateTransactionDoc(batch: ReturnType<typeof writeBatch>, docSnap: QueryDocumentSnapshot<DocumentData>) {
  const data = docSnap.data();
  if (hasEncryptedPayload(data)) return;
  const tx = await decryptTransactionDoc(data, docSnap.id);
  const encryptedPayload = await encryptTransactionPayload(tx.userId, tx);
  batch.update(docSnap.ref, {
    id: tx.id || docSnap.id,
    userId: tx.userId,
    cycleId: tx.cycleId,
    deleted: tx.deleted || false,
    encryptedPayload,
    encryptionVersion: 1,
    updatedAt: serverTimestamp(),
    ...deleteTransactionPlainFields(),
  });
}

async function migrateStatementDoc(batch: ReturnType<typeof writeBatch>, docSnap: QueryDocumentSnapshot<DocumentData>) {
  const data = docSnap.data();
  if (hasEncryptedPayload(data)) return;
  const cycle = await decryptStatementCycleDoc(data, docSnap.id);
  const encryptedPayload = await encryptStatementPayload(cycle.userId, cycle);
  batch.update(docSnap.ref, {
    id: cycle.id || docSnap.id,
    userId: cycle.userId,
    encryptedPayload,
    encryptionVersion: 1,
    ...deleteStatementPlainFields(),
  });
}

export async function migrateLegacyPlaintextData(userId: string): Promise<void> {
  const batch = writeBatch(db);
  let hasChanges = false;

  const txSnap = await getDocs(query(collection(db, "transactions"), where("userId", "==", userId)));
  for (const docSnap of txSnap.docs) {
    if (!hasEncryptedPayload(docSnap.data())) {
      await migrateTransactionDoc(batch, docSnap);
      hasChanges = true;
    }
  }

  const cycleSnap = await getDocs(query(collection(db, "statementCycles"), where("userId", "==", userId)));
  for (const docSnap of cycleSnap.docs) {
    if (!hasEncryptedPayload(docSnap.data())) {
      await migrateStatementDoc(batch, docSnap);
      hasChanges = true;
    }
  }

  if (hasChanges) {
    await batch.commit();
  }
}

export async function getOrCreateCycle(userId: string, date: Date, cycleStartDay?: number): Promise<string> {
  const { startDate, endDate } = getCycleBounds(date, cycleStartDay);
  const cycleIdKey = getCycleId(startDate);
  const fullCycleId = `${userId}_${cycleIdKey}`;
  const cyclePayload: StatementCycleData = {
    id: fullCycleId,
    userId,
    startDate,
    endDate,
    title: getCycleTitle(startDate, endDate),
    year: startDate.getFullYear(),
    status: "OPEN",
  };

  const encryptedPayload = await encryptStatementPayload(userId, cyclePayload);
  const cycleDocRef = doc(db, "statementCycles", fullCycleId);
  const storedPayload = {
    id: fullCycleId,
    userId,
    encryptedPayload,
    encryptionVersion: 1,
    createdAt: serverTimestamp(),
  };

  try {
    const cycleSnap = await getDoc(cycleDocRef);

    if (!cycleSnap.exists()) {
      await setDoc(cycleDocRef, storedPayload);
    } else if (!hasEncryptedPayload(cycleSnap.data())) {
      await setDoc(cycleDocRef, {
        ...storedPayload,
        createdAt: cycleSnap.data().createdAt || serverTimestamp(),
        ...deleteStatementPlainFields(),
      }, { merge: true });
    }
  } catch (error) {
    const err = error as { code?: string; message?: string };
    if (err.code === "permission-denied") {
      await setDoc(cycleDocRef, storedPayload);
      return fullCycleId;
    }

    if (err.code === "unavailable" || err.message?.includes("offline")) {
      console.warn("Firestore offline: Calculated cycle ID returned without server validation.");
      try {
        await setDoc(cycleDocRef, storedPayload, { merge: true });
      } catch (writeError) {
        console.error("Failed to write offline cycle:", writeError);
      }
    } else {
      throw error;
    }
  }

  return fullCycleId;
}

export async function addTransaction(
  userId: string,
  data: Omit<TransactionData, "userId" | "cycleId">,
  cycleStartDay?: number
): Promise<string> {
  const fullCycleId = await getOrCreateCycle(userId, data.transactionDate, cycleStartDay);

  const cycleDocRef = doc(db, "statementCycles", fullCycleId);
  try {
    const cycleSnap = await getDoc(cycleDocRef);
    if (cycleSnap.exists()) {
      const cycle = await decryptStatementCycleDoc(cycleSnap.data(), cycleSnap.id);
      if (cycle.status === "CLOSED") {
        throw new Error("Cannot add transactions to a closed statement cycle.");
      }
    }
  } catch (error) {
    const err = error as { code?: string; message?: string };
    if (err.code === "unavailable" || err.message?.includes("offline")) {
      console.warn("Firestore offline: Assuming statement cycle is OPEN for transaction add.");
    } else {
      throw error;
    }
  }

  const transactionsCol = collection(db, "transactions");
  const docRef = await addDoc(transactionsCol, {
    userId,
    cycleId: fullCycleId,
    deleted: false,
    encryptedPayload: await encryptTransactionPayload(userId, data),
    encryptionVersion: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await updateDoc(docRef, { id: docRef.id });
  return docRef.id;
}

export async function updateTransaction(
  userId: string,
  transactionId: string,
  data: Omit<TransactionData, "userId" | "cycleId" | "id">,
  cycleStartDay?: number
): Promise<void> {
  const txRef = doc(db, "transactions", transactionId);
  let oldCycleId: string;

  try {
    const txSnap = await getDoc(txRef);
    if (!txSnap.exists()) {
      throw new Error("Transaction does not exist.");
    }
    const oldTx = await decryptTransactionDoc(txSnap.data(), txSnap.id);
    oldCycleId = oldTx.cycleId;
  } catch (error) {
    const err = error as { code?: string; message?: string };
    if (err.code === "unavailable" || err.message?.includes("offline")) {
      console.warn("Firestore offline: Reading cached transaction or assuming default cycle.");
      oldCycleId = await getOrCreateCycle(userId, data.transactionDate, cycleStartDay);
    } else {
      throw error;
    }
  }

  const oldCycleDocRef = doc(db, "statementCycles", oldCycleId);
  try {
    const oldCycleSnap = await getDoc(oldCycleDocRef);
    if (oldCycleSnap.exists()) {
      const oldCycle = await decryptStatementCycleDoc(oldCycleSnap.data(), oldCycleSnap.id);
      if (oldCycle.status === "CLOSED") {
        throw new Error("Cannot modify transactions in a closed statement cycle.");
      }
    }
  } catch (error) {
    const err = error as { code?: string; message?: string };
    if (err.code === "unavailable" || err.message?.includes("offline")) {
      console.warn("Firestore offline: Assuming old statement cycle is OPEN.");
    } else {
      throw error;
    }
  }

  const newFullCycleId = await getOrCreateCycle(userId, data.transactionDate, cycleStartDay);

  if (newFullCycleId !== oldCycleId) {
    const newCycleDocRef = doc(db, "statementCycles", newFullCycleId);
    try {
      const newCycleSnap = await getDoc(newCycleDocRef);
      if (newCycleSnap.exists()) {
        const newCycle = await decryptStatementCycleDoc(newCycleSnap.data(), newCycleSnap.id);
        if (newCycle.status === "CLOSED") {
          throw new Error("Cannot move transactions to a closed statement cycle.");
        }
      }
    } catch (error) {
      const err = error as { code?: string; message?: string };
      if (err.code === "unavailable" || err.message?.includes("offline")) {
        console.warn("Firestore offline: Assuming new statement cycle is OPEN.");
      } else {
        throw error;
      }
    }
  }

  await updateDoc(txRef, {
    cycleId: newFullCycleId,
    encryptedPayload: await encryptTransactionPayload(userId, data),
    encryptionVersion: 1,
    updatedAt: serverTimestamp(),
    ...deleteTransactionPlainFields(),
  });
}

export async function deleteTransaction(transactionId: string): Promise<void> {
  const txRef = doc(db, "transactions", transactionId);
  let txData: TransactionData;

  try {
    const txSnap = await getDoc(txRef);
    if (!txSnap.exists()) {
      throw new Error("Transaction does not exist.");
    }
    txData = await decryptTransactionDoc(txSnap.data(), txSnap.id);
  } catch (error) {
    const err = error as { code?: string; message?: string };
    if (err.code === "unavailable" || err.message?.includes("offline")) {
      console.warn("Firestore offline: Proceeding with deletion locally.");
      await updateDoc(txRef, {
        deleted: true,
        updatedAt: serverTimestamp(),
      });
      return;
    } else {
      throw error;
    }
  }

  const cycleDocRef = doc(db, "statementCycles", txData.cycleId);
  try {
    const cycleSnap = await getDoc(cycleDocRef);
    if (cycleSnap.exists()) {
      const cycle = await decryptStatementCycleDoc(cycleSnap.data(), cycleSnap.id);
      if (cycle.status === "CLOSED") {
        throw new Error("Cannot delete transactions in a closed statement cycle.");
      }
    }
  } catch (error) {
    const err = error as { code?: string; message?: string };
    if (err.code === "unavailable" || err.message?.includes("offline")) {
      console.warn("Firestore offline: Assuming statement cycle is OPEN for delete.");
    } else {
      throw error;
    }
  }

  await updateDoc(txRef, {
    deleted: true,
    updatedAt: serverTimestamp(),
  });
}

export async function closeCycle(fullCycleId: string): Promise<void> {
  const cycleDocRef = doc(db, "statementCycles", fullCycleId);
  const cycleSnap = await getDoc(cycleDocRef);
  if (!cycleSnap.exists()) {
    throw new Error("Statement cycle does not exist.");
  }
  const cycle = await decryptStatementCycleDoc(cycleSnap.data(), cycleSnap.id);

  await updateDoc(cycleDocRef, {
    encryptedPayload: await encryptStatementPayload(cycle.userId, {
      ...cycle,
      status: "CLOSED",
    }),
    encryptionVersion: 1,
    ...deleteStatementPlainFields(),
  });
}

export async function migrateTransactionsToNewCycleDay(
  userId: string,
  newCycleStartDay: number
): Promise<void> {
  const transactionsCol = collection(db, "transactions");
  const txQuery = query(transactionsCol, where("userId", "==", userId));

  const querySnap = await getDocs(txQuery);
  const batch = writeBatch(db);
  let hasChanges = false;

  for (const docSnap of querySnap.docs) {
    const tx = await decryptTransactionDoc(docSnap.data(), docSnap.id);
    if (tx.deleted) continue;

    const newCycleId = await getOrCreateCycle(userId, tx.transactionDate, newCycleStartDay);

    if (tx.cycleId !== newCycleId || !hasEncryptedPayload(docSnap.data())) {
      batch.update(docSnap.ref, {
        id: tx.id || docSnap.id,
        userId,
        cycleId: newCycleId,
        encryptedPayload: await encryptTransactionPayload(userId, tx),
        encryptionVersion: 1,
        updatedAt: serverTimestamp(),
        ...deleteTransactionPlainFields(),
      });
      hasChanges = true;
    }
  }

  if (hasChanges) {
    await batch.commit();
  }
}
