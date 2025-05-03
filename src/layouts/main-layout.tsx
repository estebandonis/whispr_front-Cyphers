import { Outlet } from "react-router";

export default function MainLayout() {
  return (
    <div className="bg-neutral-950 h-screen w-full text-white font-body">
      <Outlet />
    </div>
  );
}
