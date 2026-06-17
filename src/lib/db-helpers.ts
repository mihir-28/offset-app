import {
  collection,
  doc,
  setDoc,
  addDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { getCycleBounds, getCycleId, getCycleTitle } from "./cycle-utils";

export interface TransactionData {
  id?: string;
  userId: string;
  transactionName: string;
  amount: number;
  deposit: number;
  owner: "HOME" | "MINE";
  transactionDate: Date;
  cycleId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface StatementCycleData {
  id: string; // userUid_cycleId (e.g., userXYZ_2026-05-17)
  userId: string;
  startDate: Date;
  endDate: Date;
  title: string;
  year: number;
  status: "OPEN" | "CLOSED";
  createdAt?: Timestamp;
}

/**
 * Gets or creates a statement cycle for a given date in Firestore.
 * Must run inside a transaction or separately.
 */
export async function getOrCreateCycle(userId: string, date: Date): Promise<string> {
  const { startDate, endDate } = getCycleBounds(date);
  const cycleIdKey = getCycleId(startDate);
  const fullCycleId = `${userId}_${cycleIdKey}`;
  const title = getCycleTitle(startDate, endDate);
  const year = startDate.getFullYear();
  const cyclePayload = {
    id: fullCycleId,
    userId,
    startDate: Timestamp.fromDate(startDate),
    endDate: Timestamp.fromDate(endDate),
    title,
    year,
    status: "OPEN",
    createdAt: serverTimestamp(),
  };
  
  const cycleDocRef = doc(db, "statementCycles", fullCycleId);
  try {
    const cycleSnap = await getDoc(cycleDocRef);

    if (!cycleSnap.exists()) {
      await setDoc(cycleDocRef, cyclePayload);
    }
  } catch (error) {
    const err = error as { code?: string; message?: string };
    if (err.code === "permission-denied") {
      await setDoc(cycleDocRef, cyclePayload);
      return fullCycleId;
    }

    if (err.code === "unavailable" || err.message?.includes("offline")) {
      console.warn("Firestore offline: Calculated cycle ID returned without server validation.");
      
      // Queue offline creation
      try {
        await setDoc(cycleDocRef, cyclePayload, { merge: true });
      } catch (writeError) {
        console.error("Failed to write offline cycle:", writeError);
      }
    } else {
      throw error;
    }
  }

  return fullCycleId;
}

/**
 * Adds a new transaction and ensures the correct cycle exists
 */
export async function addTransaction(
  userId: string,
  data: Omit<TransactionData, "userId" | "cycleId">
): Promise<string> {
  // 1. Get or create cycle
  const fullCycleId = await getOrCreateCycle(userId, data.transactionDate);

  // 2. Check if cycle is closed
  const cycleDocRef = doc(db, "statementCycles", fullCycleId);
  try {
    const cycleSnap = await getDoc(cycleDocRef);
    if (cycleSnap.exists() && cycleSnap.data().status === "CLOSED") {
      throw new Error("Cannot add transactions to a closed statement cycle.");
    }
  } catch (error) {
    const err = error as { code?: string; message?: string };
    if (err.code === "unavailable" || err.message?.includes("offline")) {
      console.warn("Firestore offline: Assuming statement cycle is OPEN for transaction add.");
    } else {
      throw error;
    }
  }

  // 3. Add transaction
  const transactionsCol = collection(db, "transactions");
  const docRef = await addDoc(transactionsCol, {
    userId,
    transactionName: data.transactionName,
    amount: data.amount,
    deposit: data.deposit,
    owner: data.owner,
    transactionDate: Timestamp.fromDate(data.transactionDate),
    cycleId: fullCycleId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // 4. Update the transaction ID in the document
  await updateDoc(docRef, { id: docRef.id });
  return docRef.id;
}

/**
 * Updates an existing transaction and moves it to another cycle if date changes.
 */
export async function updateTransaction(
  userId: string,
  transactionId: string,
  data: Omit<TransactionData, "userId" | "cycleId" | "id">
): Promise<void> {
  const txRef = doc(db, "transactions", transactionId);
  let oldCycleId: string;
  
  try {
    const txSnap = await getDoc(txRef);
    if (!txSnap.exists()) {
      throw new Error("Transaction does not exist.");
    }
    const oldTx = txSnap.data() as TransactionData;
    oldCycleId = oldTx.cycleId;
  } catch (error) {
    const err = error as { code?: string; message?: string };
    if (err.code === "unavailable" || err.message?.includes("offline")) {
      console.warn("Firestore offline: Reading cached transaction or assuming default cycle.");
      oldCycleId = await getOrCreateCycle(userId, data.transactionDate);
    } else {
      throw error;
    }
  }
  
  // Verify old cycle is open
  const oldCycleDocRef = doc(db, "statementCycles", oldCycleId);
  try {
    const oldCycleSnap = await getDoc(oldCycleDocRef);
    if (oldCycleSnap.exists() && oldCycleSnap.data().status === "CLOSED") {
      throw new Error("Cannot modify transactions in a closed statement cycle.");
    }
  } catch (error) {
    const err = error as { code?: string; message?: string };
    if (err.code === "unavailable" || err.message?.includes("offline")) {
      console.warn("Firestore offline: Assuming old statement cycle is OPEN.");
    } else {
      throw error;
    }
  }

  // Calculate new cycle if date changed
  const newFullCycleId = await getOrCreateCycle(userId, data.transactionDate);

  // Verify new cycle is open (if date changed)
  if (newFullCycleId !== oldCycleId) {
    const newCycleDocRef = doc(db, "statementCycles", newFullCycleId);
    try {
      const newCycleSnap = await getDoc(newCycleDocRef);
      if (newCycleSnap.exists() && newCycleSnap.data().status === "CLOSED") {
        throw new Error("Cannot move transactions to a closed statement cycle.");
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

  // Update transaction
  await updateDoc(txRef, {
    transactionName: data.transactionName,
    amount: data.amount,
    deposit: data.deposit,
    owner: data.owner,
    transactionDate: Timestamp.fromDate(data.transactionDate),
    cycleId: newFullCycleId,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Deletes a transaction if its statement cycle is open
 */
export async function deleteTransaction(transactionId: string): Promise<void> {
  const txRef = doc(db, "transactions", transactionId);
  let txData: TransactionData;
  
  try {
    const txSnap = await getDoc(txRef);
    if (!txSnap.exists()) {
      throw new Error("Transaction does not exist.");
    }
    txData = txSnap.data() as TransactionData;
  } catch (error) {
    const err = error as { code?: string; message?: string };
    if (err.code === "unavailable" || err.message?.includes("offline")) {
      console.warn("Firestore offline: Proceeding with deletion locally.");
      await deleteDoc(txRef);
      return;
    } else {
      throw error;
    }
  }

  // Verify cycle is open
  const cycleDocRef = doc(db, "statementCycles", txData.cycleId);
  try {
    const cycleSnap = await getDoc(cycleDocRef);
    if (cycleSnap.exists() && cycleSnap.data().status === "CLOSED") {
      throw new Error("Cannot delete transactions in a closed statement cycle.");
    }
  } catch (error) {
    const err = error as { code?: string; message?: string };
    if (err.code === "unavailable" || err.message?.includes("offline")) {
      console.warn("Firestore offline: Assuming statement cycle is OPEN for delete.");
    } else {
      throw error;
    }
  }

  await deleteDoc(txRef);
}

/**
 * Closes (locks) a statement cycle
 */
export async function closeCycle(fullCycleId: string): Promise<void> {
  const cycleDocRef = doc(db, "statementCycles", fullCycleId);
  await updateDoc(cycleDocRef, {
    status: "CLOSED",
  });
}
