import LoginForm from "@/components/portal/LoginForm";
import { patientAuthMode } from "@/lib/device-auth";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginForm mode={patientAuthMode()} />;
}
