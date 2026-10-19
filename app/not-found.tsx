import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <p className="text-5xl">🕹️</p>
      <h1 className="text-2xl font-bold">That page isn&apos;t here</h1>
      <Link href="/" className="h-10 rounded-full bg-accent px-5 text-sm font-medium leading-10 text-on-accent hover:bg-accent-hover">
        Back to the games
      </Link>
    </div>
  );
}
