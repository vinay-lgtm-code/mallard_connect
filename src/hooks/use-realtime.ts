"use client";

import { useState, useEffect } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  Timestamp,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

type WithId<T> = T & { id: string };

function convertTimestamps<T>(data: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Timestamp) {
      result[key] = value.toDate();
    } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result[key] = convertTimestamps(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

interface RealtimeCollectionResult<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
}

export function useRealtimeCollection<T>(
  collectionPath: string,
  queryConstraints: QueryConstraint[] = []
): RealtimeCollectionResult<WithId<T>> {
  const [data, setData] = useState<WithId<T>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (collectionPath === "__skip__") {
      setData([]);
      setLoading(false);
      return;
    }

    const ref = collection(db, collectionPath);
    const q = queryConstraints.length > 0 ? query(ref, ...queryConstraints) : query(ref);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({
          id: d.id,
          ...convertTimestamps<T>(d.data()),
        }));
        setData(docs);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionPath, JSON.stringify(queryConstraints)]);

  return { data, loading, error };
}

interface RealtimeDocResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export function useRealtimeDoc<T>(docPath: string): RealtimeDocResult<WithId<T>> {
  const [data, setData] = useState<WithId<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const ref = doc(db, docPath);

    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        if (snapshot.exists()) {
          setData({ id: snapshot.id, ...convertTimestamps<T>(snapshot.data()) });
        } else {
          setData(null);
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [docPath]);

  return { data, loading, error };
}
