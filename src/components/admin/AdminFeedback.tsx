import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/firebaseDb";
import { format } from "date-fns";
import { collection, getDocs } from "firebase/firestore";
import { db as firestore } from "@/lib/firebaseConfig";

function safeDate(d: any) {
  try {
    if (d?.seconds) d = new Date(d.seconds * 1000);
    else d = new Date(d);
    return isNaN(d.getTime()) ? "-" : format(d, "PPpp");
  } catch {
    return "-";
  }
}

export function AdminFeedback() {
  const [rows, setRows] = useState<any[]>([]);

  async function load() {
    let f: any[] = [];

    try {
      const snap = await getDocs(collection(firestore, "feedback"));
      f = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {}

    try {
      const legacy = await db.feedback?.();
      if (legacy?.data?.length) f = legacy.data;
    } catch {}

    setRows(f);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Feedback</h2>
      </div>

      {rows.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No feedback yet
          </CardContent>
        </Card>
      )}

      {rows.map((f) => (
        <Card key={f.id}>
          <CardHeader>
            <CardTitle className="text-base">
              {f.email || f.user || "Unknown"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {safeDate(f.created_at || f.createdAt || f.timestamp)}
            </p>
          </CardHeader>
          <CardContent>
              <div className="mb-2">{Array.from({length:5}).map((_,i)=> (<span key={i}>{i < Math.round(f.rating||0) ? '★' : '☆'}</span>))}</div>
              <div>{f.message || "-"}</div>
            </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default AdminFeedback;
