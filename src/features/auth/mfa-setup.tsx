import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import CornerAccents from "@/components/corner-accents";
import { ChevronLeft } from "lucide-react";
import { useSetUpMfa } from "./queries";
import Loading from "../loading";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function MfaPage() {
  const [qrCode, setQrCode] = useState<string>();
  const [secret, setSecret] = useState<string>();
  const { mutate: setUpMfa, isPending: mfaLoading } = useSetUpMfa();

  const handleSetupMfa = () => {
    if (mfaLoading) return;
    setUpMfa(undefined, {
      onSuccess: ({ secret, qrCode }) => {
        setQrCode(qrCode);
        setSecret(secret);
      },
    });
  };

  useEffect(() => {
    if (mfaLoading) return;
    handleSetupMfa();
  }, []);

  if (mfaLoading || !qrCode || !secret) {
    return <Loading />;
  }

  return (
    <div className="flex flex-col items-center justify-center w-full h-full ">
      <div className="animate-scale-in relative w-full max-w-md flex flex-col gap-4 bg-neutral-900 p-4 border border-neutral-800 ">
        <CornerAccents />
        <button
          onClick={() => history.back()}
          type="button"
          className="p-2 pl-1 h-fit flex w-fit flex-row gap-1 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded cursor-pointer"
        >
          <ChevronLeft className="size-3" />{" "}
          <span className="leading-none my-auto text-xs">Back</span>
        </button>
        <h1 className="text-2xl text-neutral-200 uppercase font-heading text-center">
          Setup Multi-Factor Authentication
        </h1>

        {/* Placeholder for QR Code */}
        <div className="w-48 mx-auto p-2 h-48 bg-neutral-800 flex items-center justify-center text-neutral-500 rounded-md">
          <img
            src={qrCode}
            alt="QR Code"
            className="w-full h-full object-contain"
          />
        </div>

        <p className="text-neutral-400 text-xs text-center">
          Scan the QR code with your authenticator app or enter the code
          manually.
        </p>

        <Input
          placeholder="MFA Code"
          value={secret}
          readOnly
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          onClick={() => {
            navigator.clipboard.writeText(secret);
            toast.success("Copied to clipboard");
          }}
        />

        <Button
          className="uppercase cursor-pointer font-medium"
          onClick={() => {
            history.back();
          }}
        >
          Done
        </Button>
      </div>
    </div>
  );
}
