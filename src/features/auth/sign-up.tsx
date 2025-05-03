import CornerAccents from "@/components/corner-accents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router";

export default function SignUpPage() {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full">
      <div className="animate-scale -in relative w-full max-w-md flex flex-col gap-4 bg-neutral-900 p-4 border border-neutral-800 ">
        <CornerAccents />
        <h1 className="text-2xl text-neutral-200 uppercase font-heading">
          Register
        </h1>
        <Input placeholder="Name" />
        <Input placeholder="Email" />
        <Input placeholder="Password" />
        <Input placeholder="Confirm Password" />
        <Button className="uppercase cursor-pointer font-medium">
          Sign Up
        </Button>
        <p className="text-neutral-400 text-xs text-center">
          <Link to="/" className="hover:underline">
            I did this already.
          </Link>
        </p>
      </div>
    </div>
  );
}
