import CornerAccents from "@/components/corner-accents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router";
import { useState } from "react";
import { useRegister } from "./queries";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const navigate = useNavigate();

  const { mutate: register, isPending: registering } = useRegister();

  const handleSignUp = () => {
    if (
      !name.trim() ||
      !username.trim() ||
      !password.trim() ||
      !confirmPassword.trim()
    ) {
      toast.error("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    if (password.trim().length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    register(
      { name, username, password },
      {
        onSuccess: () => {
          toast.success("Account created");
          navigate("/");
        },
        onError: (error) => {
          toast.error("Error registering", { description: error.message });
        },
      }
    );
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full">
      <div className="animate-scale -in relative w-full max-w-md flex flex-col gap-4 bg-neutral-900 p-4 border border-neutral-800 ">
        <CornerAccents />
        <h1 className="text-2xl text-neutral-200 uppercase font-heading">
          Register
        </h1>
        <Input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          type="text"
          disabled={registering}
        />
        <Input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          type="text"
          className="text-neutral-200"
          disabled={registering}
        />
        <Input
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          className="text-neutral-200"
          disabled={registering}
        />
        <Input
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          type="password"
          className="text-neutral-200"
          disabled={registering}
        />
        <Button
          className="uppercase cursor-pointer font-medium"
          onClick={handleSignUp}
          disabled={registering}
        >
          {registering ? (
            <Loader2 className="animate-spin size-4" />
          ) : (
            "Sign Up"
          )}
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
