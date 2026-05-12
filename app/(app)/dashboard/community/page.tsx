import { Card, CardHeader } from "@/components/ui/card";
import { SubmitPredictionForm } from "@/components/community/SubmitPredictionForm";

export default function Page() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h1 className="text-base font-semibold">Community</h1>
          <p className="mt-1 text-sm text-muted">
            Submit your own picks, track your record, and see what others are backing.
          </p>
        </CardHeader>
      </Card>

      <SubmitPredictionForm />
    </div>
  );
}
