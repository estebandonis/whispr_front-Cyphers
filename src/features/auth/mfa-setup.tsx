import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import CornerAccents from "@/components/corner-accents";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useEnableMfa, useSetUpMfa } from "./queries";
import Loading from "../loading";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router";

export default function MfaPage() {
  const navigate = useNavigate();

  const [qrCode, setQrCode] = useState<string>();
  const [secret, setSecret] = useState<string>();

  const { mutate: setUpMfa, isPending: mfaLoading } = useSetUpMfa();
  const { mutate: enableMfa, isPending: enableMfaLoading } = useEnableMfa();

  const handleSetupMfa = () => {
    if (mfaLoading) return;
    setUpMfa(undefined, {
      onSuccess: ({ secret, qrCode }) => {
        setQrCode(qrCode);
        setSecret(secret);
      },
    });
  };

  const handleEnableMfa = () => {
    if (mfaLoading) return;
    enableMfa(undefined, {
      onSuccess: () => {
        toast.success("MFA enabled");
        navigate("/chat");
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
          disabled={enableMfaLoading}
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
          disabled={enableMfaLoading}
        />

        <p className="text-neutral-400 text-xs text-center">
          If you enable Multi-Factor Authentication it will be required to login
          with your authenticator app. Make sure to save the code in your
          authenticator app before enabling. If not, you will not be able to
          login.
        </p>

        <Button
          onClick={() => history.back()}
          className="uppercase cursor-pointer font-medium bg-black hover:bg-neutral-800 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={enableMfaLoading}
        >
          Cancel
        </Button>

        <Button
          className="uppercase cursor-pointer font-medium"
          onClick={handleEnableMfa}
          disabled={enableMfaLoading}
        >
          {enableMfaLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            "Enable"
          )}
        </Button>
      </div>
    </div>
  );
}
