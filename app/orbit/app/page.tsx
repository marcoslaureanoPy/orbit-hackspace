import type { Metadata } from "next";
import { OrbitAppClient } from "./OrbitAppClient";

export const metadata: Metadata = {
  title: "Orbit Workspace — nullGravitum",
  description:
    "Orbit workspace connected to your configured agent.",
};

export default function OrbitAppPage() {
  return (
    <div className="orbit-page fixed inset-0 z-30 bg-[#050607]">
      <OrbitAppClient />
    </div>
  );
}
