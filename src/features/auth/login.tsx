import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NavLink } from "react-router";
import CornerAccents from "@/components/corner-accents";

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full ">
      <div className="animate-scale-in relative w-full max-w-md flex flex-col gap-4 bg-neutral-900 p-4 border border-neutral-800 ">
        <CornerAccents />
        <h1 className="text-2xl text-neutral-200 uppercase font-heading">
          Whispr
        </h1>
        <Input placeholder="Email" />
        <Input placeholder="Password" />
        <Button asChild className="uppercase cursor-pointer font-medium">
          <NavLink to="/chat">Sign in</NavLink>
        </Button>
        <p className="text-neutral-400 text-xs text-center">
          <NavLink to="/sign-up" viewTransition className="hover:underline">
            I'm new here.
          </NavLink>
        </p>
      </div>
    </div>
  );
}
