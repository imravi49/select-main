import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/firebaseDb";
import { collection, getDocs } from "firebase/firestore";
import { db as firestore } from "@/lib/firebaseConfig";
import { Users, Image, CheckCircle, MessageSquare } from "lucide-react";

export const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalPhotos: 0,
    totalSelections: 0,
    totalFeedback: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  // Original Supabase-style stats (preserved):
// const loadStats = async () => {
//   const [users, photos, selections, feedback] = await Promise.all([
//     db.profiles.list(),
//     db.photos.list(''), // This will need admin override
//     db.selections.list(''), // This will need admin override
//     db.feedback.list(),
//   ]);
//   setStats({
//     totalUsers: users.data?.length || 0,
//     totalPhotos: 0, // Will be calculated from all users
//     totalSelections: 0,
//     totalFeedback: feedback.data?.length || 0,
//   });
// };
const loadStats = async () => {
  // Firebase-only counts (client-side), no Cloud Functions.
  const [usersSnap, photosSnap, selectionsSnap, feedbackSnap] = await Promise.all([
    getDocs(collection(firestore, 'profiles')),
    getDocs(collection(firestore, 'photos')),
    getDocs(collection(firestore, 'selections')),
    getDocs(collection(firestore, 'feedback')),
  ]);
  setStats({
    totalUsers: usersSnap.size,
    totalPhotos: photosSnap.size,
    totalSelections: selectionsSnap.size,
    totalFeedback: feedbackSnap.size,
  });
};


  const statCards = [
    {
      title: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      title: "Total Photos",
      value: stats.totalPhotos,
      icon: Image,
      gradient: "from-purple-500 to-pink-500",
    },
    {
      title: "Selections",
      value: stats.totalSelections,
      icon: CheckCircle,
      gradient: "from-green-500 to-emerald-500",
    },
    {
      title: "Feedback",
      value: stats.totalFeedback,
      icon: MessageSquare,
      gradient: "from-orange-500 to-red-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Dashboard</h2>
        <p className="text-muted-foreground">Overview of your photo gallery system</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.gradient}`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
