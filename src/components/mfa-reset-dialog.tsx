import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "./ui/button";
import { useResetMfa } from "@/features/auth/queries";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MfaResetDialog({ open, onOpenChange }: Props) {
  const { mutate: resetMfa, isPending: resettingMfa } = useResetMfa();

  const handleResetMfa = () => {
    resetMfa(undefined, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disable MFA</DialogTitle>
          <DialogDescription>
            Are you sure you want to disable your Multi-Factor Authentication?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={resettingMfa}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleResetMfa}
            disabled={resettingMfa}
            className="w-20"
          >
            {resettingMfa ? (
              <Loader2 className="animate-spin size-4" />
            ) : (
              "Disable"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
