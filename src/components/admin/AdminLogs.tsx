import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db as firestore } from "@/lib/firebaseConfig";
import { format } from "date-fns";

function safeDate(d: any) {
  try {
    if (d?.seconds) d = new Date(d.seconds * 1000);
    else d = new Date(d);
    return isNaN(d.getTime()) ? "-" : format(d, "PPpp");
  } catch {
    return "-";
  }
}

export function AdminLogs() {
  const [rows, setRows] = useState<any[]>([]);

  async function load() {
    try {
      const q = query(collection(firestore, "activity_logs"), orderBy("created_at", "desc"));
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setRows(data);
    } catch {
      setRows([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Activity Logs</h2>
        <p className="text-muted-foreground">System and user activity</p>
      </div>

      {rows.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No logs found
          </CardContent>
        </Card>
      )}

      {rows.map((log) => (
        <Card key={log.id}>
          <CardHeader>
            <CardTitle className="text-base">
              {log.user_id || log.user || "System"} — {log.action || "-"} {log.count ? `(${log.count})` : ""}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {safeDate(log.created_at || log.timestamp)}
            </p>
          </CardHeader>
          <CardContent>
            <pre style={{whiteSpace:'pre-wrap',wordBreak:'break-word',fontSize:13,margin:0}}>
{JSON.stringify(log.details || log, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default AdminLogs;
