import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <p className="jl-jacey text-7xl">🫠</p>
      <h1 className="font-display text-4xl font-extrabold">whoops. 404</h1>
      <p className="max-w-sm text-muted">this page went to get milk 🥛 and never came back. u found the void. say hi to the void 👋</p>
      <Link href="/" className="h-11 rounded-full bg-accent px-6 text-sm font-semibold leading-[2.75rem] text-on-accent shadow-md transition-transform hover:-rotate-2 hover:scale-105">
        take me home 🏠
      </Link>
    </div>
  );
}
