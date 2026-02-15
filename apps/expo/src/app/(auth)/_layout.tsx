import { Slot } from "expo-router";

export default function AuthLayout() {
  // Placeholder auth guard — always renders children.
  // Actual auth checking will be added in Story 1.3.
  return <Slot />;
}
