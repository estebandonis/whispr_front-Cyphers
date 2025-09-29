import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import CornerAccents from "@/components/corner-accents";
import { Loader2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { useVerifyMfa } from "./queries";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router";
import { AxiosError } from "axios";

export default function MfaPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [otp, setOtp] = useState("");

  const { mutate: verifyMfa, isPending: verifyingMfa } = useVerifyMfa();

  const handleVerifyMfa = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (verifyingMfa) return;

    const userId = searchParams.get("userId");

    if (!userId) {
      toast.error("Missing user id");
      return;
    }

    if (!otp.trim()) {
      toast.error("Missing token");
      return;
    }

    verifyMfa(
      { token: otp, userId },
      {
        onSuccess: ({ success, message }) => {
          if (success) {
            toast.success(message || "MFA verified successfully");
            navigate("/chat");
          } else {
            toast.error("Error verifying MFA");
          }
        },
        onError: (error) => {
          if (error instanceof AxiosError) {
            toast.error("Error verifying MFA", {
              description: error.response?.data.error,
            });
            return;
          }
          toast.error("Error verifying MFA", {
            description: error.message,
          });
        },
      }
    );
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full ">
      <form
        className="animate-scale-in relative w-full max-w-md flex flex-col gap-4 bg-neutral-900 p-4 border border-neutral-800"
        onSubmit={handleVerifyMfa}
      >
        <CornerAccents />
        <h1 className="text-2xl text-neutral-200 uppercase font-heading">
          Verify Identity
        </h1>

        <p className="text-neutral-400 text-xs text-center">
          Please, enter the 6 digit Time based One Time Password from your
          authenticator app.
        </p>

        <Input
          placeholder="000 000"
          onChange={(e) => setOtp(e.target.value)}
          disabled={verifyingMfa}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          className="text-center !text-2xl font-bold tracking-widest h-fit my-4"
          value={otp}
          maxLength={6}
          minLength={6}
          pattern="[0-9]*"
        />
        <Button
          className="uppercase cursor-pointer font-medium"
          type="submit"
          disabled={verifyingMfa}
        >
          {verifyingMfa ? (
            <Loader2 className="animate-spin size-4" />
          ) : (
            "Verify"
          )}
        </Button>
      </form>
    </div>
  );
}
