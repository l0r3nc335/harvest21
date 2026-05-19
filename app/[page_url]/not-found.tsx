import ErrorScreen from "@/components/errors/ErrorScreen";

export default function NotFound() {
  return <ErrorScreen status={404} />;
}
