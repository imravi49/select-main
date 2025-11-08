import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const AdminContacts = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Contacts</h2>
        <p className="text-muted-foreground">Contact requests from users</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contact List</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground">
          No contact requests yet
        </CardContent>
      </Card>
    </div>
  );
};
