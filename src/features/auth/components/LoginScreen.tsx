import { ConnectionBanner } from "@/components/ui/ConnectionBanner";
import { BrandPanel } from "./BrandPanel";
import { LoginForm } from "./LoginForm";

export function LoginScreen() {
  return (
    <div className="bg-surface-page flex min-h-screen flex-col">
      <ConnectionBanner />
      <div className="flex flex-1 flex-row flex-wrap">
        <BrandPanel />
        <div className="flex min-w-0 shrink grow-[999] basis-120 items-center justify-center px-5 py-12">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
